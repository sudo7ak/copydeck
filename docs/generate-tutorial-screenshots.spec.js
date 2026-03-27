const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const extensionPath = path.resolve(__dirname, '..');
const outDir = path.resolve(__dirname, 'assets', 'tutorial');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function waitForExtensionReady(serviceWorker) {
  // Background initializes defaults on startup. Give it a moment.
  await serviceWorker.evaluate(() => {
    return new Promise((resolve) => setTimeout(resolve, 500));
  });
}

test.describe('Generate tutorial screenshots (CopyDeck)', () => {
  test('generate screenshots', async () => {
    ensureDir(outDir);

    const context = await chromium.launchPersistentContext('', {
      headless: true,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
      viewport: { width: 1280, height: 800 },
    });

    const serviceWorker =
      context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
    const extId = serviceWorker.url().split('/')[2];
    await waitForExtensionReady(serviceWorker);

    // Start from a clean slate for deterministic screenshots.
    await serviceWorker.evaluate(() => {
      return new Promise((resolve) => chrome.storage.session.clear(resolve));
    });

    // Re-initialize defaults (background will do this on startup; we mimic by setting enabled + one slot).
    await serviceWorker.evaluate(() => {
      return new Promise((resolve) => {
        chrome.storage.session.set(
          {
            enabled: true,
            slots: [
              {
                id: 1,
                value: 'hello-copydeck',
                keybinding: {
                  ctrlKey: false,
                  shiftKey: true,
                  altKey: false,
                  metaKey: true,
                  code: 'Digit1',
                  display: 'Cmd+Shift+1',
                },
              },
            ],
          },
          resolve,
        );
      });
    });

    // 1) Open popup
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extId}/popup/popup.html`);
    await popup.waitForLoadState('domcontentloaded');
    await popup.waitForTimeout(300);

    // Ensure slot visible
    await expect(popup.locator('h1')).toHaveText('CopyDeck');
    await expect(popup.locator('.slot')).toHaveCount(1);

    await popup.screenshot({ path: path.join(outDir, '01-popup.png') });

    // 2) Record UI state (click Record)
    await popup.locator('button[data-action="record"]').click();
    await popup.waitForTimeout(250);
    await popup.screenshot({ path: path.join(outDir, '02-recording.png') });

    // Cancel recording to restore normal state
    await popup.locator('button[data-action="record"]').click();
    await popup.waitForTimeout(150);

    // 3) Filled slot (value already set in storage above); still take a crisp shot.
    await popup.screenshot({ path: path.join(outDir, '03-filled-slot.png') });

    await popup.close();

    // 4) Toast on a page
    const page = await context.newPage();
    await page.goto('https://example.com');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1200);
    await page.click('body');

    // Trigger shortcut (works in Playwright cross-platform; on macOS this is Control, not Cmd in tests).
    await page.keyboard.down('Control');
    await page.keyboard.down('Shift');
    await page.keyboard.press('Digit1');
    await page.keyboard.up('Shift');
    await page.keyboard.up('Control');

    // Wait for toast to appear (content script injects a div with 'Copied:')
    await page.waitForFunction(() => {
      return [...document.querySelectorAll('div')].some((d) =>
        (d.textContent || '').includes('Copied:'),
      );
    });

    // Slight delay so animation finishes
    await page.waitForTimeout(250);

    // Crop around bottom-right where toast appears for a focused image.
    const viewportSize = page.viewportSize();
    const clip = {
      x: Math.max(0, viewportSize.width - 520),
      y: Math.max(0, viewportSize.height - 260),
      width: 520,
      height: 260,
    };
    await page.screenshot({ path: path.join(outDir, '04-toast.png'), clip });

    // 5) Disabled state: toggle off in popup and show that toast doesn't appear
    const popup2 = await context.newPage();
    await popup2.goto(`chrome-extension://${extId}/popup/popup.html`);
    await popup2.waitForLoadState('domcontentloaded');
    await popup2.waitForTimeout(250);

    await popup2.locator('#enableToggle').evaluate((el) => el.click());
    await popup2.waitForTimeout(250);
    await popup2.screenshot({ path: path.join(outDir, '05-disabled-toggle.png') });
    await popup2.close();

    // Attempt shortcut again; confirm no NEW toast appears.
    const toastCountBefore = await page.evaluate(() => {
      return [...document.querySelectorAll('div')].filter((d) =>
        (d.textContent || '').includes('Copied:'),
      ).length;
    });

    await page.keyboard.down('Control');
    await page.keyboard.down('Shift');
    await page.keyboard.press('Digit1');
    await page.keyboard.up('Shift');
    await page.keyboard.up('Control');

    // Wait briefly for a potential (incorrect) toast; expect the count not to increase.
    const toastCountAfter = await page
      .waitForFunction(
        (before) => {
          const now = [...document.querySelectorAll('div')].filter((d) =>
            (d.textContent || '').includes('Copied:'),
          ).length;
          return now > before ? now : false;
        },
        toastCountBefore,
        { timeout: 800 },
      )
      .then(
        () => null,
        () =>
          page.evaluate(() => {
            return [...document.querySelectorAll('div')].filter((d) =>
              (d.textContent || '').includes('Copied:'),
            ).length;
          }),
      );

    expect(toastCountAfter).toBe(toastCountBefore);
    await page.screenshot({ path: path.join(outDir, '06-disabled-no-toast.png') });

    await page.close();
    await context.close();
  });
});
