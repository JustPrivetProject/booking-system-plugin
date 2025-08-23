// Mock Supabase client before importing logging
jest.mock('../../../src/services/supabaseClient', () => ({
    supabase: {
        from: jest.fn(() => ({
            insert: jest.fn(),
        })),
    },
}));

// Mock errorLogService
jest.mock('../../../src/services/errorLogService', () => ({
    errorLogService: {
        logError: jest.fn(),
        logRequestError: jest.fn(),
    },
}));

import {
    consoleLog,
    consoleLogWithoutSave,
    consoleError,
    saveLogToSession,
    getLogsFromSession,
    clearLogsInSession,
} from '../../../src/utils/logging';

// Mock chrome storage
const chromeMock = require('../mocks/chrome').chromeMock;

// Mock LOGS_LENGTH
jest.mock('../../../src/data', () => ({
    LOGS_LENGTH: 100,
}));

describe('Logging Functions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        chromeMock.storage.session.get.mockClear();
        chromeMock.storage.session.set.mockClear();

        // Reset environment
        delete process.env.NODE_ENV;
    });

    describe('consoleLog', () => {
        it('should log with timestamp in development mode', () => {
            process.env.NODE_ENV = 'development';
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            consoleLog('test message');

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[JustPrivetProject]:'),
                expect.any(String),
                expect.any(String),
                'test message',
            );

            consoleSpy.mockRestore();
        });

        it('should not log to console in production mode', () => {
            process.env.NODE_ENV = 'production';
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            consoleLog('test message');

            expect(consoleSpy).not.toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should save log to session storage', async () => {
            chromeMock.storage.session.get.mockImplementation((keys, callback) => {
                callback({ bramaLogs: [] });
            });

            chromeMock.storage.session.set.mockImplementation((data, callback) => {
                callback();
            });

            await consoleLog('test message');

            expect(chromeMock.storage.session.get).toHaveBeenCalledWith(
                { bramaLogs: [] },
                expect.any(Function),
            );
        });
    });

    describe('consoleLogWithoutSave', () => {
        it('should log without saving to storage', () => {
            process.env.NODE_ENV = 'development';
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            consoleLogWithoutSave('test message');

            expect(consoleSpy).toHaveBeenCalled();
            expect(chromeMock.storage.session.get).not.toHaveBeenCalled();

            consoleSpy.mockRestore();
        });
    });

    describe('consoleError', () => {
        it('should log error with timestamp', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            consoleError('error message');

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[JustPrivetProject]'),
                expect.any(String),
                expect.any(String),
                expect.any(String),
                'error message',
            );

            consoleSpy.mockRestore();
        });

        it('should save error to session storage', async () => {
            chromeMock.storage.session.get.mockImplementation((keys, callback) => {
                callback({ bramaLogs: [] });
            });

            chromeMock.storage.session.set.mockImplementation((data, callback) => {
                callback();
            });

            await consoleError('error message');

            expect(chromeMock.storage.session.get).toHaveBeenCalledWith(
                { bramaLogs: [] },
                expect.any(Function),
            );
        });

        it('should log to Supabase in development mode', async () => {
            process.env.NODE_ENV = 'development';
            const { errorLogService } = require('../../../src/services/errorLogService');

            chromeMock.storage.session.get.mockImplementation((keys, callback) => {
                callback({ bramaLogs: [] });
            });

            chromeMock.storage.session.set.mockImplementation((data, callback) => {
                callback();
            });

            await consoleError('error message');

            expect(errorLogService.logError).toHaveBeenCalledWith('error message', 'background', {
                args: ['error message'],
            });
        });

        it('should not log to Supabase in production mode', async () => {
            process.env.NODE_ENV = 'production';
            const { errorLogService } = require('../../../src/services/errorLogService');

            chromeMock.storage.session.get.mockImplementation((keys, callback) => {
                callback({ bramaLogs: [] });
            });

            chromeMock.storage.session.set.mockImplementation((data, callback) => {
                callback();
            });

            await consoleError('error message');

            expect(errorLogService.logError).not.toHaveBeenCalled();
        });
    });

    describe('saveLogToSession', () => {
        it('should save log entry to session storage', async () => {
            const existingLogs = [
                {
                    type: 'log',
                    message: 'old log',
                    timestamp: '2023-01-01T00:00:00.000Z',
                },
            ];

            chromeMock.storage.session.get.mockImplementation((keys, callback) => {
                callback({ bramaLogs: existingLogs });
            });

            chromeMock.storage.session.set.mockImplementation((data, callback) => {
                callback();
            });

            await saveLogToSession('log', ['test message']);

            expect(chromeMock.storage.session.set).toHaveBeenCalledWith(
                {
                    bramaLogs: expect.arrayContaining([
                        ...existingLogs,
                        expect.objectContaining({
                            type: 'log',
                            message: 'test message',
                            timestamp: expect.any(String),
                        }),
                    ]),
                },
                expect.any(Function),
            );
        });

        it('should limit logs to LOGS_LENGTH', async () => {
            const { LOGS_LENGTH } = require('../../../src/data');
            const existingLogs = Array.from({ length: LOGS_LENGTH + 5 }, (_, i) => ({
                type: 'log',
                message: `log ${i}`,
                timestamp: '2023-01-01T00:00:00.000Z',
            }));

            chromeMock.storage.session.get.mockImplementation((keys, callback) => {
                callback({ bramaLogs: existingLogs });
            });

            chromeMock.storage.session.set.mockImplementation((data, callback) => {
                callback();
            });

            await saveLogToSession('log', ['new message']);

            expect(chromeMock.storage.session.set).toHaveBeenCalledWith(
                {
                    bramaLogs: expect.arrayContaining([
                        expect.objectContaining({
                            type: 'log',
                            message: 'new message',
                        }),
                    ]),
                },
                expect.any(Function),
            );

            const savedLogs = chromeMock.storage.session.set.mock.calls[0][0].bramaLogs;
            expect(savedLogs.length).toBeLessThanOrEqual(LOGS_LENGTH);
        });
    });

    describe('getLogsFromSession', () => {
        it('should retrieve logs from session storage', async () => {
            const mockLogs = [
                {
                    type: 'log',
                    message: 'test log',
                    timestamp: '2023-01-01T00:00:00.000Z',
                },
            ];

            chromeMock.storage.session.get.mockImplementation((keys, callback) => {
                callback({ bramaLogs: mockLogs });
            });

            const result = await getLogsFromSession();

            expect(result).toEqual(mockLogs);
            expect(chromeMock.storage.session.get).toHaveBeenCalledWith(
                { bramaLogs: [] },
                expect.any(Function),
            );
        });
    });

    describe('clearLogsInSession', () => {
        it('should clear logs from session storage', async () => {
            chromeMock.storage.session.set.mockImplementation((data, callback) => {
                callback();
            });

            await clearLogsInSession();

            expect(chromeMock.storage.session.set).toHaveBeenCalledWith(
                { bramaLogs: [] },
                expect.any(Function),
            );
        });
    });
});
