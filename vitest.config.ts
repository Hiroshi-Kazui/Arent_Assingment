import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    // Fixed: e2eディレクトリのPlaywrightテストをvitestが拾わないよう除外
    exclude: ['node_modules', 'e2e/**'],
    pool: 'forks',
    fileParallelism: false,
  },
});
