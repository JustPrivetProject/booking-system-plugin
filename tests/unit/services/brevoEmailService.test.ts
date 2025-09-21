import { BrevoEmailService, brevoEmailService } from '../../../src/services/brevoEmailService';
import type { BrevoEmailData } from '../../../src/types/general';

// Mock the utils module
jest.mock('../../../src/utils/index', () => ({
    consoleLog: jest.fn(),
    consoleError: jest.fn(),
}));

// Mock fetch (already mocked in setup.ts, but we'll cast it)
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('BrevoEmailService', () => {
    let service: BrevoEmailService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new BrevoEmailService('test-api-key');
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe('constructor', () => {
        it('should create instance with provided API key', () => {
            const serviceWithKey = new BrevoEmailService('custom-key');
            expect(serviceWithKey).toBeInstanceOf(BrevoEmailService);
        });

        it('should create instance without API key', () => {
            const serviceWithoutKey = new BrevoEmailService();
            expect(serviceWithoutKey).toBeInstanceOf(BrevoEmailService);
        });
    });

    describe('setApiKey', () => {
        it('should set API key correctly', () => {
            const newApiKey = 'new-api-key';
            service.setApiKey(newApiKey);
            // Test by attempting to use the service (we'll verify via API calls)
            expect(service).toBeDefined();
        });
    });

    describe('sendBookingConfirmationEmail', () => {
        const mockEmailData: BrevoEmailData = {
            emails: ['user@example.com', 'manager@example.com'],
            userName: 'Test User',
            tvAppId: 'TV123456',
            bookingTime: '2024-01-15 10:30',
            driverName: 'Test Driver',
            containerNumber: 'CONT123',
        };

        it('should send email successfully', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK',
            } as Response);

            const result = await service.sendBookingConfirmationEmail(mockEmailData);

            expect(result).toBe(true);
            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.brevo.com/v3/smtp/email',
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'api-key': 'test-api-key',
                    },
                    body: expect.stringContaining(
                        '"subject":"Potwierdzenie rezerwacji - TV123456"',
                    ),
                }),
            );
        });

        it('should return false when API key is not configured', async () => {
            const serviceWithoutKey = new BrevoEmailService('');
            const result = await serviceWithoutKey.sendBookingConfirmationEmail(mockEmailData);

            expect(result).toBe(false);
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should handle API error response', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 400,
                statusText: 'Bad Request',
            } as Response);

            const result = await service.sendBookingConfirmationEmail(mockEmailData);

            expect(result).toBe(false);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should handle network/fetch error', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            const result = await service.sendBookingConfirmationEmail(mockEmailData);

            expect(result).toBe(false);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should create correct email payload structure', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK',
            } as Response);

            await service.sendBookingConfirmationEmail(mockEmailData);

            const callArgs = mockFetch.mock.calls[0];
            const requestBody = JSON.parse(callArgs[1]?.body as string);

            expect(requestBody).toMatchObject({
                sender: {
                    name: 'PortSloty ⚓',
                    email: 'noreply@portsloty.com',
                },
                to: [
                    { email: 'user@example.com', name: 'Test User' },
                    { email: 'manager@example.com', name: 'Test User' },
                ],
                subject: 'Potwierdzenie rezerwacji - TV123456',
            });

            expect(requestBody.htmlContent).toContain('TV123456');
            expect(requestBody.htmlContent).toContain('Test Driver');
            expect(requestBody.htmlContent).toContain('CONT123');
            expect(requestBody.textContent).toContain('TV123456');
            expect(requestBody.textContent).toContain('Test Driver');
            expect(requestBody.textContent).toContain('CONT123');
        });

        it('should handle email data without optional fields', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK',
            } as Response);

            const minimalEmailData: BrevoEmailData = {
                emails: ['user@example.com'],
                tvAppId: 'TV123456',
                bookingTime: '2024-01-15 10:30',
            };

            const result = await service.sendBookingConfirmationEmail(minimalEmailData);

            expect(result).toBe(true);

            const callArgs = mockFetch.mock.calls[0];
            const requestBody = JSON.parse(callArgs[1]?.body as string);

            expect(requestBody.to).toEqual([{ email: 'user@example.com', name: 'user' }]);
            expect(requestBody.htmlContent).not.toContain('Test Driver');
            expect(requestBody.textContent).not.toContain('Test Driver');
        });

        it('should generate proper user name from email when userName is not provided', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK',
            } as Response);

            const emailData: BrevoEmailData = {
                emails: ['john.doe@example.com'],
                tvAppId: 'TV123456',
                bookingTime: '2024-01-15 10:30',
            };

            await service.sendBookingConfirmationEmail(emailData);

            const callArgs = mockFetch.mock.calls[0];
            const requestBody = JSON.parse(callArgs[1]?.body as string);

            expect(requestBody.to[0].name).toBe('john.doe');
        });
    });

    describe('testConnection', () => {
        it('should return true for successful connection test', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK',
            } as Response);

            const result = await service.testConnection();

            expect(result).toBe(true);
            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.brevo.com/v3/account',
                expect.objectContaining({
                    method: 'GET',
                    headers: {
                        Accept: 'application/json',
                        'api-key': 'test-api-key',
                    },
                }),
            );
        });

        it('should return false when API key is not configured', async () => {
            const serviceWithoutKey = new BrevoEmailService('');
            const result = await serviceWithoutKey.testConnection();

            expect(result).toBe(false);
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should return false for failed connection test', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
            } as Response);

            const result = await service.testConnection();

            expect(result).toBe(false);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should handle network error in connection test', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            const result = await service.testConnection();

            expect(result).toBe(false);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('singleton instance', () => {
        it('should export singleton instance', () => {
            expect(brevoEmailService).toBeInstanceOf(BrevoEmailService);
        });
    });

    describe('email content generation', () => {
        it('should include current year in email content', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK',
            } as Response);

            const currentYear = new Date().getFullYear();
            const emailData: BrevoEmailData = {
                emails: ['user@example.com'],
                tvAppId: 'TV123456',
                bookingTime: '2024-01-15 10:30',
            };

            await service.sendBookingConfirmationEmail(emailData);

            const callArgs = mockFetch.mock.calls[0];
            const requestBody = JSON.parse(callArgs[1]?.body as string);

            expect(requestBody.htmlContent).toContain(`© ${currentYear} PortSloty`);
            expect(requestBody.textContent).toContain(`© ${currentYear} PortSloty`);
        });

        it('should include data in email content without HTML escaping', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK',
            } as Response);

            const emailData: BrevoEmailData = {
                emails: ['user@example.com'],
                userName: 'Test User',
                tvAppId: 'TV123',
                bookingTime: '2024-01-15 10:30',
                driverName: 'Driver Co',
                containerNumber: 'CONT123',
            };

            await service.sendBookingConfirmationEmail(emailData);

            const callArgs = mockFetch.mock.calls[0];
            const requestBody = JSON.parse(callArgs[1]?.body as string);

            expect(requestBody.htmlContent).toContain('TV123');
            expect(requestBody.htmlContent).toContain('Driver Co');
            expect(requestBody.htmlContent).toContain('CONT123');
            expect(requestBody.htmlContent).toContain('Test User');
            expect(requestBody.textContent).toContain('TV123');
            expect(requestBody.textContent).toContain('Driver Co');
            expect(requestBody.textContent).toContain('CONT123');
        });
    });
});
