# Pre-commit Hooks Configuration

This document describes the pre-commit hooks setup for the plugin project.

## Overview

The project uses [Husky](https://typicode.github.io/husky/) and [lint-staged](https://github.com/okonet/lint-staged) to automatically run code quality checks before each commit.

## Configuration

### Dependencies

- `husky`: Git hooks manager
- `lint-staged`: Runs linters on staged files only

### Setup

1. **Install dependencies:**
   ```bash
   npm install --save-dev husky lint-staged
   ```

2. **Initialize Husky:**
   ```bash
   npx husky init
   ```

3. **Configuration files:**
   - `.husky/pre-commit`: Pre-commit hook script
   - `package.json`: lint-staged configuration
   - `.prettierignore`: Files to exclude from Prettier formatting

## How it works

### Pre-commit Hook

The pre-commit hook (`.husky/pre-commit`) runs:
1. `npx lint-staged` - Runs linters on staged files
2. `npm test` - Runs all tests

### Lint-staged Configuration

The `lint-staged` configuration in `package.json` defines which tools to run on different file types:

```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{js,jsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,css,md,html}": [
      "prettier --write"
    ]
  }
}
```

### File Exclusions

- `.eslintignore`: Files excluded from ESLint
- `.prettierignore`: Files excluded from Prettier formatting

## Workflow

1. Developer makes changes to files
2. Developer stages files with `git add`
3. Developer runs `git commit`
4. Pre-commit hook automatically:
   - Runs ESLint with auto-fix on staged TypeScript/JavaScript files
   - Runs Prettier on staged files
   - Runs all tests
5. If any step fails, the commit is aborted
6. If all steps pass, the commit proceeds

## Benefits

- **Code Quality**: Ensures all committed code follows project standards
- **Consistency**: Automatic formatting and linting
- **Early Detection**: Catches issues before they reach the repository
- **Performance**: Only processes staged files, not the entire codebase

## Troubleshooting

### Hook not running

1. Ensure Husky is properly installed:
   ```bash
   npm run prepare
   ```

2. Check if the hook file is executable:
   ```bash
   ls -la .husky/pre-commit
   ```

### Linting errors

1. Run linting manually to see errors:
   ```bash
   npm run lint
   ```

2. Fix errors and try committing again

### Test failures

1. Run tests manually to see failures:
   ```bash
   npm test
   ```

2. Fix failing tests and try committing again

## Manual Commands

- `npm run lint`: Run ESLint on all source files
- `npm run lint:fix`: Run ESLint with auto-fix
- `npm run format`: Run Prettier on all files
- `npm run check-all`: Run both linting and formatting checks
- `npx lint-staged`: Run lint-staged manually (for testing)

## Skipping Hooks (Emergency)

If you need to skip pre-commit hooks in an emergency:

```bash
git commit --no-verify -m "Emergency commit"
```

**Note**: This should be used sparingly and only in genuine emergencies.
