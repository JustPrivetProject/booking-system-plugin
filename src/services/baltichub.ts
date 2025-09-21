import { Statuses, Messages, urls } from '../data';
import type { RetryObject } from '../types/baltichub';
import { setStorage } from '../utils';
import {
    parseSlotsIntoButtons,
    handleErrorResponse,
    isTaskCompletedInAnotherQueue,
} from '../utils/baltichub.helper';
import { notificationService } from './notificationService';
import type { ErrorResponse } from '../utils/index';
import {
    consoleLog,
    consoleError,
    fetchRequest,
    normalizeFormData,
    createFormData,
    parseDateTimeFromDMY,
    consoleLogWithoutSave,
    JSONstringify,
    formatDateToDMY,
    ErrorType,
} from '../utils/index';

export async function getSlots(date: string): Promise<Response | ErrorResponse> {
    const [day, month, year] = date.split('.').map(Number);
    const newDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const dateAfterTransfer = formatDateToDMY(newDate);
    return fetchRequest(urls.getSlots, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            Referer: 'https://ebrama.baltichub.com/tv-apps',
            Accept: '*/*',
        },
        body: JSON.stringify({ date: dateAfterTransfer, type: 1 }), // 07.08.2025 26.02.2025
    });
}

export async function getEditForm(tvAppId: string): Promise<Response | ErrorResponse> {
    return fetchRequest(`${urls.editTvAppModal}?tvAppId=${tvAppId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            'X-requested-with': 'XMLHttpRequest',
            Referer: 'https://ebrama.baltichub.com/tv-apps',
            Accept: '*/*',
            'X-Extension-Request': 'JustPrivetProject',
        },
        credentials: 'include',
    });
}

async function checkSlotAvailability(htmlText: string, time: string[]): Promise<boolean> {
    const buttons = parseSlotsIntoButtons(htmlText);
    const slotButton = buttons.find(button => button.text.includes(time[1].slice(0, 5)));
    consoleLogWithoutSave('Slot button:', slotButton);
    return slotButton ? !slotButton.disabled : false;
}

/**
 * Retrieves the driver name and container ID associated with a given tvAppId.
 * If the tvAppId exists in the retryQueue, it returns the cached driver name and container number.
 * Otherwise, it fetches the edit form, extracts the driver name and container ID from the response, and returns them.
 *
 * @async
 * @function getDriverNameAndContainer
 * @param {string} tvAppId - The ID of the TV application to retrieve data for.
 * @param {Array<Object>} retryQueue - An array of retry queue objects, each containing `tvAppId`, `driverName`, and `containerNumber`.
 * @returns {Promise<{driverName: string} | null>} An object containing the driver's name and container ID, or `null` if an error occurs.
 * @throws Will log an error message to the console if an exception is encountered during processing.
 */

export async function getDriverNameAndContainer(
    tvAppId: string,
    retryQueue: RetryObject[],
): Promise<{ driverName: string; containerNumber: string }> {
    consoleLog('Getting driver name and container for TV App ID:', tvAppId);
    const regex =
        /<select[^>]*id="SelectedDriver"[^>]*>[\s\S]*?<option[^>]*selected="selected"[^>]*>(.*?)<\/option>/;
    const containerIdRegex = /"ContainerId":"([^"]+)"/;
    const sameItem = retryQueue.find(item => item.tvAppId === tvAppId);

    if (sameItem) {
        return {
            driverName: sameItem.driverName || '',
            containerNumber: sameItem.containerNumber || '',
        };
    }

    const response = await getEditForm(tvAppId);
    if (!response.ok) {
        consoleLog('Error getting driver name: Response not OK', JSONstringify(response));
        return { driverName: '', containerNumber: '' };
    }

    const tvAppEditText = await response.text();
    consoleLog('Request Edit form:', tvAppEditText);
    if (!tvAppEditText.trim()) {
        consoleLog('Error getting driver name: Response is empty');
        return { driverName: '', containerNumber: '' };
    }

    const driverNameObject = tvAppEditText.match(regex)?.[1] || '';
    const driverNameItems = driverNameObject.split(' ');
    const driverName = `${driverNameItems[0] || ''} ${driverNameItems[1] || ''}`.trim();

    const containerNumberMatch = tvAppEditText.match(containerIdRegex);
    const containerNumber = containerNumberMatch?.[1] || '';

    consoleLog('Driver info:', driverName);
    consoleLog('Container ID:', containerNumber);
    return {
        driverName,
        containerNumber,
    };
}

/**
 * Executes an HTTP POST request with the provided data and handles the response.
 *
 * @async
 * @function
 * @param {Object} req - The request object containing the URL, headers, and body data.
 * @param {string} req.url - The URL to send the request to.
 * @param {Object} req.headersCache - Cached headers for the request.
 * @param {Object} req.headersCache.headers - Headers to include in the request.
 * @param {Object} req.body - The body of the request.
 * @param {Object} req.body.formData - The form data to be sent in the request body.
 * @param {string} tvAppId - The identifier for the TV application.
 * @param {Array<string>} time - An array containing time-related data.
 * @returns {Promise<Object>} A promise that resolves to an object containing the updated request status and message.
 * @throws {Error} If there is an issue with sending the notification or handling the response.
 */
async function executeRequest(
    req: RetryObject,
    tvAppId: string,
    time: string[],
): Promise<RetryObject> {
    const formData = createFormData(req.body!.formData);

    const response = await fetchRequest(req.url, {
        method: 'POST',
        headers: {
            'X-Extension-Request': 'JustPrivetProject',
            credentials: 'include',
        },
        body: formData,
    });

    const parsedResponse = await response.text();
    if (!parsedResponse.includes('error') && response.ok) {
        consoleLog('✅Request retried successfully:', tvAppId, time.join(', '));

        // Send centralized notifications (Windows + Email)
        try {
            consoleLog('🎉 Booking success! Preparing to send notifications...');
            const notificationData = {
                tvAppId,
                bookingTime: time[1] || new Date().toISOString(),
                driverName: req.driverName,
                containerNumber: req.containerNumber,
            };
            consoleLog('🎉 Notification data prepared:', notificationData);

            await notificationService.sendBookingSuccessNotifications(notificationData);
            consoleLog('🎉 Notification process completed');
        } catch (error) {
            consoleError('❌ Error sending notifications:', error);
        }

        return {
            ...req,
            status: Statuses.SUCCESS,
            status_message: Messages.SUCCESS,
        };
    }

    return handleErrorResponse(req, parsedResponse, tvAppId, time);
}

/**
 * Processes a request by normalizing its form data, checking task completion,
 * verifying authorization, checking slot availability, and executing the request if applicable.
 *
 * @async
 * @function
 * @param {Object} req - The request object containing the body and other details.
 * @param {Array} queue - The queue of tasks to check for task completion.
 * @returns {Promise<Object>} A promise that resolves to the updated request object with status and status_message.
 *
 * @throws {Error} Throws an error if there is an issue during slot retrieval or execution.
 *
 * @example
 * const req = {
 *   body: {
 *     TvAppId: ['12345'],
 *     SlotStart: ['2023-10-01 10:00']
 *   }
 * };
 * const queue = [];
 * const result = await processRequest(req, queue);
 * console.log(result);
 */
export async function processRequest(req: RetryObject, queue: RetryObject[]): Promise<RetryObject> {
    const body = normalizeFormData(req.body).formData;
    const tvAppId = body.TvAppId[0];
    const time = body.SlotStart[0].split(' ');
    const endTimeStr = parseDateTimeFromDMY(body.SlotEnd[0]); // 26.06.2025 00:59:00
    const currentTimeSlot = new Date(req.currentSlot);
    const currentTIme = new Date();

    if (new Date(endTimeStr.getTime() + 61 * 1000) < currentTIme) {
        consoleLog('❌ End time is in the past, cannot process:', tvAppId, endTimeStr);
        return {
            ...req,
            status: Statuses.EXPIRED,
            status_message: Messages.EXPIRED,
        };
    }

    if (currentTimeSlot < currentTIme) {
        consoleLog('❌ Changing the time is no longer possible:', tvAppId, endTimeStr);
        return {
            ...req,
            status: Statuses.EXPIRED,
            status_message: Messages.AWIZACJA_NIE_MOZE_ZOSTAC_ZMIENIONA_CZAS_MINAL,
        };
    }

    if (isTaskCompletedInAnotherQueue(req, queue)) {
        consoleLog('✅ The request was executed in another task:', tvAppId, time.join(', '));
        return {
            ...req,
            status: Statuses.ANOTHER_TASK,
            status_message: 'Zadanie zakończone w innym wątku',
        };
    }
    const slots = await getSlots(time[0]);
    // Check Authorization
    if (!slots.ok && 'error' in slots) {
        consoleLog('❌ Problem with request:', tvAppId, time.join(', '), slots.error);

        // Handle different error types
        switch (slots.error.type) {
            case ErrorType.CLIENT_ERROR:
                if (slots.error.status === 401) {
                    setStorage({ unauthorized: true });
                    return {
                        ...req,
                        status: Statuses.AUTHORIZATION_ERROR,
                        status_message: 'Problem z autoryzacją - nieautoryzowany dostęp',
                    };
                }
                break;
            case ErrorType.SERVER_ERROR:
                return {
                    ...req,
                    status: Statuses.NETWORK_ERROR,
                    status_message: 'Problem z serwerem - spróbuj ponownie później',
                };
            case ErrorType.HTML_ERROR:
                return {
                    ...req,
                    status: Statuses.AUTHORIZATION_ERROR,
                    status_message: 'Problem z autoryzacją - strona błędu',
                };
            case ErrorType.NETWORK:
                return {
                    ...req,
                    status: Statuses.AUTHORIZATION_ERROR,
                    status_message: 'Problem z połączeniem sieciowym',
                };
            default:
                return {
                    ...req,
                    status: Statuses.NETWORK_ERROR,
                    status_message: Messages.UNKNOWN,
                };
        }
    }
    const htmlText = await slots.text();
    const isSlotAvailable = await checkSlotAvailability(htmlText, time);
    if (!isSlotAvailable) {
        consoleLogWithoutSave('❌ No slots, keeping in queue:', tvAppId, time.join(', '));
        return req;
    }
    const objectToReturn = await executeRequest(req, tvAppId, time);
    return objectToReturn;
}
