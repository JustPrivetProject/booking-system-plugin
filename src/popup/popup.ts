import './popup.css';
import { Statuses, Actions } from '../data';
import { authService } from '../services/authService';
import { autoLoginService, getAutoLoginStorageKey } from '../services/autoLoginService';
import type { RetryObjectArray } from '../types/baltichub';
import { syncStatusBadgeFromStorage } from '../utils/badge';
import {
    consoleLog,
    consoleError,
    sortStatusesByPriority,
    normalizeFormData,
    getFirstFormDataString,
} from '../utils/index';

import { showAutoLoginModal } from './modals/autoLogin.modal';
import { createConfirmationModal } from './modals/confirmation.modal';
import { showEmailConfirmationModal } from './modals/emailConfirm.modal';
import { showInfoModal } from './modals/info.modal';
import { showNotificationSettingsModal } from './modals/notificationSettings.modal';
import { notificationSettingsService } from '../services/notificationSettingsService';
import { getContainerCheckerState } from '../containerChecker/storage';
import { updateContainerCheckerAlarm } from '../services/containerChecker/containerCheckerService';
import { analyticsService } from '../services/analyticsService';
import { FEATURE_KEYS, featureAccessService } from '../services/featureAccessService';
import { initContainerCheckerUI } from './containerChecker';
import { initGctUI } from './gct';
import {
    getTerminalStorageKey,
    getTerminalStorageValue,
    setTerminalStorageValue,
    TERMINAL_STORAGE_NAMESPACES,
} from '../utils/storage';
import { BOOKING_TERMINALS } from '../types/terminal';

type PopupTab = 'booking' | 'bct' | 'containerChecker' | 'gct';

interface PopupWindow extends Window {
    _toggleHeaderReset?: () => Promise<void>;
}

const POPUP_ACTIVE_TAB_KEY = 'popupActiveTab';
const DCT_BOOKING_TERMINAL = BOOKING_TERMINALS.DCT;
const BCT_BOOKING_TERMINAL = BOOKING_TERMINALS.BCT;
const POPUP_BOOKING_TERMINALS = [DCT_BOOKING_TERMINAL, BCT_BOOKING_TERMINAL] as const;

type PopupBookingTerminal = (typeof POPUP_BOOKING_TERMINALS)[number];

function getQueueTableBodyId(terminal: PopupBookingTerminal): string {
    return terminal === DCT_BOOKING_TERMINAL ? 'queueTableBody' : 'bctQueueTableBody';
}

function getQueueTableBody(terminal: PopupBookingTerminal): HTMLElement {
    return requireElement<HTMLElement>(getQueueTableBodyId(terminal));
}

function getActiveBookingTerminal(): PopupBookingTerminal {
    return activePopupTab === 'bct' ? BCT_BOOKING_TERMINAL : DCT_BOOKING_TERMINAL;
}

function updateAllBookingQueueDisplays(): void {
    POPUP_BOOKING_TERMINALS.forEach(terminal => {
        updateQueueDisplay(terminal).catch(error => {
            consoleError(`Error updating ${terminal} queue display:`, error);
        });
    });
}

let activePopupTab: PopupTab = 'booking';
let isBctTabEnabled = false;
let isGctTabEnabled = false;
let isContainerCheckerUiInitialized = false;
let hasTrackedPopupSessionStart = false;

function requireElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);

    if (!element) {
        throw new Error(`Missing required element: ${id}`);
    }

    return element as T;
}

function initContainerCheckerUiOnce(): void {
    if (isContainerCheckerUiInitialized) {
        return;
    }

    initContainerCheckerUI();
    isContainerCheckerUiInitialized = true;
}

function initGctUiOnce(): void {
    initGctUI();
}

function applyFeatureTabAccess(
    tab: HTMLButtonElement | null,
    isEnabled: boolean,
    enabledTitle: string,
    disabledTitle: string,
): void {
    tab?.classList.toggle('tab-label-disabled', !isEnabled);

    if (!tab) {
        return;
    }

    tab.disabled = false;
    tab.setAttribute('aria-disabled', String(!isEnabled));
    tab.title = isEnabled ? enabledTitle : disabledTitle;
}

function applyTabState(tab: PopupTab, persist = true): void {
    const resolvedTab =
        (tab === 'gct' && !isGctTabEnabled) || (tab === 'bct' && !isBctTabEnabled)
            ? 'booking'
            : tab;
    const tabBooking = document.getElementById('tabBooking');
    const tabBct = document.getElementById('tabBct') as HTMLButtonElement | null;
    const tabContainerChecker = document.getElementById('tabContainerChecker');
    const tabGct = document.getElementById('tabGct') as HTMLButtonElement | null;
    const bookingView = document.getElementById('bookingView');
    const bctView = document.getElementById('bctView');
    const containerCheckerView = document.getElementById('containerCheckerView');
    const gctView = document.getElementById('gctView');

    activePopupTab = resolvedTab;
    void analyticsService.trackTabViewed(resolvedTab);

    tabBooking?.classList.toggle('active', resolvedTab === 'booking');
    tabBct?.classList.toggle('active', resolvedTab === 'bct');
    tabContainerChecker?.classList.toggle('active', resolvedTab === 'containerChecker');
    tabGct?.classList.toggle('active', resolvedTab === 'gct');

    bookingView?.classList.toggle('hidden', resolvedTab !== 'booking');
    bctView?.classList.toggle('hidden', resolvedTab !== 'bct' || !isBctTabEnabled);
    containerCheckerView?.classList.toggle('hidden', resolvedTab !== 'containerChecker');
    gctView?.classList.toggle('hidden', resolvedTab !== 'gct' || !isGctTabEnabled);

    updateAutoLoginButtonState().catch(error => {
        consoleError('Auto-login button refresh after tab change failed:', error);
    });

    if (resolvedTab === 'containerChecker') {
        initContainerCheckerUiOnce();
    }

    if (resolvedTab === 'gct' && isGctTabEnabled) {
        initGctUiOnce();
    }

    if (persist) {
        chrome.storage.local.set({ [POPUP_ACTIVE_TAB_KEY]: resolvedTab }).catch(error => {
            consoleError('Save active tab failed:', error);
        });
    }
}

