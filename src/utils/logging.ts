import { LOGS_LENGTH } from '../data';
import { errorLogService } from '../services/errorLogService';

export function consoleLog(...args: any[]) {
    if (process.env.NODE_ENV === 'development') {
        const date = new Date().toLocaleString('pl-PL', {
            timeZone: 'Europe/Warsaw',
        });
        console.log(
            `%c[${date}] %c[JustPrivetProject]:`,
            'color: #00bfff; font-weight: bold;',
            'color: #ff8c00; font-weight: bold;',
            ...args,
        );
    }
    // Save log to chrome.storage.session
    saveLogToSession('log', args).catch(e => {
        console.warn('Error saving log to chrome.storage.session:', e);
    });
}

export function consoleLogWithoutSave(...args: any[]) {
    if (process.env.NODE_ENV === 'development') {
        const date = new Date().toLocaleString('pl-PL', {
            timeZone: 'Europe/Warsaw',
        });
        console.log(
            `%c[${date}] %c[JustPrivetProject]:`,
            'color: #00bfff; font-weight: bold;',
            'color: #ff8c00; font-weight: bold;',
            ...args,
        );
    }
}

export function consoleError(...args: any[]) {
    const date = new Date().toLocaleString('pl-PL', {
        timeZone: 'Europe/Warsaw',
    });
    console.error(
        `%c[${date}] %c[JustPrivetProject] %c:`,
        'color: #00bfff; font-weight: bold;',
        'color: #ff8c00; font-weight: bold;',
        'color:rgb(192, 4, 4); font-weight: bold;',
        ...args,
    );
    // Save error to chrome.storage.session
    saveLogToSession('error', args).catch(e => {
        console.error('Error saving error to chrome.storage.session:', e);
    });
    // Log to Supabase only in development
    if (process.env.NODE_ENV === 'development') {
        const errorMessage = args
            .map(arg => (arg instanceof Error ? arg.message : String(arg)))
            .join(' ');
        errorLogService.logError(errorMessage, 'background', { args });
    }
}

// Async helpers for chrome.storage.session
export async function saveLogToSession(type: 'log' | 'error', args: any[]) {
    return new Promise<void>(resolve => {
        chrome.storage.session.get({ bramaLogs: [] }, ({ bramaLogs }) => {
            // Add new log entry
            bramaLogs.push({
                type,
                message: args.map(String).join(' '),
                timestamp: new Date().toISOString(),
            });
            // Keep only the last LOGS_LENGTH entries
            if (bramaLogs.length > LOGS_LENGTH) {
                bramaLogs = bramaLogs.slice(-LOGS_LENGTH);
            }

            chrome.storage.session.set({ bramaLogs }, () => resolve());
        });
    });
}

export async function getLogsFromSession() {
    return new Promise<any[]>(resolve => {
        chrome.storage.session.get({ bramaLogs: [] }, ({ bramaLogs }) => {
            resolve(bramaLogs);
        });
    });
}

export async function clearLogsInSession() {
    return new Promise<void>(resolve => {
        chrome.storage.session.set({ bramaLogs: [] }, () => resolve());
    });
}
