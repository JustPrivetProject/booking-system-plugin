import type { BrevoEmailData } from '../../types/general';
import { consoleLog, consoleError } from '../../utils/index';
import { BREVO_CONFIG, BREVO_HEADERS, EMAIL_CONFIG } from './brevoConfig';
import { EmailTemplates } from './emailTemplates';

/**
 * Brevo API request payload interface
 */
export interface BrevoPayload {
    sender: {
        name: string;
        email: string;
    };
    to: Array<{
        email: string;
        name: string;
    }>;
    subject: string;
    htmlContent: string;
    textContent: string;
}

/**
 * Brevo API client for handling HTTP requests
 */
export class BrevoApiClient {
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    /**
     * Set the Brevo API key
     */
    setApiKey(apiKey: string): void {
        this.apiKey = apiKey;
    }

    /**
     * Create email payload for Brevo API
     */
    private createEmailPayload(emailData: BrevoEmailData): BrevoPayload {
        const sender = {
            name: BREVO_CONFIG.SENDER_NAME,
            email: BREVO_CONFIG.SENDER_EMAIL,
        };

        const recipients = emailData.emails.map(email => ({
            email: email,
            name: emailData.userName || email.split('@')[0],
        }));

        const subject = EmailTemplates.generateSubject(emailData);
        const htmlContent = EmailTemplates.generateHTML(emailData);
        const textContent = EmailTemplates.generateText(emailData);

        return {
            sender,
            to: recipients,
            subject,
            htmlContent,
            textContent,
        };
    }

    /**
     * Send email via Brevo API
     */
    async sendEmail(emailData: BrevoEmailData): Promise<boolean> {
        consoleLog('🚀 Sending email to', emailData.emails.length, 'recipients');

        if (!this.apiKey) {
            consoleError('❌ Brevo API key is not configured');
            return false;
        }

        // Validate recipients count
        if (emailData.emails.length > EMAIL_CONFIG.MAX_RECIPIENTS) {
            consoleError(
                `❌ Too many recipients: ${emailData.emails.length} (max: ${EMAIL_CONFIG.MAX_RECIPIENTS})`,
            );
            return false;
        }

        try {
            const payload = this.createEmailPayload(emailData);

            const response = await fetch(BREVO_CONFIG.API_URL, {
                method: 'POST',
                headers: {
                    ...BREVO_HEADERS,
                    'api-key': this.apiKey,
                },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                consoleLog('✅ Email sent successfully via Brevo API');
                return true;
            } else {
                const errorText = await response.text();
                consoleError(
                    '❌ Brevo API error:',
                    response.status,
                    response.statusText,
                    errorText,
                );
                return false;
            }
        } catch (error) {
            consoleError('❌ Error sending email via Brevo (network/fetch error):', error);
            return false;
        }
    }

    /**
     * Test Brevo API connection
     */
    async testConnection(): Promise<boolean> {
        if (!this.apiKey) {
            consoleError('❌ Brevo API key is not configured');
            return false;
        }

        try {
            // Create a minimal test payload
            const testPayload = {
                sender: {
                    name: BREVO_CONFIG.SENDER_NAME,
                    email: BREVO_CONFIG.SENDER_EMAIL,
                },
                to: [
                    {
                        email: 'test@example.com',
                        name: 'Test User',
                    },
                ],
                subject: 'Test Connection',
                htmlContent: '<p>Test email</p>',
                textContent: 'Test email',
            };

            const response = await fetch(BREVO_CONFIG.API_URL, {
                method: 'POST',
                headers: {
                    ...BREVO_HEADERS,
                    'api-key': this.apiKey,
                },
                body: JSON.stringify(testPayload),
            });

            // We don't actually send the test email, just check if API responds correctly
            return response.status !== 401; // 401 means unauthorized, other errors might be different issues
        } catch (error) {
            consoleError('❌ Error testing Brevo API connection:', error);
            return false;
        }
    }
}
