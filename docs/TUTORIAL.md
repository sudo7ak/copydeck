# Building CopyDeck: A Chrome Extension for Clipboard Shortcuts

A step-by-step tutorial for building a Chrome extension that lets you bind keyboard shortcuts to text values for instant clipboard copying.

## What We're Building

CopyDeck is a Chrome extension where you:

- Define up to 10 text values (emails, IDs, code snippets, etc.)
- Bind each to a custom keyboard shortcut (e.g., Cmd+Shift+1)
- Press the shortcut on any webpage to copy the value to your clipboard
- Toggle the extension on/off, with visual feedback via toast notifications and badge icons

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Chrome Browser                           │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │  Popup UI    │    │  Background  │    │  Content Script  │   │
│  │ (popup.html) │    │  (Service    │    │  (content.js)    │   │
│  │              │    │   Worker)    │    │                  │   │
│  │ - Edit slots │    │              │    │ - Listens for    │   │
│  │ - Record     │◄──►│ - Storage    │◄──►│   keydown events │   │
│  │   keybindings│    │   init       │    │ - Copies to      │   │
│  │ - Toggle     │    │ - Message    │    │   clipboard      │   │
│  │   on/off     │    │   routing    │    │ - Shows toast    │   │
│  │              │    │ - Badge/icon │    │                  │   │
│  └──────────────┘    └──────────────┘    └──────────────────┘   │
│         │                   │                     │             │
│         └───────────────────┼─────────────────────┘             │
│                             │                                   │
│                   ┌─────────┴────────┐                          │
│                   │ chrome.storage   │                          │
│                   │    .session      │                          │
│                   │                  │                          │
│                   │ { slots, enabled }│                          │
│                   └──────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

### Three Components

| Component          | File                                        | Role                                                                    |
| ------------------ | ------------------------------------------- | ----------------------------------------------------------------------- |
| **Popup**          | `popup/popup.html`, `popup.js`, `popup.css` | UI for editing slots and recording keybindings                          |
| **Background**     | `background.js`                             | Service worker that manages storage, badges, and message routing        |
| **Content Script** | `content.js`                                | Injected into every page; listens for shortcuts and copies to clipboard |

### Data Flow

```
User edits slot in popup
        │
        ▼
popup.js saves to chrome.storage.session
        │
        ▼
background.js detects storage change
        │
        ▼
background.js pushes update to ALL content scripts via chrome.tabs.sendMessage
        │
        ▼
content.js updates its local slots array
        │
        ▼
User presses shortcut on any page
        │
        ▼
content.js matches keydown event → copies value → shows toast → notifies background
        │
        ▼
background.js flashes badge ✓
```

---

## Prerequisites

- Google Chrome browser
- A text editor (VS Code, Sublime, etc.)
- Basic knowledge of HTML, CSS, and JavaScript

---

## Step 1: Project Structure

Create the following folder structure:

```
copydeck/
├── manifest.json
├── background.js
├── content.js
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    ├── icon128.png
    ├── icon16_disabled.png
    ├── icon48_disabled.png
    └── icon128_disabled.png
```

Create the directories:

```bash
mkdir -p copydeck/popup copydeck/icons
cd copydeck
```

---

## Step 2: The Manifest (manifest.json)

The manifest is the entry point for every Chrome extension. It tells Chrome what your extension does, what permissions it needs, and where its files are.

