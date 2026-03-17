import { GctHandler } from '../../../src/background/handlers/GctHandler';
import { saveGctSettings } from '../../../src/gct/storage';
import { gctWatcherService } from '../../../src/services/gct/gctWatcherService';

jest.mock('../../../src/gct/storage');
jest.mock('../../../src/services/gct/gctWatcherService', () => ({
    gctWatcherService: {
        getState: jest.fn(),
        addGroup: jest.fn(),
        replaceGroupSlots: jest.fn(),
        removeGroup: jest.fn(),
        removeRow: jest.fn(),
        updateRowSlot: jest.fn(),
        toggleGroupExpanded: jest.fn(),
        pauseGroup: jest.fn(),
        resumeGroup: jest.fn(),
        pauseRow: jest.fn(),
        resumeRow: jest.fn(),
        ensureSchedules: jest.fn(),
    },
}));

describe('GctHandler', () => {
    let handler: GctHandler;

    beforeEach(() => {
        jest.clearAllMocks();
        handler = new GctHandler();
        (gctWatcherService.getState as jest.Mock).mockResolvedValue({ groups: [] });
        (gctWatcherService.addGroup as jest.Mock).mockResolvedValue({ ok: true });
        (gctWatcherService.replaceGroupSlots as jest.Mock).mockResolvedValue({ ok: true });
        (gctWatcherService.removeGroup as jest.Mock).mockResolvedValue({ ok: true });
        (gctWatcherService.removeRow as jest.Mock).mockResolvedValue({ ok: true });
        (gctWatcherService.updateRowSlot as jest.Mock).mockResolvedValue({ ok: true });
        (gctWatcherService.toggleGroupExpanded as jest.Mock).mockResolvedValue({ ok: true });
        (gctWatcherService.pauseGroup as jest.Mock).mockResolvedValue({ ok: true });
        (gctWatcherService.resumeGroup as jest.Mock).mockResolvedValue({ ok: true });
        (gctWatcherService.pauseRow as jest.Mock).mockResolvedValue({ ok: true });
        (gctWatcherService.resumeRow as jest.Mock).mockResolvedValue({ ok: true });
        (gctWatcherService.ensureSchedules as jest.Mock).mockResolvedValue(undefined);
        (saveGctSettings as jest.Mock).mockResolvedValue(undefined);
    });

    it('returns current state', async () => {
        const result = await handler.handleMessage({ target: 'gct', type: 'GET_STATE' });

        expect(result).toEqual({ groups: [] });
        expect(gctWatcherService.getState).toHaveBeenCalled();
    });

    it('adds a group', async () => {
        const group = {
            documentNumber: 'DOC',
            vehicleNumber: 'VEH',
            containerNumber: 'CONT',
            slots: [{ date: '2026-03-18', startTime: '04:30' as const }],
        };

        await handler.handleMessage({
            target: 'gct',
            type: 'ADD_GROUP',
            group,
        });

        expect(gctWatcherService.addGroup).toHaveBeenCalledWith(group);
    });

    it('throws when add group payload is missing', async () => {
        await expect(handler.handleMessage({ target: 'gct', type: 'ADD_GROUP' })).rejects.toThrow(
            'Group payload is required',
        );
    });

    it.each([
        ['REMOVE_GROUP', { groupId: 'g1' }, 'removeGroup', ['g1']],
        [
            'REPLACE_GROUP_SLOTS',
            {
                groupId: 'g1',
                slots: [{ date: '2026-03-18', startTime: '06:30' as const }],
            },
            'replaceGroupSlots',
            ['g1', [{ date: '2026-03-18', startTime: '06:30' }]],
        ],
        ['REMOVE_ROW', { groupId: 'g1', rowId: 'r1' }, 'removeRow', ['g1', 'r1']],
        [
            'UPDATE_ROW_SLOT',
            {
                groupId: 'g1',
                rowId: 'r1',
                slot: { date: '2026-03-18', startTime: '06:30' as const },
            },
            'updateRowSlot',
            ['g1', 'r1', { date: '2026-03-18', startTime: '06:30' }],
        ],
        ['TOGGLE_GROUP_EXPANDED', { groupId: 'g1' }, 'toggleGroupExpanded', ['g1']],
        ['PAUSE_GROUP', { groupId: 'g1' }, 'pauseGroup', ['g1']],
        ['RESUME_GROUP', { groupId: 'g1' }, 'resumeGroup', ['g1']],
        ['PAUSE_ROW', { groupId: 'g1', rowId: 'r1' }, 'pauseRow', ['g1', 'r1']],
        ['RESUME_ROW', { groupId: 'g1', rowId: 'r1' }, 'resumeRow', ['g1', 'r1']],
    ])('routes %s messages', async (type, payload, method, args) => {
        await handler.handleMessage({ target: 'gct', type: type as any, ...(payload as object) });

        expect((gctWatcherService as any)[method]).toHaveBeenCalledWith(...args);
    });

    it('throws for missing remove group id', async () => {
        await expect(
            handler.handleMessage({ target: 'gct', type: 'REMOVE_GROUP' }),
        ).rejects.toThrow('groupId is required');
    });

    it('throws for missing remove row payload', async () => {
        await expect(
            handler.handleMessage({ target: 'gct', type: 'REMOVE_ROW', groupId: 'g1' }),
        ).rejects.toThrow('groupId and rowId are required');
    });

    it('throws for missing replace group payload', async () => {
        await expect(
            handler.handleMessage({ target: 'gct', type: 'REPLACE_GROUP_SLOTS', groupId: 'g1' }),
        ).rejects.toThrow('groupId and slots are required');
    });

    it('throws for missing update row payload', async () => {
        await expect(
            handler.handleMessage({
                target: 'gct',
                type: 'UPDATE_ROW_SLOT',
                groupId: 'g1',
                rowId: 'r1',
            }),
        ).rejects.toThrow('groupId, rowId and slot are required');
    });

    it('saves settings and refreshes schedules', async () => {
        const result = await handler.handleMessage({
            target: 'gct',
            type: 'SAVE_SETTINGS',
            settings: { pollMinMs: 2500 },
        });

        expect(saveGctSettings).toHaveBeenCalledWith({ pollMinMs: 2500 });
        expect(gctWatcherService.ensureSchedules).toHaveBeenCalled();
        expect(result).toEqual({ groups: [] });
    });

    it('throws for unknown message types', async () => {
        await expect(handler.handleMessage({ target: 'gct', type: 'NOPE' as any })).rejects.toThrow(
            'Unknown GCT message type: NOPE',
        );
    });
});
