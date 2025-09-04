/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';

// Mock sessionStorage
const mockSessionStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn(),
};
global.sessionStorage = mockSessionStorage as any;

describe('Extension Warning Modal', () => {
    let showExtensionWarningModal: any;

    // Mock console to avoid noise in tests
    beforeAll(() => {
        global.console = {
            ...console,
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
        };
    });

    beforeEach(async () => {
        jest.clearAllMocks();

        // Clear document body
        document.body.innerHTML = '';

        // Reset sessionStorage mock
        mockSessionStorage.getItem.mockReturnValue(null);

        // Clear the modal dismissed flag
        jest.resetModules();

        // Import the modal function
        const module = await import('../../../src/content/modals/extensionWarningModal');
        showExtensionWarningModal = module.showExtensionWarningModal;
    });

    describe('Modal Creation and Display', () => {
        it('should create modal with correct structure', async () => {
            await showExtensionWarningModal();

            const modal = document.getElementById('extension-warning-modal');
            expect(modal).toBeTruthy();
            expect(modal?.style.position).toBe('fixed');
            expect(modal?.style.zIndex).toBe('9999');
        });

        it('should contain correct Polish text', async () => {
            await showExtensionWarningModal();

            const modal = document.getElementById('extension-warning-modal');
            const html = modal?.innerHTML || '';

            expect(html).toContain('Problemy z rozszerzeniem Brama');
            expect(html).toContain('Wykryto problemy z połączeniem z rozszerzeniem Brama');
            expect(html).toContain('Odśwież stronę');
            expect(html).toContain('Zamknij');
        });

        it('should have refresh and dismiss buttons', async () => {
            await showExtensionWarningModal();

            const refreshBtn = document.getElementById('refresh-page');
            const dismissBtn = document.getElementById('dismiss-warning');

            expect(refreshBtn).toBeTruthy();
            expect(dismissBtn).toBeTruthy();
            expect(refreshBtn?.textContent).toBe('Odśwież stronę');
            expect(dismissBtn?.textContent).toBe('Zamknij');
        });

        it('should apply correct styles to modal content', async () => {
            await showExtensionWarningModal();

            const modalContent = document.querySelector('#modal-content') as HTMLElement;
            expect(modalContent).toBeTruthy();

            // Check that style attribute contains CSS variables (fallbacks)
            expect(modalContent.getAttribute('style')).toContain('var(--color-white, #fff)');
            expect(modalContent.style.textAlign).toBe('center');
            expect(modalContent.style.minWidth).toBe('280px');
            expect(modalContent.style.maxWidth).toBe('min(380px, 85vw)');
        });
    });

    describe('Modal State Management', () => {
        it('should not show modal if already shown', async () => {
            // Create a modal manually
            const existingModal = document.createElement('div');
            existingModal.id = 'extension-warning-modal';
            document.body.appendChild(existingModal);

            await showExtensionWarningModal();

            // Should not create a second modal
            const modals = document.querySelectorAll('#extension-warning-modal');
            expect(modals).toHaveLength(1);
        });

        it('should not show modal if already dismissed this page', async () => {
            // Import fresh module to reset the flag
            const { showExtensionWarningModal } = await import(
                '../../../src/content/modals/extensionWarningModal'
            );

            // Show and dismiss modal
            await showExtensionWarningModal();
            const dismissBtn = document.getElementById('dismiss-warning');
            dismissBtn?.click();

            // Clear DOM for second attempt
            document.body.innerHTML = '';

            // Try to show again
            await showExtensionWarningModal();

            // Should not create modal again
            const modal = document.getElementById('extension-warning-modal');
            expect(modal).toBeFalsy();
        });

        it('should show modal on fresh page load', async () => {
            await showExtensionWarningModal();

            const modal = document.getElementById('extension-warning-modal');
            expect(modal).toBeTruthy();
        });
    });

    describe('User Interactions', () => {
        it('should close modal when dismiss button is clicked', async () => {
            await showExtensionWarningModal();

            const dismissBtn = document.getElementById('dismiss-warning');
            dismissBtn?.click();

            const modal = document.getElementById('extension-warning-modal');
            expect(modal).toBeFalsy();
        });

        it('should reload page when refresh button is clicked', async () => {
            // Mock window.location.reload
            const mockReload = jest.fn();
            Object.defineProperty(window, 'location', {
                value: { reload: mockReload },
                writable: true,
            });

            await showExtensionWarningModal();

            const refreshBtn = document.getElementById('refresh-page');
            refreshBtn?.click();

            expect(mockReload).toHaveBeenCalled();
        });

        it('should close modal when clicking outside', async () => {
            await showExtensionWarningModal();

            const modal = document.getElementById('extension-warning-modal');

            // Simulate click on modal background (not content)
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
            });
            Object.defineProperty(clickEvent, 'target', {
                value: modal,
                enumerable: true,
            });

            modal?.dispatchEvent(clickEvent);

            // Modal should be removed
            const modalAfterClick = document.getElementById('extension-warning-modal');
            expect(modalAfterClick).toBeFalsy();
        });

        it('should not close modal when clicking on content', async () => {
            await showExtensionWarningModal();

            const modalContent = document.getElementById('modal-content');

            // Simulate click on modal content
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
            });
            Object.defineProperty(clickEvent, 'target', {
                value: modalContent,
                enumerable: true,
            });

            modalContent?.dispatchEvent(clickEvent);

            // Modal should still be there
            const modal = document.getElementById('extension-warning-modal');
            expect(modal).toBeTruthy();
        });

        it('should close modal when Escape key is pressed', async () => {
            await showExtensionWarningModal();

            // Simulate Escape key press
            const escapeEvent = new KeyboardEvent('keydown', {
                key: 'Escape',
                bubbles: true,
                cancelable: true,
            });

            document.dispatchEvent(escapeEvent);

            // Modal should be removed
            const modal = document.getElementById('extension-warning-modal');
            expect(modal).toBeFalsy();
        });

        it('should not close modal for other keys', async () => {
            await showExtensionWarningModal();

            // Simulate Enter key press
            const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                bubbles: true,
                cancelable: true,
            });

            document.dispatchEvent(enterEvent);

            // Modal should still be there
            const modal = document.getElementById('extension-warning-modal');
            expect(modal).toBeTruthy();
        });
    });

    describe('Event Cleanup', () => {
        it('should remove event listeners after modal is closed', async () => {
            const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

            await showExtensionWarningModal();

            const dismissBtn = document.getElementById('dismiss-warning');
            dismissBtn?.click();

            // Should remove keydown event listener
            expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

            removeEventListenerSpy.mockRestore();
        });

        it('should remove event listeners when refresh button is clicked', async () => {
            const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

            // Mock window.location.reload to prevent actual reload
            const mockReload = jest.fn();
            Object.defineProperty(window, 'location', {
                value: { reload: mockReload },
                writable: true,
            });

            await showExtensionWarningModal();

            const refreshBtn = document.getElementById('refresh-page');
            refreshBtn?.click();

            // Should remove keydown event listener before reloading
            expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
            expect(mockReload).toHaveBeenCalled();

            removeEventListenerSpy.mockRestore();
        });
    });

    describe('Accessibility', () => {
        it('should have proper ARIA attributes', async () => {
            await showExtensionWarningModal();

            const modalContent = document.getElementById('modal-content');
            expect(modalContent).toBeTruthy();

            // Check for semantic structure
            const heading = modalContent?.querySelector('h2');
            expect(heading).toBeTruthy();
            expect(heading?.textContent).toContain('Problemy z rozszerzeniem Brama');
        });

        it('should have focusable buttons', async () => {
            await showExtensionWarningModal();

            const refreshBtn = document.getElementById('refresh-page') as HTMLButtonElement;
            const dismissBtn = document.getElementById('dismiss-warning') as HTMLButtonElement;

            expect(refreshBtn.tagName.toLowerCase()).toBe('button');
            expect(dismissBtn.tagName.toLowerCase()).toBe('button');
            expect(refreshBtn.style.cursor).toBe('pointer');
            expect(dismissBtn.style.cursor).toBe('pointer');
        });
    });

    describe('Console Logging', () => {
        it('should log when modal is shown', async () => {
            await showExtensionWarningModal();

            expect(console.log).toHaveBeenCalledWith('[content] Showing extension warning modal');
        });

        it('should log when modal was already shown', async () => {
            // Create existing modal
            const existingModal = document.createElement('div');
            existingModal.id = 'extension-warning-modal';
            document.body.appendChild(existingModal);

            await showExtensionWarningModal();

            expect(console.log).toHaveBeenCalledWith(
                '[content] Extension warning modal already shown',
            );
        });

        it('should log when modal was dismissed on this page', async () => {
            // Show and dismiss modal first
            await showExtensionWarningModal();
            const dismissBtn = document.getElementById('dismiss-warning');
            dismissBtn?.click();

            // Clear DOM and try again
            document.body.innerHTML = '';
            await showExtensionWarningModal();

            expect(console.log).toHaveBeenCalledWith(
                '[content] Extension warning modal was dismissed on this page',
            );
        });

        it('should log when modal is displayed', async () => {
            await showExtensionWarningModal();

            expect(console.log).toHaveBeenCalledWith('[content] Extension warning modal displayed');
        });
    });
});
