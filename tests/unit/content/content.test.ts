/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';

const mockShowCountdownModal = jest.fn();
const mockShowSessionExpireModal = jest.fn();
const mockWaitElementAndSendChromeMessage = jest.fn();
const mockParseTable = jest.fn(() => []);
const mockWaitForElement = jest.fn();
const mockIsUserAuthenticated = jest.fn<() => Promise<boolean>>();
const mockTryClickLoginButton = jest.fn();
const mockIsAppUnauthorized = jest.fn<() => Promise<boolean>>();
const mockSendActionToBackground = jest.fn();
const mockIsAutoLoginEnabled = jest.fn<() => Promise<boolean>>();
const mockCheckConnectionAndShowWarning = jest.fn<() => Promise<boolean>>();
const mockConsoleLog = jest.fn();
const mockConsoleError = jest.fn();

jest.mock('../../../src/utils', () => ({
    consoleLog: (...args: unknown[]) => mockConsoleLog(...args),
    consoleError: (...args: unknown[]) => mockConsoleError(...args),
}));

jest.mock('../../../src/content/modals/countdownModal', () => ({
    showCountdownModal: () => mockShowCountdownModal(),
}));

jest.mock('../../../src/content/modals/sesssionExpireModal', () => ({
    showSessionExpireModal: () => mockShowSessionExpireModal(),
}));

jest.mock('../../../src/content/utils/contentUtils', () => ({
    waitElementAndSendChromeMessage: (...args: unknown[]) =>
        mockWaitElementAndSendChromeMessage(...args),
    parseTable: () => mockParseTable(),
    waitForElement: (...args: unknown[]) => mockWaitForElement(...args),
    isUserAuthenticated: () => mockIsUserAuthenticated(),
    tryClickLoginButton: () => mockTryClickLoginButton(),
    isAppUnauthorized: () => mockIsAppUnauthorized(),
    sendActionToBackground: (...args: unknown[]) => mockSendActionToBackground(...args),
    isAutoLoginEnabled: () => mockIsAutoLoginEnabled(),
    checkConnectionAndShowWarning: () => mockCheckConnectionAndShowWarning(),
}));

describe('content bootstrap', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        jest.useFakeTimers();

        mockCheckConnectionAndShowWarning.mockResolvedValue(true);
        mockIsUserAuthenticated.mockResolvedValue(true);
        mockIsAutoLoginEnabled.mockResolvedValue(true);
        mockIsAppUnauthorized.mockResolvedValue(true);

        window.history.pushState({}, '', '/');
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    async function loadContentModule(): Promise<void> {
        await import('../../../src/content/content');
        window.dispatchEvent(new Event('load'));
        await Promise.resolve();
        await Promise.resolve();
    }

    it('does not try auto-login when auto-login is disabled', async () => {
        mockIsAutoLoginEnabled.mockResolvedValue(false);
        window.history.pushState({}, '', '/login');

        await loadContentModule();

        expect(mockIsUserAuthenticated).toHaveBeenCalled();
        expect(mockIsAutoLoginEnabled).toHaveBeenCalled();
        expect(mockIsAppUnauthorized).not.toHaveBeenCalled();
        expect(mockTryClickLoginButton).not.toHaveBeenCalled();
    });

    it('shows countdown on home page when unauthorized and auto-login is enabled', async () => {
        await loadContentModule();

        expect(mockShowCountdownModal).toHaveBeenCalled();
        expect(mockTryClickLoginButton).not.toHaveBeenCalled();
    });

    it('tries auto-login on login page when unauthorized and auto-login is enabled', async () => {
        window.history.pushState({}, '', '/login');

        await loadContentModule();
        jest.advanceTimersByTime(1000);

        expect(mockTryClickLoginButton).toHaveBeenCalled();
        expect(mockShowCountdownModal).not.toHaveBeenCalled();
    });

    it('shows session-expire modal on interval even when auto-login is disabled', async () => {
        mockIsAutoLoginEnabled.mockResolvedValue(false);
        mockIsAppUnauthorized.mockResolvedValue(true);

        await loadContentModule();
        await jest.advanceTimersByTimeAsync(65000);

        expect(mockShowSessionExpireModal).toHaveBeenCalled();
    });
});
