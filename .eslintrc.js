module.exports = {
    root: true,
    env: {
        browser: true,
        es2020: true,
        node: true,
        webextensions: true,
    },
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'prettier', // Отключает все правила ESLint, которые могут конфликтовать с Prettier
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
    },
    plugins: ['@typescript-eslint'],
    rules: {
        // TypeScript specific rules
        '@typescript-eslint/no-unused-vars': [
            'error',
            {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_',
            },
        ],
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-non-null-assertion': 'warn',

        // General rules
        'no-console': 'warn',
        'no-debugger': 'error',
        'no-alert': 'warn',
        'prefer-const': 'error',
        'no-var': 'error',
        'no-empty': 'warn',

        // Chrome extension specific
        'no-eval': 'error',
        'no-implied-eval': 'error',
        'no-new-func': 'error',
        'no-script-url': 'error',
        'no-prototype-builtins': 'warn',
    },
    overrides: [
        {
            // Test files
            files: ['**/*.test.ts', '**/*.spec.ts', 'tests/**/*.ts'],
            env: {
                jest: true,
            },
            rules: {
                '@typescript-eslint/no-explicit-any': 'off',
                '@typescript-eslint/no-var-requires': 'off',
                'no-console': 'off',
            },
        },
        {
            // Configuration files
            files: ['*.config.js', '*.config.ts', 'webpack.config.js'],
            rules: {
                '@typescript-eslint/no-var-requires': 'off',
                'no-console': 'off',
            },
        },
    ],
    ignorePatterns: [
        'dist/',
        'node_modules/',
        '*.min.js',
        'coverage/',
        'extension*.zip',
        '.eslintrc.js',
        'tests/e2e/',
        'playwright.config.ts',
        '**/*.spec.ts',
        'playwright-report/',
        'test-results/',
    ],
};
