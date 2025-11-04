import type { NotificationSettings } from '../../types/general';
import { notificationSettingsService } from '../../services/notificationSettingsService';

export interface NotificationSettingsResult {
    email: {
        enabled: boolean;
        userEmail: string;
    };
    windows: {
        enabled: boolean;
    };
}

export function showNotificationSettingsModal(): Promise<NotificationSettingsResult | null> {
    return new Promise(resolve => {
        const body = document.querySelector('body');
        const initialBodyHeight = body ? body.style.height : '';
        document.body.style.height = '400px';

        // Handle escape key press
        const handleEscapeKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeModal(null);
            }
        };

        // Function to show status message
        const showStatusMessage = (message: string, isSuccess: boolean = true) => {
            statusMessage.textContent = message;
            statusMessage.style.display = 'block';
            statusMessage.style.backgroundColor = isSuccess ? '#d4edda' : '#f8d7da';
            statusMessage.style.color = isSuccess ? '#155724' : '#721c24';
            statusMessage.style.border = `1px solid ${isSuccess ? '#c3e6cb' : '#f5c6cb'}`;

            // Auto-hide after 3 seconds
            setTimeout(() => {
                statusMessage.style.display = 'none';
            }, 3000);
        };

        // Function to properly close modal and clean up
        const closeModal = (result: NotificationSettingsResult | null = null) => {
            // Remove escape key listener
            document.removeEventListener('keydown', handleEscapeKey);

            // Remove overlay from DOM
            if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }

            // Restore body height
            document.body.style.height = initialBodyHeight;

            // Resolve promise
            resolve(result);
        };

        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.zIndex = '1000';

        const modal = document.createElement('div');
        modal.style.backgroundColor = 'white';
        modal.style.padding = '20px';
        modal.style.borderRadius = '8px';
        modal.style.textAlign = 'center';
        modal.style.maxWidth = '450px';
        modal.style.width = '90%';
        modal.style.maxHeight = '90vh';
        modal.style.overflowY = 'auto';

        const title = document.createElement('h3');
        title.textContent = 'Ustawienia powiadomień';
        title.style.marginBottom = '20px';
        title.style.color = '#00aacc';
        title.style.fontSize = '18px';

        // Email notifications section
        const emailSection = document.createElement('div');
        emailSection.style.marginBottom = '25px';
        emailSection.style.textAlign = 'left';

        const emailTitle = document.createElement('h4');
        emailTitle.textContent = 'Powiadomienia e-mail';
        emailTitle.style.marginBottom = '10px';
        emailTitle.style.color = '#333';

        const emailCheckboxContainer = document.createElement('div');
        emailCheckboxContainer.style.display = 'flex';
        emailCheckboxContainer.style.alignItems = 'center';
        emailCheckboxContainer.style.marginBottom = '10px';

        const emailCheckbox = document.createElement('input');
        emailCheckbox.type = 'checkbox';
        emailCheckbox.id = 'emailNotifications';
        emailCheckbox.style.marginRight = '8px';

        const emailCheckboxLabel = document.createElement('label');
        emailCheckboxLabel.htmlFor = 'emailNotifications';
        emailCheckboxLabel.textContent = 'Włącz powiadomienia e-mail';
        emailCheckboxLabel.style.fontSize = '14px';
        emailCheckboxLabel.style.color = '#333';

        emailCheckboxContainer.appendChild(emailCheckbox);
        emailCheckboxContainer.appendChild(emailCheckboxLabel);

        const emailInput = document.createElement('input');
        emailInput.type = 'email';
        emailInput.id = 'userEmail';
        emailInput.placeholder = 'twoj@email.com';
        emailInput.style.width = '100%';
        emailInput.style.padding = '8px';
        emailInput.style.border = '1px solid #ccc';
        emailInput.style.borderRadius = '4px';
        emailInput.style.fontSize = '14px';
        emailInput.style.marginBottom = '5px';

        const emailNote = document.createElement('p');
        emailNote.textContent = 'Podstawowy adres e-mail do powiadomień o rezerwacjach.';
        emailNote.style.fontSize = '12px';
        emailNote.style.color = '#666';
        emailNote.style.margin = '5px 0 10px 0';

        // Status message container
        const statusMessage = document.createElement('div');
        statusMessage.style.marginTop = '10px';
        statusMessage.style.padding = '8px 12px';
        statusMessage.style.borderRadius = '4px';
        statusMessage.style.fontSize = '12px';
        statusMessage.style.display = 'none';
        statusMessage.style.textAlign = 'center';

        emailSection.appendChild(emailTitle);
        emailSection.appendChild(emailCheckboxContainer);
        emailSection.appendChild(emailInput);
        emailSection.appendChild(emailNote);
        emailSection.appendChild(statusMessage);

        // Windows notifications section
        const windowsSection = document.createElement('div');
        windowsSection.style.marginBottom = '25px';
        windowsSection.style.textAlign = 'left';

        const windowsTitle = document.createElement('h4');
        windowsTitle.textContent = 'Powiadomienia systemu Windows';
        windowsTitle.style.marginBottom = '10px';
        windowsTitle.style.color = '#333';

        const windowsCheckboxContainer = document.createElement('div');
        windowsCheckboxContainer.style.display = 'flex';
        windowsCheckboxContainer.style.alignItems = 'center';

        const windowsCheckbox = document.createElement('input');
        windowsCheckbox.type = 'checkbox';
        windowsCheckbox.id = 'windowsNotifications';
        windowsCheckbox.style.marginRight = '8px';

        const windowsCheckboxLabel = document.createElement('label');
        windowsCheckboxLabel.htmlFor = 'windowsNotifications';
        windowsCheckboxLabel.textContent = 'Włącz powiadomienia systemu Windows';
        windowsCheckboxLabel.style.fontSize = '14px';
        windowsCheckboxLabel.style.color = '#333';

        windowsCheckboxContainer.appendChild(windowsCheckbox);
        windowsCheckboxContainer.appendChild(windowsCheckboxLabel);

        windowsSection.appendChild(windowsTitle);
        windowsSection.appendChild(windowsCheckboxContainer);

        // Buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'space-between';
        buttonContainer.style.marginTop = '30px';
        buttonContainer.style.gap = '10px';

        const saveButton = document.createElement('button');
        saveButton.innerHTML = '✓ Zapisz';
        saveButton.style.padding = '10px 20px';
        saveButton.style.backgroundColor = '#17a2b8'; // Teal color like in the other modal
        saveButton.style.color = 'white';
        saveButton.style.border = 'none';
        saveButton.style.borderRadius = '6px';
        saveButton.style.cursor = 'pointer';
        saveButton.style.fontSize = '14px';
        saveButton.style.fontWeight = '500';
        saveButton.style.transition = 'background-color 0.2s';
        saveButton.style.display = 'flex';
        saveButton.style.alignItems = 'center';
        saveButton.style.gap = '6px';

        // Add disabled state styles
        const originalSaveButtonStyle = saveButton.style.backgroundColor;
        const updateSaveButtonState = () => {
            if (saveButton.disabled) {
                saveButton.style.backgroundColor = '#6c757d';
                saveButton.style.cursor = 'not-allowed';
            } else {
                saveButton.style.backgroundColor = originalSaveButtonStyle;
                saveButton.style.cursor = 'pointer';
            }
        };

        const resetButton = document.createElement('button');
        resetButton.innerHTML = '🗑 Wyczyść';
        resetButton.style.padding = '10px 20px';
        resetButton.style.backgroundColor = '#ff6b6b'; // Coral/red color like in the other modal
        resetButton.style.color = 'white';
        resetButton.style.border = 'none';
        resetButton.style.borderRadius = '6px';
        resetButton.style.cursor = 'pointer';
        resetButton.style.fontSize = '14px';
        resetButton.style.fontWeight = '500';
        resetButton.style.display = 'flex';
        resetButton.style.alignItems = 'center';
        resetButton.style.gap = '6px';

        const cancelButton = document.createElement('button');
        cancelButton.innerHTML = '✕ Anuluj';
        cancelButton.style.padding = '10px 20px';
        cancelButton.style.backgroundColor = '#e9ecef'; // Light gray color like in the other modal
        cancelButton.style.color = '#6c757d';
        cancelButton.style.border = '1px solid #dee2e6';
        cancelButton.style.borderRadius = '6px';
        cancelButton.style.cursor = 'pointer';
        cancelButton.style.fontSize = '14px';
        cancelButton.style.fontWeight = '500';
        cancelButton.style.display = 'flex';
        cancelButton.style.alignItems = 'center';
        cancelButton.style.gap = '6px';

        buttonContainer.appendChild(saveButton);
        buttonContainer.appendChild(resetButton);
        buttonContainer.appendChild(cancelButton);

        const modalContent = document.createElement('div');
        modalContent.appendChild(title);
        modalContent.appendChild(emailSection);
        modalContent.appendChild(windowsSection);
        modalContent.appendChild(buttonContainer);

        // Load existing settings
        notificationSettingsService.loadSettings().then(settings => {
            emailCheckbox.checked = settings.email.enabled;
            emailInput.value = settings.email.userEmail;
            windowsCheckbox.checked = settings.windows.enabled;

            updateEmailInputState();
        });

        // Email checkbox change handler
        function updateEmailInputState() {
            emailInput.disabled = !emailCheckbox.checked;
            emailInput.style.opacity = emailCheckbox.checked ? '1' : '0.5';
            if (!emailCheckbox.checked) {
                emailInput.style.backgroundColor = '#f5f5f5';
            } else {
                emailInput.style.backgroundColor = 'white';
            }
        }

        emailCheckbox.addEventListener('change', updateEmailInputState);

        // Save button handler
        saveButton.addEventListener('click', async () => {
            // Disable button during save to prevent multiple clicks
            saveButton.disabled = true;
            saveButton.innerHTML = '⏳ Zapisywanie...';
            updateSaveButtonState();
            const emailEnabled = emailCheckbox.checked;
            const userEmail = emailInput.value.trim();
            const windowsEnabled = windowsCheckbox.checked;

            // Validate email if enabled
            if (emailEnabled && (!userEmail || !isValidEmail(userEmail))) {
                showStatusMessage(
                    '❌ Proszę wprowadzić prawidłowy adres e-mail aby włączyć powiadomienia e-mail.',
                    false,
                );
                // Re-enable button
                saveButton.disabled = false;
                saveButton.innerHTML = '✓ Zapisz';
                updateSaveButtonState();
                return;
            }

            const settings: NotificationSettings = {
                email: {
                    enabled: emailEnabled,
                    userEmail: emailEnabled ? userEmail : '',
                    additionalEmails: [], // Always empty now
                },
                windows: {
                    enabled: windowsEnabled,
                },
                createdAt: Date.now(),
            };

            try {
                showStatusMessage('💾 Zapisywanie ustawień...', true);

                const success = await notificationSettingsService.saveSettings(settings);
                if (success) {
                    // Close modal with result immediately after successful save
                    closeModal({
                        email: {
                            enabled: emailEnabled,
                            userEmail: emailEnabled ? userEmail : '',
                        },
                        windows: {
                            enabled: windowsEnabled,
                        },
                    });
                } else {
                    showStatusMessage('❌ Błąd podczas zapisywania ustawień.', false);
                    // Re-enable button on error
                    saveButton.disabled = false;
                    saveButton.innerHTML = '✓ Zapisz';
                    updateSaveButtonState();
                }
            } catch (error) {
                console.error('Error saving settings:', error);
                showStatusMessage('❌ Błąd podczas zapisywania ustawień.', false);
                // Re-enable button on error
                saveButton.disabled = false;
                saveButton.innerHTML = '✓ Zapisz';
                updateSaveButtonState();
            }
        });

        // Reset button handler
        resetButton.addEventListener('click', async () => {
            if (confirm('Czy na pewno chcesz zresetować ustawienia powiadomień do domyślnych?')) {
                try {
                    showStatusMessage('🔄 Resetowanie ustawień...', true);

                    await notificationSettingsService.clearSettings();
                    const defaultSettings = await notificationSettingsService.loadSettings();

                    emailCheckbox.checked = defaultSettings.email.enabled;
                    emailInput.value = defaultSettings.email.userEmail;
                    windowsCheckbox.checked = defaultSettings.windows.enabled;

                    updateEmailInputState();
                    showStatusMessage('✅ Ustawienia zostały zresetowane do domyślnych.', true);
                } catch (error) {
                    showStatusMessage(`❌ Błąd podczas resetowania ustawień: ${error}`, false);
                }
            }
        });

        // Cancel button handler
        cancelButton.addEventListener('click', () => {
            closeModal(null);
        });

        modal.appendChild(modalContent);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Close modal when clicking overlay
        overlay.addEventListener('click', e => {
            if (e.target === overlay) {
                closeModal(null);
            }
        });

        // Add escape key listener
        document.addEventListener('keydown', handleEscapeKey);
    });
}

export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