async function refreshFeatureAccessUI(): Promise<void> {
    const tabBct = document.getElementById('tabBct') as HTMLButtonElement | null;
    const bctView = document.getElementById('bctView');
    const tabGct = document.getElementById('tabGct') as HTMLButtonElement | null;
    const gctView = document.getElementById('gctView');
    const isAuthenticated = await authService.isAuthenticated();

    if (!isAuthenticated) {
        isBctTabEnabled = false;
        isGctTabEnabled = false;
    } else {
        try {
            [isBctTabEnabled, isGctTabEnabled] = await Promise.all([
                featureAccessService.isFeatureEnabled(FEATURE_KEYS.BCT),
                featureAccessService.isFeatureEnabled(FEATURE_KEYS.GCT),
            ]);
        } catch (error) {
            consoleError('Failed to load feature access:', error);
            isBctTabEnabled = false;
            isGctTabEnabled = false;
        }
    }

    applyFeatureTabAccess(tabBct, isBctTabEnabled, 'Moduł BCT', 'Brak dostępu do modułu BCT');
    applyFeatureTabAccess(tabGct, isGctTabEnabled, 'Moduł GCT', 'Brak dostępu do modułu GCT');

    bctView?.classList.toggle('hidden', activePopupTab !== 'bct' || !isBctTabEnabled);
    gctView?.classList.toggle('hidden', activePopupTab !== 'gct' || !isGctTabEnabled);

    if (
        (!isBctTabEnabled && activePopupTab === 'bct') ||
        (!isGctTabEnabled && activePopupTab === 'gct')
    ) {
        applyTabState('booking');
    } else if (isGctTabEnabled && activePopupTab === 'gct') {
        initGctUiOnce();
    }
}

async function syncContainerCheckerAlarmState(): Promise<void> {
    const state = await getContainerCheckerState();
    await updateContainerCheckerAlarm(state.settings.pollingMinutes);
}

function sendMessageToBackground(action, data, options = { updateQueue: true }) {
    chrome.runtime.sendMessage(
        {
            target: 'background',
            action,
            data,
        },
        response => {
            if (chrome.runtime.lastError) {
                consoleError('Error sending message:', chrome.runtime.lastError);
                return;
            }

            // Обработка ответа от background.js
            if (response && response.success) {
                consoleLog(`Action ${action} completed successfully`);
                if (options.updateQueue) {
                    updateQueueDisplay(data?.terminal || DCT_BOOKING_TERMINAL).catch(error => {
                        consoleError('Queue refresh after background action failed:', error);
                    });
                }
            } else {
                consoleError(`Action ${action} failed:`, response?.error || 'Unknown error');
            }
        },
    );
}

async function removeRequestFromRetryQueue(
    id,
    terminal: PopupBookingTerminal = DCT_BOOKING_TERMINAL,
) {
    return sendMessageToBackground(Actions.REMOVE_REQUEST, {
        id,
        terminal,
    });
}

async function removeMultipleRequestsFromRetryQueue(
    ids,
    terminal: PopupBookingTerminal = DCT_BOOKING_TERMINAL,
) {
    return sendMessageToBackground(Actions.REMOVE_MULTIPLE_REQUESTS, {
        ids,
        terminal,
    });
}

async function setStatusRequest(
    id,
    status,
    status_message,
    terminal: PopupBookingTerminal = DCT_BOOKING_TERMINAL,
) {
    return sendMessageToBackground(Actions.UPDATE_REQUEST_STATUS, {
        id,
        status,
        status_message,
        terminal,
    });
}

async function setStatusMultipleRequests(
    ids: string[],
    status: string,
    status_message: string,
    terminal: PopupBookingTerminal = DCT_BOOKING_TERMINAL,
) {
    return sendMessageToBackground(Actions.UPDATE_MULTIPLE_REQUESTS_STATUS, {
        ids,
        status,
        status_message,
        terminal,
    });
}

async function restoreGroupStates(terminal: PopupBookingTerminal = DCT_BOOKING_TERMINAL) {
    try {
        const groupStates = await getTerminalStorageValue(
            TERMINAL_STORAGE_NAMESPACES.GROUP_STATES,
            terminal,
            {},
        );
        const tableBody = getQueueTableBody(terminal);

        tableBody.querySelectorAll<HTMLElement>('.group-row').forEach(groupRow => {
            const groupId = groupRow.dataset.groupId;
            if (!groupId) return;
            const isOpen = groupStates[groupId] === true;

            setGroupExpandedState(groupRow, isOpen);
        });
    } catch (error) {
        consoleError('Error restoring group states:', error);
    }
}

/**
 * Delete a group state by ID from Chrome storage
 * @param {string|number} groupId - The ID of the group state to delete
 * @returns {Promise<Object>} - The updated group states object
 */
async function deleteGroupStateById(
    groupId: string | number,
    terminal: PopupBookingTerminal = DCT_BOOKING_TERMINAL,
): Promise<object> {
    // Get current groupStates from storage
    const groupStates = await getTerminalStorageValue(
        TERMINAL_STORAGE_NAMESPACES.GROUP_STATES,
        terminal,
        {},
    );

    // Delete the specified group ID if it exists
    if (groupId in groupStates) {
        delete groupStates[groupId];

        // Save the updated groupStates back to storage
        await setTerminalStorageValue(
            TERMINAL_STORAGE_NAMESPACES.GROUP_STATES,
            terminal,
            groupStates,
        );
        consoleLog(`Group state with ID ${groupId} was deleted`);
    } else {
        consoleLog(`Group state with ID ${groupId} does not exist`);
    }

    return groupStates;
}

async function clearStateGroups(terminal: PopupBookingTerminal = DCT_BOOKING_TERMINAL) {
    // Get current groupStates from storage
    const groupStates = await getTerminalStorageValue(
        TERMINAL_STORAGE_NAMESPACES.GROUP_STATES,
        terminal,
        {},
    );

    if (Object.entries(groupStates).length) {
        await setTerminalStorageValue(TERMINAL_STORAGE_NAMESPACES.GROUP_STATES, terminal, {});
        consoleLog('Group state was cleared');
    }

    return groupStates;
}

// set up google icons
function getStatusIcon(status: string) {
    if (status === Statuses.IN_PROGRESS) return 'loop';
    if (status === Statuses.SUCCESS) return 'check_circle';
    if (status === Statuses.ANOTHER_TASK) return 'check_circle';
    if (status === Statuses.PAUSED) return 'pause_circle';
    if (status === Statuses.AUTHORIZATION_ERROR) return 'report';
    if (status === Statuses.EXPIRED) return 'hourglass_disabled';
    if (status === Statuses.NETWORK_ERROR) return 'report';
    return 'report';
}

