import {
    keepEbramaSessionAlive,
    shouldRunEbramaKeepAlive,
} from '../../../src/services/ebramaSessionService';

jest.mock('../../../src/utils', () => ({
    fetchRequest: jest.fn(),
    getStorage: jest.fn(),
    setStorage: jest.fn(),
    consoleLog: jest.fn(),
    consoleError: jest.fn(),
}));

describe('ebramaSessionService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should run keepalive only when retry queue is active and not unauthorized', async () => {
        const { getStorage } = require('../../../src/utils');
        getStorage.mockResolvedValue({
            retryEnabled: true,
            retryQueue: [{ id: '1' }],
            unauthorized: false,
        });

        await expect(shouldRunEbramaKeepAlive()).resolves.toBe(true);

        getStorage.mockResolvedValue({ retryEnabled: true, retryQueue: [], unauthorized: false });
        await expect(shouldRunEbramaKeepAlive()).resolves.toBe(false);
    });

    it('should set unauthorized when keepalive lands on login page', async () => {
        const { getStorage, fetchRequest, setStorage } = require('../../../src/utils');
        getStorage.mockResolvedValue({
            retryEnabled: true,
            retryQueue: [{ id: '1' }],
            unauthorized: false,
        });
        fetchRequest.mockResolvedValue({
            ok: true,
            url: 'https://ebrama.baltichub.com/Account/Login',
            text: jest
                .fn()
                .mockResolvedValue(
                    '<!DOCTYPE html><html><form action="/Account/Login"></form></html>',
                ),
        });

        await keepEbramaSessionAlive();

        expect(setStorage).toHaveBeenCalledWith({ unauthorized: true });
    });
});
