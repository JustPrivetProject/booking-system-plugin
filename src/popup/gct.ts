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
const GCT_DOCUMENT_NUMBER_LENGTH = 9;
const GCT_VEHICLE_NUMBER_LENGTH = 8;
const GCT_CONTAINER_NUMBER_LENGTH = 11;
const GCT_PICKER_MONTHS_PL = [
    'Styczeń',
    'Luty',
    'Marzec',
    'Kwiecień',
    'Maj',
    'Czerwiec',
    'Lipiec',
    'Sierpień',
    'Wrzesień',
    'Październik',
    'Listopad',
    'Grudzień',
] as const;
const GCT_PICKER_DAYS_PL = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'] as const;

type GctPickerDateKey = 'today' | 'tomorrow' | 'other';

interface GctPickerSelectionEntry {
    date: string;
    slots: GctAllowedStartTime[];
}

interface GctPickerSelection {
    date: string | null;
    slots: GctAllowedStartTime[];
    selections: GctPickerSelectionEntry[];
}

interface GctPickerApi {
    onchange: ((selection: GctPickerSelection) => void) | null;
    getSelection(): GctPickerSelection;
    reset(): void;
}

interface GctPickerWindow extends Window {
    godzinaPicker?: GctPickerApi;
}

let gctTimePicker: GctPickerApi | null = null;

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

function formatIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseIsoDate(date: string): Date {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
}

function addDays(date: string, days: number): string {
    const nextDate = parseIsoDate(date);
    nextDate.setDate(nextDate.getDate() + days);
    return formatIsoDate(nextDate);
}