/**
 * Apply custom status color if status_color is provided and status is in-progress
 * @param element - HTML element to apply color to
 * @param status_color - Custom color for the status
 * @param status - Current status of the request
 */
function applyCustomStatusColor(element: HTMLElement, status_color?: string, status?: string) {
    // Only apply custom color for in-progress status
    if (status_color && status === Statuses.IN_PROGRESS) {
        const statusIcon = element.querySelector('.status-icon') as HTMLElement;
        if (statusIcon) {
            statusIcon.style.color = status_color;
        }
    }
}

function isDisabled(status: string) {
    if (
        status === Statuses.ANOTHER_TASK ||
        status === Statuses.SUCCESS ||
        status === Statuses.ERROR ||
        status === Statuses.EXPIRED
    )
        return 'disabled';
    return '';
}

function isPlayDisabled(status: string) {
    if (status === Statuses.IN_PROGRESS) return 'disabled';
    return isDisabled(status);
}

function isPauseDisabled(status: string) {
    if (status === Statuses.PAUSED || status === Statuses.AUTHORIZATION_ERROR) return 'disabled';
    if (status === Statuses.NETWORK_ERROR) return 'disabled';
    return isDisabled(status);
}

function canResumeStatus(status: string): boolean {
    return isPlayDisabled(status) !== 'disabled';
}

function canPauseStatus(status: string): boolean {
    return isPauseDisabled(status) !== 'disabled';
}

function getGroupChildRows(groupRow: HTMLElement): HTMLElement[] {
    const rows: HTMLElement[] = [];
    let nextRow = groupRow.nextElementSibling;

    while (nextRow && !nextRow.classList.contains('group-row')) {
        if (nextRow instanceof HTMLElement) {
            rows.push(nextRow);
        }
        nextRow = nextRow.nextElementSibling;
    }

    return rows;
}

function setGroupExpandedState(groupRow: HTMLElement, isOpen: boolean): void {
    const toggleCell = groupRow.querySelector<HTMLElement>('.group-header.toggle-cell');
    const toggleIcon = toggleCell?.querySelector<HTMLElement>('.toggle-icon');

    toggleCell?.classList.toggle('open', isOpen);
    if (toggleIcon) {
        toggleIcon.textContent = isOpen ? 'expand_less' : 'expand_more';
    }

    getGroupChildRows(groupRow).forEach(row => {
        row.style.display = isOpen ? 'table-row' : 'none';
    });

    groupRow.dataset.isOpen = isOpen.toString();
}

