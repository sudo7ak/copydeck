// Optional content script: only injected into sites the user has granted via optional host permissions.
// Uses the same logic as content.js.

// NOTE: This file is intentionally kept in sync with content.js.

let slots = [];
let enabled = true;

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  }
  return fallbackCopy(text);
}

function fallbackCopy(text) {
  return new Promise((resolve) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    resolve();
  });
}

function matchesKeybinding(e, kb) {
  if (!kb) return false;

  // Treat Ctrl and Cmd as equivalent “main modifier”.
  // If the saved shortcut requires Ctrl or Cmd, accept either as long as one is pressed.
  const eMainModPressed = e.ctrlKey || e.metaKey;
  const kbMainModRequired = kb.ctrlKey || kb.metaKey;

  return (
    (!kbMainModRequired || eMainModPressed) &&
    e.shiftKey === kb.shiftKey &&
    e.altKey === kb.altKey &&
    e.code === kb.code
  );
}

function showToast(value) {
  const toast = document.createElement('div');
  const preview = value.length > 40 ? value.substring(0, 40) + '...' : value;
  toast.textContent = `\u2713 Copied: ${preview}`;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    background: 'rgba(30, 30, 30, 0.9)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    color: '#fff',
    padding: '10px 18px',
    borderRadius: '10px',
    fontSize: '13px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    zIndex: '2147483647',
    opacity: '0',
    transition: 'opacity 0.25s ease',
    pointerEvents: 'none',
    maxWidth: '320px',
    wordBreak: 'break-word',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
    letterSpacing: '-0.1px',
  });
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
  });
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 2000);
}

document.addEventListener(
  'keydown',
  (e) => {
    if (!enabled) return;

    for (const slot of slots) {
      if (matchesKeybinding(e, slot.keybinding) && slot.value) {
        e.preventDefault();
        e.stopPropagation();
        copyToClipboard(slot.value).then(() => {
          showToast(slot.value);
          chrome.runtime.sendMessage({ type: 'copied' });
        });
        return;
      }
    }
  },
  true,
);

function requestState(attempt = 0) {
  chrome.runtime.sendMessage({ type: 'getState' }, (response) => {
    if (response && (response.slots || response.enabled !== undefined)) {
      slots = response.slots || [];
      enabled = response.enabled !== false;
      return;
    }

    if (attempt < 5) {
      const delayMs = 200 * Math.pow(2, attempt);
      setTimeout(() => requestState(attempt + 1), delayMs);
    }
  });
}

requestState();

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'stateUpdated') {
    slots = msg.slots || [];
    enabled = msg.enabled !== false;
  }
});
