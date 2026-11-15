import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createFileStore } from './server/fileStore';
import { createApiHandler } from './server/handler';

function apiMiddlewarePlugin(): Plugin {
  const mount = (middlewares: {
    use: (
      fn: (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void,
    ) => void;
  }) => {
    const dataDir = path.resolve(process.env.DATA_DIR ?? 'data');
    const handleApi = createApiHandler(createFileStore(dataDir));
    middlewares.use((req, res, next) => {
      void handleApi(req, res)
        .then((handled) => {
          if (!handled) next();
        })
        .catch(next);
    });
  };
  return {
    name: 'timeline-calendar-api',
    configureServer(server) {
      mount(server.middlewares);
    },
    configurePreviewServer(server) {
      mount(server.middlewares);
    },
  };
}

export default defineConfig({
  plugins: [react(), ...(process.env.VITEST ? [] : [apiMiddlewarePlugin()])],
  server: { host: true },
  preview: { host: true },
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts'],
  },
});
