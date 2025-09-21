export interface LoginCredentials {
    email: string;
    password: string;
}

export interface SignUpData extends LoginCredentials {
    metadata?: Record<string, any>;
}

export interface AuthState {
    user: any | null;
    loading: boolean;
    error: string | null;
    device_id?: string;
}