async function updateQueueDisplay(terminal: PopupBookingTerminal = DCT_BOOKING_TERMINAL) {
    consoleLog('updateQueueDisplay', terminal);
    const isAuthenticated = await authService.isAuthenticated();
    if (!isAuthenticated) {
        return;
    }

    try {
        const retryQueue = await getTerminalStorageValue<RetryObjectArray>(
            TERMINAL_STORAGE_NAMESPACES.RETRY_QUEUE,
            terminal,
            [],
        );

        const groupedData = retryQueue.reduce((acc: Record<string, RetryObjectArray>, req) => {
            const tvAppId = req.tvAppId;
            if (!acc[tvAppId]) acc[tvAppId] = [];
            acc[tvAppId].push(req);
            return acc;
        }, {});

        const tableBody = getQueueTableBody(terminal);
        tableBody.innerHTML = '';

        const data = Object.entries(groupedData) as [string, RetryObjectArray][];
        if (!data.length) {
            await clearStateGroups(terminal);
            if (terminal === DCT_BOOKING_TERMINAL) {
                await syncStatusBadgeFromStorage();
            }
        }

        data.forEach(([tvAppId, items]) => {
            const statusForGroup = sortStatusesByPriority(
                items.map((item: RetryObjectArray[0]) => item.status),
            )[0];
            const statusIconForGroup = getStatusIcon(statusForGroup);
            const prioritizedItem = items.find(item => item.status === statusForGroup);
            const statusColorForGroup = prioritizedItem?.status_color;
            const canResumeGroup = items.some(item => canResumeStatus(item.status));
            const canPauseGroup = items.some(item => canPauseStatus(item.status));
            const hasPusteSlotType = items.some(item => item.slotType === 4);
            const containerContent = items[0].containerNumber
                ? `${items[0].containerNumber}${hasPusteSlotType ? ' <span class="puste-badge">PUSTE</span>' : ''}`
                : '-';

            const groupRow = document.createElement('tr');
            groupRow.dataset.groupId = tvAppId;
            groupRow.classList.add('group-row');
            groupRow.innerHTML = `
        <td class="group-header toggle-cell"><span class="toggle-icon material-icons">expand_more</span></td>
        <td class="group-header status ${statusForGroup}" title="Status kontenera">
                    <span class="status-icon material-icons" style="font-size: 28px;">
                        ${statusIconForGroup}
                    </span></td>
        <td class="group-header slot-date">${items[0].driverName ? items[0].driverName : 'Brak nazwy kierowcy'}</td>
        <td class="group-header container-cell slot-time">${containerContent}</td>
        <td class="group-header actions">
            <button class="group-resume-button resume-button" title="Wznów grupę" ${canResumeGroup ? '' : 'disabled'}>
                <span class="material-icons icon">play_arrow</span>
            </button>
            <button class="group-pause-button pause-button" title="Wstrzymaj grupę" ${canPauseGroup ? '' : 'disabled'}>
                <span class="material-icons icon">pause</span>
            </button>
            <button class="group-remove-button remove-button" title="Usuń grupę">
                <span class="material-icons icon">delete</span>
            </button>
        </td>`;
            tableBody.appendChild(groupRow);

            const groupStatusCell = groupRow.querySelector('.status') as HTMLElement;
            if (groupStatusCell && statusColorForGroup) {
                applyCustomStatusColor(groupStatusCell, statusColorForGroup, statusForGroup);
            }

            items.forEach((req: RetryObjectArray[0]) => {
                const containerInfo = normalizeFormData(req.body).formData;
                const slotStart = getFirstFormDataString(containerInfo?.SlotStart) || '';
                const slotEnd = getFirstFormDataString(containerInfo?.SlotEnd) || '';
                const row = document.createElement('tr');
                row.dataset.status = req.status;
                row.dataset.id = req.id;
                row.innerHTML = `
                <td></td>
                <td class="status ${req.status}" title="${req.status_message}">
                    <span class="status-icon material-icons" style="font-size: 28px;">
                        ${getStatusIcon(req.status)}
                    </span>
                </td>
                <td class="slot-date">${slotStart.split(' ')[0] || ''}</td>
                <td class="slot-time">${slotStart.split(' ')[1]?.slice(0, 5) || ''} - ${slotEnd.split(' ')[1]?.slice(0, 5) || ''}</td>
                <td class="actions">
                    <button class="resume-button" data-id="${req.id}" title="Wznów" ${isPlayDisabled(req.status)}>
                        <span class="material-icons icon">play_arrow</span>
                    </button>
                    <button class="pause-button" data-id="${req.id}" title="Wstrzymaj" ${isPauseDisabled(req.status)}>
                        <span class="material-icons icon">pause</span>
                    </button>
                    <button class="remove-button" data-id="${req.id}" title="Usuń">
                        <span class="material-icons icon">delete</span>
                    </button>
                </td>
            `;
                tableBody.appendChild(row);

                const statusCell = row.querySelector('.status') as HTMLElement;
                if (statusCell && req.status_color) {
                    applyCustomStatusColor(statusCell, req.status_color, req.status);
                }
            });
        });

        await restoreGroupStates(terminal);

        tableBody
            .querySelectorAll<HTMLElement>('.remove-button:not(.group-remove-button)')
            .forEach(btn => {
                btn.addEventListener('click', () =>
                    removeRequestFromRetryQueue(btn.dataset.id, terminal),
                );
            });
        tableBody
            .querySelectorAll<HTMLElement>('.pause-button:not(.group-pause-button)')
            .forEach(btn => {
                btn.addEventListener('click', () => {
                    const requestId = btn.dataset.id;
                    if (!requestId) return;

                    setStatusRequest(requestId, 'paused', 'Zadanie jest wstrzymane', terminal);
                });
            });
        tableBody
            .querySelectorAll<HTMLElement>('.resume-button:not(.group-resume-button)')
            .forEach(btn => {
                btn.addEventListener('click', () => {
                    const requestId = btn.dataset.id;
                    if (!requestId) return;

                    setStatusRequest(
                        requestId,
                        'in-progress',
                        'Zadanie jest w trakcie realizacji',
                        terminal,
                    );
                });
            });
        tableBody
            .querySelectorAll<HTMLElement>('.group-row .group-header:not(.actions)')
            .forEach(header => {
                header.addEventListener('click', async event => {
                    const currentHeader = event.currentTarget as HTMLElement;
                    const groupRow = currentHeader.closest('.group-row') as HTMLElement | null;
                    if (!groupRow) return;

                    const groupId = groupRow.dataset.groupId;
                    if (!groupId) return;
                    const isCurrentlyOpen = groupRow.dataset.isOpen === 'true';

                    setGroupExpandedState(groupRow, !isCurrentlyOpen);

                    try {
                        const groupStates = await getTerminalStorageValue(
                            TERMINAL_STORAGE_NAMESPACES.GROUP_STATES,
                            terminal,
                            {},
                        );
                        groupStates[groupId] = !isCurrentlyOpen;
                        await setTerminalStorageValue(
                            TERMINAL_STORAGE_NAMESPACES.GROUP_STATES,
                            terminal,
                            groupStates,
                        );
                    } catch (error) {
                        consoleError('Error saving group state:', error);
                    }
                });
            });
        tableBody
            .querySelectorAll<HTMLElement>('.group-row .group-resume-button')
            .forEach(resumeButton => {
                resumeButton.addEventListener('click', async event => {
                    event.stopPropagation();
                    const button = event.currentTarget as HTMLButtonElement;
                    if (button.disabled) return;

                    const groupHeaderRow = button.closest('.group-row') as HTMLElement | null;
                    if (!groupHeaderRow) return;

                    const idsToResume = getGroupChildRows(groupHeaderRow)
                        .map(row => ({
                            status: row.getAttribute('data-status'),
                            id: row.getAttribute('data-id'),
                        }))
                        .filter((item): item is { status: string; id: string } =>
                            Boolean(item.id && item.status && canResumeStatus(item.status)),
                        )
                        .map(item => item.id);

                    if (idsToResume.length > 0) {
                        await setStatusMultipleRequests(
                            idsToResume,
                            Statuses.IN_PROGRESS,
                            'Zadanie jest w trakcie realizacji',
                            terminal,
                        );
                    } else {
                        await showInfoModal('Brak zadań do wznowienia w tej grupie.');
                    }
                });
            });
        tableBody
            .querySelectorAll<HTMLElement>('.group-row .group-pause-button')
            .forEach(pauseButton => {
                pauseButton.addEventListener('click', async event => {
                    event.stopPropagation();
                    const button = event.currentTarget as HTMLButtonElement;
                    if (button.disabled) return;

                    const groupHeaderRow = button.closest('.group-row') as HTMLElement | null;
                    if (!groupHeaderRow) return;

                    const idsToPause = getGroupChildRows(groupHeaderRow)
                        .map(row => ({
                            status: row.getAttribute('data-status'),
                            id: row.getAttribute('data-id'),
                        }))
                        .filter((item): item is { status: string; id: string } =>
                            Boolean(item.id && item.status && canPauseStatus(item.status)),
                        )
                        .map(item => item.id);

                    if (idsToPause.length > 0) {
                        await setStatusMultipleRequests(
                            idsToPause,
                            Statuses.PAUSED,
                            'Zadanie jest wstrzymane',
                            terminal,
                        );
                    } else {
                        await showInfoModal('Brak zadań do wstrzymania w tej grupie.');
                    }
                });
            });
        tableBody
            .querySelectorAll<HTMLElement>('.group-row .group-remove-button')
            .forEach(removeButton => {
                removeButton.addEventListener('click', async event => {
                    event.stopPropagation();

                    const confirmed = await createConfirmationModal(
                        'Na pewno chcesz usunąć całą grupę zadań?',
                    );

                    if (!confirmed) return;

                    const button = event.currentTarget as HTMLButtonElement;
                    const groupHeaderRow = button.closest('.group-row') as HTMLElement | null;
                    if (!groupHeaderRow) return;

                    const idsToDelete = getGroupChildRows(groupHeaderRow)
                        .map(row => row.getAttribute('data-id'))
                        .filter((id): id is string => Boolean(id));

                    await removeMultipleRequestsFromRetryQueue(idsToDelete, terminal);

                    idsToDelete.forEach(id => {
                        const row = tableBody
                            .querySelector(`.remove-button[data-id="${id}"]`)
                            ?.closest('tr');
                        if (row) row.remove();
                    });

                    groupHeaderRow.remove();
                    const groupId = groupHeaderRow.dataset.groupId;
                    if (groupId) {
                        await deleteGroupStateById(groupId, terminal);
                    }
                });
            });
    } catch (error) {
        consoleError(`Error updating ${terminal} queue display:`, error);
    }
}

