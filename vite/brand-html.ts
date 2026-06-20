import type { Plugin } from 'vite';

import {
  APP_DESCRIPTION,
  APP_SHELL_TITLE,
  THEME_DARK_HEX,
} from '../src/brand';

const BRAND_HTML_PLACEHOLDERS = {
  __APP_SHELL_TITLE__: APP_SHELL_TITLE,
  __APP_DESCRIPTION__: APP_DESCRIPTION,
  __THEME_DARK_HEX__: THEME_DARK_HEX,
} as const;

/** Injects product metadata from `src/brand.ts` into index.html at dev/build time. */
export function brandHtmlPlugin(): Plugin {
  return {
    name: 'brand-html',
    transformIndexHtml(html) {
      let result = html;

      for (const [placeholder, value] of Object.entries(BRAND_HTML_PLACEHOLDERS)) {
        if (!result.includes(placeholder)) {
          throw new Error(`index.html is missing brand placeholder: ${placeholder}`);
        }
        result = result.replaceAll(placeholder, value);
      }

      for (const placeholder of Object.keys(BRAND_HTML_PLACEHOLDERS)) {
        if (result.includes(placeholder)) {
          throw new Error(`index.html has unresolved brand placeholder: ${placeholder}`);
        }
      }

      return result;
    },
  };
}
