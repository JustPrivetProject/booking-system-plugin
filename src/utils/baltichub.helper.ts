import { Statuses } from '../data'
import { RetryObject } from '../types/baltichub'
import { consoleLog, consoleError } from './utils-function'

export const parseSlotsIntoButtons = (htmlText: string) => {
    const buttonRegex = /<button[^>]*>(.*?)<\/button>/gs
    const buttons = [...htmlText.matchAll(buttonRegex)].map((match) => {
        const buttonHTML = match[0] // The entire matched <button>...</button> tag
        const text = match[1].trim() // The text inside the button
        const disabled = /disabled/i.test(buttonHTML) // Check for the presence of the disabled attribute

        return { text, disabled }
    })
    return buttons
}
export function isTaskCompletedInAnotherQueue(
    req: RetryObject,
    queue: RetryObject[]
) {
    return queue.some(
        (task) => task.tvAppId === req.tvAppId && task.status === 'success'
    )
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
    time: string[]
): RetryObject {
    if (parsedResponse.includes('CannotCreateTvaInSelectedSlot')) {
        consoleLog(
            '❌ Retry failed, keeping in queue:',
            tvAppId,
            time.join(', '),
            parsedResponse
        )
        return req
    }

    if (parsedResponse.includes('TaskWasUsedInAnotherTva')) {
        consoleLog(
            '✅ The request was executed in another task:',
            tvAppId,
            time.join(', '),
            parsedResponse
        )
        return {
            ...req,
            status: Statuses.ANOTHER_TASK,
            status_message: 'Zadanie zakończone w innym wątku',
        }
    }

    let responseObj
    try {
        responseObj = JSON.parse(parsedResponse)

        // Handle specific error codes
        if (
            responseObj.messageCode &&
            responseObj.messageCode.includes('ToMuchTransactionInSector')
        ) {
            consoleLog(
                '⚠️ Too many transactions in sector, keeping in queue:',
                tvAppId,
                time.join(', '),
                parsedResponse
            )
            return {
                ...req,
                status_message: 'Za duża ilość transakcji w sektorze',
            }
        }

        if (responseObj.messageCode === 'NoSlotsAvailable') {
            consoleLog(
                '⚠️ No slots available, keeping in queue:',
                tvAppId,
                time.join(', '),
                parsedResponse
            )
            return req
        }

        if (
            responseObj.messageCode &&
            responseObj.messageCode.includes('FE_0091')
        ) {
            consoleLog(
                '⚠️Awizacja edytowana przez innego użytkownika:',
                tvAppId,
                time.join(', '),
                parsedResponse
            )
            return {
                ...req,
                status: Statuses.ANOTHER_TASK,
                status_message:
                    'Awizacja edytowana przez innego użytkownika. Otwórz okno ponownie w celu aktualizacji awizacji',
            }
        }

        if (
            responseObj.messageCode &&
            responseObj.messageCode.includes('VBS_0072')
        ) {
            consoleLog(
                '⚠️Awizacja nie może zostać zmieniona, ponieważ czas na dokonanie zmian już minął',
                tvAppId,
                time.join(', '),
                parsedResponse
            )
            return {
                ...req,
                status: Statuses.ERROR,
                status_message:
                    'Awizacja nie może zostać zmieniona, ponieważ czas na dokonanie zmian już minął',
            }
        }

        // Handle unknown JSON error
        consoleLog('❌ Unknown error occurred:', parsedResponse)
        return {
            ...req,
            status: Statuses.ERROR,
            status_message: responseObj.error || 'Nieznany błąd',
        }
    } catch (e) {
        // Handle non-JSON responses
        consoleLog('❌ Unknown error (not JSON):', parsedResponse)
        return {
            ...req,
            status: Statuses.ERROR,
            status_message: 'Nieznany błąd (niepoprawny format)',
        }
    }
}
