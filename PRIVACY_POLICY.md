# Privacy Policy

**Last Updated: 2026-05-11**

## 1. Introduction

This Privacy Policy explains how Chrome Booking System Plugin Extension processes data when you use the extension.

## 2. Data We Process

### 2.1 Account and Authentication Data

The extension uses a third-party backend service provider for account registration, login, session management, and feature-access checks. This may involve:

- account email address
- authentication and session tokens stored locally in the browser
- generated device identifiers used for account and device-management flows

Extension account passwords are processed through the backend authentication flow. The extension does not store the extension account password locally.

### 2.2 Local Operational Data

The extension stores operational data locally in the browser, including:

- extension settings and popup preferences
- booking queues and retry state
- notification settings
- temporary session logs used for troubleshooting
- temporary cached booking request headers and request bodies used to complete and retry booking workflows

### 2.3 Optional User-Provided Data

Depending on which features you enable, the extension may also store or process:

- portal auto-login credentials for supported port websites
- notification email address configured by the user
- issue descriptions manually submitted by the user through the Send Logs flow

Portal auto-login credentials are stored locally for automation purposes. They are not sent to the backend authentication provider as part of extension account sign-in.

### 2.4 Booking and Monitoring Data

To perform automation and notifications, the extension may process booking- and monitoring-related data such as:

- booking identifiers
- slot times
- container numbers
- driver names
- container status and milestone information

This data is processed locally for booking automation, queue handling, status restoration, and user notifications.

### 2.5 Analytics and Diagnostics Sent to Our Backend

The extension sends limited analytics and diagnostics data to a third-party backend service provider. Depending on the feature used, this may include:

- authenticated account email
- extension version
- feature area and terminal
- analytics action type, such as `container_added`, `slot_added`, and `booking_success`
- one-way hashed container key derived from a normalized container number
- technical error and request diagnostics such as URL, HTTP status, truncated response text, stack traces, and related metadata
- user-submitted session logs and issue descriptions when the user explicitly chooses to send logs

Analytics events do not include raw container numbers. The hashed container key is used for operational reporting only.

## 3. How We Use Data

We use the processed data only to:

- authenticate users and manage signed-in sessions
- determine feature access for the signed-in account
- automate booking and monitoring workflows on supported port websites
- store user settings and maintain queue state locally
- send optional browser notifications and optional email notifications
- troubleshoot failures, monitor extension behavior, and improve operational reliability

## 4. Where Data Is Stored or Sent

### 4.1 Local Browser Storage

The extension stores operational data in browser storage, including local and session storage areas used by Chrome extension APIs.

### 4.2 Backend Service Provider

A third-party backend service provider is used for:

- authentication and session handling
- feature-access records
- analytics events
- error and diagnostics logging

### 4.3 Email Delivery Provider

If email notifications are enabled, the extension sends notification emails through a third-party email delivery provider. The notification payload may include recipient email address and booking-related details needed for the message content.

### 4.4 Supported Port Websites

The extension interacts with supported port websites needed for its functionality, including booking and container-monitoring workflows. These sites process the booking and portal login requests required to perform the automation.

## 5. What We Do Not Do

We do not:

- sell personal data
- use your data for advertising
- track browsing activity outside the supported extension workflows
- store raw container identifiers as part of analytics events

## 6. Retention

- Local extension data remains in the browser until it is cleared by the user, overwritten by normal extension behavior, or removed during uninstall.
- Temporary request caches and session logs are operational data and may be cleared automatically during normal processing.
- Backend-hosted analytics and diagnostics retention is controlled server-side and may outlive the local browser session.

## 7. User Controls

Users can:

- disable or uninstall the extension at any time
- clear browser-stored extension data through Chrome settings
- update or remove portal auto-login credentials through the extension UI
- update notification settings through the extension UI
- choose whether to submit issue descriptions and session logs through the Send Logs feature

## 8. Third-Party Services

### 8.1 Backend Service Provider

A third-party backend service provider is used for authentication, feature access, analytics, and diagnostics.

### 8.2 Email Delivery Provider

A third-party email delivery provider is used only for optional email notifications enabled by the user.

### 8.3 Supported Port Websites

Supported port websites process the booking and portal-login requests required for the extension to function.

If you need more detail about the third-party service providers used by the extension, contact us using the email address below.

## 9. Changes to This Privacy Policy

We may update this Privacy Policy from time to time. Any updates will be reflected by revising the Last Updated date above.

## 10. Contact

For privacy-related questions or support requests, contact:

port.sloty@gmail.com
