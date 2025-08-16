# Jest Testing Patterns

## 🎯 Overview

This document contains a collection of Jest testing patterns used in the project, with examples and recommendations for application.

## 🔧 Core Patterns

### 1. Test Helper Class Pattern

**Purpose:** Encapsulate testing logic and reuse code.

```typescript
class ServiceTestHelper {
    private mockDependency: jest.MockedFunction<...>
    private mockStorage: jest.MockedFunction<...>

    constructor() {
        this.mockDependency = require('../dependency').mockFunction
        this.mockStorage = require('../storage').mockFunction
    }

    setupMocks(): void {
        this.mockDependency.mockReturnValue('test-value')
        this.mockStorage.mockResolvedValue({ data: 'test' })
    }

    expectDependencyCalledWith(...args: any[]): void {
        expect(this.mockDependency).toHaveBeenCalledWith(...args)
    }

    resetMocks(): void {
        jest.clearAllMocks()
        this.mockDependency.mockReset()
        this.mockStorage.mockReset()
    }
}
```

**Application:**
- Complex tests with multiple mocks
- Repeated setup operations
- Integration tests

### 2. Type-Safe Mocking Pattern

**Purpose:** Ensure type safety when working with mocks.

```typescript
// Define types for mocks
type MockService = {
    getData: jest.MockedFunction<(id: string) => Promise<Data>>
    saveData: jest.MockedFunction<(data: Data) => Promise<void>>
    deleteData: jest.MockedFunction<(id: string) => Promise<boolean>>
}

type MockStorage = {
    get: jest.MockedFunction<(key: string) => Promise<any>>
    set: jest.MockedFunction<(key: string, value: any) => Promise<void>>
    remove: jest.MockedFunction<(key: string) => Promise<void>>
}

// Use in tests
describe('Service Tests', () => {
    let mockService: MockService
    let mockStorage: MockStorage

    beforeEach(() => {
        mockService = {
            getData: jest.fn(),
            saveData: jest.fn(),
            deleteData: jest.fn(),
        }
        mockStorage = {
            get: jest.fn(),
            set: jest.fn(),
            remove: jest.fn(),
        }
    })
})
```

### 3. Test Data Constants Pattern

**Purpose:** Centralized management of test data.

```typescript
// Test constants
const TEST_USERS = {
    VALID: {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
    },
    INVALID: {
        id: '',
        name: '',
        email: 'invalid-email',
    },
} as const

const TEST_RESPONSES = {
    SUCCESS: { success: true, data: 'test-data' },
    ERROR: { success: false, error: 'test-error' },
    EMPTY: { success: true, data: null },
} as const

const TEST_ERRORS = {
    NETWORK: new Error('Network error'),
    VALIDATION: new Error('Validation failed'),
    TIMEOUT: new Error('Request timeout'),
} as const
```

### 4. Arrange-Act-Assert Pattern

**Purpose:** Structure tests for better readability.

```typescript
describe('UserService', () => {
    it('should create user successfully', async () => {
        // Arrange
        const userData = TEST_USERS.VALID
        mockService.createUser.mockResolvedValue(userData)
        mockStorage.set.mockResolvedValue(undefined)

        // Act
        const result = await userService.createUser(userData)

        // Assert
        expect(result).toEqual(userData)
        expect(mockService.createUser).toHaveBeenCalledWith(userData)
        expect(mockStorage.set).toHaveBeenCalledWith('user', userData)
    })
})
```

### 5. Error Testing Pattern

**Purpose:** Comprehensive testing of error handling.

```typescript
describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
        // Arrange
        const networkError = TEST_ERRORS.NETWORK
        mockService.getData.mockRejectedValue(networkError)

        // Act & Assert
        await expect(userService.getUserData('user-1')).rejects.toThrow('Network error')
        expect(mockStorage.get).not.toHaveBeenCalled()
    })

    it('should retry on temporary failures', async () => {
        // Arrange
        mockService.getData
            .mockRejectedValueOnce(TEST_ERRORS.NETWORK)
            .mockResolvedValueOnce(TEST_USERS.VALID)

        // Act
        const result = await userService.getUserDataWithRetry('user-1')

        // Assert
        expect(result).toEqual(TEST_USERS.VALID)
        expect(mockService.getData).toHaveBeenCalledTimes(2)
    })
})
```

