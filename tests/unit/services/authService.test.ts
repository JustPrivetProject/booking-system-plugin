import { authService } from '../../../src/services/authService'
import { sessionService } from '../../../src/services/sessionService'

// Mock Supabase
jest.mock('../../../src/services/supabaseClient', () => ({
    supabase: {
        auth: {
            signUp: jest.fn(),
            signInWithPassword: jest.fn(),
        },
        from: jest.fn(() => ({
            select: jest.fn(),
            insert: jest.fn(),
            update: jest.fn(),
            eq: jest.fn(),
            single: jest.fn(),
        })),
    },
}))

// Mock deviceId utility
jest.mock('../../../src/utils/storage', () => ({
    getOrCreateDeviceId: jest.fn().mockResolvedValue('test-device-id'),
}))

// Mock sessionService
jest.mock('../../../src/services/sessionService', () => ({
    sessionService: {
        saveSession: jest.fn(),
    },
}))

describe('AuthService', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('register', () => {
        it('should register user successfully', async () => {
            const mockSupabase =
                require('../../../src/services/supabaseClient').supabase
            const {
                getOrCreateDeviceId,
            } = require('../../../src/utils/storage')

            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
            }

            mockSupabase.auth.signUp.mockResolvedValue({
                data: { user: mockUser },
                error: null,
            })

            // Ensure getOrCreateDeviceId returns the expected value
            getOrCreateDeviceId.mockResolvedValue('test-device-id')

            const result = await authService.register(
                'test@example.com',
                'password123'
            )

            expect(result).toEqual({
                id: 'user-123',
                email: 'test@example.com',
                deviceId: 'test-device-id',
            })
            expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
                email: 'test@example.com',
                password: 'password123',
            })
        })

        it('should handle registration error', async () => {
            const mockSupabase =
                require('../../../src/services/supabaseClient').supabase
            const authError = new Error('Registration failed')

            mockSupabase.auth.signUp.mockResolvedValue({
                data: { user: null },
                error: authError,
            })

            await expect(
                authService.register('test@example.com', 'password123')
            ).rejects.toThrow('Registration failed')
        })

        it('should return null when no user data', async () => {
            const mockSupabase =
                require('../../../src/services/supabaseClient').supabase

            mockSupabase.auth.signUp.mockResolvedValue({
                data: { user: null },
                error: null,
            })

            const result = await authService.register(
                'test@example.com',
                'password123'
            )

            expect(result).toBeNull()
        })
    })

    describe('login', () => {
        it('should login user successfully with existing profile', async () => {
            const mockSupabase =
                require('../../../src/services/supabaseClient').supabase
            const {
                getOrCreateDeviceId,
            } = require('../../../src/utils/storage')

            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
            }

            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: { user: mockUser },
                error: null,
            })

            // Ensure getOrCreateDeviceId returns the expected value
            getOrCreateDeviceId.mockResolvedValue('test-device-id')

            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: { device_id: 'test-device-id' },
                            error: null,
                        }),
                    }),
                }),
            })

            const result = await authService.login(
                'test@example.com',
                'password123'
            )

            expect(result).toEqual({
                id: 'user-123',
                email: 'test@example.com',
                deviceId: 'test-device-id',
            })
            expect(sessionService.saveSession).toHaveBeenCalledWith(result)
        })

        it('should create profile if not exists', async () => {
            const mockSupabase =
                require('../../../src/services/supabaseClient').supabase
            const {
                getOrCreateDeviceId,
            } = require('../../../src/utils/storage')

            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
            }

            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: { user: mockUser },
                error: null,
            })

            // Ensure getOrCreateDeviceId returns the expected value
            getOrCreateDeviceId.mockResolvedValue('test-device-id')

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
            })

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
            })

            const result = await authService.login(
                'test@example.com',
                'password123'
            )

            expect(result).toEqual({
                id: 'user-123',
                email: 'test@example.com',
                deviceId: 'test-device-id',
            })
        })

        it('should throw error on device ID mismatch', async () => {
            const mockSupabase =
                require('../../../src/services/supabaseClient').supabase
            const {
                getOrCreateDeviceId,
            } = require('../../../src/utils/storage')

            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
            }

            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: { user: mockUser },
                error: null,
            })

            // Ensure getOrCreateDeviceId returns a different value
            getOrCreateDeviceId.mockResolvedValue('different-device-id')

            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: { device_id: 'test-device-id' },
                            error: null,
                        }),
                    }),
                }),
            })

            await expect(
                authService.login('test@example.com', 'password123')
            ).rejects.toThrow('Device ID mismatch')
        })

        it('should handle login error', async () => {
            const mockSupabase =
                require('../../../src/services/supabaseClient').supabase
            const authError = new Error('Login failed')

            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: { user: null },
                error: authError,
            })

            await expect(
                authService.login('test@example.com', 'password123')
            ).rejects.toThrow('Login failed')
        })
    })
})
