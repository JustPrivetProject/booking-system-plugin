import {
    consoleLog,
    consoleError,
    fetchRequest,
    normalizeFormData,
    parseDateTimeFromDMY,
    consoleLogWithoutSave,
    JSONstringify,
} from '../utils/utils-function'
import { Statuses } from '../data'
import { createFormData } from '../utils/utils-function'
import { RetryObject } from '../types/baltichub'
import {
    parseSlotsIntoButtons,
    handleErrorResponse,
    isTaskCompletedInAnotherQueue,
} from '../utils/baltichub.helper'
import { setStorage } from '../utils/storageControl.helper'

export async function getSlots(
    date: string
): Promise<Response | { ok: false; text: () => Promise<string> }> {
    const [day, month, year] = date.split('.').map(Number)
    const newDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
    const dateAfterTransfer = newDate.toISOString()
    return fetchRequest('https://ebrama.baltichub.com/Home/GetSlots', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            'X-requested-with': 'XMLHttpRequest',
            Referer: 'https://ebrama.baltichub.com/vbs-slots',
            Accept: '*/*',
            'X-Extension-Request': 'JustPrivetProject',
        },
        body: JSON.stringify({ date: dateAfterTransfer, type: 1 }), // 26.02.2025
        credentials: 'include',
    })
}

export async function getEditForm(
    tvAppId: string
): Promise<Response | { ok: false; text: () => Promise<string> }> {
    return fetchRequest(
        `https://ebrama.baltichub.com/TVApp/EditTvAppModal?tvAppId=${tvAppId}`,
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
        }
    )
}

async function checkSlotAvailability(
    htmlText: string,
    time: string[]
): Promise<boolean> {
    const buttons = parseSlotsIntoButtons(htmlText)
    const slotButton = buttons.find((button) =>
        button.text.includes(time[1].slice(0, 5))
    )
    consoleLogWithoutSave('Slot button:', slotButton)
    return slotButton ? !slotButton.disabled : false
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
    retryQueue: RetryObject[]
): Promise<{ driverName: string; containerNumber: string }> {
    consoleLog('Getting driver name and container for TV App ID:', tvAppId)
    const regex =
        /<select[^>]*id="SelectedDriver"[^>]*>[\s\S]*?<option[^>]*selected="selected"[^>]*>(.*?)<\/option>/
    const containerIdRegex = /"ContainerId":"([^"]+)"/
    const sameItem = retryQueue.find((item) => item.tvAppId === tvAppId)

    if (sameItem) {
        return {
            driverName: sameItem.driverName || '',
            containerNumber: sameItem.containerNumber || '',
        }
    }

    const response = await getEditForm(tvAppId)
    if (!response.ok) {
        consoleLog(
            'Error getting driver name: Response not OK',
            JSONstringify(response)
        )
        return { driverName: '', containerNumber: '' }
    }

    const request = await response.text()
    consoleLog('Request Edit form:', request)
    if (!request.trim()) {
        consoleLog('Error getting driver name: Response is empty')
        return { driverName: '', containerNumber: '' }
    }

    const driverNameObject = request.match(regex)?.[1] || ''
    const driverNameItems = driverNameObject.split(' ')
    const driverName =
        `${driverNameItems[0] || ''} ${driverNameItems[1] || ''}`.trim()

    const containerNumberMatch = request.match(containerIdRegex)
    const containerNumber = containerNumberMatch?.[1] || ''

    consoleLog('Driver info:', driverName)
    consoleLog('Container ID:', containerNumber)
    return {
        driverName,
        containerNumber,
    }
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
    time: string[]
): Promise<{ status: string; status_message: string }> {
    const formData = createFormData(req.body!.formData)

    const response = await fetchRequest(req.url, {
        method: 'POST',
        headers: {
            'X-Extension-Request': 'JustPrivetProject',
            credentials: 'include',
        },
        body: formData,
    })

    const parsedResponse = await response.text()
    if (!parsedResponse.includes('error') && response.ok) {
        consoleLog('✅Request retried successfully:', tvAppId, time.join(', '))
        // Send notification to user
        try {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: './icon-144x144.png',
                title: 'Zmiana czasu',
                message: `✅ Zmiana czasu dla nr ${tvAppId} - zakończyła się pomyślnie - ${time[1].slice(0, 5)}`,
                priority: 2,
            })
        } catch (error) {
            consoleError('Error sending notification:', error)
        }

        return {
            ...req,
            status: Statuses.SUCCESS,
            status_message: 'Zadanie zakończone sukcesem',
        }
    }

    return handleErrorResponse(req, parsedResponse, tvAppId, time)
    // TODO: add action to update grid
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
export async function processRequest(
    req: RetryObject,
    queue: RetryObject[]
): Promise<{ status: string; status_message: string }> {
    let body = normalizeFormData(req.body).formData
    const tvAppId = body.TvAppId[0]
    const time = body.SlotStart[0].split(' ')
    const endTimeStr = parseDateTimeFromDMY(body.SlotEnd[0]) // 26.06.2025 00:59:00
    const currentTimeSlot = new Date(req.currentSlot)
    const currentTIme = new Date()

    if (new Date(endTimeStr.getTime() + 90 * 1000) < currentTIme) {
        consoleLog(
            '❌ End time is in the past, cannot process:',
            tvAppId,
            endTimeStr
        )
        return {
            ...req,
            status: Statuses.EXPIRED,
            status_message: 'Czas zakończenia slotu już minął',
        }
    }

    if (currentTimeSlot < currentTIme) {
        consoleLog(
            '❌ Changing the time is no longer possible:',
            tvAppId,
            endTimeStr
        )
        return {
            ...req,
            status: Statuses.EXPIRED,
            status_message:
                'Awizacja nie może zostać zmieniona, ponieważ czas na dokonanie zmian już minął',
        }
    }

    if (isTaskCompletedInAnotherQueue(req, queue)) {
        consoleLog(
            '✅ The request was executed in another task:',
            tvAppId,
            time.join(', ')
        )
        return {
            ...req,
            status: Statuses.ANOTHER_TASK,
            status_message: 'Zadanie zakończone w innym wątku',
        }
    }
    const slots = await getSlots(time[0])
    // Check Authorization
    if (!slots.ok) {
        consoleLog('❌ Problem with authorization:', tvAppId, time.join(', '))
        setStorage({ unauthorized: true })
        return {
            ...req,
            status: Statuses.AUTHORIZATION_ERROR,
            status_message: 'Problem z autoryzacją',
        }
    }
    const htmlText = await slots.text()
    const isSlotAvailable = await checkSlotAvailability(htmlText, time)
    if (!isSlotAvailable) {
        consoleLogWithoutSave(
            '❌ No slots, keeping in queue:',
            tvAppId,
            time.join(', ')
        )
        return req
    }
    const objectToReturn = await executeRequest(req, tvAppId, time)
    return objectToReturn
}
