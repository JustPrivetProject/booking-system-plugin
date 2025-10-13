import type { BrevoEmailData } from '../../types/general';
import { formatTimeForEmail } from '../../utils/date-utils';

/**
 * Email template utilities and generators
 */
export class EmailTemplates {
    /**
     * Format time string for display in emails
     * @deprecated Use formatTimeForEmail from utils/date-utils instead
     */
    static formatTime(timeStr: string): string {
        return formatTimeForEmail(timeStr);
    }

    /**
     * Generate HTML content for email
     */
    static generateHTML(emailData: BrevoEmailData): string {
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
        Port-Sloty
      </td>
    </tr>
    
    <!-- Treść -->
    <tr>
      <td style="padding:20px; color:#333333; font-size:16px;">
        <p style="margin:0 0 20px 0; font-size:16px; color:#333;">
          Twoja rezerwacja w BalticHub została pomyślnie zmieniona
        </p>
        
        <!-- Szczegóły rezerwacji в стиле скриншота -->
        <table style="width:100%; margin:20px 0; border-collapse:collapse; border:1px solid #ddd;">
          <tr>
            <td style="padding:12px; background:#f8f9fa; border-bottom:1px solid #ddd; font-weight:bold; width:40%;">ID</td>
            <td style="padding:12px; background:#ffffff; border-bottom:1px solid #ddd;">${emailData.tvAppId}</td>
          </tr>
          <tr>
            <td style="padding:12px; background:#f8f9fa; border-bottom:1px solid #ddd; font-weight:bold;">Godzina</td>
            <td style="padding:12px; background:#ffffff; border-bottom:1px solid #ddd;">${emailData.bookingTime}</td>
          </tr>
          ${
              emailData.driverName
                  ? `<tr>
            <td style="padding:12px; background:#f8f9fa; border-bottom:1px solid #ddd; font-weight:bold;">Kierowca</td>
            <td style="padding:12px; background:#ffffff; border-bottom:1px solid #ddd;">${emailData.driverName}</td>
          </tr>`
                  : ''
          }
          ${
              emailData.containerNumber
                  ? `<tr>
            <td style="padding:12px; background:#f8f9fa; border-bottom:1px solid #ddd; font-weight:bold;">Numer kontenera</td>
            <td style="padding:12px; background:#ffffff; border-bottom:1px solid #ddd;">${emailData.containerNumber}</td>
          </tr>`
                  : ''
          }
        </table>
      </td>
    </tr>
    
    <!-- Stopka -->
    <tr style="background:#f4f6f8; text-align:center; font-size:12px; color:#888;">
      <td style="padding:15px;">
        © ${currentYear} Port-Sloty. Wszelkie prawa zastrzeżone.<br>
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
    static generateText(emailData: BrevoEmailData): string {
        const currentYear = new Date().getFullYear();

        return `Port-Sloty
Potwierdzenie rezerwacji

Twoja rezerwacja w BalticHub została pomyślnie zmieniona

SZCZEGÓŁY REZERWACJI:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ID: ${emailData.tvAppId}
Godzina: ${emailData.bookingTime}${
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

Dziękujemy za skorzystanie z Port-Sloty – życzymy spokojnej podróży i udanego załadunku! 🚢

Jeśli masz pytania, skontaktuj się z nami: support@portsloty.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
© ${currentYear} Port-Sloty. Wszelkie prawa zastrzeżone.
To jest automatyczna wiadomość. Prosimy nie odpowiadać na ten e-mail.`.trim();
    }

    /**
     * Generate email subject line
     */
    static generateSubject(emailData: BrevoEmailData): string {
        // Create more informative subject line
        let subject = `${emailData.containerNumber || emailData.tvAppId}`;
        if (emailData.driverName) {
            subject += ` / ${emailData.driverName}`;
        }
        if (emailData.bookingTime) {
            subject += ` / ${emailData.bookingTime}`;
        }
        return subject;
    }
}
