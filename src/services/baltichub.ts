import { Statuses, Messages, urls } from '../data';
import type { RetryObject } from '../types/baltichub';
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
    JSONstringify,
    formatDateToDMY,
} from '../utils/index';
import { BrevoEmailData } from '../types';

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

export async function checkSlotAvailability(htmlText: string, time: string[]): Promise<boolean> {
    // Validate time array format
    if (!time || time.length < 2 || !time[1]) {
        consoleError('❌ Invalid time format in checkSlotAvailability:', time);
        return false;
    }

    const buttons = parseSlotsIntoButtons(htmlText);

    // Extract time part (HH:MM) - handle both "22:00:00" and "2:00:00" formats
    const timePart = time[1].trim();
    const timeMatch = timePart.match(/^(\d{1,2}):(\d{2})/);

    if (!timeMatch) {
        consoleError('❌ Cannot parse time format:', timePart, 'from time array:', time);
        return false;
    }

    // Normalize to HH:MM format (pad hour if needed)
    const hour = timeMatch[1].padStart(2, '0');
    const minute = timeMatch[2];
    const normalizedTime = `${hour}:${minute}`;

    const slotButton = buttons.find(button => {
        // Check if button text contains the normalized time
        const buttonText = button.text.trim();
        return buttonText.includes(normalizedTime);
    });

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
 * @returns {Promise<{driverName: string, containerNumber: string}>} An object containing the driver's name and container ID.
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

    // Check if retryQueue is defined and is an array
    if (!retryQueue || !Array.isArray(retryQueue)) {
        consoleLog('RetryQueue is undefined or not an array, skipping cache lookup');
    } else {
        const sameItem = retryQueue.find(item => item.tvAppId === tvAppId);
        if (sameItem) {
            return {
                driverName: sameItem.driverName || '',
                containerNumber: sameItem.containerNumber || '',
            };
        }
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
export async function executeRequest(
    req: RetryObject,
    tvAppId: string,
    time: string[],
): Promise<RetryObject> {
    if (!req.body || !req.body.formData) {
        throw new Error('Request body or formData is missing');
    }

    // Update SlotStart and SlotEnd in formData with values from req.startSlot and req.endSlot
    // This ensures we send the correct time that we're searching for, not the cached time
    const originalSlotStart = req.body.formData.SlotStart?.[0];
    const originalSlotEnd = req.body.formData.SlotEnd?.[0];

    if (req.startSlot && req.endSlot) {
        // CRITICAL: Verify we're updating with the correct time
        const needsUpdate = req.body.formData.SlotStart?.[0] !== req.startSlot;

        if (needsUpdate) {
            const updateData = {
                'Original in body': { SlotStart: originalSlotStart, SlotEnd: originalSlotEnd },
                'Will update to': { SlotStart: req.startSlot, SlotEnd: req.endSlot },
                tvAppId,
                '⚠️ FIXING': 'Body had different time, updating to match req.startSlot',
            };
            consoleLog(
                '🔄 Updating slot time (MISMATCH DETECTED):',
                JSON.stringify(updateData, null, 2),
            );
        }

        req.body.formData.SlotStart = [req.startSlot];
        req.body.formData.SlotEnd = [req.endSlot];

        // FINAL VERIFICATION: Ensure update was successful
        const updatedSlotStart = req.body.formData.SlotStart[0];
        const updatedSlotEnd = req.body.formData.SlotEnd[0];

        if (updatedSlotStart !== req.startSlot || updatedSlotEnd !== req.endSlot) {
            const errorData = {
                Expected: { SlotStart: req.startSlot, SlotEnd: req.endSlot },
                Actual: { SlotStart: updatedSlotStart, SlotEnd: updatedSlotEnd },
                tvAppId,
            };
            consoleError('❌ CRITICAL: Time update failed!', JSON.stringify(errorData, null, 2));
            throw new Error(
                `Time update failed: expected ${req.startSlot}, got ${updatedSlotStart}`,
            );
        }

        if (!needsUpdate) {
            const matchData = {
                SlotStart: updatedSlotStart,
                SlotEnd: updatedSlotEnd,
                tvAppId,
                Status: 'Already matches',
            };
            consoleLog('🔄 Slot time already matches:', JSON.stringify(matchData, null, 2));
        } else {
            const verifiedData = {
                SlotStart: updatedSlotStart,
                SlotEnd: updatedSlotEnd,
                tvAppId,
                Status: '✅ Verified',
            };
            consoleLog('✅ Time update verified:', JSON.stringify(verifiedData, null, 2));
        }
    } else {
        const cachedTimeData = {
            SlotStart: originalSlotStart,
            SlotEnd: originalSlotEnd,
            tvAppId,
            'req.startSlot': req.startSlot || 'not set',
            'req.endSlot': req.endSlot || 'not set',
        };
        consoleLog(
            '📤 Sending request with cached slot time:',
            JSON.stringify(cachedTimeData, null, 2),
        );
    }

    const formData = createFormData(req.body.formData);

    const requestData = {
        URL: req.url,
        tvAppId,
        SlotStart: req.body.formData.SlotStart?.[0] || 'not set',
        SlotEnd: req.body.formData.SlotEnd?.[0] || 'not set',
        'Time array': time.join(', '),
    };
    consoleLog('📤 Sending booking request:', JSON.stringify(requestData, null, 2));

    const response = await fetchRequest(req.url, {
        method: 'POST',
        headers: {
            'X-Extension-Request': 'JustPrivetProject',
            credentials: 'include',
        },
        body: formData,
    });

    const parsedResponse = await response.text();

    const responseStatus = 'status' in response ? response.status : 'N/A';
    const responseOk = 'ok' in response ? response.ok : false;

    // CRITICAL: Log all identifiers to track which request was actually sent
    const responseData = {
        Status: responseStatus,
        OK: responseOk,
        tvAppId,
        'Time sent': time.join(', '),
        'SlotStart SENT': req.body.formData.SlotStart?.[0] || 'not set',
        'SlotEnd SENT': req.body.formData.SlotEnd?.[0] || 'not set',
        'req.startSlot': req.startSlot || 'not set',
        'req.endSlot': req.endSlot || 'not set',
        'Response length': parsedResponse.length,
        "Contains 'error'": parsedResponse.includes('error'),
        '⚠️ VERIFY':
            req.body.formData.SlotStart?.[0] === req.startSlot ? '✅ YES' : '❌ NO - MISMATCH!',
    };
    consoleLog('📥 Received response:', JSON.stringify(responseData, null, 2));
    if (!parsedResponse.includes('error') && response.ok) {
        const successData = {
            tvAppId,
            Time: time.join(', '),
            SlotStart: req.body.formData.SlotStart?.[0] || 'not set',
            SlotEnd: req.body.formData.SlotEnd?.[0] || 'not set',
        };
        consoleLog('✅ Request retried successfully:', JSON.stringify(successData, null, 2));

        // Send centralized notifications (Windows + Email)
        try {
            consoleLog('🎉 Booking success! Preparing to send notifications...');

            const notificationData: Partial<BrevoEmailData> = {
                tvAppId,
                bookingTime: req.startSlot.split(' ')[1].slice(0, 5), // newTime
                driverName: req.driverName,
                containerNumber: req.containerNumber,
            };
            consoleLog('🎉 Notification data prepared:', notificationData);

            await notificationService.sendBookingSuccessNotifications(
                notificationData as BrevoEmailData,
            );
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
 * Validates a request before checking slot availability (without server request)
 * Returns null if validation passed, RetryObject with error status if validation failed
 * @param req - The request object to validate
 * @param queue - The queue of tasks to check for task completion
 * @returns Promise<RetryObject | null> - null if valid, RetryObject with error status if invalid
 */
export async function validateRequestBeforeSlotCheck(
    req: RetryObject,
    queue: RetryObject[],
): Promise<RetryObject | null> {
    const body = normalizeFormData(req.body).formData;
    const tvAppId = body.TvAppId[0];
    const time = body.SlotStart[0].split(' ');
    const endTimeStr = parseDateTimeFromDMY(body.SlotEnd[0]); // 26.06.2025 00:59:00
    const currentTimeSlot = new Date(req.currentSlot);
    const currentTime = new Date();

    if (new Date(endTimeStr.getTime() + 61 * 1000) < currentTime) {
        consoleLog('❌ End time is in the past, cannot process:', tvAppId);
        return {
            ...req,
            status: Statuses.EXPIRED,
            status_message: Messages.EXPIRED,
        };
    }

    if (currentTimeSlot < currentTime) {
        consoleLog('❌ Changing the time is no longer possible:', tvAppId);
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

    // Validation passed
    return null;
}
