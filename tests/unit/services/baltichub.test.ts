import {
    getSlots,
    getEditForm,
    getDriverNameAndContainer,
    checkSlotAvailability,
    executeRequest,
    validateRequestBeforeSlotCheck,
} from '../../../src/services/baltichub';
import { RetryObject } from '../../../src/types/baltichub';
import { Statuses, ErrorType } from '../../../src/data';
import { notificationService } from '../../../src/services/notificationService';

// Test Data Constants Pattern
const TEST_DATES = {
    VALID: '25.12.2024',
    INVALID: 'invalid-date',
} as const;

const TEST_TV_APP_IDS = {
    VALID: 'tv-app-123',
    INVALID: '',
} as const;

// Helper function to create dynamic test data
function createTestRetryObjects() {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
    const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Yesterday

    const formatDate = (date: Date) => {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    };

    const formatDateTime = (date: Date) => {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${day}.${month}.${year} ${hours}:${minutes}:00`;
    };

    const formatSlotTime = (date: Date) => {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    };

    return {
        VALID: {
            id: 'test-1',
            tvAppId: 'tv-app-123',
            currentSlot: formatSlotTime(futureDate),
            startSlot: formatDateTime(futureDate),
            endSlot: formatDateTime(new Date(futureDate.getTime() + 2 * 60 * 60 * 1000)), // +2 hours
            status: 'paused',
            status_message: 'Zadanie jest wstrzymane',
            timestamp: Date.now(),
            url: 'https://example.com',
            body: {
                formData: {
                    TvAppId: ['tv-app-123'],
                    SlotStart: [`${formatDate(futureDate)} 10:00`],
                    SlotEnd: [
                        `${formatDate(new Date(futureDate.getTime() + 2 * 60 * 60 * 1000))} 00:59:00`,
                    ],
                },
            },
            headersCache: [],
        } as RetryObject,
        EXPIRED_END_TIME: {
            id: 'test-2',
            tvAppId: 'tv-app-124',
            currentSlot: formatSlotTime(futureDate),
            startSlot: formatDateTime(futureDate),
            endSlot: formatDateTime(pastDate), // Past date
            status: 'paused',
            status_message: 'Zadanie jest wstrzymane',
            timestamp: Date.now(),
            url: 'https://example.com',
            body: {
                formData: {
                    TvAppId: ['tv-app-124'],
                    SlotStart: [`${formatDate(futureDate)} 10:00`],
                    SlotEnd: [`${formatDate(pastDate)} 00:59:00`], // Past date
                },
            },
            headersCache: [],
        } as RetryObject,
        EXPIRED_CURRENT_SLOT: {
            id: 'test-3',
            tvAppId: 'tv-app-125',
            currentSlot: formatSlotTime(pastDate), // Past date
            startSlot: formatDateTime(futureDate),
            endSlot: formatDateTime(new Date(futureDate.getTime() + 2 * 60 * 60 * 1000)),
            status: 'paused',
            status_message: 'Zadanie jest wstrzymane',
            timestamp: Date.now(),
            url: 'https://example.com',
            body: {
                formData: {
                    TvAppId: ['tv-app-125'],
                    SlotStart: [`${formatDate(futureDate)} 10:00`],
                    SlotEnd: [
                        `${formatDate(new Date(futureDate.getTime() + 2 * 60 * 60 * 1000))} 00:59:00`,
                    ],
                },
            },
            headersCache: [],
        } as RetryObject,
    };
}

const TEST_RETRY_OBJECTS = createTestRetryObjects();

const TEST_RESPONSES = {
    SUCCESS: { ok: true, data: 'success data' },
    ERROR_401: {
        ok: false,
        error: {
            type: ErrorType.CLIENT_ERROR,
            status: 401,
            message: 'Unauthorized',
        },
    },
    ERROR_SERVER: {
        ok: false,
        error: {
            type: ErrorType.SERVER_ERROR,
            message: 'Server error',
        },
    },
    ERROR_HTML: {
        ok: false,
        error: {
            type: ErrorType.HTML_ERROR,
            message: 'HTML error',
        },
    },
    ERROR_NETWORK: {
        ok: false,
        error: {
            type: ErrorType.NETWORK,
            message: 'Network error',
        },
    },
    ERROR_UNKNOWN: {
        ok: false,
        error: {
            type: 'UNKNOWN_TYPE',
            message: 'Unknown error',
        },
    },
} as const;

const TEST_HTML_RESPONSES = {
    WITH_DRIVER: `
        <select id="SelectedDriver">
            <option selected="selected">John Doe</option>
        </select>
        <script>"ContainerId":"MSNU2991953"</script>
        <input id="SlotStart" name="SlotStart" type="hidden" value="13.10.2025 13:15:00" />
    `,
    WITHOUT_DRIVER: `
        <select id="SelectedDriver">
            <option>John Doe</option>
        </select>
    `,
    EMPTY: '',
    WITH_SLOTS: '<html><button text="10:00" disabled="false"></button></html>',
    WITHOUT_SLOTS: '<html><button text="10:00" disabled="true"></button></html>',
} as const;

// Mock utils functions
jest.mock('../../../src/utils', () => ({
    fetchRequest: jest.fn(),
    consoleLog: jest.fn(),
    consoleLogWithoutSave: jest.fn(),
    consoleError: jest.fn(),
    formatDateToDMY: jest.fn(),
    JSONstringify: jest.fn(obj => JSON.stringify(obj)),
    normalizeFormData: jest.fn(),
    createFormData: jest.fn(),
    parseDateTimeFromDMY: jest.fn(),
    setStorage: jest.fn(),
    ErrorType: {
        NETWORK: 'NETWORK',
        SERVER_ERROR: 'SERVER_ERROR',
        CLIENT_ERROR: 'CLIENT_ERROR',
        HTML_ERROR: 'HTML_ERROR',
        TIMEOUT: 'TIMEOUT',
        UNKNOWN: 'UNKNOWN',
    },
}));

// Mock helper functions
jest.mock('../../../src/utils/baltichub.helper', () => ({
    parseSlotsIntoButtons: jest.fn(),
    handleErrorResponse: jest.fn(),
    isTaskCompletedInAnotherQueue: jest.fn(),
}));

// Mock notification service
jest.mock('../../../src/services/notificationService', () => ({
    notificationService: {
        sendBookingSuccessNotifications: jest.fn(),
    },
}));

// Mock chrome notifications
global.chrome = {
    notifications: {
        create: jest.fn(),
    },
} as any;

// Test Helper Class Pattern
class BaltichubTestHelper {
    private mockUtils: any;
    private mockHelper: any;
    private mockChrome: any;
    private mockNotificationService: any;

    constructor() {
        this.mockUtils = require('../../../src/utils');
        this.mockHelper = require('../../../src/utils/baltichub.helper');
        this.mockChrome = global.chrome;
        this.mockNotificationService = notificationService as jest.Mocked<
            typeof notificationService
        >;
    }

    setupMocks(): void {
        this.mockUtils.fetchRequest.mockResolvedValue(TEST_RESPONSES.SUCCESS);
        this.mockUtils.formatDateToDMY.mockReturnValue('25.12.2024');

        // Use dynamic dates for form data
        const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
        const formatDate = (date: Date) => {
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            return `${day}.${month}.${year}`;
        };

        this.mockUtils.normalizeFormData.mockReturnValue({
            formData: {
                TvAppId: ['tv-app-123'],
                SlotStart: [`${formatDate(futureDate)} 10:00`],
                SlotEnd: [
                    `${formatDate(new Date(futureDate.getTime() + 2 * 60 * 60 * 1000))} 00:59:00`,
                ],
            },
        });
        // Set end time to be in the future (current time + 2 hours)
        this.mockUtils.parseDateTimeFromDMY.mockReturnValue(
            new Date(Date.now() + 2 * 60 * 60 * 1000),
        );
        this.mockUtils.createFormData.mockReturnValue('form-data');
        this.mockHelper.parseSlotsIntoButtons.mockReturnValue([{ text: '10:00', disabled: false }]);
        this.mockHelper.isTaskCompletedInAnotherQueue.mockReturnValue(false);
        this.mockHelper.handleErrorResponse.mockImplementation(
            (req, _response, _tvAppId, _time) => ({
                ...req,
                status: Statuses.ERROR,
                status_message: 'Error occurred',
            }),
        );
        this.mockNotificationService.sendBookingSuccessNotifications.mockResolvedValue(undefined);
    }

    setupExpiredEndTime(): void {
        this.mockUtils.parseDateTimeFromDMY.mockReturnValue(new Date(Date.now() - 100000));
    }

    setupExpiredCurrentSlot(): void {
        // Keep end time in future but set current slot to past
        this.mockUtils.parseDateTimeFromDMY.mockReturnValue(
            new Date(Date.now() + 2 * 60 * 60 * 1000),
        );
    }

    setupTaskCompletedInAnotherQueue(): void {
        this.mockHelper.isTaskCompletedInAnotherQueue.mockReturnValue(true);
    }

    setupAuthorizationError(): void {
        this.mockUtils.fetchRequest.mockResolvedValue(TEST_RESPONSES.ERROR_401);
    }

    setupServerError(): void {
        this.mockUtils.fetchRequest.mockResolvedValue(TEST_RESPONSES.ERROR_SERVER);
    }

    setupHtmlError(): void {
        this.mockUtils.fetchRequest.mockResolvedValue(TEST_RESPONSES.ERROR_HTML);
    }

    setupNetworkError(): void {
        this.mockUtils.fetchRequest.mockResolvedValue(TEST_RESPONSES.ERROR_NETWORK);
    }

    setupUnknownError(): void {
        this.mockUtils.fetchRequest.mockResolvedValue(TEST_RESPONSES.ERROR_UNKNOWN);
    }

    setupNoSlotsAvailable(): void {
        this.mockUtils.fetchRequest.mockResolvedValue({
            ok: true,
            text: jest.fn().mockResolvedValue(TEST_HTML_RESPONSES.WITHOUT_SLOTS),
        });
        this.mockHelper.parseSlotsIntoButtons.mockReturnValue([{ text: '10:00', disabled: true }]);
    }

    setupSlotsAvailable(): void {
        this.mockUtils.fetchRequest.mockResolvedValue({
            ok: true,
            text: jest.fn().mockResolvedValue(TEST_HTML_RESPONSES.WITH_SLOTS),
        });
        this.mockHelper.parseSlotsIntoButtons.mockReturnValue([{ text: '10:00', disabled: false }]);
    }

    setupExecuteRequestSuccess(): void {
        this.mockUtils.fetchRequest
            .mockResolvedValueOnce({
                ok: true,
                text: jest.fn().mockResolvedValue(TEST_HTML_RESPONSES.WITH_SLOTS),
            })
            .mockResolvedValueOnce({
                ok: true,
                text: jest.fn().mockResolvedValue('success response'),
            });
    }

    setupExecuteRequestError(): void {
        this.mockUtils.fetchRequest
            .mockResolvedValueOnce({
                ok: true,
                text: jest.fn().mockResolvedValue(TEST_HTML_RESPONSES.WITH_SLOTS),
            })
            .mockResolvedValueOnce({
                ok: false,
                text: jest.fn().mockResolvedValue('error response'),
            });
    }

    expectFetchRequestCalledWith(url: string, options: any): void {
        expect(this.mockUtils.fetchRequest).toHaveBeenCalledWith(url, options);
    }

    expectSetStorageCalledWith(data: any): void {
        expect(this.mockUtils.setStorage).toHaveBeenCalledWith(data);
    }

    expectNotificationCreated(): void {
        expect(this.mockNotificationService.sendBookingSuccessNotifications).toHaveBeenCalled();
    }

    resetMocks(): void {
        jest.clearAllMocks();
        this.setupMocks();
    }
}

describe('Baltichub Service', () => {
    let testHelper: BaltichubTestHelper;

    beforeEach(() => {
        testHelper = new BaltichubTestHelper();
        testHelper.setupMocks();
        // Reset fetchRequest mock to ensure clean state
        const { fetchRequest } = require('../../../src/utils');
        fetchRequest.mockClear();
    });

    describe('getSlots', () => {
        it('should fetch slots for given date', async () => {
            // Arrange
            const { formatDateToDMY } = require('../../../src/utils');

            // Act
            const result = await getSlots(TEST_DATES.VALID);

            // Assert
            expect(formatDateToDMY).toHaveBeenCalled();
            testHelper.expectFetchRequestCalledWith(
                'https://ebrama.baltichub.com/Home/GetSlotsForPreview',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json; charset=UTF-8',
                        'X-Requested-With': 'XMLHttpRequest',
                        Referer: 'https://ebrama.baltichub.com/tv-apps',
                        Accept: '*/*',
                    },
                    body: JSON.stringify({ date: '25.12.2024', type: 1 }),
                    credentials: 'omit',
                },
            );
            expect(result).toEqual(TEST_RESPONSES.SUCCESS);
        });

        it('should handle fetch error', async () => {
            // Arrange
            const { fetchRequest } = require('../../../src/utils');
            fetchRequest.mockResolvedValue(TEST_RESPONSES.ERROR_NETWORK);

            // Act
            const result = await getSlots(TEST_DATES.VALID);

            // Assert
            expect(result).toEqual(TEST_RESPONSES.ERROR_NETWORK);
        });
    });

    describe('getEditForm', () => {
        it('should fetch edit form for tvAppId', async () => {
            // Act
            const result = await getEditForm(TEST_TV_APP_IDS.VALID);

            // Assert
            testHelper.expectFetchRequestCalledWith(
                'https://ebrama.baltichub.com/TVApp/EditTvAppModal?tvAppId=tv-app-123',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json; charset=UTF-8',
                        'X-requested-with': 'XMLHttpRequest',
                        Referer: 'https://ebrama.baltichub.com/tv-apps',
                        Accept: '*/*',
                        'X-Extension-Request': 'JustPrivetProject',
                    },
                    credentials: 'include',
                },
            );
            expect(result).toEqual(TEST_RESPONSES.SUCCESS);
        });
    });

    describe('getDriverNameAndContainer', () => {
        it('should return cached data if tvAppId exists in retryQueue', async () => {
            // Arrange
            const retryQueue: RetryObject[] = [
                {
                    ...TEST_RETRY_OBJECTS.VALID,
                    driverName: 'John Doe',
                    containerNumber: 'MSNU2991953',
                    startSlot: '13.10.2025 13:15:00',
                },
            ];

            // Act
            const result = await getDriverNameAndContainer(TEST_TV_APP_IDS.VALID, retryQueue);

            // Assert
            expect(result).toEqual({
                driverName: 'John Doe',
                containerNumber: 'MSNU2991953',
            });
            // Verify that getEditForm (which uses fetchRequest) was not called
            const { fetchRequest } = require('../../../src/utils');
            const calls = fetchRequest.mock.calls;
            const editFormCalls = calls.filter(call => call[0].includes('EditTvAppModal'));
            expect(editFormCalls).toHaveLength(0);
        });

        it('should fetch and parse data if tvAppId not in retryQueue', async () => {
            // Arrange
            const { fetchRequest } = require('../../../src/utils');
            const mockResponse = {
                ok: true,
                text: jest.fn().mockResolvedValue(TEST_HTML_RESPONSES.WITH_DRIVER),
            };
            fetchRequest.mockResolvedValue(mockResponse);

            // Act
            const result = await getDriverNameAndContainer(TEST_TV_APP_IDS.VALID, []);

            // Assert
            expect(fetchRequest).toHaveBeenCalled();
            expect(result).toEqual({
                driverName: 'John Doe',
                containerNumber: 'MSNU2991953',
            });
        });

        it('should handle fetch error gracefully', async () => {
            // Arrange
            const { fetchRequest } = require('../../../src/utils');
            fetchRequest.mockResolvedValue(TEST_RESPONSES.ERROR_NETWORK);

            // Act
            const result = await getDriverNameAndContainer(TEST_TV_APP_IDS.VALID, []);

            // Assert
            expect(result).toEqual({
                driverName: '',
                containerNumber: '',
            });
        });

        it('should handle empty response gracefully', async () => {
            // Arrange
            const { fetchRequest } = require('../../../src/utils');
            const mockResponse = {
                ok: true,
                text: jest.fn().mockResolvedValue(''),
            };
            fetchRequest.mockResolvedValue(mockResponse);

            // Act
            const result = await getDriverNameAndContainer(TEST_TV_APP_IDS.VALID, []);

            // Assert
            expect(result).toEqual({
                driverName: '',
                containerNumber: '',
            });
        });

        it('should handle response without selected driver', async () => {
            // Arrange
            const { fetchRequest } = require('../../../src/utils');
            const mockResponse = {
                ok: true,
                text: jest.fn().mockResolvedValue(TEST_HTML_RESPONSES.WITHOUT_DRIVER),
            };
            fetchRequest.mockResolvedValue(mockResponse);

            // Act
            const result = await getDriverNameAndContainer(TEST_TV_APP_IDS.VALID, []);

            // Assert
            expect(result).toEqual({
                driverName: '',
                containerNumber: '',
            });
        });
    });

    describe('checkSlotAvailability', () => {
        it('should return true when slot is available', async () => {
            const { parseSlotsIntoButtons } = require('../../../src/utils/baltichub.helper');
            parseSlotsIntoButtons.mockReturnValue([
                { text: '10:00-10:59', disabled: false },
                { text: '11:00-11:59', disabled: true },
            ]);

            const result = await checkSlotAvailability('<html></html>', ['01.01.2025', '10:00:00']);

            expect(result).toBe(true);
        });

        it('should return false when slot is disabled', async () => {
            const { parseSlotsIntoButtons } = require('../../../src/utils/baltichub.helper');
            parseSlotsIntoButtons.mockReturnValue([
                { text: '10:00-10:59', disabled: true },
                { text: '11:00-11:59', disabled: false },
            ]);

            const result = await checkSlotAvailability('<html></html>', ['01.01.2025', '10:00:00']);

            expect(result).toBe(false);
        });

        it('should return false when slot is not found', async () => {
            const { parseSlotsIntoButtons } = require('../../../src/utils/baltichub.helper');
            parseSlotsIntoButtons.mockReturnValue([
                { text: '11:00-11:59', disabled: false },
                { text: '12:00-12:59', disabled: false },
            ]);

            const result = await checkSlotAvailability('<html></html>', ['01.01.2025', '10:00:00']);

            expect(result).toBe(false);
        });
    });

    describe('executeRequest', () => {
        it('should return success status on successful request', async () => {
            const { fetchRequest, createFormData } = require('../../../src/utils');
            createFormData.mockReturnValue(new FormData());
            fetchRequest.mockResolvedValue({
                ok: true,
                text: jest.fn().mockResolvedValue('success'),
            });

            const req: RetryObject = {
                ...TEST_RETRY_OBJECTS.VALID,
                body: { formData: { TvAppId: ['123'], SlotStart: ['01.01.2025 10:00'] } },
            };

            const result = await executeRequest(req, '123', ['01.01.2025', '10:00']);

            expect(result.status).toBe(Statuses.SUCCESS);
        });

        it('should throw error when body or formData is missing', async () => {
            const req: RetryObject = {
                ...TEST_RETRY_OBJECTS.VALID,
                body: undefined as any,
            };

            await expect(executeRequest(req, '123', ['01.01.2025', '10:00'])).rejects.toThrow(
                'Request body or formData is missing',
            );
        });

        it('should handle error response', async () => {
            const { fetchRequest, createFormData } = require('../../../src/utils');
            const { handleErrorResponse } = require('../../../src/utils/baltichub.helper');

            createFormData.mockReturnValue(new FormData());
            fetchRequest.mockResolvedValue({
                ok: false,
                text: jest.fn().mockResolvedValue('{"error":"some error"}'),
            });
            handleErrorResponse.mockReturnValue({
                ...TEST_RETRY_OBJECTS.VALID,
                status: Statuses.ERROR,
                status_message: 'Error',
            });

            const req: RetryObject = {
                ...TEST_RETRY_OBJECTS.VALID,
                body: { formData: { TvAppId: ['123'], SlotStart: ['01.01.2025 10:00'] } },
            };

            const result = await executeRequest(req, '123', ['01.01.2025', '10:00']);

            expect(handleErrorResponse).toHaveBeenCalled();
            expect(result.status).toBe(Statuses.ERROR);
        });

        it('should send notifications on success', async () => {
            const { fetchRequest, createFormData } = require('../../../src/utils');
            createFormData.mockReturnValue(new FormData());
            fetchRequest.mockResolvedValue({
                ok: true,
                text: jest.fn().mockResolvedValue('success'),
            });

            const mockNotificationService = notificationService as jest.Mocked<
                typeof notificationService
            >;

            const req: RetryObject = {
                ...TEST_RETRY_OBJECTS.VALID,
                body: { formData: { TvAppId: ['123'], SlotStart: ['01.01.2025 10:00'] } },
            };

            await executeRequest(req, '123', ['01.01.2025', '10:00']);

            expect(mockNotificationService.sendBookingSuccessNotifications).toHaveBeenCalled();
        });

        it('should handle notification error gracefully', async () => {
            const { fetchRequest, createFormData } = require('../../../src/utils');
            createFormData.mockReturnValue(new FormData());
            fetchRequest.mockResolvedValue({
                ok: true,
                text: jest.fn().mockResolvedValue('success'),
            });

            const mockNotificationService = notificationService as jest.Mocked<
                typeof notificationService
            >;
            mockNotificationService.sendBookingSuccessNotifications.mockRejectedValue(
                new Error('Notification failed'),
            );

            const req: RetryObject = {
                ...TEST_RETRY_OBJECTS.VALID,
                body: { formData: { TvAppId: ['123'], SlotStart: ['01.01.2025 10:00'] } },
            };

            // Should not throw, but return success
            const result = await executeRequest(req, '123', ['01.01.2025', '10:00']);
            expect(result.status).toBe(Statuses.SUCCESS);
        });
    });

    describe('validateRequestBeforeSlotCheck', () => {
        it('should return null when validation passes', async () => {
            const { normalizeFormData, parseDateTimeFromDMY } = require('../../../src/utils');
            const {
                isTaskCompletedInAnotherQueue,
            } = require('../../../src/utils/baltichub.helper');

            // Set future dates
            const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
            normalizeFormData.mockReturnValue({
                formData: {
                    TvAppId: ['123'],
                    SlotStart: ['01.01.2025 10:00'],
                    SlotEnd: ['01.01.2025 11:00'],
                },
            });
            parseDateTimeFromDMY.mockReturnValue(futureDate);
            isTaskCompletedInAnotherQueue.mockReturnValue(false);

            const req: RetryObject = {
                ...TEST_RETRY_OBJECTS.VALID,
                currentSlot: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
            };

            const result = await validateRequestBeforeSlotCheck(req, []);

            expect(result).toBeNull();
        });

        it('should return EXPIRED when end time is in the past', async () => {
            const { normalizeFormData, parseDateTimeFromDMY } = require('../../../src/utils');
            const {
                isTaskCompletedInAnotherQueue,
            } = require('../../../src/utils/baltichub.helper');

            // Set past date for end time
            const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
            normalizeFormData.mockReturnValue({
                formData: {
                    TvAppId: ['123'],
                    SlotStart: ['01.01.2025 10:00'],
                    SlotEnd: ['01.01.2024 11:00'], // Past date
                },
            });
            parseDateTimeFromDMY.mockReturnValue(pastDate);
            isTaskCompletedInAnotherQueue.mockReturnValue(false);

            const req: RetryObject = {
                ...TEST_RETRY_OBJECTS.VALID,
                currentSlot: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            };

            const result = await validateRequestBeforeSlotCheck(req, []);

            expect(result).not.toBeNull();
            expect(result?.status).toBe(Statuses.EXPIRED);
        });

        it('should return EXPIRED when current slot is in the past', async () => {
            const { normalizeFormData, parseDateTimeFromDMY } = require('../../../src/utils');
            const {
                isTaskCompletedInAnotherQueue,
            } = require('../../../src/utils/baltichub.helper');

            // Set future end time but past current slot
            const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
            normalizeFormData.mockReturnValue({
                formData: {
                    TvAppId: ['123'],
                    SlotStart: ['01.01.2025 10:00'],
                    SlotEnd: ['01.01.2025 11:00'],
                },
            });
            parseDateTimeFromDMY.mockReturnValue(futureDate);
            isTaskCompletedInAnotherQueue.mockReturnValue(false);

            const req: RetryObject = {
                ...TEST_RETRY_OBJECTS.VALID,
                currentSlot: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
            };

            const result = await validateRequestBeforeSlotCheck(req, []);

            expect(result).not.toBeNull();
            expect(result?.status).toBe(Statuses.EXPIRED);
        });

        it('should return ANOTHER_TASK when task completed in another queue', async () => {
            const { normalizeFormData, parseDateTimeFromDMY } = require('../../../src/utils');
            const {
                isTaskCompletedInAnotherQueue,
            } = require('../../../src/utils/baltichub.helper');

            const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
            normalizeFormData.mockReturnValue({
                formData: {
                    TvAppId: ['123'],
                    SlotStart: ['01.01.2025 10:00'],
                    SlotEnd: ['01.01.2025 11:00'],
                },
            });
            parseDateTimeFromDMY.mockReturnValue(futureDate);
            isTaskCompletedInAnotherQueue.mockReturnValue(true); // Task completed in another queue

            const req: RetryObject = {
                ...TEST_RETRY_OBJECTS.VALID,
                currentSlot: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            };

            const result = await validateRequestBeforeSlotCheck(req, []);

            expect(result).not.toBeNull();
            expect(result?.status).toBe(Statuses.ANOTHER_TASK);
        });
    });

    describe('getDriverNameAndContainer edge cases', () => {
        it('should skip cache lookup when retryQueue is undefined', async () => {
            const { fetchRequest } = require('../../../src/utils');
            const mockResponse = {
                ok: true,
                text: jest.fn().mockResolvedValue(TEST_HTML_RESPONSES.WITH_DRIVER),
            };
            fetchRequest.mockResolvedValue(mockResponse);

            const result = await getDriverNameAndContainer(TEST_TV_APP_IDS.VALID, undefined as any);

            expect(fetchRequest).toHaveBeenCalled();
            expect(result).toEqual({
                driverName: 'John Doe',
                containerNumber: 'MSNU2991953',
            });
        });

        it('should skip cache lookup when retryQueue is not an array', async () => {
            const { fetchRequest } = require('../../../src/utils');
            const mockResponse = {
                ok: true,
                text: jest.fn().mockResolvedValue(TEST_HTML_RESPONSES.WITH_DRIVER),
            };
            fetchRequest.mockResolvedValue(mockResponse);

            const result = await getDriverNameAndContainer(
                TEST_TV_APP_IDS.VALID,
                'not-an-array' as any,
            );

            expect(fetchRequest).toHaveBeenCalled();
            expect(result).toEqual({
                driverName: 'John Doe',
                containerNumber: 'MSNU2991953',
            });
        });
    });
});
