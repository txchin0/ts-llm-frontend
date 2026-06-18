import type { AssistantMessage, ToolActivity } from '../../state/types.ts';

export function makeAssistantMessage(
  overrides: Partial<AssistantMessage> = {},
): AssistantMessage {
  return {
    id: 'assistant-1',
    role: 'assistant',
    content: '',
    thinking: '',
    tools: [],
    status: 'streaming',
    createdAt: 0,
    ...overrides,
  };
}

export function makeToolActivity(overrides: Partial<ToolActivity> = {}): ToolActivity {
  return {
    toolCallId: 'call-1',
    toolName: 'search',
    step: 1,
    input: { query: 'test' },
    status: 'running',
    ...overrides,
  };
}
