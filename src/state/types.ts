import type { ProviderFinishReason, ProviderUsage } from '../api/types.ts';

export type MessageRole = 'user' | 'assistant';

export type AssistantStatus = 'streaming' | 'complete' | 'error' | 'aborted';

export type ToolStatus = 'running' | 'done' | 'error';

export interface ToolActivity {
  toolCallId: string;
  toolName: string;
  step: number;
  input: unknown;
  output?: unknown;
  isError?: boolean;
  errorCode?: string;
  errorMessage?: string;
  status: ToolStatus;
}

export interface UserMessage {
  id: string;
  role: 'user';
  content: string;
  createdAt: number;
}

export interface AssistantMessage {
  id: string;
  role: 'assistant';
  /** Accumulated `delta` text (the spoken/normal answer). */
  content: string;
  /** Accumulated `thinking_delta` text (reasoning), shown separately. */
  thinking: string;
  tools: ToolActivity[];
  status: AssistantStatus;
  requestId?: string;
  finishReason?: ProviderFinishReason;
  usage?: ProviderUsage;
  error?: { code: string; message: string };
  createdAt: number;
  /**
   * Reserved for future server-streamed TTS audio playback. The transport
   * already surfaces unknown events, so a later `audio` frame can populate
   * this without reworking the message model.
   */
  audioUrl?: string;
}

export type ChatMessage = UserMessage | AssistantMessage;
