# Sinon-Chrome Migration Guide

## 🎯 Overview

This guide explains how to migrate from custom Chrome API mocks to sinon-chrome for better testing experience, following the official documentation.

## 📦 Installation

```bash
npm install --save-dev sinon-chrome
```

## 🔧 Setup

### 1. Global Setup

Sinon-chrome is configured globally in `tests/setup-sinon-chrome.ts` with all original mocks:

```typescript
import sinon from 'sinon';
import chrome from 'sinon-chrome';

// Import global mocks
import './mocks/response';
import { createClient, supabaseMock } from './mocks/supabase';

// Make chrome and sinon available globally
(globalThis as any).chrome = chrome;
(globalThis as any).sinon = sinon;

// Mock Supabase globally
(global as any).createClient = createClient;
(global as any).supabase = supabaseMock;

// Mock console methods
const originalConsole = { ...console };
beforeEach(() => {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    console.info = jest.fn();
});

// Mock fetch, localStorage, sessionStorage
(global as any).fetch = jest.fn();
// ... other mocks

// Reset sinon-chrome mocks after each test
afterEach(() => {
    if (typeof (chrome as any).flush === 'function') {
        (chrome as any).flush();
    }
    sinon.restore();
});
```

### 2. Jest Configuration

Update `jest.config.js` to use sinon-chrome setup:

```javascript
module.exports = {
    // ... other config
    setupFiles: ['<rootDir>/tests/setup-sinon-chrome.ts'],
};
```

## 🔄 Migration Steps

### Step 1: Update Test Imports

**Before:**

```typescript
const chromeMock = require('../../mocks/chrome').chromeMock;
```

**After:**

```typescript
// No imports needed - chrome and sinon are available globally
```

### Step 2: Update Test Setup

**Before:**

```typescript
beforeEach(() => {
    jest.clearAllMocks();
    chromeMock.action.setBadgeText.mockClear();
});
```

**After:**

```typescript
beforeEach(() => {
    sinon.stub(chrome.action, 'setBadgeText').callsArg(1);
});
```

### Step 3: Update Test Cleanup

**Before:**

```typescript
afterEach(() => {
    jest.clearAllMocks();
});
```

**After:**

```typescript
// No cleanup needed - handled globally in setup-sinon-chrome.ts
```

### Step 4: Update Assertions

**Before:**

```typescript
expect(chromeMock.action.setBadgeText).toHaveBeenCalledWith({ text: 'test' });
```

**After:**

```typescript
expect(chrome.action.setBadgeText.calledWith({ text: 'test' })).toBe(true);
```

## 📝 Common Patterns

### Basic API Call

```typescript
it('should call chrome API', () => {
    sinon.stub(chrome.action, 'setBadgeText').callsArg(1);

    chrome.action.setBadgeText({ text: 'test' }, () => {});

    expect(chrome.action.setBadgeText.calledWith({ text: 'test' })).toBe(true);
});
```

### Async API with Callback

```typescript
it('should handle async chrome API', async () => {
    sinon.stub(chrome.storage.local, 'get').callsArgWith(1, { key: 'value' });

    const result = await getStorageData('key');
    expect(result).toBe('value');
});
```

### Error Handling

```typescript
it('should handle chrome API errors', async () => {
    chrome.action.setBadgeText.callsArgWith(1, {
        runtime: { lastError: new Error('API Error') },
    });

    await expect(updateBadge(['error'])).resolves.not.toThrow();
});
```

### Event Handling

```typescript
it('should handle chrome events', () => {
    const message = { action: 'test' };
    const sendResponse = sinon.spy();

    // Dispatch the event
    chrome.runtime.onMessage.dispatch(message, {}, sendResponse);

    // Check that the event was dispatched
    expect(sendResponse.called).toBe(true);
});
```

### Multiple Calls

