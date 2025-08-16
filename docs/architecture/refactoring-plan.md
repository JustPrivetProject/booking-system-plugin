# Refactoring Plan

## 🔍 Current State Analysis

### Strong Points of the Project:

- ✅ **Comprehensive testing infrastructure** - Jest, unit tests, integration tests, E2E
- ✅ **Good modular structure** - Separated services, utilities, types
- ✅ **Advanced error handling** - Retry system, error logging to Supabase
- ✅ **Technical documentation** - README, docs for error handling
- ✅ **TypeScript** - Strong typing
- ✅ **Webpack** with extension configuration

### Identified Problems:

## ⚠️ Main Problems to Solve

### 1. **Architecture and Code Organization**

- **Singleton anti-pattern** in `QueueManager` - difficult to test
- **Mixed logic** in `background/index.ts` (472 lines) - too many responsibilities
- **Lack of centralized state management** - scattered across chrome.storage
- **Weak abstraction** for communication between components

### 2. **TypeScript and Types**

- **Missing interfaces** for configuration (`jest.config.js`, `webpack.config.js`)
- **Weak typing** in `utils-function.ts` (e.g., `...args` without types)
- **Inconsistent typing** - `noImplicitAny: false` in tsconfig

### 3. **Error Handling and Logging**

- **TODO in code** - `// TODO: add action to update grid` in `baltichub.ts:190`
- **Mixed abstraction levels** in error handling
- **Lack of centralized logging** - different mechanisms in different places

### 4. **Performance and Optimization**

- **Webpack without minification** - `minimize: false`
- **Lack of caching** for HTTP requests
- **Sequential processing** in queue manager may be inefficient

### 5. **Testing**

- **Lack of coverage enforcement** in CI/CD
- **Mocks could be more realistic**
- **Lack of performance tests**

## 🏗️ Architecture Improvement Plan

### **Phase 1: Core Architecture Refactoring (2-3 weeks)**

#### A. **State Management**

```typescript
// New centralized state manager
export class ExtensionStateManager {
    private static instance: ExtensionStateManager
    private state: ExtensionState
    private subscribers: Map<string, (state: ExtensionState) => void>

    // Reactive state management
    subscribe(key: string, callback: (state: ExtensionState) => void): void
    setState(updates: Partial<ExtensionState>): Promise<void>
    getState(): ExtensionState
}
```

#### B. **Dependency Injection Container**

```typescript
// services/DIContainer.ts
export class DIContainer {
    register<T>(token: string, factory: () => T): void
    get<T>(token: string): T
    resolve<T>(constructor: new (...args: any[]) => T): T
}
```

#### C. **Event Bus Architecture**

```typescript
// events/EventBus.ts
export class EventBus {
    on<T>(event: string, handler: (data: T) => void): void
    emit<T>(event: string, data: T): void
    off(event: string, handler: Function): void
}
```

## 🔧 Specific Refactorings

### **1. QueueManager Refactoring**

```typescript
// Before:
class QueueManager {
    static instance: QueueManager | null = null
    constructor() {
        /* singleton logic */
    }
}

// After:
export interface IQueueManager {
    addToQueue(item: RetryObject): Promise<RetryObject[]>
    removeFromQueue(id: string): Promise<RetryObject[]>
    updateQueueItem(
        id: string,
        updates: Partial<RetryObject>
    ): Promise<RetryObject[]>
}

export class QueueManager implements IQueueManager {
    constructor(
        private storage: IStorageService,
        private logger: ILogger
    ) {}
}
```

### **2. Background Script Separation**

```typescript
// New structure:
src/background/
├── BackgroundController.ts     # Main controller
├── handlers/
│   ├── MessageHandler.ts       # Message routing
│   ├── RequestHandler.ts       # HTTP request handling
│   └── StorageHandler.ts       # Storage events
├── services/
│   ├── QueueService.ts         # Queue management
│   ├── AuthMonitorService.ts   # Auth monitoring
│   └── NotificationService.ts  # Notifications
└── index.ts                    # Entry point
```

### **3. Improved Error Handling**

```typescript
// Centralized error handling
export class ErrorManager {
    private static handlers = new Map<ErrorType, ErrorHandler>()

    static handle(error: AppError): Promise<ErrorResult> {
        const handler = this.handlers.get(error.type)
        return handler ? handler.handle(error) : this.defaultHandler(error)
    }

    static registerHandler(type: ErrorType, handler: ErrorHandler): void {
        this.handlers.set(type, handler)
    }
}
```

