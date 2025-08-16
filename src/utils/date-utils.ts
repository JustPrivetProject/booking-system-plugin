/**
 * Converts a date string from the format "DD.MM.YYYY HH:mm[:ss]" to a Date object.
 * @param input Date string, e.g. "26.06.2025 00:59:00" or "26.06.2025 00:59"
 * @returns Date object or Invalid Date if the format is incorrect
 */
export function parseDateTimeFromDMY(input: string): Date {
    const [datePart, timePart] = input.split(' ')
    if (!datePart || !timePart) return new Date(NaN)
    const [day, month, year] = datePart.split('.').map(Number)
    if (!day || !month || !year) return new Date(NaN)
    // Если timePart без секунд, добавим :00
    const time = timePart.length === 5 ? `${timePart}:00` : timePart
    const isoString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${time}`
    return new Date(isoString)
}

/**
 * Formats a Date object to the format "DD.MM.YYYY"
 * @param date Date object to format (defaults to current date)
 * @returns Formatted date string, e.g. "07.08.2025"
 */
export function formatDateToDMY(date: Date = new Date()): string {
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}.${month}.${year}`
}

/**
 * Gets today's date in the format "DD.MM.YYYY"
 * @returns Today's date as string, e.g. "07.08.2025"
 */
export function getTodayFormatted(): string {
    return formatDateToDMY(new Date())
}