```json
{
  "manifest_version": 3,
  "name": "CopyDeck",
  "version": "1.0.0",
  "description": "Bind keyboard shortcuts to text values for quick clipboard copying",
  "permissions": ["clipboardWrite", "storage", "activeTab"],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_start"
    }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

### Key decisions explained:

| Field                        | Why                                                           |
| ---------------------------- | ------------------------------------------------------------- |
| `manifest_version: 3`        | Required for new Chrome extensions (MV2 is deprecated)        |
| `clipboardWrite`             | Permission to write to the clipboard                          |
| `storage`                    | Permission to use `chrome.storage.session` for ephemeral data |
| `activeTab`                  | Access to the currently active tab                            |
| `"matches": ["<all_urls>"]`  | Content script runs on every webpage                          |
| `"run_at": "document_start"` | Inject early so keyboard listeners are ready                  |

---

## Step 3: The Background Service Worker (background.js)

The background script is the extension's "brain." It runs as a service worker and handles:

1. Initializing default data in storage
2. Routing messages between popup and content scripts
3. Managing the extension badge and icon state

```js
// ============================================================
// PART 1: Storage Access for Content Scripts
// ============================================================
// By default, chrome.storage.session is only accessible from
// extension pages (popup, background). Content scripts run in
// web pages and are considered "untrusted contexts."
// This line opens session storage to content scripts.
chrome.storage.session.setAccessLevel({
  accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS',
});
```

**Why this matters:** Without this line, `content.js` silently gets empty data from `chrome.storage.session.get()` — no error, just empty. This is the #1 gotcha with MV3 extensions.

```js
// ============================================================
// PART 2: Initialize Default Slot
// ============================================================
// Session storage is cleared on browser restart, so we need to
// set up the default slot every time the service worker starts.
const DEFAULT_SLOT = {
  id: 1,
  value: '',
  keybinding: {
    ctrlKey: false,
    shiftKey: true,
    altKey: false,
    metaKey: true, // Cmd on Mac
    code: 'Digit1', // Physical key "1" — unaffected by Shift
    display: 'Cmd+Shift+1',
  },
};

chrome.storage.session.get(['slots'], (result) => {
  if (!result.slots || result.slots.length === 0) {
    chrome.storage.session.set({ slots: [DEFAULT_SLOT], enabled: true });
  }
});
```

**Why `code` instead of `key`:** On Mac, pressing Cmd+Shift+1 produces `e.key = "!"` (Shift transforms the character). But `e.code = "Digit1"` always represents the physical key, regardless of modifiers. This is critical for cross-platform keybinding matching.

```
Keyboard Event Properties When Pressing Cmd+Shift+1 on Mac:

  e.key   = "!"        ← Modified by Shift (unreliable for matching)
  e.code  = "Digit1"   ← Physical key (always consistent)
  e.metaKey = true      ← Cmd is held
  e.shiftKey = true     ← Shift is held
