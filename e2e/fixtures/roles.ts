import { test as base, Page } from '@playwright/test';

/**
 * 静态扫描 E2E 测试 fixtures
 * 
 * 提供五角色登录和通用操作。
 */

// 角色账户配置（从环境变量或默认测试账户）
const ROLE_ACCOUNTS = {
  operator: {
    username: process.env.TEST_OPERATOR_USER || 'test_operator',
    password: process.env.TEST_OPERATOR_PASS || 'test123',
    name: '测试',
  },
  developer: {
    username: process.env.TEST_DEVELOPER_USER || 'test_developer',
    password: process.env.TEST_DEVELOPER_PASS || 'test123',
    name: '开发',
  },
  architect: {
    username: process.env.TEST_ARCHITECT_USER || 'test_architect',
    password: process.env.TEST_ARCHITECT_PASS || 'test123',
    name: '项目组架构师',
  },
  auditor: {
    username: process.env.TEST_AUDITOR_USER || 'test_auditor',
    password: process.env.TEST_AUDITOR_PASS || 'test123',
    name: '领域架构师',
  },
  director: {
    username: process.env.TEST_DIRECTOR_USER || 'test_director',
    password: process.env.TEST_DIRECTOR_PASS || 'test123',
    name: '总监',
  },
};

type RoleFixtures = {
  operatorPage: Page;
  developerPage: Page;
  architectPage: Page;
  auditorPage: Page;
  directorPage: Page;
  loginAs: (page: Page, role: keyof typeof ROLE_ACCOUNTS) => Promise<void>;
};

export const test = base.extend<RoleFixtures>({
  loginAs: async ({}, use) => {
    const loginFn = async (page: Page, role: keyof typeof ROLE_ACCOUNTS) => {
      const account = ROLE_ACCOUNTS[role];
      await page.goto('/login');
      await page.fill('input[name="username"]', account.username);
      await page.fill('input[name="password"]', account.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard**', { timeout: 10000 });
    };
    await use(loginFn);
  },

  operatorPage: async ({ browser, loginAs }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(page, 'operator');
    await use(page);
    await context.close();
  },

  developerPage: async ({ browser, loginAs }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(page, 'developer');
    await use(page);
    await context.close();
  },

  architectPage: async ({ browser, loginAs }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(page, 'architect');
    await use(page);
    await context.close();
  },

  auditorPage: async ({ browser, loginAs }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(page, 'auditor');
    await use(page);
    await context.close();
  },

  directorPage: async ({ browser, loginAs }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(page, 'director');
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
export { ROLE_ACCOUNTS };
