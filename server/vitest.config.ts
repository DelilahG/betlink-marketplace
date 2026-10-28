import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['tests/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 120000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://betlink_test:betlink_test@localhost:54329/betlink_test',
      UPLOAD_DIR: path.join(os.tmpdir(), 'betlink-test-uploads'),
    },
  },
});
