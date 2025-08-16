import { getSlots, getEditForm, getDriverNameAndContainer } from '../../src/services/baltichub';
import { authService } from '../../src/services/authService';
import { sessionService } from '../../src/services/sessionService';
import { RetryObject } from '../../src/types/baltichub';

// Mock all external dependencies
jest.mock('../../src/services/supabaseClient', () => ({
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
}));

// Mock deviceId utility
jest.mock('../../src/utils/storage', () => ({
    getOrCreateDeviceId: jest.fn().mockResolvedValue('test-device-id'),
}));

jest.mock('../../src/utils', () => ({
    fetchRequest: jest.fn(),
    consoleLog: jest.fn(),
    consoleLogWithoutSave: jest.fn(),
    formatDateToDMY: jest.fn(),
    normalizeFormData: jest.fn(),
    JSONstringify: jest.fn(obj => JSON.stringify(obj)),
    setStorage: jest.fn(),
    getStorage: jest.fn(),
    getOrCreateDeviceId: jest.fn(),
}));

// Helper function to create mock Response objects
function createMockResponse(ok: boolean, data?: any, status: number = 200) {
    if (ok) {
        return new (global as any).Response(JSON.stringify(data), {
            status,
            statusText: 'OK',
        });
    } else {
        return {
            ok: false,
            error: data,
        };
    }
}

// Helper function to create mock HTML Response objects
function createMockHtmlResponse(ok: boolean, htmlContent: string, status: number = 200) {
    if (ok) {
        return new (global as any).Response(htmlContent, {
            status,
            statusText: 'OK',
            headers: {
                'content-type': 'text/html',
            },
        });
    } else {
        return {
            ok: false,
            error: { message: 'HTML Error' },
        };
    }
}

jest.mock('../../src/utils/baltichub.helper', () => ({
    parseSlotsIntoButtons: jest.fn(),
    handleErrorResponse: jest.fn(),
    isTaskCompletedInAnotherQueue: jest.fn(),
}));

jest.mock('../../src/services/sessionService', () => ({
    sessionService: {
        saveSession: jest.fn(),
        clearSession: jest.fn(),
    },
}));

describe('Baltichub Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Complete Booking Flow', () => {
        it('should handle complete booking process with authentication', async () => {
            // Setup mocks
            const { fetchRequest } = require('../../src/utils');
            const mockSupabase = require('../../src/services/supabaseClient').supabase;
            const { getOrCreateDeviceId } = require('../../src/utils');

            // Ensure getOrCreateDeviceId returns the expected value
            getOrCreateDeviceId.mockResolvedValue('test-device-id');

            // Mock authentication
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
                            data: { device_id: 'test-device-id' },
                            error: null,
                        }),
                    }),
                }),
            });

            // Mock API responses
            const mockSlotsResponse = createMockResponse(true, '<div>Available slots</div>');
            const mockEditFormResponse = createMockHtmlResponse(
                true,
                `
          <select id="SelectedDriver">
            <option selected="selected">John Doe</option>
          </select>
          <script>"ContainerId":"MSNU2991953"</script>
        `,
            );

            fetchRequest
                .mockResolvedValueOnce(mockSlotsResponse) // getSlots
                .mockResolvedValueOnce(mockEditFormResponse); // getEditForm

            // Execute booking flow
            const authResult = await authService.login('test@example.com', 'password123');
            expect(authResult).toBeTruthy();

            const slotsResult = await getSlots('25.12.2024');
            expect(slotsResult.ok).toBe(true);

            const driverInfo = await getDriverNameAndContainer('tv-app-123', []);
            expect(driverInfo.driverName).toBe('John Doe');
            expect(driverInfo.containerNumber).toBe('MSNU2991953');
        });

        it('should handle authentication failure and retry', async () => {
            const { fetchRequest } = require('../../src/utils');
            const mockSupabase = require('../../src/services/supabaseClient').supabase;
            const { getOrCreateDeviceId } = require('../../src/utils/storage');

            // Ensure getOrCreateDeviceId returns the expected value
            getOrCreateDeviceId.mockResolvedValue('test-device-id');

            // First login attempt fails
            mockSupabase.auth.signInWithPassword
                .mockResolvedValueOnce({
                    data: { user: null },
                    error: new Error('Invalid credentials'),
                })
                .mockResolvedValueOnce({
                    data: {
                        user: { id: 'user-123', email: 'test@example.com' },
                    },
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

            // First attempt should fail
            await expect(authService.login('test@example.com', 'wrong-password')).rejects.toThrow(
                'Invalid credentials',
            );

            // Second attempt should succeed
            const result = await authService.login('test@example.com', 'correct-password');
            expect(result).toBeTruthy();
        });

        it('should handle network errors and retry mechanism', async () => {
            const { fetchRequest } = require('../../src/utils');
            const mockSupabase = require('../../src/services/supabaseClient').supabase;
            const { getOrCreateDeviceId } = require('../../src/utils/storage');

            // Ensure getOrCreateDeviceId returns the expected value
            getOrCreateDeviceId.mockResolvedValue('test-device-id');

            // Mock successful authentication
            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: { user: { id: 'user-123', email: 'test@example.com' } },
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

            // Mock successful API response
            fetchRequest.mockResolvedValue(createMockResponse(true, 'slots data'));

            // Call the function
            const result = await getSlots('25.12.2024');

            // Then check the results
            expect(result.ok).toBe(true);
            expect(fetchRequest).toHaveBeenCalledTimes(1);
        });
    });

    describe('Session Management Integration', () => {
        it('should maintain session across multiple API calls', async () => {
            const { fetchRequest } = require('../../src/utils');
            const mockSupabase = require('../../src/services/supabaseClient').supabase;
            const { getOrCreateDeviceId } = require('../../src/utils/storage');

            // Ensure getOrCreateDeviceId returns the expected value
            getOrCreateDeviceId.mockResolvedValue('test-device-id');

            // Mock authentication
            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: { user: { id: 'user-123', email: 'test@example.com' } },
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

            // Mock API responses
            fetchRequest.mockResolvedValue(createMockResponse(true, 'response data'));

            // Login first
            const authResult = await authService.login('test@example.com', 'password123');
            expect(authResult).toBeTruthy();

            // Make multiple API calls
            const slots1 = await getSlots('25.12.2024');
            const slots2 = await getSlots('26.12.2024');
            const editForm = await getEditForm('tv-app-123');

            expect(slots1.ok).toBe(true);
            expect(slots2.ok).toBe(true);
            expect(editForm.ok).toBe(true);
        });
    });

    describe('Error Handling Integration', () => {
        it('should handle cascading errors gracefully', async () => {
            const { fetchRequest } = require('../../src/utils');
            const mockSupabase = require('../../src/services/supabaseClient').supabase;
            const { getOrCreateDeviceId } = require('../../src/utils/storage');

            // Ensure getOrCreateDeviceId returns the expected value
            getOrCreateDeviceId.mockResolvedValue('test-device-id');

            // Mock authentication
            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: { user: { id: 'user-123', email: 'test@example.com' } },
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

            // Mock API failure
            fetchRequest.mockResolvedValue(createMockResponse(false, { message: 'API Error' }));

            // Login should succeed
            const authResult = await authService.login('test@example.com', 'password123');
            expect(authResult).toBeTruthy();

            // API call should fail gracefully
            const result = await getDriverNameAndContainer('tv-app-123', []);
            expect(result.driverName).toBe('');
            expect(result.containerNumber).toBe('');
        });
    });
});
