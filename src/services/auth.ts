import { supabase } from './supbaseClient'
import { getOrCreateDeviceId } from '../utils/utils-function'

const MAX_SESSION_AGE_MINUTES = 60

function isSessionExpired(lastActiveAt: string): boolean {
    const lastSeen = new Date(lastActiveAt)
    const minutesAgo = (Date.now() - lastSeen.getTime()) / (1000 * 60)
    return minutesAgo > MAX_SESSION_AGE_MINUTES
}

interface LoginResult {
    success?: true
    user?: any
    error?: string
}

export async function loginWithEmail(
    email: string,
    password: string
): Promise<LoginResult> {
    const deviceId = getOrCreateDeviceId()

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })
    if (error) return { error: error.message }

    const user = data.user

    const { data: sessionData } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', user.id)
        .single()

    if (sessionData) {
        if (
            sessionData.device_id !== deviceId &&
            !isSessionExpired(sessionData.last_active_at)
        ) {
            await supabase.auth.signOut()
            return { error: 'Вы уже вошли на другом устройстве' }
        }
    }

    await supabase.from('user_sessions').upsert({
        user_id: user.id,
        device_id: deviceId,
        last_active_at: new Date().toISOString(),
    })

    return { success: true, user }
}

export async function refreshSession(): Promise<void> {
    const deviceId = getOrCreateDeviceId()
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) return

    await supabase
        .from('user_sessions')
        .update({ last_active_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('device_id', deviceId)
}

export async function logout(): Promise<void> {
    const deviceId = getOrCreateDeviceId()
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) return

    await supabase
        .from('user_sessions')
        .delete()
        .eq('user_id', user.id)
        .eq('device_id', deviceId)

    await supabase.auth.signOut()
}

export async function logoutEverywhere(): Promise<void> {
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) return

    await supabase.from('user_sessions').delete().eq('user_id', user.id)
    await supabase.auth.signOut()
}