// Listen for storage changes and update UI when retryQueue changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (
        namespace === 'local' &&
        (changes.retryQueue ||
            changes[
                getTerminalStorageKey(TERMINAL_STORAGE_NAMESPACES.RETRY_QUEUE, DCT_BOOKING_TERMINAL)
            ])
    ) {
        consoleLog('Queue data changed, updating UI');
        updateQueueDisplay(DCT_BOOKING_TERMINAL).catch(error => {
            consoleError('DCT queue refresh failed:', error);
        });
    }
    if (
        namespace === 'local' &&
        changes[
            getTerminalStorageKey(TERMINAL_STORAGE_NAMESPACES.RETRY_QUEUE, BCT_BOOKING_TERMINAL)
        ]
    ) {
        consoleLog('BCT queue data changed, updating UI');
        updateQueueDisplay(BCT_BOOKING_TERMINAL).catch(error => {
            consoleError('BCT queue refresh failed:', error);
        });
    }
    if (
        namespace === 'local' &&
        (changes.autoLoginData ||
            changes[getAutoLoginStorageKey(DCT_BOOKING_TERMINAL)] ||
            changes[getAutoLoginStorageKey(BCT_BOOKING_TERMINAL)])
    ) {
        consoleLog('Auto-login data changed, updating UI');
        updateAutoLoginButtonState();
    }
    if (namespace === 'local' && changes.notificationSettings) {
        consoleLog('Notification settings changed, updating UI');
        updateNotificationButtonState();
    }
});

async function saveHeaderState(isHidden: boolean) {
    await chrome.storage.local.set({ headerHidden: isHidden });
}

async function restoreHeaderState() {
    const { headerHidden = false } = await chrome.storage.local.get('headerHidden');
    const header = document.querySelector('.header') as HTMLElement;
    const toggleHeaderIcon = document.getElementById('toggleHeaderIcon') as HTMLElement;
    const mainContent = document.getElementById('mainContent') as HTMLElement;
    if (header && toggleHeaderIcon && mainContent) {
        if (headerHidden) {
            header.style.display = 'none';
            toggleHeaderIcon.textContent = 'arrow_drop_down';
            mainContent.classList.add('header-hidden');
        } else {
            header.style.display = '';
            toggleHeaderIcon.textContent = 'arrow_drop_up';
            mainContent.classList.remove('header-hidden');
        }
    }
}

function toggleHeaderVisibility() {
    const header = document.querySelector('.header') as HTMLElement;
    const toggleHeaderBtn = document.getElementById('toggleHeaderBtn') as HTMLButtonElement;
    const toggleHeaderIcon = document.getElementById('toggleHeaderIcon') as HTMLElement;
    const mainContent = document.getElementById('mainContent') as HTMLElement;
    if (header && toggleHeaderBtn && toggleHeaderIcon && mainContent) {
        // Инициализация состояния из storage
        chrome.storage.local.get('headerHidden', result => {
            let headerHidden = result.headerHidden || false;
            // Установить правильный title при инициализации
            toggleHeaderBtn.title = headerHidden ? 'Pokaż nagłówek' : 'Ukryj';
            toggleHeaderBtn.addEventListener('click', async () => {
                headerHidden = !headerHidden;
                if (headerHidden) {
                    header.style.display = 'none';
                    toggleHeaderIcon.textContent = 'arrow_drop_down';
                    mainContent.classList.add('header-hidden');
                    toggleHeaderBtn.title = 'Pokaż';
                } else {
                    header.style.display = '';
                    toggleHeaderIcon.textContent = 'arrow_drop_up';
                    mainContent.classList.remove('header-hidden');
                    toggleHeaderBtn.title = 'Ukryj';
                }
                await saveHeaderState(headerHidden);
            });
            // expose for UI control
            (window as PopupWindow)._toggleHeaderReset = async () => {
                headerHidden = false;
                header.style.display = '';
                toggleHeaderIcon.textContent = 'arrow_drop_up';
                mainContent.classList.remove('header-hidden');
                toggleHeaderBtn.title = 'Ukryj';
                await saveHeaderState(false);
            };
        });
    }
}

async function updateAutoLoginButtonState() {
    try {
        const terminal = getActiveBookingTerminal();
        const isEnabled = await autoLoginService.isEnabled(terminal);
        const terminalLabel = terminal === BCT_BOOKING_TERMINAL ? 'BCT' : 'DCT';
        const autoLoginToggle = document.getElementById('autoLoginToggle') as HTMLElement;
        if (autoLoginToggle) {
            if (isEnabled) {
                autoLoginToggle.classList.add('enabled');
                autoLoginToggle.title = `Auto-Logowanie ${terminalLabel} Włączone`;
            } else {
                autoLoginToggle.classList.remove('enabled');
                autoLoginToggle.title = `Włącz Auto-Logowanie ${terminalLabel}`;
            }
        }
    } catch (error) {
        consoleError('Error updating auto-login button state:', error);
    }
}

