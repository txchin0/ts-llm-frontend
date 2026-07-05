import { memo } from 'react';

import type { AssistantMessage, ChatMessage } from '../state/types.ts';
import { AlertIcon } from './icons.tsx';
import { Markdown } from './Markdown.tsx';
import { ThinkingPanel } from './ThinkingPanel.tsx';
import { StreamingDots } from './StreamingDots.tsx';
import { ToolChip } from './ToolChip.tsx';
import styles from './Message.module.css';

interface MessageProps {
  message: ChatMessage;
  showThinking: boolean;
  showToolCalls: boolean;
}

export const Message = memo(function Message({ message, showThinking, showToolCalls }: MessageProps) {
  if (message.role === 'user') {
    return (
      <div className={`${styles.row} ${styles.user}`}>
        <div className={styles.userBubble}>{message.content}</div>
      </div>
    );
  }

  return (
    <div className={`${styles.row} ${styles.assistant}`}>
      <div className={styles.assistantInner}>
        <span className={styles.speaker}>
          <span className={styles.speakerMark} />
          Agent
        </span>
        <AssistantBody message={message} showThinking={showThinking} showToolCalls={showToolCalls} />
      </div>
    </div>
  );
});

function AssistantBody({
  message,
  showThinking,
  showToolCalls,
}: {
  message: AssistantMessage;
  showThinking: boolean;
  showToolCalls: boolean;
}) {
  const streaming = message.status === 'streaming';
  const hasContent = message.content.length > 0;
  const hasThinking = message.thinking.length > 0;

  return (
    <>
      {showThinking && hasThinking ? (
        <ThinkingPanel text={message.thinking} streaming={streaming} />
      ) : null}

      {showToolCalls
        ? message.tools.map((tool) => <ToolChip key={tool.toolCallId} tool={tool} />)
        : null}

      {hasContent ? (
        <div>
          <Markdown>{message.content}</Markdown>
          {streaming ? <span className={styles.caret} aria-hidden="true" /> : null}
        </div>
      ) : streaming ? (
        <StreamingDots />
      ) : null}

      {message.status === 'error' && message.error ? (
        <div className={styles.error} role="alert">
          <AlertIcon className={styles.errorIcon} width={18} height={18} />
          <div className={styles.errorBody}>
            <p>{message.error.message}</p>
            {message.error.code && message.error.code !== 'client_error' ? (
              <details className={styles.errorDetails}>
                <summary>Technical details</summary>
                <code>{message.error.code}</code>
              </details>
            ) : null}
          </div>
        </div>
      ) : null}

      {message.status === 'aborted' ? (
        <p className={styles.aborted}>Generation stopped.</p>
      ) : null}

      {message.status === 'complete' && message.usage ? (
        <p className={styles.meta}>
          {message.usage.total_tokens.toLocaleString()} tokens
          {' · '}
          {message.usage.input_tokens.toLocaleString()} in
          {' / '}
          {message.usage.output_tokens.toLocaleString()} out
        </p>
      ) : null}
    </>
  );
}
