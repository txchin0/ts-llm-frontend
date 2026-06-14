function isEmbeddedPreviewBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Electron/i.test(ua)) return true;
  if (/Cursor/i.test(ua)) return true;
  try {
    return !!(window.cursor || window.__CURSOR__ || window.__GLASS_BROWSER__);
  } catch {
    return false;
  }
}

/** User-facing copy for SpeechRecognition error codes; null = silent (expected). */
export function voiceErrorMessage(code: string): string | null {
  switch (code) {
    case 'not-allowed':
      return 'Microphone access blocked';
    case 'audio-capture':
      return 'No microphone found';
    case 'network':
      return isEmbeddedPreviewBrowser()
        ? 'Voice input works in Chrome or Safari. This preview browser cannot reach speech services.'
        : 'Voice input needs a network connection (browser speech uses a cloud service)';
    case 'service-not-allowed':
      return 'Voice input is not available in this browser tab';
    case 'language-not-supported':
      return 'Speech language not supported';
    case 'no-speech':
    case 'aborted':
      return null;
    default:
      return `Voice input failed (${code})`;
  }
}
