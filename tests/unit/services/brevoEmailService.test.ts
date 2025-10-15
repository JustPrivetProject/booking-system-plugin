import { BrevoEmailService } from '../../../src/services/brevo/brevoEmailService';
import { BrevoApiClient } from '../../../src/services/brevo/brevoApiClient';
import type { BrevoEmailData } from '../../../src/types/general';

// Mock the API client
jest.mock('../../../src/services/brevo/brevoApiClient');
const MockedBrevoApiClient = BrevoApiClient as jest.MockedClass<typeof BrevoApiClient>;

describe('BrevoEmailService', () => {
    let emailService: BrevoEmailService;
    let mockApiClient: jest.Mocked<BrevoApiClient>;

    beforeEach(() => {
        // Create mock instance
        mockApiClient = {
            setApiKey: jest.fn(),
            sendEmail: jest.fn(),
            testConnection: jest.fn(),
        } as any;

        // Mock constructor to return our mock
        MockedBrevoApiClient.mockImplementation(() => mockApiClient);

        emailService = new BrevoEmailService('test-api-key');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with API key', () => {
            expect(MockedBrevoApiClient).toHaveBeenCalledWith('test-api-key');
        });

        it('should initialize without API key', () => {
            // Clear previous calls
            MockedBrevoApiClient.mockClear();

            // Create service without API key
            new BrevoEmailService();

            expect(MockedBrevoApiClient).toHaveBeenCalledWith('');
        });
    });

    describe('setApiKey', () => {
        it('should delegate to API client', () => {
            const newApiKey = 'new-api-key';
            emailService.setApiKey(newApiKey);
            expect(mockApiClient.setApiKey).toHaveBeenCalledWith(newApiKey);
        });
    });

    describe('sendBookingConfirmationEmail', () => {
        const validEmailData: BrevoEmailData = {
            emails: ['test@example.com'],
            userName: 'Test User',
            tvAppId: '91037204',
            bookingTime: '2024-01-15T19:00:00Z',
            containerNumber: 'BSIU3108038',
            driverName: 'ANDRZEJ KOLAKOWSKI',
        };

        it('should return true on successful email sending', async () => {
            mockApiClient.sendEmail.mockResolvedValue(true);

            const result = await emailService.sendBookingConfirmationEmail(validEmailData);

            expect(result).toBe(true);
            expect(mockApiClient.sendEmail).toHaveBeenCalledWith(validEmailData);
        });

        it('should return false on failed email sending', async () => {
            mockApiClient.sendEmail.mockResolvedValue(false);

            const result = await emailService.sendBookingConfirmationEmail(validEmailData);

            expect(result).toBe(false);
            expect(mockApiClient.sendEmail).toHaveBeenCalledWith(validEmailData);
        });

        it('should return false for invalid email data', async () => {
            const invalidEmailData = {
                ...validEmailData,
                emails: [], // Empty emails array
            };

            const result = await emailService.sendBookingConfirmationEmail(invalidEmailData);

            expect(result).toBe(false);
            expect(mockApiClient.sendEmail).not.toHaveBeenCalled();
        });

        it('should return false when API client throws error', async () => {
            mockApiClient.sendEmail.mockRejectedValue(new Error('API Error'));

            const result = await emailService.sendBookingConfirmationEmail(validEmailData);

            expect(result).toBe(false);
        });

        it('should validate email addresses format', async () => {
            const invalidEmailData = {
                ...validEmailData,
                emails: ['invalid-email'], // Invalid email format
            };

            const result = await emailService.sendBookingConfirmationEmail(invalidEmailData);

            expect(result).toBe(false);
            expect(mockApiClient.sendEmail).not.toHaveBeenCalled();
        });
    });

    describe('testConnection', () => {
        it('should return true on successful connection test', async () => {
            mockApiClient.testConnection.mockResolvedValue(true);

            const result = await emailService.testConnection();

            expect(result).toBe(true);
            expect(mockApiClient.testConnection).toHaveBeenCalled();
        });

        it('should return false on failed connection test', async () => {
            mockApiClient.testConnection.mockResolvedValue(false);

            const result = await emailService.testConnection();

            expect(result).toBe(false);
            expect(mockApiClient.testConnection).toHaveBeenCalled();
        });

        it('should return false when API client throws error', async () => {
            mockApiClient.testConnection.mockRejectedValue(new Error('Connection Error'));

            const result = await emailService.testConnection();

            expect(result).toBe(false);
        });
    });

    describe('getStatus', () => {
        it('should return service status', () => {
            const status = emailService.getStatus();

            expect(status).toEqual({
                hasApiKey: false, // Mock doesn't have apiKey property set
                senderEmail: 'noreply@portsloty.com',
                senderName: 'PortSloty ⚓',
                apiUrl: 'https://api.brevo.com/v3/smtp/email',
            });
        });
    });
});
