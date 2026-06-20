/**
 * Product metadata and PWA shell colors.
 *
 * Hex values match `--bg` in `src/styles/tokens.css` (see DESIGN.md).
 * HTML meta tags should stay aligned manually; the web manifest is generated
 * from `pwaManifest` at dev/build time.
 */

export const APP_NAME = 'Ember';
export const APP_SHORT_NAME = 'Ember';
export const APP_TITLE = 'Ember · ts-llm';
export const APP_DESCRIPTION =
  'A warm, fast chat interface for the ts-llm agent server.';

/** Light theme page background (`--bg` in tokens.css). */
export const THEME_LIGHT_HEX = '#ffffff';
/** Dark theme page background (`--bg` in tokens.css). */
export const THEME_DARK_HEX = '#191512';

export const PWA_MANIFEST_ID = '/';

export function themeColorHex(theme: 'light' | 'dark'): string {
  return theme === 'light' ? THEME_LIGHT_HEX : THEME_DARK_HEX;
}

/**
 * Web app manifest body. Install splash uses the dark shell to match the icon;
 * runtime `theme-color` meta updates to the resolved app theme on load.
 */
export const pwaManifest = {
  id: PWA_MANIFEST_ID,
  name: APP_NAME,
  short_name: APP_SHORT_NAME,
  description: APP_DESCRIPTION,
  theme_color: THEME_DARK_HEX,
  background_color: THEME_DARK_HEX,
  display: 'standalone',
  start_url: '/',
  scope: '/',
  icons: [
    {
      src: 'pwa-192x192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: 'pwa-192x192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'maskable',
    },
    {
      src: 'pwa-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: 'maskable-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
} as const;
