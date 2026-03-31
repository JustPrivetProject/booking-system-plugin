import { authService } from './authService';
import { supabase } from './supabaseClient';

export const FEATURE_KEYS = {
    GCT_TAB: 'gct_tab',
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

function isMissingFeatureError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const typedError = error as { code?: string; details?: string };

    return (
        typedError.code === 'PGRST116' ||
        typedError.details?.includes('Results contain 0 rows') === true
    );
}

export const featureAccessService = {
    async isFeatureEnabled(featureKey: FeatureKey): Promise<boolean> {
        const user = await authService.getCurrentUser();

        if (!user) {
            return false;
        }

        const { data, error } = await supabase
            .from('feature_access')
            .select('enabled')
            .eq('user_id', user.id)
            .eq('feature_key', featureKey)
            .single();

        if (isMissingFeatureError(error)) {
            return false;
        }

        if (error) {
            throw error;
        }

        return Boolean(data?.enabled);
    },
};
