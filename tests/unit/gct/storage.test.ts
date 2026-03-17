import {
    getGctState,
    saveGctGroups,
    saveGctSettings,
    touchGctLastTickAt,
} from '../../../src/gct/storage';
import { GCT_STORAGE_KEYS, GCT_WATCHER_DEFAULTS } from '../../../src/gct/types';
import { getStorage, setStorage } from '../../../src/utils/storage';

jest.mock('../../../src/utils/storage');

describe('gct/storage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns defaults when storage is empty', async () => {
        (getStorage as jest.Mock).mockResolvedValue(undefined);

        const state = await getGctState();

        expect(state).toEqual({
            groups: [],
            settings: { ...GCT_WATCHER_DEFAULTS },
            lastTickAt: null,
        });
    });

    it('merges persisted settings with defaults', async () => {
        (getStorage as jest.Mock).mockResolvedValue({
            gctGroups: [{ id: 'g1' }],
            gctSettings: { pollMinMs: 3000 },
            gctLastTickAt: '2026-03-17T10:00:00.000Z',
        });

        const state = await getGctState();

        expect(state.groups).toEqual([{ id: 'g1' }]);
        expect(state.settings).toEqual({
            ...GCT_WATCHER_DEFAULTS,
            pollMinMs: 3000,
        });
        expect(state.lastTickAt).toBe('2026-03-17T10:00:00.000Z');
    });

    it('saves groups under the configured storage key', async () => {
        const groups = [{ id: 'group-1' }];

        await saveGctGroups(groups as any);

        expect(setStorage).toHaveBeenCalledWith({
            [GCT_STORAGE_KEYS.GROUPS]: groups,
        });
    });

    it('merges settings with existing values and defaults', async () => {
        (getStorage as jest.Mock).mockResolvedValue({
            gctSettings: {
                pollMinMs: 4000,
                pollMaxMs: 9000,
            },
        });

        await saveGctSettings({ jitterMaxMs: 7000 });

        expect(setStorage).toHaveBeenCalledWith({
            [GCT_STORAGE_KEYS.SETTINGS]: {
                ...GCT_WATCHER_DEFAULTS,
                pollMinMs: 4000,
                pollMaxMs: 9000,
                jitterMaxMs: 7000,
            },
        });
    });

    it('stores the last tick timestamp', async () => {
        await touchGctLastTickAt('2026-03-17T10:15:00.000Z');

        expect(setStorage).toHaveBeenCalledWith({
            [GCT_STORAGE_KEYS.LAST_TICK_AT]: '2026-03-17T10:15:00.000Z',
        });
    });
});
