# QueueManager Refactoring Documentation

## 🎯 Overview

QueueManager has been completely refactored to eliminate architectural issues and improve testability. Key changes include removing the singleton anti-pattern and implementing dependency injection.

## 🔧 Problems Solved

1. **Singleton Anti-pattern** - Eliminated global singleton
2. **Tight Coupling** - Implemented dependency injection
3. **Hard to Test** - Added mock services for testing
4. **Mixed Responsibilities** - Separated responsibilities into individual services
5. **Weak Error Handling** - Improved error handling
6. **Code Duplication** - Eliminated duplication with existing utilities

## 🏗️ New Architecture

### Using Existing Utilities

Instead of creating new services, the new QueueManager uses existing utilities:

```typescript
// Storage - using existing storageControl.helper.ts
import { getStorage, setStorage } from '../utils/storageControl.helper';

// Logging - using existing functions from utils-function.ts
import { consoleLog, consoleError, consoleLogWithoutSave } from '../utils/utils-function';

// Badge - using existing badge.ts
import { updateBadge, clearBadge } from '../utils/badge';
```

### Interfaces and Types

```typescript
// src/types/queue.ts
export interface IQueueManager {
    addToQueue(item: RetryObject): Promise<RetryObject[]>;
    removeFromQueue(id: string): Promise<RetryObject[]>;
    updateQueueItem(id: string, updates: Partial<RetryObject>): Promise<RetryObject[]>;
    getQueue(): Promise<RetryObject[]>;
    startProcessing(
        processRequest: ProcessRequestFunction,
        options?: ProcessingOptions,
    ): Promise<void>;
    stopProcessing(): void;
}

export interface IAuthService {
    isAuthenticated(): Promise<boolean>;
}
```

## 📦 New Files

```
src/
├── types/
│   └── queue.ts                    # New interfaces and types
├── services/
│   ├── queueManager.ts             # New QueueManager
│   ├── queueManagerFactory.ts      # Factory for creation
│   └── queueManagerAdapter.ts      # Adapter for compatibility
└── tests/unit/services/
    └── queueManager.test.ts        # Comprehensive tests
```

## 🔄 Migration

### Option 1: Gradual Migration (Recommended)

Use adapter for backward compatibility:

```typescript
// Old code continues to work
import QueueManager from '../background/queue-manager';
const queueManager = QueueManager.getInstance();

// New code uses adapter
import { QueueManagerAdapter } from '../services/queueManagerAdapter';
const queueManager = QueueManagerAdapter.getInstance();
```

### Option 2: Direct Migration

```typescript
// Old way
import QueueManager from '../background/queue-manager';
const queueManager = QueueManager.getInstance();

// New way
import { QueueManagerFactory } from '../services/queueManagerFactory';
const queueManager = QueueManagerFactory.create({
    storageKey: 'retryQueue',
    enableLogging: true,
});
```

### Option 3: With Custom Services

```typescript
import { QueueManager } from '../services/queueManager';

const queueManager = new QueueManager(authService, {
    storageKey: 'customQueue',
});
```

## 🧪 Testing

### Unit Tests

```typescript
import { QueueManager } from '../services/queueManager';

describe('QueueManager', () => {
    let queueManager: QueueManager;
    let mockAuthService: { isAuthenticated: jest.Mock };

    beforeEach(() => {
        mockAuthService = {
            isAuthenticated: jest.fn().mockResolvedValue(true),
        };

        queueManager = new QueueManager(mockAuthService, {
            storageKey: 'testQueue',
        });
    });
});
```

### Integration Tests

```typescript
import { QueueManagerFactory } from '../services/queueManagerFactory';

describe('QueueManager Integration', () => {
    it('should process queue items correctly', async () => {
        const queueManager = QueueManagerFactory.create();
        // Test integration scenarios
    });
});
```

## 📊 New Features

### Monitoring and Statistics

```typescript
// Get processing state
const state = queueManager.getProcessingState();
console.log('Is processing:', state.isProcessing);
console.log('Processed count:', state.processedCount);

// Get statistics
const stats = await queueManager.getStatistics();
console.log('Total items:', stats.totalItems);
console.log('Success rate:', stats.successItems / stats.totalItems);
```

### Event Handling

```typescript
const queueManager = QueueManagerFactory.create(
    {},
    {
        onItemAdded: item => console.log('Item added:', item),
        onProcessingStarted: () => console.log('Processing started'),
        onProcessingError: error => console.error('Processing error:', error),
    },
);
```

### Configuration

```typescript
const queueManager = QueueManagerFactory.create({
    storageKey: 'customQueue',
    retryDelay: 2000,
    batchSize: 20,
    enableLogging: true,
});
```

**Configuration Options:**

- `retryDelay`: Delay between retry attempts in milliseconds (default: 1000)
- `batchSize`: Number of items to process in each batch (default: 10)
- `enableLogging`: Enable/disable logging (default: true)
- `storageKey`: Chrome storage key for queue persistence (default: 'retryQueue')

## 🔧 Performance Improvements

1. **Batch Processing** - Processing items in batches
2. **Configurable Intervals** - Configurable processing intervals
3. **Better Error Handling** - Improved error handling
4. **Memory Management** - Better memory management
5. **No Code Duplication** - Using existing utilities

## 🚀 Next Steps

1. **Update background/index.ts** to use new QueueManager
2. **Add monitoring** to popup for displaying statistics
3. **Create E2E tests** for full processing cycle
4. **Add metrics** for performance tracking

## ⚠️ Breaking Changes

- Removed static `getInstance()` method from original QueueManager
- Changed constructor signature
- Added new required dependencies

## 📝 Migration Checklist

- [ ] Update imports in background/index.ts
- [ ] Update imports in content scripts
- [ ] Update imports in popup
- [ ] Run tests
- [ ] Check E2E tests
- [ ] Update documentation
- [ ] Remove old QueueManager after complete migration

## 🎯 Advantages of New Approach

1. **Using existing utilities** - no code duplication
2. **Better testability** - dependency injection
3. **Cleaner architecture** - separation of responsibilities
4. **Backward compatibility** - adapter for smooth migration
5. **Fewer files** - simplified structure

## 🔗 Related Documents

- [QueueManager Migration Plan](./queue-manager-migration-plan.md)
- [QueueManager Refactoring Summary](./queue-manager-refactoring-summary.md)
- [Refactoring Plan](./refactoring-plan.md)
