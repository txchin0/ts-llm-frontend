import { useCallback, useRef, useState } from 'react';

import { RespondHttpError, respondStream } from '../api/client.ts';
import type { AssistantMessage, ChatMessage, ToolActivity } from './types.ts';

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export interface UseChatOptions {
  userId: string;
}

export interface UseChat {
  messages: ChatMessage[];
  isStreaming: boolean;
  /** True once at least one turn has produced a server session. */
  hasSession: boolean;
  send: (text: string) => void;
  stop: () => void;
  /** Clears the transcript and forgets the session (starts a new chat). */
  reset: () => void;
}

/**
 * In-memory chat state. Nothing here is persisted. Each assistant turn keeps
 * `content` (normal output) and `thinking` (reasoning) separate, plus a list of
 * tool activities, so the UI can render them distinctly.
 */
export function useChat({ userId }: UseChatOptions): UseChat {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  const sessionIdRef = useRef<string | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);

  const patchAssistant = useCallback(
    (id: string, update: (message: AssistantMessage) => AssistantMessage) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === id && message.role === 'assistant' ? update(message) : message,
        ),
      );
    },
    [],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    sessionIdRef.current = undefined;
    setHasSession(false);
    setIsStreaming(false);
    setMessages([]);
  }, []);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length === 0 || isStreaming) return;

      const assistantId = createId();
      const userMessage: ChatMessage = {
        id: createId(),
        role: 'user',
        content: trimmed,
        createdAt: Date.now(),
      };
      const assistantMessage: AssistantMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        thinking: '',
        tools: [],
        status: 'streaming',
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      void (async () => {
        try {
          const stream = respondStream(
            {
              user_id: userId,
              message: trimmed,
              show_thinking: true,
              ...(sessionIdRef.current ? { session_id: sessionIdRef.current } : {}),
            },
            { signal: controller.signal },
          );

          for await (const event of stream) {
            switch (event.type) {
              case 'start': {
                sessionIdRef.current = event.session_id;
                setHasSession(true);
                patchAssistant(assistantId, (m) => ({ ...m, requestId: event.request_id }));
                break;
              }
              case 'delta': {
                patchAssistant(assistantId, (m) => ({ ...m, content: m.content + event.text }));
                break;
              }
              case 'thinking_delta': {
                patchAssistant(assistantId, (m) => ({
                  ...m,
                  thinking: m.thinking + event.text,
                }));
                break;
              }
              case 'tool_call': {
                const activity: ToolActivity = {
                  toolCallId: event.tool_call_id,
                  toolName: event.tool_name,
                  step: event.step,
                  input: event.input,
                  status: 'running',
                };
                patchAssistant(assistantId, (m) => ({ ...m, tools: [...m.tools, activity] }));
                break;
              }
              case 'tool_result': {
                patchAssistant(assistantId, (m) => ({
                  ...m,
                  tools: m.tools.map((tool) =>
                    tool.toolCallId === event.tool_call_id
                      ? {
                          ...tool,
                          output: event.output,
                          isError: event.is_error,
                          errorCode: event.error_code,
                          errorMessage: event.error_message,
                          status: event.is_error ? 'error' : 'done',
                        }
                      : tool,
                  ),
                }));
                break;
              }
              case 'usage': {
                patchAssistant(assistantId, (m) => ({ ...m, usage: event.usage }));
                break;
              }
              case 'final': {
                patchAssistant(assistantId, (m) => ({
                  ...m,
                  status: m.status === 'streaming' ? 'complete' : m.status,
                  finishReason: event.finish_reason,
                }));
                break;
              }
              case 'error': {
                patchAssistant(assistantId, (m) => ({
                  ...m,
                  status: 'error',
                  error: { code: event.code, message: event.message },
                }));
                break;
              }
              case 'unknown': {
                // Reserved for future server events (e.g. TTS audio). Ignored for now.
                break;
              }
            }
          }

          // If the stream ended without a terminal event, mark it complete.
          patchAssistant(assistantId, (m) =>
            m.status === 'streaming' ? { ...m, status: 'complete' } : m,
          );
        } catch (error) {
          if (controller.signal.aborted) {
            patchAssistant(assistantId, (m) =>
              m.status === 'streaming' ? { ...m, status: 'aborted' } : m,
            );
          } else {
            const message =
              error instanceof RespondHttpError
                ? error.message
                : error instanceof Error
                  ? error.message
                  : 'Something went wrong while sending your message. Try again.';
            patchAssistant(assistantId, (m) => ({
              ...m,
              status: 'error',
              error: {
                code:
                  error instanceof RespondHttpError
                    ? `http_${error.status}`
                    : 'client_error',
                message,
              },
            }));
          }
        } finally {
          if (abortRef.current === controller) {
            abortRef.current = null;
          }
          setIsStreaming(false);
        }
      })();
    },
    [isStreaming, patchAssistant, userId],
  );

  return { messages, isStreaming, hasSession, send, stop, reset };
}
