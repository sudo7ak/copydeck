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
  const eMainMod = e.ctrlKey || e.metaKey;
  const kbMainMod = kb.ctrlKey || kb.metaKey;
  return (
    eMainMod === kbMainMod &&
    e.shiftKey === kb.shiftKey &&
    e.altKey === kb.altKey &&
    e.code === kb.code
  );
}

function showToast(value) {
  const toast = document.createElement('div');
  const preview = value.length > 40 ? value.substring(0, 40) + '...' : value;
  toast.textContent = `Copied: ${preview}`;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    background: '#333',
    color: '#fff',
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '13px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    zIndex: '2147483647',
    opacity: '0',
    transition: 'opacity 0.2s',
    pointerEvents: 'none',
    maxWidth: '300px',
    wordBreak: 'break-word',
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

// Load state from background via message passing
chrome.runtime.sendMessage({ type: 'getState' }, (response) => {
  if (response) {
    slots = response.slots || [];
    enabled = response.enabled !== false;
  }
});

// Listen for state updates pushed from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'stateUpdated') {
    slots = msg.slots || [];
    enabled = msg.enabled !== false;
  }
});
