jest.mock('../../../src/utils/index', () => ({
    consoleError: jest.fn(),
}));

const mockState = {
    watchlist: [],
    settings: { pollingMinutes: 10 },
    lastRunAt: null,
};

describe('Container Checker Popup', () => {
    let mockSendMessage: jest.Mock;
    let mockStorageListener: ((changes: object, areaName: string) => void) | null;
    let mockAddStorageListener: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockStorageListener = null;
        mockSendMessage = jest.fn((msg: object, callback: (r: object) => void) => {
            if (callback) {
                callback({ ok: true, result: mockState });
            }
        });
        mockAddStorageListener = jest.fn(
            (listener: (changes: object, areaName: string) => void) => {
                mockStorageListener = listener;
            },
        );

        (global as any).chrome = {
            ...(global as any).chrome,
            runtime: {
                ...(global as any).chrome?.runtime,
                sendMessage: mockSendMessage,
                lastError: null,
            },
            storage: {
                ...(global as any).chrome?.storage,
                onChanged: {
                    addListener: mockAddStorageListener,
                    removeListener: jest.fn(),
                },
            },
        };

        document.body.innerHTML = `
            <table><tbody id="watchlistBody"></tbody></table>
            <input id="pollingMinutes" type="number" value="10" />
            <button id="addContainerBtn">Dodaj</button>
            <button id="checkNowBtn">Sprawdź teraz</button>
            <button id="removeAllContainersBtn">Usuń wszystkie</button>
            <textarea id="containerInput"></textarea>
            <select id="portInput">
                <option value="DCT">DCT</option>
                <option value="BCT">BCT</option>
                <option value="GCT">GCT</option>
            </select>
        `;
    });

    function initFresh() {
        jest.resetModules();
        const { initContainerCheckerUI } = require('../../../src/popup/containerChecker');
        return initContainerCheckerUI;
    }

    describe('initContainerCheckerUI', () => {
        it('should call GET_STATE on init', async () => {
            const initContainerCheckerUI = initFresh();
            initContainerCheckerUI();

            await new Promise(resolve => setTimeout(resolve, 50));

            expect(mockSendMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    target: 'containerChecker',
                    type: 'GET_STATE',
                }),
                expect.any(Function),
            );
        });

        it('should render empty watchlist when state has no items', async () => {
            const initContainerCheckerUI = initFresh();
            initContainerCheckerUI();

            await new Promise(resolve => setTimeout(resolve, 50));

            const watchlistBody = document.getElementById('watchlistBody');
            expect(watchlistBody).not.toBeNull();
            expect(watchlistBody?.innerHTML).toContain('Dodaj kontenery do śledzenia');
        });

        it('should render watchlist items when state has items', async () => {
            mockSendMessage.mockImplementation((msg: object, callback: (r: object) => void) => {
                if (callback) {
                    callback({
                        ok: true,
                        result: {
                            ...mockState,
                            watchlist: [
                                {
                                    containerNumber: 'ABCD1234567',
                                    port: 'DCT',
                                    status: 'Stops:1',
                                    state: 'In Terminal',
                                    statusChanged: false,
                                    stateChanged: false,
                                    hasErrors: false,
                                    errors: [],
                                    lastNotifiedSignature: null,
                                    lastUpdate: null,
                                    lastChangeAt: null,
                                    lastCheckedAt: null,
                                    snapshot: null,
                                },
                            ],
                        },
                    });
                }
            });

            const initContainerCheckerUI = initFresh();
            initContainerCheckerUI();

            await new Promise(resolve => setTimeout(resolve, 50));

            const watchlistBody = document.getElementById('watchlistBody');
            expect(watchlistBody?.textContent).toContain('ABCD1234567');
            expect(watchlistBody?.textContent).toContain('DCT');
        });

        it('should register storage change listener', () => {
            const initContainerCheckerUI = initFresh();
            initContainerCheckerUI();

            expect(mockAddStorageListener).toHaveBeenCalled();
        });

        it('should refresh state when storage changes for container checker keys', async () => {
            const initContainerCheckerUI = initFresh();
            initContainerCheckerUI();
            await new Promise(resolve => setTimeout(resolve, 50));

            mockSendMessage.mockClear();

            expect(mockStorageListener).not.toBeNull();
            mockStorageListener!(
                {
                    containerCheckerWatchlist: { newValue: [], oldValue: [] },
                },
                'local',
            );

            await new Promise(resolve => setTimeout(resolve, 50));

            expect(mockSendMessage).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'GET_STATE' }),
                expect.any(Function),
            );
        });

        it('should not refresh when storage changes in non-local area', async () => {
            const initContainerCheckerUI = initFresh();
            initContainerCheckerUI();
            await new Promise(resolve => setTimeout(resolve, 50));

            mockSendMessage.mockClear();

            mockStorageListener!(
                {
                    containerCheckerWatchlist: { newValue: [], oldValue: [] },
                },
                'session',
            );

            await new Promise(resolve => setTimeout(resolve, 50));

            expect(mockSendMessage).not.toHaveBeenCalled();
        });

        it('should acknowledge UI changes on popup close', async () => {
            const initContainerCheckerUI = initFresh();
            initContainerCheckerUI();

            await new Promise(resolve => setTimeout(resolve, 50));
            mockSendMessage.mockClear();

            window.dispatchEvent(new Event('beforeunload'));

            expect(mockSendMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    target: 'containerChecker',
                    type: 'ACK_UI_CHANGES',
                }),
                expect.any(Function),
            );
        });

        it('should remove all watchlist items when header remove-all button is clicked', async () => {
            mockSendMessage.mockImplementation((msg: any, callback: (r: object) => void) => {
                if (msg.type === 'GET_STATE') {
                    callback({
                        ok: true,
                        result: {
                            ...mockState,
                            watchlist: [
                                {
                                    containerNumber: 'ABCD1234567',
                                    port: 'DCT',
                                    status: 'Stops:1',
                                    state: 'In Terminal',
                                    statusChanged: false,
                                    stateChanged: false,
                                    hasErrors: false,
                                    errors: [],
                                    lastNotifiedSignature: null,
                                    lastUpdate: null,
                                    lastChangeAt: null,
                                    lastCheckedAt: null,
                                    snapshot: null,
                                },
                                {
                                    containerNumber: 'EFGH7654321',
                                    port: 'BCT',
                                    status: 'Stops:2',
                                    state: 'Out',
                                    statusChanged: false,
                                    stateChanged: false,
                                    hasErrors: false,
                                    errors: [],
                                    lastNotifiedSignature: null,
                                    lastUpdate: null,
                                    lastChangeAt: null,
                                    lastCheckedAt: null,
                                    snapshot: null,
                                },
                            ],
                        },
                    });
                    return;
                }

                callback({ ok: true, result: mockState });
            });

            const initContainerCheckerUI = initFresh();
            initContainerCheckerUI();
            await new Promise(resolve => setTimeout(resolve, 50));

            mockSendMessage.mockClear();

            const removeAllBtn = document.getElementById('removeAllContainersBtn');
            expect(removeAllBtn).not.toBeNull();
            (removeAllBtn as HTMLButtonElement).click();

            await new Promise(resolve => setTimeout(resolve, 100));

            expect(mockSendMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'REMOVE_CONTAINER',
                    containerNumber: 'ABCD1234567',
                }),
                expect.any(Function),
            );
            expect(mockSendMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'REMOVE_CONTAINER',
                    containerNumber: 'EFGH7654321',
                }),
                expect.any(Function),
            );
        });
    });
});