```typescript
it('should handle multiple API calls', () => {
    const stub = sinon.stub(chrome.action, 'setBadgeText').callsArg(1);

    chrome.action.setBadgeText({ text: 'first' }, () => {});
    chrome.action.setBadgeText({ text: 'second' }, () => {});

    expect(stub.callCount).toBe(2);
    expect(stub.firstCall.args[0]).toEqual({ text: 'first' });
    expect(stub.secondCall.args[0]).toEqual({ text: 'second' });
});
```

## 🔧 Sinon-Chrome Methods

### Stub Methods

- `callsArg(index)` - Call callback at specified index
- `callsArgWith(index, ...args)` - Call callback with arguments
- `returns(value)` - Return value for synchronous methods
- `yields(...args)` - Call callback with arguments (alias for callsArgWith)
- `throws(error)` - Throw error when called

### Verification Methods

- `called` - Check if stub was called
- `calledOnce` - Check if stub was called exactly once
- `calledWith(...args)` - Check if stub was called with specific arguments
- `callCount` - Get number of calls
- `firstCall` - Get first call details
- `lastCall` - Get last call details

### Chrome API Methods

- `chrome.flush()` - Reset all chrome API state
- `chrome.runtime.onMessage.dispatch()` - Dispatch events
- `chrome.runtime.onInstalled.dispatch()` - Dispatch install events

## 🚨 Common Issues

### Issue 1: Callback not called

**Problem:** Test hangs because callback is never called
**Solution:** Use `callsArg()` or `callsArgWith()`

```typescript
// ❌ Wrong
chrome.action.setBadgeText({ text: 'test' }, () => {});

// ✅ Correct
sinon.stub(chrome.action, 'setBadgeText').callsArg(1);
chrome.action.setBadgeText({ text: 'test' }, () => {});
```

### Issue 2: Chrome API not reset between tests

**Problem:** Previous test affects current test
**Solution:** Use `chrome.flush()` in `afterEach`

```typescript
afterEach(() => {
    chrome.flush(); // Reset all chrome API state
    delete (global as any).chrome;
    sinon.restore();
});
```

### Issue 3: Wrong assertion syntax

**Problem:** Using Jest syntax with sinon stubs
**Solution:** Use sinon assertion methods

```typescript
// ❌ Wrong (Jest syntax)
expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: 'test' });

// ✅ Correct (Sinon syntax)
expect(chrome.action.setBadgeText.calledWith({ text: 'test' })).toBe(true);
```

### Issue 4: Global chrome not set

**Problem:** Chrome API not available in test
**Solution:** Chrome is set globally in setup-sinon-chrome.ts

```typescript
// No setup needed - chrome is available globally
```

## 📊 Benefits

### Before (Custom Mocks)

- ❌ Manual maintenance
- ❌ Limited API coverage
- ❌ Inconsistent behavior
- ❌ More code to maintain

### After (Sinon-Chrome)

- ✅ Full Chrome API coverage
- ✅ Automatic updates
- ✅ Realistic behavior
- ✅ Less maintenance code
- ✅ Better testing experience
- ✅ Event dispatching support

## 🔗 Resources

- [Sinon-Chrome Documentation](https://github.com/acvetkov/sinon-chrome)
- [Sinon.js Documentation](https://sinonjs.org/)
- [Chrome Extension API Reference](https://developer.chrome.com/docs/extensions/reference/)

## 📋 Migration Checklist

- [x] Install sinon-chrome
- [x] Create example test file
- [x] Update team documentation
- [ ] Migrate one test file as example
- [ ] Train team on new patterns
- [ ] Migrate remaining tests gradually
- [ ] Remove legacy chrome mocks
- [ ] Update CI/CD if needed

## 🚀 Next Steps

1. **Start with simple utilities** (badge, storage, etc.)
2. **Migrate handler tests** one by one
3. **Update integration tests**
4. **Remove legacy chrome mocks**

## 🔗 Related Documents

- [Testing Strategy](./testing-strategy.md) - Overall testing approach
- [Jest Testing Patterns](./jest-testing-patterns.md) - Testing patterns and best practices
- [Badge Testing Strategy](./badge-testing-strategy.md) - Specific module testing
