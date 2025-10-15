/**
 * Brevo email service module exports
 */

// Main service
export { BrevoEmailService, brevoEmailService } from './brevoEmailService';

// API client
export { BrevoApiClient } from './brevoApiClient';
export type { BrevoPayload } from './brevoApiClient';

// Email templates
export { EmailTemplates } from './emailTemplates';

// Configuration
export { BREVO_CONFIG, BREVO_HEADERS, EMAIL_CONFIG } from './brevoConfig';
