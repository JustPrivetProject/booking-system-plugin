# Notification Flow Architecture

## Overview

The notification system has been refactored to use a centralized approach where all booking success notifications (both Windows and Email) are handled through a single service.

## Architecture

### Before (Distributed)
```
┌─ executeRequest (baltichub.ts) ──────┐
│  └─ Windows notifications only       │
└───────────────────────────────────────┘

┌─ MessageHandler.ts ──────────────────┐  
│  └─ Email notifications only         │
│     (for SUCCEED_BOOKING actions)    │
└───────────────────────────────────────┘
```

**Problems:**
- Duplicate notification points
- Different logic for Windows vs Email
- Potential for missed or double notifications
- Hard to maintain consistency

### After (Centralized)
```
┌─ executeRequest (baltichub.ts) ──────┐
│  └─ notificationService             │
│     ├─ Windows notifications        │
│     └─ Email notifications          │
└─────────────────────────────────────┘
```

**Benefits:**
- Single source of truth for all notifications
- Consistent notification data
- Easy to add new notification types
- Unified error handling
- Better testability

## Components

### 1. NotificationService (`src/services/notificationService.ts`)

**Main Methods:**
- `sendBookingSuccessNotifications(data)` - Entry point for all notifications
- `sendWindowsNotification(data)` - Handles Windows system notifications
- `sendEmailNotification(data)` - Handles Brevo email notifications
- `getNotificationStatus()` - Returns current settings status

**Features:**
- Parallel execution of Windows and Email notifications
- Automatic settings checking (enabled/disabled)
- Centralized error handling
- Consistent data formatting

### 2. Integration Point (`src/services/baltichub.ts`)

**Location:** `executeRequest` function
**Trigger:** When retry request is successful
**Data Source:** Data comes directly from the `RetryObject` request
**Data Collected:**
- TV Application ID (`tvAppId`)
- Booking time (from `time[1]` parameter)
- Driver name (from `req.driverName`)
- Container number (from `req.containerNumber`)

```typescript
await notificationService.sendBookingSuccessNotifications({
    tvAppId,
    bookingTime: time[1] || new Date().toISOString(),
    driverName: req.driverName,
    containerNumber: req.containerNumber,
});
```

### 3. Settings Management

**Windows Notifications:**
- Controlled by `notificationSettings.windows.enabled`
- Default: `true` (enabled)

**Email Notifications:**
- Controlled by `notificationSettings.email.enabled`
- Requires valid email address in `notificationSettings.email.userEmail`
- Uses Brevo API for delivery

## Notification Flow

```
1. User Action or Retry System
   │
   ├─ Manual booking success
   │  └─ Content script detects success
   │     └─ Sends SUCCEED_BOOKING message
   │        └─ MessageHandler adds to queue
   │
   └─ Automatic retry success
      └─ executeRequest succeeds
         └─ 🎯 notificationService.sendBookingSuccessNotifications()
            │
            ├─ Check Windows notifications enabled
            │  └─ If yes: chrome.notifications.create()
            │
            └─ Check Email notifications enabled
               └─ If yes: brevoEmailService.sendBookingConfirmationEmail()
```

## Configuration

### Notification Settings Storage
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

### User Interface
- **Settings Modal:** `src/popup/modals/notificationSettings.modal.ts`
- **Button:** "Powiadomienia" in popup
- **State Display:** Button shows active notification types

## Error Handling

### Windows Notifications
- Fails silently if permissions not granted
- Logs error but continues execution

### Email Notifications
- Validates email address before sending
- Handles network failures gracefully
- Falls back to Windows notification if email fails
- Detailed error logging

### General Principles
- Never block booking success on notification failure
- Use `Promise.allSettled()` for parallel execution
- Log all errors for debugging
- Graceful degradation
- Container Checker change notifications should log failures and continue the polling cycle

## Testing

### Manual Testing
1. Enable/disable notification types in settings
2. Complete successful booking
3. Verify correct notifications are sent
4. Check error scenarios (invalid email, network issues)

### Debug Commands
```javascript
// Test notifications
await notificationService.sendTestNotifications();

// Check settings
await notificationService.getNotificationStatus();

// Clear settings
chrome.storage.local.remove('notificationSettings');
```

## Migration Notes

### Changes Made
1. ✅ Created centralized `NotificationService`
2. ✅ Integrated service into `executeRequest`
3. ✅ Removed duplicate logic from `MessageHandler`
4. ✅ Unified data collection from `RetryObject` (no extra API calls)
5. ✅ Maintained existing user settings compatibility
6. ✅ Proper integration with notification settings service
7. ✅ Optimized Windows notification time formatting

### Breaking Changes
- None - existing settings and behavior preserved

### Future Enhancements
- SMS notifications
- Push notifications
- Webhook notifications
- Notification history/logging
- Batch notification preferences
