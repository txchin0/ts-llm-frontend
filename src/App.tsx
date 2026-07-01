import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Composer } from './components/Composer.tsx';
import { HandsFreeMode } from './components/HandsFreeMode.tsx';
import { Header } from './components/Header.tsx';
import { SettingsDialog } from './components/SettingsDialog.tsx';
import { TasksPanel } from './components/TasksPanel.tsx';
import { Transcript } from './components/Transcript.tsx';
import { UserIdDialog } from './components/UserIdDialog.tsx';
import { selectLatestAssistant, useChat } from './state/useChat.ts';
import { useHandsFree } from './state/useHandsFree.ts';
import { useSettings } from './state/useSettings.ts';
import { useTasks } from './state/useTasks.ts';
import { resolveMicLanguage } from './voice/speechLanguages.ts';
import type { MicLanguagePreference } from './voice/speechLanguages.ts';
import { useSpeechInput } from './voice/useSpeechInput.ts';
import styles from './App.module.css';

export function App() {
  const { userId, setUserId, theme, setTheme, micLanguage, setMicLanguage, showThinking, setShowThinking, showToolCalls, setShowToolCalls } =
    useSettings();
  const { messages, isStreaming, hasSession, send, stop, reset } = useChat({ userId });

  const [input, setInput] = useState('');
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tasksExpanded, setTasksExpanded] = useState(false);

  const resolvedMicLanguage = useMemo(() => resolveMicLanguage(micLanguage), [micLanguage]);
  const handsFreeIsOpenRef = useRef(false);
  const handleHandsFreeTranscriptRef = useRef<(text: string) => void>(() => {});

  const onTranscript = useCallback((text: string) => {
    if (handsFreeIsOpenRef.current) {
      handleHandsFreeTranscriptRef.current(text);
    } else {
      setInput(text);
    }
  }, []);

  const voice = useSpeechInput({
    onTranscript,
    language: resolvedMicLanguage,
  });

  const handsFree = useHandsFree({
    send,
    stop,
    isStreaming,
    isListening: voice.isListening,
    startListening: voice.start,
    stopListening: voice.stop,
  });

  useEffect(() => {
    handsFreeIsOpenRef.current = handsFree.isOpen;
    handleHandsFreeTranscriptRef.current = handsFree.handleTranscript;
  }, [handsFree.isOpen, handsFree.handleTranscript]);

  const latestAssistant = useMemo(() => selectLatestAssistant(messages), [messages]);

  const tasks = useTasks({
    userId,
    pollIntervalMs: tasksExpanded ? 5_000 : 20_000,
  });

  if (tasks.tasks.length === 0 && tasksExpanded) {
    setTasksExpanded(false);
  }

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

  const handleEnterHandsFree = useCallback(() => {
    if (voice.isListening) voice.stop({ abort: true });
    voice.clearError();
    handsFree.open();
  }, [handsFree, voice]);

  const handleMicLanguageChange = useCallback(
    (next: MicLanguagePreference) => {
      setMicLanguage(next);
      if (voice.isListening) {
        const base = handsFree.isOpen ? handsFree.transcript : input;
        voice.stop({ abort: true });
        voice.clearError();
        voice.start(base);
      }
    },
    [handsFree.isOpen, handsFree.transcript, input, setMicLanguage, voice],
  );

  const hasActiveSession = hasSession || messages.length > 0;

  return (
    <div className={styles.app}>
      <Header
        userId={userId}
        theme={theme}
        onSetTheme={setTheme}
        hasSession={hasActiveSession}
        onNewChat={handleNewChat}
        onOpenUserDialog={() => setUserDialogOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className={styles.main}>
        <Transcript
          messages={messages}
          showThinking={showThinking}
          showToolCalls={showToolCalls}
          userId={userId}
        />
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
          onEnterHandsFree={handleEnterHandsFree}
        />
      </main>

      <HandsFreeMode
        open={handsFree.isOpen}
        onClose={handsFree.close}
        latest={latestAssistant}
        transcript={handsFree.transcript}
        micState={handsFree.micState}
        onMicPress={handsFree.toggleMic}
        voiceSupported={voice.supported}
      />

      <UserIdDialog
        open={userDialogOpen}
        currentUserId={userId}
        hasActiveSession={hasActiveSession}
        onClose={() => setUserDialogOpen(false)}
        onSave={handleSaveUserId}
      />

      <SettingsDialog
        open={settingsOpen}
        userId={userId}
        hasActiveSession={hasActiveSession}
        theme={theme}
        onThemeChange={setTheme}
        showThinking={showThinking}
        onShowThinkingChange={setShowThinking}
        showToolCalls={showToolCalls}
        onShowToolCallsChange={setShowToolCalls}
        micLanguage={micLanguage}
        onMicLanguageChange={handleMicLanguageChange}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
