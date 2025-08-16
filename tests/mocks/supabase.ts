// Mock Supabase client
export const supabaseMock = {
    auth: {
        signUp: jest.fn(),
        signInWithPassword: jest.fn(),
        signOut: jest.fn(),
        getUser: jest.fn(),
    },
    from: jest.fn(() => ({
        select: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        eq: jest.fn(),
        single: jest.fn(),
    })),
}

// Mock createClient function
export const createClient = jest.fn(() => supabaseMock)

// Export for use in tests
export default {
    createClient,
}
