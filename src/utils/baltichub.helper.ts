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

    if (parsedResponse.includes('ToMuchTransactionInSector')) {
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
    let responseObj
    try {
        responseObj = JSON.parse(parsedResponse)

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
        if (
            parsedResponse.includes('<!DOCTYPE html>') ||
            parsedResponse.includes('<html')
        ) {
            // Extract error information from HTML
            let errorType = 'Unknown Server Error'
            let errorDetails = ''

            // Check for specific error types in HTML
            if (parsedResponse.includes('Error 500')) {
                errorType = 'Server Error (500)'
            } else if (parsedResponse.includes('Error 404')) {
                errorType = 'Not Found (404)'
            } else if (parsedResponse.includes('Error 403')) {
                errorType = 'Forbidden (403)'
            } else if (parsedResponse.includes('Error 401')) {
                errorType = 'Unauthorized (401)'
            } else if (parsedResponse.includes('Error 400')) {
                errorType = 'Bad Request (400)'
            }

            // Try to extract error message from HTML
            const errorMatch = parsedResponse.match(
                /<h[12][^>]*>([^<]+)<\/h[12]>/i
            )
            if (errorMatch) {
                errorDetails = errorMatch[1].trim()
            }

            consoleLog(
                '❌ HTML Error Page received:',
                tvAppId,
                time.join(', '),
                errorType,
                errorDetails
            )

            return {
                ...req,
                status: Statuses.ERROR,
                status_message: `${errorType}: ${errorDetails || 'Serwer ma problemy, proszę czekać'}`,
            }
        }

        return {
            ...req,
            status: Statuses.ERROR,
            status_message: 'Nieznany błąd (niepoprawny format)',
        }
    }
}
