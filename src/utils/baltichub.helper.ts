import { Messages, Statuses } from '../data';
import type { RetryObject } from '../types/baltichub';

import { consoleLog, detectHtmlError, determineErrorType } from './index';

export const parseSlotsIntoButtons = (htmlText: string) => {
    const buttonRegex = /<button[^>]*>(.*?)<\/button>/gs;
    const buttons = [...htmlText.matchAll(buttonRegex)].map(match => {
        const buttonHTML = match[0]; // The entire matched <button>...</button> tag
        const text = match[1].trim(); // The text inside the button
        const disabled = /disabled/i.test(buttonHTML); // Check for the presence of the disabled attribute

        return { text, disabled };
    });
    return buttons;
};

/**
 * Checks if a task has been completed in another queue.
 *
 * @param {RetryObject} req - The request object to check.
 * @param {RetryObject[]} queue - The queue of tasks to check.
 * @returns {boolean} - True if the task has been completed in another queue, false otherwise.
 */
export function isTaskCompletedInAnotherQueue(req: RetryObject, queue: RetryObject[]) {
    return queue.some(task => task.tvAppId === req.tvAppId && task.status === 'success');
}

/**
 * Handles error responses by analyzing the parsed response and returning an appropriate object.
 *
 * @param {Object} req - The original request object.
 * @param {string} parsedResponse - The parsed response string from the server.
 * @param {string} tvAppId - The ID of the TV application associated with the request.
 * @param {Array<string>} time - An array of time-related strings associated with the request.
 * @returns {Object} - The modified request object or an object containing error details.
 *
 * @description
 * This function processes error responses and determines the appropriate action based on the error type:
 * - If the error is "CannotCreateTvaInSelectedSlot", it logs the error and returns the original request.
 * - If the error is "TaskWasUsedInAnotherTva", it logs the success message and returns a modified request object with a status of "another-task".
 * - For unknown errors, it logs the error and returns a modified request object with a status of "error" and an error message.
 */

