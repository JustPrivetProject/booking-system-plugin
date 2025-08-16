import {
    parseSlotsIntoButtons,
    handleErrorResponse,
    isTaskCompletedInAnotherQueue,
} from '../../../src/utils/baltichub.helper';
import { RetryObject } from '../../../src/types/baltichub';
import { Statuses } from '../../../src/data';

// Mock utils functions
jest.mock('../../../src/utils', () => ({
    consoleLog: jest.fn(),
    detectHtmlError: jest.fn(),
    determineErrorType: jest.fn(),
}));

describe('Baltichub Helper Functions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('parseSlotsIntoButtons', () => {
        it('should parse buttons from HTML correctly', () => {
            const htmlText = `
                <button>Slot 1</button>
                <button disabled>Slot 2</button>
                <button class="available">Slot 3</button>
            `;

            const result = parseSlotsIntoButtons(htmlText);

            expect(result).toHaveLength(3);
            expect(result[0]).toEqual({ text: 'Slot 1', disabled: false });
            expect(result[1]).toEqual({ text: 'Slot 2', disabled: true });
            expect(result[2]).toEqual({ text: 'Slot 3', disabled: false });
        });

        it('should handle empty HTML', () => {
            const result = parseSlotsIntoButtons('');
            expect(result).toHaveLength(0);
        });

        it('should handle HTML without buttons', () => {
            const htmlText = '<div>No buttons here</div>';
            const result = parseSlotsIntoButtons(htmlText);
            expect(result).toHaveLength(0);
        });

        it('should handle buttons with complex content', () => {
            const htmlText = `
                <button>
                    <span>Slot 1</span>
                    <strong>Available</strong>
                </button>
                <button disabled>
                    <span>Slot 2</span>
                    <em>Unavailable</em>
                </button>
            `;

            const result = parseSlotsIntoButtons(htmlText);

            expect(result).toHaveLength(2);
            expect(result[0].text).toContain('Slot 1');
            expect(result[0].text).toContain('Available');
            expect(result[0].disabled).toBe(false);
            expect(result[1].text).toContain('Slot 2');
            expect(result[1].text).toContain('Unavailable');
            expect(result[1].disabled).toBe(true);
        });
    });

    describe('isTaskCompletedInAnotherQueue', () => {
        it('should return true when task is completed in another queue', () => {
            const req: RetryObject = {
                tvAppId: 'tv-app-123',
                status: 'in-progress',
            } as RetryObject;

            const queue: RetryObject[] = [
                {
                    tvAppId: 'tv-app-123',
                    status: 'success',
                } as RetryObject,
                {
                    tvAppId: 'tv-app-456',
                    status: 'in-progress',
                } as RetryObject,
            ];

            const result = isTaskCompletedInAnotherQueue(req, queue);
            expect(result).toBe(true);
        });

        it('should return false when task is not completed in another queue', () => {
            const req: RetryObject = {
                tvAppId: 'tv-app-123',
                status: 'in-progress',
            } as RetryObject;

            const queue: RetryObject[] = [
                {
                    tvAppId: 'tv-app-123',
                    status: 'in-progress',
                } as RetryObject,
                {
                    tvAppId: 'tv-app-456',
                    status: 'error',
                } as RetryObject,
            ];

            const result = isTaskCompletedInAnotherQueue(req, queue);
            expect(result).toBe(false);
        });

        it('should return false when queue is empty', () => {
            const req: RetryObject = {
                tvAppId: 'tv-app-123',
                status: 'in-progress',
            } as RetryObject;

            const queue: RetryObject[] = [];

            const result = isTaskCompletedInAnotherQueue(req, queue);
            expect(result).toBe(false);
        });

        it('should return false when tvAppId does not match', () => {
            const req: RetryObject = {
                tvAppId: 'tv-app-123',
                status: 'in-progress',
            } as RetryObject;

            const queue: RetryObject[] = [
                {
                    tvAppId: 'tv-app-456',
                    status: 'success',
                } as RetryObject,
            ];

            const result = isTaskCompletedInAnotherQueue(req, queue);
            expect(result).toBe(false);
        });
    });

    describe('handleErrorResponse', () => {
        const mockReq: RetryObject = {
            tvAppId: 'tv-app-123',
            status: 'in-progress',
            status_message: 'Processing',
        } as RetryObject;

        const time = ['10:00', '11:00'];

        it('should handle CannotCreateTvaInSelectedSlot error', () => {
            const parsedResponse = 'CannotCreateTvaInSelectedSlot';
            const result = handleErrorResponse(mockReq, parsedResponse, 'tv-app-123', time);

            expect(result).toEqual(mockReq);
        });

        it('should handle TaskWasUsedInAnotherTva error', () => {
            const parsedResponse = 'TaskWasUsedInAnotherTva';
            const result = handleErrorResponse(mockReq, parsedResponse, 'tv-app-123', time);

            expect(result.status).toBe(Statuses.ANOTHER_TASK);
            expect(result.status_message).toBe('Zadanie zakończone w innym wątku');
        });

        it('should handle ToMuchTransactionInSector error', () => {
            const parsedResponse = 'ToMuchTransactionInSector';
            const result = handleErrorResponse(mockReq, parsedResponse, 'tv-app-123', time);

            expect(result.status_message).toBe('Za duża ilość transakcji w sektorze');
            expect(result.status).toBe('in-progress'); // status should remain unchanged
        });

        it('should handle NoSlotsAvailable JSON error', () => {
            const parsedResponse = '{"messageCode": "NoSlotsAvailable"}';
            const result = handleErrorResponse(mockReq, parsedResponse, 'tv-app-123', time);

            expect(result).toEqual(mockReq);
        });

        it('should handle FE_0091 error code', () => {
            const parsedResponse = '{"messageCode": "FE_0091"}';
            const result = handleErrorResponse(mockReq, parsedResponse, 'tv-app-123', time);

            expect(result.status).toBe(Statuses.ANOTHER_TASK);
            expect(result.status_message).toBe(
                'Awizacja edytowana przez innego użytkownika. Otwórz okno ponownie w celu aktualizacji awizacji',
            );
        });

        it('should handle VBS_0072 error code', () => {
            const parsedResponse = '{"messageCode": "VBS_0072"}';
            const result = handleErrorResponse(mockReq, parsedResponse, 'tv-app-123', time);

            expect(result.status).toBe(Statuses.ERROR);
            expect(result.status_message).toBe(
                'Awizacja nie może zostać zmieniona, ponieważ czas na dokonanie zmian już minął',
            );
        });

        it('should handle unknown JSON error', () => {
            const parsedResponse = '{"error": "Unknown error occurred"}';
            const result = handleErrorResponse(mockReq, parsedResponse, 'tv-app-123', time);

            expect(result.status).toBe(Statuses.ERROR);
            expect(result.status_message).toBe('Unknown error occurred');
        });

        it('should handle HTML error pages', () => {
            const { detectHtmlError, determineErrorType } = require('../../../src/utils');

            detectHtmlError.mockReturnValue({
                isError: true,
                message: 'HTML Error Page Detected',
            });
            determineErrorType.mockReturnValue('HTML_ERROR');

            const parsedResponse = '<!DOCTYPE html><html><h1>Error 500</h1></html>';
            const result = handleErrorResponse(mockReq, parsedResponse, 'tv-app-123', time);

            expect(result.status).toBe(Statuses.ERROR);
            expect(result.status_message).toBe(
                'Błąd serwera (500) - spróbuj ponownie później - Error 500',
            );
        });

        it('should handle Error 404 in HTML', () => {
            const parsedResponse = '<!DOCTYPE html><html><h1>Error 404</h1></html>';
            const result = handleErrorResponse(mockReq, parsedResponse, 'tv-app-123', time);

            expect(result.status).toBe(Statuses.ERROR);
            expect(result.status_message).toBe(
                'Nie znaleziono (404) - sprawdź poprawność danych - Error 404',
            );
        });

        it('should handle Error 403 in HTML', () => {
            const parsedResponse = '<!DOCTYPE html><html><h1>Error 403</h1></html>';
            const result = handleErrorResponse(mockReq, parsedResponse, 'tv-app-123', time);

            expect(result.status).toBe(Statuses.AUTHORIZATION_ERROR);
            expect(result.status_message).toBe(
                'Dostęp zabroniony (403) - brak uprawnień - Error 403',
            );
        });

        it('should handle Error 401 in HTML', () => {
            const parsedResponse = '<!DOCTYPE html><html><h1>Error 401</h1></html>';
            const result = handleErrorResponse(mockReq, parsedResponse, 'tv-app-123', time);

            expect(result.status).toBe(Statuses.AUTHORIZATION_ERROR);
            expect(result.status_message).toBe(
                'Nieautoryzowany dostęp (401) - wymagane ponowne logowanie - Error 401',
            );
        });

        it('should handle Error 400 in HTML', () => {
            const parsedResponse = '<!DOCTYPE html><html><h1>Error 400</h1></html>';
            const result = handleErrorResponse(mockReq, parsedResponse, 'tv-app-123', time);

            expect(result.status).toBe(Statuses.ERROR);
            expect(result.status_message).toBe(
                'Nieprawidłowe żądanie (400) - sprawdź dane wejściowe - Error 400',
            );
        });

        it('should handle non-JSON, non-HTML errors', () => {
            const parsedResponse = 'Some plain text error';
            const result = handleErrorResponse(mockReq, parsedResponse, 'tv-app-123', time);

            expect(result.status).toBe(Statuses.ERROR);
            expect(result.status_message).toBe('Nieznany błąd (niepoprawny format odpowiedzi)');
        });

        it('should extract additional error details from HTML', () => {
            const parsedResponse = '<!DOCTYPE html><html><h1>Custom Error Message</h1></html>';
            const result = handleErrorResponse(mockReq, parsedResponse, 'tv-app-123', time);

            expect(result.status_message).toContain('Custom Error Message');
        });
    });
});
