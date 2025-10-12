import {
    getSlots,
    getEditForm,
    getDriverNameAndContainer,
    processRequest,
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
            testHelper.expectFetchRequestCalledWith('https://ebrama.baltichub.com/Home/GetSlots', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8',
                    'X-Requested-With': 'XMLHttpRequest',
                    Referer: 'https://ebrama.baltichub.com/tv-apps',
                    Accept: '*/*',
                },
                body: JSON.stringify({ date: '25.12.2024', type: 1 }),
            });
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
                slotStart: '13.10.2025 13:15:00',
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
                slotStart: '13.10.2025 13:15:00',
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
                slotStart: '',
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
                slotStart: '',
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
                slotStart: '',
            });
        });
    });

    describe('processRequest', () => {
        it('should return expired status when end time is in the past', async () => {
            // Arrange
            testHelper.setupExpiredEndTime();

            // Act
            const result = await processRequest(TEST_RETRY_OBJECTS.VALID, []);

            // Assert
            expect(result.status).toBe(Statuses.EXPIRED);
            expect(result.status_message).toBe('Czas zakończenia slotu już minął');
        });

        it('should return expired status when current slot is in the past', async () => {
            // Arrange
            testHelper.setupExpiredCurrentSlot();

            // Act
            const result = await processRequest(TEST_RETRY_OBJECTS.EXPIRED_CURRENT_SLOT, []);

            // Assert
            expect(result.status).toBe(Statuses.EXPIRED);
            expect(result.status_message).toBe(
                'Awizacja nie może zostać zmieniona, ponieważ czas na dokonanie zmian już minął',
            );
        });

        it('should return another task status when task is completed in another queue', async () => {
            // Arrange
            testHelper.setupTaskCompletedInAnotherQueue();

            // Act
            const result = await processRequest(TEST_RETRY_OBJECTS.VALID, []);

            // Assert
            expect(result.status).toBe(Statuses.ANOTHER_TASK);
            expect(result.status_message).toBe('Zadanie zakończone w innym wątku');
        });

        it('should handle authorization error (401)', async () => {
            // Arrange
            testHelper.setupAuthorizationError();

            // Act
            const result = await processRequest(TEST_RETRY_OBJECTS.VALID, []);

            // Assert
            expect(result.status).toBe(Statuses.AUTHORIZATION_ERROR);
            expect(result.status_message).toBe('Problem z autoryzacją - nieautoryzowany dostęp');
            testHelper.expectSetStorageCalledWith({ unauthorized: true });
        });

        it('should handle server error', async () => {
            // Arrange
            testHelper.setupServerError();

            // Act
            const result = await processRequest(TEST_RETRY_OBJECTS.VALID, []);

            // Assert
            expect(result.status).toBe(Statuses.NETWORK_ERROR);
            expect(result.status_message).toBe('Problem z serwerem - spróbuj ponownie później');
        });

        it('should handle HTML error', async () => {
            // Arrange
            testHelper.setupHtmlError();

            // Act
            const result = await processRequest(TEST_RETRY_OBJECTS.VALID, []);

            // Assert
            expect(result.status).toBe(Statuses.AUTHORIZATION_ERROR);
            expect(result.status_message).toBe('Problem z autoryzacją - strona błędu');
        });

        it('should handle network error', async () => {
            // Arrange
            testHelper.setupNetworkError();

            // Act
            const result = await processRequest(TEST_RETRY_OBJECTS.VALID, []);

            // Assert
            expect(result.status).toBe(Statuses.AUTHORIZATION_ERROR);
            expect(result.status_message).toBe('Problem z połączeniem sieciowym');
        });

        it('should handle unknown error type', async () => {
            // Arrange
            testHelper.setupUnknownError();

            // Act
            const result = await processRequest(TEST_RETRY_OBJECTS.VALID, []);

            // Assert
            expect(result.status).toBe(Statuses.NETWORK_ERROR);
            expect(result.status_message).toBe('Nieznany błąd (niepoprawny format odpowiedzi)');
        });

        it('should return request unchanged when slot is not available', async () => {
            // Arrange
            testHelper.setupNoSlotsAvailable();

            // Act
            const result = await processRequest(TEST_RETRY_OBJECTS.VALID, []);

            // Assert
            expect(result).toEqual(TEST_RETRY_OBJECTS.VALID);
        });

        it('should execute request successfully when slot is available', async () => {
            // Arrange
            testHelper.setupExecuteRequestSuccess();

            // Act
            const result = await processRequest(TEST_RETRY_OBJECTS.VALID, []);

            // Assert
            expect(result.status).toBe(Statuses.SUCCESS);
            expect(result.status_message).toBe('Zadanie zakończone sukcesem');
            testHelper.expectNotificationCreated();
        });

        it('should send notification with correct booking data', async () => {
            // Arrange
            testHelper.setupExecuteRequestSuccess();

            // Act
            await processRequest(TEST_RETRY_OBJECTS.VALID, []);

            // Assert
            const mockNotificationService = notificationService as jest.Mocked<
                typeof notificationService
            >;
            expect(mockNotificationService.sendBookingSuccessNotifications).toHaveBeenCalledWith(
                expect.objectContaining({
                    tvAppId: TEST_RETRY_OBJECTS.VALID.tvAppId,
                    bookingTime: expect.any(String),
                    driverName: TEST_RETRY_OBJECTS.VALID.driverName,
                    containerNumber: TEST_RETRY_OBJECTS.VALID.containerNumber,
                }),
            );
        });

        it('should handle execute request error', async () => {
            // Arrange
            testHelper.setupExecuteRequestError();

            // Act
            const result = await processRequest(TEST_RETRY_OBJECTS.VALID, []);

            // Assert
            expect(result.status).toBe(Statuses.ERROR);
            expect(result.status_message).toBe('Error occurred');
        });
    });
});
