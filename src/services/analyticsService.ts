import { Statuses } from '../data';
import { BOOKING_TERMINALS, type BookingTerminal } from '../types/terminal';
import { consoleError, consoleLog } from '../utils';

import { authService } from './authService';
import { sessionService } from './sessionService';
import { supabase } from './supabaseClient';

type AnalyticsEnvironment = 'dev' | 'prod';
type AnalyticsEventName =
    | 'session_started'
    | 'tab_viewed'
    | 'booking_started'
    | 'booking_result'
    | 'container_monitor_action';
type AnalyticsFeatureArea = 'auth' | 'popup' | 'booking' | 'container_monitor';
type AnalyticsTerminal = 'DCT' | 'BCT' | 'GCT';
type PopupAnalyticsTab = 'booking' | 'bct' | 'gct' | 'containerChecker';
type ContainerMonitorAction = 'item_added' | 'item_removed' | 'manual_check' | 'check_completed';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type AnalyticsMetadata = Record<string, unknown>;

interface AnalyticsEventRow {
    user_email: string;
    environment: AnalyticsEnvironment;
    extension_version: string;
    event_name: AnalyticsEventName;
    feature_area: AnalyticsFeatureArea;
    terminal: AnalyticsTerminal | null;
    success: boolean | null;
    error_type: string | null;
    metadata: Record<string, JsonValue>;
    created_at: string;
}

interface TrackEventInput {
    eventName: AnalyticsEventName;
    featureArea: AnalyticsFeatureArea;
    terminal?: AnalyticsTerminal | BookingTerminal | null;
    success?: boolean | null;
    errorType?: string | null;
    metadata?: AnalyticsMetadata;
    userEmail?: string;
}

interface BookingResultInput {
    terminal: AnalyticsTerminal | BookingTerminal | null;
    success: boolean;
    errorType?: string | null;
    metadata?: AnalyticsMetadata;
}

const FORBIDDEN_METADATA_KEYS = new Set([
    'password',
    'token',
    'access_token',
    'refresh_token',
    'cookie',
    'cookies',
    'headers',
    'headerscache',
    'body',
    'requestbody',
    'drivername',
    'containernumber',
    'containernumbers',
    'responsetext',
    'recipientemail',
    'additionalemails',
]);

function getEnvironment(): AnalyticsEnvironment {
    return process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
}

function getExtensionVersion(): string {
    try {
        return chrome.runtime.getManifest().version || 'unknown';
    } catch {
        return 'unknown';
    }
}

function normalizeTerminal(
    terminal?: AnalyticsTerminal | BookingTerminal | null,
): AnalyticsTerminal | null {
    if (!terminal) {
        return null;
    }

    if (terminal === 'GCT') {
        return 'GCT';
    }

    if (terminal === BOOKING_TERMINALS.DCT || terminal === 'DCT') {
        return 'DCT';
    }

    if (terminal === BOOKING_TERMINALS.BCT || terminal === 'BCT') {
        return 'BCT';
    }

    return null;
}

function sanitizeJsonValue(value: unknown, key?: string): JsonValue | undefined {
    const normalizedKey = (key || '').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
    if (normalizedKey && FORBIDDEN_METADATA_KEYS.has(normalizedKey)) {
        return undefined;
    }

    if (value === null) {
        return null;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }

    if (Array.isArray(value)) {
        return value
            .map(item => sanitizeJsonValue(item))
            .filter((item): item is JsonValue => item !== undefined);
    }

    if (typeof value === 'object') {
        return Object.entries(value as Record<string, unknown>).reduce<Record<string, JsonValue>>(
            (accumulator, [entryKey, entryValue]) => {
                const sanitizedEntryValue = sanitizeJsonValue(entryValue, entryKey);

                if (sanitizedEntryValue !== undefined) {
                    accumulator[entryKey] = sanitizedEntryValue;
                }

                return accumulator;
            },
            {},
        );
    }

    return undefined;
}

function sanitizeMetadata(metadata?: AnalyticsMetadata): Record<string, JsonValue> {
    if (!metadata) {
        return {};
    }

    const sanitized = sanitizeJsonValue(metadata);
    if (!sanitized || Array.isArray(sanitized)) {
        return {};
    }

    return sanitized as Record<string, JsonValue>;
}

