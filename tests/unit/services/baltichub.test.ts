import { getSlots, getEditForm, getDriverNameAndContainer } from '../../../src/services/baltichub';
import { RetryObject } from '../../../src/types/baltichub';

// Mock utils functions
jest.mock('../../../src/utils', () => ({
    fetchRequest: jest.fn(),
    consoleLog: jest.fn(),
    consoleLogWithoutSave: jest.fn(),
    formatDateToDMY: jest.fn(),
    JSONstringify: jest.fn(obj => JSON.stringify(obj)),
}));

// Mock helper functions
jest.mock('../../../src/utils/baltichub.helper', () => ({
    parseSlotsIntoButtons: jest.fn(),
    handleErrorResponse: jest.fn(),
    isTaskCompletedInAnotherQueue: jest.fn(),
}));

// Mock storage helper
jest.mock('../../../src/utils/storage', () => ({
    setStorage: jest.fn(),
}));

describe('Baltichub Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getSlots', () => {
        it('should fetch slots for given date', async () => {
            const { fetchRequest, formatDateToDMY } = require('../../../src/utils');
            const mockResponse = { ok: true, data: 'slots data' };

            fetchRequest.mockResolvedValue(mockResponse);
            formatDateToDMY.mockReturnValue('25.12.2024');

            const result = await getSlots('25.12.2024');

            expect(formatDateToDMY).toHaveBeenCalled();
            expect(fetchRequest).toHaveBeenCalledWith(
                'https://ebrama.baltichub.com/Home/GetSlots',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json; charset=UTF-8',
                        'X-Requested-With': 'XMLHttpRequest',
                        Referer: 'https://ebrama.baltichub.com/tv-apps',
                        Accept: '*/*',
                    },
                    body: JSON.stringify({ date: '25.12.2024', type: 1 }),
                },
            );
            expect(result).toEqual(mockResponse);
        });

        it('should handle fetch error', async () => {
            const { fetchRequest } = require('../../../src/utils');
            const mockError = { ok: false, error: { message: 'Network error' } };

            fetchRequest.mockResolvedValue(mockError);

            const result = await getSlots('25.12.2024');

            expect(result).toEqual(mockError);
        });
    });

    describe('getEditForm', () => {
        it('should fetch edit form for tvAppId', async () => {
            const { fetchRequest } = require('../../../src/utils');
            const mockResponse = { ok: true, data: 'form data' };

            fetchRequest.mockResolvedValue(mockResponse);

            const result = await getEditForm('tv-app-123');

            expect(fetchRequest).toHaveBeenCalledWith(
                'https://ebrama.baltichub.com/TVApp/EditTvAppModal?tvAppId=tv-app-123',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json; charset=UTF-8',
                        'X-requested-with': 'XMLHttpRequest',
                        Referer: 'https://ebrama.baltichub.com/vbs-slots',
                        Accept: '*/*',
                        'X-Extension-Request': 'JustPrivetProject',
                    },
                    credentials: 'include',
                },
            );
            expect(result).toEqual(mockResponse);
        });
    });

    describe('getDriverNameAndContainer', () => {
        it('should return cached data if tvAppId exists in retryQueue', async () => {
            const { fetchRequest } = require('../../../src/utils');
            const retryQueue: RetryObject[] = [
                {
                    tvAppId: 'tv-app-123',
                    driverName: 'John Doe',
                    containerNumber: 'MSNU2991953',
                    body: undefined,
                    headersCache: undefined,
                    id: 'retry-1',
                    currentSlot: '2025-07-30 19:00',
                    startSlot: '05.06.2025 19:00:00',
                    endSlot: '26.06.2025 00:59:00',
                    status: 'paused',
                    status_message: 'Zadanie jest wstrzymane',
                    timestamp: Date.now(),
                    url: 'https://example.com',
                },
            ];

            const result = await getDriverNameAndContainer('tv-app-123', retryQueue);

            expect(result).toEqual({
                driverName: 'John Doe',
                containerNumber: 'MSNU2991953',
            });
            expect(fetchRequest).not.toHaveBeenCalled();
        });

        it('should fetch and parse data if tvAppId not in retryQueue', async () => {
            const { fetchRequest } = require('../../../src/utils');
            const mockResponse = {
                ok: true,
                text: jest.fn().mockResolvedValue(`
          <select id="SelectedDriver">
            <option selected="selected">John Doe</option>
          </select>
          <script>"ContainerId":"MSNU2991953"</script>
        `),
            };

            fetchRequest.mockResolvedValue(mockResponse);

            const result = await getDriverNameAndContainer('tv-app-123', []);

            expect(fetchRequest).toHaveBeenCalled();
            expect(result).toEqual({
                driverName: 'John Doe',
                containerNumber: 'MSNU2991953',
            });
        });

        it('should handle fetch error gracefully', async () => {
            const { fetchRequest } = require('../../../src/utils');
            const mockError = { ok: false, error: { message: 'Fetch failed' } };

            fetchRequest.mockResolvedValue(mockError);

            const result = await getDriverNameAndContainer('tv-app-123', []);

            expect(result).toEqual({
                driverName: '',
                containerNumber: '',
            });
        });
    });
});
