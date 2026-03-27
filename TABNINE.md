# TABNINE.md — CopyDeck

## Project overview

CopyDeck is a **Chrome Extension (Manifest V3)** that lets users bind **keyboard shortcuts** to **text snippets** and copy them to the clipboard from any page.

**Core components**

- **Service worker** (`background.js`): initializes defaults in `chrome.storage.session`, routes messages, updates badge/icon, and broadcasts state updates to tabs.
- **Content script** (`content.js`): runs on all pages at `document_start`, listens for `keydown` (capture phase), matches keybindings, copies to clipboard, and shows a toast.
- **Popup UI** (`popup/popup.html`, `popup/popup.js`, `popup/popup.css`): manages up to 10 slots, records keybindings, enforces uniqueness, and toggles enabled/disabled.

**Key design decisions (as implemented)**

- Uses `KeyboardEvent.code` (physical key) instead of `key` (layout/Shift dependent).
- Treats **Ctrl and Cmd as equivalent “main modifier”** for matching (in content script), enabling cross-platform shortcuts.
- Uses `chrome.storage.session` for **session-only** data (clears on browser restart).
- Content script obtains state via **message passing** (`getState`) and receives updates via broadcast (`stateUpdated`).

## Repository layout

- `manifest.json` — MV3 extension manifest (permissions, scripts, popup, icons)
- `background.js` — extension service worker
- `content.js` — content script injected into all pages
- `popup/` — popup UI assets and logic
- `icons/` — enabled/disabled icons
- `test-extension.spec.js`, `test-debug.spec.js` — Playwright E2E tests (loads the extension into Chromium)
- `eslint.config.mjs`, `.prettierrc` — lint/format config

## Tech stack

- JavaScript (CommonJS package type)
- Chrome Extension APIs (Manifest V3)
- Playwright (`@playwright/test`) for E2E testing
- ESLint (flat config) + Prettier

## Building / running

This repo is an extension (no build step).

### Install dependencies

```bash
npm install
```

### Run the extension (Developer mode)

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the project folder (`copydeck/`)
4. After code changes, hit **Reload** on the extension and refresh/open tabs (content scripts update on page load).

## Testing

### Run tests

```bash
npm test
```

Notes:

- Tests use `chromium.launchPersistentContext('', { headless: false, ... })` so they run **headed**.
- Tests load the extension via:
  - `--disable-extensions-except=<repo>`
  - `--load-extension=<repo>`

## Linting & formatting

### Lint

```bash
npm run lint
```

### Auto-fix lint

```bash
npm run lint:fix
```

### Format

```bash
npm run format
```

### Format check (CI-style)

```bash
npm run format:check
```

## Development conventions

### Code style

- Prettier:
  - `singleQuote: true`, `semi: true`, `printWidth: 100`, `trailingComma: all`, `tabWidth: 2`
- ESLint:
  - `no-undef: error`
  - `no-unused-vars: warn` with `_`-prefixed args ignored
  - `eqeqeq: warn`

### Storage/state conventions

- Source of truth is `chrome.storage.session` keys:
  - `slots`: array of `{ id, value, keybinding }`
  - `enabled`: boolean (default true; treated as enabled when not explicitly `false`)
- Background broadcasts state changes on `chrome.storage.session.onChanged`.
- Content script state is updated only via messaging (`getState` and `stateUpdated`).

### Keybinding rules (enforced in popup)

- Must include at least one of: **Ctrl**, **Alt**, or **Cmd**.
- Duplicate shortcut assignments across slots are rejected.
- Popup records keybindings via `keydown` and ignores lone modifier-only presses.

## Guidance for future changes (practical)

- When adding new state fields, update:
  - initialization in `background.js`
  - popup read/write in `popup/popup.js`
  - `getState` response shape + content script handlers in `content.js`
  - Playwright tests to cover the new behavior
- If you change shortcut matching logic, ensure both:
  - popup uniqueness checks (`isDuplicateKeybinding`)
  - content script matching (`matchesKeybinding`)
    remain consistent.

## Common workflows

- Quick quality gate before committing:
  ```bash
  npm run lint && npm run format:check && npm test
  ```

## TODOs / unknowns

- No CI config detected in the inspected files. If CI is desired, add a workflow that runs: `npm run lint`, `npm run format:check`, `npm test`.
