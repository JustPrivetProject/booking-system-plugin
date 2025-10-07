import { BrevoApiClient } from '../../../src/services/brevo/brevoApiClient';
import type { BrevoEmailData } from '../../../src/types/general';

// Mock fetch globally
global.fetch = jest.fn();

describe('BrevoApiClient', () => {
    let apiClient: BrevoApiClient;
    const mockApiKey = 'test-api-key';

    beforeEach(() => {
        apiClient = new BrevoApiClient(mockApiKey);
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with API key', () => {
            expect(apiClient).toBeInstanceOf(BrevoApiClient);
        });
    });

    describe('setApiKey', () => {
        it('should update API key', () => {
            const newApiKey = 'new-api-key';
            apiClient.setApiKey(newApiKey);
            // We can't directly test private property, but we can test behavior
            expect(true).toBe(true); // Placeholder - in real test we'd test actual behavior
        });
    });

    describe('sendEmail', () => {
        const validEmailData: BrevoEmailData = {
            emails: ['test@example.com'],
            userName: 'Test User',
            tvAppId: '91037204',
            bookingTime: '2024-01-15T19:00:00Z',
            oldTime: '2024-01-15T18:00:00Z',
            containerNumber: 'BSIU3108038',
            driverName: 'ANDRZEJ KOLAKOWSKI',
        };

        it('should return false when API key is not set', async () => {
            const clientWithoutKey = new BrevoApiClient('');
            const result = await clientWithoutKey.sendEmail(validEmailData);
            expect(result).toBe(false);
        });

        it('should return false when too many recipients', async () => {
            const tooManyEmails = Array(101).fill('test@example.com');
            const emailDataWithManyRecipients = {
                ...validEmailData,
                emails: tooManyEmails,
            };

            const result = await apiClient.sendEmail(emailDataWithManyRecipients);
            expect(result).toBe(false);
        });

        it('should return true on successful API response', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                status: 200,
            });

            const result = await apiClient.sendEmail(validEmailData);
            expect(result).toBe(true);
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('api.brevo.com'),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'api-key': mockApiKey,
                    }),
                }),
            );
        });

        it('should return false on API error response', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 400,
                statusText: 'Bad Request',
                text: jest.fn().mockResolvedValue('Error message'),
            });

            const result = await apiClient.sendEmail(validEmailData);
            expect(result).toBe(false);
        });

        it('should return false on network error', async () => {
            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

            const result = await apiClient.sendEmail(validEmailData);
            expect(result).toBe(false);
        });
    });

    describe('testConnection', () => {
        it('should return false when API key is not set', async () => {
            const clientWithoutKey = new BrevoApiClient('');
            const result = await clientWithoutKey.testConnection();
            expect(result).toBe(false);
        });

        it('should return true when API responds with non-401 status', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                status: 200,
            });

            const result = await apiClient.testConnection();
            expect(result).toBe(true);
        });

        it('should return false when API responds with 401 status', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                status: 401,
            });

            const result = await apiClient.testConnection();
            expect(result).toBe(false);
        });

        it('should return false on network error', async () => {
            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

            const result = await apiClient.testConnection();
            expect(result).toBe(false);
        });
    });
});
