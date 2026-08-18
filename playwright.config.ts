import { defineConfig, devices } from '@playwright/test';

/**
 * 静态扫描 E2E 测试配置
 * 
 * 运行前需要:
 * 1. pnpm add -D @playwright/test
 * 2. npx playwright install chromium
 * 3. 启动后端: cargo run (axum_admin)
 * 4. 启动前端: pnpm dev
 * 
 * 运行: npx playwright test
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