async function updateNotificationButtonState() {
    try {
        const summary = await notificationSettingsService.getSettingsSummary();
        const notificationToggle = document.getElementById(
            'notificationSettingsToggle',
        ) as HTMLElement;

        if (notificationToggle) {
            let title = 'Ustawienia powiadomień';
            const hasAnyEnabled =
                summary.windowsEnabled || (summary.emailEnabled && summary.hasValidEmail);

            if (hasAnyEnabled) {
                notificationToggle.classList.add('enabled');
                const enabledTypes: string[] = [];

                if (summary.windowsEnabled) {
                    enabledTypes.push('Windows');
                }

                if (summary.emailEnabled && summary.hasValidEmail) {
                    enabledTypes.push(`Email (${summary.userEmail})`);
                }

                title = `Powiadomienia: ${enabledTypes.join(', ')}`;
            } else {
                notificationToggle.classList.remove('enabled');
                title = 'Ustawienia powiadomień - Wyłączone';
            }

            notificationToggle.title = title;
        }
    } catch (error) {
        consoleError('Error updating notification button state:', error);
    }
}

async function initTabs(): Promise<void> {
    const tabBooking = document.getElementById('tabBooking');
    const tabBct = document.getElementById('tabBct');
    const tabContainerChecker = document.getElementById('tabContainerChecker');
    const tabGct = document.getElementById('tabGct');

    tabBooking?.addEventListener('click', () => applyTabState('booking'));
    tabBct?.addEventListener('click', () => applyTabState('bct'));
    tabContainerChecker?.addEventListener('click', () => applyTabState('containerChecker'));
    tabGct?.addEventListener('click', () => applyTabState('gct'));

    await refreshFeatureAccessUI();

    try {
        const { [POPUP_ACTIVE_TAB_KEY]: storedTab } =
            await chrome.storage.local.get(POPUP_ACTIVE_TAB_KEY);
        if (
            storedTab === 'containerChecker' ||
            storedTab === 'booking' ||
            storedTab === 'bct' ||
            storedTab === 'gct'
        ) {
            applyTabState(storedTab, false);
            return;
        }
    } catch (error) {
        consoleError('Restore active tab failed:', error);
    }

    applyTabState('booking', false);
}

// Update the queue when the popup is opened
document.addEventListener('DOMContentLoaded', () => {
    updateAllBookingQueueDisplays();
    toggleHeaderVisibility();
    restoreHeaderState();
    updateAutoLoginButtonState();
    updateNotificationButtonState();
    initTabs().catch(error => consoleError('Init tabs failed:', error));
    // Удаляем тестовую кнопку, если она есть
    const testBtn = document.getElementById('testEmailConfirmBtn');
    if (testBtn) testBtn.remove();
});

// DOM Elements
const authContainer = requireElement<HTMLElement>('authContainer');
const mainContent = requireElement<HTMLElement>('mainContent');
const loginForm = requireElement<HTMLElement>('loginForm');
const registerForm = requireElement<HTMLElement>('registerForm');
const userEmail = requireElement<HTMLElement>('userEmail');

// Login form elements
const loginEmail = requireElement<HTMLInputElement>('loginEmail');
const loginPassword = requireElement<HTMLInputElement>('loginPassword');
const loginButton = requireElement<HTMLElement>('loginButton');
const showRegister = requireElement<HTMLElement>('showRegister');

// Register form elements
const registerEmail = requireElement<HTMLInputElement>('registerEmail');
const registerPassword = requireElement<HTMLInputElement>('registerPassword');
const registerButton = requireElement<HTMLElement>('registerButton');
const showLogin = requireElement<HTMLElement>('showLogin');

// Device unbind form elements
const unbindForm = requireElement<HTMLElement>('unbindForm');
const unbindEmail = requireElement<HTMLInputElement>('unbindEmail');
const unbindPassword = requireElement<HTMLInputElement>('unbindPassword');
const unbindButton = requireElement<HTMLElement>('unbindButton');
const showUnbind = requireElement<HTMLElement>('showUnbind');
const hideUnbind = requireElement<HTMLElement>('hideUnbind');

// Logout button
const logoutButton = requireElement<HTMLElement>('logoutButton');

// Error handling elements
const loginError = requireElement<HTMLElement>('loginError');
const registerError = requireElement<HTMLElement>('registerError');
const unbindError = requireElement<HTMLElement>('unbindError');

function showError(element: HTMLElement, message: string) {
    element.textContent = message;
    element.classList.add('show');

    // Hide error after 5 seconds
    setTimeout(() => {
        element.classList.remove('show');
    }, 5000);
}

function clearErrors() {
    loginError.classList.remove('show');
    registerError.classList.remove('show');
    unbindError.classList.remove('show');
    loginError.textContent = '';
    registerError.textContent = '';
    unbindError.textContent = '';
}

let manualRegisterMode = false;
let isRegistering = false;
let isLoggingIn = false;
let cameFromAuthenticated = false;

// Event Listeners
loginButton.addEventListener('click', e => {
    e.preventDefault();
    handleLogin();
    updateAllBookingQueueDisplays();
});
registerButton.addEventListener('click', e => {
    e.preventDefault();
    handleRegister();
    updateAllBookingQueueDisplays();
});

// Fix registration form toggle
showRegister.addEventListener('click', e => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    clearErrors();
    manualRegisterMode = true;
});

showLogin.addEventListener('click', e => {
    e.preventDefault();
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    clearErrors();
    manualRegisterMode = false;
});

logoutButton.addEventListener('click', async e => {
    e.preventDefault();
    const confirmed = await createConfirmationModal('Na pewno chcesz się wylogować?');
    if (confirmed) {
        handleLogout();
    }
});

// Add event listeners for unbind form
unbindButton.addEventListener('click', e => {
    e.preventDefault();
    handleUnbind();
});

// Add unbind button to authenticated UI
const unbindDeviceButton = requireElement<HTMLElement>('unbindDeviceButton');
unbindDeviceButton.addEventListener('click', e => {
    e.preventDefault();
    cameFromAuthenticated = true;
    mainContent.classList.add('hidden');
    authContainer.classList.remove('hidden');
    unbindForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    registerForm.classList.add('hidden');
    backToAppButton.classList.remove('hidden');
    hideUnbind.classList.add('hidden'); // Hide Back to Login button
    clearErrors();
});

// Update showUnbind handler
showUnbind.addEventListener('click', e => {
    e.preventDefault();
    cameFromAuthenticated = false;
    loginForm.classList.add('hidden');
    registerForm.classList.add('hidden');
    unbindForm.classList.remove('hidden');
    backToAppButton.classList.add('hidden');
    hideUnbind.classList.remove('hidden'); // Show Back to Login button
    clearErrors();
});

