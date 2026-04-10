import { BOOKING_TERMINALS, type BookingTerminal } from '../types/terminal';
import { consoleError, consoleLog } from '../utils';

import { authService } from './authService';
import { sessionService } from './sessionService';
import { supabase } from './supabaseClient';

type AnalyticsEnvironment = 'dev' | 'prod';
type AnalyticsFeatureArea = 'booking' | 'container_monitor';
type AnalyticsTerminal = 'DCT' | 'BCT' | 'GCT';
type AnalyticsAction = 'container_added' | 'booking_success';

interface AnalyticsEventRow {
    created_at: string;
    user_email: string;
    environment: AnalyticsEnvironment;
    extension_version: string;
    feature_area: AnalyticsFeatureArea;
    terminal: AnalyticsTerminal;
    action: AnalyticsAction;
}

interface TrackActivityInput {
    featureArea: AnalyticsFeatureArea;
    terminal: AnalyticsTerminal | BookingTerminal | null | undefined;
    action: AnalyticsAction;
    userEmail?: string;
}

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
export const analyticsService = {
    async trackActivity({
        featureArea,
        terminal,
        action,
        userEmail,
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

            const row: AnalyticsEventRow = {
                created_at: new Date().toISOString(),
                user_email: resolvedUserEmail,
                environment: getEnvironment(),
                extension_version: getExtensionVersion(),
                feature_area: featureArea,
                terminal: normalizedTerminal,
                action,
            };

            const { error } = await supabase.from('analytics_events').insert([row]);
            if (error) {
                consoleError('Failed to track analytics event:', error);
            }
        } catch (error) {
            consoleError('Analytics tracking failed:', error);
        }
    },

    async trackContainerAdded(
        featureArea: AnalyticsFeatureArea,
        terminal: AnalyticsTerminal | BookingTerminal | null,
        userEmail?: string,
    ): Promise<void> {
        await this.trackActivity({
            featureArea,
            terminal,
            action: 'container_added',
            userEmail,
        });
    },

    async trackBookingSuccess(
        terminal: AnalyticsTerminal | BookingTerminal | null,
        userEmail?: string,
    ): Promise<void> {
        await this.trackActivity({
            featureArea: 'booking',
            terminal,
            action: 'booking_success',
            userEmail,
        });
    },
};
