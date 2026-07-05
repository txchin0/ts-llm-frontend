import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor config for the Ember Android app.
 *
 * The app talks to the ts-llm agent server over plain HTTP on the LAN, so the
 * WebView is served from the `http` scheme (origin `http://localhost`) and
 * cleartext traffic is allowed. The agent server must send CORS headers
 * allowing `http://localhost` (see the Phase 1 plan / README).
 *
 * `CapacitorHttp` MUST stay disabled: it does not support streaming responses
 * (SSE / ReadableStream), which the chat relies on. With it disabled, requests
 * use the native Chromium WebView `fetch`, which streams correctly.
 */
const config: CapacitorConfig = {
  appId: 'app.ember.mobile',
  appName: 'Ember',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    CapacitorHttp: {
      enabled: false,
    },
  },
};

export default config;
