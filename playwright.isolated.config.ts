import { defineConfig, devices } from '@playwright/test'
import { randomBytes, randomUUID } from 'node:crypto'

// DB-writing e2e: runs against a temp COPY of the SQLite DB on port 3400 (scripts/e2e-isolated-server.sh).
// Never point this at the live dev server on 3100.
if (process.env.E2E_ISOLATED_PORT !== undefined && process.env.E2E_ISOLATED_PORT !== '3400') {
  throw new Error('Isolated E2E only permits port 3400.')
}
const port = 3400
// Inherited by the webServer and workers; no shared password and no credentials on disk.
process.env.E2E_ADMIN_EMAIL ||= `e2e-${randomUUID()}@example.test`
process.env.E2E_ADMIN_PASSWORD ||= randomBytes(32).toString('hex')
export default defineConfig({
  testDir: './tests/e2e/isolated',
  timeout: 90_000,
  workers: 1,
  // API traces contain the login request body/password, so never retain them.
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'bash scripts/e2e-isolated-server.sh',
    url: `http://127.0.0.1:${port}/tr`,
    reuseExistingServer: false,
    // The default force-kill bypasses the shell's EXIT trap and can orphan its child process group.
    gracefulShutdown: { signal: 'SIGTERM', timeout: 15_000 },
    timeout: 180_000,
  },
})
