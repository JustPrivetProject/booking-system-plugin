import {
    keepEbramaSessionAlive,
    shouldRunEbramaKeepAlive,
} from '../../../src/services/ebramaSessionService';
import { BOOKING_TERMINALS } from '../../../src/types/terminal';
const chromeMock = require('../mocks/chrome').chromeMock;

jest.mock('../../../src/utils', () => ({
    fetchRequest: jest.fn(),
    consoleLog: jest.fn(),
    consoleError: jest.fn(),
}));

jest.mock('../../../src/utils/storage', () => {
    const actual = jest.requireActual('../../../src/utils/storage');
    return {
        ...actual,
        getTerminalStorageValue: jest.fn(),
        setTerminalStorageValue: jest.fn(),
    };
});

describe('ebramaSessionService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        chromeMock.storage.local.get.mockReset();
    });

    it('should run keepalive only when retry queue is active and not unauthorized', async () => {
        const { getTerminalStorageValue } = require('../../../src/utils/storage');
        chromeMock.storage.local.get.mockResolvedValue({ retryEnabled: true });
        getTerminalStorageValue.mockResolvedValueOnce([{ id: '1' }]).mockResolvedValueOnce(false);

        await expect(shouldRunEbramaKeepAlive()).resolves.toBe(true);

        getTerminalStorageValue.mockResolvedValueOnce([]).mockResolvedValueOnce(false);
        await expect(shouldRunEbramaKeepAlive()).resolves.toBe(false);
    });

    it('should set unauthorized when keepalive lands on login page', async () => {
        const { fetchRequest } = require('../../../src/utils');
        const {
            getTerminalStorageValue,
            setTerminalStorageValue,
        } = require('../../../src/utils/storage');
        chromeMock.storage.local.get.mockResolvedValue({ retryEnabled: true });
        getTerminalStorageValue.mockResolvedValueOnce([{ id: '1' }]).mockResolvedValueOnce(false);
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

        expect(setTerminalStorageValue).toHaveBeenCalledWith('unauthorized', 'dct', true);
    });

    it('should use BCT routing and detect the public home login CTA as unauthorized', async () => {
        const { fetchRequest } = require('../../../src/utils');
        const {
            getTerminalStorageValue,
            setTerminalStorageValue,
        } = require('../../../src/utils/storage');
        chromeMock.storage.local.get.mockResolvedValue({ retryEnabled: true });
        getTerminalStorageValue
            .mockResolvedValueOnce([{ id: 'bct-1' }])
            .mockResolvedValueOnce(false);
        fetchRequest.mockResolvedValue({
            ok: true,
            url: 'https://ebrama.bct.ictsi.com/',
            text: jest
                .fn()
                .mockResolvedValue(
                    '<!DOCTYPE html><html><a href="/login">Przejdź do logowania</a></html>',
                ),
        });

        await keepEbramaSessionAlive(BOOKING_TERMINALS.BCT);

        expect(fetchRequest).toHaveBeenCalledWith(
            'https://ebrama.bct.ictsi.com/tv-apps',
            expect.objectContaining({
                headers: expect.objectContaining({
                    Referer: 'https://ebrama.bct.ictsi.com/tv-apps',
                }),
            }),
        );
        expect(setTerminalStorageValue).toHaveBeenCalledWith('unauthorized', 'bct', true);
    });
});
