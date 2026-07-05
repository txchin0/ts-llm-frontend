import type { SpeechEngineCallbacks, SpeechInputEngine } from './speechEngine.ts';

function getRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

function releaseRecognition(recognition: SpeechRecognition | null, opts?: { abort?: boolean }) {
  if (!recognition) return;
  recognition.onstart = null;
  recognition.onresult = null;
  recognition.onerror = null;
  recognition.onend = null;
  try {
    if (opts?.abort) recognition.abort();
    else recognition.stop();
  } catch {
    /* already ended */
  }
}

/**
 * Web Speech API engine. Uses continuous listening and restarts automatically
 * when the browser ends a session early (common on Android Chrome).
 */
export class WebSpeechEngine implements SpeechInputEngine {
  private recognition: SpeechRecognition | null = null;
  private wantsListening = false;
  private finalText = '';
  private callbacks: SpeechEngineCallbacks | null = null;
  private language = '';

  isAvailableSync = (): boolean => getRecognitionConstructor() !== undefined;

  isAvailable(): Promise<boolean> {
    return Promise.resolve(this.isAvailableSync());
  }

  start(language: string, callbacks: SpeechEngineCallbacks): void {
    if (!getRecognitionConstructor()) {
      callbacks.onError('unsupported');
      callbacks.onEnd();
      return;
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      callbacks.onError('insecure-context');
      callbacks.onEnd();
      return;
    }

    this.clearEngine({ abort: true });
    this.callbacks = callbacks;
    this.language = language;
    this.finalText = '';
    this.wantsListening = true;
    this.launch();
  }

  stop(opts?: { abort?: boolean }): void {
    this.wantsListening = false;
    this.clearEngine(opts);
    this.callbacks?.onEnd();
  }

  private clearEngine(opts?: { abort?: boolean }): void {
    const rec = this.recognition;
    this.recognition = null;
    releaseRecognition(rec, opts);
  }

  private launch(): void {
    const Constructor = getRecognitionConstructor();
    if (!Constructor || !this.wantsListening || !this.callbacks) return;
    const callbacks = this.callbacks;

    const recognition = new Constructor();
    recognition.lang = this.language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      callbacks.onStart();
    };

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) {
          this.finalText += transcript;
        } else {
          interim += transcript;
        }
      }
      callbacks.onTranscript(this.finalText + interim);
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }
      this.wantsListening = false;
      if (this.recognition === recognition) {
        this.recognition = null;
      }
      releaseRecognition(recognition, { abort: true });
      callbacks.onError(event.error);
      callbacks.onEnd();
    };

    recognition.onend = () => {
      if (this.recognition !== recognition) return;
      this.recognition = null;

      if (!this.wantsListening) {
        callbacks.onEnd();
        return;
      }

      // Android Chrome often ends sessions despite continuous=true; restart.
      window.setTimeout(() => {
        if (!this.wantsListening) {
          callbacks.onEnd();
          return;
        }
        this.launch();
      }, 50);
    };

    this.recognition = recognition;
    try {
      recognition.start();
    } catch (err) {
      this.recognition = null;
      this.wantsListening = false;
      const code =
        err instanceof Error && err.message.includes('already started')
          ? 'already-started'
          : 'start-failed';
      callbacks.onError(code);
      callbacks.onEnd();
    }
  }
}
