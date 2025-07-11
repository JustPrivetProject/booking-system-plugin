import { supabase } from './supabaseClient'

interface ErrorLog {
    error_message: string
    error_stack?: string
    source: string
    additional_data?: Record<string, any>
    created_at?: string
}

export const errorLogService = {
    async logError(
        error: Error | string,
        source: string,
        additionalData?: Record<string, any>
    ) {
        const errorLog: ErrorLog = {
            error_message: typeof error === 'string' ? error : error.message,
            error_stack: error instanceof Error ? error.stack : undefined,
            source,
            additional_data: additionalData,
            created_at: new Date().toISOString(),
        }

        try {
            const { error: supabaseError } = await supabase
                .from('error_logs')
                .insert([errorLog])

            if (supabaseError) {
                console.error('Failed to log error to Supabase:', supabaseError)
            }
        } catch (e) {
            console.error('Error while logging to Supabase:', e)
        }
    },
    async sendLogs(
        logs: any[],
        userId?: string,
        description?: string,
        localData?: any
    ) {
        if (!Array.isArray(logs) || logs.length === 0) return
        const logRow = {
            user_id: userId || null,
            log: logs,
            local_storage_data: localData || null,
            source: null,
            description: description || null,
            created_at: new Date().toISOString(),
        }
        try {
            const { error: supabaseError } = await supabase
                .from('logs')
                .insert([logRow])
            if (supabaseError) {
                console.error(
                    'Failed to send logs to Supabase:',
                    JSON.stringify(supabaseError, null, 2)
                )
            }
        } catch (e) {
            console.error('Error while sending logs to Supabase:', e)
        }
    },
}
