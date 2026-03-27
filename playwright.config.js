/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: '.',
  testMatch: ['**/*.{spec,test}.js'],
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['line']] : [['list']],
  use: {
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
    screenshot: process.env.CI ? 'only-on-failure' : 'off',
    video: process.env.CI ? 'retain-on-failure' : 'off',
  },
};

module.exports = config;
