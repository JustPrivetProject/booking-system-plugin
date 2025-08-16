import { QueueManagerFactory } from '../../../src/services/queueManagerFactory';
import type { QueueConfig, QueueEvents } from '../../../src/types/queue';

// Mock QueueManager
jest.mock('../../../src/services/queueManager', () => ({
    QueueManager: jest.fn(),
}));

// Mock authService
jest.mock('../../../src/services/authService', () => ({
    authService: {
        isAuthenticated: jest.fn(),
    },
}));

describe('QueueManagerFactory', () => {
    const mockQueueManager = require('../../../src/services/queueManager').QueueManager;
    const mockAuthService = require('../../../src/services/authService').authService;

    const testConfig: Partial<QueueConfig> = {
        storageKey: 'testQueue',
        enableLogging: true,
        retryDelay: 1000,
        batchSize: 10,
    };

    const testEvents: QueueEvents = {
        onItemAdded: jest.fn(),
        onItemRemoved: jest.fn(),
        onItemUpdated: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockQueueManager.mockImplementation(() => ({
            addToQueue: jest.fn(),
            removeFromQueue: jest.fn(),
            updateQueueItem: jest.fn(),
            getQueue: jest.fn(),
            updateEntireQueue: jest.fn(),
            startProcessing: jest.fn(),
            stopProcessing: jest.fn(),
            getProcessingState: jest.fn(),
            getStatistics: jest.fn(),
        }));
    });

    describe('create', () => {
        it('should create QueueManager with default configuration', () => {
            const queueManager = QueueManagerFactory.create();

            expect(mockQueueManager).toHaveBeenCalledWith(
                expect.objectContaining({
                    isAuthenticated: expect.any(Function),
                }),
                {},
                {},
            );
            expect(queueManager).toBeInstanceOf(Object);
        });

        it('should create QueueManager with custom configuration', () => {
            const queueManager = QueueManagerFactory.create(testConfig);

            expect(mockQueueManager).toHaveBeenCalledWith(
                expect.objectContaining({
                    isAuthenticated: expect.any(Function),
                }),
                testConfig,
                {},
            );
            expect(queueManager).toBeInstanceOf(Object);
        });

        it('should create QueueManager with custom events', () => {
            const queueManager = QueueManagerFactory.create({}, testEvents);

            expect(mockQueueManager).toHaveBeenCalledWith(
                expect.objectContaining({
                    isAuthenticated: expect.any(Function),
                }),
                {},
                testEvents,
            );
            expect(queueManager).toBeInstanceOf(Object);
        });

        it('should create QueueManager with both custom config and events', () => {
            const queueManager = QueueManagerFactory.create(testConfig, testEvents);

            expect(mockQueueManager).toHaveBeenCalledWith(
                expect.objectContaining({
                    isAuthenticated: expect.any(Function),
                }),
                testConfig,
                testEvents,
            );
            expect(queueManager).toBeInstanceOf(Object);
        });

        it('should create auth service adapter that calls authService.isAuthenticated', async () => {
            mockAuthService.isAuthenticated.mockResolvedValue(true);

            QueueManagerFactory.create();
            const authServiceAdapter = mockQueueManager.mock.calls[0][0];

            const result = await authServiceAdapter.isAuthenticated();

            expect(result).toBe(true);
            expect(mockAuthService.isAuthenticated).toHaveBeenCalled();
        });

        it('should handle auth service errors gracefully', async () => {
            const authError = new Error('Auth service error');
            mockAuthService.isAuthenticated.mockRejectedValue(authError);

            QueueManagerFactory.create();
            const authServiceAdapter = mockQueueManager.mock.calls[0][0];

            await expect(authServiceAdapter.isAuthenticated()).rejects.toThrow(
                'Auth service error',
            );
            expect(mockAuthService.isAuthenticated).toHaveBeenCalled();
        });

        it('should create unique instances for different configurations', () => {
            QueueManagerFactory.create({ storageKey: 'queue1' });
            QueueManagerFactory.create({ storageKey: 'queue2' });

            expect(mockQueueManager).toHaveBeenCalledTimes(2);
            expect(mockQueueManager.mock.calls[0][1]).toEqual({ storageKey: 'queue1' });
            expect(mockQueueManager.mock.calls[1][1]).toEqual({ storageKey: 'queue2' });
        });
    });

    describe('createForTesting', () => {
        const mockTestAuthService = {
            isAuthenticated: jest.fn(),
        };

        it('should create QueueManager with provided auth service for testing', () => {
            const queueManager = QueueManagerFactory.createForTesting(mockTestAuthService);

            expect(mockQueueManager).toHaveBeenCalledWith(mockTestAuthService, {}, {});
            expect(queueManager).toBeInstanceOf(Object);
        });

        it('should create QueueManager with custom configuration for testing', () => {
            const queueManager = QueueManagerFactory.createForTesting(
                mockTestAuthService,
                testConfig,
            );

            expect(mockQueueManager).toHaveBeenCalledWith(mockTestAuthService, testConfig, {});
            expect(queueManager).toBeInstanceOf(Object);
        });

        it('should create QueueManager with custom events for testing', () => {
            const queueManager = QueueManagerFactory.createForTesting(
                mockTestAuthService,
                {},
                testEvents,
            );

            expect(mockQueueManager).toHaveBeenCalledWith(mockTestAuthService, {}, testEvents);
            expect(queueManager).toBeInstanceOf(Object);
        });

        it('should create QueueManager with both custom config and events for testing', () => {
            const queueManager = QueueManagerFactory.createForTesting(
                mockTestAuthService,
                testConfig,
                testEvents,
            );

            expect(mockQueueManager).toHaveBeenCalledWith(
                mockTestAuthService,
                testConfig,
                testEvents,
            );
            expect(queueManager).toBeInstanceOf(Object);
        });

        it('should use provided auth service instead of creating adapter', () => {
            mockTestAuthService.isAuthenticated.mockResolvedValue(false);

            QueueManagerFactory.createForTesting(mockTestAuthService);
            const authServiceUsed = mockQueueManager.mock.calls[0][0];

            expect(authServiceUsed).toBe(mockTestAuthService);
            // The provided auth service should have the isAuthenticated function
            expect(typeof authServiceUsed.isAuthenticated).toBe('function');
        });
    });

    describe('Configuration handling', () => {
        it('should handle empty configuration object', () => {
            QueueManagerFactory.create({});

            expect(mockQueueManager).toHaveBeenCalledWith(
                expect.objectContaining({
                    isAuthenticated: expect.any(Function),
                }),
                {},
                {},
            );
        });

        it('should handle null configuration', () => {
            const _queueManager = QueueManagerFactory.create(null as any);

            expect(mockQueueManager).toHaveBeenCalledWith(
                expect.objectContaining({
                    isAuthenticated: expect.any(Function),
                }),
                null,
                {},
            );
        });

        it('should handle undefined configuration', () => {
            const _queueManager = QueueManagerFactory.create(undefined as any);

            expect(mockQueueManager).toHaveBeenCalledWith(
                expect.objectContaining({
                    isAuthenticated: expect.any(Function),
                }),
                {},
                {},
            );
        });

        it('should handle partial configuration with only some properties', () => {
            const partialConfig = { storageKey: 'partialQueue' };
            const _queueManager = QueueManagerFactory.create(partialConfig);

            expect(mockQueueManager).toHaveBeenCalledWith(
                expect.objectContaining({
                    isAuthenticated: expect.any(Function),
                }),
                partialConfig,
                {},
            );
        });
    });

    describe('Events handling', () => {
        it('should handle empty events object', () => {
            QueueManagerFactory.create({}, {});

            expect(mockQueueManager).toHaveBeenCalledWith(
                expect.objectContaining({
                    isAuthenticated: expect.any(Function),
                }),
                {},
                {},
            );
        });

        it('should handle null events', () => {
            QueueManagerFactory.create({}, null as any);

            expect(mockQueueManager).toHaveBeenCalledWith(
                expect.objectContaining({
                    isAuthenticated: expect.any(Function),
                }),
                {},
                null,
            );
        });

        it('should handle undefined events', () => {
            QueueManagerFactory.create({}, undefined as any);

            expect(mockQueueManager).toHaveBeenCalledWith(
                expect.objectContaining({
                    isAuthenticated: expect.any(Function),
                }),
                {},
                {},
            );
        });

        it('should handle partial events with only some callbacks', () => {
            const partialEvents = { onItemAdded: jest.fn() };
            QueueManagerFactory.create({}, partialEvents);

            expect(mockQueueManager).toHaveBeenCalledWith(
                expect.objectContaining({
                    isAuthenticated: expect.any(Function),
                }),
                {},
                partialEvents,
            );
        });
    });

    describe('Auth service adapter behavior', () => {
        it('should create adapter that properly forwards authentication calls', async () => {
            mockAuthService.isAuthenticated.mockResolvedValue(true);

            QueueManagerFactory.create();
            const authServiceAdapter = mockQueueManager.mock.calls[0][0];

            const result1 = await authServiceAdapter.isAuthenticated();
            const result2 = await authServiceAdapter.isAuthenticated();

            expect(result1).toBe(true);
            expect(result2).toBe(true);
            expect(mockAuthService.isAuthenticated).toHaveBeenCalledTimes(2);
        });

        it('should handle multiple authentication calls correctly', async () => {
            mockAuthService.isAuthenticated
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(true);

            QueueManagerFactory.create();
            const authServiceAdapter = mockQueueManager.mock.calls[0][0];

            const results = await Promise.all([
                authServiceAdapter.isAuthenticated(),
                authServiceAdapter.isAuthenticated(),
                authServiceAdapter.isAuthenticated(),
            ]);

            expect(results).toEqual([true, false, true]);
            expect(mockAuthService.isAuthenticated).toHaveBeenCalledTimes(3);
        });

        it('should propagate authentication errors correctly', async () => {
            const authError = new Error('Authentication failed');
            mockAuthService.isAuthenticated.mockRejectedValue(authError);

            QueueManagerFactory.create();
            const authServiceAdapter = mockQueueManager.mock.calls[0][0];

            await expect(authServiceAdapter.isAuthenticated()).rejects.toThrow(
                'Authentication failed',
            );
            expect(mockAuthService.isAuthenticated).toHaveBeenCalled();
        });
    });

    describe('Factory method consistency', () => {
        it('should create consistent QueueManager instances with same parameters', () => {
            QueueManagerFactory.create(testConfig, testEvents);
            QueueManagerFactory.create(testConfig, testEvents);

            expect(mockQueueManager).toHaveBeenCalledTimes(2);
            expect(mockQueueManager.mock.calls[0][1]).toEqual(testConfig);
            expect(mockQueueManager.mock.calls[0][2]).toEqual(testEvents);
            expect(mockQueueManager.mock.calls[1][1]).toEqual(testConfig);
            expect(mockQueueManager.mock.calls[1][2]).toEqual(testEvents);
        });

        it('should create different QueueManager instances for different parameters', () => {
            const config1 = { storageKey: 'queue1' };
            const config2 = { storageKey: 'queue2' };
            const events1 = { onItemAdded: jest.fn() };
            const events2 = { onItemRemoved: jest.fn() };

            QueueManagerFactory.create(config1, events1);
            QueueManagerFactory.create(config2, events2);

            expect(mockQueueManager).toHaveBeenCalledTimes(2);
            expect(mockQueueManager.mock.calls[0][1]).toEqual(config1);
            expect(mockQueueManager.mock.calls[0][2]).toEqual(events1);
            expect(mockQueueManager.mock.calls[1][1]).toEqual(config2);
            expect(mockQueueManager.mock.calls[1][2]).toEqual(events2);
        });
    });
});
