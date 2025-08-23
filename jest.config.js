module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/src', '<rootDir>/tests/unit'],
    testMatch: ['**/__tests__/**/*.+(ts|tsx|js)', '**/*.(test|spec).+(ts|tsx|js)'],
    transform: {
        '^.+\\.(ts|tsx)$': [
            'ts-jest',
            {
                tsconfig: 'tsconfig.test.json',
                useESM: false,
                diagnostics: {
                    ignoreCodes: [1343, 151001],
                },
            },
        ],
    },
    transformIgnorePatterns: ['node_modules/(?!(@supabase|@supabase/realtime-js)/)'],
    collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/**/index.ts',
        '!src/**/*.config.ts',
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
    coverageThreshold: {
        global: {
            branches: 40,
            functions: 40,
            lines: 40,
            statements: 40,
        },
    },
    setupFilesAfterEnv: ['<rootDir>/tests/unit/setup.ts'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@supabase/supabase-js$': '<rootDir>/tests/unit/mocks/supabase.ts',
    },
    testPathIgnorePatterns: ['/node_modules/', '/dist/'],
    injectGlobals: true,

    // Настройки по умолчанию
    verbose: false,
    silent: false,
    collectCoverage: false,
    testTimeout: 10000,
    maxWorkers: '50%',

    // Reporters for CI/CD
    reporters: [
        'default',
        [
            'jest-junit',
            {
                outputDirectory: 'coverage',
                outputName: 'junit.xml',
                ancestorSeparator: ' › ',
                uniqueOutputName: 'false',
                suiteNameTemplate: '{filepath}',
                classNameTemplate: '{classname}',
                titleTemplate: '{title}',
            },
        ],
    ],
};
