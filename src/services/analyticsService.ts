import { BOOKING_TERMINALS, type BookingTerminal } from '../types/terminal';
import { consoleError, consoleLog } from '../utils';

import { authService } from './authService';
import { sessionService } from './sessionService';
import { supabase } from './supabaseClient';

type AnalyticsFeatureArea = 'booking' | 'container_monitor';
type AnalyticsTerminal = 'DCT' | 'BCT' | 'GCT';
type AnalyticsAction = 'container_added' | 'slot_added' | 'booking_success';

interface AnalyticsEventRow {
    created_at: string;
    user_email: string;
    extension_version: string;
    feature_area: AnalyticsFeatureArea;
    terminal: AnalyticsTerminal;
    action: AnalyticsAction;
    container_key?: string | null;
}

interface TrackActivityInput {
    featureArea: AnalyticsFeatureArea;
    terminal: AnalyticsTerminal | BookingTerminal | null | undefined;
    action: AnalyticsAction;
    userEmail?: string;
    containerNumber?: string | null;
}

interface TrackEventOptions {
    userEmail?: string;
    containerNumber?: string | null;
}

function stringifyForLog(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }

    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
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

async function hasSupabaseAuthSession(): Promise<boolean> {
    try {
        const {
            data: { session },
            error,
        } = await supabase.auth.getSession();

        if (error) {
            consoleError('Failed to resolve Supabase auth session for analytics:', error);
            return false;
        }

        return Boolean(session);
    } catch (error) {
        consoleError('Analytics session resolution failed:', error);
        return false;
    }
}

function normalizeContainerNumber(containerNumber?: string | null): string | null {
    if (!containerNumber) {
        return null;
    }

    const normalized = containerNumber.trim().toUpperCase().replace(/\s+/g, '');
    return normalized.length > 0 ? normalized : null;
}

function toHexString(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
}

async function buildContainerKey(containerNumber?: string | null): Promise<string | null> {
    const normalized = normalizeContainerNumber(containerNumber);
    if (!normalized) {
        return null;
    }

    const subtle = globalThis.crypto?.subtle;
    if (!subtle) {
        return null;
    }

    try {
        const payload = new TextEncoder().encode(normalized);
        const digest = await subtle.digest('SHA-256', payload);
        return toHexString(new Uint8Array(digest));
    } catch (error) {
        consoleError(
            'Failed to hash analytics container key:',
            error instanceof Error ? error : stringifyForLog(error),
        );
        return null;
    }
}

export const analyticsService = {
    async trackActivity({
        featureArea,
        terminal,
        action,
        userEmail,
        containerNumber,
    }: TrackActivityInput): Promise<void> {
        try {
            const resolvedUserEmail = await resolveUserEmail(userEmail);
            if (!resolvedUserEmail) {
                return;
            }

            const normalizedTerminal = normalizeTerminal(terminal);
            if (!normalizedTerminal) {
                consoleLog('Skipping analytics event with unresolved terminal:', {
                    action,
                    featureArea,
                    terminal,
                });
                return;
            }

            if (!(await hasSupabaseAuthSession())) {
                consoleLog(
                    'Skipping analytics event because Supabase auth session is unavailable:',
                    {
                        action,
                        featureArea,
                        terminal: normalizedTerminal,
                        userEmail: resolvedUserEmail,
                    },
                );
                return;
            }

            const containerKey = await buildContainerKey(containerNumber);

            const row: AnalyticsEventRow = {
                created_at: new Date().toISOString(),
                user_email: resolvedUserEmail,
                extension_version: getExtensionVersion(),
                feature_area: featureArea,
                terminal: normalizedTerminal,
                action,
            };

            if (containerKey) {
                row.container_key = containerKey;
            }

            const { error } = await supabase.from('analytics_events').insert([row]);

            if (error) {
                consoleError(
                    'Failed to track analytics event:',
                    stringifyForLog({
                        action,
                        code: error.code,
                        details: error.details,
                        hint: error.hint,
                        message: error.message,
                        row,
                    }),
                );
            }
        } catch (error) {
            consoleError(
                'Analytics tracking failed:',
                error instanceof Error ? error : stringifyForLog(error),
            );
        }
    },

    async trackContainerAdded(
        featureArea: AnalyticsFeatureArea,
        terminal: AnalyticsTerminal | BookingTerminal | null,
        options: TrackEventOptions = {},
    ): Promise<void> {
        const { userEmail, containerNumber } = options;

        await this.trackActivity({
            featureArea,
            terminal,
            action: 'container_added',
            userEmail,
            containerNumber,
        });
    },

    async trackBookingSuccess(
        terminal: AnalyticsTerminal | BookingTerminal | null,
        options: TrackEventOptions = {},
    ): Promise<void> {
        const { userEmail, containerNumber } = options;

        await this.trackActivity({
            featureArea: 'booking',
            terminal,
            action: 'booking_success',
            userEmail,
            containerNumber,
        });
    },

    async trackSlotAdded(
        featureArea: AnalyticsFeatureArea,
        terminal: AnalyticsTerminal | BookingTerminal | null,
        options: TrackEventOptions = {},
    ): Promise<void> {
        const { userEmail, containerNumber } = options;

        await this.trackActivity({
            featureArea,
            terminal,
            action: 'slot_added',
            userEmail,
            containerNumber,
        });
    },
};
