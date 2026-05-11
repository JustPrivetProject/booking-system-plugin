import { ErrorType } from '../data';

export interface RetryConfig {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
}

export interface ErrorResponse {
    ok: false;
    error: {
        type: ErrorType;
        status?: number;
        message: string;
        originalError?: Error;
        attempt?: number;
    };
    text: () => Promise<string>;
}

export interface FetchRequestOptions extends RequestInit {
    retryConfig?: RetryConfig;
    timeout?: number; // Timeout in milliseconds (default: 25000)
}

// User session types
export interface UserSession {
    user: {
        id: string;
        email: string;
        deviceId: string;
    };
    expiresAt: number;
}

// Auto login data
export interface AutoLoginData {
    login: string;
    enabled: boolean;
    password: string;
    createdAt: number;
}

export interface NotificationSettings {
    email: {
        enabled: boolean;
        userEmail: string;
        additionalEmails: string[]; // Список дополнительных email адресов
    };
    windows: {
        enabled: boolean;
    };
    createdAt: number;
}

export interface BrevoEmailData {
    emails: string[]; // Список email адресов для отправки
    notificationSource?: 'GCT' | 'DCT' | 'BCT';
    userName: string;
    tvAppId: string;
    bookingTime: string;
    driverName?: string;
    containerNumber?: string;
}

// Table data structure
export type TableRowData = string[];
export type TableData = TableRowData[];

// Local storage structure
export interface LocalStorageData {
    testEnv?: boolean;
    deviceId?: string;
    tableData?: TableData;
    'tableData:bct'?: TableData;
    retryQueue?: import('./baltichub').RetryObjectArray;
    'retryQueue:dct'?: import('./baltichub').RetryObjectArray;
    'retryQueue:bct'?: import('./baltichub').RetryObjectArray;
    gctGroups?: import('../gct/types').GctWatchGroup[];
    gctSettings?: import('../gct/types').GctWatcherSettings;
    gctLastTickAt?: string | null;
    groupStates?: import('./baltichub').GroupsStates;
    'groupStates:dct'?: import('./baltichub').GroupsStates;
    'groupStates:bct'?: import('./baltichub').GroupsStates;
    headerHidden?: boolean;
    retryEnabled?: boolean;
    unauthorized?: boolean;
    'unauthorized:dct'?: boolean;
    'unauthorized:bct'?: boolean;
    user_session?: UserSession;
    autoLoginData?: AutoLoginData;
    'autoLoginData:dct'?: AutoLoginData;
    'autoLoginData:bct'?: AutoLoginData;
    notificationSettings?: NotificationSettings;
    requestCacheBody?: import('./baltichub').RequestCacheBodes;
    'requestCacheBody:dct'?: import('./baltichub').RequestCacheBodes;
    'requestCacheBody:bct'?: import('./baltichub').RequestCacheBodes;
    requestCacheHeaders?: import('./baltichub').RequestCacheHeaders;
    'requestCacheHeaders:dct'?: import('./baltichub').RequestCacheHeaders;
    'requestCacheHeaders:bct'?: import('./baltichub').RequestCacheHeaders;
}
