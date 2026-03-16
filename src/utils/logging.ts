/* eslint-disable no-console */
import { LOGS_LENGTH } from '../data';
import { errorLogService } from '../services/errorLogService';

type LogType = 'log' | 'error';

export interface SessionLogEntry {
    type: LogType;
    message: string;
    timestamp: string;
}

function formatLogMessage(args: unknown[]): string {
    return args.map(arg => (arg instanceof Error ? arg.message : String(arg))).join(' ');
}

function getTimestampPrefix(): [string, string, string] {
    const date = new Date().toLocaleString('pl-PL', {
        timeZone: 'Europe/Warsaw',
    });

    return [
        `%c[${date}] %c[JustPrivetProject]:`,
        'color: #00bfff; font-weight: bold;',
        'color: #ff8c00; font-weight: bold;',
    ];
}

export function consoleLog(...args: unknown[]) {
    if (process.env.NODE_ENV === 'development') {
        console.log(...getTimestampPrefix(), ...args);
    }
    // Save log to chrome.storage.session
    saveLogToSession('log', args).catch(e => {
        console.log('Error saving log to chrome.storage.session:', e);
    });
}

export function consoleLogWithoutSave(...args: unknown[]) {
    if (process.env.NODE_ENV === 'development') {
        console.log(...getTimestampPrefix(), ...args);
    }
}

export function consoleError(...args: unknown[]) {
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
export async function saveLogToSession(type: LogType, args: unknown[]) {
    return new Promise<void>(resolve => {
        chrome.storage.session.get({ bramaLogs: [] as SessionLogEntry[] }, ({ bramaLogs }) => {
            const nextLogs = [...bramaLogs];
            // Add new log entry
            nextLogs.push({
                type,
                message: formatLogMessage(args),
                timestamp: new Date().toISOString(),
            });
            // Keep only the last LOGS_LENGTH entries
            const trimmedLogs =
                nextLogs.length > LOGS_LENGTH ? nextLogs.slice(-LOGS_LENGTH) : nextLogs;

            chrome.storage.session.set({ bramaLogs: trimmedLogs }, () => resolve());
        });
    });
}

export async function getLogsFromSession() {
    return new Promise<SessionLogEntry[]>(resolve => {
        chrome.storage.session.get({ bramaLogs: [] as SessionLogEntry[] }, ({ bramaLogs }) => {
            resolve(bramaLogs);
        });
    });
}

export async function clearLogsInSession() {
    return new Promise<void>(resolve => {
        chrome.storage.session.set({ bramaLogs: [] }, () => resolve());
    });
}
