import { defineConfig, devices } from '@playwright/test';

const localChromiumPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'npx tsx tests/e2e/api-server.ts',
      url: 'http://127.0.0.1:3410/api/v1/health/ready',
      env: { E2E_API_PORT: '3410' },
      reuseExistingServer: false,
      timeout: 300_000,
    },
    {
      command: 'npm run dev --workspace apps/web -- --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173',
      env: { VITE_API_PROXY_TARGET: 'http://127.0.0.1:3410' },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], ...(localChromiumPath ? { launchOptions: { executablePath: localChromiumPath } } : {}) } }],
});
