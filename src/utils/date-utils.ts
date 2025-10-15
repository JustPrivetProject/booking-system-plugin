/**
 * Converts a date string from the format "DD.MM.YYYY HH:mm[:ss]" to a Date object.
 * @param input Date string, e.g. "26.06.2025 00:59:00" or "26.06.2025 00:59"
 * @returns Date object or Invalid Date if the format is incorrect
 */
export function parseDateTimeFromDMY(input: string): Date {
    const [datePart, timePart] = input.split(' ');
    if (!datePart || !timePart) return new Date(NaN);
    const [day, month, year] = datePart.split('.').map(Number);
    if (!day || !month || !year) return new Date(NaN);
    // Если timePart без секунд, добавим :00
    const time = timePart.length === 5 ? `${timePart}:00` : timePart;
    const isoString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${time}`;
    return new Date(isoString);
}

/**
 * Formats a Date object to the format "DD.MM.YYYY"
 * @param date Date object to format (defaults to current date)
 * @returns Formatted date string, e.g. "07.08.2025"
 */
export function formatDateToDMY(date: Date = new Date()): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

/**
 * Gets today's date in the format "DD.MM.YYYY"
 * @returns Today's date as string, e.g. "07.08.2025"
 */
export function getTodayFormatted(): string {
    return formatDateToDMY(new Date());
}

/**
 * Formats a date/time string to HH:MM format for email subjects
 * @param timeStr Date string in various formats (ISO, DD.MM.YYYY HH:mm, etc.)
 * @returns Formatted time string, e.g. "18:00"
 */
export function formatTimeForEmail(timeStr: string): string {
    if (!timeStr) return '';

    // If it's already in HH:MM format, return as is
    if (timeStr.match(/^\d{1,2}:\d{2}$/)) {
        return timeStr;
    }

    // If it's in HH:MM:SS format, remove seconds
    if (timeStr.match(/^\d{1,2}:\d{2}:\d{2}$/)) {
        return timeStr.substring(0, 5);
    }

    try {
        const date = new Date(timeStr);
        if (!isNaN(date.getTime())) {
            // Format as HH:MM (e.g., "18:00")
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${hours}:${minutes}`;
        }
    } catch (error) {
        // Fallback to original logic for simple time strings
    }

    // If time is in ISO format, extract only time part
    if (timeStr.includes('T')) {
        const timePart = timeStr.split('T')[1];
        if (timePart) {
            // Remove seconds if present
            return timePart.substring(0, 5);
        }
        return timeStr;
    }

    // If it's a date-time string like "2025-07-30 18:00:00", extract time part
    if (timeStr.match(/^\d{4}-\d{2}-\d{2} \d{1,2}:\d{2}(:\d{2})?$/)) {
        const timePart = timeStr.split(' ')[1];
        if (timePart) {
            return timePart.substring(0, 5);
        }
    }

    return timeStr;
}
