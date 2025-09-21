import { showEmailConfirmationModal } from '../../../../src/popup/modals/emailConfirm.modal';

describe('EmailConfirmModal', () => {
    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = '';
        document.body.style.height = '';
    });

    afterEach(() => {
        // Clean up any remaining modal elements
        const confirmMsg = document.getElementById('emailConfirmMsg');
        if (confirmMsg) {
            confirmMsg.remove();
        }
        document.body.style.height = '';
    });

    describe('showEmailConfirmationModal', () => {
        it('should create and display modal with correct email', () => {
            const email = 'test@example.com';
            showEmailConfirmationModal(email);

            const confirmMsg = document.getElementById('emailConfirmMsg');
            expect(confirmMsg).toBeTruthy();
            expect(confirmMsg?.classList.contains('show')).toBe(true);

            const emailElement = confirmMsg?.querySelector('.email-address');
            expect(emailElement?.textContent).toBe(email);

            const title = confirmMsg?.querySelector('h3');
            expect(title?.textContent).toBe('Sprawdź swoją skrzynkę e-mail');

            const button = confirmMsg?.querySelector('#backToLoginBtn');
            expect(button?.textContent).toBe('OK');
        });

        it('should set body height to 180px', () => {
            showEmailConfirmationModal('test@example.com');

            expect(document.body.style.height).toBe('180px');
        });

        it('should reuse existing modal element if present', () => {
            // Create first modal
            showEmailConfirmationModal('first@example.com');
            const firstModal = document.getElementById('emailConfirmMsg');

            // Create second modal
            showEmailConfirmationModal('second@example.com');
            const secondModal = document.getElementById('emailConfirmMsg');

            // Should be the same element
            expect(firstModal).toBe(secondModal);

            // Should have updated content
            const emailElement = secondModal?.querySelector('.email-address');
            expect(emailElement?.textContent).toBe('second@example.com');
        });

        it('should call onClose callback when OK button is clicked', () => {
            const onCloseMock = jest.fn();
            showEmailConfirmationModal('test@example.com', onCloseMock);

            const button = document.getElementById('backToLoginBtn');
            (button as HTMLElement)?.click();

            expect(onCloseMock).toHaveBeenCalled();
        });

        it('should hide modal when OK button is clicked', () => {
            showEmailConfirmationModal('test@example.com');

            const confirmMsg = document.getElementById('emailConfirmMsg');
            expect(confirmMsg?.classList.contains('show')).toBe(true);

            const button = document.getElementById('backToLoginBtn');
            (button as HTMLElement)?.click();

            expect(confirmMsg?.classList.contains('show')).toBe(false);
        });

        it('should restore original body height when closed', async () => {
            const originalHeight = '300px';
            document.body.style.height = originalHeight;

            showEmailConfirmationModal('test@example.com');
            expect(document.body.style.height).toBe('180px');

            const button = document.getElementById('backToLoginBtn');
            (button as HTMLElement)?.click();

            // Wait for setTimeout to complete (250ms)
            await new Promise(resolve => setTimeout(resolve, 300));

            expect(document.body.style.height).toBe(originalHeight);
        });

        it('should handle special characters in email', () => {
            const email = 'test+special@example-domain.co.uk';
            showEmailConfirmationModal(email);

            const emailElement = document.querySelector('.email-address');
            expect(emailElement?.textContent).toBe(email);
        });

        it('should handle empty email', () => {
            showEmailConfirmationModal('');

            const emailElement = document.querySelector('.email-address');
            expect(emailElement?.textContent).toBe('');
        });

        it('should create modal with correct structure', () => {
            showEmailConfirmationModal('test@example.com');

            const confirmMsg = document.getElementById('emailConfirmMsg');
            expect(confirmMsg?.className).toContain('email-confirm-message');

            const content = confirmMsg?.querySelector('.confirm-content');
            expect(content).toBeTruthy();

            // Check for emoji
            const emojiDiv = content?.querySelector('div[style*="font-size: 28px"]');
            expect(emojiDiv?.textContent).toBe('📧');

            // Check for title
            const title = content?.querySelector('h3');
            expect(title?.textContent).toBe('Sprawdź swoją skrzynkę e-mail');

            // Check for description
            const paragraphs = content?.querySelectorAll('p');
            expect(paragraphs?.length).toBeGreaterThanOrEqual(2);
            expect(paragraphs?.[0]?.textContent).toBe('Wysłaliśmy link potwierdzający na adres:');

            // Check for button
            const button = content?.querySelector('#backToLoginBtn');
            expect(button?.className).toBe('confirm-btn');
        });

        it('should work without onClose callback', () => {
            // Should not throw error
            expect(() => {
                showEmailConfirmationModal('test@example.com');
                const button = document.getElementById('backToLoginBtn');
                (button as HTMLElement)?.click();
            }).not.toThrow();
        });

        it('should handle click event when modal does not exist', () => {
            showEmailConfirmationModal('test@example.com');

            // Remove modal manually
            const confirmMsg = document.getElementById('emailConfirmMsg');
            confirmMsg?.remove();

            // Try to click button - should not throw
            expect(() => {
                const button = document.getElementById('backToLoginBtn');
                (button as HTMLElement)?.click();
            }).not.toThrow();
        });

        it('should maintain modal state across multiple calls', () => {
            // First call
            showEmailConfirmationModal('first@example.com');
            let confirmMsg = document.getElementById('emailConfirmMsg');
            expect(confirmMsg?.classList.contains('show')).toBe(true);

            // Hide it
            const button = document.getElementById('backToLoginBtn');
            (button as HTMLElement)?.click();
            expect(confirmMsg?.classList.contains('show')).toBe(false);

            // Second call should show it again
            showEmailConfirmationModal('second@example.com');
            confirmMsg = document.getElementById('emailConfirmMsg');
            expect(confirmMsg?.classList.contains('show')).toBe(true);
        });

        it('should handle body height restoration when original height is empty', async () => {
            // No original height set
            document.body.style.height = '';

            showEmailConfirmationModal('test@example.com');
            expect(document.body.style.height).toBe('180px');

            const button = document.getElementById('backToLoginBtn');
            (button as HTMLElement)?.click();

            // Wait for setTimeout to complete (250ms)
            await new Promise(resolve => setTimeout(resolve, 300));

            expect(document.body.style.height).toBe('');
        });

        it('should add CSS styles to the page', () => {
            showEmailConfirmationModal('test@example.com');

            // Check if styles were added (the function calls addSimpleStyles)
            const styleElement = document.querySelector('style');
            expect(styleElement).toBeTruthy();
        });
    });
});
