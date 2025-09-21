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
        const initialBodyHeight = document.querySelector('body')!.style.height;
        document.body.style.height = '400px';

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
        emailTitle.style.color = '#333';
        emailTitle.style.marginBottom = '10px';
        emailTitle.style.fontSize = '16px';

        // Email enable checkbox
        const emailCheckboxContainer = document.createElement('div');
        emailCheckboxContainer.style.marginBottom = '10px';
        emailCheckboxContainer.style.display = 'flex';
        emailCheckboxContainer.style.alignItems = 'center';

        const emailCheckbox = document.createElement('input');
        emailCheckbox.type = 'checkbox';
        emailCheckbox.id = 'emailEnabled';
        emailCheckbox.style.marginRight = '8px';

        const emailCheckboxLabel = document.createElement('label');
        emailCheckboxLabel.htmlFor = 'emailEnabled';
        emailCheckboxLabel.textContent = 'Włącz powiadomienia e-mail';
        emailCheckboxLabel.style.fontSize = '14px';

        emailCheckboxContainer.appendChild(emailCheckbox);
        emailCheckboxContainer.appendChild(emailCheckboxLabel);

        // Email input
        const emailInput = document.createElement('input');
        emailInput.type = 'email';
        emailInput.placeholder = 'Wprowadź adres e-mail';
        emailInput.style.width = '100%';
        emailInput.style.padding = '10px';
        emailInput.style.marginBottom = '5px';
        emailInput.style.border = '1px solid #ccc';
        emailInput.style.borderRadius = '4px';
        emailInput.style.boxSizing = 'border-box';
        emailInput.style.fontSize = '14px';

        // Email info note
        const emailNote = document.createElement('p');
        emailNote.textContent = 'Podstawowy adres e-mail do powiadomień o rezerwacjach.';
        emailNote.style.fontSize = '12px';
        emailNote.style.color = '#666';
        emailNote.style.margin = '5px 0 10px 0';

        // Additional emails section
        const additionalEmailsContainer = document.createElement('div');
        additionalEmailsContainer.style.marginTop = '15px';
        additionalEmailsContainer.style.border = '1px solid #e0e0e0';
        additionalEmailsContainer.style.borderRadius = '4px';
        additionalEmailsContainer.style.padding = '12px';
        additionalEmailsContainer.style.backgroundColor = '#f9f9f9';

        const additionalEmailsTitle = document.createElement('h5');
        additionalEmailsTitle.textContent = 'Dodatkowe adresy e-mail';
        additionalEmailsTitle.style.margin = '0 0 10px 0';
        additionalEmailsTitle.style.fontSize = '14px';
        additionalEmailsTitle.style.fontWeight = 'bold';
        additionalEmailsTitle.style.color = '#333';

        const additionalEmailsNote = document.createElement('p');
        additionalEmailsNote.textContent =
            'Dodaj adresy kolegów lub menedżerów, którzy również powinni otrzymywać powiadomienia.';
        additionalEmailsNote.style.fontSize = '11px';
        additionalEmailsNote.style.color = '#666';
        additionalEmailsNote.style.margin = '0 0 10px 0';

        // Additional email input and add button
        const additionalEmailInputContainer = document.createElement('div');
        additionalEmailInputContainer.style.display = 'flex';
        additionalEmailInputContainer.style.gap = '8px';
        additionalEmailInputContainer.style.marginBottom = '10px';

        const additionalEmailInput = document.createElement('input');
        additionalEmailInput.type = 'email';
        additionalEmailInput.placeholder = 'colleague@example.com';
        additionalEmailInput.style.flex = '1';
        additionalEmailInput.style.padding = '8px';
        additionalEmailInput.style.border = '1px solid #ccc';
        additionalEmailInput.style.borderRadius = '4px';
        additionalEmailInput.style.fontSize = '12px';

        const addEmailButton = document.createElement('button');
        addEmailButton.textContent = 'Dodaj';
        addEmailButton.type = 'button';
        addEmailButton.style.padding = '8px 12px';
        addEmailButton.style.backgroundColor = '#007bff';
        addEmailButton.style.color = 'white';
        addEmailButton.style.border = 'none';
        addEmailButton.style.borderRadius = '4px';
        addEmailButton.style.fontSize = '12px';
        addEmailButton.style.cursor = 'pointer';

        additionalEmailInputContainer.appendChild(additionalEmailInput);
        additionalEmailInputContainer.appendChild(addEmailButton);

        // Additional emails list
        const additionalEmailsList = document.createElement('div');
        additionalEmailsList.style.maxHeight = '120px';
        additionalEmailsList.style.overflowY = 'auto';

        additionalEmailsContainer.appendChild(additionalEmailsTitle);
        additionalEmailsContainer.appendChild(additionalEmailsNote);
        additionalEmailsContainer.appendChild(additionalEmailInputContainer);
        additionalEmailsContainer.appendChild(additionalEmailsList);

        emailSection.appendChild(emailTitle);
        emailSection.appendChild(emailCheckboxContainer);
        emailSection.appendChild(emailInput);
        emailSection.appendChild(emailNote);
        emailSection.appendChild(additionalEmailsContainer);

        // Windows notifications section
        const windowsSection = document.createElement('div');
        windowsSection.style.marginBottom = '25px';
        windowsSection.style.textAlign = 'left';

        const windowsTitle = document.createElement('h4');
        windowsTitle.textContent = 'Powiadomienia Windows';
        windowsTitle.style.color = '#333';
        windowsTitle.style.marginBottom = '10px';
        windowsTitle.style.fontSize = '16px';

        // Windows enable checkbox
        const windowsCheckboxContainer = document.createElement('div');
        windowsCheckboxContainer.style.marginBottom = '10px';
        windowsCheckboxContainer.style.display = 'flex';
        windowsCheckboxContainer.style.alignItems = 'center';

        const windowsCheckbox = document.createElement('input');
        windowsCheckbox.type = 'checkbox';
        windowsCheckbox.id = 'windowsEnabled';
        windowsCheckbox.style.marginRight = '8px';

        const windowsCheckboxLabel = document.createElement('label');
        windowsCheckboxLabel.htmlFor = 'windowsEnabled';
        windowsCheckboxLabel.textContent = 'Włącz powiadomienia Windows';
        windowsCheckboxLabel.style.fontSize = '14px';

        windowsCheckboxContainer.appendChild(windowsCheckbox);
        windowsCheckboxContainer.appendChild(windowsCheckboxLabel);

        // Windows info note
        const windowsNote = document.createElement('p');
        windowsNote.textContent =
            'Wyświetlaj powiadomienia systemowe Windows po pomyślnej rezerwacji.';
        windowsNote.style.fontSize = '12px';
        windowsNote.style.color = '#666';
        windowsNote.style.margin = '5px 0 0 0';

        windowsSection.appendChild(windowsTitle);
        windowsSection.appendChild(windowsCheckboxContainer);
        windowsSection.appendChild(windowsNote);

        // Buttons container
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.display = 'flex';
        buttonsContainer.style.gap = '10px';
        buttonsContainer.style.marginTop = '25px';

        // Save button
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Zapisz';
        saveButton.style.flex = '1';
        saveButton.style.padding = '12px';
        saveButton.style.backgroundColor = '#00aacc';
        saveButton.style.color = 'white';
        saveButton.style.border = 'none';
        saveButton.style.borderRadius = '4px';
        saveButton.style.cursor = 'pointer';
        saveButton.style.fontSize = '14px';

        // Reset button
        const resetButton = document.createElement('button');
        resetButton.textContent = 'Resetuj';
        resetButton.style.flex = '1';
        resetButton.style.padding = '12px';
        resetButton.style.backgroundColor = '#dc3545';
        resetButton.style.color = 'white';
        resetButton.style.border = 'none';
        resetButton.style.borderRadius = '4px';
        resetButton.style.cursor = 'pointer';
        resetButton.style.fontSize = '14px';

        // Cancel button
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Anuluj';
        cancelButton.style.flex = '1';
        cancelButton.style.padding = '12px';
        cancelButton.style.backgroundColor = '#6c757d';
        cancelButton.style.color = 'white';
        cancelButton.style.border = 'none';
        cancelButton.style.borderRadius = '4px';
        cancelButton.style.cursor = 'pointer';
        cancelButton.style.fontSize = '14px';

        // Function to render additional emails list
        function renderAdditionalEmails(additionalEmails: string[]) {
            additionalEmailsList.innerHTML = '';

            additionalEmails.forEach(email => {
                const emailItem = document.createElement('div');
                emailItem.style.display = 'flex';
                emailItem.style.justifyContent = 'space-between';
                emailItem.style.alignItems = 'center';
                emailItem.style.padding = '5px 8px';
                emailItem.style.backgroundColor = '#fff';
                emailItem.style.border = '1px solid #ddd';
                emailItem.style.borderRadius = '3px';
                emailItem.style.marginBottom = '4px';
                emailItem.style.fontSize = '12px';

                const emailText = document.createElement('span');
                emailText.textContent = email;
                emailText.style.flex = '1';
                emailText.style.color = '#333';

                const removeButton = document.createElement('button');
                removeButton.textContent = '✕';
                removeButton.style.background = 'none';
                removeButton.style.border = 'none';
                removeButton.style.color = '#dc3545';
                removeButton.style.cursor = 'pointer';
                removeButton.style.fontSize = '12px';
                removeButton.style.padding = '2px 6px';
                removeButton.addEventListener('click', async () => {
                    try {
                        const success =
                            await notificationSettingsService.removeAdditionalEmail(email);
                        if (success) {
                            const settings = await notificationSettingsService.loadSettings();
                            renderAdditionalEmails(settings.email.additionalEmails || []);
                        } else {
                            alert('Błąd podczas usuwania adresu e-mail.');
                        }
                    } catch (error) {
                        console.error('Error removing additional email:', error);
                        alert('Błąd podczas usuwania adresu e-mail.');
                    }
                });

                emailItem.appendChild(emailText);
                emailItem.appendChild(removeButton);
                additionalEmailsList.appendChild(emailItem);
            });

            // Show/hide container based on whether there are emails
            if (additionalEmails.length === 0) {
                const emptyMessage = document.createElement('p');
                emptyMessage.textContent = 'Brak dodatkowych adresów e-mail.';
                emptyMessage.style.fontSize = '11px';
                emptyMessage.style.color = '#999';
                emptyMessage.style.fontStyle = 'italic';
                emptyMessage.style.margin = '0';
                emptyMessage.style.textAlign = 'center';
                additionalEmailsList.appendChild(emptyMessage);
            }
        }

        // Add email button functionality
        addEmailButton.addEventListener('click', async () => {
            const email = additionalEmailInput.value.trim();
            if (!email) {
                alert('Proszę wprowadzić adres e-mail.');
                return;
            }

            if (!isValidEmail(email)) {
                alert('Proszę wprowadzić prawidłowy adres e-mail.');
                return;
            }

            try {
                const success = await notificationSettingsService.addAdditionalEmail(email);
                if (success) {
                    additionalEmailInput.value = '';
                    const settings = await notificationSettingsService.loadSettings();
                    renderAdditionalEmails(settings.email.additionalEmails || []);
                } else {
                    alert('Adres e-mail już istnieje na liście lub wystąpił błąd.');
                }
            } catch (error) {
                console.error('Error adding additional email:', error);
                alert('Błąd podczas dodawania adresu e-mail.');
            }
        });

        // Allow adding email with Enter key
        additionalEmailInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') {
                addEmailButton.click();
            }
        });

        // Load existing settings
        notificationSettingsService.loadSettings().then(settings => {
            emailCheckbox.checked = settings.email.enabled;
            emailInput.value = settings.email.userEmail;
            windowsCheckbox.checked = settings.windows.enabled;

            // Render additional emails
            renderAdditionalEmails(settings.email.additionalEmails || []);

            // Enable/disable email input based on checkbox
            emailInput.disabled = !settings.email.enabled;
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
            const emailEnabled = emailCheckbox.checked;
            const userEmail = emailInput.value.trim();
            const windowsEnabled = windowsCheckbox.checked;

            // Validate email if enabled
            if (emailEnabled && (!userEmail || !isValidEmail(userEmail))) {
                alert(
                    'Proszę wprowadzić prawidłowy adres e-mail aby włączyć powiadomienia e-mail.',
                );
                return;
            }

            // Get current additional emails
            const currentSettings = await notificationSettingsService.loadSettings();

            const settings: NotificationSettings = {
                email: {
                    enabled: emailEnabled,
                    userEmail: emailEnabled ? userEmail : '',
                    additionalEmails: currentSettings.email.additionalEmails || [],
                },
                windows: {
                    enabled: windowsEnabled,
                },
                createdAt: Date.now(),
            };

            try {
                const success = await notificationSettingsService.saveSettings(settings);
                if (success) {
                    document.body.removeChild(overlay);
                    document.body.style.height = initialBodyHeight;
                    resolve({
                        email: settings.email,
                        windows: settings.windows,
                    });
                } else {
                    alert('Błąd podczas zapisywania ustawień.');
                }
            } catch (error) {
                alert(`Błąd podczas zapisywania ustawień: ${error}`);
            }
        });

        // Reset button handler
        resetButton.addEventListener('click', async () => {
            if (confirm('Czy na pewno chcesz zresetować ustawienia powiadomień do domyślnych?')) {
                try {
                    await notificationSettingsService.clearSettings();
                    const defaultSettings = await notificationSettingsService.loadSettings();

                    emailCheckbox.checked = defaultSettings.email.enabled;
                    emailInput.value = defaultSettings.email.userEmail;
                    windowsCheckbox.checked = defaultSettings.windows.enabled;

                    // Clear additional emails list
                    renderAdditionalEmails([]);

                    updateEmailInputState();
                } catch (error) {
                    alert(`Błąd podczas resetowania ustawień: ${error}`);
                }
            }
        });

        // Cancel button handler
        cancelButton.addEventListener('click', () => {
            document.body.removeChild(overlay);
            document.body.style.height = initialBodyHeight;
            resolve(null);
        });

        // Close on overlay click
        overlay.addEventListener('click', e => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
                document.body.style.height = initialBodyHeight;
                resolve(null);
            }
        });

        // Append elements
        buttonsContainer.appendChild(saveButton);
        buttonsContainer.appendChild(resetButton);
        buttonsContainer.appendChild(cancelButton);

        modal.appendChild(title);
        modal.appendChild(emailSection);
        modal.appendChild(windowsSection);
        modal.appendChild(buttonsContainer);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Focus email input if checkbox is checked
        if (emailCheckbox.checked) {
            emailInput.focus();
        }
    });
}

// Simple email validation helper
function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
