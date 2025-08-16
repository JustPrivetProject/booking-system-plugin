# Development Guide

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn

## Setup

```bash
npm install
```

## Build Commands

```bash
npm run build          # Production build
npm run build:dev      # Development build
npm run dev            # Watch mode for development
```

## Testing

The project includes comprehensive testing setup with Jest:

```bash
npm test               # Run all tests
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage report
npm run test:unit      # Run only unit tests
npm run test:integration # Run only integration tests
```

### Test Structure

- **Unit Tests** (`tests/unit/`): Test individual functions and components
- **Integration Tests** (`tests/integration/`): Test component interactions
- **E2E Tests** (`tests/e2e/`): Test complete user workflows
- **Mocks** (`tests/mocks/`): Mock implementations for external dependencies

### Test Coverage

- Core utility functions (fetch, logging, date formatting)
- Authentication service (Supabase integration)
- Baltichub API service (port booking operations)
- Session management
- Error handling and retry mechanisms

## Code Quality

```bash
npm run format         # Format code with Prettier
```

## Architecture

### Recent Refactoring

The project has undergone significant architectural improvements:

- **QueueManager Refactoring** - Eliminated singleton anti-pattern, improved testability
- **Code Duplication Removal** - Consolidated utilities and services
- **Better Testing Infrastructure** - Comprehensive Jest setup with mocks

### Key Components

- **Background Script** (`src/background/`) - Main extension logic
- **Popup Interface** (`src/popup/`) - User interface
- **Services** (`src/services/`) - Business logic and API integration
- **Utils** (`src/utils/`) - Shared utility functions
- **Types** (`src/types/`) - TypeScript type definitions

## Documentation

### Technical Documentation

- [QueueManager Refactoring](docs/queue-manager-refactoring.md) - Detailed refactoring guide
- [QueueManager Summary](docs/queue-manager-refactoring-summary.md) - Quick overview
- [Migration Plan](docs/queue-manager-migration-plan.md) - Step-by-step migration guide
- [Refactoring Plan](docs/refactoring-plan.md) - Overall project refactoring strategy
- [Error Handling](docs/error-handling.md) - Error handling patterns
- [Authentication](docs/isAppAuth.md) - Authentication implementation

### Quick References

- **Migration**: See [Migration Plan](docs/queue-manager-migration-plan.md) for detailed steps
- **Architecture**: See [Refactoring Summary](docs/queue-manager-refactoring-summary.md) for overview
- **Testing**: See Testing section above for commands and structure