export function handleErrorResponse(
    req: RetryObject,
    parsedResponse: string,
    tvAppId: string,
    time: string[],
): RetryObject {
    const errorData = {
        tvAppId,
        Time: time.join(', '),
        SlotStart: req.body?.formData?.SlotStart?.[0] || 'not set',
        SlotEnd: req.body?.formData?.SlotEnd?.[0] || 'not set',
        'req.startSlot': req.startSlot || 'not set',
        'req.endSlot': req.endSlot || 'not set',
        'Response length': parsedResponse.length,
        'Response preview': parsedResponse.substring(0, 200),
    };
    consoleLog('❌ Error response received:', JSON.stringify(errorData, null, 2));

    if (parsedResponse.includes('CannotCreateTvaInSelectedSlot')) {
        const retryFailedData = {
            tvAppId,
            Time: time.join(', '),
            SlotStart: req.body?.formData?.SlotStart?.[0] || 'not set',
            SlotEnd: req.body?.formData?.SlotEnd?.[0] || 'not set',
            Response: parsedResponse,
        };
        consoleLog('❌ Retry failed, keeping in queue:', JSON.stringify(retryFailedData, null, 2));
        return req;
    }

    if (parsedResponse.includes('TaskWasUsedInAnotherTva')) {
        const anotherTaskData = {
            tvAppId,
            Time: time.join(', '),
            Response: parsedResponse,
        };
        consoleLog(
            '✅ The request was executed in another task:',
            JSON.stringify(anotherTaskData, null, 2),
        );
        return {
            ...req,
            status: Statuses.ANOTHER_TASK,
            status_message: Messages.ANOTHER_TASK,
        };
    }
    if (parsedResponse.includes('YbqToMuchTransactionInSector')) {
        const pauseDuration = 60 * 1000; // 1 minute pause
        const pausedUntil = Date.now() + pauseDuration;
        const pauseData = {
            tvAppId,
            Time: time.join(', '),
            pausedUntil: new Date(pausedUntil).toLocaleTimeString(),
        };
        consoleLog(
            '⚠️ Too many transactions in sector, pausing request for 1 minute:',
            JSON.stringify(pauseData, null, 2),
        );
        return {
            ...req,
            status_message: Messages.TOO_MANY_TRANSACTIONS_IN_SECTOR,
            status_color: 'orange',
            updated: true,
            pausedUntil,
        };
    }

    let responseObj;
    try {
        responseObj = JSON.parse(parsedResponse);

        if (responseObj.messageCode === 'NoSlotsAvailable') {
            consoleLog(
                '⚠️ No slots available, keeping in queue:',
                tvAppId,
                time.join(', '),
                parsedResponse,
            );
            return req;
        }

        if (responseObj.messageCode && responseObj.messageCode.includes('FE_0091')) {
            consoleLog(
                '⚠️Awizacja edytowana przez innego użytkownika:',
                tvAppId,
                time.join(', '),
                parsedResponse,
            );
            return {
                ...req,
                status: Statuses.ANOTHER_TASK,
                status_message: Messages.AWIZACJA_EDYTOWANA_PRZEZ_INN_UZYTKOWNIKA,
            };
        }

        if (responseObj.messageCode && responseObj.messageCode.includes('VBS_0072')) {
            consoleLog(
                '⚠️Awizacja nie może zostać zmieniona, ponieważ czas na dokonanie zmian już minął',
                tvAppId,
                time.join(', '),
                parsedResponse,
            );
            return {
                ...req,
                status: Statuses.ERROR,
                status_message: Messages.AWIZACJA_NIE_MOZE_ZOSTAC_ZMIENIONA_CZAS_MINAL,
            };
        }

        // Handle unknown JSON error
        consoleLog('❌ Unknown error occurred:', parsedResponse);
        return {
            ...req,
            status: Statuses.ERROR,
            status_message: responseObj.error || 'Nieznany błąd',
        };
    } catch (e) {
        // Handle non-JSON responses using new error handling system
        consoleLog('❌ Unknown error (not JSON):', parsedResponse);

        if (parsedResponse.includes('<!DOCTYPE html>') || parsedResponse.includes('<html')) {
            // Use the new HTML error detection system
            const htmlError = detectHtmlError(parsedResponse);
            const errorType = determineErrorType(0, parsedResponse); // 0 status since we don't have HTTP status here

            let errorMessage = 'Serwer ma problemy, proszę czekać';
            let status = Statuses.NETWORK_ERROR;

            // Determine specific error details
            if (parsedResponse.includes('Error 500')) {
                errorMessage = 'Błąd serwera (500) - spróbuj ponownie później';
                status = Statuses.NETWORK_ERROR;
            } else if (parsedResponse.includes('Error 404')) {
                errorMessage = 'Nie znaleziono (404) - sprawdź poprawność danych';
                status = Statuses.ERROR;
            } else if (parsedResponse.includes('Error 403')) {
                errorMessage = 'Dostęp zabroniony (403) - brak uprawnień';
                status = Statuses.AUTHORIZATION_ERROR;
            } else if (parsedResponse.includes('Error 401')) {
                errorMessage = 'Nieautoryzowany dostęp (401) - wymagane ponowne logowanie';
                status = Statuses.AUTHORIZATION_ERROR;
            } else if (parsedResponse.includes('Error 400')) {
                errorMessage = 'Nieprawidłowe żądanie (400) - sprawdź dane wejściowe';
                status = Statuses.ERROR;
            } else if (htmlError && htmlError.isError && htmlError.message) {
                errorMessage = `Błąd HTML: ${htmlError.message}`;
            }

            // Try to extract additional error details from HTML
            const errorMatch = parsedResponse.match(/<h[12][^>]*>([^<]+)<\/h[12]>/i);
            if (errorMatch) {
                const details = errorMatch[1].trim();
                if (details && !errorMessage.includes(details)) {
                    errorMessage += ` - ${details}`;
                }
            }

            consoleLog(
                '❌ HTML Error Page received:',
                tvAppId,
                time.join(', '),
                errorType,
                errorMessage,
            );

            return {
                ...req,
                status,
                status_message: errorMessage,
            };
        }

        // Handle other non-JSON errors
        return {
            ...req,
            status: Statuses.ERROR,
            status_message: Messages.UNKNOWN,
        };
    }
}
