# PUSTE Status Feature Specification

## Overview

This document describes the implementation of support for containers with **PUSTE** status in the Baltichub table. When a container has PUSTE status, the slot search must use a different API payload (`type: 4` instead of `type: 1`). Additionally, UI improvements for the popup and visual indicators are planned.

---

## 1. Business Logic: PUSTE Status

### 1.1 Current Flow

```
User submits booking form → Error/Success → processCachedRequest
  → createRetryObject (uses tableData for currentSlot, containerNumber)
  → addToQueue
  → QueueManager: getSlots(date) with body: { date, type: 1 }
  → checkSlotAvailability → executeRequest
```

### 1.2 New Flow with PUSTE

When the **Status** column in the Baltichub table contains `PUSTE` (case-insensitive) for the container row:

- **getSlots** payload changes: `type: 1` → `type: 4`
- Example: `{"date":"2026-02-25T23:00:00.000Z","type":4}`

### 1.3 Data Model Changes

| Location | Change |
|----------|--------|
| `RetryObject` (types/baltichub.ts) | Add optional `slotType?: number` (1 = default, 4 = PUSTE) |
| `MessageHandler.createRetryObject` | Read Status from table, set `slotType: 4` when Status is PUSTE |
| `getSlots` (baltichub.ts) | Accept optional `slotType` param, default 1 |
| `QueueManager` | Group by `(date, slotType)` and pass slotType to getSlots |

### 1.4 Table Structure (Baltichub #Grid)

From `TABLE_DATA_NAMES` in data.ts:

| Column | Key | Example |
|--------|-----|---------|
| Status | `Status` | PUSTE, puste, Awizacja, etc. |
| ID | `ID` | tv-app-id |
| Wybrana data | `SELECTED_DATE` | 25.02.2026 |
| Start | `START` | 22:00 |
| Koniec | `END` | 22:59 |
| Nr kontenera | `CONTAINER_NUMBER` | MSNU2991953 |
| Akcje | `ACTIONS` | buttons |

**Status check:** `row[statusIndex].toUpperCase().trim() === 'PUSTE'`

---

## 2. Implementation Plan

### 2.1 Phase 1: Backend Logic

#### 2.1.1 MessageHandler.createRetryObject

```typescript
// After finding tableRow, before closing if (tableRow) block:
const statusIndex = tableData[0].indexOf(TABLE_DATA_NAMES.STATUS);
if (statusIndex >= 0 && tableRow[statusIndex]) {
    const statusValue = String(tableRow[statusIndex]).toUpperCase().trim();
    if (statusValue === 'PUSTE') {
        retryObject.slotType = 4;
    }
}
// Default: slotType = 1 (or omit, use default in getSlots)
```

#### 2.1.2 baltichub.getSlots

```typescript
export async function getSlots(date: string, slotType: number = 1): Promise<Response | ErrorResponse> {
    // ...
    body: JSON.stringify({ date: dateAfterTransfer, type: slotType }),
    // ...
}
```

#### 2.1.3 QueueManager

- **createDateSubscriptions** → **createDateSlotTypeSubscriptions**
  - Group key: `${date}|${req.slotType ?? 1}`
  - Map<string, RetryObject[]> where key = "date|slotType"

- **processSlotsCycle** loop:
  - For each `(date, slotType)` group:
    - `slots = await getSlots(date, slotType)`
    - `processDateGroup(date, requests, slots, queue)`

---

### 2.2 Phase 2: UI Indicator (Popup)

#### 2.2.1 Container Column Header Indicator

- **Location:** Header cell of container column (Nr kontenera) in popup table
- **When:** At least one item in the group has `slotType === 4` (PUSTE)
- **Visual:** Small badge/tooltip, e.g.:
  - Icon (e.g. `inventory_2` or `label`) with title "PUSTE - wyszukiwanie slotów typu 4"
  - Or text badge "PUSTE" next to container number in group header

**Popup table structure (current):**

| Toggle | Status | Driver | Container | Actions |
|--------|--------|--------|-----------|---------|
| ▼      | ▶️     | Jan K. | MSNU123   | ▶ ⏸ 🗑 |

**Proposed for PUSTE group:**

| Toggle | Status | Driver | Container (PUSTE) | Actions |
|--------|--------|--------|-------------------|---------|
| ▼      | ▶️     | Jan K. | MSNU123 [PUSTE]   | ▶ ⏸ 🗑 |

- Add `slotType` to `RetryObject` → available in popup
- In `updateQueueDisplay`, when rendering group header for container:
  - If `items.some(i => i.slotType === 4)` → show indicator (icon or badge)

#### 2.2.2 Popup Width Increase

| Element | Current | Proposed |
|---------|---------|----------|
| `--app-width` | 440px | 520px (or 500px) |
| `--modal-width` | 420px | 500px |
| Actions column | 130px (fixed) | **Keep 130px** (no change) |