function getWarsawNowParts(): { date: string; hours: number; minutes: number } {
    const formatter = new Intl.DateTimeFormat('sv-SE', {
        timeZone: GCT_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const read = (type: Intl.DateTimeFormatPartTypes): string =>
        parts.find(part => part.type === type)?.value || '00';

    return {
        date: `${read('year')}-${read('month')}-${read('day')}`,
        hours: Number(read('hour')),
        minutes: Number(read('minute')),
    };
}

function formatPickerSubDate(date: string): string {
    return parseIsoDate(date).toLocaleDateString('pl-PL', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
    });
}

function formatPickerShortDate(date: string): string {
    return parseIsoDate(date).toLocaleDateString('pl-PL', {
        day: 'numeric',
        month: 'short',
    });
}

function getSlotEndTime(startTime: GctAllowedStartTime): string {
    const [hours, minutes] = startTime.split(':').map(Number);
    const endHours = String((hours + 2) % 24).padStart(2, '0');
    return `${endHours}:${String(minutes).padStart(2, '0')}`;
}

function pluralizeSlotLabel(count: number): string {
    if (count === 1) {
        return 'slot';
    }

    const modulo10 = count % 10;
    const modulo100 = count % 100;
    if (modulo10 >= 2 && modulo10 <= 4 && (modulo100 < 12 || modulo100 > 14)) {
        return 'sloty';
    }

    return 'slotów';
}

function pluralizeDayLabel(count: number): string {
    if (count === 1) {
        return 'dzień';
    }

    return 'dni';
}

function getAvailablePickerSlots(date: string | null): GctAllowedStartTime[] {
    if (!date) {
        return [];
    }

    const nowParts = getWarsawNowParts();
    if (date !== nowParts.date) {
        return [...GCT_ALLOWED_START_TIMES];
    }

    const currentMinutes = nowParts.hours * 60 + nowParts.minutes;
    return GCT_ALLOWED_START_TIMES.filter(time => {
        const [hours, minutes] = time.split(':').map(Number);
        const slotStartMinutes = hours * 60 + minutes;
        const slotEndMinutes = slotStartMinutes + 120;
        return slotEndMinutes > currentMinutes;
    });
}

function buildControlsMarkup(): string {
    return `
        <div class="gct-controls">
            <div class="gct-controls-row">
                <input id="gctDocumentInput" class="gct-input gct-input-document" type="text" placeholder="Dokument kierowcy" maxlength="${GCT_DOCUMENT_NUMBER_LENGTH}" autocomplete="off" autocapitalize="characters" spellcheck="false" />
                <input id="gctVehicleInput" class="gct-input gct-input-vehicle" type="text" placeholder="Nr. pojazdu" maxlength="${GCT_VEHICLE_NUMBER_LENGTH}" autocomplete="off" autocapitalize="characters" spellcheck="false" />
                <input id="gctContainerInput" class="gct-input gct-input-container" type="text" placeholder="Nr kontenera" maxlength="${GCT_CONTAINER_NUMBER_LENGTH}" autocomplete="off" autocapitalize="characters" spellcheck="false" />
                <div id="gctTimePicker" class="gct-picker-host"></div>
                <button id="gctAddButton" type="button" class="secondary-button gct-add-button" disabled>Dodaj</button>
            </div>
        </div>
        <div class="queue-container gct-queue-container">
            <table id="gctTable">
                <tbody id="gctTableBody"></tbody>
            </table>
        </div>
    `;
}

function createGctTimePicker(host: HTMLElement): GctPickerApi {
    let selectedDateId: GctPickerDateKey = 'today';
    let selectedSlotsByDate: Record<string, GctAllowedStartTime[]> = {};
    let customDate: string | null = null;
    let calendarMonth = parseIsoDate(nowLocalDate()).getMonth();
    let calendarYear = parseIsoDate(nowLocalDate()).getFullYear();
    let isOpen = false;

    host.innerHTML = `
        <div class="gp-collapsed" data-r="c" tabindex="0" role="button" aria-haspopup="dialog" aria-expanded="false">
            <svg class="gp-collapsed-icon" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                <rect x="1" y="3" width="14" height="12" rx="2" stroke="currentColor" fill="none" stroke-width="1.2"></rect>
                <path d="M1 7h14M5 1v4M11 1v4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"></path>
            </svg>
            <span class="gp-collapsed-label" data-r="l">Godzina</span>
            <span class="gp-badge" data-r="b"></span>
        </div>
        <div class="gp-dropdown" data-r="dd">
            <div class="gp-body">
                <div class="gp-date-col" data-r="dc"></div>
                <div class="gp-slots-area">
                    <div class="gp-cal" data-r="cp"></div>
                    <div class="gp-slots-pane" data-r="sp">
                        <div class="gp-slots-header">
                            <span>Wybierz sloty (2h każdy)</span>
                            <button type="button" class="gp-clear-btn" data-r="cb">Wyczyść</button>
                        </div>
                        <div class="gp-slots-grid" data-r="sg"></div>
                    </div>
                    <div class="gp-no-slots" data-r="ns">Brak dostępnych slotów</div>
                </div>
            </div>
            <div class="gp-confirm" data-r="cf">
                <button type="button" class="gp-confirm-btn" data-r="cfb">Zatwierdź</button>
            </div>
        </div>
    `;

    const ref = <T extends HTMLElement>(selector: string): T =>
        host.querySelector(`[data-r="${selector}"]`) as T;

    const collapsed = ref<HTMLDivElement>('c');
    const label = ref<HTMLElement>('l');
    const badge = ref<HTMLElement>('b');
    const dropdown = ref<HTMLDivElement>('dd');
    const dateColumn = ref<HTMLDivElement>('dc');
    const calendar = ref<HTMLDivElement>('cp');
    const slotsPane = ref<HTMLDivElement>('sp');
    const slotsGrid = ref<HTMLDivElement>('sg');
    const clearButton = ref<HTMLButtonElement>('cb');
    const noSlots = ref<HTMLDivElement>('ns');
    const confirmBar = ref<HTMLDivElement>('cf');
    const confirmButton = ref<HTMLButtonElement>('cfb');

    const api: GctPickerApi = {
        onchange: null,
        getSelection(): GctPickerSelection {
            return {
                date: getActiveDate(),
                slots: [...getSelectedSlotsForDate(getActiveDate())],
                selections: getAllSelections(),
            };
        },
        reset(): void {
            selectedDateId = 'today';
            selectedSlotsByDate = {};
            customDate = null;
            const today = parseIsoDate(nowLocalDate());
            calendarMonth = today.getMonth();
            calendarYear = today.getFullYear();
            closeDropdown();
            renderAll();
        },
    };

    const fireChange = (): void => {
        api.onchange?.(api.getSelection());
    };

    const getActiveDate = (): string | null => {
        if (selectedDateId === 'today') return nowLocalDate();
        if (selectedDateId === 'tomorrow') return addDays(nowLocalDate(), 1);
        return customDate;
    };

    const getSelectedSlotsForDate = (date: string | null): GctAllowedStartTime[] => {
        if (!date) {
            return [];
        }

        return [...(selectedSlotsByDate[date] || [])].sort() as GctAllowedStartTime[];
    };

    const setSelectedSlotsForDate = (date: string | null, slots: GctAllowedStartTime[]): void => {
        if (!date) {
            return;
        }

        if (slots.length === 0) {
            delete selectedSlotsByDate[date];
            return;
        }

        selectedSlotsByDate = {
            ...selectedSlotsByDate,
            [date]: [...slots].sort() as GctAllowedStartTime[],
        };
    };

    const getAllSelections = (): GctPickerSelectionEntry[] =>
        Object.entries(selectedSlotsByDate)
            .filter(([, slots]) => slots.length > 0)
            .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
            .map(([date, slots]) => ({
                date,
                slots: [...slots].sort() as GctAllowedStartTime[],
            }));

    const getTotalSelectedSlots = (): number =>
        getAllSelections().reduce((total, entry) => total + entry.slots.length, 0);

    const openDropdown = (): void => {
        isOpen = true;
        dropdown.classList.add('visible');
        collapsed.classList.add('open');
        collapsed.setAttribute('aria-expanded', 'true');
        renderAll();
    };

    const closeDropdown = (): void => {
        isOpen = false;
        dropdown.classList.remove('visible');
        collapsed.classList.remove('open');
        collapsed.setAttribute('aria-expanded', 'false');
    };

    const updateField = (): void => {
        const activeDate = getActiveDate();
        const selections = getAllSelections();
        const totalSelectedSlots = getTotalSelectedSlots();
        const totalSelectedDays = selections.length;
        const hasSelection = totalSelectedSlots > 0;
        collapsed.classList.toggle('has-selection', hasSelection);

        if (!hasSelection) {
            label.textContent = 'Godzina';
            badge.textContent = '';
            return;
        }

        const today = nowLocalDate();
        const tomorrow = addDays(today, 1);
        if (totalSelectedDays === 1 && totalSelectedSlots === 1) {
            const selectedDate = selections[0]?.date;
            const selectedSlot = selections[0]?.slots[0] ?? '';

            if (selectedDate === today) {
                label.textContent = `Dziś ${selectedSlot}`;
            } else if (selectedDate === tomorrow) {
                label.textContent = `Jutro ${selectedSlot}`;
            } else if (selectedDate) {
                label.textContent = `${formatPickerShortDate(selectedDate)} ${selectedSlot}`;
            } else {
                label.textContent = selectedSlot || 'Godzina';
            }

            badge.textContent = '';
            return;
        }

        if (totalSelectedDays > 1) {
            label.textContent = `${totalSelectedDays} ${pluralizeDayLabel(totalSelectedDays)}`;
        } else if (selections[0]?.date === today) {
            label.textContent = 'Dziś';
        } else if (selections[0]?.date === tomorrow) {
            label.textContent = 'Jutro';
        } else if (selections[0]?.date) {
            label.textContent = formatPickerShortDate(selections[0].date);
        } else {
            label.textContent = activeDate ? formatPickerShortDate(activeDate) : 'Godzina';
        }

        badge.textContent =
            totalSelectedSlots === 1
                ? selections[0].slots[0]
                : `${totalSelectedSlots} ${pluralizeSlotLabel(totalSelectedSlots)}`;
    };

    const updateConfirm = (): void => {
        confirmBar.classList.toggle('visible', getTotalSelectedSlots() > 0);
        clearButton.classList.toggle(
            'visible',
            getSelectedSlotsForDate(getActiveDate()).length > 0,
        );
    };

    const renderSlots = (): void => {
        const activeDate = getActiveDate();
        calendar.classList.remove('visible');

        if (!activeDate) {
            slotsPane.style.display = 'none';
            noSlots.style.display = 'none';
            updateConfirm();
            return;
        }

        const availableSlots = getAvailablePickerSlots(activeDate);
        if (availableSlots.length === 0) {
            slotsPane.style.display = 'none';
            noSlots.style.display = 'block';
            updateConfirm();
            return;
        }

        noSlots.style.display = 'none';
        slotsPane.style.display = 'block';
        slotsGrid.innerHTML = '';
        const selectedSlots = getSelectedSlotsForDate(activeDate);

        for (const slot of availableSlots) {
            const selected = selectedSlots.includes(slot);
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `gp-slot-btn${selected ? ' selected' : ''}`;
            button.dataset.slotValue = slot;
            button.innerHTML = `${slot}<span class="gp-slot-range">– ${getSlotEndTime(slot)}</span>`;
            button.addEventListener('click', event => {
                event.stopPropagation();

                const currentSelectedSlots = getSelectedSlotsForDate(activeDate);
                let nextSelectedSlots: GctAllowedStartTime[];

                if (currentSelectedSlots.includes(slot)) {
                    nextSelectedSlots = currentSelectedSlots.filter(value => value !== slot);
                } else {
                    nextSelectedSlots = [
                        ...currentSelectedSlots,
                        slot,
                    ].sort() as GctAllowedStartTime[];
                }

                setSelectedSlotsForDate(activeDate, nextSelectedSlots);

                renderSlots();
                updateField();
                fireChange();
            });
            slotsGrid.appendChild(button);
        }

        updateConfirm();
    };

    const renderDateButtons = (): void => {
        const today = nowLocalDate();
        const tomorrow = addDays(today, 1);
        const items: Array<{ id: GctPickerDateKey; label: string; sub: string }> = [
            { id: 'today', label: 'Dziś', sub: formatPickerSubDate(today) },
            { id: 'tomorrow', label: 'Jutro', sub: formatPickerSubDate(tomorrow) },
            {
                id: 'other',
                label: 'Inny',
                sub: customDate ? formatPickerSubDate(customDate) : 'Kalendarz',
            },
        ];

        dateColumn.innerHTML = '';
        for (const item of items) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `gp-date-btn${selectedDateId === item.id ? ' active' : ''}`;
            button.innerHTML = `${item.label}<span class="gp-sub">${item.sub}</span>`;
            button.addEventListener('click', event => {
                event.stopPropagation();
                selectedDateId = item.id;

                if (item.id === 'other') {
                    showCalendar();
                } else {
                    calendar.classList.remove('visible');
                    renderSlots();
                }

                renderDateButtons();
                updateField();
                fireChange();
            });
            dateColumn.appendChild(button);
        }
    };

    const renderCalendar = (): void => {
        let html =
            `<div class="gp-cal-nav">` +
            `<button type="button" data-calendar-nav="prev">&lt;</button>` +
            `<span>${GCT_PICKER_MONTHS_PL[calendarMonth]} ${calendarYear}</span>` +
            `<button type="button" data-calendar-nav="next">&gt;</button>` +
            `</div><div class="gp-cal-grid">`;

        for (const dayName of GCT_PICKER_DAYS_PL) {
            html += `<div class="gp-cal-hdr">${dayName}</div>`;
        }

        const firstDay = new Date(calendarYear, calendarMonth, 1);
        let startDay = firstDay.getDay() - 1;
        if (startDay < 0) {
            startDay = 6;
        }

        for (let index = 0; index < startDay; index += 1) {
            html += '<div class="gp-cal-day empty"></div>';
        }

        const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
        const today = parseIsoDate(nowLocalDate());
        today.setHours(0, 0, 0, 0);

        for (let day = 1; day <= daysInMonth; day += 1) {
            const currentDate = new Date(calendarYear, calendarMonth, day, 12, 0, 0, 0);
            currentDate.setHours(0, 0, 0, 0);
            const isoDate = formatIsoDate(currentDate);
            const isPast = currentDate.getTime() < today.getTime();
            const isSelected = customDate === isoDate;
            html +=
                `<button type="button" class="gp-cal-day${isPast ? ' disabled' : ''}${isSelected ? ' selected' : ''}"` +
                ` data-calendar-day="${day}">${day}</button>`;
        }

        html += '</div>';
        calendar.innerHTML = html;

        calendar.querySelector('[data-calendar-nav="prev"]')?.addEventListener('click', event => {
            event.stopPropagation();
            calendarMonth -= 1;
            if (calendarMonth < 0) {
                calendarMonth = 11;
                calendarYear -= 1;
            }
            renderCalendar();
        });

        calendar.querySelector('[data-calendar-nav="next"]')?.addEventListener('click', event => {
            event.stopPropagation();
            calendarMonth += 1;
            if (calendarMonth > 11) {
                calendarMonth = 0;
                calendarYear += 1;
            }
            renderCalendar();
        });

        calendar
            .querySelectorAll<HTMLButtonElement>('.gp-cal-day:not(.disabled):not(.empty)')
            .forEach(button => {
                button.addEventListener('click', event => {
                    event.stopPropagation();
                    customDate = formatIsoDate(
                        new Date(
                            calendarYear,
                            calendarMonth,
                            Number(button.dataset.calendarDay),
                            12,
                            0,
                            0,
                            0,
                        ),
                    );
                    calendar.classList.remove('visible');
                    renderSlots();
                    renderDateButtons();
                    updateField();
                    fireChange();
                });
            });
    };

    const showCalendar = (): void => {
        const calendarDate = customDate ? parseIsoDate(customDate) : parseIsoDate(nowLocalDate());
        calendarMonth = calendarDate.getMonth();
        calendarYear = calendarDate.getFullYear();
        calendar.classList.add('visible');
        slotsPane.style.display = 'none';
        noSlots.style.display = 'none';
        confirmBar.classList.remove('visible');
        renderCalendar();
    };

    const renderAll = (): void => {
        renderDateButtons();
        if (selectedDateId === 'other' && !customDate) {
            showCalendar();
        } else if (
            selectedDateId === 'other' &&
            customDate &&
            calendar.classList.contains('visible')
        ) {
            renderCalendar();
        } else {
            renderSlots();
        }
        updateField();
    };

    collapsed.addEventListener('click', event => {
        event.stopPropagation();
        if (isOpen) {
            closeDropdown();
        } else {
            openDropdown();
        }
    });

    collapsed.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        if (isOpen) {
            closeDropdown();
        } else {
            openDropdown();
        }
    });

    clearButton.addEventListener('click', event => {
        event.stopPropagation();
        setSelectedSlotsForDate(getActiveDate(), []);
        renderSlots();
        updateField();
        fireChange();
    });

    confirmButton.addEventListener('click', event => {
        event.stopPropagation();
        closeDropdown();
    });

    document.addEventListener('click', event => {
        if (isOpen && !host.contains(event.target as Node)) {
            closeDropdown();
        }
    });

    renderAll();
    (window as GctPickerWindow).godzinaPicker = api;
    return api;
}

