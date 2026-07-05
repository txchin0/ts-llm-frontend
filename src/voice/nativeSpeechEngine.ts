import type { PluginListenerHandle } from '@capacitor/core';
import { SpeechRecognition } from '@capgo/capacitor-speech-recognition';
import type { SpeechRecognitionPartialResultEvent } from '@capgo/capacitor-speech-recognition';

import type { SpeechEngineCallbacks, SpeechInputEngine } from './speechEngine.ts';

/** Android SpeechRecognizer error codes → Web Speech error vocabulary. */
function mapNativeErrorCode(code: string): string {
  switch (code) {
    case 'INSUFFICIENT_PERMISSIONS':
      return 'not-allowed';
    case 'AUDIO':
      return 'audio-capture';
    case 'NETWORK':
    case 'NETWORK_TIMEOUT':
      return 'network';
    case 'NO_MATCH':
    case 'SPEECH_TIMEOUT':
      return 'no-speech';
    case 'CLIENT':
    case 'RECOGNIZER_BUSY':
      return 'aborted';
    case 'SERVER':
    case 'SERVER_DISCONNECTED':
      return 'service-not-allowed';
    case 'LANGUAGE_NOT_SUPPORTED':
    case 'LANGUAGE_UNAVAILABLE':
      return 'language-not-supported';
    default:
      return code.toLowerCase();
  }
}

/**
 * Native Android engine backed by @capgo/capacitor-speech-recognition
 * (android.speech.SpeechRecognizer). Continuous listening is achieved via the
 * plugin's continuous-PTT mode: we "hold the button" for the whole session and
 * the plugin restarts recognition across silence, accumulating finalized text.
 */
export class NativeSpeechEngine implements SpeechInputEngine {
  private active = false;
  private started = false;
  private listeners: PluginListenerHandle[] = [];
  private callbacks: SpeechEngineCallbacks | null = null;

  async isAvailable(): Promise<boolean> {
    try {
      return (await SpeechRecognition.available()).available;
    } catch {
      return false;
    }
  }

  start(language: string, callbacks: SpeechEngineCallbacks): void {
    this.callbacks = callbacks;
    void this.begin(language, callbacks);
  }

  stop(opts?: { abort?: boolean }): void {
    const wasActive = this.active;
    this.active = false;
    this.started = false;
    void this.teardown(opts);
    if (wasActive) this.callbacks?.onEnd();
  }

  private async begin(language: string, callbacks: SpeechEngineCallbacks): Promise<void> {
    await this.teardown({ abort: true });
    this.active = true;
    this.started = false;

    try {
      const permission = await SpeechRecognition.requestPermissions();
      if (permission.speechRecognition !== 'granted') {
        this.fail('not-allowed');
        return;
      }
      if (!(await this.isAvailable())) {
        this.fail('recognizer-unavailable');
        return;
      }
      if (!this.active) return; // stopped while awaiting

      this.listeners.push(
        await SpeechRecognition.addListener('partialResults', (event) => {
          if (!this.active) return;
          const text = transcriptFrom(event);
          if (text) callbacks.onTranscript(text);
        }),
        await SpeechRecognition.addListener('error', (event) => {
          const code = mapNativeErrorCode(event.code);
          // Silence/cancel are expected mid-session; the plugin restarts itself.
          if (code === 'no-speech' || code === 'aborted') return;
          this.fail(code);
        }),
        await SpeechRecognition.addListener('listeningState', (event) => {
          if (!this.active) return;
          if (event.state === 'started' || event.status === 'started') {
            if (!this.started) {
              this.started = true;
              callbacks.onStart();
            }
            return;
          }
          // A finite 'stopped' only fires when the session genuinely finished
          // (healthy continuous restarts never emit it). Errors arrive via the
          // error listener; anything else is a natural end.
          if (event.state === 'stopped' && event.reason !== 'error') {
            this.active = false;
            this.started = false;
            void this.teardown();
            callbacks.onEnd();
          }
        }),
      );

      if (!this.active) return;
      await SpeechRecognition.start({
        language,
        maxResults: 1,
        partialResults: true,
        popup: false,
        continuousPTT: true,
        muteRecognizerBeep: true,
      });
      await SpeechRecognition.setPTTState({ held: true });
    } catch {
      this.fail('start-failed');
    }
  }

  private fail(code: string): void {
    if (!this.active) return;
    this.active = false;
    this.started = false;
    void this.teardown({ abort: true });
    this.callbacks?.onError(code);
    this.callbacks?.onEnd();
  }

  private async teardown(opts?: { abort?: boolean }): Promise<void> {
    const listeners = this.listeners;
    this.listeners = [];
    try {
      await Promise.all(listeners.map((listener) => listener.remove()));
      await SpeechRecognition.setPTTState({ held: false });
      if (opts?.abort) await SpeechRecognition.forceStop();
      else await SpeechRecognition.stop();
    } catch {
      /* session may already be gone */
    }
  }
}

function transcriptFrom(event: SpeechRecognitionPartialResultEvent): string {
  // Final payloads carry the whole session in accumulatedText; restart payloads
  // already fold the latest result into accumulated.
  if (typeof event.accumulatedText === 'string') return event.accumulatedText;
  if (event.isRestarting) return event.accumulated ?? '';
  const current = event.matches?.[0] ?? '';
  if (!event.accumulated) return current;
  return current ? `${event.accumulated} ${current}` : event.accumulated;
}