### 6. Async Testing Pattern

**Purpose:** Proper testing of asynchronous operations.

```typescript
describe('Async Operations', () => {
    it('should handle multiple concurrent requests', async () => {
        // Arrange
        const promises = [
            userService.getUserData('user-1'),
            userService.getUserData('user-2'),
            userService.getUserData('user-3'),
        ]

        // Act
        const results = await Promise.all(promises)

        // Assert
        expect(results).toHaveLength(3)
        expect(mockService.getData).toHaveBeenCalledTimes(3)
    })

    it('should timeout long-running operations', async () => {
        // Arrange
        mockService.getData.mockImplementation(() => 
            new Promise(resolve => setTimeout(resolve, 5000))
        )

        // Act & Assert
        await expect(
            userService.getUserDataWithTimeout('user-1', 1000)
        ).rejects.toThrow('Operation timeout')
    })
})
```

### 7. State Management Testing Pattern

**Purpose:** Testing state management.

```typescript
describe('State Management', () => {
    it('should maintain consistent state across operations', async () => {
        // Arrange
        const initialState = { users: [], loading: false }
        const updatedState = { users: [TEST_USERS.VALID], loading: false }

        // Act
        await userService.loadUsers()
        const finalState = userService.getState()

        // Assert
        expect(finalState).toEqual(updatedState)
        expect(finalState.users).toContain(TEST_USERS.VALID)
    })

    it('should reset state when clearing data', async () => {
        // Arrange
        await userService.loadUsers()
        expect(userService.getState().users).toHaveLength(1)

        // Act
        await userService.clearData()

        // Assert
        expect(userService.getState().users).toHaveLength(0)
    })
})
```

### 8. Integration Testing Pattern

**Purpose:** Testing component interactions.

```typescript
describe('Integration Scenarios', () => {
    it('should handle complete user workflow', async () => {
        // 1. Create user
        const user = await userService.createUser(TEST_USERS.VALID)
        expect(user).toEqual(TEST_USERS.VALID)

        // 2. Update user
        const updatedUser = { ...user, name: 'Updated Name' }
        await userService.updateUser(user.id, updatedUser)

        // 3. Verify update
        const retrievedUser = await userService.getUserData(user.id)
        expect(retrievedUser.name).toBe('Updated Name')

        // 4. Delete user
        await userService.deleteUser(user.id)

        // 5. Verify deletion
        await expect(userService.getUserData(user.id)).rejects.toThrow('User not found')
    })
})
```

## 🔧 Specialized Patterns

### 1. Chrome Extension Testing Pattern

```typescript
class ChromeExtensionTestHelper {
    private chromeMock: ChromeMock

    constructor() {
        this.chromeMock = (global as any).chrome
    }

    setupChromeAPI(): void {
        this.chromeMock.action.setBadgeText = jest.fn((details, callback) => {
            if (this.chromeMock.runtime.lastError) {
                callback()
            } else {
                callback()
            }
        })
        this.chromeMock.runtime.lastError = null
    }

    simulateChromeError(error: Error): void {
        this.chromeMock.runtime.lastError = error
    }

    expectBadgeUpdate(expectedText: string): void {
        expect(this.chromeMock.action.setBadgeText).toHaveBeenCalledWith({ text: expectedText })
    }
}
```

### 2. API Testing Pattern

