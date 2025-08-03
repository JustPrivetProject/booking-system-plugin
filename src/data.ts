export const Statuses = {
    IN_PROGRESS: 'in-progress',
    SUCCESS: 'success',
    ANOTHER_TASK: 'another-task',
    PAUSED: 'paused',
    AUTHORIZATION_ERROR: 'authorization-error',
    ERROR: 'error',
    EXPIRED: 'expired',
}

export const Actions = {
    SHOW_ERROR: 'showError',
    SUCCEED_BOOKING: 'succeedBooking',
    PARSED_TABLE: 'parsedTable',
    REMOVE_REQUEST: 'removeRequest',
    UPDATE_REQUEST_STATUS: 'updateRequestStatus',
    UPDATE_STATUS: 'updateStatus',
    SEND_LOGS: 'SEND_LOGS_TO_SUPABASE',
    IS_AUTHENTICATED: 'IS_AUTHENTICATED',
    GET_AUTH_STATUS: 'GET_AUTH_STATUS',
    LOGIN_SUCCESS: 'LOGIN_SUCCESS',
    AUTO_LOGIN_ATTEMPT: 'AUTO_LOGIN_ATTEMPT',
    LOAD_AUTO_LOGIN_CREDENTIALS: 'LOAD_AUTO_LOGIN_CREDENTIALS',
}

export const StatusesPriority = [
    Statuses.ERROR, // High priority
    Statuses.AUTHORIZATION_ERROR, // Medium priority
    Statuses.EXPIRED,
    Statuses.SUCCESS, // Highest priority
    Statuses.ANOTHER_TASK, // Low priority
    Statuses.IN_PROGRESS, // In progress
    Statuses.PAUSED, // Lowest priority
]

export const StatusIconMap: Record<string, string> = {
    [Statuses.ERROR]: '❌',
    [Statuses.AUTHORIZATION_ERROR]: '❌',
    [Statuses.SUCCESS]: '✅',
    [Statuses.ANOTHER_TASK]: '✅',
    [Statuses.IN_PROGRESS]: '▶️',
    [Statuses.PAUSED]: '⏸️',
    [Statuses.EXPIRED]: '❌',
}
