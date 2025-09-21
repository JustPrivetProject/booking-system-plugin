import type { AuthUser } from './authService';

const SESSION_KEY = 'user_session';

export interface SessionData {
    user: AuthUser;
    expiresAt: number;
}

export const sessionService = {
    async saveSession(user: AuthUser): Promise<void> {
        // Session expires in 24 hours
        const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

        const sessionData: SessionData = {
            user,
            expiresAt,
        };

        await chrome.storage.local.set({ [SESSION_KEY]: sessionData });
    },

    async getSession(): Promise<SessionData | null> {
        const result = await chrome.storage.local.get(SESSION_KEY);
        const session = result[SESSION_KEY] as SessionData | undefined;

        if (!session) {
            return null;
        }

        // Check if session is expired
        if (Date.now() > session.expiresAt) {
            await this.clearSession();
            return null;
        }

        return session;
    },

    async clearSession(): Promise<void> {
        await chrome.storage.local.remove(SESSION_KEY);
    },

    async isAuthenticated(): Promise<boolean> {
        const session = await this.getSession();
        return session !== null;
    },

    async getCurrentUser(): Promise<AuthUser | null> {
        const session = await this.getSession();
        return session?.user || null;
    },
};
