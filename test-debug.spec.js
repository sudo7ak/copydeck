const { test, chromium } = require('@playwright/test');
const path = require('path');

const extensionPath = path.resolve(__dirname);

test('full debug diagnostic', async () => {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });

  const sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  const extId = sw.url().split('/')[2];
  await new Promise((r) => setTimeout(r, 1500));

  // Step 1: Check background storage
  const bgStorage = await sw.evaluate(async () => {
    return new Promise((r) => chrome.storage.session.get(null, r));
  });
  console.log('\n=== STEP 1: Background storage ===');
  console.log(JSON.stringify(bgStorage, null, 2));

  // Step 2: Set value via popup
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extId}/popup/popup.html`);
  await popup.waitForLoadState('domcontentloaded');
  await popup.fill('input[type="text"]', 'debug-test-value');
  await popup.waitForTimeout(500);

  const popupStorage = await sw.evaluate(async () => {
    return new Promise((r) => chrome.storage.session.get(null, r));
  });
  console.log('\n=== STEP 2: Storage after popup edit ===');
  console.log(JSON.stringify(popupStorage, null, 2));
  await popup.close();

  // Step 3: Open test page and check content script state
  const page = await context.newPage();
  await page.goto('https://example.com');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  // Inject a script that checks if content script globals are accessible
  // Content script runs in isolated world - we need to use chrome.runtime to probe it

  // Check if content script responded to getState
  const swLogs = await sw.evaluate(async () => {
    // Try sending a message to the active tab to see if content script responds
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) {
          resolve({ error: 'no active tab' });
          return;
        }
        chrome.tabs.sendMessage(tabs[0].id, { type: 'ping' }, (response) => {
          resolve({ tabId: tabs[0].id, response, error: chrome.runtime.lastError?.message });
        });
      });
    });
  });
  console.log('\n=== STEP 3: Content script reachable? ===');
  console.log(JSON.stringify(swLogs, null, 2));

  // Step 4: Check what happens on keypress by evaluating in page context
  console.log('\n=== STEP 4: Simulating keypress ===');

  // Add page-level keydown listener to see events
  await page.evaluate(() => {
    window._debugEvents = [];
    document.addEventListener('keydown', (e) => {
      window._debugEvents.push({
        key: e.key,
        code: e.code,
        ctrl: e.ctrlKey,
        meta: e.metaKey,
        shift: e.shiftKey,
        prevented: e.defaultPrevented,
      });
    }); // deliberately NOT capturing phase - to see if content script prevented it
  });

  await page.click('body');

  // Try both Ctrl and Meta
  console.log('Pressing Ctrl+Shift+Digit1...');
  await page.keyboard.down('Control');
  await page.keyboard.down('Shift');
  await page.keyboard.press('Digit1');
  await page.keyboard.up('Shift');
  await page.keyboard.up('Control');
  await page.waitForTimeout(500);

  let events = await page.evaluate(() => window._debugEvents);
  console.log('Events (Ctrl):', JSON.stringify(events, null, 2));

  // Check clipboard
  let clip = await page.evaluate(async () => {
    try {
      return await navigator.clipboard.readText();
    } catch (e) {
      return 'ERR:' + e.message;
    }
  });
  console.log('Clipboard after Ctrl+Shift+1:', clip);

  // Reset and try Meta
  await page.evaluate(() => {
    window._debugEvents = [];
  });
  await page.evaluate(() => navigator.clipboard.writeText('empty'));

  console.log('\nPressing Meta+Shift+Digit1...');
  await page.keyboard.down('Meta');
  await page.keyboard.down('Shift');
  await page.keyboard.press('Digit1');
  await page.keyboard.up('Shift');
  await page.keyboard.up('Meta');
  await page.waitForTimeout(500);

  events = await page.evaluate(() => window._debugEvents);
  console.log('Events (Meta):', JSON.stringify(events, null, 2));

  clip = await page.evaluate(async () => {
    try {
      return await navigator.clipboard.readText();
    } catch (e) {
      return 'ERR:' + e.message;
    }
  });
  console.log('Clipboard after Meta+Shift+1:', clip);

  // Step 5: Check if ANY divs were added (toast)
  const allDivs = await page.evaluate(() => {
    return [...document.querySelectorAll('div')].map((d) => ({
      text: d.textContent.substring(0, 50),
      zIndex: d.style.zIndex,
    }));
  });
  console.log('\n=== STEP 5: Page divs (looking for toast) ===');
  console.log(JSON.stringify(allDivs, null, 2));

  // Step 6: Directly test content script by executing in its world
  // Use devtools protocol to evaluate in content script world
  const cdpSession = await page.context().newCDPSession(page);

  // List all execution contexts
  const { result } = await cdpSession.send('Runtime.evaluate', {
    expression: `
      (async () => {
        try {
          const response = await chrome.runtime.sendMessage({ type: 'getState' });
          return JSON.stringify(response);
        } catch(e) {
          return 'ERROR: ' + e.message;
        }
      })()
    `,
    awaitPromise: true,
    // This runs in page context, not content script context
  });
  console.log('\n=== STEP 6: chrome.runtime.sendMessage from page context ===');
  console.log(result.value || result.description);

  await page.close();
  await context.close();
});
