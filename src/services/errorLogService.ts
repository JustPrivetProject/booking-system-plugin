import type { ErrorType } from '../utils/index';

import { supabase } from './supabaseClient';

interface ErrorLog {
    error_message: string;
    error_stack?: string;
    source: string;
    additional_data?: Record<string, any>;
    created_at?: string;
}

interface RequestErrorLog extends ErrorLog {
    error_type: ErrorType;
    http_status?: number;
    url?: string;
    attempt?: number;
    response_text?: string;
}

export const errorLogService = {
    async logError(error: Error | string, source: string, additionalData?: Record<string, any>) {
        const errorLog: ErrorLog = {
            error_message: typeof error === 'string' ? error : error.message,
            error_stack: error instanceof Error ? error.stack : undefined,
            source,
            additional_data: additionalData,
            created_at: new Date().toISOString(),
        };

        try {
            const { error: supabaseError } = await supabase.from('error_logs').insert([errorLog]);

            if (supabaseError) {
                console.warn('Failed to log error to Supabase:', supabaseError);
            }
        } catch (e) {
            console.warn('Error while logging to Supabase:', e);
        }
    },

    async logRequestError(
        errorType: ErrorType,
        message: string,
        url: string,
        status?: number,
        attempt?: number,
        responseText?: string,
        additionalData?: Record<string, any>,
    ) {
        const requestErrorLog: RequestErrorLog = {
            error_message: message,
            error_type: errorType,
            http_status: status,
            url,
            attempt,
            response_text: responseText,
            source: 'fetchRequest',
            additional_data: additionalData,
            created_at: new Date().toISOString(),
        };

        try {
            const { error: supabaseError } = await supabase
                .from('request_error_logs')
                .insert([requestErrorLog]);

            if (supabaseError) {
                console.warn('Failed to log request error to Supabase:', supabaseError);
            }
        } catch (e) {
            console.warn('Error while logging request error to Supabase:', e);
        }
    },
    async sendLogs(logs: any[], userId?: string, description?: string, localData?: any) {
        if (!Array.isArray(logs) || logs.length === 0) return;
        const logRow = {
            user_id: userId || null,
            log: logs,
            local_storage_data: localData || null,
            source: null,
            description: description || null,
            created_at: new Date().toISOString(),
        };
        try {
            const { error: supabaseError } = await supabase.from('logs').insert([logRow]);
            if (supabaseError) {
                console.warn(
                    'Failed to send logs to Supabase:',
                    JSON.stringify(supabaseError, null, 2),
                );
            }
        } catch (e) {
            console.error('Error while sending logs to Supabase:', e);
        }
    },
};