**CSS changes (popup.css):**

```css
:root {
    --app-width: 520px;   /* was 440px */
    --modal-width: 500px; /* was 420px */
}

td.group-header.actions {
    width: 130px !important; /* unchanged */
}
```

---

## 3. Edge Cases & E2E Analysis

### 3.1 Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| 1 | Status = "PUSTE" (exact) | slotType = 4 |
| 2 | Status = "puste" (lowercase) | slotType = 4 |
| 3 | Status = "Puste" (mixed) | slotType = 4 |
| 4 | Status = " PUSTE " (whitespace) | slotType = 4 (after trim) |
| 5 | Status = "PUSTE" (with extra chars) | No match - treat as type 1 |
| 6 | Status column missing in table | slotType = 1 (default) |
| 7 | Status = "" or undefined | slotType = 1 |
| 8 | Mixed group: same date, some PUSTE some not | Two getSlots calls: one type 1, one type 4 |
| 9 | tableData not found (no table parsed) | slotType = 1, no Status from table |
| 10 | tableRow not found (container not in table) | slotType = 1, use getDriverNameAndContainer only |
| 11 | Existing items in queue without slotType | Treat as slotType = 1 (backward compat) |
| 12 | Popup: group with mixed slotTypes (1 and 4) | Show PUSTE indicator if any has slotType 4 |

### 3.2 E2E Flow Analysis

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. CONTENT SCRIPT (ebrama page)                                             │
│    - waitElementAndSendChromeMessage('#Grid table', PARSED_TABLE, parseTable)│
│    - parseTable() returns [["Status","ID",...], ["PUSTE","tv-123",...], ...] │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. MESSAGE HANDLER (background)                                              │
│    - handleTableParsing: setStorage({ tableData })                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ (User gets error/success, clicks)
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. processCachedRequest                                                     │
│    - getStorage(['tableData', ...])                                          │
│    - createRetryObject:                                                      │
│      • Find tableRow by containerNumber or tvAppId                           │
│      • Read Status from tableRow[statusIndex]                               │
│      • if Status.toUpperCase().trim() === 'PUSTE' → retryObject.slotType = 4│
│      • else → retryObject.slotType = 1 (or omit)                            │
│    - addToQueue(retryObject)                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. QUEUE MANAGER                                                             │
│    - createDateSlotTypeSubscriptions:                                        │
│      • key = `${date}|${slotType}`                                           │
│      • e.g. "25.02.2026|1" and "25.02.2026|4"                                │
│    - For each (date, slotType):                                              │
│      • getSlots(date, slotType) → body: { date, type: slotType }             │
│      • processDateGroup(date, requests, slotsText)                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. POPUP                                                                    │
│    - updateQueueDisplay: render groups                                       │
│    - Container column: if items.some(i => i.slotType === 4) → show badge    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Migration / Backward Compatibility

- **Existing queue items:** No `slotType` field → treat as 1.
- **Storage:** No migration needed for tableData; it already contains Status.
- **Tests:** Update MessageHandler tests for createRetryObject with PUSTE; add queueManager tests for slotType grouping.

---

## 4. Files to Modify

| File | Changes |
|------|---------|
| `src/types/baltichub.ts` | Add `slotType?: number` to RetryObject |
| `src/data.ts` | (Already has TABLE_DATA_NAMES.STATUS) |
| `src/background/handlers/MessageHandler.ts` | createRetryObject: read Status, set slotType |
| `src/services/baltichub.ts` | getSlots(date, slotType = 1) |
| `src/services/queueManager.ts` | createDateSlotTypeSubscriptions, pass slotType to getSlots |
| `src/popup/popup.ts` | Container header: show PUSTE indicator when slotType === 4 |
| `src/popup/popup.css` | --app-width: 520px, --modal-width: 500px; keep actions column 130px |
| `tests/unit/...` | Update/create tests for new logic |

---

## 5. Open Questions

1. **API behavior:** Does GetSlotsForPreview return different slot availability for type 1 vs 4? (Assumed yes.)
2. **PUSTE variants:** Are there other status values that should use type 4? (Only PUSTE for now.)
3. **UI copy:** Exact wording for PUSTE indicator tooltip? (Polish: "PUSTE - wyszukiwanie slotów typu 4"?)

---

## 6. Testing Checklist

- [ ] Unit: createRetryObject with Status=PUSTE → slotType 4
- [ ] Unit: createRetryObject with Status=other → slotType 1
- [ ] Unit: createRetryObject with no Status column → slotType 1
- [ ] Unit: getSlots called with slotType 4
- [ ] Unit: QueueManager groups by (date, slotType)
- [ ] E2E: Add PUSTE container → verify getSlots uses type 4
- [ ] E2E: Popup shows PUSTE indicator for PUSTE groups
- [ ] E2E: Popup width increased, actions column unchanged
