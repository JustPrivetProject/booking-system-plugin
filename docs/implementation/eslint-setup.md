# ESLint Setup and Configuration

## Overview

ESLint has been integrated into the project to ensure code quality and consistency across the TypeScript codebase. The configuration is optimized for Chrome extension development with TypeScript.

## Configuration Files

- `.eslintrc.js` - Main ESLint configuration
- `.eslintignore` - Files and directories to ignore
- `.prettierrc` - Prettier configuration for code formatting

## Available Scripts

```bash
# Check for linting issues
npm run lint

# Fix automatically fixable issues
npm run lint:fix

# Check with zero warnings allowed (for CI/CD)
npm run lint:check

# Format code with Prettier
npm run format

# Check if code is formatted correctly
npm run format:check

# Fix linting issues and format code
npm run lint:format

# Check both formatting and linting (for CI/CD)
npm run check-all
```

## Key Features

### TypeScript Support

- Full TypeScript integration with `@typescript-eslint`
- Type-aware linting rules
- Consistent import ordering with type imports

### Chrome Extension Specific Rules

- Security-focused rules for extension development
- Prevention of `eval()` and other dangerous patterns
- WebExtension environment support

### Code Quality Rules

- Consistent code style managed by Prettier (4 spaces, single quotes, semicolons)
- Unused variable detection
- Prefer const over let/var
- No formatting conflicts between ESLint and Prettier

### Integration with Prettier

- Automatic formatting integration with `plugin:prettier/recommended`
- No conflicts between ESLint and Prettier
- ESLint focuses on code quality rules, Prettier handles formatting
- Consistent code formatting across the project
- ESLint automatically fixes Prettier formatting issues
- Combined scripts for linting and formatting

## Webpack Integration

ESLint is integrated with Webpack build process:

- Automatic linting during development builds
- Fail on errors in production builds
- Real-time feedback in development mode

## Test Files

Special rules apply to test files:

- Jest environment enabled
- Console.log allowed for debugging
- Relaxed TypeScript rules for test flexibility

## Configuration Files

Configuration files (webpack.config.js, etc.) have relaxed rules:

- Allow require() statements
- Console.log allowed for build information

## Ignored Patterns

The following are ignored by ESLint:

- `dist/` - Build output
- `node_modules/` - Dependencies
- `coverage/` - Test coverage
- `extension*.zip` - Extension packages
- Generated files and documentation

## Best Practices

1. **Run linting before commits**: Use `npm run check-all`
2. **Auto-fix when possible**: Use `npm run lint:format`
3. **Check during development**: ESLint runs automatically with webpack
4. **Format code consistently**: Use `npm run format` for consistent styling
5. **Use type imports**: Prefer `import type` for type-only imports

## Troubleshooting

### Common Issues

1. **Import resolution errors**: Make sure TypeScript paths are correctly configured
2. **Prettier conflicts**: Run `npm run format` after `npm run lint:fix`
3. **Webpack build failures**: Check ESLint errors in the build output

### Disabling Rules

To disable a rule for a specific line:

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data: any = getData();
```

To disable rules for a file:

```typescript
/* eslint-disable @typescript-eslint/no-explicit-any */
```

## Migration Notes

When migrating existing code:

1. Run `npm run lint` to identify issues
2. Use `npm run lint:fix` to auto-fix most problems
3. Manually review and fix remaining issues
4. Update any custom rules as needed
