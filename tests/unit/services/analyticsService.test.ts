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

        await analyticsService.trackContainerAdded('booking', BOOKING_TERMINALS.DCT);

        expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('inserts a container_added analytics row with explicit terminal context', async () => {
        mockSessionService.getCurrentUser.mockResolvedValue({ email: 'User@Example.com' });

        const insert = jest.fn().mockResolvedValue({ error: null });
        mockSupabase.from.mockReturnValue({ insert });

        await analyticsService.trackContainerAdded('booking', BOOKING_TERMINALS.BCT);

        expect(mockSupabase.from).toHaveBeenCalledWith('analytics_events');
        expect(insert).toHaveBeenCalledWith([
            expect.objectContaining({
                user_email: 'user@example.com',
                environment: 'dev',
                extension_version: '3.0.5',
                feature_area: 'booking',
                terminal: 'BCT',
                action: 'container_added',
            }),
        ]);
    });

    it('inserts booking_success rows with a normalized terminal', async () => {
        mockSessionService.getCurrentUser.mockResolvedValue({ email: 'user@example.com' });

        const insert = jest.fn().mockResolvedValue({ error: null });
        mockSupabase.from.mockReturnValue({ insert });

        await analyticsService.trackBookingSuccess('DCT');

        expect(insert).toHaveBeenCalledWith([
            expect.objectContaining({
                feature_area: 'booking',
                terminal: 'DCT',
                action: 'booking_success',
            }),
        ]);
    });

    it('skips inserts when terminal context cannot be resolved', async () => {
        mockSessionService.getCurrentUser.mockResolvedValue({ email: 'user@example.com' });

        const insert = jest.fn().mockResolvedValue({ error: null });
        mockSupabase.from.mockReturnValue({ insert });

        await analyticsService.trackBookingSuccess(null);

        expect(insert).not.toHaveBeenCalled();
    });
});