```

```js
// ============================================================
// PART 3: Icon Paths
// ============================================================
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
```

```js
// ============================================================
// PART 4: Message Handler
// ============================================================
// This is the central message router. It handles three message types:
//
//   "copied"        → Content script tells us a value was copied
//   "toggleEnabled" → Popup tells us the user toggled on/off
//   "getState"      → Content script requests current slots + enabled state
//
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Badge flash when a value is copied
  if (msg.type === 'copied') {
    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 1500);
  }

  // Toggle icon between normal and greyed-out
  if (msg.type === 'toggleEnabled') {
    chrome.action.setIcon({
      path: msg.enabled ? ICON_NORMAL : ICON_DISABLED,
    });
  }

  // Content script requests current state on page load
  if (msg.type === 'getState') {
    chrome.storage.session.get(['slots', 'enabled'], (result) => {
      sendResponse({
        slots: result.slots || [],
        enabled: result.enabled !== false,
      });
    });
    return true; // IMPORTANT: keeps the message channel open for async sendResponse
  }
});
```

**The `return true` pattern:** Chrome closes the message channel immediately after `onMessage` returns. Since `chrome.storage.session.get()` is async, we must `return true` to tell Chrome "I'll call `sendResponse` later."

```js
// ============================================================
// PART 5: Push Updates to Content Scripts
// ============================================================
// When the popup edits a slot, storage changes. We detect that
// and push the new state to every open tab's content script.
//
//   Popup edits slot → storage changes → this listener fires
//   → sends "stateUpdated" to all tabs
//
chrome.storage.session.onChanged.addListener((changes) => {
  chrome.storage.session.get(['slots', 'enabled'], (result) => {
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
```

```js
// ============================================================
// PART 6: Restore Icon on Startup
// ============================================================
chrome.storage.session.get(['enabled'], (result) => {
  const isEnabled = result.enabled !== false;
  chrome.action.setIcon({ path: isEnabled ? ICON_NORMAL : ICON_DISABLED });
});
```

### Message Flow Diagram

```
┌──────────┐        ┌─────────────┐        ┌────────────────┐
│  Popup   │        │  Background │        │ Content Script │
│          │        │  (Service   │        │ (on each tab)  │
│          │        │   Worker)   │        │                │
└────┬─────┘        └──────┬──────┘        └───────┬────────┘
     │                     │                       │
     │  saves to storage   │                       │
     │────────────────────>│                       │
     │                     │                       │
     │                     │  onChanged fires      │
     │                     │──────┐                │
     │                     │      │ query all tabs │
     │                     │<─────┘                │
     │                     │                       │
     │                     │  "stateUpdated"       │
     │                     │──────────────────────>│
     │                     │                       │
     │                     │        (user presses  │
     │                     │         shortcut)     │
     │                     │                       │
     │                     │  "copied"             │
     │                     │<──────────────────────│
     │                     │                       │
     │                     │  setBadgeText("✓")    │
     │                     │──────┐                │
     │                     │<─────┘                │
     │                     │                       │
```

---

## Step 4: The Content Script (content.js)

The content script is injected into every webpage. It does three things:

1. Listens for keyboard shortcuts
2. Copies the matched value to the clipboard
3. Shows a toast notification

```js
// ============================================================
// PART 1: State
// ============================================================
let slots = [];
let enabled = true;
```

```js
// ============================================================
// PART 2: Clipboard Helpers
// ============================================================
// The modern Clipboard API (navigator.clipboard.writeText) can
// fail on certain pages due to permission policies. We fall back
// to the legacy execCommand approach when it does.

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
```

```js
// ============================================================
// PART 3: Keybinding Matching
// ============================================================
// Cross-platform: treats Ctrl (Windows/Linux) and Cmd (Mac) as
// equivalent by OR-ing ctrlKey and metaKey together.
// Uses e.code (physical key) instead of e.key (character) to
// avoid Shift modifier issues.

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
```

**Cross-platform matching logic:**

```
Windows user presses Ctrl+Shift+1:
  e.ctrlKey = true, e.metaKey = false → eMainMod = true
  Stored: ctrlKey = true, metaKey = false → kbMainMod = true
  Match: true ✓

Mac user presses Cmd+Shift+1:
  e.ctrlKey = false, e.metaKey = true → eMainMod = true
  Stored: ctrlKey = false, metaKey = true → kbMainMod = true
  Match: true ✓

Mac user presses Ctrl+Shift+1 (Ctrl key, not Cmd):
  e.ctrlKey = true, e.metaKey = false → eMainMod = true
  Stored: ctrlKey = false, metaKey = true → kbMainMod = true
  Match: true ✓  (Ctrl and Cmd are interchangeable)
```

```js
// ============================================================
// PART 4: Toast Notification
// ============================================================
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
    zIndex: '2147483647', // Maximum z-index to appear above everything
    opacity: '0',
    transition: 'opacity 0.2s',
    pointerEvents: 'none', // Don't interfere with page clicks
    maxWidth: '300px',
    wordBreak: 'break-word',
  });
  document.body.appendChild(toast);

  // Fade in
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
  });

  // Auto-dismiss after 2 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200); // Remove after fade-out
  }, 2000);
}
```

```js
// ============================================================
// PART 5: The Keydown Listener
// ============================================================
// Uses the CAPTURE phase (third arg = true) so we intercept
// the event before the page's own handlers can consume it.

document.addEventListener(
  'keydown',
  (e) => {
    if (!enabled) return;

    for (const slot of slots) {
      if (matchesKeybinding(e, slot.keybinding) && slot.value) {
        e.preventDefault(); // Stop browser default action
        e.stopPropagation(); // Stop page from seeing this event
        copyToClipboard(slot.value).then(() => {
          showToast(slot.value);
          chrome.runtime.sendMessage({ type: 'copied' });
        });
        return;
      }
    }
  },
  true,
); // true = capture phase
```

**Why capture phase?** Event propagation has two phases:

```
                    Capture Phase (top → down)
                    ┌─────────────────────┐
                    │      document       │ ← Our listener fires HERE (first!)
                    │   ┌─────────────┐   │
                    │   │    body     │   │
                    │   │  ┌───────┐  │   │
                    │   │  │  div  │  │   │
                    │   │  │       │  │   │
                    │   │  └───────┘  │   │
                    │   └─────────────┘   │
                    └─────────────────────┘
                    Bubble Phase (down → top)

By listening in the capture phase, our handler runs BEFORE
any page-level handlers, so we can preventDefault() and
stopPropagation() before the page reacts to the keypress.
```

```js
// ============================================================
// PART 6: State Loading
// ============================================================
// On page load, request current state from the background script.
chrome.runtime.sendMessage({ type: 'getState' }, (response) => {
  if (response) {
    slots = response.slots || [];
    enabled = response.enabled !== false;
  }
});

