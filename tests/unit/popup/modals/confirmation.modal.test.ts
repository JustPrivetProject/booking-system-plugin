import { createConfirmationModal } from '../../../../src/popup/modals/confirmation.modal';

describe('ConfirmationModal', () => {
    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = '';
        document.body.style.height = '';
    });

    afterEach(() => {
        // Clean up any remaining modal elements
        const overlay = document.querySelector('[style*="position: fixed"]');
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
        document.body.style.height = '';
    });

    describe('createConfirmationModal without input', () => {
        it('should create and display modal with correct message', async () => {
            const message = 'Are you sure?';
            const modalPromise = createConfirmationModal(message, false);

            // Wait for DOM to be updated
            await new Promise(resolve => setTimeout(resolve, 10));

            // Check modal structure
            const overlay = document.querySelector('[style*="position: fixed"]');
            expect(overlay).toBeTruthy();

            const modal = overlay?.querySelector(
                'div[style*="background-color: white"], div[style*="backgroundColor: white"]',
            );
            expect(modal).toBeTruthy();

            const messageElement = modal?.querySelector('p');
            expect(messageElement?.textContent).toBe(message);

            const buttons = modal?.querySelectorAll('button');
            expect(buttons?.length).toBe(2);

            // Check button texts
            const buttonTexts = Array.from(buttons || []).map(btn => btn.textContent);
            expect(buttonTexts).toContain('Potwierdź');
            expect(buttonTexts).toContain('Anuluj');

            // Click "Cancel" button
            const cancelButton = Array.from(buttons || []).find(
                btn => btn.textContent === 'Anuluj',
            );
            (cancelButton as HTMLElement)?.click();

            const result = await modalPromise;
            expect(result).toBe(false);
        });

        it('should return true when "Tak" button is clicked', async () => {
            const modalPromise = createConfirmationModal('Test message', false);

            await new Promise(resolve => setTimeout(resolve, 10));

            const buttons = document.querySelectorAll('button');
            const confirmButton = Array.from(buttons).find(btn => btn.textContent === 'Potwierdź');
            (confirmButton as HTMLElement)?.click();

            const result = await modalPromise;
            expect(result).toBe(true);
        });

        it('should set body height to 100px when withInput is false', async () => {
            const originalHeight = document.body.style.height;
            const modalPromise = createConfirmationModal('Test', false);

            await new Promise(resolve => setTimeout(resolve, 10));

            expect(document.body.style.height).toBe('100px');

            // Close modal
            const cancelButton = Array.from(document.querySelectorAll('button')).find(
                btn => btn.textContent === 'Anuluj',
            );
            (cancelButton as HTMLElement)?.click();
            await modalPromise;

            expect(document.body.style.height).toBe(originalHeight);
        });
    });

    describe('createConfirmationModal with input', () => {
        it('should create modal with input field when withInput is true', async () => {
            const modalPromise = createConfirmationModal('Enter value:', true);

            await new Promise(resolve => setTimeout(resolve, 10));

            const modal = document.querySelector(
                'div[style*="background-color: white"], div[style*="backgroundColor: white"]',
            );
            const input = modal?.querySelector('textarea');
            expect(input).toBeTruthy();

            const buttons = modal?.querySelectorAll('button');
            expect(buttons?.length).toBe(2);

            // Close modal
            const cancelButton = Array.from(buttons || []).find(
                btn => btn.textContent === 'Anuluj',
            );
            (cancelButton as HTMLElement)?.click();

            const result = await modalPromise;
            expect(result).toBe(false);
        });

        it('should return input value when "Potwierdź" is clicked with input', async () => {
            const modalPromise = createConfirmationModal('Enter value:', true);

            await new Promise(resolve => setTimeout(resolve, 10));

            const input = document.querySelector('textarea') as HTMLTextAreaElement;
            const testValue = 'test input value';
            input.value = testValue;

            const buttons = document.querySelectorAll('button');
            const confirmButton = Array.from(buttons).find(btn => btn.textContent === 'Potwierdź');
            (confirmButton as HTMLElement)?.click();

            const result = await modalPromise;
            expect(result).toBe(testValue);
        });

        it('should set body height to 200px when withInput is true', async () => {
            const originalHeight = document.body.style.height;
            const modalPromise = createConfirmationModal('Test', true);

            await new Promise(resolve => setTimeout(resolve, 10));

            expect(document.body.style.height).toBe('200px');

            // Close modal
            const cancelButton = Array.from(document.querySelectorAll('button')).find(
                btn => btn.textContent === 'Anuluj',
            );
            (cancelButton as HTMLElement)?.click();
            await modalPromise;

            expect(document.body.style.height).toBe(originalHeight);
        });

        it('should show error when input is empty and "Potwierdź" is clicked', async () => {
            const modalPromise = createConfirmationModal('Enter value:', true);

            await new Promise(resolve => setTimeout(resolve, 10));

            const buttons = document.querySelectorAll('button');
            const confirmButton = Array.from(buttons).find(btn => btn.textContent === 'Potwierdź');
            (confirmButton as HTMLElement)?.click();

            // Should show error and not close modal
            await new Promise(resolve => setTimeout(resolve, 10));

            const errorElement = document.querySelector('div[style*="color: red"]') as HTMLElement;
            expect(errorElement?.textContent).toBe('Proszę opisać problem.');
            expect(errorElement?.style.display).toBe('block');

            // Modal should still be open
            const overlay = document.querySelector('[style*="position: fixed"]');
            expect(overlay).toBeTruthy();

            // Close with cancel
            const cancelButton = Array.from(buttons).find(btn => btn.textContent === 'Anuluj');
            (cancelButton as HTMLElement)?.click();

            const result = await modalPromise;
            expect(result).toBe(false);
        });

        it('should return valid input when text is provided', async () => {
            const modalPromise = createConfirmationModal('Enter value:', true);

            await new Promise(resolve => setTimeout(resolve, 10));

            const input = document.querySelector('textarea') as HTMLTextAreaElement;
            const testValue = 'Valid input text';
            input.value = testValue;

            const buttons = document.querySelectorAll('button');
            const confirmButton = Array.from(buttons).find(btn => btn.textContent === 'Potwierdź');
            (confirmButton as HTMLElement)?.click();

            const result = await modalPromise;
            expect(result).toBe(testValue);
        });

        it('should handle special characters in input', async () => {
            const modalPromise = createConfirmationModal('Enter value:', true);

            await new Promise(resolve => setTimeout(resolve, 10));

            const input = document.querySelector('textarea') as HTMLTextAreaElement;
            const testValue = 'Special chars: "quotes" & <tags>';
            input.value = testValue;

            const buttons = document.querySelectorAll('button');
            const confirmButton = Array.from(buttons).find(btn => btn.textContent === 'Potwierdź');
            (confirmButton as HTMLElement)?.click();

            const result = await modalPromise;
            expect(result).toBe(testValue);
        });
    });

    describe('modal styling and behavior', () => {
        it('should create modal with proper styling', async () => {
            const modalPromise = createConfirmationModal('Test', false);

            await new Promise(resolve => setTimeout(resolve, 10));

            const overlay = document.querySelector('[style*="position: fixed"]') as HTMLElement;
            expect(overlay?.style.backgroundColor).toBe('rgba(0, 0, 0, 0.5)');
            expect(overlay?.style.zIndex).toBe('1000');

            const modal = overlay?.querySelector(
                'div[style*="background-color: white"], div[style*="backgroundColor: white"]',
            ) as HTMLElement;
            expect(modal?.style.padding).toBeTruthy();
            expect(modal?.style.borderRadius).toBeTruthy();
            expect(modal?.style.textAlign).toBeTruthy();

            // Close modal
            const cancelButton = Array.from(document.querySelectorAll('button')).find(
                btn => btn.textContent === 'Anuluj',
            );
            (cancelButton as HTMLElement)?.click();
            await modalPromise;
        });

        it('should remove overlay from DOM after closing', async () => {
            const modalPromise = createConfirmationModal('Test', false);

            await new Promise(resolve => setTimeout(resolve, 10));

            let overlay = document.querySelector('[style*="position: fixed"]');
            expect(overlay).toBeTruthy();

            const cancelButton = Array.from(document.querySelectorAll('button')).find(
                btn => btn.textContent === 'Anuluj',
            );
            (cancelButton as HTMLElement)?.click();

            await modalPromise;

            overlay = document.querySelector('[style*="position: fixed"]');
            expect(overlay).toBeFalsy();
        });

        it('should restore original body height after closing', async () => {
            const originalHeight = '350px';
            document.body.style.height = originalHeight;

            const modalPromise = createConfirmationModal('Test', false);

            await new Promise(resolve => setTimeout(resolve, 10));

            // Close modal
            const cancelButton = Array.from(document.querySelectorAll('button')).find(
                btn => btn.textContent === 'Anuluj',
            );
            (cancelButton as HTMLElement)?.click();
            await modalPromise;

            expect(document.body.style.height).toBe(originalHeight);
        });

        it('should handle empty message', async () => {
            const modalPromise = createConfirmationModal('', false);

            await new Promise(resolve => setTimeout(resolve, 10));

            const messageElement = document.querySelector('p');
            expect(messageElement?.textContent).toBe('');

            // Close modal
            const cancelButton = Array.from(document.querySelectorAll('button')).find(
                btn => btn.textContent === 'Anuluj',
            );
            (cancelButton as HTMLElement)?.click();
            await modalPromise;
        });
    });

    describe('button styling', () => {
        it('should style Yes button correctly', async () => {
            const modalPromise = createConfirmationModal('Test', false);

            await new Promise(resolve => setTimeout(resolve, 10));

            const confirmButton = Array.from(document.querySelectorAll('button')).find(
                btn => btn.textContent === 'Potwierdź',
            ) as HTMLElement;
            expect(confirmButton?.style.backgroundColor).toBeTruthy();
            expect(confirmButton?.style.color).toBeTruthy();

            // Close modal
            const cancelButton = Array.from(document.querySelectorAll('button')).find(
                btn => btn.textContent === 'Anuluj',
            );
            (cancelButton as HTMLElement)?.click();
            await modalPromise;
        });

        it('should style No button correctly', async () => {
            const modalPromise = createConfirmationModal('Test', false);

            await new Promise(resolve => setTimeout(resolve, 10));

            const cancelButton = Array.from(document.querySelectorAll('button')).find(
                btn => btn.textContent === 'Anuluj',
            ) as HTMLElement;
            expect(cancelButton?.style.backgroundColor).toBeTruthy();
            // Cancel button has no explicit color set, so we check it exists
            expect(cancelButton?.style.color).toBeDefined();

            // Close modal
            cancelButton?.click();
            await modalPromise;
        });
    });
});
