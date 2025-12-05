import { authService } from '../../../src/services/authService';
import { sessionService } from '../../../src/services/sessionService';

// Mock Supabase
jest.mock('../../../src/services/supabaseClient', () => ({
    supabase: {
        auth: {
            signUp: jest.fn(),
            signInWithPassword: jest.fn(),
            signOut: jest.fn(),
            getUser: jest.fn(),
        },
        from: jest.fn(() => ({
            select: jest.fn(),
            insert: jest.fn(),
            update: jest.fn(),
            eq: jest.fn(),
            single: jest.fn(),
        })),
    },
}));

// Mock deviceId utility
jest.mock('../../../src/utils/storage', () => ({
    getOrCreateDeviceId: jest.fn().mockResolvedValue('test-device-id'),
}));

// Mock sessionService
jest.mock('../../../src/services/sessionService', () => ({
    sessionService: {
        saveSession: jest.fn(),
        clearSession: jest.fn(),
        getCurrentUser: jest.fn(),
        isAuthenticated: jest.fn(),
    },
}));

describe('AuthService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('register', () => {
        it('should register user successfully', async () => {
            const mockSupabase = require('../../../src/services/supabaseClient').supabase;
            const { getOrCreateDeviceId } = require('../../../src/utils/storage');

            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
            };

            mockSupabase.auth.signUp.mockResolvedValue({
                data: { user: mockUser },
                error: null,
            });

            // Ensure getOrCreateDeviceId returns the expected value
            getOrCreateDeviceId.mockResolvedValue('test-device-id');

            const result = await authService.register('test@example.com', 'password123');

            expect(result).toEqual({
                id: 'user-123',
                email: 'test@example.com',
                deviceId: 'test-device-id',
            });
            expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
                email: 'test@example.com',
                password: 'password123',
            });
        });

        it('should handle registration error', async () => {
            const mockSupabase = require('../../../src/services/supabaseClient').supabase;
            const authError = new Error('Registration failed');

            mockSupabase.auth.signUp.mockResolvedValue({
                data: { user: null },
                error: authError,
            });

            await expect(authService.register('test@example.com', 'password123')).rejects.toThrow(
                'Registration failed',
            );
        });

        it('should return null when no user data', async () => {
            const mockSupabase = require('../../../src/services/supabaseClient').supabase;

            mockSupabase.auth.signUp.mockResolvedValue({
                data: { user: null },
                error: null,
            });

            const result = await authService.register('test@example.com', 'password123');

            expect(result).toBeNull();
        });
    });

    describe('login', () => {
        it('should login user successfully with existing profile', async () => {
            const mockSupabase = require('../../../src/services/supabaseClient').supabase;
            const { getOrCreateDeviceId } = require('../../../src/utils/storage');

            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
            };

            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: { user: mockUser },
                error: null,
            });

            // Ensure getOrCreateDeviceId returns the expected value
            getOrCreateDeviceId.mockResolvedValue('test-device-id');

            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: { device_id: 'test-device-id' },
                            error: null,
                        }),
                    }),
                }),
            });

            const result = await authService.login('test@example.com', 'password123');

            expect(result).toEqual({
                id: 'user-123',
                email: 'test@example.com',
                deviceId: 'test-device-id',
            });
            expect(sessionService.saveSession).toHaveBeenCalledWith(result);
        });

        it('should create profile if not exists', async () => {
            const mockSupabase = require('../../../src/services/supabaseClient').supabase;
            const { getOrCreateDeviceId } = require('../../../src/utils/storage');

            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
            };

            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: { user: mockUser },
                error: null,
            });

            // Ensure getOrCreateDeviceId returns the expected value
            getOrCreateDeviceId.mockResolvedValue('test-device-id');

            // First call returns profile not found error
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: null,
                            error: { code: 'PGRST116' },
                        }),
                    }),
                }),
            });

            // Second call for profile creation
            mockSupabase.from.mockReturnValueOnce({
                insert: jest.fn().mockReturnValue({
                    select: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: { device_id: 'test-device-id' },
                            error: null,
                        }),
                    }),
                }),
            });

            const result = await authService.login('test@example.com', 'password123');

            expect(result).toEqual({
                id: 'user-123',
                email: 'test@example.com',
                deviceId: 'test-device-id',
            });
        });

        it('should throw error on device ID mismatch', async () => {
            const mockSupabase = require('../../../src/services/supabaseClient').supabase;
            const { getOrCreateDeviceId } = require('../../../src/utils/storage');

            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
            };

            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: { user: mockUser },
                error: null,
            });

            // Ensure getOrCreateDeviceId returns a different value
            getOrCreateDeviceId.mockResolvedValue('different-device-id');

            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: { device_id: 'test-device-id' },
                            error: null,
                        }),
                    }),
                }),
            });

            await expect(authService.login('test@example.com', 'password123')).rejects.toThrow(
                'Device ID mismatch',
            );
        });

        it('should handle login error', async () => {
            const mockSupabase = require('../../../src/services/supabaseClient').supabase;
            const authError = new Error('Login failed');

            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: { user: null },
                error: authError,
            });

            await expect(authService.login('test@example.com', 'password123')).rejects.toThrow(
                'Login failed',
            );
        });

        it('should handle profile error that is not PGRST116', async () => {
            const mockSupabase = require('../../../src/services/supabaseClient').supabase;
            const { getOrCreateDeviceId } = require('../../../src/utils/storage');

            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
            };

            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: { user: mockUser },
                error: null,
            });

            getOrCreateDeviceId.mockResolvedValue('test-device-id');

            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: null,
                            error: { code: 'OTHER_ERROR', message: 'Profile error' },
                        }),
                    }),
                }),
            });

            await expect(authService.login('test@example.com', 'password123')).rejects.toEqual({
                code: 'OTHER_ERROR',
                message: 'Profile error',
            });
        });

        it('should update device_id if profile exists but device_id is empty', async () => {
            const mockSupabase = require('../../../src/services/supabaseClient').supabase;
            const { getOrCreateDeviceId } = require('../../../src/utils/storage');

            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
            };

            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: { user: mockUser },
                error: null,
            });

            getOrCreateDeviceId.mockResolvedValue('new-device-id');

            // First call: profile exists but device_id is null
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: { device_id: null },
                            error: null,
                        }),
                    }),
                }),
            });

            // Second call: update device_id
            mockSupabase.from.mockReturnValueOnce({
                update: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({
                        error: null,
                    }),
                }),
            });

            const result = await authService.login('test@example.com', 'password123');

            expect(result).toEqual({
                id: 'user-123',
                email: 'test@example.com',
                deviceId: 'new-device-id',
            });
            expect(sessionService.saveSession).toHaveBeenCalledWith(result);
        });

        it('should handle profile creation with Results contain 0 rows error', async () => {
            const mockSupabase = require('../../../src/services/supabaseClient').supabase;
            const { getOrCreateDeviceId } = require('../../../src/utils/storage');

            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
            };

            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: { user: mockUser },
                error: null,
            });

            getOrCreateDeviceId.mockResolvedValue('test-device-id');

            // First call returns profile not found error with details
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: null,
                            error: { code: 'OTHER', details: 'Results contain 0 rows' },
                        }),
                    }),
                }),
            });

            // Second call for profile creation
            mockSupabase.from.mockReturnValueOnce({
                insert: jest.fn().mockReturnValue({
                    select: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: { device_id: 'test-device-id' },
                            error: null,
                        }),
                    }),
                }),
            });

            const result = await authService.login('test@example.com', 'password123');

            expect(result).toEqual({
                id: 'user-123',
                email: 'test@example.com',
                deviceId: 'test-device-id',
            });
        });
    });

    describe('logout', () => {
        it('should logout user successfully', async () => {
            const mockSupabase = require('../../../src/services/supabaseClient').supabase;

            mockSupabase.auth.signOut.mockResolvedValue({
                error: null,
            });

            await authService.logout();

            expect(mockSupabase.auth.signOut).toHaveBeenCalled();
            expect(sessionService.clearSession).toHaveBeenCalled();
        });

        it('should throw error if logout fails', async () => {
            const mockSupabase = require('../../../src/services/supabaseClient').supabase;
            const logoutError = new Error('Logout failed');

            mockSupabase.auth.signOut.mockResolvedValue({
                error: logoutError,
            });

            await expect(authService.logout()).rejects.toThrow('Logout failed');
            expect(sessionService.clearSession).not.toHaveBeenCalled();
        });
    });

    describe('getCurrentUser', () => {
        it('should return user from local session if available', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
                deviceId: 'test-device-id',
            };

            (sessionService.getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

            const result = await authService.getCurrentUser();

            expect(result).toEqual(mockUser);
            expect(sessionService.getCurrentUser).toHaveBeenCalled();
        });

        it('should return user from Supabase if no local session', async () => {
            const mockSupabase = require('../../../src/services/supabaseClient').supabase;

            (sessionService.getCurrentUser as jest.Mock).mockResolvedValue(null);

            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
            };

            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: mockUser },
                error: null,
            });

            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: { device_id: 'test-device-id' },
                            error: null,
                        }),
                    }),
                }),
            });

            const result = await authService.getCurrentUser();

            expect(result).toEqual({
                id: 'user-123',
                email: 'test@example.com',
                deviceId: 'test-device-id',
            });
            expect(sessionService.saveSession).toHaveBeenCalledWith(result);
        });

        it('should return null if Supabase user fetch fails', async () => {
            const mockSupabase = require('../../../src/services/supabaseClient').supabase;

            (sessionService.getCurrentUser as jest.Mock).mockResolvedValue(null);

            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: null },
                error: new Error('Failed to get user'),
            });

            const result = await authService.getCurrentUser();

            expect(result).toBeNull();
        });

        it('should return null if Supabase user is null', async () => {
            const mockSupabase = require('../../../src/services/supabaseClient').supabase;

            (sessionService.getCurrentUser as jest.Mock).mockResolvedValue(null);

            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: null },
                error: null,
            });

            const result = await authService.getCurrentUser();

            expect(result).toBeNull();
        });

        it('should return null if profile fetch fails', async () => {
            const mockSupabase = require('../../../src/services/supabaseClient').supabase;

            (sessionService.getCurrentUser as jest.Mock).mockResolvedValue(null);

            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
            };

            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: mockUser },
                error: null,
            });

            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: null,
                            error: new Error('Profile error'),
                        }),
                    }),
                }),
            });

            const result = await authService.getCurrentUser();

            expect(result).toBeNull();
        });
    });

    describe('isAuthenticated', () => {
        it('should return authentication status from sessionService', async () => {
            (sessionService.isAuthenticated as jest.Mock).mockResolvedValue(true);

            const result = await authService.isAuthenticated();

            expect(result).toBe(true);
            expect(sessionService.isAuthenticated).toHaveBeenCalled();
        });

        it('should return false when not authenticated', async () => {
            (sessionService.isAuthenticated as jest.Mock).mockResolvedValue(false);

            const result = await authService.isAuthenticated();

            expect(result).toBe(false);
        });
    });

    describe('unbindDevice', () => {
        it('should unbind device successfully', async () => {
            const mockSupabase = require('../../../src/services/supabaseClient').supabase;

            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
            };

            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: { user: mockUser },
                error: null,
            });

            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: { device_id: 'old-device-id' },
                            error: null,
                        }),
                    }),
                }),
                update: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({
                        error: null,
                    }),
                }),
            });

            (global as any).chrome = {
                storage: {
                    local: {
                        remove: jest.fn().mockResolvedValue(undefined),
                    },
                },
            };

            await authService.unbindDevice('test@example.com', 'password123');

            expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
                email: 'test@example.com',
                password: 'password123',
            });
            expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
            expect((global as any).chrome.storage.local.remove).toHaveBeenCalledWith('deviceId');
        });

        it('should throw error if credentials are invalid', async () => {
            const mockSupabase = require('../../../src/services/supabaseClient').supabase;
            const authError = new Error('Invalid credentials');

            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: { user: null },
                error: authError,
            });

            await expect(
                authService.unbindDevice('test@example.com', 'wrong-password'),
            ).rejects.toThrow('Invalid credentials');
        });

        it('should throw error if user data is null', async () => {
            const mockSupabase = require('../../../src/services/supabaseClient').supabase;

            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: { user: null },
                error: null,
            });

            await expect(
                authService.unbindDevice('test@example.com', 'password123'),
            ).rejects.toThrow('Invalid credentials');
        });

        it('should throw error if profile fetch fails', async () => {
            const mockSupabase = require('../../../src/services/supabaseClient').supabase;

            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
            };

            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: { user: mockUser },
                error: null,
            });

            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: null,
                            error: new Error('Profile error'),
                        }),
                    }),
                }),
            });

            await expect(
                authService.unbindDevice('test@example.com', 'password123'),
            ).rejects.toThrow('Profile error');
        });

        it('should throw error if device update fails', async () => {
            const mockSupabase = require('../../../src/services/supabaseClient').supabase;

            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
            };

            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: { user: mockUser },
                error: null,
            });

            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: { device_id: 'old-device-id' },
                            error: null,
                        }),
                    }),
                }),
                update: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({
                        error: new Error('Update error'),
                    }),
                }),
            });

            await expect(
                authService.unbindDevice('test@example.com', 'password123'),
            ).rejects.toThrow('Update error');
        });
    });
});