### **4. HTTP Client Refactoring**

```typescript
// New HTTP client with better abstraction
export class HttpClient {
    constructor(
        private config: HttpClientConfig,
        private interceptors: RequestInterceptor[],
        private cache: ICacheService
    ) {}

    async request<T>(config: RequestConfig): Promise<ApiResponse<T>> {
        // Interceptors, cache, retry logic
    }
}
```

### **5. Improved TypeScript Configuration**

```typescript
// tsconfig.json improvements
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,           // ← Enable
    "strictNullChecks": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true, // ← Add
    "exactOptionalPropertyTypes": true // ← Add
  }
}
```

## 📋 Comprehensive Improvement Plan

### **🎯 Priorities (By Importance)**

#### **PRIORITY 1 - Critical (1-2 weeks)**

1. **QueueManager Refactoring** - Remove singleton, dependency injection
2. **TypeScript strictness** - Enable `noImplicitAny`, improve typing
3. **Separate background/index.ts** - Reduce from 472 to ~50 lines
4. **Remove TODO** from production code

#### **PRIORITY 2 - Important (2-3 weeks)**

1. **State Management** - Centralize application state
2. **HTTP Client refactoring** - Better abstraction, cache, interceptors
3. **Error Handling centralization** - Single error handling system
4. **Performance optimization** - Webpack minification, lazy loading

#### **PRIORITY 3 - Improvements (3-4 weeks)**

1. **Event Bus Architecture** - Loosely coupled components
2. **Advanced testing** - Coverage enforcement, performance tests
3. **Monitoring and Analytics** - Metrics, performance tracking
4. **Documentation** - API docs, architecture documentation

### **📅 Implementation Timeline**

### **🏗️ New Architecture (Target State)**

### **📊 Success Metrics**

| Category                 | Current State | Target | Improvement |
| ------------------------- | ----------- | ------ | ----------- |
| **Code Coverage**         | ~70%        | >90%   | +20%        |
| **Bundle Size**           | ~2MB        | <1.5MB | -25%        |
| **TypeScript Errors**     | 5-10        | 0      | -100%       |
| **Cyclomatic Complexity** | 15-20       | <10    | -50%        |
| **Test Performance**      | ~30s        | <15s   | -50%        |

### **🔧 Tools and Technologies**

#### **Add to project:**

- **ESLint** with strict rules
- **Husky** pre-commit hooks
- **Webpack Bundle Analyzer**
- **Jest Coverage Threshold**
- **TypeDoc** for API documentation

#### **DevOps improvements:**

```json
// package.json scripts
{
    "scripts": {
        "lint": "eslint src/ --ext .ts,.tsx",
        "lint:fix": "eslint src/ --ext .ts,.tsx --fix",
        "type-check": "tsc --noEmit",
        "analyze": "webpack-bundle-analyzer dist/bundle.js",
        "coverage:enforce": "jest --coverage --coverageThreshold='{\"global\":{\"lines\":90}}'",
        "docs": "typedoc src/",
        "precommit": "lint-staged"
    }
}
```

## 🎯 Summary and Next Steps

### **Key Conclusions:**

1. **Project has solid foundations** - good test structure, TypeScript, documentation
2. **Main problems are architectural** - singleton patterns, mixed responsibilities, weak typing
3. **Lots of technical debt** - TODO in code, disable minification, noImplicitAny: false

### **Recommended First Steps:**

1. **Start with QueueManager refactoring** - biggest impact on architecture
2. **Enable strict TypeScript** - immediate code quality improvement
3. **Separate background/index.ts** - reduce complexity

### **ROI Analysis:**

- **High ROI**: TypeScript strict mode, QueueManager refactoring, Background split
- **Medium ROI**: State management, HTTP client refactoring
- **Long-term ROI**: Event Bus, Advanced monitoring

### **Risk Mitigation:**

- **Incremental refactoring** - small steps, frequent tests
- **Feature flags** for new components
- **Comprehensive testing** before each change
- **Rollback strategy** for each refactoring

## 🔗 Related Documents

- [Background Script Refactoring](./background-refactoring.md)
- [QueueManager Refactoring](./queue-manager-refactoring.md)
- [Utils Refactoring](./utils-refactoring.md)
- [Testing Strategy](../testing/testing-strategy.md)
