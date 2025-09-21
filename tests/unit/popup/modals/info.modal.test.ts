import { showInfoModal } from '../../../../src/popup/modals/info.modal';

describe('InfoModal', () => {
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

    describe('showInfoModal', () => {
        it('should create and display modal with correct message', async () => {
            const message = 'Test message';
            const modalPromise = showInfoModal(message);

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

            const closeButton = modal?.querySelector('button');
            expect(closeButton?.textContent).toBe('Zamknij');

            // Close the modal
            (closeButton as HTMLElement)?.click();

            const result = await modalPromise;
            expect(result).toBeUndefined();
        });

        it('should set body height to 100px', async () => {
            const originalHeight = document.body.style.height;
            const modalPromise = showInfoModal('Test');

            await new Promise(resolve => setTimeout(resolve, 10));

            expect(document.body.style.height).toBe('100px');

            // Close modal
            const closeButton = document.querySelector('button');
            (closeButton as HTMLElement)?.click();
            await modalPromise;

            expect(document.body.style.height).toBe(originalHeight);
        });

        it('should restore original body height after closing', async () => {
            const originalHeight = '300px';
            document.body.style.height = originalHeight;

            const modalPromise = showInfoModal('Test');

            await new Promise(resolve => setTimeout(resolve, 10));

            // Close modal
            const closeButton = document.querySelector('button');
            (closeButton as HTMLElement)?.click();
            await modalPromise;

            expect(document.body.style.height).toBe(originalHeight);
        });

        it('should create modal with proper styling', async () => {
            const modalPromise = showInfoModal('Test message');

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

            const closeButton = modal?.querySelector('button') as HTMLElement;
            expect(closeButton?.style.backgroundColor).toBeTruthy();
            expect(closeButton?.style.color).toBeTruthy();

            // Close modal
            closeButton?.click();
            await modalPromise;
        });

        it('should handle special characters in message', async () => {
            const message = 'Test message with "quotes" & <special> characters';
            const modalPromise = showInfoModal(message);

            await new Promise(resolve => setTimeout(resolve, 10));

            const messageElement = document.querySelector('p');
            expect(messageElement?.textContent).toBe(message);

            // Close modal
            const closeButton = document.querySelector('button');
            (closeButton as HTMLElement)?.click();
            await modalPromise;
        });

        it('should handle empty message', async () => {
            const modalPromise = showInfoModal('');

            await new Promise(resolve => setTimeout(resolve, 10));

            const messageElement = document.querySelector('p');
            expect(messageElement?.textContent).toBe('');

            // Close modal
            const closeButton = document.querySelector('button');
            (closeButton as HTMLElement)?.click();
            await modalPromise;
        });

        it('should resolve promise when close button is clicked', async () => {
            const modalPromise = showInfoModal('Test');
            let resolved = false;

            modalPromise.then(() => {
                resolved = true;
            });

            await new Promise(resolve => setTimeout(resolve, 10));

            expect(resolved).toBe(false);

            const closeButton = document.querySelector('button');
            (closeButton as HTMLElement)?.click();

            await modalPromise;
            expect(resolved).toBe(true);
        });

        it('should remove overlay from DOM after closing', async () => {
            const modalPromise = showInfoModal('Test');

            await new Promise(resolve => setTimeout(resolve, 10));

            let overlay = document.querySelector('[style*="position: fixed"]');
            expect(overlay).toBeTruthy();

            const closeButton = document.querySelector('button');
            (closeButton as HTMLElement)?.click();

            await modalPromise;

            overlay = document.querySelector('[style*="position: fixed"]');
            expect(overlay).toBeFalsy();
        });
    });
});
