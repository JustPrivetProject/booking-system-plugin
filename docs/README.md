# Technical Documentation

## 📚 Overview

This directory contains comprehensive technical documentation for the Chrome Booking System Plugin Extension. All documentation is organized by topic and follows consistent formatting standards.

## 📋 Documentation Structure

### 🏗️ Architecture & Refactoring

#### Core Architecture
- **[Background Script Refactoring](./architecture/background-refactoring.md)** - Modular architecture implementation
  - Separation of concerns
  - Storage utils integration
  - Error handling improvements
  - Complete unit test coverage

- **[QueueManager Refactoring](./architecture/queue-manager-refactoring.md)** - Queue management improvements
  - Singleton pattern elimination
  - Dependency injection implementation
  - Better testability and maintainability

- **[QueueManager Migration Plan](./architecture/queue-manager-migration-plan.md)** - Step-by-step migration strategy
  - Background script migration
  - Popup integration
  - Service updates
  - Risk assessment and timeline

- **[QueueManager Refactoring Summary](./architecture/queue-manager-refactoring-summary.md)** - Quick overview of changes
  - Problems solved
  - Files created/removed
  - Migration guide

#### Refactoring Strategy
- **[Refactoring Plan](./architecture/refactoring-plan.md)** - Overall refactoring strategy
  - Current state analysis
  - Improvement priorities
  - Implementation timeline
  - Success metrics

- **[Utils Refactoring](./architecture/utils-refactoring.md)** - Utility functions improvements
  - Code organization
  - Function consolidation
  - Performance optimizations
  - Migration guide

### 🧪 Testing & Quality Assurance

#### Testing Strategy
- **[Testing Strategy](./testing/testing-strategy.md)** - Comprehensive testing approach
  - Unit testing strategy
  - Mock implementations
  - Test coverage and metrics
  - Best practices

- **[Jest Testing Patterns](./testing/jest-testing-patterns.md)** - Testing patterns and best practices
  - Test helper classes
  - Type-safe mocking
  - Async testing patterns
  - Chrome extension testing

- **[Badge Testing Strategy](./testing/badge-testing-strategy.md)** - Specific testing for badge module
  - Test architecture
  - Edge cases testing
  - Performance testing
  - Coverage metrics

#### Testing Infrastructure
- **[Sinon-Chrome Migration](./testing/sinon-chrome-migration.md)** - Migration to sinon-chrome
  - Installation and setup
  - Migration patterns
  - Common issues and solutions
  - Benefits and comparison

### 🔧 Technical Implementation

#### Error Handling
- **[Error Handling System](./implementation/error-handling.md)** - Error handling and logging system
  - Error types and classification
  - Retry mechanisms
  - Logging to Supabase
  - HTML error detection

#### Authentication & Security
- **[App Authentication](./implementation/app-authentication.md)** - Authentication system
  - User authentication flow
  - Session management
  - Auto-login functionality
  - Security considerations

## 🎯 Quick Start Guide

### For New Developers
1. **Start with** [Refactoring Plan](./architecture/refactoring-plan.md) to understand project goals
2. **Read** [Background Script Refactoring](./architecture/background-refactoring.md) for core architecture
3. **Review** [Testing Strategy](./testing/testing-strategy.md) for development workflow

### For Background Script Development
1. **Read** [Background Script Refactoring](./architecture/background-refactoring.md)
2. **Check** [QueueManager Refactoring](./architecture/queue-manager-refactoring.md)
3. **Follow** [Testing Patterns](./testing/jest-testing-patterns.md)

### For Testing Development
1. **Start with** [Testing Strategy](./testing/testing-strategy.md)
2. **Learn** [Jest Testing Patterns](./testing/jest-testing-patterns.md)
3. **Migrate to** [Sinon-Chrome](./testing/sinon-chrome-migration.md)

### For Error Handling
1. **Read** [Error Handling System](./implementation/error-handling.md)
2. **Check** [Testing Strategy](./testing/testing-strategy.md) for error testing patterns

## 📊 Project Status

| Component | Status | Documentation | Test Coverage |
|-----------|--------|---------------|---------------|
| Background Script | ✅ Refactored + Tested | [Background Refactoring](./architecture/background-refactoring.md) | 100% |
| Queue Manager | ✅ Refactored | [QueueManager Refactoring](./architecture/queue-manager-refactoring.md) | 100% |
| Error Handling | ✅ Implemented | [Error Handling](./implementation/error-handling.md) | 100% |
| Utils | ✅ Refactored | [Utils Refactoring](./architecture/utils-refactoring.md) | 100% |
| Authentication | ✅ Stable | [App Authentication](./implementation/app-authentication.md) | 100% |
| Unit Testing | ✅ Complete | [Testing Strategy](./testing/testing-strategy.md) | 100% |
| Sinon-Chrome | ✅ Migrated | [Sinon-Chrome Migration](./testing/sinon-chrome-migration.md) | 100% |

## 🔗 Related Links

- [Main README](../README.md) - Project overview and setup
- [Privacy Policy](../PRIVACY_POLICY.md) - Privacy and data handling
- [Development Guide](../DEVELOPMENT.md) - Development setup and guidelines

## 📝 Documentation Standards

### File Naming
- Use kebab-case for file names
- Group related files in subdirectories
- Use descriptive names that indicate content

### Content Structure
- Start with overview and purpose
- Include code examples where relevant
- Provide migration guides for changes
- Include testing strategies
- End with next steps or related documents

### Language
- All documentation is written in English
- Code comments are in English
- User-facing text is in Polish (as per project requirements)

## 🚀 Contributing to Documentation

When adding new documentation:
1. Follow the established structure and naming conventions
2. Include code examples and migration guides
3. Update this README.md with new entries
4. Ensure all links are working
5. Test any code examples provided
