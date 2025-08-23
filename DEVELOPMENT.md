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

[![Tests](https://github.com/JustPrivetProject/booking-system-plugin/actions/workflows/test.yml/badge.svg)](https://github.com/JustPrivetProject/booking-system-plugin/actions/workflows/test.yml)
[![codecov](https://codecov.io/gh/JustPrivetProject/booking-system-plugin/branch/main/graph/badge.svg)](https://codecov.io/gh/JustPrivetProject/booking-system-plugin)

The project includes comprehensive testing setup with Jest and CI/CD integration:

```bash
npm test               # Run all tests
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage report
npm run test:quiet     # Run tests silently
```

### Coverage Requirements

This project maintains the following minimum coverage requirements:

- **Lines**: 40% minimum
- **Functions**: 40% minimum
- **Branches**: 40% minimum
- **Statements**: 40% minimum

### Test Structure

- **Unit Tests** (`tests/unit/`): Test individual functions and components
- **Integration Tests** (`tests/unit/integration/`): Test component interactions
- **E2E Tests** (`tests/e2e/`): Test complete user workflows
- **Mocks** (`tests/unit/mocks/`): Mock implementations for external dependencies

### Automated Testing

- ✅ **CI/CD Integration**: Tests run automatically on every PR and push
- 📊 **Coverage Reporting**: Detailed coverage reports with Codecov
- 🔍 **Quality Gates**: Minimum coverage thresholds enforced
- 📝 **PR Comments**: Automatic coverage reports in pull requests

### Test Coverage Areas

- Core utility functions (fetch, logging, date formatting)
- Authentication service (Supabase integration)
- Baltichub API service (port booking operations)
- Session management
- Error handling and retry mechanisms
- Background script handlers
- Queue management system

## Code Quality

[![Build](https://github.com/JustPrivetProject/booking-system-plugin/actions/workflows/release.yml/badge.svg)](https://github.com/JustPrivetProject/booking-system-plugin/actions/workflows/release.yml)

```bash
npm run lint           # Run ESLint (shows errors and warnings)
npm run lint:errors    # Run ESLint (errors only, ignores warnings)
npm run lint:fix       # Fix ESLint issues automatically
npm run lint:check     # Check ESLint with zero warnings policy
npm run format         # Format code with Prettier
npm run format:check   # Check formatting without changes
npm run check-all      # Run all quality checks (fails on warnings)
npm run ci:lint        # CI-friendly lint (format check + errors only)
```

### Quality Assurance

- 🔍 **Static Analysis**: ESLint with TypeScript support
- 🎨 **Code Formatting**: Prettier for consistent code style
- 🔄 **Pre-commit Hooks**: Automatic linting and formatting before commits
- ✅ **Automated Testing**: Full test suite with CI/CD integration
- 📊 **Code Coverage**: Minimum 40% coverage requirement enforced

### Linting Policy

- **CI/CD Pipeline**: Only ESLint **errors** block the build process
- **Local Development**: Use `npm run lint` to see all warnings and errors
- **Pre-commit**: Hooks fix and check only errors (warnings allowed)
- **Strict Mode**: Use `npm run lint:check` for zero-warning policy when needed

## CI/CD Pipeline

The project uses GitHub Actions for automated testing and deployment:

### Workflows

1. **Test Workflow** (`.github/workflows/test.yml`)
    - Runs on every push and pull request
    - Executes full test suite with coverage
    - Uploads coverage reports to Codecov
    - Validates minimum coverage thresholds

2. **Release Workflow** (`.github/workflows/release.yml`)
    - Automatic releases from `main` and `dev` branches
    - Depends on successful test completion
    - Creates extension packages for distribution

### Branch Protection

- `main` and `dev` branches require passing tests
- Pull requests must pass all quality checks
- Coverage reports automatically posted to PRs

For detailed CI/CD setup instructions, see [docs/implementation/ci-cd-setup.md](docs/implementation/ci-cd-setup.md).

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
