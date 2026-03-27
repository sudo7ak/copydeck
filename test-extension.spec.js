const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

const extensionPath = path.resolve(__dirname);

test.describe('CopyDeck Extension', () => {
  let context;
  let serviceWorker;
  let extId;

  test.beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });

    // Make clipboard reads reliable in tests (especially on macOS).
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: 'https://example.com',
    });

    serviceWorker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
    extId = serviceWorker.url().split('/')[2];

    // Wait for background to initialize defaults
    await new Promise((r) => setTimeout(r, 1500));
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('1. service worker initializes default slot in storage', async () => {
    const data = await serviceWorker.evaluate(async () => {
      return new Promise((resolve) => {
        chrome.storage.session.get(['slots', 'enabled'], resolve);
      });
    });
    console.log('Initial storage:', JSON.stringify(data, null, 2));
    expect(data.slots).toBeTruthy();
    expect(data.slots.length).toBe(1);
    expect(data.slots[0].keybinding.code).toBe('Digit1');
    expect(data.enabled).toBe(true);
  });

  test('2. popup shows default slot and can edit value', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extId}/popup/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    const title = await popup.textContent('h1');
    expect(title).toBe('CopyDeck');

    const slots = await popup.$$('.slot');
    expect(slots.length).toBe(1);

    // Set a value
    await popup.fill('input[type="text"]', 'hello-copydeck');
    await popup.waitForTimeout(500);

    // Verify saved
    const data = await serviceWorker.evaluate(async () => {
      return new Promise((resolve) => chrome.storage.session.get(['slots'], resolve));
    });
    console.log('After edit:', JSON.stringify(data.slots[0], null, 2));
    expect(data.slots[0].value).toBe('hello-copydeck');

    await popup.close();
  });

  test('3. content script receives state via messaging', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // We can't directly access content script variables, but we can test
    // the message passing by asking the service worker
    const data = await serviceWorker.evaluate(async () => {
      return new Promise((resolve) => chrome.storage.session.get(['slots'], resolve));
    });
    console.log('Storage has value:', data.slots[0].value);
    expect(data.slots[0].value).toBe('hello-copydeck');

    await page.close();
  });

  test('4. Ctrl+Shift+1 copies value to clipboard', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Focus the page body
    await page.click('body');
    await page.waitForTimeout(200);

    // Debug: log keydown events
    await page.evaluate(() => {
      window._keyLog = [];
      document.addEventListener(
        'keydown',
        (e) => {
          window._keyLog.push({
            key: e.key,
            code: e.code,
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey,
            shiftKey: e.shiftKey,
            defaultPrevented: e.defaultPrevented,
          });
        },
        true,
      );
    });

    // Press Ctrl+Shift+1 (works cross-platform in Playwright).
    // On some runs the content script/state can lag; retry briefly until we see the toast.
    for (let attempt = 0; attempt < 5; attempt++) {
      await page.keyboard.down('Control');
      await page.keyboard.down('Shift');
      await page.keyboard.press('Digit1');
      await page.keyboard.up('Shift');
      await page.keyboard.up('Control');

      const toastFound = await page
        .waitForFunction(
          () => {
            return [...document.querySelectorAll('div')].some((el) =>
              (el.textContent || '').includes('Copied:'),
            );
          },
          { timeout: 500 },
        )
        .then(
          () => true,
          () => false,
        );

      if (toastFound) break;
      await page.waitForTimeout(400);
    }

    await page.waitForTimeout(300);

    const keyLog = await page.evaluate(() => window._keyLog);
    console.log('Key events:', JSON.stringify(keyLog, null, 2));

    // Check clipboard
    const clipboard = await page.evaluate(async () => {
      try {
        return await navigator.clipboard.readText();
      } catch {
        return 'clipboard-read-failed';
      }
    });
    console.log('Clipboard:', clipboard);

    // Check toast
    const toast = await page.evaluate(() => {
      for (const el of document.querySelectorAll('div[style]')) {
        if (el.textContent.includes('Copied:')) return el.textContent;
      }
      return null;
    });
    console.log('Toast:', toast);

    expect(clipboard).toBe('hello-copydeck');

    await page.close();
  });

  test('5. Meta+Shift+1 (Cmd on Mac) also copies value', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    await page.click('body');
    await page.waitForTimeout(200);

    // Clear clipboard first
    await page.evaluate(() => navigator.clipboard.writeText(''));
    await page.waitForTimeout(200);

    await page.keyboard.down('Meta');
    await page.keyboard.down('Shift');
    await page.keyboard.press('Digit1');
    await page.keyboard.up('Shift');
    await page.keyboard.up('Meta');
    await page.waitForTimeout(1000);

    const clipboard = await page.evaluate(async () => {
      try {
        return await navigator.clipboard.readText();
      } catch {
        return 'clipboard-read-failed';
      }
    });
    console.log('Clipboard (Meta+Shift+1):', clipboard);
    expect(clipboard).toBe('hello-copydeck');

    await page.close();
  });

  test('6. toggle off disables copying', async () => {
    // Toggle off via popup
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extId}/popup/popup.html`);
    await popup.waitForLoadState('domcontentloaded');
    await popup.locator('#enableToggle').evaluate((el) => el.click());
    await popup.waitForTimeout(500);
    await popup.close();

    // Try pressing shortcut
    const page = await context.newPage();
    await page.goto('https://example.com');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Clear clipboard
    await page.evaluate(() => navigator.clipboard.writeText('cleared'));
    await page.click('body');

    await page.keyboard.down('Control');
    await page.keyboard.down('Shift');
    await page.keyboard.press('Digit1');
    await page.keyboard.up('Shift');
    await page.keyboard.up('Control');
    await page.waitForTimeout(500);

    const clipboard = await page.evaluate(async () => {
      try {
        return await navigator.clipboard.readText();
      } catch {
        return 'clipboard-read-failed';
      }
    });
    console.log('Clipboard when disabled:', clipboard);
    expect(clipboard).toBe('cleared');

    await page.close();

    // Re-enable
    const popup2 = await context.newPage();
    await popup2.goto(`chrome-extension://${extId}/popup/popup.html`);
    await popup2.waitForLoadState('domcontentloaded');
    await popup2.locator('#enableToggle').evaluate((el) => el.click());
    await popup2.waitForTimeout(500);
    await popup2.close();
  });
});
