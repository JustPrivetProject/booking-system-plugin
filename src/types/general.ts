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
