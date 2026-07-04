/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TS_LLM_TARGET?: string;
  /** Set to 'true' for the Capacitor/native build to disable the PWA service worker. */
  readonly VITE_NATIVE_BUILD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// CSS-only @fontsource packages ship no type declarations.
declare module '@fontsource-variable/fraunces';
declare module '@fontsource-variable/hanken-grotesk';
declare module '@fontsource-variable/jetbrains-mono';
