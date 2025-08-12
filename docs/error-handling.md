# Error Handling System

## Overview

The new error handling system in `fetchRequest` provides:

- **Detailed error analysis** - error type and HTTP status determination
- **Retry mechanism** - automatic retry attempts for temporary errors
- **Logging** - error logging to Supabase for analysis
- **HTML detection** - detection of HTML error pages in responses

## Error Types

```typescript
enum ErrorType {
    NETWORK = 'NETWORK',           // Network errors
    SERVER_ERROR = 'SERVER_ERROR', // Server errors (5xx)
    CLIENT_ERROR = 'CLIENT_ERROR', // Client errors (4xx)
    HTML_ERROR = 'HTML_ERROR',     // HTML error pages
    TIMEOUT = 'TIMEOUT',           // Timeouts
    UNKNOWN = 'UNKNOWN'            // Unknown errors
}
```

## Retry Mechanism

### Default configuration:
```typescript
const DEFAULT_RETRY_CONFIG = {
    maxAttempts: 3,    // Maximum attempts
    baseDelay: 1000,   // Base delay (1 sec)
    maxDelay: 10000    // Maximum delay (10 sec)
};
```

### Retryable statuses:
- 502 Bad Gateway
- 503 Service Unavailable  
- 504 Gateway Timeout
- 408 Request Timeout
- 429 Too Many Requests

### Exponential backoff:
- Attempt 1: 1 sec
- Attempt 2: 2 sec
- Attempt 3: 4 sec
- Maximum: 10 sec

## Usage

### Basic usage:
```typescript
const response = await fetchRequest('https://api.example.com/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});

if (response.ok) {
    const data = await response.json();
} else if ('error' in response) {
    console.log('Error:', response.error);
}
```

### With custom retry configuration:
```typescript
const response = await fetchRequest('https://api.example.com/data', {
    method: 'GET',
    retryConfig: {
        maxAttempts: 5,
        baseDelay: 500,
        maxDelay: 5000
    }
});
```

## Error Handling

### Error type checking:
```typescript
if (!response.ok && 'error' in response) {
    switch (response.error.type) {
        case ErrorType.NETWORK:
            // Network error
            break;
        case ErrorType.SERVER_ERROR:
            // Server error
            break;
        case ErrorType.HTML_ERROR:
            // HTML error page
            break;
        case ErrorType.CLIENT_ERROR:
            // Client error
            break;
    }
}
```

### Getting error details:
```typescript
if (!response.ok && 'error' in response) {
    const { type, status, message, attempt } = response.error;
    console.log(`Error type: ${type}`);
    console.log(`HTTP status: ${status}`);
    console.log(`Message: ${message}`);
    console.log(`Attempt: ${attempt}`);
}
```

## Logging

All critical errors (after all retry attempts) are automatically logged to Supabase:

- Error type
- HTTP status
- Request URL
- Number of attempts
- Response text
- Additional data

## HTML Error Detection

The system automatically detects HTML error pages using patterns:

- `<title>Error 500</title>`
- `<h1>502 Bad Gateway</h1>`
- `Status: 401`
- `Error 404`

## Usage Examples

### In baltichub.ts:
```typescript
export async function getSlots(date: string): Promise<Response | ErrorResponse> {
    const response = await fetchRequest('https://ebrama.baltichub.com/Home/GetSlots', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ date, type: 1 })
    });

    if (!response.ok && 'error' in response) {
        consoleLog('Failed to get slots:', response.error);
        return response;
    }

    return response;
}

// Advanced error handling in processRequest:
const slots = await getSlots(time[0])
if (!slots.ok && 'error' in slots) {
    consoleLog('❌ Problem with authorization:', tvAppId, time.join(', '), slots.error)
    
    switch (slots.error.type) {
        case ErrorType.CLIENT_ERROR:
            if (slots.error.status === 401) {
                setStorage({ unauthorized: true })
                return {
                    ...req,
                    status: Statuses.AUTHORIZATION_ERROR,
                    status_message: 'Problem z autoryzacją - nieautoryzowany dostęp',
                }
            }
            break
        case ErrorType.SERVER_ERROR:
            return {
                ...req,
                status: Statuses.ERROR,
                status_message: 'Problem z serwerem - spróbuj ponownie później',
            }
        case ErrorType.HTML_ERROR:
            return {
                ...req,
                status: Statuses.AUTHORIZATION_ERROR,
                status_message: 'Problem z autoryzacją - strona błędu',
            }
        case ErrorType.NETWORK:
            return {
                ...req,
                status: Statuses.ERROR,
                status_message: 'Problem z połączeniem sieciowym',
            }
        default:
            setStorage({ unauthorized: true })
            return {
                ...req,
                status: Statuses.AUTHORIZATION_ERROR,
                status_message: 'Problem z autoryzacją',
            }
    }
}
```

## Testing

To test error handling, use the `testErrorHandling()` function:

```typescript
import { testErrorHandling } from '../utils/utils-function';

// Run tests
await testErrorHandling();
```

## Migration

### Old code:
```typescript
const response = await fetchRequest(url, options);
if (!response.ok) {
    // Error handling
}
```

### New code:
```typescript
const response = await fetchRequest(url, options);
if (!response.ok && 'error' in response) {
    // Detailed error handling
    console.log('Error type:', response.error.type);
    console.log('Status:', response.error.status);
    console.log('Message:', response.error.message);
}
```
