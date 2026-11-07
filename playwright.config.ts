import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'NEXT_DIST_DIR=.next-prod pnpm start --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100/tr',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
