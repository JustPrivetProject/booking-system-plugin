import { supabase } from './supabaseClient'
import { getOrCreateDeviceId } from '../utils/deviceId'
import { sessionService } from './sessionService'

export interface AuthUser {
    id: string
    email: string
    deviceId: string
}

export const authService = {
    async register(email: string, password: string): Promise<AuthUser | null> {
        const deviceId = await getOrCreateDeviceId()
        const { data: authData, error: authError } = await supabase.auth.signUp(
            {
                email,
                password,
            }
        )

        if (authError) throw authError
        if (!authData.user) return null

        // Не вставляем профиль! Просто возвращаем успех.
        return {
            id: authData.user.id,
            email: authData.user.email!,
            deviceId,
        }
    },

    async login(email: string, password: string): Promise<AuthUser | null> {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) throw error
        if (!data.user) return null

        const deviceId = await getOrCreateDeviceId()

        // Проверяем, есть ли профиль
        let { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('device_id')
            .eq('id', data.user.id)
            .single()

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
                        email: data.user.email!,
                        device_id: deviceId,
                    },
                ])
                .select()
                .single()
            if (insertError) throw insertError
            profile = newProfile
        } else if (profileError) {
            throw profileError
        }

        const user = {
            id: data.user.id,
            email: data.user.email!,
            deviceId: profile?.device_id || deviceId,
        }

        await sessionService.saveSession(user)

        return user
    },

    async logout(): Promise<void> {
        const { error } = await supabase.auth.signOut()
        if (error) throw error

        // Clear local session
        await sessionService.clearSession()
    },

    async getCurrentUser(): Promise<AuthUser | null> {
        // First check local session
        const localUser = await sessionService.getCurrentUser()
        if (localUser) {
            return localUser
        }

        // If no local session, check Supabase session
        const {
            data: { user },
            error,
        } = await supabase.auth.getUser()
        if (error || !user) return null

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('device_id')
            .eq('id', user.id)
            .single()

        if (profileError) return null

        const authUser = {
            id: user.id,
            email: user.email!,
            deviceId: profile.device_id,
        }

        // Save session for future use
        await sessionService.saveSession(authUser)

        return authUser
    },

    async isAuthenticated(): Promise<boolean> {
        return await sessionService.isAuthenticated()
    },
}
