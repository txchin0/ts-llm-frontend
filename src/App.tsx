import { useCallback, useMemo, useState } from 'react';

import { Capacitor } from '@capacitor/core';

import { AuthScreen } from './components/AuthScreen.tsx';
import { Composer } from './components/Composer.tsx';
import { HandsFreeMode } from './components/HandsFreeMode.tsx';
import { Header } from './components/Header.tsx';
import { SettingsDialog } from './components/SettingsDialog.tsx';
import { TasksPanel } from './components/TasksPanel.tsx';
import { Transcript } from './components/Transcript.tsx';
import { useAuth, type Auth } from './state/useAuth.ts';
import { selectLatestAssistant, useChat } from './state/useChat.ts';
import { useConversationInput } from './state/useConversationInput.ts';
import { useSettings, type Settings } from './state/useSettings.ts';
import { useTasks } from './state/useTasks.ts';
import styles from './App.module.css';

export function App() {
  const auth = useAuth();
  const settings = useSettings();

  if (auth.status === 'initializing') {
    // Waiting on the native token bootstrap; avoid flashing the login screen.
    return null;
  }

  if (auth.status === 'signedOut') {
    return (
      <AuthScreen
        initialUserId={auth.lastUserId}
        onLogin={auth.login}
        onRegister={auth.register}
        // On native there is no same-origin default; the server must be
        // reachable before login, so expose the URL field here too.
        {...(Capacitor.isNativePlatform()
          ? {
              serverUrl: settings.serverUrl,
              onServerUrlChange: settings.setServerUrl,
            }
          : {})}
      />
    );
  }

  // Key by account so switching users remounts with a fresh conversation.
  return <ChatApp key={auth.userId} auth={auth} settings={settings} />;
}

interface ChatAppProps {
  auth: Extract<Auth, { status: 'signedIn' }>;
  settings: Settings;
}

function ChatApp({ auth, settings }: ChatAppProps) {
  const { serverUrl, setServerUrl, theme, setTheme, micLanguage, setMicLanguage, showThinking, setShowThinking, showToolCalls, setShowToolCalls } =
    settings;
  const { messages, isStreaming, hasSession, send, stop, reset } = useChat();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tasksExpanded, setTasksExpanded] = useState(false);

  const conversation = useConversationInput({ send, stop, isStreaming, micLanguage });
  const { setInput } = conversation;

  const latestAssistant = useMemo(() => selectLatestAssistant(messages), [messages]);

  const tasks = useTasks({
    pollIntervalMs: tasksExpanded ? 5_000 : 20_000,
  });

  if (tasks.tasks.length === 0 && tasksExpanded) {
    setTasksExpanded(false);
  }

  const handleNewChat = useCallback(() => {
    reset();
    setInput('');
  }, [reset, setInput]);

  const handleLogout = useCallback(() => {
    setSettingsOpen(false);
    void auth.logout();
  }, [auth]);

  const hasActiveSession = hasSession || messages.length > 0;

  return (
    <div className={styles.app}>
      <Header
        userId={auth.userId}
        theme={theme}
        onSetTheme={setTheme}
        hasSession={hasActiveSession}
        onNewChat={handleNewChat}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className={styles.main}>
        <Transcript
          messages={messages}
          showThinking={showThinking}
          showToolCalls={showToolCalls}
          userId={auth.userId}
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
          value={conversation.input}
          onChange={setInput}
          onSubmit={conversation.submit}
          onStop={stop}
          isStreaming={isStreaming}
          voiceSupported={conversation.voice.supported}
          isListening={conversation.voice.isListening}
          voiceError={conversation.voice.error}
          onToggleVoice={conversation.voice.toggle}
          onEnterHandsFree={conversation.handsFree.enter}
        />
      </main>

      <HandsFreeMode
        open={conversation.handsFree.isOpen}
        onClose={conversation.handsFree.close}
        latest={latestAssistant}
        transcript={conversation.handsFree.transcript}
        micState={conversation.handsFree.micState}
        onMicPress={conversation.handsFree.toggleMic}
        voiceSupported={conversation.voice.supported}
      />

      <SettingsDialog
        open={settingsOpen}
        userId={auth.userId}
        onLogout={handleLogout}
        hasActiveSession={hasActiveSession}
        serverUrl={serverUrl}
        onServerUrlChange={setServerUrl}
        theme={theme}
        onThemeChange={setTheme}
        showThinking={showThinking}
        onShowThinkingChange={setShowThinking}
        showToolCalls={showToolCalls}
        onShowToolCallsChange={setShowToolCalls}
        micLanguage={micLanguage}
        onMicLanguageChange={setMicLanguage}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
