/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';

// Mock contentUtils before importing
const mockClickLoginButton = jest.fn();
jest.doMock('../../../src/content/utils/contentUtils', () => ({
    clickLoginButton: mockClickLoginButton,
}));

describe('Countdown Modal', () => {
    let showCountdownModal: any;

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

        // Use fake timers for interval/timeout control
        jest.useFakeTimers();

        // Import the modal function
        const module = await import('../../../src/content/modals/countdownModal');
        showCountdownModal = module.showCountdownModal;
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    describe('Modal Creation and Display', () => {
        it('should create modal with correct structure', async () => {
            await showCountdownModal();

            const modal = document.getElementById('countdown-modal');
            expect(modal).toBeTruthy();
            expect(modal?.style.position).toBe('fixed');
            expect(modal?.style.zIndex).toBe('9999');
        });

        it('should contain correct Polish text', async () => {
            await showCountdownModal();

            const modal = document.getElementById('countdown-modal');
            const html = modal?.innerHTML || '';

            expect(html).toContain('Automatyczne logowanie');
            expect(html).toContain('Kliknięcie przycisku logowania za');
            expect(html).toContain('Zaloguj teraz');
            expect(html).toContain('Anuluj');
        });

        it('should have login and cancel buttons', async () => {
            await showCountdownModal();

            const loginBtn = document.getElementById('login-now');
            const cancelBtn = document.getElementById('cancel-login');

            expect(loginBtn).toBeTruthy();
            expect(cancelBtn).toBeTruthy();
            expect(loginBtn?.textContent).toBe('Zaloguj teraz');
            expect(cancelBtn?.textContent).toBe('Anuluj');
        });

        it('should display initial countdown of 60 seconds', async () => {
            await showCountdownModal();

            const timerSpan = document.getElementById('modal-timer');
            expect(timerSpan?.textContent).toBe('60');
        });

        it('should apply correct styles to modal content', async () => {
            await showCountdownModal();

            const modalContent = document.querySelector('#modal-content') as HTMLElement;
            expect(modalContent).toBeTruthy();

            // Check that style attribute contains CSS variables (fallbacks)
            expect(modalContent.getAttribute('style')).toContain('var(--color-white, #fff)');
            expect(modalContent.style.textAlign).toBe('center');
            expect(modalContent.style.minWidth).toBe('320px');
        });
    });

    describe('Modal State Management', () => {
        it('should not show modal if already shown', async () => {
            // Create a modal manually
            const existingModal = document.createElement('div');
            existingModal.id = 'countdown-modal';
            document.body.appendChild(existingModal);

            await showCountdownModal();

            // Should not create a second modal
            const modals = document.querySelectorAll('#countdown-modal');
            expect(modals).toHaveLength(1);
        });

        it('should show modal on fresh page load', async () => {
            await showCountdownModal();

            const modal = document.getElementById('countdown-modal');
            expect(modal).toBeTruthy();
        });
    });

    describe('Countdown Functionality', () => {
        it('should start countdown automatically', async () => {
            await showCountdownModal();

            const timerSpan = document.getElementById('modal-timer');
            expect(timerSpan?.textContent).toBe('60');

            // Advance time by 1 second
            jest.advanceTimersByTime(1000);

            expect(timerSpan?.textContent).toBe('59');
        });

        it('should update countdown every second', async () => {
            await showCountdownModal();

            const timerSpan = document.getElementById('modal-timer');

            // Advance time by 3 seconds
            jest.advanceTimersByTime(3000);

            expect(timerSpan?.textContent).toBe('57');
        });

        it('should trigger login and close modal when countdown reaches 0', async () => {
            await showCountdownModal();

            // Advance time by 60 seconds (full countdown)
            jest.advanceTimersByTime(60000);

            // Modal should be closed
            const modal = document.getElementById('countdown-modal');
            expect(modal).toBeFalsy();

            // Login button should have been clicked
            expect(mockClickLoginButton).toHaveBeenCalledTimes(1);
        });

        it('should update description text during countdown', async () => {
            await showCountdownModal();

            const desc = document.getElementById('modal-desc');
            expect(desc?.innerHTML).toContain('60');

            // Advance time by 1 second
            jest.advanceTimersByTime(1000);

            expect(desc?.innerHTML).toContain('59');
        });
    });

    describe('User Interactions', () => {
        it('should close modal and trigger login when "Zaloguj teraz" is clicked', async () => {
            await showCountdownModal();

            const loginBtn = document.getElementById('login-now');
            loginBtn?.click();

            // Modal should be closed
            const modal = document.getElementById('countdown-modal');
            expect(modal).toBeFalsy();

            // Login button should have been clicked
            expect(mockClickLoginButton).toHaveBeenCalledTimes(1);
        });

        it('should close modal when "Anuluj" is clicked', async () => {
            await showCountdownModal();

            const cancelBtn = document.getElementById('cancel-login');
            cancelBtn?.click();

            // Modal should be closed
            const modal = document.getElementById('countdown-modal');
            expect(modal).toBeFalsy();

            // Login button should NOT have been clicked
            expect(mockClickLoginButton).not.toHaveBeenCalled();
        });

        it('should clear interval when login button is clicked', async () => {
            const clearIntervalSpy = jest.spyOn(window, 'clearInterval');

            await showCountdownModal();

            const loginBtn = document.getElementById('login-now');
            loginBtn?.click();

            expect(clearIntervalSpy).toHaveBeenCalled();
            clearIntervalSpy.mockRestore();
        });

        it('should clear interval when cancel button is clicked', async () => {
            const clearIntervalSpy = jest.spyOn(window, 'clearInterval');

            await showCountdownModal();

            const cancelBtn = document.getElementById('cancel-login');
            cancelBtn?.click();

            expect(clearIntervalSpy).toHaveBeenCalled();
            clearIntervalSpy.mockRestore();
        });
    });

    describe('Timer Management', () => {
        it('should clear existing interval before starting new countdown', async () => {
            const clearIntervalSpy = jest.spyOn(window, 'clearInterval');

            await showCountdownModal();

            // The startCountdown function should clear any existing interval if it exists
            // Since this is the first call, clearInterval might not be called
            // But when modal is closed, clearInterval should be called
            const cancelBtn = document.getElementById('cancel-login');
            cancelBtn?.click();

            expect(clearIntervalSpy).toHaveBeenCalled();
            clearIntervalSpy.mockRestore();
        });

        it('should handle rapid button clicks without breaking', async () => {
            await showCountdownModal();

            const loginBtn = document.getElementById('login-now');

            // Click multiple times rapidly
            loginBtn?.click();
            loginBtn?.click();
            loginBtn?.click();

            // Should only trigger login once due to isModalClosed flag
            expect(mockClickLoginButton).toHaveBeenCalledTimes(1);
        });
    });

    describe('DOM Element Access', () => {
        it('should handle missing timer span gracefully', async () => {
            await showCountdownModal();

            // Remove timer span to test null handling
            const timerSpan = document.getElementById('modal-timer');
            timerSpan?.remove();

            // Should not throw error when advancing time
            expect(() => {
                jest.advanceTimersByTime(1000);
            }).not.toThrow();
        });

        it('should handle missing description gracefully', async () => {
            await showCountdownModal();

            // Remove description to test null handling
            const desc = document.getElementById('modal-desc');
            desc?.remove();

            // Should not throw error when advancing time
            expect(() => {
                jest.advanceTimersByTime(1000);
            }).not.toThrow();
        });

        it('should handle missing buttons gracefully', async () => {
            await showCountdownModal();

            // Remove buttons to test null handling
            const loginBtn = document.getElementById('login-now');
            const cancelBtn = document.getElementById('cancel-login');
            loginBtn?.remove();
            cancelBtn?.remove();

            // Should not throw error
            expect(() => {
                jest.advanceTimersByTime(1000);
            }).not.toThrow();
        });
    });

    describe('Accessibility', () => {
        it('should have proper semantic structure', async () => {
            await showCountdownModal();

            const modalContent = document.getElementById('modal-content');
            expect(modalContent).toBeTruthy();

            // Check for semantic structure
            const heading = modalContent?.querySelector('h2');
            expect(heading).toBeTruthy();
            expect(heading?.textContent).toContain('Automatyczne logowanie');
        });

        it('should have focusable buttons', async () => {
            await showCountdownModal();

            const loginBtn = document.getElementById('login-now') as HTMLButtonElement;
            const cancelBtn = document.getElementById('cancel-login') as HTMLButtonElement;

            expect(loginBtn.tagName.toLowerCase()).toBe('button');
            expect(cancelBtn.tagName.toLowerCase()).toBe('button');
            expect(loginBtn.style.cursor).toBe('pointer');
            expect(cancelBtn.style.cursor).toBe('pointer');
        });
    });

    describe('Performance', () => {
        it('should clean up interval on modal close', async () => {
            await showCountdownModal();

            const cancelBtn = document.getElementById('cancel-login');
            cancelBtn?.click();

            // Advance time after modal is closed
            jest.advanceTimersByTime(1000);

            // Timer should not be running anymore
            const modal = document.getElementById('countdown-modal');
            expect(modal).toBeFalsy();
        });
    });
});
