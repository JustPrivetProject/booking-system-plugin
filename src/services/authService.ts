import { getOrCreateDeviceId } from '../utils';

import { sessionService } from './sessionService';
import { supabase } from './supabaseClient';

export interface AuthUser {
    id: string;
    email: string;
    deviceId: string;
}

function requireEmail(email: string | undefined | null): string {
    if (!email) {
        throw new Error('User email is missing');
    }

    return email;
}

export const authService = {
    async register(email: string, password: string): Promise<AuthUser | null> {
        const deviceId = await getOrCreateDeviceId();
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
        });

        if (authError) throw authError;
        if (!authData.user) return null;

        // Не вставляем профиль! Просто возвращаем успех.
        return {
            id: authData.user.id,
            email: requireEmail(authData.user.email),
            deviceId,
        };
    },

    async login(email: string, password: string): Promise<AuthUser | null> {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;
        if (!data.user) return null;

        const deviceId = await getOrCreateDeviceId();

        // Проверяем, есть ли профиль
        const response = await supabase
            .from('profiles')
            .select('device_id')
            .eq('id', data.user.id)
            .single();

        let profile = response.data;
        const profileError = response.error;

        // Если профиль не найден (код PGRST116), создаём его
        if (
            profileError &&
            (profileError.code === 'PGRST116' ||
                profileError.details?.includes('Results contain 0 rows'))
        ) {
            const { data: newProfile, error: insertError } = await supabase
                .from('profiles')
                .insert([
                    {
                        id: data.user.id,
                        email: requireEmail(data.user.email),
                        device_id: deviceId,
                    },
                ])
                .select()
                .single();
            if (insertError) throw insertError;
            profile = newProfile;
        } else if (profileError) {
            throw profileError;
        }

        // Проверяем, совпадает ли device_id с тем, что в профиле
        if (profile?.device_id && profile.device_id !== deviceId) {
            throw new Error('Device ID mismatch. Please use the same device you registered with.');
        }

        // Если device_id в профиле пустой или null, обновляем его
        if (!profile?.device_id) {
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ device_id: deviceId })
                .eq('id', data.user.id);
            if (updateError) throw updateError;
            profile = { device_id: deviceId };
        }

        const user = {
            id: data.user.id,
            email: requireEmail(data.user.email),
            deviceId: profile?.device_id || deviceId,
        };

        await sessionService.saveSession(user);

        return user;
    },

    async logout(): Promise<void> {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;

        // Clear local session
        await sessionService.clearSession();
    },

    async getCurrentUser(): Promise<AuthUser | null> {
        return await sessionService.getCurrentUser();
    },

    async isAuthenticated(): Promise<boolean> {
        return await sessionService.isAuthenticated();
    },

    async unbindDevice(email: string, password: string): Promise<void> {
        // First verify credentials
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;
        if (!data.user) throw new Error('Invalid credentials');

        // Get user profile
        const { error: profileError } = await supabase
            .from('profiles')
            .select('device_id')
            .eq('id', data.user.id)
            .single();

        if (profileError) throw profileError;

        // Clear device ID in profile
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ device_id: '' })
            .eq('id', data.user.id);

        if (updateError) throw updateError;

        // Remove device ID from local storage
        await chrome.storage.local.remove('deviceId');
    },
};
