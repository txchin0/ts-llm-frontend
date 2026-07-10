import type { RespondStreamEvent } from '../api/client.ts';
import type { AssistantMessage, ToolActivity } from './types.ts';

/** Apply a single streamed respond event to an in-flight assistant message. */
export function applyRespondEvent(
  message: AssistantMessage,
  event: RespondStreamEvent,
): AssistantMessage {
  switch (event.type) {
    case 'start':
      return { ...message, requestId: event.request_id };
    case 'delta':
      return { ...message, content: message.content + event.text };
    case 'thinking_delta':
      return { ...message, thinking: message.thinking + event.text };
    case 'tool_call': {
      const activity: ToolActivity = {
        toolCallId: event.tool_call_id,
        toolName: event.tool_name,
        step: event.step,
        input: event.input,
        status: 'running',
      };
      return { ...message, tools: [...message.tools, activity] };
    }
    case 'tool_result':
      return {
        ...message,
        tools: message.tools.map((tool) =>
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
      };
    case 'usage':
      return { ...message, usage: event.usage };
    case 'final':
      return {
        ...message,
        status: message.status === 'streaming' ? 'complete' : message.status,
        finishReason: event.finish_reason,
      };
    case 'error':
      return {
        ...message,
        status: 'error',
        error: { code: event.code, message: event.message },
      };
    case 'malformed':
      // Wire corruption / incomplete shape — logged at the stream boundary if
      // needed; the transcript stays unchanged (same as Android Ignored≠Malformed
      // split: UI must not treat malformed like a successful skip of work).
      return message;
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

/** Mark a streaming assistant message complete when the SSE stream ends. */
export function completeStreamingMessage(message: AssistantMessage): AssistantMessage {
  return message.status === 'streaming' ? { ...message, status: 'complete' } : message;
}
