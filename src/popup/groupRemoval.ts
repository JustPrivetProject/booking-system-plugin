type GroupRemovalDependencies = {
    confirmRemoval: () => Promise<boolean>;
    removeRequests: (ids: string[]) => Promise<void>;
    deleteGroupState: (groupId: string) => Promise<void>;
};

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

export async function removeBookingGroup(
    removeButton: HTMLButtonElement,
    tableBody: HTMLElement,
    { confirmRemoval, removeRequests, deleteGroupState }: GroupRemovalDependencies,
): Promise<void> {
    const groupHeaderRow = removeButton.closest('.group-row') as HTMLElement | null;
    if (!groupHeaderRow) {
        return;
    }

    const groupId = groupHeaderRow.dataset.groupId || null;
    const idsToDelete = getGroupChildRows(groupHeaderRow)
        .map(row => row.getAttribute('data-id'))
        .filter((id): id is string => Boolean(id));

    const confirmed = await confirmRemoval();
    if (!confirmed) {
        return;
    }

    await removeRequests(idsToDelete);

    idsToDelete.forEach(id => {
        const row = tableBody.querySelector(`.remove-button[data-id="${id}"]`)?.closest('tr');
        if (row) {
            row.remove();
        }
    });

    groupHeaderRow.remove();

    if (groupId) {
        await deleteGroupState(groupId);
    }
}
