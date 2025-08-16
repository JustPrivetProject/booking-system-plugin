# Testing Strategy

## 🎯 Overview

This document outlines the comprehensive testing strategy for the Chrome Booking System Plugin Extension, focusing on the unit testing approach implemented for the refactored background script.

## 🏗️ Testing Architecture

### Test Structure
```
tests/
├── setup.ts                    # Global test setup and mocks
├── setup-sinon-chrome.ts       # Sinon-chrome configuration
├── mocks/                      # Mock implementations
│   ├── chrome.ts              # Chrome API mocks (legacy)
│   ├── supabase.ts            # Supabase client mocks
│   ├── response.ts            # Response mocks
│   └── errorLogService.ts     # Error logging mocks
├── unit/                       # Unit tests
│   ├── handlers/              # Background script handler tests
│   │   ├── BackgroundController.test.ts
│   │   ├── MessageHandler.test.ts
│   │   ├── RequestHandler.test.ts
│   │   └── StorageHandler.test.ts
│   ├── services/              # Service layer tests
│   └── utils/                 # Utility function tests
├── integration/               # Integration tests
└── e2e/                      # End-to-end tests
```

## 🧪 Unit Testing Strategy

### Background Script Handlers

#### BackgroundController Tests
- **Initialization Flow**: Tests complete initialization sequence
- **Event Listener Setup**: Verifies Chrome API listener configuration
- **Error Handling**: Tests graceful error handling during initialization
- **Message Routing**: Ensures proper message routing to handlers
- **Installation Handling**: Tests extension install/update scenarios

#### MessageHandler Tests
- **Message Actions**: Comprehensive testing of all message types
  - `SHOW_ERROR`, `SUCCEED_BOOKING`, `PARSED_TABLE`
  - `IS_AUTHENTICATED`, `GET_AUTH_STATUS`
  - `LOGIN_SUCCESS`, `AUTO_LOGIN_ATTEMPT`
  - `LOAD_AUTO_LOGIN_CREDENTIALS`, `IS_AUTO_LOGIN_ENABLED`
  - `REMOVE_REQUEST`, `UPDATE_REQUEST_STATUS`
  - `SEND_LOGS`
- **Authentication Flow**: Tests auth checking and auto-login
- **Queue Management**: Tests queue operations and status updates
- **Error Scenarios**: Tests error handling and logging

#### RequestHandler Tests
- **Request Caching**: Tests body and header caching
- **Header Filtering**: Tests extension header detection
- **Storage Operations**: Tests Chrome storage interactions
- **Error Handling**: Tests storage error scenarios
- **Listener Setup**: Tests Chrome WebRequest API configuration

#### StorageHandler Tests
- **Auth Monitoring**: Tests unauthorized state changes
- **Queue Restoration**: Tests queue recovery after auth restoration
- **Error Handling**: Tests queue manager error scenarios
- **Storage Change Detection**: Tests Chrome storage change events

## 🔧 Mock Strategy

### Chrome API Mocking Options

#### 1. Sinon-Chrome (Recommended)
**File**: `tests/setup-sinon-chrome.ts`

**Advantages:**
- ✅ Full Chrome Extension API emulation
- ✅ Automatic API updates
- ✅ Realistic behavior
- ✅ Less maintenance code
- ✅ Better compatibility with real API
- ✅ Event dispatching support
- ✅ Global setup - no need to configure in each test
- ✅ Includes all original mocks (Supabase, console, fetch, localStorage, etc.)

**Usage:**
```typescript
describe('Test with Sinon-Chrome', () => {
    beforeEach(() => {
        sinon.stub(chrome.action, 'setBadgeText').callsArg(1)
    })

    it('should call chrome API', () => {
        chrome.action.setBadgeText({ text: 'test' }, () => {})
        expect(chrome.action.setBadgeText.calledWith({ text: 'test' })).toBe(true)
    })
})
```

#### 2. Custom Chrome Mocks (Legacy)
**File**: `tests/mocks/chrome.ts`

**Advantages:**
- ✅ Full control over mocks
- ✅ Simple Jest integration
- ✅ Easy to understand and modify

**Disadvantages:**
- ❌ Manual maintenance
- ❌ May not cover all Chrome API
- ❌ Requires updates when API changes

### Global Mocks (tests/setup.ts)
```typescript
// Chrome API Mock
global.chrome = chromeMock

// Supabase Mock
jest.mock('@supabase/supabase-js', () => ({
    createClient: createClientMock,
}))

// Console Mock
beforeEach(() => {
    console.log = jest.fn()
    console.error = jest.fn()
})
```

### Service Mocks
- **QueueManagerAdapter**: Mocked for dependency injection
- **Storage Utils**: Mocked for async operations
- **Auth Services**: Mocked for authentication flows
- **Error Logging**: Mocked for error tracking

## 📊 Test Coverage

### Current Coverage
- ✅ **BackgroundController**: 100% - All initialization and event handling
- ✅ **MessageHandler**: 100% - All message types and scenarios
- ✅ **RequestHandler**: 100% - All caching and filtering logic
- ✅ **StorageHandler**: 100% - All storage change handling

### Test Metrics
| Component | Test Files | Test Cases | Coverage |
|-----------|------------|------------|----------|
| BackgroundController | 1 | 15 | 100% |
| MessageHandler | 1 | 12 | 100% |
| RequestHandler | 1 | 18 | 100% |
| StorageHandler | 1 | 8 | 100% |
| **Total** | **4** | **53** | **100%** |

