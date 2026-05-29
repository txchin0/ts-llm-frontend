import { useEffect, useRef } from 'react';

import type { ChatMessage } from '../state/types.ts';
import { BrainIcon } from './icons.tsx';
import { Message } from './Message.tsx';
import styles from './Transcript.module.css';

interface TranscriptProps {
  messages: ChatMessage[];
  showThinking: boolean;
  userId: string;
}

export function Transcript({ messages, showThinking, userId }: TranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);

  // Track whether the user is pinned to the bottom; only auto-scroll if so.
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    pinnedRef.current = distanceFromBottom < 80;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !pinnedRef.current) return;
    el.scrollTop = el.scrollHeight;
  });

  if (messages.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyInner}>
          <span className={styles.emptyMark}>
            <BrainIcon width={22} height={22} />
          </span>
          <h1 className={styles.emptyTitle}>Good to see you.</h1>
          <p className={styles.emptyText}>
            Ask anything. Answers stream in as they are written, with thinking steps and
            tool use shown along the way.
          </p>
          <p className={styles.emptySetup}>
            The agent server must be running. In dev, start it and use the Vite proxy, or
            point production at your host.
          </p>
          <p className={styles.emptyUser}>
            Speaking as <code>{userId}</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.scroll} ref={scrollRef} onScroll={handleScroll}>
      <div className={styles.column}>
        {messages.map((message) => (
          <Message key={message.id} message={message} showThinking={showThinking} />
        ))}
      </div>
    </div>
  );
}
