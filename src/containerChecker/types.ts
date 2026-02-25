/**
 * Container Checker types
 */

export const SUPPORTED_PORTS = ['DCT', 'BCT', 'GCT'] as const;
export type SupportedPort = (typeof SUPPORTED_PORTS)[number];

export interface ContainerCheckerSettings {
    pollingMinutes: number;
}

export interface PortCheckResult {
    port: SupportedPort;
    containerNumber: string;
    statusText: string;
    stateText: string;
    milestone: string;
    dataTimestamp: string | null;
    observedAt: string;
    raw?: Record<string, string>;
}

export interface WatchlistItem {
    containerNumber: string;
    port: SupportedPort;
    status: string;
    state: string;
    statusChanged: boolean;
    stateChanged: boolean;
    hasErrors: boolean;
    errors: string[];
    lastNotifiedSignature: string | null;
    lastUpdate: string | null;
    lastChangeAt: string | null;
    lastCheckedAt: string | null;
    snapshot: PortCheckResult | null;
}

export interface ContainerCheckerState {
    watchlist: WatchlistItem[];
    settings: ContainerCheckerSettings;
    lastRunAt: string | null;
}

export const DEFAULT_CONTAINER_CHECKER_SETTINGS: ContainerCheckerSettings = {
    pollingMinutes: 10,
};
