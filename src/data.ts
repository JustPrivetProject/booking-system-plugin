export const Statuses = {
    IN_PROGRESS: 'in-progress',
    SUCCESS: 'success',
    ANOTHER_TASK: 'another-task',
    PAUSED: 'paused',
    AUTHORIZATION_ERROR: 'authorization-error',
    ERROR: 'error',
}

export const Actions = {
    SHOW_ERROR: 'showError',
    SUCCEED_BOOKING: 'succeedBooking',
    PARSED_TABLE: 'parsedTable',
    REMOVE_REQUEST: 'removeRequest',
    UPDATE_REQUEST_STATUS: 'updateRequestStatus',
    UPDATE_STATUS: 'updateStatus',
}

export const StatusesPriority = [
    Statuses.ERROR, // High priority
    Statuses.AUTHORIZATION_ERROR, // Medium priority
    Statuses.SUCCESS, // Highest priority
    Statuses.ANOTHER_TASK, // Low priority
    Statuses.IN_PROGRESS, // In progress
    Statuses.PAUSED, // Lowest priority
]

export const StatusColorMap: Record<string, string> = {
    [Statuses.ERROR]: '#ff0000',
    [Statuses.AUTHORIZATION_ERROR]: '#F44338',
    [Statuses.SUCCESS]: '#008000',
    [Statuses.ANOTHER_TASK]: '#008000',
    [Statuses.IN_PROGRESS]: '#9E9E9E',
    [Statuses.PAUSED]: '#ffa500',
}
