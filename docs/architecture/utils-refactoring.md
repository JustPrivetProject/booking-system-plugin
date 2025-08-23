# Utils Refactoring

## 🎯 Overview

The `utils-function.ts` file has been refactored to improve code organization, maintainability, and separation of concerns. The original monolithic file has been split into multiple focused modules.

## 📁 New Structure

### 1. Data Constants (`src/data.ts`)

All constants, enums, and interfaces have been moved to the central data file:

- `ErrorType` enum
- `HttpStatus` enum
- `RetryConfig` interface
- `ErrorResponse` interface
- `FetchRequestOptions` interface
- `DEFAULT_RETRY_CONFIG` constant
- `RETRYABLE_STATUSES` array
- `LOGS_LENGTH` constant

### 2. Logging Utilities (`src/utils/logging.ts`)

Functions related to console logging and session storage:

- `consoleLog()` - Main logging function with session storage
- `consoleLogWithoutSave()` - Logging without session storage
- `consoleError()` - Error logging with session storage
- `saveLogToSession()` - Save logs to chrome.storage.session
- `getLogsFromSession()` - Retrieve logs from session storage
- `clearLogsInSession()` - Clear logs from session storage

### 3. HTTP Utilities (`src/utils/http.ts`)

Network request handling and error management:

- `fetchRequest()` - Enhanced fetch with retry logic and error handling
- `detectHtmlError()` - Detect HTML error pages
- `determineErrorType()` - Determine error type based on status and response
- `testErrorHandling()` - Test function for error handling
- Helper functions: `isRetryableError()`, `calculateDelay()`, `sleep()`, `createErrorResponse()`

### 4. Data Helpers (`src/utils/data-helpers.ts`)

Data manipulation and utility functions:

- `normalizeFormData()` - Normalize form data arrays
- `createFormData()` - Create FormData from object
- `getLastProperty()` - Get last property from object
- `getPropertyById()` - Get property by ID
- `extractFirstId()` - Extract first ID from object
- `generateUniqueId()` - Generate unique UUID
- `JSONstringify()` - Pretty JSON stringify

### 5. Storage Utilities (`src/utils/storage.ts`)

Chrome storage operations (combined functions from `storageControl.helper.ts` and `deviceId.ts`):

- `getStorage()` - Get values from chrome.storage.local
- `setStorage()` - Set values in chrome.storage.local
- `onStorageChange()` - Subscribe to storage changes
- `removeStorage()` - Remove values from storage
- `getOrCreateDeviceId()` - Get or create device ID
- `cleanupCache()` - Clean up request cache
- `getLocalStorageData()` - Get all local storage data
- `getStorageValue()` - Get single value by key
- `setStorageValue()` - Set single value by key
- `hasStorageKey()` - Check if key exists
- `getStorageSize()` - Get storage size in bytes

### 6. Date Utilities (`src/utils/date-utils.ts`)

Date parsing and formatting:

- `parseDateTimeFromDMY()` - Parse date from DD.MM.YYYY HH:mm format
- `formatDateToDMY()` - Format date to DD.MM.YYYY
- `getTodayFormatted()` - Get today's date formatted

### 7. Status Utilities (`src/utils/status-utils.ts`)

Status-related functions:

- `sortStatusesByPriority()` - Sort statuses by priority order

### 8. Legacy Compatibility (`src/utils/utils-function.ts`)

Maintains backward compatibility by re-exporting all functions from the new modules.

### 9. Index File (`src/utils/index.ts`)

Convenient entry point for importing all utilities.

## 🔄 Migration Guide

### Before (Old Import)

```typescript
import { consoleLog, fetchRequest, normalizeFormData } from '../utils/utils-function';
```

### After (New Import Options)

#### Option 1: Use specific modules (Recommended)

```typescript
import { consoleLog } from '../utils/logging';
import { fetchRequest } from '../utils/http';
import { normalizeFormData } from '../utils/data-helpers';
```

#### Option 2: Use index file

```typescript
import { consoleLog, fetchRequest, normalizeFormData } from '../utils';
```

#### Option 3: Use legacy file (Still works)

```typescript
import { consoleLog, fetchRequest, normalizeFormData } from '../utils/utils-function';
```

## ✅ Benefits

1. **Better Organization**: Related functions are grouped together
2. **Improved Maintainability**: Easier to find and modify specific functionality
3. **Reduced Bundle Size**: Can import only needed modules
4. **Better Type Safety**: More focused type definitions
5. **Easier Testing**: Can test individual modules in isolation
6. **Backward Compatibility**: Existing code continues to work

## 📊 File Size Comparison

- **Before**: 612 lines in single file
- **After**:
    - `data.ts`: +82 lines (shared constants)
    - `logging.ts`: 67 lines
    - `http.ts`: 245 lines
    - `data-helpers.ts`: 45 lines
    - `storage.ts`: 156 lines (combined with `storageControl.helper.ts` and `deviceId.ts`)
    - `date-utils.ts`: 25 lines
    - `status-utils.ts`: 8 lines
    - `utils-function.ts`: 25 lines (re-exports)
    - `index.ts`: 15 lines

## 🗑️ Removed Files

During the refactoring process, the following files were removed as their functionality was combined:

- `src/utils/storageControl.helper.ts` - functions moved to `storage.ts`
- `src/utils/deviceId.ts` - functions moved to `storage.ts`

## 🧪 Testing

All existing tests should continue to work as the public API remains unchanged. New tests can be written for individual modules.

## 🚀 Future Improvements

1. Add unit tests for each module
2. Consider using barrel exports for better tree-shaking
3. Add JSDoc documentation for all functions
4. Consider creating separate packages for different utility categories

## 🔗 Related Documents

- [Refactoring Plan](./refactoring-plan.md)
- [Error Handling](../implementation/error-handling.md)
- [Testing Strategy](../testing/testing-strategy.md)
