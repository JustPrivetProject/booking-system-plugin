# Email Template Preview - PortSloty

## Overview

We've updated the email templates to use our own custom HTML/text content instead of Brevo templates. This gives us full control over the design and branding.

## Key Changes

- ✅ **Removed Brevo template dependency** - No more `templateId` required
- ✅ **Custom PortSloty branding** - Professional design with ⚓ anchor icon
- ✅ **Better Polish localization** - Proper Polish text and formatting
- ✅ **Responsive HTML** - Works well on desktop and mobile
- ✅ **Plain text fallback** - Clean text version for email clients that don't support HTML

## HTML Template Features

### Header
- **Brand**: "PortSloty ⚓" with navy blue background (#003049)
- **Professional styling**: Clean table-based layout

### Content
- **Personalized greeting**: "Dzień dobry [UserName]"
- **Clear confirmation message**: Booking successfully registered
- **Details table**: Clean bordered table with:
  - ID rezerwacji (Booking ID)
  - Data i godzina (Date and time)
  - Kierowca (Driver) - if available
  - Numer kontenera (Container number) - if available

### Confirmation Box
- **Green success indicator**: Light green background with checkmark
- **Important note**: Arrive 15 minutes early reminder

### Footer
- **Contact info**: support@portsloty.com
- **Thank you message**: Professional closing with ship emoji 🚢
- **Copyright**: Dynamic year with PortSloty branding
- **Disclaimer**: Automated message notice

## Example Email Content

### HTML Version
```html
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <title>Potwierdzenie rezerwacji</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f6f8;">
  <table style="max-width:600px; margin:20px auto; background:#ffffff; border-radius:8px;">
    <tr style="background:#003049; color:#ffffff;">
      <td style="padding:20px; text-align:center; font-size:20px;">
        PortSloty ⚓
      </td>
    </tr>
    <tr>
      <td style="padding:20px; color:#333333;">
        <p>Dzień dobry <strong>Jan</strong>,</p>
        <p>Z przyjemnością potwierdzamy, że Twoja rezerwacja w porcie została pomyślnie zarejestrowana.</p>
        <!-- Details table and rest of content -->
      </td>
    </tr>
  </table>
</body>
</html>
```

### Text Version
```
PortSloty ⚓
Potwierdzenie rezerwacji

Dzień dobry Jan,

Z przyjemnością potwierdzamy, że Twoja rezerwacja w porcie została pomyślnie zarejestrowana.

SZCZEGÓŁY REZERWACJI:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ID rezerwacji: APP123456
Data i godzina: 21 września 2025, 10:30
Kierowca: Jan Kowalski
Numer kontenera: CONT789

✅ REZERWACJA POTWIERDZONA!
Prosimy o przybycie na miejsce 15 minut przed zaplanowanym terminem.

Jeśli masz pytania, skontaktuj się z nami: support@portsloty.com

Dziękujemy za skorzystanie z PortSloty – życzymy spokojnej podróży i udanego załadunku! 🚢
```

## Technical Implementation

### Data Flow
1. **NotificationService** prepares `BrevoEmailData` object
2. **BrevoEmailService** generates HTML/text content from templates
3. **Direct API call** to Brevo with custom content (no template ID)

### Benefits
- **Full design control**: No dependency on Brevo template editor
- **Version control**: Email templates are part of our codebase
- **Localization**: Easy to update Polish text and formatting
- **Branding consistency**: Matches our extension design
- **Debug friendly**: Can see exact HTML content in logs

### Configuration
- No template setup required in Brevo dashboard
- Just need valid API key for sending
- Templates are defined in `src/services/brevoEmailService.ts`

## Testing

Use the "Wyślij test e-mail" button in notification settings to see the live email template in action!