## 🚀 Running Tests

### All Tests
```bash
npm test
```

### Background Script Tests Only
```bash
npm test -- --testPathPattern="handlers"
```

### Sinon-Chrome Tests
```bash
npm test -- --testPathPattern="sinon-chrome"
```

### Specific Handler Tests
```bash
npm test -- --testPathPattern="BackgroundController"
npm test -- --testPathPattern="MessageHandler"
npm test -- --testPathPattern="RequestHandler"
npm test -- --testPathPattern="StorageHandler"
```

### With Coverage
```bash
npm test -- --coverage --testPathPattern="handlers"
```

## 🔍 Test Patterns

### Async Testing with Sinon-Chrome
```typescript
it('should handle async operations', async () => {
    // Setup chrome API to call callback immediately
    chrome.storage.local.get.callsArgWith(1, { key: 'value' })
    
    const result = await storageUtils.getData('key')
    expect(result).toBe('value')
    expect(chrome.storage.local.get.calledWith(['key'])).toBe(true)
})
```

### Error Testing with Sinon-Chrome
```typescript
it('should handle chrome API errors', async () => {
    // Setup chrome API to simulate error
    chrome.action.setBadgeText.callsArgWith(1, { runtime: { lastError: new Error('API Error') } })
    
    await expect(updateBadge(['error'])).resolves.not.toThrow()
})
```

### Mock Verification with Sinon-Chrome
```typescript
it('should call chrome API correctly', () => {
    chrome.action.setBadgeText({ text: 'test' }, () => {})
    
    expect(chrome.action.setBadgeText.calledOnce).toBe(true)
    expect(chrome.action.setBadgeText.firstCall.args[0]).toEqual({ text: 'test' })
    expect(typeof chrome.action.setBadgeText.firstCall.args[1]).toBe('function')
})
```

### Async Testing (Legacy)
```typescript
it('should handle async operations', async () => {
    const result = await handler.asyncOperation()
    expect(result).toBe(expectedValue)
})
```

### Error Testing (Legacy)
```typescript
it('should handle errors gracefully', async () => {
    mockService.mockRejectedValue(new Error('Test error'))
    
    try {
        await handler.operation()
        fail('Should have thrown an error')
    } catch (err) {
        expect(err.message).toBe('Test error')
    }
})
```

### Mock Verification (Legacy)
```typescript
it('should call dependencies correctly', () => {
    handler.operation()
    
    expect(mockDependency).toHaveBeenCalledWith(expectedArgs)
    expect(mockDependency).toHaveBeenCalledTimes(1)
})
```

## 📋 Best Practices

### Test Organization
1. **Arrange**: Set up test data and mocks
2. **Act**: Execute the function being tested
3. **Assert**: Verify the expected outcomes

### Mock Management
- Clear mocks before each test
- Use descriptive mock names
- Verify mock calls when relevant
- Keep mocks simple and focused

### Sinon-Chrome Best Practices
- Always call `sinon.restore()` in `beforeEach` and `afterEach`
- Use `callsArg()` for immediate callback execution
- Use `callsArgWith()` for callback with specific arguments
- Use `returns()` for synchronous methods
- Use `yields()` for async methods with callbacks

### Error Testing
- Test both success and failure scenarios
- Verify error messages and types
- Test graceful degradation
- Ensure errors are properly logged

## 🔄 Migration Strategy

### From Custom Mocks to Sinon-Chrome

#### Phase 1: Setup and Testing
1. ✅ Install sinon-chrome
2. ✅ Create setup-sinon-chrome.ts
3. ✅ Create simple test to verify functionality
4. ✅ Update Jest configuration

#### Phase 2: Gradual Migration
1. **Start with simple utilities** (badge, storage, etc.)
2. **Migrate handler tests** one by one
3. **Update integration tests**
4. **Remove legacy chrome mocks**

#### Phase 3: Validation
1. **Compare test results** between old and new approaches
2. **Ensure 100% coverage** is maintained
3. **Update documentation**
4. **Remove unused dependencies**

### Migration Checklist
- [ ] Verify sinon-chrome works with existing tests
- [ ] Create migration guide for team
- [ ] Update CI/CD pipeline if needed
- [ ] Train team on new testing patterns
- [ ] Monitor test performance

## 🔄 Continuous Integration

### Pre-commit Hooks
- Run unit tests before commits
- Ensure 100% test coverage for new code
- Validate mock implementations

### CI Pipeline
- Automated test execution
- Coverage reporting
- Mock validation
- Performance regression testing

## 📈 Future Improvements

### Planned Enhancements
1. **Integration Tests**: End-to-end workflow testing
2. **Performance Tests**: Load and stress testing
3. **Visual Regression Tests**: UI component testing
4. **Accessibility Tests**: Screen reader compatibility

### Test Infrastructure
1. **Test Data Factories**: Reusable test data generation
2. **Custom Matchers**: Domain-specific assertions
3. **Test Utilities**: Common testing helpers
4. **Mock Factories**: Dynamic mock generation

## 🔗 Related Documentation

- [Background Script Refactoring](../architecture/background-refactoring.md) - Detailed refactoring information
- [Error Handling](../implementation/error-handling.md) - Error handling strategies
- [Jest Testing Patterns](./jest-testing-patterns.md) - Testing patterns and best practices
- [Sinon-Chrome Migration](./sinon-chrome-migration.md) - Migration to sinon-chrome
- [Development Guide](../../DEVELOPMENT.md) - Development setup and guidelines
