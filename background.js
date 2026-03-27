// Allow content scripts to access session storage
chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });

// Initialize default slot if storage is empty
const DEFAULT_SLOT = {
  id: 1,
  value: '',
  keybinding: {
    ctrlKey: false,
    shiftKey: true,
    altKey: false,
    metaKey: true,
    code: 'Digit1',
    display: 'Cmd+Shift+1',
  },
};

chrome.storage.session.get(['slots'], (result) => {
  if (!result.slots || result.slots.length === 0) {
    chrome.storage.session.set({ slots: [DEFAULT_SLOT], enabled: true });
  }
});

const ICON_NORMAL = {
  16: 'icons/icon16.png',
  48: 'icons/icon48.png',
  128: 'icons/icon128.png',
};

const ICON_DISABLED = {
  16: 'icons/icon16_disabled.png',
  48: 'icons/icon48_disabled.png',
  128: 'icons/icon128_disabled.png',
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'copied') {
    chrome.action.setBadgeText({ text: '\u2713' });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 1500);
  }

  if (msg.type === 'toggleEnabled') {
    chrome.action.setIcon({ path: msg.enabled ? ICON_NORMAL : ICON_DISABLED });
  }

  // Content script requests current state
  if (msg.type === 'getState') {
    chrome.storage.session.get(['slots', 'enabled'], (result) => {
      sendResponse({ slots: result.slots || [], enabled: result.enabled !== false });
    });
    return true; // keep channel open for async sendResponse
  }
});

// When storage changes (from popup edits), push updates to all content scripts
chrome.storage.session.onChanged.addListener((_changes) => {
  chrome.storage.session.get(['slots', 'enabled'], (result) => {
    // Send to all tabs
    chrome.tabs.query({}, (tabs) => {
      const msg = {
        type: 'stateUpdated',
        slots: result.slots || [],
        enabled: result.enabled !== false,
      };
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
      }
    });
  });
});

// Restore icon state on startup
chrome.storage.session.get(['enabled'], (result) => {
  const isEnabled = result.enabled !== false;
  chrome.action.setIcon({ path: isEnabled ? ICON_NORMAL : ICON_DISABLED });
});
