const MAX_SLOTS = 10;
const slotList = document.getElementById('slotList');
const addBtn = document.getElementById('addSlot');
const enableToggle = document.getElementById('enableToggle');

let slots = [];
let enabled = true;
let recordingSlotId = null;

const isMac = navigator.platform.toUpperCase().includes('MAC');

const DEFAULT_SLOT = {
  id: 1,
  value: '',
  keybinding: isMac
    ? {
        ctrlKey: false,
        shiftKey: true,
        altKey: false,
        metaKey: true,
        code: 'Digit1',
        display: 'Cmd+Shift+1',
      }
    : {
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
        code: 'Digit1',
        display: 'Ctrl+Shift+1',
      },
};

function codeToLabel(code) {
  if (code.startsWith('Digit')) return code.replace('Digit', '');
  if (code.startsWith('Key')) return code.replace('Key', '');
  const map = {
    Backquote: '`',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
    Space: 'Space',
    Enter: 'Enter',
    Backspace: 'Backspace',
    Tab: 'Tab',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Delete: 'Delete',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    Escape: 'Esc',
  };
  return map[code] || code;
}

function keybindingToString(kb) {
  if (!kb) return 'Not set';
  const parts = [];
  if (kb.ctrlKey) parts.push('Ctrl');
  if (kb.altKey) parts.push('Alt');
  if (kb.shiftKey) parts.push('Shift');
  if (kb.metaKey) parts.push('Cmd');
  parts.push(codeToLabel(kb.code));
  return parts.join('+');
}

function isDuplicateKeybinding(kb, excludeSlotId) {
  return slots.some((s) => {
    if (s.id === excludeSlotId || !s.keybinding) return false;
    const sMainMod = s.keybinding.ctrlKey || s.keybinding.metaKey;
    const kbMainMod = kb.ctrlKey || kb.metaKey;
    return (
      sMainMod === kbMainMod &&
      s.keybinding.altKey === kb.altKey &&
      s.keybinding.shiftKey === kb.shiftKey &&
      s.keybinding.code === kb.code
    );
  });
}

function saveSlots() {
  chrome.storage.session.set({ slots, enabled });
}

function getNextId() {
  return slots.length === 0 ? 1 : Math.max(...slots.map((s) => s.id)) + 1;
}

function renderSlots() {
  slotList.innerHTML = '';
  slots.forEach((slot, index) => {
    const el = document.createElement('div');
    el.className = 'slot';

    const isRecording = recordingSlotId === slot.id;
    const kbDisplay = slot.keybinding ? keybindingToString(slot.keybinding) : 'Not set';

    el.innerHTML = `
      <div class="slot-row">
        <span class="slot-number">#${index + 1}</span>
        <input type="text" data-id="${slot.id}" placeholder="Enter value to copy..." value="${escapeHtml(slot.value)}">
      </div>
      <div class="slot-row">
        <span class="keybinding-display ${isRecording ? 'recording' : ''}" data-id="${slot.id}">
          ${isRecording ? 'Press keys...' : kbDisplay}
        </span>
        <button class="btn btn-record ${isRecording ? 'recording' : ''}" data-action="record" data-id="${slot.id}">
          ${isRecording ? 'Cancel' : 'Record'}
        </button>
        <button class="btn btn-clear" data-action="clear" data-id="${slot.id}">Clear</button>
        <button class="btn btn-delete" data-action="delete" data-id="${slot.id}" ${slots.length === 1 ? 'disabled' : ''}>Delete</button>
      </div>
      <div class="error-msg" data-error="${slot.id}"></div>
    `;
    slotList.appendChild(el);
  });
  addBtn.disabled = slots.length >= MAX_SLOTS;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showError(slotId, msg) {
  const el = document.querySelector(`[data-error="${slotId}"]`);
  if (el) {
    el.textContent = msg;
    setTimeout(() => {
      el.textContent = '';
    }, 3000);
  }
}

// Event delegation
slotList.addEventListener('input', (e) => {
  if (e.target.matches('input[type="text"]')) {
    const id = Number(e.target.dataset.id);
    const slot = slots.find((s) => s.id === id);
    if (slot) {
      slot.value = e.target.value;
      saveSlots();
    }
  }
});

slotList.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  const action = btn.dataset.action;
  const id = Number(btn.dataset.id);

  if (action === 'record') {
    if (recordingSlotId === id) {
      recordingSlotId = null;
    } else {
      recordingSlotId = id;
    }
    renderSlots();
  } else if (action === 'clear') {
    const slot = slots.find((s) => s.id === id);
    if (slot) {
      slot.value = '';
      slot.keybinding = null;
      saveSlots();
      renderSlots();
    }
  } else if (action === 'delete') {
    if (slots.length > 1) {
      slots = slots.filter((s) => s.id !== id);
      saveSlots();
      renderSlots();
    }
  }
});

// Keybinding recording
document.addEventListener('keydown', (e) => {
  if (recordingSlotId === null) return;

  e.preventDefault();
  e.stopPropagation();

  // Ignore lone modifier keys
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

  if (!e.ctrlKey && !e.altKey && !e.metaKey) {
    showError(recordingSlotId, 'Shortcut must include Ctrl, Alt, or Cmd');
    return;
  }

  const kb = {
    ctrlKey: e.ctrlKey,
    shiftKey: e.shiftKey,
    altKey: e.altKey,
    metaKey: e.metaKey,
    code: e.code,
    display: '',
  };
  kb.display = keybindingToString(kb);

  if (isDuplicateKeybinding(kb, recordingSlotId)) {
    showError(recordingSlotId, `"${kb.display}" is already in use`);
    return;
  }

  const slot = slots.find((s) => s.id === recordingSlotId);
  if (slot) {
    slot.keybinding = kb;
    saveSlots();
  }
  recordingSlotId = null;
  renderSlots();
});

addBtn.addEventListener('click', () => {
  if (slots.length >= MAX_SLOTS) return;
  slots.push({ id: getNextId(), value: '', keybinding: null });
  saveSlots();
  renderSlots();
});

enableToggle.addEventListener('change', () => {
  enabled = enableToggle.checked;
  saveSlots();
  chrome.runtime.sendMessage({ type: 'toggleEnabled', enabled });
});

// Init
chrome.storage.session.get(['slots', 'enabled'], (result) => {
  if (result.slots && result.slots.length > 0) {
    slots = result.slots;
  } else {
    slots = [{ ...DEFAULT_SLOT }];
    saveSlots();
  }
  if (result.enabled !== undefined) {
    enabled = result.enabled;
  }
  enableToggle.checked = enabled;
  renderSlots();
});