// Update hideUnbind handler
hideUnbind.addEventListener('click', e => {
    e.preventDefault();
    unbindForm.classList.add('hidden');
    if (cameFromAuthenticated) {
        mainContent.classList.remove('hidden');
        authContainer.classList.add('hidden');
    } else {
        loginForm.classList.remove('hidden');
    }
    backToAppButton.classList.add('hidden');
    hideUnbind.classList.remove('hidden'); // Reset button visibility
    clearErrors();
});

// Add back button handler
const backToAppButton = requireElement<HTMLElement>('backToAppButton');
backToAppButton.addEventListener('click', e => {
    e.preventDefault();
    cameFromAuthenticated = false;
    authContainer.classList.add('hidden');
    mainContent.classList.remove('hidden');
    unbindForm.classList.add('hidden');
    clearErrors();
});

// Auto-login toggle button handler
const autoLoginToggle = requireElement<HTMLElement>('autoLoginToggle');
autoLoginToggle.addEventListener('click', async e => {
    e.preventDefault();
    try {
        const terminal = getActiveBookingTerminal();
        const isEnabled = await autoLoginService.isEnabled(terminal);

        if (isEnabled) {
            // If auto-login is enabled, show modal to manage credentials
            const credentials = await showAutoLoginModal(terminal);
            if (credentials) {
                await updateAutoLoginButtonState();
                await showInfoModal('Dane auto-login zostały zapisane pomyślnie!');
            }
        } else {
            // If auto-login is disabled, show modal to set up credentials
            const credentials = await showAutoLoginModal(terminal);
            if (credentials) {
                await updateAutoLoginButtonState();
                await showInfoModal('Auto-login został włączony!');
            }
        }
    } catch (error) {
        consoleError('Error in auto-login modal:', error);
    }
});

// Notification settings toggle button handler
const notificationSettingsToggle = requireElement<HTMLElement>('notificationSettingsToggle');
notificationSettingsToggle.addEventListener('click', async e => {
    e.preventDefault();
    try {
        const result = await showNotificationSettingsModal();
        if (result) {
            await updateNotificationButtonState();
            let message = 'Ustawienia powiadomień zostały zapisane pomyślnie!';

            if (result.email.enabled && result.email.userEmail) {
                message += `\nPowiadomienia e-mail będą wysyłane na: ${result.email.userEmail}`;
            }

            await showInfoModal(message);
        }
    } catch (error) {
        consoleError('Error in notification settings modal:', error);
    }
});

// Prevent form submit for login and register forms
loginForm.addEventListener('submit', e => {
    e.preventDefault();
    handleLogin();
    updateAllBookingQueueDisplays();
});
registerForm.addEventListener('submit', e => {
    e.preventDefault();
    handleRegister();
    updateAllBookingQueueDisplays();
});
unbindForm.addEventListener('submit', e => {
    e.preventDefault();
    handleUnbind();
});

document.getElementById('send-logs-btn')?.addEventListener('click', async () => {
    const description = await createConfirmationModal(
        'Czy pojawił się jakiś problem? Opisz go poniżej:',
        true,
    );
    if (!description) return;
    sendMessageToBackground('SEND_LOGS_TO_SUPABASE', { description });
    await showInfoModal(
        'Dziękujemy za opisanie problemu. Postaramy się go rozwiązać najszybciej jak to możliwe.',
    );
});

document.getElementById('instruction-btn')?.addEventListener('click', () => {
    const welcomeUrl = chrome.runtime.getURL('welcome.html');
    chrome.tabs.create({
        url: welcomeUrl,
    });
});

