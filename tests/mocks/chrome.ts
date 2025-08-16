// Mock Chrome Extension API
const chromeMock = {
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn(),
            remove: jest.fn(),
            clear: jest.fn(),
        },
        session: {
            get: jest.fn(),
            set: jest.fn(),
            remove: jest.fn(),
            clear: jest.fn(),
        },
        onChanged: {
            addListener: jest.fn(),
            removeListener: jest.fn(),
        },
    },
    webRequest: {
        onBeforeRequest: {
            addListener: jest.fn(),
            removeListener: jest.fn(),
        },
        onBeforeSendHeaders: {
            addListener: jest.fn(),
            removeListener: jest.fn(),
        },
    },
    tabs: {
        query: jest.fn(),
        sendMessage: jest.fn(),
        create: jest.fn(),
    },
    runtime: {
        sendMessage: jest.fn(),
        onMessage: {
            addListener: jest.fn(),
            removeListener: jest.fn(),
        },
        onInstalled: {
            addListener: jest.fn(),
            removeListener: jest.fn(),
        },
        getURL: jest.fn(),
        lastError: null,
    },
    action: {
        setBadgeText: jest.fn(() => Promise.resolve()),
        setBadgeBackgroundColor: jest.fn(() => Promise.resolve()),
    },
    notifications: {
        create: jest.fn(),
        clear: jest.fn(),
        getAll: jest.fn(),
        getPermissionLevel: jest.fn(),
    },
}

// Mock chrome globally
;(global as any).chrome = chromeMock

// Export for use in tests
export { chromeMock }