// Listen for live updates when the user edits slots in the popup.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'stateUpdated') {
    slots = msg.slots || [];
    enabled = msg.enabled !== false;
  }
});
```

---

## Step 5: The Popup UI (popup/popup.html)

The popup is what users see when they click the extension icon.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CopyDeck</title>
    <link rel="stylesheet" href="popup.css" />
  </head>
  <body>
    <div class="header">
      <h1>CopyDeck</h1>
      <label class="toggle">
        <input type="checkbox" id="enableToggle" checked />
        <span class="slider"></span>
      </label>
    </div>
    <div id="slotList"></div>
    <button id="addSlot" class="add-btn">+ Add Slot</button>
    <script src="popup.js"></script>
  </body>
</html>
```

### Popup Layout

```
┌──────────────────────────────────────┐
│  CopyDeck                    [ON/OFF]│
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │ #1  [Enter value to copy...  ] │  │
│  │     [Cmd+Shift+1] [Record][Clear]│
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ #2  [my-email@example.com    ] │  │
│  │     [Cmd+Shift+2] [Record][Clear]│
│  └────────────────────────────────┘  │
│                                      │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│    + Add Slot                        │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
└──────────────────────────────────────┘
```

---

## Step 6: Popup Styles (popup/popup.css)

The CSS creates a clean, minimal light theme. Key techniques:

```css
/* Fixed width for the popup */
body {
  width: 360px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
  color: #333;
  background: #fafafa;
  padding: 12px;
}
```

**The CSS toggle switch** uses a hidden checkbox + styled `<span>`:

```css
/* Hide the real checkbox */
.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

/* The visible slider track */
.slider {
  position: absolute;
  inset: 0;
  background: #ccc;
  border-radius: 22px;
  cursor: pointer;
  transition: background 0.2s;
}

/* The sliding circle */
.slider::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  left: 3px;
  bottom: 3px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
}

/* When checked: green track, circle slides right */
.toggle input:checked + .slider {
  background: #4caf50;
}

.toggle input:checked + .slider::before {
  transform: translateX(18px);
}
```

```
Toggle Switch States:

  OFF:  [●        ]  gray track
  ON:   [        ●]  green track
```

Full CSS file also includes styles for slots, buttons, keybinding displays, recording state, and error messages. See `popup/popup.css` for the complete source.

---

## Step 7: Popup Logic (popup/popup.js)

This is the most complex file. It handles slot management, keybinding recording, and persistence.

### 7.1: Constants and State

```js
const MAX_SLOTS = 10;
const slotList = document.getElementById('slotList');
const addBtn = document.getElementById('addSlot');
const enableToggle = document.getElementById('enableToggle');

let slots = [];
let enabled = true;
let recordingSlotId = null; // Which slot is currently recording a keybinding

// Platform detection for default keybinding
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
```

### 7.2: Display Helpers

Converting a physical key code to a human-readable label:

```js
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
    Tab: 'Tab',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Escape: 'Esc',
    // ... more keys
  };
  return map[code] || code;
}

// Builds display string like "Cmd+Shift+1"
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
```

```
Code-to-label mapping examples:

  "Digit1"     → "1"
  "KeyA"       → "A"
  "BracketLeft"→ "["
  "ArrowUp"    → "Up"
  "Semicolon"  → ";"
```

### 7.3: Uniqueness Validation

```js
function isDuplicateKeybinding(kb, excludeSlotId) {
  return slots.some((s) => {
    if (s.id === excludeSlotId || !s.keybinding) return false;
    // Treat Ctrl and Cmd as the same modifier
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
```

### 7.4: Rendering Slots

The `renderSlots()` function rebuilds the entire slot list DOM. Each slot consists of two rows:

```js
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
        <input type="text" data-id="${slot.id}"
               placeholder="Enter value to copy..."
               value="${escapeHtml(slot.value)}">
      </div>
      <div class="slot-row">
        <span class="keybinding-display ${isRecording ? 'recording' : ''}">
          ${isRecording ? 'Press keys...' : kbDisplay}
        </span>
        <button class="btn btn-record ${isRecording ? 'recording' : ''}"
                data-action="record" data-id="${slot.id}">
          ${isRecording ? 'Cancel' : 'Record'}
        </button>
        <button class="btn btn-clear"
                data-action="clear" data-id="${slot.id}">Clear</button>
      </div>
      <div class="error-msg" data-error="${slot.id}"></div>
    `;
    slotList.appendChild(el);
  });
  addBtn.disabled = slots.length >= MAX_SLOTS;
}
```

### 7.5: Event Handling (using Event Delegation)

Instead of attaching listeners to each slot, we use event delegation on the parent container:

```js
// Text input changes → save immediately
slotList.addEventListener('input', (e) => {
  if (e.target.matches('input[type="text"]')) {
    const id = Number(e.target.dataset.id);
    const slot = slots.find((s) => s.id === id);
    if (slot) {
      slot.value = e.target.value;
      saveSlots(); // Persist to chrome.storage.session
    }
  }
});

