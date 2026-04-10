import { removeBookingGroup } from '../../../src/popup/groupRemoval';

describe('removeBookingGroup', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <table>
                <tbody id="queueTableBody">
                    <tr class="group-row" data-group-id="group-1">
                        <td>
                            <button class="group-remove-button remove-button" title="Usuń grupę">
                                Usuń
                            </button>
                        </td>
                    </tr>
                    <tr data-id="req-1">
                        <td>
                            <button class="remove-button" data-id="req-1">Usuń</button>
                        </td>
                    </tr>
                    <tr data-id="req-2">
                        <td>
                            <button class="remove-button" data-id="req-2">Usuń</button>
                        </td>
                    </tr>
                    <tr class="group-row" data-group-id="group-2">
                        <td>another group</td>
                    </tr>
                </tbody>
            </table>
        `;
    });

    it('removes the confirmed group rows and persisted state', async () => {
        const confirmRemoval = jest.fn().mockResolvedValue(true);
        const removeRequests = jest.fn().mockResolvedValue(undefined);
        const deleteGroupState = jest.fn().mockResolvedValue(undefined);
        const tableBody = document.getElementById('queueTableBody') as HTMLElement;
        const removeButton = tableBody.querySelector(
            '.group-row .group-remove-button',
        ) as HTMLButtonElement;

        await removeBookingGroup(removeButton, tableBody, {
            confirmRemoval,
            removeRequests,
            deleteGroupState,
        });

        expect(confirmRemoval).toHaveBeenCalledTimes(1);
        expect(removeRequests).toHaveBeenCalledWith(['req-1', 'req-2']);
        expect(deleteGroupState).toHaveBeenCalledWith('group-1');
        expect(tableBody.querySelector('[data-group-id="group-1"]')).toBeNull();
        expect(tableBody.querySelector('[data-id="req-1"]')).toBeNull();
        expect(tableBody.querySelector('[data-id="req-2"]')).toBeNull();
        expect(tableBody.querySelector('[data-group-id="group-2"]')).not.toBeNull();
    });

    it('does nothing when the modal is cancelled', async () => {
        const confirmRemoval = jest.fn().mockResolvedValue(false);
        const removeRequests = jest.fn().mockResolvedValue(undefined);
        const deleteGroupState = jest.fn().mockResolvedValue(undefined);
        const tableBody = document.getElementById('queueTableBody') as HTMLElement;
        const removeButton = tableBody.querySelector(
            '.group-row .group-remove-button',
        ) as HTMLButtonElement;

        await removeBookingGroup(removeButton, tableBody, {
            confirmRemoval,
            removeRequests,
            deleteGroupState,
        });

        expect(removeRequests).not.toHaveBeenCalled();
        expect(deleteGroupState).not.toHaveBeenCalled();
        expect(tableBody.querySelector('[data-group-id="group-1"]')).not.toBeNull();
        expect(tableBody.querySelector('[data-id="req-1"]')).not.toBeNull();
        expect(tableBody.querySelector('[data-id="req-2"]')).not.toBeNull();
    });
});