```typescript
class APITestHelper {
    private mockFetch: jest.MockedFunction<typeof fetch>

    constructor() {
        this.mockFetch = jest.fn()
        global.fetch = this.mockFetch
    }

    mockSuccessfulResponse(data: any): void {
        this.mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(data),
            text: () => Promise.resolve(JSON.stringify(data)),
        } as Response)
    }

    mockErrorResponse(status: number, message: string): void {
        this.mockFetch.mockResolvedValue({
            ok: false,
            status,
            statusText: message,
            json: () => Promise.resolve({ error: message }),
            text: () => Promise.resolve(message),
        } as Response)
    }

    expectAPICall(url: string, options?: RequestInit): void {
        expect(this.mockFetch).toHaveBeenCalledWith(url, options)
    }
}
```

### 3. Storage Testing Pattern

```typescript
class StorageTestHelper {
    private mockStorage: jest.MockedFunction<...>

    constructor() {
        this.mockStorage = require('../storage').storageAPI
    }

    mockStorageData(key: string, value: any): void {
        this.mockStorage.get.mockImplementation((requestedKey: string) => {
            if (requestedKey === key) {
                return Promise.resolve(value)
            }
            return Promise.resolve(null)
        })
    }

    expectStorageGet(key: string): void {
        expect(this.mockStorage.get).toHaveBeenCalledWith(key)
    }

    expectStorageSet(key: string, value: any): void {
        expect(this.mockStorage.set).toHaveBeenCalledWith(key, value)
    }
}
```

## 📋 Best Practices

### 1. Test Naming

```typescript
// ✅ Good names
it('should return user data when valid ID provided', async () => {})
it('should throw error when user not found', async () => {})
it('should update badge with highest priority status', async () => {})

// ❌ Bad names
it('should work', async () => {})
it('test 1', async () => {})
it('does something', async () => {})
```

### 2. Test Organization

```typescript
describe('UserService', () => {
    describe('getUserData', () => {
        describe('when user exists', () => {
            it('should return user data', async () => {})
        })

        describe('when user does not exist', () => {
            it('should throw error', async () => {})
        })

        describe('when network fails', () => {
            it('should retry operation', async () => {})
        })
    })
})
```

### 3. Mock Management

```typescript
beforeEach(() => {
    // Setup mocks
    jest.clearAllMocks()
    mockService.getData.mockReset()
    mockStorage.get.mockReset()
})

afterEach(() => {
    // Cleanup after tests
    jest.restoreAllMocks()
})
```

### 4. Call Verification

```typescript
// Check call count
expect(mockFunction).toHaveBeenCalledTimes(2)

// Check arguments
expect(mockFunction).toHaveBeenCalledWith('expected-arg')

// Check last call
expect(mockFunction).toHaveBeenLastCalledWith('last-arg')

// Check no calls
expect(mockFunction).not.toHaveBeenCalled()
```

## 🚀 Application Recommendations

### 1. Pattern Selection

- **Test Helper Class** - for complex tests with multiple dependencies
- **Type-Safe Mocking** - for large TypeScript projects
- **Test Data Constants** - for tests with repeated data
- **Arrange-Act-Assert** - for all tests (basic pattern)

### 2. Pattern Combination

```typescript
describe('ComplexService', () => {
    let testHelper: ServiceTestHelper
    let chromeHelper: ChromeExtensionTestHelper

    beforeEach(() => {
        testHelper = new ServiceTestHelper()
        chromeHelper = new ChromeExtensionTestHelper()
        
        testHelper.setupMocks()
        chromeHelper.setupChromeAPI()
    })
})
```

### 3. Scaling

- Start with simple patterns
- Add complexity as needed
- Document non-standard solutions
- Regularly refactor tests

## 🎯 Conclusion

Using these patterns ensures:
- **Readability** of tests
- **Code reuse**
- **Type safety** in TypeScript
- **Maintainability** of test base
- **Reliability** of tests

Choose patterns based on the complexity of the code being tested and project requirements.

## 🔗 Related Documents

- [Testing Strategy](./testing-strategy.md) - Overall testing approach
- [Sinon-Chrome Migration](./sinon-chrome-migration.md) - Chrome API mocking
- [Badge Testing Strategy](./badge-testing-strategy.md) - Specific module testing
