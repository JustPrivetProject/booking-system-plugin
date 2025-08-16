import { errorLogService } from '../../../src/services/errorLogService';
import { ErrorType } from '../../../src/data';

// Mock Supabase client
jest.mock('../../../src/services/supabaseClient', () => ({
    supabase: {
        from: jest.fn(() => ({
            insert: jest.fn(),
        })),
    },
}));

// Mock console methods to avoid noise in tests
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeAll(() => {
    console.warn = jest.fn();
    console.error = jest.fn();
});

afterAll(() => {
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
});

describe('ErrorLogService', () => {
    const mockSupabase = require('../../../src/services/supabaseClient').supabase;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('logError', () => {
        it('should log error with string message successfully', async () => {
            const mockInsert = jest.fn().mockResolvedValue({ error: null });
            mockSupabase.from.mockReturnValue({ insert: mockInsert });

            await errorLogService.logError('Test error message', 'test-source');

            expect(mockSupabase.from).toHaveBeenCalledWith('error_logs');
            expect(mockInsert).toHaveBeenCalledWith([
                expect.objectContaining({
                    error_message: 'Test error message',
                    error_stack: undefined,
                    source: 'test-source',
                    additional_data: undefined,
                    created_at: '2024-01-01T12:00:00.000Z',
                }),
            ]);
        });

        it('should log error with Error object successfully', async () => {
            const mockInsert = jest.fn().mockResolvedValue({ error: null });
            mockSupabase.from.mockReturnValue({ insert: mockInsert });

            const testError = new Error('Test error');
            testError.stack = 'Error: Test error\n    at test.js:1:1';

            await errorLogService.logError(testError, 'test-source');

            expect(mockInsert).toHaveBeenCalledWith([
                expect.objectContaining({
                    error_message: 'Test error',
                    error_stack: 'Error: Test error\n    at test.js:1:1',
                    source: 'test-source',
                    additional_data: undefined,
                    created_at: '2024-01-01T12:00:00.000Z',
                }),
            ]);
        });

        it('should log error with additional data', async () => {
            const mockInsert = jest.fn().mockResolvedValue({ error: null });
            mockSupabase.from.mockReturnValue({ insert: mockInsert });

            const additionalData = { userId: '123', action: 'login' };

            await errorLogService.logError('Test error', 'test-source', additionalData);

            expect(mockInsert).toHaveBeenCalledWith([
                expect.objectContaining({
                    error_message: 'Test error',
                    source: 'test-source',
                    additional_data: additionalData,
                }),
            ]);
        });

        it('should handle Supabase error gracefully', async () => {
            const supabaseError = { message: 'Database error' };
            const mockInsert = jest.fn().mockResolvedValue({ error: supabaseError });
            mockSupabase.from.mockReturnValue({ insert: mockInsert });

            await errorLogService.logError('Test error', 'test-source');

            expect(console.warn).toHaveBeenCalledWith(
                'Failed to log error to Supabase:',
                supabaseError,
            );
        });

        it('should handle insertion exception gracefully', async () => {
            const mockInsert = jest.fn().mockRejectedValue(new Error('Network error'));
            mockSupabase.from.mockReturnValue({ insert: mockInsert });

            await errorLogService.logError('Test error', 'test-source');

            expect(console.warn).toHaveBeenCalledWith(
                'Error while logging to Supabase:',
                expect.any(Error),
            );
        });
    });

    describe('logRequestError', () => {
        it('should log request error successfully', async () => {
            const mockInsert = jest.fn().mockResolvedValue({ error: null });
            mockSupabase.from.mockReturnValue({ insert: mockInsert });

            const errorType: ErrorType = ErrorType.NETWORK;
            const message = 'Request failed';
            const url = 'https://api.example.com/endpoint';
            const status = 500;
            const attempt = 3;
            const responseText = 'Internal Server Error';

            await errorLogService.logRequestError(
                errorType,
                message,
                url,
                status,
                attempt,
                responseText,
            );

            expect(mockSupabase.from).toHaveBeenCalledWith('request_error_logs');
            expect(mockInsert).toHaveBeenCalledWith([
                expect.objectContaining({
                    error_message: message,
                    error_type: errorType,
                    http_status: status,
                    url,
                    attempt,
                    response_text: responseText,
                    source: 'fetchRequest',
                    additional_data: undefined,
                    created_at: '2024-01-01T12:00:00.000Z',
                }),
            ]);
        });

        it('should log request error with additional data', async () => {
            const mockInsert = jest.fn().mockResolvedValue({ error: null });
            mockSupabase.from.mockReturnValue({ insert: mockInsert });

            const additionalData = { requestId: 'req-123', timestamp: Date.now() };

            await errorLogService.logRequestError(
                ErrorType.TIMEOUT,
                'Request timeout',
                'https://api.example.com/timeout',
                undefined,
                undefined,
                undefined,
                additionalData,
            );

            expect(mockInsert).toHaveBeenCalledWith([
                expect.objectContaining({
                    error_message: 'Request timeout',
                    error_type: 'TIMEOUT',
                    url: 'https://api.example.com/timeout',
                    source: 'fetchRequest',
                    additional_data: additionalData,
                }),
            ]);
        });

        it('should handle Supabase error gracefully', async () => {
            const supabaseError = { message: 'Database error' };
            const mockInsert = jest.fn().mockResolvedValue({ error: supabaseError });
            mockSupabase.from.mockReturnValue({ insert: mockInsert });

            await errorLogService.logRequestError(
                ErrorType.NETWORK,
                'Request failed',
                'https://api.example.com/endpoint',
            );

            expect(console.warn).toHaveBeenCalledWith(
                'Failed to log request error to Supabase:',
                supabaseError,
            );
        });

        it('should handle insertion exception gracefully', async () => {
            const mockInsert = jest.fn().mockRejectedValue(new Error('Network error'));
            mockSupabase.from.mockReturnValue({ insert: mockInsert });

            await errorLogService.logRequestError(
                ErrorType.NETWORK,
                'Request failed',
                'https://api.example.com/endpoint',
            );

            expect(console.warn).toHaveBeenCalledWith(
                'Error while logging request error to Supabase:',
                expect.any(Error),
            );
        });
    });

    describe('sendLogs', () => {
        it('should send logs successfully with all parameters', async () => {
            const mockInsert = jest.fn().mockResolvedValue({ error: null });
            mockSupabase.from.mockReturnValue({ insert: mockInsert });

            const logs = [{ level: 'info', message: 'Test log' }];
            const userId = 'user-123';
            const description = 'Test log batch';
            const localData = { key: 'value' };

            await errorLogService.sendLogs(logs, userId, description, localData);

            expect(mockSupabase.from).toHaveBeenCalledWith('logs');
            expect(mockInsert).toHaveBeenCalledWith([
                expect.objectContaining({
                    user_id: userId,
                    log: logs,
                    local_storage_data: localData,
                    source: null,
                    description,
                    created_at: '2024-01-01T12:00:00.000Z',
                }),
            ]);
        });

        it('should send logs with minimal parameters', async () => {
            const mockInsert = jest.fn().mockResolvedValue({ error: null });
            mockSupabase.from.mockReturnValue({ insert: mockInsert });

            const logs = [{ level: 'error', message: 'Error log' }];

            await errorLogService.sendLogs(logs);

            expect(mockInsert).toHaveBeenCalledWith([
                expect.objectContaining({
                    user_id: null,
                    log: logs,
                    local_storage_data: null,
                    source: null,
                    description: null,
                    created_at: '2024-01-01T12:00:00.000Z',
                }),
            ]);
        });

        it('should not send logs when logs array is empty', async () => {
            const mockInsert = jest.fn();
            mockSupabase.from.mockReturnValue({ insert: mockInsert });

            await errorLogService.sendLogs([]);

            expect(mockSupabase.from).not.toHaveBeenCalled();
            expect(mockInsert).not.toHaveBeenCalled();
        });

        it('should not send logs when logs is not an array', async () => {
            const mockInsert = jest.fn();
            mockSupabase.from.mockReturnValue({ insert: mockInsert });

            // @ts-expect-error - Testing invalid input
            await errorLogService.sendLogs('not an array');

            expect(mockSupabase.from).not.toHaveBeenCalled();
            expect(mockInsert).not.toHaveBeenCalled();
        });

        it('should handle Supabase error gracefully', async () => {
            const supabaseError = { message: 'Database error' };
            const mockInsert = jest.fn().mockResolvedValue({ error: supabaseError });
            mockSupabase.from.mockReturnValue({ insert: mockInsert });

            const logs = [{ level: 'info', message: 'Test log' }];

            await errorLogService.sendLogs(logs);

            expect(console.warn).toHaveBeenCalledWith(
                'Failed to send logs to Supabase:',
                JSON.stringify(supabaseError, null, 2),
            );
        });

        it('should handle insertion exception gracefully', async () => {
            const mockInsert = jest.fn().mockRejectedValue(new Error('Network error'));
            mockSupabase.from.mockReturnValue({ insert: mockInsert });

            const logs = [{ level: 'info', message: 'Test log' }];

            await errorLogService.sendLogs(logs);

            expect(console.error).toHaveBeenCalledWith(
                'Error while sending logs to Supabase:',
                expect.any(Error),
            );
        });
    });

    describe('Error handling edge cases', () => {
        it('should handle null error stack', async () => {
            const mockInsert = jest.fn().mockResolvedValue({ error: null });
            mockSupabase.from.mockReturnValue({ insert: mockInsert });

            const testError = new Error('Test error');
            testError.stack = null as any;

            await errorLogService.logError(testError, 'test-source');

            expect(mockInsert).toHaveBeenCalledWith([
                expect.objectContaining({
                    error_message: 'Test error',
                    error_stack: null,
                    source: 'test-source',
                }),
            ]);
        });

        it('should handle undefined error stack', async () => {
            const mockInsert = jest.fn().mockResolvedValue({ error: null });
            mockSupabase.from.mockReturnValue({ insert: mockInsert });

            const testError = new Error('Test error');
            testError.stack = undefined;

            await errorLogService.logError(testError, 'test-source');

            expect(mockInsert).toHaveBeenCalledWith([
                expect.objectContaining({
                    error_message: 'Test error',
                    error_stack: undefined,
                    source: 'test-source',
                }),
            ]);
        });

        it('should handle empty string error', async () => {
            const mockInsert = jest.fn().mockResolvedValue({ error: null });
            mockSupabase.from.mockReturnValue({ insert: mockInsert });

            await errorLogService.logError('', 'test-source');

            expect(mockInsert).toHaveBeenCalledWith([
                expect.objectContaining({
                    error_message: '',
                    error_stack: undefined,
                    source: 'test-source',
                }),
            ]);
        });
    });
});
