import { authService } from './authService';
import { supabase } from './supabaseClient';
import type { Database } from '../types/supabase/database';

export const FEATURE_KEYS = {
    GCT: 'gct',
    BCT: 'bct',
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

type FeatureAccessRecord = Pick<Database['public']['Tables']['feature_access']['Row'], FeatureKey>;

export function isFeatureKey(value: unknown): value is FeatureKey {
    return Object.values(FEATURE_KEYS).includes(value as FeatureKey);
}

export const featureAccessService = {
    async isFeatureEnabled(featureKey: FeatureKey): Promise<boolean> {
        const user = await authService.getCurrentUser();

        if (!user) {
            return false;
        }

        const { data, error } = await supabase
            .from('feature_access')
            .select(featureKey)
            .eq('user_id', user.id)
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!data) {
            return false;
        }

        return Boolean((data as FeatureAccessRecord)[featureKey]);
    },
};