// Functions
async function handleLogin() {
    consoleLog('handleLogin called', Date.now(), Math.random());
    if (isLoggingIn) return;
    isLoggingIn = true;
    try {
        clearErrors();
        if (!loginEmail.value || !loginPassword.value) {
            showError(loginError, 'Please fill in all fields');
            return;
        }
        const user = await authService.login(loginEmail.value, loginPassword.value);
        if (user) {
            hasTrackedPopupSessionStart = true;
            void analyticsService.trackSessionStarted('login', user.email);
            showAuthenticatedUI(user);
            manualRegisterMode = false;
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An error occurred';
        const friendlyMessage = getFriendlyErrorMessage(errorMessage);
        showError(loginError, friendlyMessage);
    } finally {
        isLoggingIn = false;
    }
}

async function handleRegister() {
    if (isRegistering) return;
    isRegistering = true;
    try {
        clearErrors();
        if (!registerEmail.value || !registerPassword.value) {
            showError(registerError, 'Please fill in all fields');
            return;
        }
        if (registerPassword.value.length < 6) {
            showError(registerError, 'Password must be at least 6 characters long');
            return;
        }
        const user = await authService.register(registerEmail.value, registerPassword.value);
        if (user) {
            // Показываем сообщение о необходимости подтверждения email
            registerForm.classList.add('hidden');
            showEmailConfirmationModal(registerEmail.value, () => {
                registerForm.classList.add('hidden');
                loginForm.classList.remove('hidden');
            });
            manualRegisterMode = false;
        }
    } catch (error: unknown) {
        const friendlyMessage = getFriendlyErrorMessage(
            typeof error === 'object' && error !== null && 'code' in error
                ? (error as { code?: string; message?: string })
                : error instanceof Error
                  ? error.message
                  : String(error),
        );
        showError(registerError, friendlyMessage);
    } finally {
        isRegistering = false;
    }
}

async function pauseAllBookingQueues(reason: string): Promise<void> {
    for (const terminal of POPUP_BOOKING_TERMINALS) {
        const retryQueue = await getTerminalStorageValue<RetryObjectArray>(
            TERMINAL_STORAGE_NAMESPACES.RETRY_QUEUE,
            terminal,
            [],
        );

        for (const item of retryQueue) {
            if (item.status === Statuses.IN_PROGRESS) {
                await setStatusRequest(item.id, Statuses.PAUSED, reason, terminal);
            }
        }
    }
}

async function handleLogout() {
    try {
        await pauseAllBookingQueues('Task paused due to logout');

        await authService.logout();
        await syncContainerCheckerAlarmState();
        showUnauthenticatedUI();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An error occurred';
        showError(loginError, `Logout failed: ${errorMessage}`);
    }
}

async function handleUnbind() {
    if (!unbindEmail.value || !unbindPassword.value) {
        showError(unbindError, 'Please fill in all fields');
        return;
    }

    try {
        await pauseAllBookingQueues('Task paused due to device unbinding');

        await authService.unbindDevice(unbindEmail.value, unbindPassword.value);

        // After successful unbinding, logout and show login form
        await authService.logout();
        await syncContainerCheckerAlarmState();
        cameFromAuthenticated = false;
        unbindForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        backToAppButton.classList.add('hidden');
        hideUnbind.classList.remove('hidden'); // Reset button visibility
        clearErrors();
        // Clear the form
        unbindEmail.value = '';
        unbindPassword.value = '';
        // Show unauthenticated UI
        showUnauthenticatedUI();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An error occurred';
        const friendlyMessage = getFriendlyErrorMessage(errorMessage);
        showError(unbindError, friendlyMessage);
    }
}

function getFriendlyErrorMessage(
    errorMessage: string | { code?: string; message?: string },
): string {
    if (typeof errorMessage === 'string' && errorMessage.includes('Device ID mismatch')) {
        return 'Próbujesz się zalogować z nowego urządzenia. Zaloguj się z tego samego urządzenia z którego się rejestrowałeś';
    }

    const errorMap: { [key: string]: string } = {
        over_email_send_rate_limit: 'Za dużo prób. Poczekaj minutę i spróbuj ponownie.',
        email_exists: 'Użytkownik z tym adresem email już istnieje.',
        user_already_exists: 'Użytkownik z tymi danymi już istnieje.',
        email_address_invalid: 'Nieprawidłowy adres email. Użyj prawdziwego adresu.',
        email_not_confirmed: 'Potwierdź swój adres email poprzez link w wiadomości.',
        invalid_credentials: 'Nieprawidłowy email lub hasło.',
        weak_password: 'Hasło jest zbyt proste. Użyj silniejszego hasła.',
        signup_disabled: 'Rejestracja nowych użytkowników jest wyłączona.',
        bad_jwt: 'Błąd autoryzacji. Spróbuj zalogować się ponownie.',
        session_expired: 'Sesja wygasła. Zaloguj się ponownie.',
        no_authorization: 'Wymagana autoryzacja. Zaloguj się.',
        over_request_rate_limit: 'Za dużo zapytań. Spróbuj później.',
        captcha_failed: 'Błąd weryfikacji CAPTCHA. Spróbuj ponownie.',
        password_should_be_at_least_6_characters: 'Hasło musi mieć co najmniej 6 znaków.',
        'rate limit exceeded': 'Za dużo prób. Spróbuj ponownie później.',
        user_banned: 'Twoje konto jest zablokowane.',
    };

    if (typeof errorMessage === 'object' && errorMessage !== null) {
        if (errorMessage.code && errorMap[errorMessage.code]) {
            return errorMap[errorMessage.code];
        }
        if (errorMessage.message) {
            return errorMessage.message;
        }
    }

    if (typeof errorMessage === 'string') {
        try {
            const errObj = JSON.parse(errorMessage);
            if (errObj.code && errorMap[errObj.code]) {
                return errorMap[errObj.code];
            }
            if (errObj.message) {
                return errObj.message;
            }
        } catch {
            // Ignore JSON parse errors
        }
        if (errorMap[errorMessage]) return errorMap[errorMessage];
    }

    return typeof errorMessage === 'string'
        ? errorMessage
        : 'Inccorrect or unknown error occurred. Please try again later.';
}

function showAuthenticatedUI(user: { email: string }) {
    clearErrors();
    authContainer.classList.add('hidden');
    mainContent.classList.remove('hidden');
    userEmail.textContent = user.email;
    // Кнопка toggleHeaderBtn всегда видима для авторизованного пользователя
    const toggleHeaderBtn = document.getElementById('toggleHeaderBtn') as HTMLButtonElement;
    if (toggleHeaderBtn) toggleHeaderBtn.style.display = '';
    restoreHeaderState();
    updateAllBookingQueueDisplays();
    updateAutoLoginButtonState();
    updateNotificationButtonState();
    refreshFeatureAccessUI().catch(error => {
        consoleError('Failed to refresh feature access UI:', error);
    });
    syncContainerCheckerAlarmState().catch(error => {
        consoleError('Failed to sync Container Checker alarm state:', error);
    });
}

function showUnauthenticatedUI() {
    clearErrors();
    authContainer.classList.remove('hidden');
    mainContent.classList.add('hidden');
    // Скрываем toggleHeaderBtn только для неавторизованного пользователя
    const toggleHeaderBtn = document.getElementById('toggleHeaderBtn') as HTMLButtonElement;
    if (toggleHeaderBtn) toggleHeaderBtn.style.display = 'none';
    restoreHeaderState();
    if (manualRegisterMode) {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
    } else {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    }
    loginEmail.value = '';
    loginPassword.value = '';
    registerEmail.value = '';
    registerPassword.value = '';
    hasTrackedPopupSessionStart = false;
    refreshFeatureAccessUI().catch(error => {
        consoleError('Failed to refresh feature access UI:', error);
    });
    syncContainerCheckerAlarmState().catch(error => {
        consoleError('Failed to sync Container Checker alarm state:', error);
    });
}

// Check authentication status on load
async function checkAuth() {
    const isAuthenticated = await authService.isAuthenticated();
    if (isAuthenticated) {
        const user = await authService.getCurrentUser();
        if (user) {
            if (!hasTrackedPopupSessionStart) {
                hasTrackedPopupSessionStart = true;
                void analyticsService.trackSessionStarted('restored', user.email);
            }
            showAuthenticatedUI(user);
        } else {
            showUnauthenticatedUI();
        }
    } else {
        // Try auto-login if not authenticated
        const autoLoginSuccess = await autoLoginService.performAutoLoginWithFallback([
            DCT_BOOKING_TERMINAL,
            BCT_BOOKING_TERMINAL,
        ]);
        if (autoLoginSuccess) {
            const user = await authService.getCurrentUser();
            if (user) {
                if (!hasTrackedPopupSessionStart) {
                    hasTrackedPopupSessionStart = true;
                    void analyticsService.trackSessionStarted('restored', user.email);
                }
                showAuthenticatedUI(user);
                return;
            }
        }
        showUnauthenticatedUI();
    }
}

// Add session check interval
setInterval(checkAuth, 300000); // Check every 5 minutes

// Initialize
checkAuth();
