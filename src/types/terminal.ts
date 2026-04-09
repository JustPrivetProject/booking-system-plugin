export const BOOKING_TERMINALS = {
    DCT: 'dct',
    BCT: 'bct',
} as const;

export type BookingTerminal = (typeof BOOKING_TERMINALS)[keyof typeof BOOKING_TERMINALS];

export function isBookingTerminal(value: unknown): value is BookingTerminal {
    return Object.values(BOOKING_TERMINALS).includes(value as BookingTerminal);
}

export function getBookingTerminalFromUrl(url?: string | null): BookingTerminal | null {
    if (!url) {
        return null;
    }

    try {
        const hostname = new URL(url).hostname.toLowerCase();

        if (hostname === 'ebrama.bct.ictsi.com') {
            return BOOKING_TERMINALS.BCT;
        }

        if (hostname === 'ebrama.baltichub.com' || hostname.endsWith('.baltichub.com')) {
            return BOOKING_TERMINALS.DCT;
        }

        return null;
    } catch {
        return null;
    }
}
