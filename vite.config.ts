import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// The Vite client is stubbed on purpose because the AI Studio proxy blocks the dev WebSocket.
// This prevents "[vite] failed to connect to websocket" console errors and MUST NOT be removed.
const noViteClient = () => ({
  name: 'no-vite-client',
  apply: 'serve' as const,
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      if (req.url && req.url.split('?')[0] === '/@vite/client') {
        res.setHeader('Content-Type', 'application/javascript');
        res.end(`
          const noop = () => {};
          export function createHotContext() {
            return { accept: noop, acceptExports: noop, dispose: noop, prune: noop, invalidate: noop, decline: noop, on: noop, off: noop, send: noop, data: {} };
          }
          const styles = new Map();
          export function updateStyle(id, css) {
            let el = styles.get(id);
            if (!el) {
              el = document.createElement('style');
              el.setAttribute('data-vite-dev-id', id);
              document.head.appendChild(el);
              styles.set(id, el);
            }
            el.textContent = css;
          }
          export function removeStyle(id) {
            const el = styles.get(id);
            if (el) { el.remove(); styles.delete(id); }
          }
          export function injectQuery(url) { return url; }
        `);
        return;
      }
      next();
    });
  },
});

export default defineConfig(() => {
  return {
    plugins: [noViteClient(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname || '.', '.'),
      },
    },
    server: {
      host: true,
      allowedHosts: true as const,
      // HMR is disabled on purpose because of the AI Studio proxy environment
      hmr: false,
    },
  };
});
