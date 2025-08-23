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

// Table data structure
export type TableRowData = string[];
export type TableData = TableRowData[];

// Local storage structure
export interface LocalStorageData {
    testEnv: boolean;
    deviceId: string;
    tableData: TableData;
    retryQueue: import('./baltichub').RetryObjectArray;
    groupStates: import('./baltichub').GroupsStates;
    headerHidden: boolean;
    retryEnabled: boolean;
    unauthorized: boolean;
    user_session: UserSession;
    autoLoginData: AutoLoginData;
    requestCacheBody: import('./baltichub').RequestCacheBodes;
    requestCacheHeaders: import('./baltichub').RequestCacheHeaders;
}
