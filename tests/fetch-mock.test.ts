// Test fetch mock functionality
describe('Fetch Mock', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should have fetch mock available', () => {
        expect((global as any).fetch).toBeDefined()
        expect(typeof (global as any).fetch).toBe('function')
    })

    it('should be able to mock fetch responses', async () => {
        const mockResponse = {
            ok: true,
            status: 200,
            text: jest.fn().mockResolvedValue('{"data": "test"}'),
            json: jest.fn().mockResolvedValue({ data: 'test' }),
        }

        ;(global as any).fetch = jest.fn().mockResolvedValue(mockResponse)

        const response = await (global as any).fetch('https://api.test.com')

        expect(response.ok).toBe(true)
        expect(response.status).toBe(200)
        expect(await response.text()).toBe('{"data": "test"}')
        expect(await response.json()).toEqual({ data: 'test' })
    })

    it('should be able to mock fetch errors', async () => {
        const networkError = new Error('Network error')
        ;(global as any).fetch = jest.fn().mockRejectedValue(networkError)

        await expect(
            (global as any).fetch('https://api.test.com')
        ).rejects.toThrow('Network error')
    })

    it('should track fetch calls', async () => {
        const mockResponse = {
            ok: true,
            status: 200,
            text: jest.fn().mockResolvedValue('success'),
        }
        ;(global as any).fetch = jest.fn().mockResolvedValue(mockResponse)

        await (global as any).fetch('https://api.test.com', { method: 'GET' })
        await (global as any).fetch('https://api.test.com', { method: 'POST' })

        expect((global as any).fetch).toHaveBeenCalledTimes(2)
        expect((global as any).fetch).toHaveBeenCalledWith(
            'https://api.test.com',
            { method: 'GET' }
        )
        expect((global as any).fetch).toHaveBeenCalledWith(
            'https://api.test.com',
            { method: 'POST' }
        )
    })
})
