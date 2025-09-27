/**
 * Brevo API configuration
 */
export const BREVO_CONFIG = {
    API_URL: 'https://api.brevo.com/v3/smtp/email',
    API_KEY: process.env.BREVO_API_KEY || '', // Will be configured through environment or settings
    SENDER_EMAIL: process.env.BREVO_SENDER_EMAIL || 'noreply@portsloty.com',
    SENDER_NAME: process.env.BREVO_SENDER_NAME || 'PortSloty ⚓',
} as const;

/**
 * Brevo API request headers
 */
export const BREVO_HEADERS = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
} as const;

/**
 * Email template configuration
 */
export const EMAIL_CONFIG = {
    MAX_RECIPIENTS: 100,
    TIMEOUT_MS: 30000,
    RETRY_ATTEMPTS: 3,
} as const;
