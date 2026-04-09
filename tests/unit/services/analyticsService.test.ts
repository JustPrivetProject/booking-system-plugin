import { analyticsService } from '../../../src/services/analyticsService';
import { BOOKING_TERMINALS } from '../../../src/types/terminal';

jest.mock('../../../src/services/sessionService', () => ({
    sessionService: {
        getCurrentUser: jest.fn(),
    },
}));

jest.mock('../../../src/services/authService', () => ({
    authService: {
        getCurrentUser: jest.fn(),
    },
}));

jest.mock('../../../src/services/supabaseClient', () => ({
    supabase: {
        from: jest.fn(),
    },
}));

jest.mock('../../../src/utils', () => ({
    consoleLog: jest.fn(),
    consoleError: jest.fn(),
}));

describe('analyticsService', () => {
    const mockSessionService = require('../../../src/services/sessionService').sessionService;
    const mockAuthService = require('../../../src/services/authService').authService;
    const mockSupabase = require('../../../src/services/supabaseClient').supabase;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.NODE_ENV = 'development';
        (global as typeof globalThis & { chrome?: unknown }).chrome = {
            runtime: {
                getManifest: () => ({ version: '3.0.5' }),
            },
        } as unknown as typeof chrome;
    });

    afterEach(() => {
        delete (global as any).chrome;
    });

    it('does not insert analytics rows when there is no authenticated email', async () => {
        mockSessionService.getCurrentUser.mockResolvedValue(null);
        mockAuthService.getCurrentUser.mockResolvedValue(null);

        await analyticsService.trackTabViewed('booking');

        expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('inserts an analytics row with normalized environment and version', async () => {
        mockSessionService.getCurrentUser.mockResolvedValue({ email: 'User@Example.com' });

        const insert = jest.fn().mockResolvedValue({ error: null });
        mockSupabase.from.mockReturnValue({ insert });

        await analyticsService.trackBookingStarted(BOOKING_TERMINALS.BCT, {
            mode: 'retry_queue',
            action: 'add',
        });

        expect(mockSupabase.from).toHaveBeenCalledWith('analytics_events');
        expect(insert).toHaveBeenCalledWith([
            expect.objectContaining({
                user_email: 'user@example.com',
                environment: 'dev',
                extension_version: '3.0.5',
                event_name: 'booking_started',
                feature_area: 'booking',
                terminal: 'BCT',
                metadata: {
                    mode: 'retry_queue',
                    action: 'add',
                },
            }),
        ]);
    });

    it('removes forbidden metadata fields before insert', async () => {
        mockSessionService.getCurrentUser.mockResolvedValue({ email: 'user@example.com' });

        const insert = jest.fn().mockResolvedValue({ error: null });
        mockSupabase.from.mockReturnValue({ insert });

        await analyticsService.trackContainerMonitorAction('check_completed', {
            containers_count: 3,
            containerNumber: 'MSCU1234567',
            password: 'secret',
        });

        expect(insert).toHaveBeenCalledWith([
            expect.objectContaining({
                metadata: {
                    action: 'check_completed',
                    containers_count: 3,
                },
            }),
        ]);
    });

    it('maps booking statuses to booking_result rows', async () => {
        mockSessionService.getCurrentUser.mockResolvedValue({ email: 'user@example.com' });

        const insert = jest.fn().mockResolvedValue({ error: null });
        mockSupabase.from.mockReturnValue({ insert });

        await analyticsService.trackBookingResultFromStatus('DCT', 'authorization-error');

        expect(insert).toHaveBeenCalledWith([
            expect.objectContaining({
                event_name: 'booking_result',
                terminal: 'DCT',
                success: false,
                error_type: 'auth',
                metadata: {
                    status: 'authorization-error',
                },
            }),
        ]);
    });
});
