import { Statuses } from '../data';
import {
    GCT_ALLOWED_START_TIMES,
    type GctAllowedStartTime,
    type GctState,
    type GctWatchGroup,
    type GctWatchRow,
} from '../gct/types';
import { consoleError } from '../utils';

const GCT_TIMEZONE = 'Europe/Warsaw';

function byId<T extends HTMLElement>(id: string): T | null {
    return document.getElementById(id) as T | null;
}

function nowLocalDate(): string {
    return new Intl.DateTimeFormat('sv-SE', {
        timeZone: GCT_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
}

function rowStatusClass(row: GctWatchRow): string {
    if (row.status === 'watching' || row.status === 'attempting') {
        return Statuses.IN_PROGRESS;
    }
    if (row.status === 'completed') {
        return Statuses.PAUSED;
    }
    return row.status;
}

function iconForRow(row: GctWatchRow): string {
    if (row.status === Statuses.SUCCESS) return 'check_circle';
    if (row.status === Statuses.EXPIRED) return 'hourglass_disabled';
    if (row.status === Statuses.AUTHORIZATION_ERROR) return 'report';
    if (row.status === Statuses.NETWORK_ERROR || row.status === Statuses.ERROR) return 'report';
    if (row.status === Statuses.PAUSED || row.status === 'completed') return 'pause_circle';
    return 'loop';
}

function iconForGroup(group: GctWatchGroup): string {
    if (group.status === 'success') return 'check_circle';
    if (group.status === 'completed') return 'task_alt';
    if (group.status === 'auth-lost' || group.status === 'error') return 'report';
    if (group.status === 'paused') return 'pause_circle';
    return 'loop';
}

function formatDateDisplay(date: string): string {
    const [year, month, day] = date.split('-');
    return `${day}.${month}.${year}`;
}

function formatRowTime(row: GctWatchRow): string {
    const today = nowLocalDate();
    const timeRange = `${row.targetStartTime} - ${row.targetEndTime}`;
    if (row.targetDate === today) {
        return timeRange;
    }

    const endDatePrefix =
        row.targetDate === row.targetEndDate ? '' : ` → ${formatDateDisplay(row.targetEndDate)}`;
    return `${formatDateDisplay(row.targetDate)} ${timeRange}${endDatePrefix}`;
}

async function sendGctMessage<T = GctState>(
    type: string,
    payload: Record<string, unknown> = {},
): Promise<T> {
    const response = await new Promise<{ ok: boolean; result?: T; error?: string }>(resolve => {
        chrome.runtime.sendMessage({ target: 'gct', type, ...payload }, resp => {
            if (chrome.runtime.lastError) {
                resolve({ ok: false, error: chrome.runtime.lastError.message });
                return;
            }
            resolve(resp || { ok: false, error: 'No response' });
        });
    });

    if (!response.ok || response.result === undefined) {
        throw new Error(response.error || 'Unknown GCT error');
    }

    return response.result;
}

function buildControlsMarkup(): string {
    const slotOptions = GCT_ALLOWED_START_TIMES.map(
        time =>
            `<option value="${time}">${time} - ${String((Number(time.slice(0, 2)) + 2) % 24).padStart(2, '0')}:${time.slice(3)}</option>`,
    ).join('');

    return `
        <div class="gct-controls">
            <div class="gct-controls-row">
                <input id="gctDocumentInput" class="gct-input" type="text" placeholder="Dokument kierowcy" />
                <input id="gctVehicleInput" class="gct-input" type="text" placeholder="Nr. Pojazdu" />
                <input id="gctContainerInput" class="gct-input" type="text" placeholder="Nr. Kontenera" />
                <input id="gctDateInput" class="gct-date-input" type="date" />
                <button id="gctAddButton" type="button" class="secondary-button gct-add-button">Dodaj</button>
            </div>
            <div class="gct-slot-row">
                <label class="gct-slot-label" for="gctSlotSelect">Godzina</label>
                <select id="gctSlotSelect" class="gct-slot-select" multiple aria-label="Godzina">
                    ${slotOptions}
                </select>
                <div id="gctSlotSummary" class="gct-slot-summary">Wybierz jeden lub więcej slotów</div>
            </div>
        </div>
        <div class="queue-container gct-queue-container">
            <table id="gctTable">
                <tbody id="gctTableBody"></tbody>
            </table>
        </div>
    `;
}

function getSelectedSlots(select: HTMLSelectElement): GctAllowedStartTime[] {
    return Array.from(select.selectedOptions).map(option => option.value as GctAllowedStartTime);
}

function updateSlotSummary(): void {
    const select = byId<HTMLSelectElement>('gctSlotSelect');
    const summary = byId<HTMLElement>('gctSlotSummary');
    if (!select || !summary) return;

    const selected = getSelectedSlots(select);
    if (selected.length === 0) {
        summary.textContent = 'Wybierz jeden lub więcej slotów';
        return;
    }

    if (selected.length <= 2) {
        summary.textContent = selected.join(', ');
        return;
    }

    summary.textContent = `${selected.length} sloty wybrane`;
}

function renderEmptyState(body: HTMLElement): void {
    body.innerHTML =
        '<tr><td class="watchlist-empty-cell gct-empty-cell">Dodaj konfigurację GCT, aby rozpocząć monitoring</td></tr>';
}

function createGroupHeader(group: GctWatchGroup): HTMLTableRowElement {
    const row = document.createElement('tr');
    row.className = 'group-row gct-group-row';
    row.dataset.groupId = group.id;
    row.dataset.isOpen = String(group.isExpanded);

    const openIcon = group.isExpanded ? 'expand_less' : 'expand_more';
    row.innerHTML = `
        <td class="group-header toggle-cell gct-toggle-cell ${group.isExpanded ? 'open' : ''}">
            <span class="toggle-icon material-icons">${openIcon}</span>
        </td>
        <td class="group-header status ${group.status === 'watching' ? Statuses.IN_PROGRESS : group.status === 'success' ? Statuses.SUCCESS : group.status === 'paused' ? Statuses.PAUSED : group.status === 'completed' ? Statuses.PAUSED : Statuses.ERROR}" title="${group.statusMessage}">
            <span class="status-icon material-icons">${iconForGroup(group)}</span>
        </td>
        <td class="group-header gct-group-main" colspan="2" title="${group.documentNumber} / ${group.vehicleNumber}">
            <div class="gct-group-title">${group.containerNumber}</div>
            <div class="gct-group-meta">${group.documentNumber} • ${group.vehicleNumber}</div>
        </td>
        <td class="group-header actions">
            <button class="group-resume-button resume-button" title="Wznów grupę" ${group.status === 'watching' || group.status === 'success' ? 'disabled' : ''}>
                <span class="material-icons icon">play_arrow</span>
            </button>
            <button class="group-pause-button pause-button" title="Wstrzymaj grupę" ${group.status !== 'watching' ? 'disabled' : ''}>
                <span class="material-icons icon">pause</span>
            </button>
            <button class="group-remove-button remove-button" title="Usuń grupę">
                <span class="material-icons icon">delete</span>
            </button>
        </td>
    `;

    return row;
}

function createChildRow(group: GctWatchGroup, rowState: GctWatchRow): HTMLTableRowElement {
    const row = document.createElement('tr');
    row.dataset.groupId = group.id;
    row.dataset.rowId = rowState.id;
    row.dataset.status = rowState.status;
    row.style.display = group.isExpanded ? 'table-row' : 'none';

    const cssClass = rowStatusClass(rowState);
    row.innerHTML = `
        <td></td>
        <td class="status ${cssClass}" title="${rowState.statusMessage}">
            <span class="status-icon material-icons">${iconForRow(rowState)}</span>
        </td>
        <td class="slot-time gct-slot-time-cell gct-slot-editable" title="${rowState.targetStartLocal}">${formatRowTime(rowState)}</td>
        <td class="gct-row-message" title="${rowState.statusMessage}">${rowState.statusMessage}</td>
        <td class="actions">
            <button class="resume-button" title="Wznów" ${rowState.active || rowState.status === Statuses.SUCCESS || rowState.status === Statuses.EXPIRED || rowState.status === 'completed' ? 'disabled' : ''}>
                <span class="material-icons icon">play_arrow</span>
            </button>
            <button class="pause-button" title="Wstrzymaj" ${!rowState.active || rowState.status === Statuses.SUCCESS || rowState.status === Statuses.EXPIRED || rowState.status === 'completed' ? 'disabled' : ''}>
                <span class="material-icons icon">pause</span>
            </button>
            <button class="remove-button" title="Usuń">
                <span class="material-icons icon">delete</span>
            </button>
        </td>
    `;

    return row;
}

function bindGroupEvents(groupRow: HTMLTableRowElement): void {
    const groupId = groupRow.dataset.groupId;
    if (!groupId) return;

    groupRow.querySelector('.gct-toggle-cell')?.addEventListener('click', async () => {
        try {
            await sendGctMessage('TOGGLE_GROUP_EXPANDED', { groupId });
        } catch (error) {
            consoleError('Toggle GCT group failed:', error);
        }
    });

    groupRow.querySelector('.group-remove-button')?.addEventListener('click', async event => {
        event.stopPropagation();
        try {
            await sendGctMessage('REMOVE_GROUP', { groupId });
        } catch (error) {
            consoleError('Remove GCT group failed:', error);
        }
    });

    groupRow.querySelector('.group-pause-button')?.addEventListener('click', async event => {
        event.stopPropagation();
        try {
            await sendGctMessage('PAUSE_GROUP', { groupId });
        } catch (error) {
            consoleError('Pause GCT group failed:', error);
        }
    });

    groupRow.querySelector('.group-resume-button')?.addEventListener('click', async event => {
        event.stopPropagation();
        try {
            await sendGctMessage('RESUME_GROUP', { groupId });
        } catch (error) {
            consoleError('Resume GCT group failed:', error);
        }
    });
}

function showRowEditModal(groupId: string, rowId: string, rowState: GctWatchRow): void {
    const overlay = document.createElement('div');
    overlay.className = 'gct-edit-overlay';
    const slotOptions = GCT_ALLOWED_START_TIMES.map(
        time =>
            `<option value="${time}" ${time === rowState.targetStartTime ? 'selected' : ''}>${time}</option>`,
    ).join('');

    overlay.innerHTML = `
        <div class="gct-edit-dialog">
            <h3>Edytuj slot GCT</h3>
            <input id="gctEditDate" type="date" value="${rowState.targetDate}" />
            <select id="gctEditSlot">${slotOptions}</select>
            <div class="gct-edit-actions">
                <button type="button" class="secondary-button" id="gctEditCancel">Anuluj</button>
                <button type="button" id="gctEditSave">Zapisz</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#gctEditCancel')?.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', event => {
        if (event.target === overlay) {
            overlay.remove();
        }
    });

    overlay.querySelector('#gctEditSave')?.addEventListener('click', async () => {
        const dateInput = overlay.querySelector('#gctEditDate') as HTMLInputElement | null;
        const slotInput = overlay.querySelector('#gctEditSlot') as HTMLSelectElement | null;
        if (!dateInput?.value || !slotInput?.value) {
            return;
        }

        try {
            await sendGctMessage('UPDATE_ROW_SLOT', {
                groupId,
                rowId,
                slot: { date: dateInput.value, startTime: slotInput.value },
            });
            overlay.remove();
        } catch (error) {
            consoleError('Update GCT row failed:', error);
        }
    });
}

function bindChildRowEvents(row: HTMLTableRowElement, rowState: GctWatchRow): void {
    const groupId = row.dataset.groupId;
    const rowId = row.dataset.rowId;
    if (!groupId || !rowId) return;

    row.querySelector('.remove-button')?.addEventListener('click', async () => {
        try {
            await sendGctMessage('REMOVE_ROW', { groupId, rowId });
        } catch (error) {
            consoleError('Remove GCT row failed:', error);
        }
    });

    row.querySelector('.pause-button')?.addEventListener('click', async () => {
        try {
            await sendGctMessage('PAUSE_ROW', { groupId, rowId });
        } catch (error) {
            consoleError('Pause GCT row failed:', error);
        }
    });

    row.querySelector('.resume-button')?.addEventListener('click', async () => {
        try {
            await sendGctMessage('RESUME_ROW', { groupId, rowId });
        } catch (error) {
            consoleError('Resume GCT row failed:', error);
        }
    });

    row.querySelector('.gct-slot-editable')?.addEventListener('click', () => {
        showRowEditModal(groupId, rowId, rowState);
    });
}

function renderGroups(state: GctState): void {
    const tableBody = byId<HTMLElement>('gctTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    if (state.groups.length === 0) {
        renderEmptyState(tableBody);
        return;
    }

    for (const group of state.groups) {
        const header = createGroupHeader(group);
        tableBody.appendChild(header);
        bindGroupEvents(header);

        for (const rowState of group.rows) {
            const row = createChildRow(group, rowState);
            tableBody.appendChild(row);
            bindChildRowEvents(row, rowState);
        }
    }
}

async function refreshState(): Promise<void> {
    try {
        const state = await sendGctMessage('GET_STATE');
        renderGroups(state);
    } catch (error) {
        consoleError('Refresh GCT state failed:', error);
    }
}

async function handleAdd(): Promise<void> {
    const documentInput = byId<HTMLInputElement>('gctDocumentInput');
    const vehicleInput = byId<HTMLInputElement>('gctVehicleInput');
    const containerInput = byId<HTMLInputElement>('gctContainerInput');
    const dateInput = byId<HTMLInputElement>('gctDateInput');
    const slotSelect = byId<HTMLSelectElement>('gctSlotSelect');

    if (!documentInput || !vehicleInput || !containerInput || !dateInput || !slotSelect) {
        return;
    }

    const documentNumber = documentInput.value.trim();
    const vehicleNumber = vehicleInput.value.trim().toUpperCase();
    const containerNumber = containerInput.value.trim().toUpperCase();
    const date = dateInput.value;
    const slots = getSelectedSlots(slotSelect);

    if (!documentNumber || !vehicleNumber || !containerNumber || !date || slots.length === 0) {
        return;
    }

    try {
        await sendGctMessage('ADD_GROUP', {
            group: {
                documentNumber,
                vehicleNumber,
                containerNumber,
                slots: slots.map(startTime => ({ date, startTime })),
            },
        });

        containerInput.value = '';
        slotSelect.selectedIndex = -1;
        updateSlotSummary();
    } catch (error) {
        consoleError('Add GCT group failed:', error);
    }
}

let gctUiInitialized = false;

export function initGctUI(): void {
    if (gctUiInitialized) {
        refreshState().catch(consoleError);
        return;
    }

    gctUiInitialized = true;

    const view = byId<HTMLElement>('gctView');
    if (!view) {
        return;
    }

    view.innerHTML = buildControlsMarkup();

    const dateInput = byId<HTMLInputElement>('gctDateInput');
    if (dateInput) {
        dateInput.value = nowLocalDate();
    }

    byId<HTMLButtonElement>('gctAddButton')?.addEventListener('click', () => {
        handleAdd().catch(consoleError);
    });

    byId<HTMLSelectElement>('gctSlotSelect')?.addEventListener('change', updateSlotSummary);

    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') return;
        if (changes.gctGroups || changes.gctSettings || changes.gctLastTickAt) {
            refreshState().catch(consoleError);
        }
    });

    refreshState().catch(consoleError);
}
