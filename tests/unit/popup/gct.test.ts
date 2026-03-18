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
    let storageState: Record<string, unknown>;

    const flushUi = async () => {
        await Promise.resolve();
        await Promise.resolve();
    };

    const setInputValue = (input: HTMLInputElement, value: string) => {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const loadModule = async () => {
        jest.resetModules();
        return import('../../../src/popup/gct');
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-03-17T08:00:00.000Z'));
        sentMessages.length = 0;
        currentState = createState();
        storageState = {};
        localStorage.clear();
        document.body.innerHTML = '<div id="gctView"></div>';

        chromeMock.runtime.lastError = null;
        chromeMock.storage.local.get.mockImplementation(
            (keys: any, callback: (value: any) => void) => {
                if (typeof callback !== 'function') {
                    return;
                }

                if (keys && typeof keys === 'object' && !Array.isArray(keys)) {
                    const result = Object.fromEntries(
                        Object.keys(keys).map(key => [
                            key,
                            key in storageState ? storageState[key] : keys[key],
                        ]),
                    );
                    callback(result);
                    return;
                }

                callback(storageState);
            },
        );
        chromeMock.storage.local.set.mockImplementation(
            (data: Record<string, unknown>, callback?: () => void) => {
                storageState = { ...storageState, ...data };
                callback?.();
            },
        );
        chromeMock.runtime.sendMessage.mockImplementation((message: any, cb: (v: any) => void) => {
            sentMessages.push(message);
            if (message.type === 'GET_STATE') {
                cb({ ok: true, result: currentState });
                return;
            }
            cb({ ok: true, result: currentState });
        });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('renders controls and empty state on first init', async () => {
        const { initGctUI } = await loadModule();

        initGctUI();
        await flushUi();

        expect(document.getElementById('gctDocumentInput')).toBeTruthy();
        expect(document.getElementById('gctTimePicker')).toBeTruthy();
        expect(document.querySelector('.gp-collapsed-label')?.textContent).toBe('Godzina');
        expect(document.getElementById('gctTableBody')?.textContent).toBe('');
        expect(sentMessages).toContainEqual({ target: 'gct', type: 'GET_STATE' });
    });

    it('restores the saved draft after reopening the popup', async () => {
        storageState.gctPopupDraft = {
            documentNumber: 'DOC123456',
            vehicleNumber: 'NDZ45396',
            containerNumber: 'TCLU3141931',
            slots: [{ date: '2026-03-17', startTime: '22:30' }],
        };

        const { initGctUI } = await loadModule();

        initGctUI();
        await flushUi();

        expect((document.getElementById('gctDocumentInput') as HTMLInputElement).value).toBe(
            'DOC123456',
        );
        expect((document.getElementById('gctVehicleInput') as HTMLInputElement).value).toBe(
            'NDZ45396',
        );
        expect((document.getElementById('gctContainerInput') as HTMLInputElement).value).toBe(
            'TCLU3141931',
        );
        expect(document.querySelector('.gp-collapsed-label')?.textContent).toBe('Dziś 22:30');
        expect((document.getElementById('gctAddButton') as HTMLButtonElement).disabled).toBe(false);
    });

    it('keeps partially entered top-form values after popup reopen without pressing add', async () => {
        const firstModule = await loadModule();

        firstModule.initGctUI();
        await flushUi();

        const firstDocumentInput = document.getElementById('gctDocumentInput') as HTMLInputElement;
        setInputValue(firstDocumentInput, 'doc123456');
        await flushUi();

        expect(storageState.gctPopupDraft).toEqual({
            documentNumber: 'DOC123456',
            vehicleNumber: '',
            containerNumber: '',
            slots: [],
        });

        document.body.innerHTML = '<div id="gctView"></div>';
        const reopenedModule = await loadModule();

        reopenedModule.initGctUI();
        await flushUi();

        expect((document.getElementById('gctDocumentInput') as HTMLInputElement).value).toBe(
            'DOC123456',
        );
        expect((document.getElementById('gctVehicleInput') as HTMLInputElement).value).toBe('');
        expect((document.getElementById('gctContainerInput') as HTMLInputElement).value).toBe('');
    });

    it('restores draft from local fallback when chrome draft is unavailable', async () => {
        localStorage.setItem(
            'gctPopupDraftFallback',
            JSON.stringify({
                documentNumber: 'DOCFALLBK',
                vehicleNumber: 'NDZ00001',
                containerNumber: 'MSCU1234567',
                slots: [],
            }),
        );

        const { initGctUI } = await loadModule();

        initGctUI();
        await flushUi();

        expect((document.getElementById('gctDocumentInput') as HTMLInputElement).value).toBe(
            'DOCFALLBK',
        );
        expect((document.getElementById('gctVehicleInput') as HTMLInputElement).value).toBe(
            'NDZ00001',
        );
        expect((document.getElementById('gctContainerInput') as HTMLInputElement).value).toBe(
            'MSCU1234567',
        );
    });

    it('offers recent values and autofills only document and vehicle fields', async () => {
        storageState.gctRecentEntries = [
            {
                documentNumber: 'DOC123456',
                vehicleNumber: 'NDZ45396',
                containerNumber: 'TCLU3141931',
            },
            {
                documentNumber: 'DOC654321',
                vehicleNumber: 'WWL11111',
                containerNumber: 'MSCU1234567',
            },
        ];

        const { initGctUI } = await loadModule();

        initGctUI();
        await flushUi();

        const documentInput = document.getElementById('gctDocumentInput') as HTMLInputElement;
        const vehicleInput = document.getElementById('gctVehicleInput') as HTMLInputElement;
        const containerInput = document.getElementById('gctContainerInput') as HTMLInputElement;

        documentInput.value = 'doc123456';
        documentInput.dispatchEvent(new Event('change', { bubbles: true }));
        await flushUi();

        expect(documentInput.value).toBe('DOC123456');
        expect(vehicleInput.value).toBe('NDZ45396');
        expect(containerInput.value).toBe('');
    });

    it('renders native datalist history without custom suggestion UI', async () => {
        storageState.gctRecentEntries = [
            {
                documentNumber: 'DGG683895',
                vehicleNumber: 'NDZ47390',
                containerNumber: 'TEMU1600900',
            },
        ];

        const { initGctUI } = await loadModule();

        initGctUI();
        await flushUi();

        const documentInput = document.getElementById('gctDocumentInput') as HTMLInputElement;
        const vehicleInput = document.getElementById('gctVehicleInput') as HTMLInputElement;
        const documentList = document.getElementById(
            'gctDocumentRecentList',
        ) as HTMLDataListElement;
        const vehicleList = document.getElementById('gctVehicleRecentList') as HTMLDataListElement;

        expect(documentInput.getAttribute('list')).toBe('gctDocumentRecentList');
        expect(vehicleInput.getAttribute('list')).toBe('gctVehicleRecentList');
        expect(documentList).toBeTruthy();
        expect(vehicleList).toBeTruthy();
        expect(documentList.querySelectorAll('option')).toHaveLength(1);
        expect(vehicleList.querySelectorAll('option')).toHaveLength(1);
        expect((documentList.querySelector('option') as HTMLOptionElement).value).toBe('DGG683895');
        expect((vehicleList.querySelector('option') as HTMLOptionElement).value).toBe('NDZ47390');

        expect(document.getElementById('gctDocumentSuggestions')).toBeNull();
        expect(document.getElementById('gctVehicleSuggestions')).toBeNull();
        expect(document.querySelector('.gct-recent-suggestion')).toBeNull();
    });

    it('supports multi-date slot selection and sends a combined add-group payload', async () => {
        chromeMock.runtime.sendMessage.mockImplementation((message: any, cb: (v: any) => void) => {
            sentMessages.push(message);

            if (message.type === 'GET_STATE') {
                cb({ ok: true, result: currentState });
                return;
            }

            if (message.type === 'GET_SLOT_CONTEXT') {
                cb({
                    ok: true,
                    result: {
                        token: 'prefetched-token',
                        currentSlot: null,
                        fetchedAt: '2026-03-17T08:00:00.000Z',
                    },
                });
                return;
            }

            cb({ ok: true, result: currentState });
        });

        const { initGctUI } = await loadModule();

        initGctUI();
        await flushUi();

        const documentInput = document.getElementById('gctDocumentInput') as HTMLInputElement;
        const vehicleInput = document.getElementById('gctVehicleInput') as HTMLInputElement;
        const containerInput = document.getElementById('gctContainerInput') as HTMLInputElement;
        const collapsed = document.querySelector('.gp-collapsed') as HTMLDivElement;
        const addButton = document.getElementById('gctAddButton') as HTMLButtonElement;

        setInputValue(documentInput, 'doc123456');
        setInputValue(vehicleInput, 'ndz45396');
        setInputValue(containerInput, 'tclu3141931');

        collapsed.click();
        await flushUi();

        (
            Array.from(document.querySelectorAll('.gp-slot-btn')).find(
                button => (button as HTMLButtonElement).dataset.slotValue === '22:30',
            ) as HTMLButtonElement
        ).click();
        await flushUi();

        (document.querySelectorAll('.gp-date-btn')[1] as HTMLButtonElement).click();
        await flushUi();

        for (const slot of ['00:30', '04:30']) {
            (
                Array.from(document.querySelectorAll('.gp-slot-btn')).find(
                    button => (button as HTMLButtonElement).dataset.slotValue === slot,
                ) as HTMLButtonElement
            ).click();
        }
        await flushUi();

        expect(document.querySelector('.gp-collapsed-label')?.textContent).toBe('2 dni');
        expect(document.querySelector('.gp-badge')?.textContent).toBe('3 sloty');
        expect(addButton.disabled).toBe(false);

        addButton.click();
        await flushUi();
        await flushUi();

        expect(sentMessages).toContainEqual({
            target: 'gct',
            type: 'ADD_GROUP',
            prefetchedToken: 'prefetched-token',
            group: {
                documentNumber: 'DOC123456',
                vehicleNumber: 'NDZ45396',
                containerNumber: 'TCLU3141931',
                slots: [
                    { date: '2026-03-17', startTime: '22:30' },
                    { date: '2026-03-18', startTime: '00:30' },
                    { date: '2026-03-18', startTime: '04:30' },
                ],
            },
        });
        expect(containerInput.value).toBe('TCLU3141931');
        expect(document.querySelector('.gp-collapsed-label')?.textContent).toBe('2 dni');
        expect(document.querySelector('.gp-badge')?.textContent).toBe('3 sloty');
        expect(addButton.disabled).toBe(false);
        expect(storageState.gctPopupDraft).toEqual({
            documentNumber: 'DOC123456',
            vehicleNumber: 'NDZ45396',
            containerNumber: 'TCLU3141931',
            slots: [
                { date: '2026-03-17', startTime: '22:30' },
                { date: '2026-03-18', startTime: '00:30' },
                { date: '2026-03-18', startTime: '04:30' },
            ],
        });
    });

    it('prefetches slot context on Godzina open and reuses token on add', async () => {
        chromeMock.runtime.sendMessage.mockImplementation((message: any, cb: (v: any) => void) => {
            sentMessages.push(message);

            if (message.type === 'GET_STATE') {
                cb({ ok: true, result: currentState });
                return;
            }

            if (message.type === 'GET_SLOT_CONTEXT') {
                cb({
                    ok: true,
                    result: {
                        token: 'prefetched-token',
                        currentSlot: {
                            date: '2026-03-17',
                            startTime: '22:30',
                        },
                        fetchedAt: '2026-03-17T08:00:00.000Z',
                    },
                });
                return;
            }

            cb({ ok: true, result: currentState });
        });

        const { initGctUI } = await loadModule();

        initGctUI();
        await flushUi();

        const documentInput = document.getElementById('gctDocumentInput') as HTMLInputElement;
        const vehicleInput = document.getElementById('gctVehicleInput') as HTMLInputElement;
        const containerInput = document.getElementById('gctContainerInput') as HTMLInputElement;
        const collapsed = document.querySelector('.gp-collapsed') as HTMLDivElement;
        const addButton = document.getElementById('gctAddButton') as HTMLButtonElement;

        setInputValue(documentInput, 'doc123456');
        setInputValue(vehicleInput, 'ndz45396');
        setInputValue(containerInput, 'tclu3141931');

        collapsed.click();
        await flushUi();

        const blockedSlot = Array.from(document.querySelectorAll('.gp-slot-btn')).find(
            button => (button as HTMLButtonElement).dataset.slotValue === '22:30',
        ) as HTMLButtonElement;
        expect(blockedSlot.disabled).toBe(true);

        (
            Array.from(document.querySelectorAll('.gp-slot-btn')).find(
                button => (button as HTMLButtonElement).dataset.slotValue === '20:30',
            ) as HTMLButtonElement
        ).click();
        await flushUi();

        addButton.click();
        await flushUi();

        expect(sentMessages).toContainEqual(
            expect.objectContaining({ target: 'gct', type: 'GET_SLOT_CONTEXT' }),
        );

        expect(sentMessages).toContainEqual(
            expect.objectContaining({
                target: 'gct',
                type: 'ADD_GROUP',
                prefetchedToken: 'prefetched-token',
            }),
        );
    });

    it('shows loader and hides slot buttons while Godzina precheck is in progress', async () => {
        chromeMock.runtime.sendMessage.mockImplementation((message: any, cb: (v: any) => void) => {
            sentMessages.push(message);

            if (message.type === 'GET_STATE') {
                cb({ ok: true, result: currentState });
                return;
            }

            if (message.type === 'GET_SLOT_CONTEXT') {
                setTimeout(() => {
                    cb({
                        ok: true,
                        result: {
                            token: 'prefetched-token',
                            currentSlot: null,
                            fetchedAt: '2026-03-17T08:00:00.000Z',
                        },
                    });
                }, 5000);
                return;
            }

            cb({ ok: true, result: currentState });
        });

        const { initGctUI } = await loadModule();

        initGctUI();
        await flushUi();

        setInputValue(document.getElementById('gctDocumentInput') as HTMLInputElement, 'doc123456');
        setInputValue(document.getElementById('gctVehicleInput') as HTMLInputElement, 'ndz45396');
        setInputValue(
            document.getElementById('gctContainerInput') as HTMLInputElement,
            'tclu3141931',
        );

        (document.querySelector('.gp-collapsed') as HTMLDivElement).click();
        await flushUi();

        const loading = document.querySelector('.gp-slots-loading') as HTMLDivElement;
        expect(loading).toBeTruthy();
        expect(loading.style.display).toBe('block');
        expect(document.querySelectorAll('.gp-slot-btn')).toHaveLength(0);

        jest.advanceTimersByTime(5000);
        await flushUi();

        expect(loading.style.display).toBe('none');
        expect(document.querySelectorAll('.gp-slot-btn').length).toBeGreaterThan(0);
    });

    it('restores full top-panel draft after add when popup is reopened', async () => {
        chromeMock.runtime.sendMessage.mockImplementation((message: any, cb: (v: any) => void) => {
            sentMessages.push(message);

            if (message.type === 'GET_STATE') {
                cb({ ok: true, result: currentState });
                return;
            }

            if (message.type === 'GET_SLOT_CONTEXT') {
                cb({
                    ok: true,
                    result: {
                        token: 'prefetched-token',
                        currentSlot: null,
                        fetchedAt: '2026-03-17T08:00:00.000Z',
                    },
                });
                return;
            }

            cb({ ok: true, result: currentState });
        });

        const firstModule = await loadModule();

        firstModule.initGctUI();
        await flushUi();

        const firstDocumentInput = document.getElementById('gctDocumentInput') as HTMLInputElement;
        const firstVehicleInput = document.getElementById('gctVehicleInput') as HTMLInputElement;
        const firstContainerInput = document.getElementById(
            'gctContainerInput',
        ) as HTMLInputElement;
        const firstCollapsed = document.querySelector('.gp-collapsed') as HTMLDivElement;
        const firstAddButton = document.getElementById('gctAddButton') as HTMLButtonElement;

        setInputValue(firstDocumentInput, 'doc123456');
        setInputValue(firstVehicleInput, 'ndz45396');
        setInputValue(firstContainerInput, 'tclu3141931');

        firstCollapsed.click();
        await flushUi();

        (
            Array.from(document.querySelectorAll('.gp-slot-btn')).find(
                button => (button as HTMLButtonElement).dataset.slotValue === '22:30',
            ) as HTMLButtonElement
        ).click();
        await flushUi();

        firstAddButton.click();
        await flushUi();
        await flushUi();

        document.body.innerHTML = '<div id="gctView"></div>';
        const reopenedModule = await loadModule();

        reopenedModule.initGctUI();
        await flushUi();

        const reopenedDocumentInput = document.getElementById(
            'gctDocumentInput',
        ) as HTMLInputElement;
        const reopenedVehicleInput = document.getElementById('gctVehicleInput') as HTMLInputElement;
        const reopenedContainerInput = document.getElementById(
            'gctContainerInput',
        ) as HTMLInputElement;

        expect(reopenedDocumentInput.value).toBe('DOC123456');
        expect(reopenedVehicleInput.value).toBe('NDZ45396');
        expect(reopenedContainerInput.value).toBe('TCLU3141931');
        expect(document.querySelector('.gp-collapsed-label')?.textContent).toBe('Dziś 22:30');
    });

    it('shows temporary login feedback when adding a new group fails', async () => {
        chromeMock.runtime.sendMessage.mockImplementation((message: any, cb: (v: any) => void) => {
            sentMessages.push(message);
            if (message.type === 'GET_STATE') {
                cb({ ok: true, result: currentState });
                return;
            }

            if (message.type === 'GET_SLOT_CONTEXT') {
                cb({
                    ok: true,
                    result: {
                        token: 'prefetched-token',
                        currentSlot: null,
                        fetchedAt: '2026-03-17T08:00:00.000Z',
                    },
                });
                return;
            }

            if (message.type === 'ADD_GROUP') {
                cb({ ok: false, error: '406 Not Acceptable' });
                return;
            }

            cb({ ok: true, result: currentState });
        });

        const { initGctUI } = await loadModule();

        initGctUI();
        await flushUi();

        const documentInput = document.getElementById('gctDocumentInput') as HTMLInputElement;
        const vehicleInput = document.getElementById('gctVehicleInput') as HTMLInputElement;
        const containerInput = document.getElementById('gctContainerInput') as HTMLInputElement;
        const collapsed = document.querySelector('.gp-collapsed') as HTMLDivElement;
        const addButton = document.getElementById('gctAddButton') as HTMLButtonElement;
        const feedback = document.getElementById('gctAddFeedback') as HTMLDivElement;

        setInputValue(documentInput, 'doc123456');
        setInputValue(vehicleInput, 'ndz45396');
        setInputValue(containerInput, 'tclu3141931');

        collapsed.click();
        await flushUi();

        (
            Array.from(document.querySelectorAll('.gp-slot-btn')).find(
                button => (button as HTMLButtonElement).dataset.slotValue === '22:30',
            ) as HTMLButtonElement
        ).click();
        await flushUi();

        addButton.click();
        await flushUi();
        await flushUi();

        expect(feedback.textContent).toBe('Logowanie nieudane');
        expect(addButton.disabled).toBe(false);
        expect(storageState.gctRecentEntries).toBeUndefined();

        jest.advanceTimersByTime(3000);
        await flushUi();

        expect(feedback.textContent).toBe('');
    });

    it('shows temporary login feedback and closes picker when Godzina precheck fails', async () => {
        chromeMock.runtime.sendMessage.mockImplementation((message: any, cb: (v: any) => void) => {
            sentMessages.push(message);
            if (message.type === 'GET_STATE') {
                cb({ ok: true, result: currentState });
                return;
            }

            if (message.type === 'GET_SLOT_CONTEXT') {
                cb({ ok: false, error: '406 Not Acceptable' });
                return;
            }

            cb({ ok: true, result: currentState });
        });

        const { initGctUI } = await loadModule();

        initGctUI();
        await flushUi();

        const documentInput = document.getElementById('gctDocumentInput') as HTMLInputElement;
        const vehicleInput = document.getElementById('gctVehicleInput') as HTMLInputElement;
        const containerInput = document.getElementById('gctContainerInput') as HTMLInputElement;
        const collapsed = document.querySelector('.gp-collapsed') as HTMLDivElement;
        const addButton = document.getElementById('gctAddButton') as HTMLButtonElement;
        const feedback = document.getElementById('gctAddFeedback') as HTMLDivElement;
        const dropdown = document.querySelector('.gp-dropdown') as HTMLDivElement;

        setInputValue(documentInput, 'doc123456');
        setInputValue(vehicleInput, 'ndz45396');
        setInputValue(containerInput, 'tclu3141931');

        collapsed.click();
        await flushUi();
        await flushUi();

        expect(feedback.textContent).toBe('Logowanie nieudane');
        expect(dropdown.classList.contains('visible')).toBe(false);
        expect(document.querySelector('.gp-collapsed-label')?.textContent).toBe('Godzina');
        expect(addButton.disabled).toBe(true);

        jest.advanceTimersByTime(3000);
        await flushUi();

        expect(feedback.textContent).toBe('');
    });

    it('keeps the add button disabled until all fields and slots are populated', async () => {
        const { initGctUI } = await loadModule();

        initGctUI();
        await flushUi();

        const documentInput = document.getElementById('gctDocumentInput') as HTMLInputElement;
        const vehicleInput = document.getElementById('gctVehicleInput') as HTMLInputElement;
        const containerInput = document.getElementById('gctContainerInput') as HTMLInputElement;
        const addButton = document.getElementById('gctAddButton') as HTMLButtonElement;
        const collapsed = document.querySelector('.gp-collapsed') as HTMLDivElement;

        expect(addButton.disabled).toBe(true);

        setInputValue(documentInput, 'doc1');
        setInputValue(vehicleInput, 'ndz1');
        setInputValue(containerInput, 'tclu1');
        await flushUi();

        expect(documentInput.value).toBe('DOC1');
        expect(vehicleInput.value).toBe('NDZ1');
        expect(containerInput.value).toBe('TCLU1');
        expect(addButton.disabled).toBe(true);

        collapsed.click();
        await flushUi();

        (
            Array.from(document.querySelectorAll('.gp-slot-btn')).find(
                button => (button as HTMLButtonElement).dataset.slotValue === '22:30',
            ) as HTMLButtonElement
        ).click();
        await flushUi();

        expect(document.querySelector('.gp-collapsed-label')?.textContent).toBe('Dziś 22:30');
        expect(document.querySelector('.gp-badge')?.textContent).toBe('');
        expect(addButton.disabled).toBe(false);
    });

    it('supports custom calendar date selection and clearing slots', async () => {
        const { initGctUI } = await loadModule();

        initGctUI();
        await flushUi();

        (document.querySelector('.gp-collapsed') as HTMLDivElement).click();
        await flushUi();
        (document.querySelectorAll('.gp-date-btn')[2] as HTMLButtonElement).click();
        await flushUi();

        expect(document.querySelector('.gp-cal.visible')).toBeTruthy();

        const futureDay = Array.from(document.querySelectorAll('.gp-cal-day')).find(
            button =>
                !(button as HTMLElement).classList.contains('disabled') &&
                button.textContent === '20',
        ) as HTMLButtonElement;
        futureDay.click();
        await flushUi();

        const firstSlot = document.querySelector('.gp-slot-btn') as HTMLButtonElement;
        firstSlot.click();
        await flushUi();

        expect(document.querySelector('.gp-clear-btn')?.classList.contains('visible')).toBe(true);
        (document.querySelector('.gp-clear-btn') as HTMLButtonElement).click();
        await flushUi();

        expect(document.querySelectorAll('.gp-slot-btn.selected')).toHaveLength(0);
        expect(document.querySelector('.gp-confirm')?.classList.contains('visible')).toBe(false);
    });

    it('keeps the ongoing slot visible for today until its end time, but disabled', async () => {
        jest.setSystemTime(new Date('2026-03-17T19:39:00.000Z'));
        chromeMock.runtime.sendMessage.mockImplementation((message: any, cb: (v: any) => void) => {
            sentMessages.push(message);

            if (message.type === 'GET_STATE') {
                cb({ ok: true, result: currentState });
                return;
            }

            if (message.type === 'GET_SLOT_CONTEXT') {
                cb({
                    ok: true,
                    result: {
                        token: 'prefetched-token',
                        currentSlot: {
                            date: '2026-03-17',
                            startTime: '20:30',
                        },
                        fetchedAt: '2026-03-17T19:39:00.000Z',
                    },
                });
                return;
            }

            cb({ ok: true, result: currentState });
        });

        const { initGctUI } = await loadModule();

        initGctUI();
        await flushUi();

        setInputValue(document.getElementById('gctDocumentInput') as HTMLInputElement, 'doc123456');
        setInputValue(document.getElementById('gctVehicleInput') as HTMLInputElement, 'ndz45396');
        setInputValue(
            document.getElementById('gctContainerInput') as HTMLInputElement,
            'tclu3141931',
        );
        await flushUi();

        (document.querySelector('.gp-collapsed') as HTMLDivElement).click();
        await flushUi();

        const currentSlotButton = Array.from(document.querySelectorAll('.gp-slot-btn')).find(
            button => (button as HTMLButtonElement).dataset.slotValue === '20:30',
        ) as HTMLButtonElement;
        const nextSlotButton = Array.from(document.querySelectorAll('.gp-slot-btn')).find(
            button => (button as HTMLButtonElement).dataset.slotValue === '22:30',
        ) as HTMLButtonElement;

        expect(currentSlotButton).toBeTruthy();
        expect(currentSlotButton.disabled).toBe(true);
        expect(currentSlotButton.title).toBe('Obecny slot');
        expect(currentSlotButton.dataset.disabledReason).toBe('Obecny slot');
        expect(nextSlotButton).toBeTruthy();
        expect(nextSlotButton.disabled).toBe(false);
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
        expect(document.querySelector('.gct-slot-time-cell')?.textContent).toContain('18.03.2026');

        (groupRow.querySelector('.group-edit-button') as HTMLButtonElement).click();
        await flushUi();

        expect(document.querySelector('.gct-group-edit-panel')).toBeTruthy();
        expect(
            document
                .querySelector('.gct-group-edit-picker .gp-slot-btn[data-slot-value="04:30"]')
                ?.classList.contains('selected'),
        ).toBe(true);
        (
            Array.from(document.querySelectorAll('.gct-group-edit-picker .gp-slot-btn')).find(
                button => (button as HTMLButtonElement).dataset.slotValue === '04:30',
            ) as HTMLButtonElement
        ).click();
        (
            Array.from(document.querySelectorAll('.gct-group-edit-picker .gp-slot-btn')).find(
                button => (button as HTMLButtonElement).dataset.slotValue === '06:30',
            ) as HTMLButtonElement
        ).click();
        await flushUi();
        (
            document.querySelector('.gct-group-edit-picker .gp-confirm-btn') as HTMLButtonElement
        ).click();
        await flushUi();

        (groupRow.querySelector('.gct-toggle-cell') as HTMLElement).click();
        (groupRow.querySelector('.group-pause-button') as HTMLButtonElement).click();
        (groupRow.querySelector('.group-remove-button') as HTMLButtonElement).click();
        (
            document.querySelector('tr[data-row-id="row-1"] .pause-button') as HTMLButtonElement
        ).click();
        (
            document.querySelector('tr[data-row-id="row-1"] .remove-button') as HTMLButtonElement
        ).click();
        (document.querySelector('.gct-slot-time-cell') as HTMLElement).click();
        await flushUi();

        expect(document.getElementById('gctEditSlot')).toBeNull();

        expect(sentMessages).toEqual(
            expect.arrayContaining([
                { target: 'gct', type: 'TOGGLE_GROUP_EXPANDED', groupId: 'group-1' },
                { target: 'gct', type: 'PAUSE_GROUP', groupId: 'group-1' },
                { target: 'gct', type: 'REMOVE_GROUP', groupId: 'group-1' },
                {
                    target: 'gct',
                    type: 'REPLACE_GROUP_SLOTS',
                    groupId: 'group-1',
                    slots: [{ date: '2026-03-18', startTime: '06:30' }],
                },
                { target: 'gct', type: 'PAUSE_ROW', groupId: 'group-1', rowId: 'row-1' },
                { target: 'gct', type: 'REMOVE_ROW', groupId: 'group-1', rowId: 'row-1' },
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
            document.querySelector('tr[data-row-id="row-3"] .gct-slot-time-cell') as HTMLElement
        ).click();
        expect(document.querySelector('.gct-edit-overlay')).toBeNull();

        (
            document.querySelector('tr[data-row-id="row-3"] .gct-slot-time-cell') as HTMLElement
        ).click();
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