function normalizeCompactUppercaseValue(value: string): string {
    return value.replace(/\s+/g, '').toUpperCase();
}

function hasValidGctAddInputs(): boolean {
    const documentInput = byId<HTMLInputElement>('gctDocumentInput');
    const vehicleInput = byId<HTMLInputElement>('gctVehicleInput');
    const containerInput = byId<HTMLInputElement>('gctContainerInput');

    if (!documentInput || !vehicleInput || !containerInput || !gctTimePicker) {
        return false;
    }

    const selection = gctTimePicker.getSelection();
    const totalSlots = selection.selections.reduce((sum, entry) => sum + entry.slots.length, 0);

    return (
        documentInput.value.trim().length > 0 &&
        vehicleInput.value.trim().length > 0 &&
        containerInput.value.trim().length > 0 &&
        totalSlots > 0
    );
}

function updateAddButtonState(): void {
    const addButton = byId<HTMLButtonElement>('gctAddButton');
    if (!addButton) {
        return;
    }

    addButton.disabled = !hasValidGctAddInputs();
}

function renderEmptyState(body: HTMLElement): void {
    body.innerHTML = '';
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
            <div class="gct-group-actions">
                <button class="group-resume-button resume-button" title="Wznów grupę" ${group.status === 'watching' || group.status === 'success' ? 'disabled' : ''}>
                    <span class="material-icons icon">play_arrow</span>
                </button>
                <button class="group-pause-button pause-button" title="Wstrzymaj grupę" ${group.status !== 'watching' ? 'disabled' : ''}>
                    <span class="material-icons icon">pause</span>
                </button>
                <button class="group-remove-button remove-button" title="Usuń grupę">
                    <span class="material-icons icon">delete</span>
                </button>
            </div>
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

    overlay.innerHTML = `
        <div class="gct-edit-dialog">
            <h3>Edytuj slot GCT</h3>
            <input id="gctEditDate" type="date" value="${rowState.targetDate}" min="${nowLocalDate()}" />
            <select id="gctEditSlot"></select>
            <div class="gct-edit-actions">
                <button type="button" class="secondary-button" id="gctEditCancel">Anuluj</button>
                <button type="button" id="gctEditSave">Zapisz</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const dateInput = overlay.querySelector('#gctEditDate') as HTMLInputElement | null;
    const slotInput = overlay.querySelector('#gctEditSlot') as HTMLSelectElement | null;
    const saveButton = overlay.querySelector('#gctEditSave') as HTMLButtonElement | null;

    const renderSlotOptions = (date: string, preferredSlot: string | null = null): void => {
        if (!slotInput || !saveButton) {
            return;
        }

        const availableSlots = getAvailablePickerSlots(date);
        if (availableSlots.length === 0) {
            slotInput.innerHTML = '<option value="">Brak dostępnych slotów</option>';
            slotInput.disabled = true;
            saveButton.disabled = true;
            return;
        }

        const selectedSlot =
            preferredSlot && (availableSlots as string[]).includes(preferredSlot)
                ? preferredSlot
                : availableSlots[0];

        slotInput.innerHTML = availableSlots
            .map(time => `<option value="${time}">${time}</option>`)
            .join('');
        slotInput.value = selectedSlot;
        slotInput.disabled = false;
        saveButton.disabled = false;
    };

    if (dateInput) {
        renderSlotOptions(dateInput.value, rowState.targetStartTime);
        dateInput.addEventListener('change', () => {
            if (!dateInput.value) {
                return;
            }
            renderSlotOptions(dateInput.value);
        });
    }

    overlay.querySelector('#gctEditCancel')?.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', event => {
        if (event.target === overlay) {
            overlay.remove();
        }
    });

    overlay.querySelector('#gctEditSave')?.addEventListener('click', async () => {
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

    if (!documentInput || !vehicleInput || !containerInput || !gctTimePicker) {
        return;
    }

    const documentNumber = documentInput.value.trim();
    const vehicleNumber = vehicleInput.value.trim().toUpperCase();
    const containerNumber = containerInput.value.trim().toUpperCase();
    const selection = gctTimePicker.getSelection();
    const slots = selection.selections.flatMap(entry =>
        entry.slots.map(startTime => ({
            date: entry.date,
            startTime,
        })),
    );

    if (!documentNumber || !vehicleNumber || !containerNumber || slots.length === 0) {
        return;
    }

    try {
        await sendGctMessage('ADD_GROUP', {
            group: {
                documentNumber,
                vehicleNumber,
                containerNumber,
                slots,
            },
        });

        containerInput.value = '';
        gctTimePicker.reset();
        updateAddButtonState();
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

    const timePickerHost = byId<HTMLElement>('gctTimePicker');
    if (timePickerHost) {
        gctTimePicker = createGctTimePicker(timePickerHost);
        gctTimePicker.onchange = () => {
            updateAddButtonState();
        };
    }

    const bindNormalizedInput = (id: string): void => {
        byId<HTMLInputElement>(id)?.addEventListener('input', event => {
            const input = event.currentTarget as HTMLInputElement;
            input.value = normalizeCompactUppercaseValue(input.value);
            updateAddButtonState();
        });
    };

    bindNormalizedInput('gctDocumentInput');
    bindNormalizedInput('gctVehicleInput');
    bindNormalizedInput('gctContainerInput');

    byId<HTMLButtonElement>('gctAddButton')?.addEventListener('click', () => {
        handleAdd().catch(consoleError);
    });

    updateAddButtonState();

    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') return;
        if (changes.gctGroups || changes.gctSettings || changes.gctLastTickAt) {
            refreshState().catch(consoleError);
        }
    });

    refreshState().catch(consoleError);
}
