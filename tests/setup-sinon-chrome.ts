import sinon from 'sinon'
import chrome from 'sinon-chrome'

// Import global mocks
import './mocks/response'
import { createClient, supabaseMock } from './mocks/supabase'
import { chromeMock } from './mocks/chrome'

// Merge sinon-chrome with our custom chrome mock
const mergedChrome = {
    ...chrome,
    ...chromeMock,
    // Ensure sinon-chrome methods take precedence for tracking
    storage: {
        ...chrome.storage,
        ...chromeMock.storage, // Add session storage from our mock
    },
    tabs: {
        ...chrome.tabs,
        ...chromeMock.tabs,
    },
    runtime: {
        ...chrome.runtime,
        ...chromeMock.runtime,
    },
    // Add missing APIs from our mock
    action: {
        ...chromeMock.action,
        setBadgeText: sinon.stub(),
        setBadgeBackgroundColor: sinon.stub(),
    },
    webRequest: {
        ...chrome.webRequest,
        ...chromeMock.webRequest,
    },
}

// Make chrome and sinon available globally
;(global as any).chrome = mergedChrome
;(global as any).sinon = sinon

// Mock Supabase globally
;(global as any).createClient = createClient
;(global as any).supabase = supabaseMock

// Mock fetch globally
;(global as any).fetch = jest.fn()

// Mock localStorage
const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn(),
}
;(global as any).localStorage = localStorageMock

// Mock sessionStorage
const sessionStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn(),
}
;(global as any).sessionStorage = sessionStorageMock

// Store original console for restoration
const originalConsole = { ...console }

// Setup Jest hooks for console mocking and sinon-chrome cleanup
beforeEach(() => {
    // Mock console methods
    console.log = jest.fn()
    console.error = jest.fn()
    console.warn = jest.fn()
    console.info = jest.fn()
})

afterEach(() => {
    // Reset sinon-chrome mocks
    if (typeof (chrome as any).flush === 'function') {
        ;(chrome as any).flush()
    }

    // Restore sinon stubs
    sinon.restore()

    // Reset chrome runtime error
    if ((global as any).chrome && (global as any).chrome.runtime) {
        ;(global as any).chrome.runtime.lastError = null
    }

    // Restore original console methods
    console.log = originalConsole.log
    console.error = originalConsole.error
    console.warn = originalConsole.warn
    console.info = originalConsole.info
})
