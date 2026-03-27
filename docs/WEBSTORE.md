# Chrome Web Store copy (ready to paste)

## Extension name

CopyDeck

## Short description (up to ~132 chars)

Bind keyboard shortcuts to text snippets. Press a combo, copy instantly, paste anywhere.

## Detailed description

CopyDeck is a lightweight clipboard shortcut manager for Chrome.

Set up to 10 “slots” (emails, addresses, IDs, code snippets, templates) and bind each slot to a keyboard shortcut like **Cmd+Shift+1** (Mac) or **Ctrl+Shift+1** (Windows/Linux).

### What you can do

- Create up to **10** slots for your frequently used text
- Record shortcuts with a **press-to-record** workflow
- Get instant feedback with **toast notifications** and an optional **badge checkmark**
- Toggle CopyDeck **on/off** from the popup

### How it works

1. Click the CopyDeck toolbar icon
2. Type a value into a slot
3. Click **Record** and press your shortcut
4. On any normal webpage, press the shortcut to copy the slot value

### Privacy & security

- **No accounts. No tracking. No network requests.**
- Your slot values are stored locally using Chrome’s **session storage**, and are cleared when the browser restarts.

### Notes / limitations

- CopyDeck uses a content script to listen for shortcuts on the current page and show a toast.
  - **No page content is read or transmitted.**
- Chrome does not allow extensions to run on certain internal pages (for example: the New Tab / “blank” page). Shortcuts work on normal webpages.

### Permissions explained

- **clipboardWrite**: to copy your selected slot value to the clipboard
- **storage**: to store your slots + enabled/disabled state
- **activeTab**: to communicate state to the current tab when needed

## Category suggestion

Productivity

## Tags / keywords

clipboard, keyboard shortcuts, snippets, productivity, copy paste, templates

---

# Privacy policy (ready to paste)

## CopyDeck Privacy Policy

**Last updated:** 2026-03-27

CopyDeck is a browser extension that lets you bind keyboard shortcuts to text values and copy them to your clipboard.

### Data we collect

CopyDeck does **not** collect, transmit, or sell personal data.

- No analytics
- No advertising IDs
- No tracking
- No account/login

### Data stored locally

CopyDeck stores your configured slot values and keybindings **locally in your browser** using `chrome.storage.session`.

- This storage is **session-only** and is cleared when the browser restarts.
- Your data is not synced to any server.

### Network access

CopyDeck makes **no network requests**.

### Permissions

CopyDeck requests only the permissions necessary to function:

- `clipboardWrite` to copy the selected slot value to your clipboard.
- `storage` to store your slots and enabled/disabled state.
- `activeTab` to communicate with the current tab when needed.

### Contact

If you have questions about this policy, contact:

- Email: (add your support email)
- Repository: https://github.com/sudo7ak/copydeck
