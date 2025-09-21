# Brevo Email Notifications Setup

This document provides instructions for setting up Brevo email notifications for booking confirmations.

## Overview

The Brama extension now supports sending email notifications through the Brevo API when bookings are successfully completed. Users can configure their notification preferences through the popup interface.

## Features

- **Email Notifications**: Send booking confirmation emails via Brevo API
- **Windows Notifications**: Continue using existing Windows notification system
- **User Settings**: Configure notification preferences through a modal interface
- **Dual Support**: Email and Windows notifications can be enabled independently

## Brevo API Configuration

### 1. Get Brevo API Key

1. Sign up for a [Brevo account](https://www.brevo.com/)
2. Navigate to SMTP & API settings
3. Generate a new API key
4. Copy the API key for configuration

### 2. Configure API Key

The API key is now configured via environment variables for better security.

#### For Local Development:
1. Copy `env.example` to `.env`
2. Add your Brevo API key:
```env
BREVO_API_KEY=your_brevo_api_key_here
```

#### For Production Deployment:
Add the API key as a GitHub secret:
- Go to repository `Settings` → `Secrets and variables` → `Actions`
- Add `BREVO_API_KEY` secret with your actual API key

**Code Reference**: `src/services/brevoEmailService.ts`
```typescript
const BREVO_CONFIG = {
    API_URL: 'https://api.brevo.com/v3/smtp/email',
    API_KEY: process.env.BREVO_API_KEY || '', // Loaded from environment
    DEFAULT_TEMPLATE_ID: 1,
};
```

### 3. Sender Email Configuration

Configure the sender email address in the same file:

```typescript
sender: {
    name: 'Brama Booking System',
    email: 'noreply@yourdomain.com', // Replace with your verified sender email
}
```

## User Interface

### Notification Settings Modal

Users can access notification settings by clicking the "Powiadomienia" (Notifications) button in the popup.

**Available Options**:
- Email notifications with email address input
- Windows notifications toggle
- Save, Reset, and Cancel buttons

### Button States

The notification button displays different states:
- **Disabled**: Gray button when no notifications are enabled
- **Enabled**: Green button showing active notification types
- **Tooltip**: Shows current configuration (e.g., "Powiadomienia: Windows, Email (user@example.com)")

## Email Template

The system generates both HTML and plain text versions of booking confirmation emails.

**Email Content Includes**:
- Booking confirmation message in Polish
- TV Application ID
- Booking time (formatted in Polish locale)
- Driver name (if available)
- Container number (if available)
- User-friendly HTML layout with styling

## Storage

Notification settings are stored locally using Chrome's storage API:

```typescript
interface NotificationSettings {
    email: {
        enabled: boolean;
        userEmail: string;
    };
    windows: {
        enabled: boolean;
    };
    createdAt: number;
}
```

**Storage Key**: `notificationSettings`

## Development Notes

### Dependencies

- **Brevo API**: Used for sending transactional emails
- **Chrome Notifications API**: Used for Windows notifications
- **Chrome Storage API**: Used for settings persistence

### Error Handling

- Email sending errors are logged but don't interrupt the booking process
- Invalid email addresses are validated before enabling email notifications
- Network errors are handled gracefully with fallback to Windows notifications

### Testing

To test email notifications:

1. Configure a valid Brevo API key
2. Set up notification preferences in the popup
3. Complete a booking successfully
4. Check both email delivery and console logs

## Future Enhancements

- **UI API Key Configuration**: Add API key input to settings modal
- **Email Templates**: Support for custom Brevo email templates
- **Multiple Recipients**: Support for multiple notification email addresses
- **Notification History**: Track sent notifications
- **Retry Logic**: Automatic retry for failed email deliveries

## Troubleshooting

**Email Not Sent**:
1. Check API key configuration
2. Verify sender email is validated in Brevo
3. Check network connectivity
4. Review console logs for detailed error messages

**Settings Not Saved**:
1. Check browser storage permissions
2. Review console logs for storage errors
3. Verify popup script execution

**Button Not Updating**:
1. Check storage change listeners
2. Verify service initialization
3. Review popup script loading
