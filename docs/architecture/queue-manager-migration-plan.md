# QueueManager Migration Plan

## 📋 Analysis Results

### 🔍 Current Usage of Old QueueManager

Based on the analysis, the old `QueueManager` is used in the following locations:

#### 1. **src/background/index.ts** (Main Usage)

- **Line 1**: `import QueueManager from './queue-manager'`
- **Line 42**: `const queueManager = QueueManager.getInstance()`
- **Line 45**: `queueManager.startProcessing(processRequest, {...})`
- **Line 143**: `const queueManager = QueueManager.getInstance()`
- **Line 250**: `await queueManager.addToQueue(retryObject)`
- **Line 492**: `const queueManager = QueueManager.getInstance()`
- **Line 493**: `const queue = await queueManager.getQueue()`
- **Line 507**: `await queueManager.updateQueueItem(item.id, {...})`

#### 2. **src/popup/popup.ts** (Indirect Usage)

- **Line 47**: `removeRequestFromRetryQueue(id)` - sends message to background
- **Line 176-178**: Direct access to `retryQueue` in Chrome storage
- **Line 381-383**: Listens for `retryQueue` storage changes
- **Line 788-791**: Direct access to `retryQueue` for statistics
- **Line 816-819**: Direct access to `retryQueue` for cleanup

#### 3. **src/services/baltichub.ts** (Data Access)

- **Line 86**: `retryQueue: RetryObject[]` parameter
- **Line 92**: Uses `retryQueue` for caching logic

## 🎯 Migration Strategy

### Phase 1: Background Script Migration (High Priority)

#### 1.1 Update background/index.ts

```typescript
// OLD
import QueueManager from './queue-manager'
const queueManager = QueueManager.getInstance()

// NEW
import { QueueManagerAdapter } from '../services/queueManagerAdapter'
const queueManager = QueueManagerAdapter.getInstance()
```

**Files to update:**

- `src/background/index.ts` (6 instances of QueueManager.getInstance())

**Steps:**

1. Replace import statement
2. Replace all `QueueManager.getInstance()` calls with `QueueManagerAdapter.getInstance()`
3. Test that all functionality works correctly

### Phase 2: Popup Integration (Medium Priority)

#### 2.1 Add QueueManager to Popup

```typescript
// Add to popup.ts
import { QueueManagerAdapter } from '../services/queueManagerAdapter'

// Replace direct storage access with QueueManager methods
const queueManager = QueueManagerAdapter.getInstance()
const queue = await queueManager.getQueue()
```

**Files to update:**

- `src/popup/popup.ts` (multiple direct storage accesses)

**Steps:**

1. Import QueueManagerAdapter
2. Replace direct `chrome.storage.local.get({ retryQueue: [] })` calls
3. Replace direct storage change listeners
4. Update statistics and cleanup functions

### Phase 3: Service Integration (Low Priority)

#### 3.1 Update baltichub.ts

```typescript
// Update function signature to accept QueueManager instance
export async function getDriverNameAndContainer(
    tvAppId: string,
    queueManager: IQueueManager
): Promise<{ driverName: string; containerNumber: string } | null>
```

**Files to update:**

- `src/services/baltichub.ts`
- `src/background/index.ts` (update function calls)

## 📝 Detailed Migration Steps

### Step 1: Background Script (Priority 1)

1. **Update imports in background/index.ts**

    ```typescript
    // Replace line 1
    import { QueueManagerAdapter } from '../services/queueManagerAdapter'
    ```

2. **Replace QueueManager.getInstance() calls**

    ```typescript
    // Lines 42, 143, 492
    const queueManager = QueueManagerAdapter.getInstance()
    ```

3. **Test background functionality**
    - Queue processing
    - Message handling
    - Storage change listeners

### Step 2: Popup Integration (Priority 2)

1. **Add QueueManager import to popup.ts**

    ```typescript
    import { QueueManagerAdapter } from '../services/queueManagerAdapter'
    ```

2. **Replace direct storage access**

    ```typescript
    // OLD (lines 176-178)
    const { retryQueue } = await new Promise<{
        retryQueue: RetryObjectArray
    }>((resolve) => chrome.storage.local.get({ retryQueue: [] }, resolve))

    // NEW
    const queueManager = QueueManagerAdapter.getInstance()
    const retryQueue = await queueManager.getQueue()
    ```

3. **Update storage change listener**

    ```typescript
    // OLD (lines 381-383)
    if (namespace === 'local' && changes.retryQueue) {

    // NEW - Use event system
    queueManager.events.onItemAdded = updateQueueDisplay
    queueManager.events.onItemRemoved = updateQueueDisplay
    ```

4. **Update statistics and cleanup functions**
    ```typescript
    // Lines 788-791, 816-819
    const queue = await queueManager.getQueue()
    ```

### Step 3: Service Updates (Priority 3)

1. **Update baltichub.ts function signature**

    ```typescript
    export async function getDriverNameAndContainer(
        tvAppId: string,
        queueManager: IQueueManager
    )
    ```

2. **Update function calls in background/index.ts**
    ```typescript
    // Line 193
    const driverAndContainer = await getDriverNameAndContainer(
        tvAppId,
        queueManager
    )
    ```

## 🧪 Testing Strategy

### Unit Tests

- ✅ `tests/unit/services/queueManager.test.ts` - Already implemented
- ✅ Test QueueManagerAdapter compatibility

### Integration Tests

- Test background script with new QueueManager
- Test popup with new QueueManager
- Test message passing between background and popup

### E2E Tests

- Test complete booking flow
- Test queue processing
- Test authentication flow

## ⚠️ Risk Assessment

### High Risk

- **Background script migration** - Core functionality
- **Message passing** - Communication between components

### Medium Risk

- **Popup integration** - UI functionality
- **Storage compatibility** - Data persistence

### Low Risk

- **Service updates** - Internal refactoring

## 📊 Success Metrics

### Functional

- [ ] All existing functionality works
- [ ] No breaking changes for users
- [ ] Performance maintained or improved

### Technical

- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] Code coverage maintained

### Migration

- [ ] Background script migrated
- [ ] Popup integrated
- [ ] Services updated
- [ ] Old QueueManager removed

## 🚀 Implementation Timeline

### Week 1: Background Migration

- [ ] Update background/index.ts
- [ ] Test background functionality
- [ ] Fix any issues

### Week 2: Popup Integration

- [ ] Update popup.ts
- [ ] Test popup functionality
- [ ] Test background-popup communication

### Week 3: Service Updates

- [ ] Update baltichub.ts
- [ ] Update related services
- [ ] Integration testing

### Week 4: Cleanup

- [ ] Remove old QueueManager
- [ ] Update documentation
- [ ] Final testing

## 🎯 Next Steps

1. **Start with background script migration** (highest impact)
2. **Test thoroughly** at each step
3. **Use QueueManagerAdapter** for backward compatibility
4. **Monitor for any issues** during migration
5. **Remove old QueueManager** only after complete migration

## 🔗 Related Documents

- [QueueManager Refactoring](./queue-manager-refactoring.md)
- [QueueManager Refactoring Summary](./queue-manager-refactoring-summary.md)
- [Refactoring Plan](./refactoring-plan.md)