// Button clicks → record or clear
slotList.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  const action = btn.dataset.action;
  const id = Number(btn.dataset.id);

  if (action === 'record') {
    // Toggle recording mode
    recordingSlotId = recordingSlotId === id ? null : id;
    renderSlots();
  } else if (action === 'clear') {
    const slot = slots.find((s) => s.id === id);
    if (slot) {
      slot.value = '';
      slot.keybinding = null;
      saveSlots();
      renderSlots();
    }
  }
});
```

**Why event delegation?** Since slots are dynamically created and destroyed, attaching listeners to each button would require cleanup. With delegation, one listener on the parent handles all current and future slots.

```
Event Delegation:

  slotList (listener here)
    ├── slot #1
    │   ├── input        ← event bubbles up
    │   ├── btn-record   ← event bubbles up
    │   └── btn-clear    ← event bubbles up
    ├── slot #2
    │   ├── input        ← event bubbles up
    │   └── ...
    └── ...

  Instead of N listeners (one per button), we have 2 listeners
  (one for 'input', one for 'click') on the parent.
```

### 7.6: Keybinding Recording

This is the "press to record" feature. When recording mode is active, the next keydown is captured as the new keybinding:

```js
document.addEventListener('keydown', (e) => {
  if (recordingSlotId === null) return; // Not recording

  e.preventDefault();
  e.stopPropagation();

  // Ignore standalone modifier keys (user is still building the combo)
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

  // Must include at least one primary modifier
  if (!e.ctrlKey && !e.altKey && !e.metaKey) {
    showError(recordingSlotId, 'Shortcut must include Ctrl, Alt, or Cmd');
    return;
  }

  const kb = {
    ctrlKey: e.ctrlKey,
    shiftKey: e.shiftKey,
    altKey: e.altKey,
    metaKey: e.metaKey,
    code: e.code, // Physical key — not affected by Shift
    display: '',
  };
  kb.display = keybindingToString(kb);

  // Check uniqueness
  if (isDuplicateKeybinding(kb, recordingSlotId)) {
    showError(recordingSlotId, `"${kb.display}" is already in use`);
    return;
  }

  // Save the keybinding
  const slot = slots.find((s) => s.id === recordingSlotId);
  if (slot) {
    slot.keybinding = kb;
    saveSlots();
  }
  recordingSlotId = null;
  renderSlots();
});
```

**Recording flow:**

```
User clicks "Record" on slot #2
        │
        ▼
recordingSlotId = 2, UI shows "Press keys..."
        │
        ▼
User presses Cmd+Shift+3
        │
        ▼
keydown fires: e.key="Meta" → ignored (lone modifier)
keydown fires: e.key="Shift" → ignored (lone modifier)
keydown fires: e.code="Digit3", e.metaKey=true, e.shiftKey=true
        │
        ▼
Validates: has modifier ✓, unique ✓
        │
        ▼
