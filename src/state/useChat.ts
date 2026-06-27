import { useCallback, useRef, useState } from 'react';

import { ApiHttpError, respondStream } from '../api/client.ts';
import { applyRespondEvent, completeStreamingMessage } from './chatStreamReducer.ts';
import type { AssistantMessage, ChatMessage } from './types.ts';

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
  hasSession: boolean;
  send: (text: string) => void;
  stop: () => void;
  reset: () => void;
}

export function selectLatestAssistant(
  messages: ChatMessage[],
): AssistantMessage | undefined {
  return messages.findLast((message): message is AssistantMessage => message.role === 'assistant');
}

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
            if (event.type === 'start') {
              sessionIdRef.current = event.session_id;
              setHasSession(true);
            }
            patchAssistant(assistantId, (message) => applyRespondEvent(message, event));
          }

          patchAssistant(assistantId, completeStreamingMessage);
        } catch (error) {
          if (controller.signal.aborted) {
            patchAssistant(assistantId, (message) =>
              message.status === 'streaming' ? { ...message, status: 'aborted' } : message,
            );
          } else {
            const errorMessage =
              error instanceof ApiHttpError
                ? error.message
                : error instanceof Error
                  ? error.message
                  : 'Something went wrong while sending your message. Try again.';
            patchAssistant(assistantId, (message) => ({
              ...message,
              status: 'error',
              error: {
                code: error instanceof ApiHttpError ? `http_${error.status}` : 'client_error',
                message: errorMessage,
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
