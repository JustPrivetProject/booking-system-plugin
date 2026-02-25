import { toMilestone, checkPort } from '../../../../src/services/containerChecker/portCheckers';

describe('Port Checkers', () => {
    describe('toMilestone', () => {
        it('should return UNKNOWN for empty status', () => {
            expect(toMilestone('')).toBe('UNKNOWN');
        });

        it('should return OTHER for whitespace-only status', () => {
            expect(toMilestone('   ')).toBe('OTHER');
        });

        it('should return GATE_OUT for gate out / podjęcia / time out / wyjazd', () => {
            expect(toMilestone('Gate Out')).toBe('GATE_OUT');
            expect(toMilestone('gate out')).toBe('GATE_OUT');
            expect(toMilestone('podjęcia')).toBe('GATE_OUT');
            expect(toMilestone('Time Out')).toBe('GATE_OUT');
            expect(toMilestone('wyjazd')).toBe('GATE_OUT');
        });

        it('should return IN_TERMINAL for yard / terminal / na terminalu / time in', () => {
            expect(toMilestone('yard')).toBe('IN_TERMINAL');
            expect(toMilestone('terminal')).toBe('IN_TERMINAL');
            expect(toMilestone('na terminalu')).toBe('IN_TERMINAL');
            expect(toMilestone('time in')).toBe('IN_TERMINAL');
        });

        it('should return DISCHARGED for discharge / wyład', () => {
            expect(toMilestone('discharged')).toBe('DISCHARGED');
            expect(toMilestone('wyład')).toBe('DISCHARGED');
        });

        it('should return CUSTOMS for custom / celn', () => {
            expect(toMilestone('custom')).toBe('CUSTOMS');
            expect(toMilestone('celn')).toBe('CUSTOMS');
        });

        it('should return OTHER for unrecognized status', () => {
            expect(toMilestone('unknown status')).toBe('OTHER');
            expect(toMilestone('loading')).toBe('OTHER');
        });
    });

    describe('checkPort', () => {
        const originalFetch = global.fetch;

        beforeEach(() => {
            jest.clearAllMocks();
            (global as any).fetch = jest.fn();
        });

        afterEach(() => {
            (global as any).fetch = originalFetch;
        });

        it('should throw for unsupported port', async () => {
            await expect(checkPort('ABCD123', 'INVALID')).rejects.toThrow('Unsupported port');
            await expect(checkPort('ABCD123', '')).rejects.toThrow('Unsupported port');
            expect((global as any).fetch).not.toHaveBeenCalled();
        });

        it('should normalize container ID to uppercase', async () => {
            const mockFetch = (global as any).fetch as jest.Mock;
            mockFetch
                .mockResolvedValueOnce({ text: () => Promise.resolve('') })
                .mockResolvedValueOnce({
                    ok: true,
                    text: () =>
                        Promise.resolve(`
                            <tr><th>Stops</th><td>1</td></tr>
                            <tr><th>T-State</th><td>Test</td></tr>
                        `),
                });

            await checkPort('  abcd123  ', 'DCT');

            expect(mockFetch).toHaveBeenCalled();
            const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
            const body = lastCall[1]?.body;
            expect(body).toBeDefined();
            if (body instanceof URLSearchParams) {
                expect(body.get('id[]') || body.toString()).toContain('ABCD123');
            }
        });

        it('should return null match and empty errors on successful DCT check', async () => {
            const mockFetch = (global as any).fetch as jest.Mock;
            mockFetch
                .mockResolvedValueOnce({ text: () => Promise.resolve('') })
                .mockResolvedValueOnce({
                    ok: true,
                    text: () =>
                        Promise.resolve(`
                            <html><body>
                            <tr><th>Stops</th><td>1</td></tr>
                            <tr><th>T-State</th><td>In Terminal</td></tr>
                            <tr><th>Time In</th><td>2024-01-15 10:00</td></tr>
                            </body></html>
                            ABCD1234567
                        `),
                });

            const result = await checkPort('ABCD1234567', 'DCT');

            expect(result.errors).toEqual([]);
            expect(result.match).not.toBeNull();
            expect(result.match?.port).toBe('DCT');
            expect(result.match?.containerNumber).toBe('ABCD1234567');
            expect(result.match?.milestone).toBe('IN_TERMINAL');
        });

        it('should return null when container not found in DCT response', async () => {
            const mockFetch = (global as any).fetch as jest.Mock;
            mockFetch
                .mockResolvedValueOnce({ text: () => Promise.resolve('') })
                .mockResolvedValueOnce({
                    ok: true,
                    text: () => Promise.resolve('<html>brak wyników</html>'),
                });

            const result = await checkPort('NOTFOUND123', 'DCT');

            expect(result.match).toBeNull();
            expect(result.errors).toEqual([]);
        });

        it('should return errors on fetch failure', async () => {
            const mockFetch = (global as any).fetch as jest.Mock;
            mockFetch.mockRejectedValue(new Error('Network error'));

            const result = await checkPort('ABCD123', 'DCT');

            expect(result.match).toBeNull();
            expect(result.errors).toContain('Network error');
        });
    });
});
