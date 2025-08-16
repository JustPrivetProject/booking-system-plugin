# Testing Documentation

## Overview

This project uses Jest as the primary testing framework with comprehensive test coverage for all major components.

## Test Structure

```
tests/
├── mocks/                    # Mock implementations
│   └── chrome.ts            # Chrome Extension API mocks
├── unit/                     # Unit tests
│   ├── services/            # Service layer tests
│   │   ├── authService.test.ts
│   │   └── baltichub.test.ts
│   └── utils/               # Utility function tests
│       └── utils-function.test.ts
├── integration/              # Integration tests
│   └── baltichub-integration.test.ts
├── e2e/                      # End-to-end tests
│   └── booking-flow.test.ts
├── setup.ts                  # Global test setup
└── README.md                 # This file
```

## Running Tests

### All Tests

```bash
npm test
```

### Specific Test Types

```bash
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:e2e           # E2E tests only
```

### Development Mode

```bash
npm run test:watch          # Watch mode for development
npm run test:coverage       # Coverage report
```

## Test Categories

### Unit Tests

Test individual functions and components in isolation:

- **Utils Functions**: Core utility functions (fetch, logging, date formatting)
- **Auth Service**: Authentication logic and Supabase integration
- **Baltichub Service**: API calls and data processing
- **Session Service**: Session management
- **Storage Helpers**: Chrome storage operations

### Integration Tests

Test component interactions and data flow:

- **Service Integration**: How services work together
- **API Flow**: Complete API request/response cycles
- **Error Handling**: Error propagation across components
- **Session Management**: Session persistence across operations

### E2E Tests

Test complete user workflows:

- **Complete Booking Flow**: From login to successful booking
- **Error Recovery**: Handling failures and retries
- **Concurrent Operations**: Multiple simultaneous requests
- **Session Expiration**: Handling expired sessions

## Mocking Strategy

### Chrome Extension API

All Chrome Extension APIs are mocked in `tests/mocks/chrome.ts`:

- `chrome.storage` (local and session)
- `chrome.webRequest` (request interception)
- `chrome.tabs` (tab management)
- `chrome.runtime` (message passing)
- `chrome.action` (badge management)

### External Dependencies

- **Supabase**: Mocked for authentication and database operations
- **Fetch API**: Mocked for HTTP requests
- **Device ID**: Mocked for consistent testing
- **Storage**: Mocked for Chrome storage operations

## Test Data

### Sample Data

Tests use realistic sample data:

- User credentials and profiles
- API responses from Baltichub
- HTML content for parsing tests
- Error scenarios and edge cases

### Test Utilities

Common test utilities and helpers:

- Mock response generators
- Test data factories
- Assertion helpers

## Coverage Goals

### Current Coverage

- **Unit Tests**: Core functions and services
- **Integration Tests**: Service interactions
- **E2E Tests**: Complete workflows

### Target Coverage

- **Lines**: >90%
- **Functions**: >95%
- **Branches**: >85%

## Best Practices

### Writing Tests

1. **Arrange-Act-Assert**: Structure tests clearly
2. **Descriptive Names**: Use clear test descriptions
3. **Single Responsibility**: Test one thing per test
4. **Mock External Dependencies**: Don't rely on external services
5. **Test Edge Cases**: Include error scenarios

### Test Organization

1. **Group Related Tests**: Use describe blocks
2. **Setup/Teardown**: Use beforeEach/afterEach
3. **Clean Mocks**: Reset mocks between tests
4. **Isolation**: Tests should not depend on each other

### Debugging Tests

1. **Console Output**: Use `console.log` in tests (mocked)
2. **Jest Debug**: Use `--verbose` flag for more output
3. **Coverage Reports**: Identify untested code
4. **Watch Mode**: Use for iterative development

## Common Patterns

### Testing Async Functions

```typescript
it('should handle async operation', async () => {
    const result = await someAsyncFunction()
    expect(result).toBeDefined()
})
```

### Testing Error Cases

```typescript
it('should handle errors gracefully', async () => {
    await expect(asyncFunction()).rejects.toThrow('Expected error')
})
```

### Mocking Dependencies

```typescript
jest.mock('../path/to/module', () => ({
    functionName: jest.fn().mockResolvedValue('mocked result'),
}))
```

### Testing Chrome APIs

```typescript
import { chromeMock } from '../mocks/chrome'

it('should save to chrome storage', async () => {
    chromeMock.storage.local.set.mockResolvedValue({})
    await saveToStorage(data)
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith(data)
})
```

## Continuous Integration

### GitHub Actions

Tests run automatically on:

- Pull requests
- Push to main branch
- Manual triggers

### Pre-commit Hooks

Consider adding pre-commit hooks to:

- Run tests before commits
- Check code coverage
- Format code automatically

## Troubleshooting

### Common Issues

1. **Mock Not Working**: Check mock setup and imports
2. **Async Test Failures**: Ensure proper async/await usage
3. **Chrome API Errors**: Verify Chrome mocks are loaded
4. **Coverage Gaps**: Review uncovered code paths

### Debug Commands

```bash
npm test -- --verbose        # More detailed output
npm test -- --no-cache       # Clear Jest cache
npm test -- --runInBand      # Run tests sequentially
```
