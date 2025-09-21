import type { BrevoEmailData } from '../types/general';
import { consoleLog, consoleError } from '../utils/index';

/**
 * Brevo API configuration
 */
const BREVO_CONFIG = {
    API_URL: 'https://api.brevo.com/v3/smtp/email',
    API_KEY: process.env.BREVO_API_KEY || '', // Will be configured through environment or settings
    SENDER_EMAIL: process.env.BREVO_SENDER_EMAIL || 'noreply@portsloty.com',
    SENDER_NAME: process.env.BREVO_SENDER_NAME || 'PortSloty ⚓',
};

/**
 * Brevo email service for sending transactional emails
 */
export class BrevoEmailService {
    private apiKey: string;

    constructor(apiKey?: string) {
        this.apiKey = apiKey || BREVO_CONFIG.API_KEY;
    }

    /**
     * Set the Brevo API key
     */
    setApiKey(apiKey: string): void {
        this.apiKey = apiKey;
    }

    /**
     * Send booking confirmation email via Brevo API
     */
    async sendBookingConfirmationEmail(emailData: BrevoEmailData): Promise<boolean> {
        consoleLog('🚀 Sending email to', emailData.emails.length, 'recipients');

        if (!this.apiKey) {
            consoleError('❌ Brevo API key is not configured');
            return false;
        }

        try {
            const payload = this.createEmailPayload(emailData);

            const response = await fetch(BREVO_CONFIG.API_URL, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'api-key': this.apiKey,
                },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                consoleLog('✅ Email sent successfully via Brevo API');
                return true;
            } else {
                consoleError('❌ Brevo API error:', response.status, response.statusText);
                return false;
            }
        } catch (error) {
            consoleError('❌ Error sending email via Brevo (network/fetch error):', error);
            return false;
        }
    }

    /**
     * Create email payload for Brevo API
     */
    private createEmailPayload(emailData: BrevoEmailData) {
        const sender = {
            name: BREVO_CONFIG.SENDER_NAME,
            email: BREVO_CONFIG.SENDER_EMAIL,
        };

        const recipients = emailData.emails.map(email => ({
            email: email,
            name: emailData.userName || email.split('@')[0],
        }));

        const subject = `Potwierdzenie rezerwacji - ${emailData.tvAppId}`;
        const htmlContent = this.generateEmailHTML(emailData);
        const textContent = this.generateEmailText(emailData);

        return {
            sender,
            to: recipients,
            subject,
            htmlContent,
            textContent,
        };
    }

    /**
     * Generate HTML content for email
     */
    private generateEmailHTML(emailData: BrevoEmailData): string {
        const currentYear = new Date().getFullYear();

        return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Potwierdzenie rezerwacji</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f6f8; margin:0; padding:0;">
  <table align="center" width="100%" cellpadding="0" cellspacing="0" 
         style="max-width:600px; margin:20px auto; background:#ffffff; 
                border-radius:8px; overflow:hidden; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
    
    <!-- Nagłówek -->
    <tr style="background:#003049; color:#ffffff;">
      <td style="padding:20px; text-align:center; font-size:20px; font-weight:bold;">
        PortSloty ⚓
      </td>
    </tr>
    
    <!-- Treść -->
    <tr>
      <td style="padding:20px; color:#333333; font-size:16px;">
        <p>Dzień dobry <strong>${emailData.userName || 'Użytkowniku'}</strong>,</p>
        <p>Z przyjemnością potwierdzamy, że Twoja rezerwacja w porcie została pomyślnie zarejestrowana.</p>
        
        <table style="width:100%; margin:20px 0; border-collapse:collapse;">
          <tr>
            <td style="padding:8px; border:1px solid #ddd; background:#f8f9fa;"><strong>ID rezerwacji</strong></td>
            <td style="padding:8px; border:1px solid #ddd;">${emailData.tvAppId}</td>
          </tr>
          <tr>
            <td style="padding:8px; border:1px solid #ddd; background:#f8f9fa;"><strong>Data i godzina</strong></td>
            <td style="padding:8px; border:1px solid #ddd;">${emailData.bookingTime}</td>
          </tr>
          ${
              emailData.driverName
                  ? `<tr>
            <td style="padding:8px; border:1px solid #ddd; background:#f8f9fa;"><strong>Kierowca</strong></td>
            <td style="padding:8px; border:1px solid #ddd;">${emailData.driverName}</td>
          </tr>`
                  : ''
          }
          ${
              emailData.containerNumber
                  ? `<tr>
            <td style="padding:8px; border:1px solid #ddd; background:#f8f9fa;"><strong>Numer kontenera</strong></td>
            <td style="padding:8px; border:1px solid #ddd;">${emailData.containerNumber}</td>
          </tr>`
                  : ''
          }
        </table>

        <div style="background:#e8f5e8; padding:15px; border-radius:6px; margin:20px 0; border-left:4px solid #28a745;">
          <p style="margin:0; color:#155724;">
            <strong>✅ Rezerwacja potwierdzona!</strong><br>
            Prosimy o przybycie na miejsce 15 minut przed zaplanowanym terminem.
          </p>
        </div>

        <p>Jeśli masz pytania, skontaktuj się z nami: 
          <a href="mailto:support@portsloty.com" style="color:#003049;">support@portsloty.com</a>.
        </p>

        <p style="margin-top:30px;">Dziękujemy za skorzystanie z <strong>PortSloty</strong> – 
        życzymy spokojnej podróży i udanego załadunku! 🚢</p>
      </td>
    </tr>
    
    <!-- Stopka -->
    <tr style="background:#f4f6f8; text-align:center; font-size:12px; color:#888;">
      <td style="padding:15px;">
        © ${currentYear} PortSloty. Wszelkie prawa zastrzeżone.<br>
        <span style="font-size:11px;">To jest automatyczna wiadomość. Prosimy nie odpowiadać na ten e-mail.</span>
      </td>
    </tr>
  </table>
</body>
</html>`;
    }

    /**
     * Generate plain text content for email
     */
    private generateEmailText(emailData: BrevoEmailData): string {
        const currentYear = new Date().getFullYear();

        return `PortSloty ⚓
Potwierdzenie rezerwacji

Dzień dobry ${emailData.userName || 'Użytkowniku'},

Z przyjemnością potwierdzamy, że Twoja rezerwacja w porcie została pomyślnie zarejestrowana.

SZCZEGÓŁY REZERWACJI:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ID rezerwacji: ${emailData.tvAppId}
Data i godzina: ${emailData.bookingTime}${
            emailData.driverName
                ? `
Kierowca: ${emailData.driverName}`
                : ''
        }${
            emailData.containerNumber
                ? `
Numer kontenera: ${emailData.containerNumber}`
                : ''
        }

✅ REZERWACJA POTWIERDZONA!
Prosimy o przybycie na miejsce 15 minut przed zaplanowanym terminem.

Jeśli masz pytania, skontaktuj się z nami: support@portsloty.com

Dziękujemy za skorzystanie z PortSloty – życzymy spokojnej podróży i udanego załadunku! 🚢

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
© ${currentYear} PortSloty. Wszelkie prawa zastrzeżone.
To jest automatyczna wiadomość. Prosimy nie odpowiadać na ten e-mail.`.trim();
    }

    /**
     * Test Brevo API connection
     */
    async testConnection(): Promise<boolean> {
        if (!this.apiKey) {
            return false;
        }

        try {
            // Test with a simple API call to verify credentials
            const response = await fetch('https://api.brevo.com/v3/account', {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                    'api-key': this.apiKey,
                },
            });

            return response.ok;
        } catch (error) {
            consoleError('Error testing Brevo connection:', error);
            return false;
        }
    }
}

// Create singleton instance
export const brevoEmailService = new BrevoEmailService();
