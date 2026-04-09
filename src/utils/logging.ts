/* eslint-disable no-console */
import { LOGS_LENGTH } from '../data';
import { errorLogService } from '../services/errorLogService';

type LogType = 'log' | 'error';

export interface LogContext {
    scope?: string;
    terminal?: string;
}

export interface SessionLogEntry {
    type: LogType;
    message: string;
    timestamp: string;
}

function canUseSessionStorage(): boolean {
    return Boolean(globalThis.chrome?.storage?.session);
}

function getSessionLogsFromResult(result: unknown): SessionLogEntry[] {
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
        return [];
    }

    const logs = (result as { bramaLogs?: SessionLogEntry[] }).bramaLogs;
    return Array.isArray(logs) ? logs : [];
}

function formatLogMessage(args: unknown[]): string {
    return args.map(arg => (arg instanceof Error ? arg.message : String(arg))).join(' ');
}

function formatContextLabel(context?: LogContext): string {
    if (!context) {
        return '';
    }

    const labels = [context.scope, context.terminal?.toUpperCase()].filter(Boolean);

    if (!labels.length) {
        return '';
    }

    return labels.map(label => `[${label}]`).join('');
}

function addContextToArgs(context: LogContext | undefined, args: unknown[]): unknown[] {
    const contextLabel = formatContextLabel(context);

    if (!contextLabel) {
        return args;
    }

    return [contextLabel, ...args];
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

export function consoleLogWithContext(context: LogContext, ...args: unknown[]) {
    return consoleLog(...addContextToArgs(context, args));
}

export function consoleLogWithoutSave(...args: unknown[]) {
    if (process.env.NODE_ENV === 'development') {
        console.log(...getTimestampPrefix(), ...args);
    }
}

export function consoleLogWithoutSaveWithContext(context: LogContext, ...args: unknown[]) {
    return consoleLogWithoutSave(...addContextToArgs(context, args));
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

export function consoleErrorWithContext(context: LogContext, ...args: unknown[]) {
    return consoleError(...addContextToArgs(context, args));
}

// Async helpers for chrome.storage.session
export async function saveLogToSession(type: LogType, args: unknown[]) {
    if (!canUseSessionStorage()) {
        return;
    }

    return new Promise<void>(resolve => {
        try {
            chrome.storage.session.get({ bramaLogs: [] as SessionLogEntry[] }, result => {
                if (chrome.runtime.lastError || !canUseSessionStorage()) {
                    resolve();
                    return;
                }

                const bramaLogs = getSessionLogsFromResult(result);
                const nextLogs = [...bramaLogs];
                nextLogs.push({
                    type,
                    message: formatLogMessage(args),
                    timestamp: new Date().toISOString(),
                });

                const trimmedLogs =
                    nextLogs.length > LOGS_LENGTH ? nextLogs.slice(-LOGS_LENGTH) : nextLogs;

                chrome.storage.session.set({ bramaLogs: trimmedLogs }, () => {
                    resolve();
                });
            });
        } catch {
            resolve();
        }
    });
}

export async function getLogsFromSession() {
    if (!canUseSessionStorage()) {
        return [];
    }

    return new Promise<SessionLogEntry[]>(resolve => {
        try {
            chrome.storage.session.get({ bramaLogs: [] as SessionLogEntry[] }, result => {
                if (chrome.runtime.lastError || !canUseSessionStorage()) {
                    resolve([]);
                    return;
                }

                resolve(getSessionLogsFromResult(result));
            });
        } catch {
            resolve([]);
        }
    });
}

export async function clearLogsInSession() {
    if (!canUseSessionStorage()) {
        return;
    }

    return new Promise<void>(resolve => {
        try {
            chrome.storage.session.set({ bramaLogs: [] }, () => {
                resolve();
            });
        } catch {
            resolve();
        }
    });
}
