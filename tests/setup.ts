// Global test setup

// Import global mocks
import './mocks/response'
import { createClient, supabaseMock } from './mocks/supabase'
import { chromeMock } from './mocks/chrome'

// Mock Supabase globally
;(global as any).createClient = createClient
;(global as any).supabase = supabaseMock

// Mock Chrome globally
;(global as any).chrome = chromeMock

// Mock console methods
const originalConsole = { ...console }
beforeEach(() => {
    console.log = jest.fn()
    console.error = jest.fn()
    console.warn = jest.fn()
    console.info = jest.fn()
})

afterEach(() => {
    console.log = originalConsole.log
    console.error = originalConsole.error
    console.warn = originalConsole.warn
    console.info = originalConsole.info
})

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
