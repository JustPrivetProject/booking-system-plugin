import type { User } from '@supabase/supabase-js';

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface SignUpData extends LoginCredentials {
    metadata?: Record<string, unknown>;
}

export interface AuthState {
    user: User | null;
    loading: boolean;
    error: string | null;
    device_id?: string;
}
