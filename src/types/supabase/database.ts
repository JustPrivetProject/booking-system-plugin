export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
    public: {
        Tables: {
            feature_access: {
                Row: {
                    user_id: string;
                    feature_key: string;
                    enabled: boolean;
                    updated_at: string | null;
                };
                Insert: {
                    user_id: string;
                    feature_key: string;
                    enabled?: boolean;
                    updated_at?: string | null;
                };
                Update: {
                    user_id?: string;
                    feature_key?: string;
                    enabled?: boolean;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'feature_access_user_id_fkey';
                        columns: ['user_id'];
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            profiles: {
                Row: {
                    id: string;
                    updated_at: string | null;
                    email: string | null;
                    device_id: string | null;
                    username: string | null;
                    full_name: string | null;
                    avatar_url: string | null;
                    website: string | null;
                };
                Insert: {
                    id: string;
                    updated_at?: string | null;
                    email?: string | null;
                    device_id?: string | null;
                    username?: string | null;
                    full_name?: string | null;
                    avatar_url?: string | null;
                    website?: string | null;
                };
                Update: {
                    id?: string;
                    updated_at?: string | null;
                    email?: string | null;
                    device_id?: string | null;
                    username?: string | null;
                    full_name?: string | null;
                    avatar_url?: string | null;
                    website?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'profiles_id_fkey';
                        columns: ['id'];
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            [_ in never]: never;
        };
        Enums: {
            [_ in never]: never;
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
}
