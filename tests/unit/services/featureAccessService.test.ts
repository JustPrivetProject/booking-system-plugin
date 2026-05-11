import { authService } from '../../../src/services/authService';
import { FEATURE_KEYS, featureAccessService } from '../../../src/services/featureAccessService';

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

describe('featureAccessService', () => {
    const mockSupabase = require('../../../src/services/supabaseClient').supabase;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return false when user is not authenticated', async () => {
        (authService.getCurrentUser as jest.Mock).mockResolvedValue(null);

        const result = await featureAccessService.isFeatureEnabled(FEATURE_KEYS.GCT);

        expect(result).toBe(false);
        expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should return true when feature access is enabled', async () => {
        (authService.getCurrentUser as jest.Mock).mockResolvedValue({ id: 'user-1' });

        const maybeSingle = jest.fn().mockResolvedValue({
            data: { gct: true },
            error: null,
        });
        const firstEq = jest.fn().mockReturnValue({ maybeSingle });
        const select = jest.fn().mockReturnValue({ eq: firstEq });

        mockSupabase.from.mockReturnValue({ select });

        const result = await featureAccessService.isFeatureEnabled(FEATURE_KEYS.GCT);

        expect(result).toBe(true);
        expect(mockSupabase.from).toHaveBeenCalledWith('feature_access');
        expect(select).toHaveBeenCalledWith('gct');
        expect(firstEq).toHaveBeenCalledWith('user_id', 'user-1');
    });

    it('should return false when feature row does not exist', async () => {
        (authService.getCurrentUser as jest.Mock).mockResolvedValue({ id: 'user-1' });

        const maybeSingle = jest.fn().mockResolvedValue({
            data: null,
            error: null,
        });
        const firstEq = jest.fn().mockReturnValue({ maybeSingle });

        mockSupabase.from.mockReturnValue({
            select: jest.fn().mockReturnValue({ eq: firstEq }),
        });

        const result = await featureAccessService.isFeatureEnabled(FEATURE_KEYS.GCT);

        expect(result).toBe(false);
    });

    it('should return true for enabled BCT access', async () => {
        (authService.getCurrentUser as jest.Mock).mockResolvedValue({ id: 'user-1' });

        const maybeSingle = jest.fn().mockResolvedValue({
            data: { bct: true },
            error: null,
        });
        const firstEq = jest.fn().mockReturnValue({ maybeSingle });

        mockSupabase.from.mockReturnValue({
            select: jest.fn().mockReturnValue({ eq: firstEq }),
        });

        const result = await featureAccessService.isFeatureEnabled(FEATURE_KEYS.BCT);

        expect(result).toBe(true);
    });

    it('should throw unexpected Supabase errors', async () => {
        (authService.getCurrentUser as jest.Mock).mockResolvedValue({ id: 'user-1' });

        const maybeSingle = jest.fn().mockResolvedValue({
            data: null,
            error: { code: 'XX000', message: 'db failure' },
        });
        const firstEq = jest.fn().mockReturnValue({ maybeSingle });

        mockSupabase.from.mockReturnValue({
            select: jest.fn().mockReturnValue({ eq: firstEq }),
        });

        await expect(featureAccessService.isFeatureEnabled(FEATURE_KEYS.GCT)).rejects.toEqual({
            code: 'XX000',
            message: 'db failure',
        });
    });
});
