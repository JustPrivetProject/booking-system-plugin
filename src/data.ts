import type { RetryConfig } from './types/general';

export const Statuses = {
    IN_PROGRESS: 'in-progress',
    SUCCESS: 'success',
    ANOTHER_TASK: 'another-task',
    PAUSED: 'paused',
    AUTHORIZATION_ERROR: 'authorization-error',
    ERROR: 'error',
    EXPIRED: 'expired',
    NETWORK_ERROR: 'network-error',
};

export const Messages = {
    IN_PROGRESS: 'Zadanie jest w trakcie realizacji',
    SUCCESS: 'Zadanie zakończone sukcesem',
    EXPIRED: 'Czas zakończenia slotu już minął',
    ERROR: 'Nieznane działanie',
    ANOTHER_TASK: 'Zadanie zakończone w innym wątku',
    TOO_MANY_TRANSACTIONS_IN_SECTOR: 'Za duża ilość transakcji w sektorze',
    AWIZACJA_EDYTOWANA_PRZEZ_INN_UZYTKOWNIKA:
        'Awizacja edytowana przez innego użytkownika. Otwórz okno ponownie w celu aktualizacji awizacji',
    AWIZACJA_NIE_MOZE_ZOSTAC_ZMIENIONA_CZAS_MINAL:
        'Awizacja nie może zostać zmieniona, ponieważ czas na dokonanie zmian już minął',
    UNKNOWN: 'Nieznany błąd (niepoprawny format odpowiedzi)',
};

export const urls = {
    getSlots: 'https://ebrama.baltichub.com/Home/GetSlots',
    editTvAppSubmit: 'https://ebrama.baltichub.com/TVApp/EditTvAppSubmit/',
    editTvAppModal: 'https://ebrama.baltichub.com/TVApp/EditTvAppModal',
};

export const Actions = {
    SHOW_ERROR: 'showError',
    SUCCEED_BOOKING: 'succeedBooking',
    PARSED_TABLE: 'parsedTable',
    REMOVE_REQUEST: 'removeRequest',
    REMOVE_MULTIPLE_REQUESTS: 'removeMultipleRequests',
    UPDATE_REQUEST_STATUS: 'updateRequestStatus',
    UPDATE_STATUS: 'updateStatus',
    SEND_LOGS: 'SEND_LOGS_TO_SUPABASE',
    IS_AUTHENTICATED: 'IS_AUTHENTICATED',
    GET_AUTH_STATUS: 'GET_AUTH_STATUS',
    LOGIN_SUCCESS: 'LOGIN_SUCCESS',
    AUTO_LOGIN_ATTEMPT: 'AUTO_LOGIN_ATTEMPT',
    LOAD_AUTO_LOGIN_CREDENTIALS: 'LOAD_AUTO_LOGIN_CREDENTIALS',
    IS_AUTO_LOGIN_ENABLED: 'IS_AUTO_LOGIN_ENABLED',
};

export const StatusesPriority = [
    Statuses.ERROR, // High priority
    Statuses.AUTHORIZATION_ERROR, // Medium priority
    Statuses.NETWORK_ERROR,
    Statuses.EXPIRED,
    Statuses.SUCCESS, // Highest priority
    Statuses.ANOTHER_TASK, // Low priority
    Statuses.IN_PROGRESS, // In progress
    Statuses.PAUSED, // Lowest priority
];

export const StatusIconMap: Record<string, string> = {
    [Statuses.ERROR]: '❌',
    [Statuses.AUTHORIZATION_ERROR]: '❌',
    [Statuses.SUCCESS]: '✅',
    [Statuses.ANOTHER_TASK]: '✅',
    [Statuses.IN_PROGRESS]: '▶️',
    [Statuses.PAUSED]: '⏸️',
    [Statuses.EXPIRED]: '❌',
    [Statuses.NETWORK_ERROR]: '❌',
};

// HTTP and Error handling constants
export enum ErrorType {
    NETWORK = 'NETWORK',
    SERVER_ERROR = 'SERVER_ERROR',
    CLIENT_ERROR = 'CLIENT_ERROR',
    HTML_ERROR = 'HTML_ERROR',
    TIMEOUT = 'TIMEOUT',
    UNKNOWN = 'UNKNOWN',
}

export enum HttpStatus {
    // Client errors
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    METHOD_NOT_ALLOWED = 405,
    REQUEST_TIMEOUT = 408,
    CONFLICT = 409,
    TOO_MANY_REQUESTS = 429,

    // Server errors
    INTERNAL_SERVER_ERROR = 500,
    NOT_IMPLEMENTED = 501,
    BAD_GATEWAY = 502,
    SERVICE_UNAVAILABLE = 503,
    GATEWAY_TIMEOUT = 504,
    HTTP_VERSION_NOT_SUPPORTED = 505,
}

// Default retry configuration
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
};

// Retryable status codes
export const RETRYABLE_STATUSES = [
    HttpStatus.BAD_GATEWAY,
    HttpStatus.SERVICE_UNAVAILABLE,
    HttpStatus.GATEWAY_TIMEOUT,
    HttpStatus.REQUEST_TIMEOUT,
    HttpStatus.TOO_MANY_REQUESTS,
];

// Logging configuration
export const LOGS_LENGTH = 300;

export const TABLE_DATA_NAMES = {
    STATUS: 'Status',
    ID: 'ID',
    SELECTED_DATE: 'Wybrana data',
    START: 'Start',
    END: 'Koniec',
    CONTAINER_NUMBER: 'Nr kontenera',
    ACTIONS: 'Akcje',
};
