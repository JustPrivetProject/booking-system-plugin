import type { BrevoEmailData } from '../../types/general';
import { consoleLog, consoleError } from '../../utils/index';
import { BREVO_CONFIG } from './brevoConfig';
import { BrevoApiClient } from './brevoApiClient';

/**
 * Brevo email service for sending transactional emails
 * Main service class that orchestrates email sending functionality
 */
export class BrevoEmailService {
    private apiClient: BrevoApiClient;

    constructor(apiKey?: string) {
        const key = apiKey || BREVO_CONFIG.API_KEY;
        this.apiClient = new BrevoApiClient(key);
    }

    /**
     * Set the Brevo API key
     */
    setApiKey(apiKey: string): void {
        this.apiClient.setApiKey(apiKey);
    }

    /**
     * Send booking confirmation email via Brevo API
     */
    async sendBookingConfirmationEmail(emailData: BrevoEmailData): Promise<boolean> {
        try {
            consoleLog('📧 Starting booking confirmation email process');

            // Validate input data
            if (!this.validateEmailData(emailData)) {
                return false;
            }

            // Send email via API client
            const success = await this.apiClient.sendEmail(emailData);

            if (success) {
                consoleLog('✅ Booking confirmation email sent successfully');
            } else {
                consoleLog('❌ Failed to send booking confirmation email');
            }

            return success;
        } catch (error) {
            consoleError('❌ Unexpected error in sendBookingConfirmationEmail:', error);
            return false;
        }
    }

    /**
     * Test Brevo API connection
     */
    async testConnection(): Promise<boolean> {
        try {
            consoleLog('🔍 Testing Brevo API connection');
            const isConnected = await this.apiClient.testConnection();

            if (isConnected) {
                consoleLog('✅ Brevo API connection test successful');
            } else {
                consoleLog('❌ Brevo API connection test failed');
            }

            return isConnected;
        } catch (error) {
            consoleError('❌ Error testing Brevo API connection:', error);
            return false;
        }
    }

    /**
     * Validate email data before sending
     */
    private validateEmailData(emailData: BrevoEmailData): boolean {
        if (!emailData) {
            consoleError('❌ Email data is required');
            return false;
        }

        if (!emailData.emails || emailData.emails.length === 0) {
            consoleError('❌ At least one email address is required');
            return false;
        }

        if (!emailData.tvAppId) {
            consoleError('❌ TV App ID is required');
            return false;
        }

        // Validate email addresses
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        for (const email of emailData.emails) {
            if (!emailRegex.test(email)) {
                consoleError('❌ Invalid email address:', email);
                return false;
            }
        }

        return true;
    }

    /**
     * Get service status and configuration
     */
    getStatus(): {
        hasApiKey: boolean;
        senderEmail: string;
        senderName: string;
        apiUrl: string;
    } {
        return {
            hasApiKey: !!this.apiClient['apiKey'],
            senderEmail: BREVO_CONFIG.SENDER_EMAIL,
            senderName: BREVO_CONFIG.SENDER_NAME,
            apiUrl: BREVO_CONFIG.API_URL,
        };
    }
}

// Export singleton instance
export const brevoEmailService = new BrevoEmailService();
