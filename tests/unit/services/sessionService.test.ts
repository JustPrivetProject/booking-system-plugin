import { sessionService, SessionData } from '../../../src/services/sessionService';
import type { AuthUser } from '../../../src/services/authService';

// Mock Chrome storage API
const mockChromeStorage = {
    local: {
        set: jest.fn(),
        get: jest.fn(),
        remove: jest.fn(),
    },
};

// Mock chrome global
global.chrome = {
    storage: mockChromeStorage,
} as any;

describe('SessionService', () => {
    const testUser: AuthUser = {
        id: 'user-123',
        email: 'test@example.com',
        deviceId: 'device-123',
    };

    const mockSessionData: SessionData = {
        user: testUser,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours from now
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('saveSession', () => {
        it('should save session with user data and expiration', async () => {
            mockChromeStorage.local.set.mockResolvedValue(undefined);

            await sessionService.saveSession(testUser);

            expect(mockChromeStorage.local.set).toHaveBeenCalledWith({
                user_session: expect.objectContaining({
                    user: testUser,
                    expiresAt: expect.any(Number),
                }),
            });

            // Verify expiration is set to 24 hours from now
            const savedData = mockChromeStorage.local.set.mock.calls[0][0].user_session;
            const expectedExpiration = Date.now() + 24 * 60 * 60 * 1000;
            expect(savedData.expiresAt).toBe(expectedExpiration);
        });

        it('should handle storage error gracefully', async () => {
            mockChromeStorage.local.set.mockRejectedValue(new Error('Storage error'));

            await expect(sessionService.saveSession(testUser)).rejects.toThrow('Storage error');
        });
    });

    describe('getSession', () => {
        it('should return session data when valid session exists', async () => {
            mockChromeStorage.local.get.mockResolvedValue({
                user_session: mockSessionData,
            });

            const result = await sessionService.getSession();

            expect(result).toEqual(mockSessionData);
            expect(mockChromeStorage.local.get).toHaveBeenCalledWith('user_session');
        });

        it('should return null when no session exists', async () => {
            mockChromeStorage.local.get.mockResolvedValue({});

            const result = await sessionService.getSession();

            expect(result).toBeNull();
        });

        it('should return null when session is undefined', async () => {
            mockChromeStorage.local.get.mockResolvedValue({
                user_session: undefined,
            });

            const result = await sessionService.getSession();

            expect(result).toBeNull();
        });

        it('should clear and return null when session is expired', async () => {
            const expiredSessionData: SessionData = {
                user: testUser,
                expiresAt: Date.now() - 1000, // Expired 1 second ago
            };

            mockChromeStorage.local.get.mockResolvedValue({
                user_session: expiredSessionData,
            });
            mockChromeStorage.local.remove.mockResolvedValue(undefined);

            const result = await sessionService.getSession();

            expect(result).toBeNull();
            expect(mockChromeStorage.local.remove).toHaveBeenCalledWith('user_session');
        });

        it('should handle storage error gracefully', async () => {
            mockChromeStorage.local.get.mockRejectedValue(new Error('Storage error'));

            await expect(sessionService.getSession()).rejects.toThrow('Storage error');
        });
    });

    describe('clearSession', () => {
        it('should remove session from storage', async () => {
            mockChromeStorage.local.remove.mockResolvedValue(undefined);

            await sessionService.clearSession();

            expect(mockChromeStorage.local.remove).toHaveBeenCalledWith('user_session');
        });

        it('should handle storage error gracefully', async () => {
            mockChromeStorage.local.remove.mockRejectedValue(new Error('Storage error'));

            await expect(sessionService.clearSession()).rejects.toThrow('Storage error');
        });
    });

    describe('isAuthenticated', () => {
        it('should return true when valid session exists', async () => {
            mockChromeStorage.local.get.mockResolvedValue({
                user_session: mockSessionData,
            });

            const result = await sessionService.isAuthenticated();

            expect(result).toBe(true);
        });

        it('should return false when no session exists', async () => {
            mockChromeStorage.local.get.mockResolvedValue({});

            const result = await sessionService.isAuthenticated();

            expect(result).toBe(false);
        });

        it('should return false when session is expired', async () => {
            const expiredSessionData: SessionData = {
                user: testUser,
                expiresAt: Date.now() - 1000, // Expired 1 second ago
            };

            mockChromeStorage.local.get.mockResolvedValue({
                user_session: expiredSessionData,
            });
            mockChromeStorage.local.remove.mockResolvedValue(undefined);

            const result = await sessionService.isAuthenticated();

            expect(result).toBe(false);
            expect(mockChromeStorage.local.remove).toHaveBeenCalledWith('user_session');
        });

        it('should handle storage error gracefully', async () => {
            mockChromeStorage.local.get.mockRejectedValue(new Error('Storage error'));

            await expect(sessionService.isAuthenticated()).rejects.toThrow('Storage error');
        });
    });

    describe('getCurrentUser', () => {
        it('should return user when valid session exists', async () => {
            mockChromeStorage.local.get.mockResolvedValue({
                user_session: mockSessionData,
            });

            const result = await sessionService.getCurrentUser();

            expect(result).toEqual(testUser);
        });

        it('should return null when no session exists', async () => {
            mockChromeStorage.local.get.mockResolvedValue({});

            const result = await sessionService.getCurrentUser();

            expect(result).toBeNull();
        });

        it('should return null when session is expired', async () => {
            const expiredSessionData: SessionData = {
                user: testUser,
                expiresAt: Date.now() - 1000, // Expired 1 second ago
            };

            mockChromeStorage.local.get.mockResolvedValue({
                user_session: expiredSessionData,
            });
            mockChromeStorage.local.remove.mockResolvedValue(undefined);

            const result = await sessionService.getCurrentUser();

            expect(result).toBeNull();
        });

        it('should return null when session exists but has no user', async () => {
            const sessionWithoutUser: SessionData = {
                user: null as any,
                expiresAt: Date.now() + 24 * 60 * 60 * 1000,
            };

            mockChromeStorage.local.get.mockResolvedValue({
                user_session: sessionWithoutUser,
            });

            const result = await sessionService.getCurrentUser();

            expect(result).toBeNull();
        });

        it('should handle storage error gracefully', async () => {
            mockChromeStorage.local.get.mockRejectedValue(new Error('Storage error'));

            await expect(sessionService.getCurrentUser()).rejects.toThrow('Storage error');
        });
    });

    describe('Session expiration edge cases', () => {
        it('should handle session expiring exactly at current time', async () => {
            const exactlyExpiredSession: SessionData = {
                user: testUser,
                expiresAt: Date.now() - 1, // Expires 1ms ago
            };

            mockChromeStorage.local.get.mockResolvedValue({
                user_session: exactlyExpiredSession,
            });
            mockChromeStorage.local.remove.mockResolvedValue(undefined);

            const result = await sessionService.getSession();

            expect(result).toBeNull();
            expect(mockChromeStorage.local.remove).toHaveBeenCalledWith('user_session');
        });

        it('should handle session expiring in the future', async () => {
            const futureSession: SessionData = {
                user: testUser,
                expiresAt: Date.now() + 1000, // Expires in 1 second
            };

            mockChromeStorage.local.get.mockResolvedValue({
                user_session: futureSession,
            });

            const result = await sessionService.getSession();

            expect(result).toEqual(futureSession);
            expect(mockChromeStorage.local.remove).not.toHaveBeenCalled();
        });
    });

    describe('Storage interaction patterns', () => {
        it('should use correct storage key consistently', async () => {
            mockChromeStorage.local.set.mockResolvedValue(undefined);
            mockChromeStorage.local.get.mockResolvedValue({});
            mockChromeStorage.local.remove.mockResolvedValue(undefined);

            await sessionService.saveSession(testUser);
            await sessionService.getSession();
            await sessionService.clearSession();

            expect(mockChromeStorage.local.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    user_session: expect.any(Object),
                }),
            );
            expect(mockChromeStorage.local.get).toHaveBeenCalledWith('user_session');
            expect(mockChromeStorage.local.remove).toHaveBeenCalledWith('user_session');
        });

        it('should handle multiple rapid calls correctly', async () => {
            mockChromeStorage.local.get.mockResolvedValue({
                user_session: mockSessionData,
            });

            // Make multiple rapid calls
            const promises = [
                sessionService.getSession(),
                sessionService.isAuthenticated(),
                sessionService.getCurrentUser(),
            ];

            const results = await Promise.all(promises);

            expect(results[0]).toEqual(mockSessionData);
            expect(results[1]).toBe(true);
            expect(results[2]).toEqual(testUser);
            expect(mockChromeStorage.local.get).toHaveBeenCalledTimes(3);
        });
    });
});
