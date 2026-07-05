/** Callbacks a speech engine uses to report a listening session's progress. */
export interface SpeechEngineCallbacks {
  /** Full text recognized so far this session (finalized parts + current interim). */
  onTranscript: (sessionText: string) => void;
  /** Normalized mic input level 0..1; only some engines emit it. */
  onRms?: (level: number) => void;
  /** Error code in the Web Speech vocabulary; feeds `voiceErrorMessage()`. */
  onError: (code: string) => void;
  /** The engine began capturing audio. */
  onStart: () => void;
  /** The engine stopped listening (stop, fatal error, or natural end). */
  onEnd: () => void;
}

/**
 * Strategy interface for microphone speech-to-text input. Implementations own
 * transcript accumulation and keep-alive restarts for the whole session, so a
 * single `start` covers continuous dictation until `stop` or a fatal error.
 */
export interface SpeechInputEngine {
  /** Availability when knowable without async work (web constructor check). */
  isAvailableSync?: () => boolean;
  isAvailable(): Promise<boolean>;
  /** Begin a listening session in the given BCP 47 language. */
  start(language: string, callbacks: SpeechEngineCallbacks): void;
  /** End the session; `abort` discards any pending final result. */
  stop(opts?: { abort?: boolean }): void;
}