Saves keybinding { metaKey:true, shiftKey:true, code:"Digit3" }
UI shows "Cmd+Shift+3"
```

### 7.7: Initialization

```js
// Load saved state on popup open
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
```

---

## Step 8: Icons

You need 6 icon files — 3 sizes in normal and disabled (greyed) variants:

| File                   | Size    | State           |
| ---------------------- | ------- | --------------- |
| `icon16.png`           | 16x16   | Normal (green)  |
| `icon48.png`           | 48x48   | Normal (green)  |
| `icon128.png`          | 128x128 | Normal (green)  |
| `icon16_disabled.png`  | 16x16   | Disabled (grey) |
| `icon48_disabled.png`  | 48x48   | Disabled (grey) |
| `icon128_disabled.png` | 128x128 | Disabled (grey) |

You can create these with any image editor, or generate them programmatically. The icons should represent a clipboard or copy symbol. Use green (#4CAF50) for the normal state and grey (#CCCCCC) for disabled.

---

## Step 9: Load and Test the Extension

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select your `copydeck/` folder
5. The CopyDeck icon appears in your toolbar

### Testing Checklist

```
[ ] Click icon → popup opens with one default slot
[ ] Enter a value (e.g., "hello@email.com") in slot #1
[ ] Open a new tab → go to any website
[ ] Press Cmd+Shift+1 (or Ctrl+Shift+1 on Windows)
[ ] Toast appears: "Copied: hello@email.com"
[ ] Badge shows ✓ on extension icon
[ ] Press Cmd+V → value pastes correctly
[ ] Add a second slot → record a different keybinding
[ ] Verify both shortcuts work independently
[ ] Try recording a duplicate keybinding → error shown
[ ] Toggle extension off → icon greys out
[ ] Press shortcut → nothing happens (disabled)
[ ] Toggle back on → shortcuts work again
[ ] Close and reopen browser → slots are cleared (session storage)
```

---

## Step 10: Automated Testing with Playwright

You can write end-to-end tests using Playwright to load the extension in a real Chromium instance:

```bash
npm init -y
npm install playwright @playwright/test
npx playwright install chromium
```

```js
// test-extension.spec.js
const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test('CopyDeck copies value to clipboard', async () => {
  // Launch Chrome with the extension loaded
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${path.resolve(__dirname)}`,
      `--load-extension=${path.resolve(__dirname)}`,
    ],
  });

  // Wait for service worker
  const sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  const extId = sw.url().split('/')[2];
  await new Promise((r) => setTimeout(r, 1500));

  // Set a value via popup
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extId}/popup/popup.html`);
  await popup.fill('input[type="text"]', 'test-value');
  await popup.waitForTimeout(500);
  await popup.close();

  // Test on a real page
  const page = await context.newPage();
  await page.goto('https://example.com');
  await page.waitForTimeout(1500);
  await page.click('body');

  // Press Ctrl+Shift+1
  await page.keyboard.down('Control');
  await page.keyboard.down('Shift');
  await page.keyboard.press('Digit1');
  await page.keyboard.up('Shift');
  await page.keyboard.up('Control');
  await page.waitForTimeout(500);

  // Verify clipboard
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toBe('test-value');

  await context.close();
});
```

Run with:

```bash
npx playwright test test-extension.spec.js
```

---

## Common Pitfalls and Lessons Learned

### 1. `chrome.storage.session` is invisible to content scripts by default

```
Problem:  content.js calls chrome.storage.session.get() → gets {}
Fix:      Call setAccessLevel() in background.js
```

### 2. `e.key` changes with Shift held

```
Problem:  Shift+1 → e.key = "!" (not "1")
Fix:      Use e.code = "Digit1" (physical key, never changes)
```

### 3. Content scripts don't update on extension reload

```
Problem:  Reload extension → existing tabs have old content script
Fix:      Open new tabs or refresh existing ones after reloading
```

### 4. Clipboard API can fail silently

```
Problem:  navigator.clipboard.writeText() rejected on some pages
Fix:      Fallback to document.execCommand('copy') with a hidden textarea
```

### 5. `sendResponse` with async operations

```
Problem:  sendResponse called after onMessage returns → message port closed
Fix:      Return true from onMessage to keep the channel open
```

---

## Summary of Key Chrome Extension Concepts Used

| Concept                      | Where Used           | Purpose                                               |
| ---------------------------- | -------------------- | ----------------------------------------------------- |
| Manifest V3                  | `manifest.json`      | Extension configuration                               |
| Service Worker               | `background.js`      | Background processing (replaces MV2 background pages) |
| Content Scripts              | `content.js`         | Code injected into web pages                          |
| Popup Action                 | `popup/`             | UI when clicking extension icon                       |
| `chrome.storage.session`     | All files            | Ephemeral storage (cleared on restart)                |
| `chrome.runtime.sendMessage` | Content ↔ Background | Cross-context communication                           |
| `chrome.tabs.sendMessage`    | Background → Content | Push updates to all tabs                              |
| `chrome.action.setBadgeText` | Background           | Visual feedback on icon                               |
| Event Delegation             | `popup.js`           | Efficient DOM event handling                          |
| Capture Phase Listeners      | `content.js`         | Intercept keys before page handlers                   |
| `e.code` vs `e.key`          | All keybinding code  | Cross-platform key matching                           |
