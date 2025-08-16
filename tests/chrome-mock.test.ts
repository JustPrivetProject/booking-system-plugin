// Test Chrome Extension API mocks
describe('Chrome Extension API Mocks', () => {
    it('should have chrome global available', () => {
        expect((global as any).chrome).toBeDefined()
    })

    it('should have chrome.storage available', () => {
        expect((global as any).chrome.storage).toBeDefined()
        expect((global as any).chrome.storage.local).toBeDefined()
        expect((global as any).chrome.storage.session).toBeDefined()
    })

    it('should have chrome.webRequest available', () => {
        expect((global as any).chrome.webRequest).toBeDefined()
        expect((global as any).chrome.webRequest.onBeforeRequest).toBeDefined()
        expect(
            (global as any).chrome.webRequest.onBeforeSendHeaders
        ).toBeDefined()
    })

    it('should have chrome.tabs available', () => {
        expect((global as any).chrome.tabs).toBeDefined()
        expect((global as any).chrome.tabs.query).toBeDefined()
        expect((global as any).chrome.tabs.sendMessage).toBeDefined()
    })

    it('should have chrome.runtime available', () => {
        expect((global as any).chrome.runtime).toBeDefined()
        expect((global as any).chrome.runtime.sendMessage).toBeDefined()
        expect((global as any).chrome.runtime.onMessage).toBeDefined()
    })

    it('should have chrome.action available', () => {
        expect((global as any).chrome.action).toBeDefined()
        expect((global as any).chrome.action.setBadgeText).toBeDefined()
        expect(
            (global as any).chrome.action.setBadgeBackgroundColor
        ).toBeDefined()
    })
})
