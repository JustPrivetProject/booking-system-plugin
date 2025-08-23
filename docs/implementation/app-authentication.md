# App Authentication System

## 🎯 Overview

This feature enables the Chrome extension to automatically recover from an expired session by triggering a login on the content page. Once logged in, it restores background processing of previously failed requests due to authorization errors.

## 🏗️ Components

### 1. Content Script

Periodically (every 1 minute) calls `isAppUnauthorized()` by sending a message to the background.

If unauthorized, triggers `window.location.reload()` to redirect to the login page.

**New: Countdown Modal on Home Page**

- On the home page (`/`), if user is not authenticated, shows a countdown modal
- Modal displays 60-second countdown before automatic login button click
- User can click "Zaloguj teraz" immediately or wait for countdown to complete
- Simply clicks the login button on the home page (no auto-login form filling)

After reload, attempts to simulate a login by clicking the login button.

Upon successful login, sends a message (`LOGIN_SUCCESS` or `AUTO_LOGIN_ATTEMPT`) back to the background.

### 2. Background Script

Maintains a `unauthorized` flag in `chrome.storage.local`.

Responds to `GET_AUTH_STATUS` requests with the current authorization state.

Listens for `LOGIN_SUCCESS` and `AUTO_LOGIN_ATTEMPT`, and resets the `unauthorized` flag.

Listens for `chrome.storage.onChanged` for `unauthorized` updates.

If changed to `false`, triggers `restoreEntityStatuses()`.

Handles `LOAD_AUTO_LOGIN_CREDENTIALS` requests by decrypting and returning stored credentials.

### 3. QueueManager

Manages a retry queue stored in `chrome.storage.local`.

Has a method `updateQueueItem` to change status of queued requests.

The `restoreEntityStatuses()` function scans the queue and changes entities with status `authorization-error` back to `in-progress`.

### 4. Auto-Login Service

Manages user credentials with encryption/decryption functionality.

Provides methods for saving, loading, and clearing auto-login credentials.

Handles credential encryption using simple XOR encryption (demo implementation).

### 5. Popup UI

Provides a compact auto-login toggle button in the user actions section.

Opens a modal dialog for managing auto-login credentials with:

- Login field (text input)
- Password field (password input)
- Info note: "Your credentials are stored locally and used only for automatic login."
- Save, Clear, and Cancel buttons

All UI text is in Polish language.

### 6. Countdown Modal

**New Component: `src/content/modals/countdownModal.ts`**

Shows a modal dialog on the home page with:

- Title: "Automatyczne logowanie"
- Countdown timer showing seconds remaining (60 seconds)
- "Zaloguj teraz" button for immediate action
- "Anuluj" button to cancel
- 60-second automatic countdown

**Simple Implementation:**

- Only clicks the login button on the home page (`a.product-box[href="/login"]`)
- No auto-login form filling (unlike login page)
- No credential loading or form manipulation
- Just navigates to login page after countdown

## 💾 Storage Keys

| Key             | Scope | Description                                        |
| --------------- | ----- | -------------------------------------------------- |
| `unauthorized`  | local | Boolean flag indicating if user is authenticated   |
| `retryQueue`    | local | Array of entities to be retried                    |
| `autoLoginData` | local | Encrypted auto-login credentials with enabled flag |

## 🔄 Sequence of Events

### Home Page Flow (New)

1. **User visits home page** → content script checks authentication
2. **If not authenticated** → shows countdown modal
3. **Countdown modal** → 60-second timer with simple login button click
4. **Login button click** → navigates to login page
5. **On login page** → existing auto-login logic applies

### Login Page Flow (Existing)

1. **Request to backend fails** → background sets `unauthorized = true`
2. **Content script detects unauthorized** → triggers page reload
3. **On login page** → script attempts auto-login:
    - Requests credentials from background (`LOAD_AUTO_LOGIN_CREDENTIALS`)
    - Background decrypts and returns credentials
    - Content script fills login form with credentials
    - Clicks login button
4. **On success** → script sends `AUTO_LOGIN_ATTEMPT` event → background sets `unauthorized = false`
5. **Background reacts** → updates entity statuses in retry queue

## 🔄 Auto-Login Flow

```mermaid
graph TD
    A[Content script] -->|setInterval| B[isAppUnauthorized]
    B -->|GET_AUTH_STATUS| C[Background]
    C -->|from chrome.storage.local| D[unauthorized]

    B -->|unauthorized = true| E[Reload page]
    E --> F[Login button click]
    F -->|LOAD_AUTO_LOGIN_CREDENTIALS| C
    C -->|Decrypt & return credentials| G[Fill login form]
    G --> H[Click login button]
    H -->|AUTO_LOGIN_ATTEMPT| C
    C -->|unauthorized = false| I[onStorageChange]
    I --> J[restoreEntityStatuses]
    J --> K[QueueManager.updateQueueItem]

    %% New Home Page Flow
    L[Home page load] -->|Not authenticated| M[Show countdown modal]
    M -->|60 second timer| N[Auto-login attempt]
    N -->|Load credentials| O[Fill form if available]
    O --> P[Click login button]
    P -->|LOGIN_SUCCESS| C
```

## 🔐 Security Notes

- Credentials are stored locally with simple XOR encryption (demo implementation)
- In production, a more secure encryption method should be used
- Credentials are only used for automatic login and never transmitted to external servers
- Users can clear stored credentials at any time through the popup UI
- Countdown modal provides user control over automatic navigation to login page

## 🧪 Testing

### Unit Tests

```typescript
describe('Auto-Login Service', () => {
    it('should encrypt and decrypt credentials correctly', () => {
        const credentials = { username: 'test', password: 'password' };
        const encrypted = encryptCredentials(credentials);
        const decrypted = decryptCredentials(encrypted);
        expect(decrypted).toEqual(credentials);
    });
});
```

### Integration Tests

```typescript
describe('Authentication Flow', () => {
    it('should handle complete auth recovery flow', async () => {
        // 1. Simulate unauthorized state
        // 2. Trigger auto-login
        // 3. Verify queue restoration
        // 4. Check auth status
    });
});
```

## 🚀 Usage Examples

### Content Script

```typescript
// Check authentication status
const isUnauthorized = await chrome.runtime.sendMessage({
    action: 'GET_AUTH_STATUS',
});

if (isUnauthorized) {
    // Show countdown modal or reload page
    showCountdownModal();
}
```

### Background Script

```typescript
// Handle auth status requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'GET_AUTH_STATUS') {
        const { unauthorized } = await getStorage('unauthorized');
        sendResponse(unauthorized);
    }
});
```

### Popup

```typescript
// Save auto-login credentials
const saveCredentials = async (username: string, password: string) => {
    const encrypted = encryptCredentials({ username, password });
    await setStorage({ autoLoginData: encrypted });
};
```

## 📊 Benefits

### Before

- ❌ Manual re-authentication required
- ❌ Lost queue items on session expiry
- ❌ Poor user experience

### After

- ✅ Automatic session recovery
- ✅ Queue restoration after re-auth
- ✅ Seamless user experience
- ✅ Secure credential storage
- ✅ User control over auto-login

## 🔗 Related Documents

- [Background Script Refactoring](../architecture/background-refactoring.md) - Auth handling in background
- [QueueManager Refactoring](../architecture/queue-manager-refactoring.md) - Queue restoration
- [Error Handling](./error-handling.md) - Auth error handling
- [Testing Strategy](../testing/testing-strategy.md) - Auth testing patterns
