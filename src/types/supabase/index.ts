import { Database } from './database'

// Извлекаем типы из автогенерированных
export type Tables<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Update']

// Типы для конкретных таблиц
export type Profile = Tables<'profiles'>
export type ProfileInsert = TablesInsert<'profiles'>
export type ProfileUpdate = TablesUpdate<'profiles'>

// Кастомные типы для приложения
export interface AuthState {
    user: any | null
    loading: boolean
    error: string | null
}

export interface ChromeMessage {
    type: string
    payload?: any
}

// Реэкспорт типов Supabase
export type { User, Session, AuthError } from '@supabase/supabase-js'