async function resolveUserEmail(explicitEmail?: string): Promise<string | null> {
    if (explicitEmail?.trim()) {
        return explicitEmail.trim().toLowerCase();
    }

    const sessionUser = await sessionService.getCurrentUser();
    if (sessionUser?.email) {
        return sessionUser.email.trim().toLowerCase();
    }

    const currentUser = await authService.getCurrentUser();
    if (currentUser?.email) {
        return currentUser.email.trim().toLowerCase();
    }

    return null;
}

function getBookingResultFieldsFromStatus(
    status: string,
): { success: boolean; errorType: string | null } | null {
    if (status === Statuses.SUCCESS || status === Statuses.ANOTHER_TASK) {
        return { success: true, errorType: null };
    }

    if (status === Statuses.AUTHORIZATION_ERROR) {
        return { success: false, errorType: 'auth' };
    }

    if (status === Statuses.NETWORK_ERROR) {
        return { success: false, errorType: 'network' };
    }

    if (status === Statuses.EXPIRED) {
        return { success: false, errorType: 'expired' };
    }

    if (status === Statuses.ERROR) {
        return { success: false, errorType: 'error' };
    }

    return null;
}

export const analyticsService = {
    async trackEvent({
        eventName,
        featureArea,
        terminal,
        success = null,
        errorType = null,
        metadata,
        userEmail,
    }: TrackEventInput): Promise<void> {
        try {
            const resolvedUserEmail = await resolveUserEmail(userEmail);
            if (!resolvedUserEmail) {
                return;
            }

            const row: AnalyticsEventRow = {
                user_email: resolvedUserEmail,
                environment: getEnvironment(),
                extension_version: getExtensionVersion(),
                event_name: eventName,
                feature_area: featureArea,
                terminal: normalizeTerminal(terminal),
                success,
                error_type: errorType,
                metadata: sanitizeMetadata(metadata),
                created_at: new Date().toISOString(),
            };

            const { error } = await supabase.from('analytics_events').insert([row]);
            if (error) {
                consoleLog('Failed to track analytics event:', error);
            }
        } catch (error) {
            consoleError('Analytics tracking failed:', error);
        }
    },

    async trackSessionStarted(source: 'login' | 'restored', userEmail?: string): Promise<void> {
        await this.trackEvent({
            eventName: 'session_started',
            featureArea: 'auth',
            metadata: { source },
            userEmail,
        });
    },

    async trackTabViewed(tab: PopupAnalyticsTab, userEmail?: string): Promise<void> {
        await this.trackEvent({
            eventName: 'tab_viewed',
            featureArea: 'popup',
            metadata: { tab },
            userEmail,
        });
    },

    async trackBookingStarted(
        terminal: AnalyticsTerminal | BookingTerminal | null,
        metadata?: AnalyticsMetadata,
        userEmail?: string,
    ): Promise<void> {
        await this.trackEvent({
            eventName: 'booking_started',
            featureArea: 'booking',
            terminal,
            metadata,
            userEmail,
        });
    },

    async trackBookingResultFromStatus(
        terminal: AnalyticsTerminal | BookingTerminal | null,
        status: string,
        metadata?: AnalyticsMetadata,
        userEmail?: string,
    ): Promise<void> {
        const result = getBookingResultFieldsFromStatus(status);
        if (!result) {
            return;
        }

        await this.trackEvent({
            eventName: 'booking_result',
            featureArea: 'booking',
            terminal,
            success: result.success,
            errorType: result.errorType,
            metadata: {
                status,
                ...metadata,
            },
            userEmail,
        });
    },

    async trackBookingResult(
        { terminal, success, errorType = null, metadata }: BookingResultInput,
        userEmail?: string,
    ): Promise<void> {
        await this.trackEvent({
            eventName: 'booking_result',
            featureArea: 'booking',
            terminal,
            success,
            errorType,
            metadata,
            userEmail,
        });
    },

    async trackContainerMonitorAction(
        action: ContainerMonitorAction,
        metadata?: AnalyticsMetadata,
        userEmail?: string,
    ): Promise<void> {
        await this.trackEvent({
            eventName: 'container_monitor_action',
            featureArea: 'container_monitor',
            metadata: {
                action,
                ...metadata,
            },
            userEmail,
        });
    },
};
