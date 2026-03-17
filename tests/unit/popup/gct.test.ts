import { chromeMock } from '../mocks/chrome';

jest.mock('../../../src/utils', () => ({
    consoleError: jest.fn(),
}));

const baseState = {
    groups: [],
    settings: {
        pollMinMs: 5000,
        pollMaxMs: 10000,
        jitterMinMs: 2000,
        jitterMaxMs: 5000,
    },
    lastTickAt: null,
};

const createState = (overrides: any = {}) => ({
    ...baseState,
    ...overrides,
});

describe('popup/gct', () => {
    const sentMessages: unknown[] = [];
    let currentState = createState();

    const flushUi = async () => {
        await Promise.resolve();
        await Promise.resolve();
    };

    const loadModule = async () => {
        jest.resetModules();
        return import('../../../src/popup/gct');
    };

    beforeEach(() => {
        jest.clearAllMocks();
        sentMessages.length = 0;
        currentState = createState();
        document.body.innerHTML = '<div id="gctView"></div>';

        chromeMock.runtime.lastError = null;
        chromeMock.runtime.sendMessage.mockImplementation((message: any, cb: (v: any) => void) => {
            sentMessages.push(message);
            if (message.type === 'GET_STATE') {
                cb({ ok: true, result: currentState });
                return;
            }
            cb({ ok: true, result: currentState });
        });
    });

    it('renders controls and empty state on first init', async () => {
        const { initGctUI } = await loadModule();

        initGctUI();
        await flushUi();

        expect(document.getElementById('gctDocumentInput')).toBeTruthy();
        expect(document.getElementById('gctSlotSelect')).toBeTruthy();
        expect(document.getElementById('gctTableBody')?.textContent).toContain(
            'Dodaj konfigurację GCT',
        );
        expect(sentMessages).toContainEqual({ target: 'gct', type: 'GET_STATE' });
    });

    it('updates slot summary and sends add-group payload', async () => {
        const { initGctUI } = await loadModule();

        initGctUI();
        await flushUi();

        const documentInput = document.getElementById('gctDocumentInput') as HTMLInputElement;
        const vehicleInput = document.getElementById('gctVehicleInput') as HTMLInputElement;
        const containerInput = document.getElementById('gctContainerInput') as HTMLInputElement;
        const dateInput = document.getElementById('gctDateInput') as HTMLInputElement;
        const slotSelect = document.getElementById('gctSlotSelect') as HTMLSelectElement;
        const summary = document.getElementById('gctSlotSummary') as HTMLElement;
        const addButton = document.getElementById('gctAddButton') as HTMLButtonElement;

        documentInput.value = 'DOC';
        vehicleInput.value = 'ndz45396';
        containerInput.value = 'tclu3141931';
        dateInput.value = '2026-03-18';

        Array.from(slotSelect.options).forEach(option => {
            option.selected = ['04:30', '06:30', '08:30'].includes(option.value);
        });
        slotSelect.dispatchEvent(new Event('change'));

        expect(summary.textContent).toBe('3 sloty wybrane');

        addButton.click();
        await flushUi();

        expect(sentMessages).toContainEqual({
            target: 'gct',
            type: 'ADD_GROUP',
            group: {
                documentNumber: 'DOC',
                vehicleNumber: 'NDZ45396',
                containerNumber: 'TCLU3141931',
                slots: [
                    { date: '2026-03-18', startTime: '04:30' },
                    { date: '2026-03-18', startTime: '06:30' },
                    { date: '2026-03-18', startTime: '08:30' },
                ],
            },
        });
        expect(containerInput.value).toBe('');
        expect(summary.textContent).toBe('3 sloty wybrane');
    });

    it('renders groups and routes group and row actions', async () => {
        currentState = createState({
            groups: [
                {
                    id: 'group-1',
                    documentNumber: 'DOC123',
                    vehicleNumber: 'NDZ45396',
                    containerNumber: 'TCLU3141931',
                    createdAt: '2026-03-17T10:00:00.000Z',
                    updatedAt: '2026-03-17T10:00:00.000Z',
                    status: 'watching',
                    statusMessage: 'watching',
                    isExpanded: true,
                    rows: [
                        {
                            id: 'row-1',
                            targetDate: '2026-03-18',
                            targetStartTime: '04:30',
                            targetEndDate: '2026-03-18',
                            targetEndTime: '06:30',
                            targetStartLocal: '2026-03-18 04:30',
                            targetEndLocal: '2026-03-18 06:30',
                            status: 'watching',
                            statusMessage: 'Target jeszcze nie jest dostępny',
                            active: true,
                            isManualPause: false,
                            lastAttemptAt: null,
                            lastMatchedAt: null,
                            lastVerifiedAt: null,
                            lastError: null,
                            history: [],
                        },
                    ],
                },
            ],
        });

        const { initGctUI } = await loadModule();
        initGctUI();
        await flushUi();

        const groupRow = document.querySelector('.gct-group-row') as HTMLTableRowElement;
        expect(groupRow.textContent).toContain('TCLU3141931');
        expect(groupRow.textContent).toContain('DOC123');
        expect(document.querySelector('.gct-slot-editable')?.textContent).toContain('18.03.2026');

        (groupRow.querySelector('.gct-toggle-cell') as HTMLElement).click();
        (groupRow.querySelector('.group-pause-button') as HTMLButtonElement).click();
        (groupRow.querySelector('.group-remove-button') as HTMLButtonElement).click();
        (
            document.querySelector('tr[data-row-id="row-1"] .pause-button') as HTMLButtonElement
        ).click();
        (
            document.querySelector('tr[data-row-id="row-1"] .remove-button') as HTMLButtonElement
        ).click();
        (document.querySelector('.gct-slot-editable') as HTMLElement).click();

        const editSlot = document.getElementById('gctEditSlot') as HTMLSelectElement;
        const editDate = document.getElementById('gctEditDate') as HTMLInputElement;
        editDate.value = '2026-03-19';
        editSlot.value = '06:30';
        (document.getElementById('gctEditSave') as HTMLButtonElement).click();
        await flushUi();

        expect(sentMessages).toEqual(
            expect.arrayContaining([
                { target: 'gct', type: 'TOGGLE_GROUP_EXPANDED', groupId: 'group-1' },
                { target: 'gct', type: 'PAUSE_GROUP', groupId: 'group-1' },
                { target: 'gct', type: 'REMOVE_GROUP', groupId: 'group-1' },
                { target: 'gct', type: 'PAUSE_ROW', groupId: 'group-1', rowId: 'row-1' },
                { target: 'gct', type: 'REMOVE_ROW', groupId: 'group-1', rowId: 'row-1' },
                {
                    target: 'gct',
                    type: 'UPDATE_ROW_SLOT',
                    groupId: 'group-1',
                    rowId: 'row-1',
                    slot: { date: '2026-03-19', startTime: '06:30' },
                },
            ]),
        );
    });

    it('supports paused rows, modal cancel, and storage-triggered refresh', async () => {
        currentState = createState({
            groups: [
                {
                    id: 'group-2',
                    documentNumber: 'DOC999',
                    vehicleNumber: 'NDZ00000',
                    containerNumber: 'CONT999',
                    createdAt: '2026-03-17T10:00:00.000Z',
                    updatedAt: '2026-03-17T10:00:00.000Z',
                    status: 'paused',
                    statusMessage: 'paused',
                    isExpanded: false,
                    rows: [
                        {
                            id: 'row-2',
                            targetDate: '2026-03-17',
                            targetStartTime: '04:30',
                            targetEndDate: '2026-03-17',
                            targetEndTime: '06:30',
                            targetStartLocal: '2026-03-17 04:30',
                            targetEndLocal: '2026-03-17 06:30',
                            status: 'completed',
                            statusMessage: 'done',
                            active: false,
                            isManualPause: false,
                            lastAttemptAt: null,
                            lastMatchedAt: null,
                            lastVerifiedAt: null,
                            lastError: null,
                            history: [],
                        },
                        {
                            id: 'row-3',
                            targetDate: '2026-03-17',
                            targetStartTime: '06:30',
                            targetEndDate: '2026-03-18',
                            targetEndTime: '08:30',
                            targetStartLocal: '2026-03-17 06:30',
                            targetEndLocal: '2026-03-18 08:30',
                            status: 'paused',
                            statusMessage: 'paused',
                            active: false,
                            isManualPause: true,
                            lastAttemptAt: null,
                            lastMatchedAt: null,
                            lastVerifiedAt: null,
                            lastError: null,
                            history: [],
                        },
                    ],
                },
            ],
        });

        const { initGctUI } = await loadModule();
        initGctUI();
        await flushUi();

        const groupRow = document.querySelector('.gct-group-row') as HTMLTableRowElement;
        expect((groupRow.querySelector('.group-resume-button') as HTMLButtonElement).disabled).toBe(
            false,
        );
        expect((groupRow.querySelector('.group-pause-button') as HTMLButtonElement).disabled).toBe(
            true,
        );

        (groupRow.querySelector('.group-resume-button') as HTMLButtonElement).click();
        const hiddenChildRow = document.querySelector(
            'tr[data-row-id="row-2"]',
        ) as HTMLTableRowElement;
        expect(hiddenChildRow.style.display).toBe('none');
        expect(hiddenChildRow.textContent).toContain('04:30 - 06:30');
        expect(document.querySelector('tr[data-row-id="row-3"]')?.textContent).toContain(
            '06:30 - 08:30',
        );

        (
            document.querySelector('tr[data-row-id="row-3"] .resume-button') as HTMLButtonElement
        ).click();
        (
            document.querySelector('tr[data-row-id="row-3"] .gct-slot-editable') as HTMLElement
        ).click();
        (document.getElementById('gctEditCancel') as HTMLButtonElement).click();
        expect(document.querySelector('.gct-edit-overlay')).toBeNull();

        (
            document.querySelector('tr[data-row-id="row-3"] .gct-slot-editable') as HTMLElement
        ).click();
        (document.querySelector('.gct-edit-overlay') as HTMLElement).click();
        expect(document.querySelector('.gct-edit-overlay')).toBeNull();

        const listener = chromeMock.storage.onChanged.addListener.mock.calls[0][0];
        listener({}, 'sync');
        listener({ gctGroups: { newValue: [] } }, 'local');
        await flushUi();

        expect(sentMessages).toEqual(
            expect.arrayContaining([
                { target: 'gct', type: 'RESUME_GROUP', groupId: 'group-2' },
                { target: 'gct', type: 'RESUME_ROW', groupId: 'group-2', rowId: 'row-3' },
            ]),
        );
        expect(sentMessages.filter((message: any) => message.type === 'GET_STATE').length).toBe(2);
    });

    it('logs message errors from the runtime bridge', async () => {
        const { initGctUI } = await loadModule();
        const { consoleError } = await import('../../../src/utils');

        chromeMock.runtime.sendMessage.mockImplementation((_message: any, cb: (v: any) => void) => {
            chromeMock.runtime.lastError = { message: 'boom' } as any;
            cb(undefined);
            chromeMock.runtime.lastError = null;
        });

        initGctUI();
        await flushUi();

        expect(consoleError).toHaveBeenCalledWith('Refresh GCT state failed:', expect.any(Error));
    });
});
