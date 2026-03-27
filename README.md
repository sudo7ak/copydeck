# CopyDeck

A Chrome extension that lets you bind keyboard shortcuts to text values for instant clipboard copying. Press a combo, paste anywhere.

## Features

- **Custom keyboard shortcuts** — Bind up to 10 slots to any key combo (e.g., Cmd+Shift+1)
- **Press-to-record keybindings** — Click "Record", press your desired combo, done
- **Cross-platform** — Works on macOS (Cmd), Windows/Linux (Ctrl) seamlessly
- **Toast notifications** — Visual confirmation when a value is copied
- **Badge indicator** — Extension icon shows a checkmark on copy
- **On/off toggle** — Disable all shortcuts with one click; icon greys out when off
- **Session-only storage** — Data clears on browser restart (no persistence, no privacy concerns)
- **Unique keybinding enforcement** — Prevents duplicate shortcut assignments
- **Clipboard fallback** — Uses `navigator.clipboard` with `execCommand` fallback for restricted pages

## Installation

### From source (Developer mode)

1. Clone this repository:

   ```bash
   git clone https://github.com/your-username/copydeck.git
   cd copydeck
   npm install
   ```

2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the `copydeck` folder
5. Pin the CopyDeck icon to your toolbar for easy access

## Usage

### Quick start

1. Click the CopyDeck icon in your toolbar
2. Enter a text value in slot #1 (default shortcut: Cmd+Shift+1 / Ctrl+Shift+1)
3. Navigate to any webpage
4. Press the shortcut — the value is copied to your clipboard
5. Paste with Cmd+V / Ctrl+V

### Managing slots

| Action                | How                                         |
| --------------------- | ------------------------------------------- |
| **Add a slot**        | Click "+ Add Slot" (up to 10)               |
| **Set a value**       | Type in the text field                      |
| **Record a shortcut** | Click "Record" → press your key combo       |
| **Clear a slot**      | Click "Clear" to reset value and keybinding |
| **Toggle extension**  | Use the on/off switch in the popup header   |

### Keybinding rules

- Must include at least one modifier: **Ctrl**, **Alt**, or **Cmd**
- Each shortcut must be unique across all slots
- Avoid Chrome-reserved combos (Ctrl+T, Ctrl+W, Ctrl+N, etc.)
- Recommended pattern: **Cmd/Ctrl+Shift+1** through **Cmd/Ctrl+Shift+0**

## Architecture

```
copydeck/
├── manifest.json        # Extension config (Manifest V3)
├── background.js        # Service worker: storage init, message routing, badge/icon
├── content.js           # Injected into pages: keydown listener, clipboard, toast
├── popup/
│   ├── popup.html       # Popup UI layout
│   ├── popup.css        # Minimal light theme
│   └── popup.js         # Slot management, keybinding recording
├── icons/               # Normal + disabled icon variants (16/48/128px)
├── eslint.config.mjs    # ESLint flat config
├── .prettierrc          # Prettier config
└── test-extension.spec.js  # Playwright end-to-end tests
```

### How it works

```
Popup (edit slots) → chrome.storage.session → Background (routes updates)
                                                      ↓
                                              Content script (all tabs)
                                                      ↓
                                              Keydown match → clipboard copy → toast
```

1. **Popup** saves slot data to `chrome.storage.session`
2. **Background** detects the change and pushes updates to all open tabs
3. **Content script** listens for keydown events, matches against stored keybindings, and copies the value to clipboard
4. A toast notification confirms the copy; the extension badge flashes a checkmark

### Key technical decisions

| Decision                            | Reason                                                                                                                           |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `e.code` over `e.key`               | `e.key` changes with Shift held (Shift+1 = "!"); `e.code` always returns the physical key                                        |
| Ctrl/Cmd equivalence                | OR-ing `ctrlKey` and `metaKey` makes shortcuts work identically on all platforms                                                 |
| Message passing over direct storage | Content scripts can't reliably access `chrome.storage.session` directly; message passing through the background is more reliable |
| Capture phase keydown listener      | Intercepts keyboard events before page handlers can consume them                                                                 |
| `chrome.storage.session`            | Ephemeral by design — clears on restart, no privacy footprint                                                                    |

## Development

### Prerequisites

- Node.js 18+
- Google Chrome

### Setup

```bash
git clone https://github.com/your-username/copydeck.git
cd copydeck
npm install
```

### Scripts

| Command                | Description                             |
| ---------------------- | --------------------------------------- |
| `npm test`             | Run Playwright end-to-end tests         |
| `npm run lint`         | Check for ESLint errors                 |
| `npm run lint:fix`     | Auto-fix ESLint errors                  |
| `npm run format`       | Format all files with Prettier          |
| `npm run format:check` | Check formatting without changing files |

### Running tests

Tests use Playwright to launch a real Chromium instance with the extension loaded:

```bash
npm test
```

Tests cover:

- Service worker initialization
- Popup slot editing and persistence
- Content script state sync via messaging
- Clipboard copy with Ctrl+Shift and Cmd+Shift
- On/off toggle disabling shortcuts

### Making changes

1. Edit the source files
2. Go to `chrome://extensions` and click the reload icon on CopyDeck
3. Open **new tabs** (or refresh existing ones) — content scripts only update on page load
4. Run `npm run lint && npm run format:check` before committing

## Permissions

| Permission       | Why                                                          |
| ---------------- | ------------------------------------------------------------ |
| `clipboardWrite` | Write copied values to the system clipboard                  |
| `storage`        | Store slots and enabled state in session storage             |
| `activeTab`      | Access the currently active tab for content script messaging |

CopyDeck requests **minimal permissions**. No browsing history, no network access, no data leaves your browser.

## Browser support

| Platform | Modifier key | Status    |
| -------- | ------------ | --------- |
| macOS    | Cmd (Meta)   | Supported |
| Windows  | Ctrl         | Supported |
| Linux    | Ctrl         | Supported |

## License

MIT
