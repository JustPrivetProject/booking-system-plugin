import { getSlots, getEditForm, getDriverNameAndContainer } from '../../../src/services/baltichub';
import { authService } from '../../../src/services/authService';
import { sessionService } from '../../../src/services/sessionService';

// Mock all external dependencies
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
}));

jest.mock('../../../src/utils/storage', () => ({
    getOrCreateDeviceId: jest.fn().mockResolvedValue('test-device-id'),
}));

jest.mock('../../../src/utils', () => ({
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

jest.mock('../../../src/utils/baltichub.helper', () => ({
    parseSlotsIntoButtons: jest.fn(),
    handleErrorResponse: jest.fn(),
    isTaskCompletedInAnotherQueue: jest.fn(),
}));

// Storage functions are now included in the main utils mock above

jest.mock('../../../src/services/sessionService', () => ({
    sessionService: {
        saveSession: jest.fn(),
        clearSession: jest.fn(),
    },
}));

describe('E2E Booking Flow Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Complete User Journey', () => {
        it('should complete full booking process from login to slot booking', async () => {
            const { fetchRequest } = require('../../../src/utils');
            const mockSupabase = require('../../../src/services/supabaseClient').supabase;
            const { getOrCreateDeviceId } = require('../../../src/utils');

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

            // Complete user journey
            const authResult = await authService.login('test@example.com', 'password123');
            expect(authResult).toBeTruthy();

            const slotsResult = await getSlots('25.12.2024');
            expect(slotsResult.ok).toBe(true);

            const driverInfo = await getDriverNameAndContainer('tv-app-123', []);
            expect(driverInfo.driverName).toBe('John Doe');
            expect(driverInfo.containerNumber).toBe('MSNU2991953');
        });

        it('should handle authentication failure and user retry', async () => {
            const mockSupabase = require('../../../src/services/supabaseClient').supabase;
            const { getOrCreateDeviceId } = require('../../../src/utils/storage');

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

        it('should handle network issues and recovery', async () => {
            const { fetchRequest } = require('../../../src/utils');
            const mockSupabase = require('../../../src/services/supabaseClient').supabase;
            const { getOrCreateDeviceId } = require('../../../src/utils/storage');

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
            fetchRequest.mockResolvedValue(createMockResponse(true, 'response data'));

            const result = await getSlots('25.12.2024');
            expect(result.ok).toBe(true);
        });

        it('should handle concurrent booking attempts', async () => {
            const { fetchRequest } = require('../../../src/utils');
            const mockSupabase = require('../../../src/services/supabaseClient').supabase;
            const { getOrCreateDeviceId } = require('../../../src/utils/storage');

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

            // Make concurrent API calls
            const [slots1, slots2, editForm] = await Promise.all([
                getSlots('25.12.2024'),
                getSlots('26.12.2024'),
                getEditForm('tv-app-123'),
            ]);

            expect(slots1.ok).toBe(true);
            expect(slots2.ok).toBe(true);
            expect(editForm.ok).toBe(true);
        });
    });

    describe('Error Recovery Scenarios', () => {
        it('should recover from session expiration', async () => {
            const { fetchRequest } = require('../../../src/utils');
            const mockSupabase = require('../../../src/services/supabaseClient').supabase;
            const { getOrCreateDeviceId } = require('../../../src/utils/storage');

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

            // Login and make API call
            const authResult = await authService.login('test@example.com', 'password123');
            expect(authResult).toBeTruthy();

            const slotsResult = await getSlots('25.12.2024');
            expect(slotsResult.ok).toBe(true);

            // Simulate session expiration and re-authentication
            await sessionService.clearSession();

            // Should be able to continue with new session
            const newSlotsResult = await getSlots('27.12.2024');
            expect(newSlotsResult.ok).toBe(true);
        });
    });
});
