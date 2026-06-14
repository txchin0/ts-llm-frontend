import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// The ts-llm agent server has no CORS, so in dev we proxy `/v1` to it,
// keeping the browser on a single origin. Override the target with
// VITE_TS_LLM_TARGET (e.g. http://192.168.1.10:3000).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_TS_LLM_TARGET ?? 'http://127.0.0.1:3000';

  return {
    plugins: [react()],
    server: {
      // Expose on the LAN so phones/tablets can reach the dev server.
      host: true,
      allowedHosts: ['desktop-main.chimera-lydian.ts.net', '.ts.net'],
      proxy: {
        '/v1': {
          target,
          changeOrigin: true,
          // SSE needs an un-buffered, long-lived connection.
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('accept-encoding', 'identity');
            });
          },
        },
      },
    },
    preview: {
      host: true,
      allowedHosts: ['desktop-main.chimera-lydian.ts.net', '.ts.net'],
    },
  };
});
