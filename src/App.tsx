import { useCallback, useEffect, useState } from 'react';

import { Composer } from './components/Composer.tsx';
import { Header } from './components/Header.tsx';
import { TasksPanel } from './components/TasksPanel.tsx';
import { Transcript } from './components/Transcript.tsx';
import { UserIdDialog } from './components/UserIdDialog.tsx';
import { useChat } from './state/useChat.ts';
import { useSettings } from './state/useSettings.ts';
import { useTasks } from './state/useTasks.ts';
import { useSpeechInput } from './voice/useSpeechInput.ts';
import styles from './App.module.css';

export function App() {
  const { userId, setUserId, theme, setTheme } = useSettings();
  const { messages, isStreaming, hasSession, send, stop, reset } = useChat({ userId });

  const [input, setInput] = useState('');
  const [showThinking, setShowThinking] = useState(true);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [tasksExpanded, setTasksExpanded] = useState(false);

  const tasks = useTasks({
    userId,
    pollIntervalMs: tasksExpanded ? 5_000 : 20_000,
  });

  const voice = useSpeechInput({
    onTranscript: (text) => setInput(text),
  });

  const handleSubmit = useCallback(() => {
    if (voice.isListening) voice.stop({ abort: true });
    const text = input;
    setInput('');
    send(text);
  }, [input, send, voice]);

  const handleNewChat = useCallback(() => {
    reset();
    setInput('');
  }, [reset]);

  const handleSaveUserId = useCallback(
    (nextUserId: string) => {
      setUserDialogOpen(false);
      if (nextUserId !== userId) {
        setUserId(nextUserId);
        reset();
      }
    },
    [reset, setUserId, userId],
  );

  const toggleVoice = useCallback(() => {
    if (voice.isListening) {
      voice.stop({ abort: true });
    } else {
      voice.clearError();
      voice.start(input);
    }
  }, [input, voice]);

  useEffect(() => {
    if (tasks.tasks.length === 0 && tasksExpanded) {
      setTasksExpanded(false);
    }
  }, [tasks.tasks.length, tasksExpanded]);

  return (
    <div className={styles.app}>
      <Header
        userId={userId}
        theme={theme}
        onSetTheme={setTheme}
        showThinking={showThinking}
        onToggleThinking={() => setShowThinking((value) => !value)}
        hasSession={hasSession || messages.length > 0}
        onNewChat={handleNewChat}
        onOpenUserDialog={() => setUserDialogOpen(true)}
      />

      <main className={styles.main}>
        <Transcript messages={messages} showThinking={showThinking} userId={userId} />
        {tasks.tasks.length > 0 ? (
          <TasksPanel
            expanded={tasksExpanded}
            onToggle={() => setTasksExpanded((value) => !value)}
            tasks={tasks.tasks}
            isLoading={tasks.isLoading}
            error={tasks.error}
            onRefresh={tasks.refresh}
          />
        ) : null}
        <Composer
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          onStop={stop}
          isStreaming={isStreaming}
          voiceSupported={voice.supported}
          isListening={voice.isListening}
          voiceError={voice.error}
          onToggleVoice={toggleVoice}
        />
      </main>

      <UserIdDialog
        open={userDialogOpen}
        currentUserId={userId}
        hasActiveSession={hasSession || messages.length > 0}
        onClose={() => setUserDialogOpen(false)}
        onSave={handleSaveUserId}
      />

    </div>
  );
}
