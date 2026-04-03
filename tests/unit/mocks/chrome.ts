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
            setAccessLevel: jest.fn(() => Promise.resolve()),
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
        onCompleted: {
            addListener: jest.fn(),
            removeListener: jest.fn(),
        },
        onErrorOccurred: {
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
        getManifest: jest.fn(() => ({ version: '3.0.2' })),
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
    alarms: {
        create: jest.fn(() => Promise.resolve()),
        clear: jest.fn(() => Promise.resolve()),
        clearAll: jest.fn(() => Promise.resolve()),
        get: jest.fn(() => Promise.resolve([])),
        getAll: jest.fn(() => Promise.resolve([])),
        onAlarm: {
            addListener: jest.fn(),
            removeListener: jest.fn(),
        },
    },
};

// Mock chrome globally
(global as any).chrome = chromeMock;

// Export for use in tests
export { chromeMock };
