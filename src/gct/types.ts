import { Statuses } from '../data';

export const GCT_STORAGE_KEYS = {
    GROUPS: 'gctGroups',
    SETTINGS: 'gctSettings',
    LAST_TICK_AT: 'gctLastTickAt',
} as const;

export const GCT_WATCHER_DEFAULTS = {
    pollMinMs: 8000,
    pollMaxMs: 8000,
    jitterMinMs: 1000,
    jitterMaxMs: 2500,
} as const;

export const GCT_ALLOWED_START_TIMES = [
    '00:30',
    '02:30',
    '04:30',
    '06:30',
    '08:30',
    '10:30',
    '12:30',
    '14:30',
    '16:30',
    '18:30',
    '20:30',
    '22:30',
] as const;

export type GctAllowedStartTime = (typeof GCT_ALLOWED_START_TIMES)[number];
export type GctRowStatus =
    | (typeof Statuses)[keyof typeof Statuses]
    | 'watching'
    | 'attempting'
    | 'completed';
export type GctGroupStatus =
    | 'watching'
    | 'success'
    | 'completed'
    | 'paused'
    | 'auth-lost'
    | 'error';
export type GctHistoryEventType =
    | 'created'
    | 'watching'
    | 'not-found'
    | 'ambiguous'
    | 'attempt'
    | 'verified'
    | 'taken'
    | 'expired'
    | 'auth-lost'
    | 'network-error'
    | 'error'
    | 'stopped';

export interface GctWatcherSettings {
    pollMinMs: number;
    pollMaxMs: number;
    jitterMinMs: number;
    jitterMaxMs: number;
}

export interface GctHistoryEvent {
    at: string;
    type: GctHistoryEventType;
    message: string;
}

export interface GctTargetSlotDraft {
    date: string;
    startTime: GctAllowedStartTime;
}

export interface GctWatchRow {
    id: string;
    targetDate: string;
    targetStartTime: string;
    targetEndDate: string;
    targetEndTime: string;
    targetStartLocal: string;
    targetEndLocal: string;
    status: GctRowStatus;
    statusMessage: string;
    active: boolean;
    isManualPause: boolean;
    lastAttemptAt: string | null;
    lastMatchedAt: string | null;
    lastVerifiedAt: string | null;
    lastError: string | null;
    history: GctHistoryEvent[];
}

export interface GctWatchGroup {
    id: string;
    documentNumber: string;
    vehicleNumber: string;
    containerNumber: string;
    rows: GctWatchRow[];
    createdAt: string;
    updatedAt: string;
    status: GctGroupStatus;
    statusMessage: string;
    isExpanded: boolean;
}

export interface GctState {
    groups: GctWatchGroup[];
    settings: GctWatcherSettings;
    lastTickAt: string | null;
}

export interface GctGroupDraft {
    documentNumber: string;
    vehicleNumber: string;
    containerNumber: string;
    slots: GctTargetSlotDraft[];
}

export interface GctSlotMatch {
    idrow: number;
    startUtc: string;
    endUtc: string;
    startLocal: string;
    endLocal: string;
    miejsc: number;
    zajete: number;
}

export interface GctCurrentBooking {
    idrow: number;
    kontener: string;
    poczatek: string;
    koniec: string;
}

export interface GctBookRowPayload {
    idrow: number;
    poczatek: string;
    koniec: string;
    miejsc: number;
    zajete: number;
}

export const DEFAULT_GCT_STATE: GctState = {
    groups: [],
    settings: { ...GCT_WATCHER_DEFAULTS },
    lastTickAt: null,
};
