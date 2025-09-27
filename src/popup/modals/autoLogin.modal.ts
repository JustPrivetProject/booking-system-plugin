import type { AutoLoginCredentials } from '../../services/autoLoginService';
import { autoLoginService } from '../../services/autoLoginService';

export function showAutoLoginModal(): Promise<AutoLoginCredentials | null> {
    return new Promise(resolve => {
        const bodyElement = document.querySelector('body');
        const initialBodyHeight = bodyElement?.style.height || '';
        document.body.style.height = '280px';

        // Handle escape key press
        const handleEscapeKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeModal(null);
            }
        };

        // Function to show status message (will be defined after statusMessage element is created)
        let showStatusMessage: (message: string, isSuccess?: boolean) => void = () => {};

        const overlay = document.createElement('div');

        // Function to properly close modal and clean up
        const closeModal = (result: AutoLoginCredentials | null = null) => {
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
        modal.style.maxWidth = '400px';
        modal.style.width = '90%';

        const title = document.createElement('h3');
        title.textContent = 'Ustawienia Auto-Login';
        title.style.marginBottom = '20px';
        title.style.color = '#00aacc';
        title.style.fontSize = '18px';

        const loginInput = document.createElement('input');
        loginInput.type = 'text';
        loginInput.placeholder = 'Login';
        loginInput.style.width = '100%';
        loginInput.style.padding = '10px';
        loginInput.style.marginBottom = '10px';
        loginInput.style.border = '1px solid #ccc';
        loginInput.style.borderRadius = '4px';
        loginInput.style.boxSizing = 'border-box';

        // Password input container with toggle visibility button
        const passwordContainer = document.createElement('div');
        passwordContainer.style.position = 'relative';
        passwordContainer.style.width = '100%';
        passwordContainer.style.marginBottom = '15px';

        const passwordInput = document.createElement('input');
        passwordInput.type = 'password';
        passwordInput.placeholder = 'Hasło';
        passwordInput.style.width = '100%';
        passwordInput.style.padding = '10px 40px 10px 10px'; // Extra padding on right for the eye icon
        passwordInput.style.border = '1px solid #ccc';
        passwordInput.style.borderRadius = '4px';
        passwordInput.style.boxSizing = 'border-box';

        const togglePasswordButton = document.createElement('button');
        togglePasswordButton.type = 'button';
        togglePasswordButton.innerHTML = '👁️';
        togglePasswordButton.style.position = 'absolute';
        togglePasswordButton.style.right = '10px';
        togglePasswordButton.style.top = '50%';
        togglePasswordButton.style.transform = 'translateY(-50%)';
        togglePasswordButton.style.background = 'none';
        togglePasswordButton.style.border = 'none';
        togglePasswordButton.style.cursor = 'pointer';
        togglePasswordButton.style.fontSize = '16px';
        togglePasswordButton.style.padding = '0';
        togglePasswordButton.style.width = '20px';
        togglePasswordButton.style.height = '20px';
        togglePasswordButton.style.display = 'flex';
        togglePasswordButton.style.alignItems = 'center';
        togglePasswordButton.style.justifyContent = 'center';
        togglePasswordButton.title = 'Pokaż/ukryj hasło';

        // Toggle password visibility
        let isPasswordVisible = false;
        togglePasswordButton.addEventListener('click', () => {
            isPasswordVisible = !isPasswordVisible;
            passwordInput.type = isPasswordVisible ? 'text' : 'password';
            togglePasswordButton.innerHTML = isPasswordVisible ? '🙈' : '👁️';
        });

        passwordContainer.appendChild(passwordInput);
        passwordContainer.appendChild(togglePasswordButton);

        const infoNote = document.createElement('p');
        infoNote.textContent =
            'Twoje dane logowania są przechowywane lokalnie i używane tylko do automatycznego logowania.';
        infoNote.style.fontSize = '12px';
        infoNote.style.color = '#666';
        infoNote.style.marginBottom = '20px';
        infoNote.style.fontStyle = 'italic';

        // Status message container
        const statusMessage = document.createElement('div');
        statusMessage.style.marginTop = '10px';
        statusMessage.style.padding = '8px 12px';
        statusMessage.style.borderRadius = '4px';
        statusMessage.style.fontSize = '12px';
        statusMessage.style.display = 'none';
        statusMessage.style.textAlign = 'center';

        // Define showStatusMessage function now that statusMessage exists
        showStatusMessage = (message: string, isSuccess: boolean = true) => {
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

        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.display = 'flex';
        buttonsContainer.style.justifyContent = 'space-between';
        buttonsContainer.style.gap = '10px';

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

        const clearButton = document.createElement('button');
        clearButton.innerHTML = '🗑 Wyczyść';
        clearButton.style.padding = '10px 20px';
        clearButton.style.backgroundColor = '#ff6b6b'; // Coral/red color like in the other modal
        clearButton.style.color = 'white';
        clearButton.style.border = 'none';
        clearButton.style.borderRadius = '6px';
        clearButton.style.cursor = 'pointer';
        clearButton.style.fontSize = '14px';
        clearButton.style.fontWeight = '500';
        clearButton.style.display = 'flex';
        clearButton.style.alignItems = 'center';
        clearButton.style.gap = '6px';

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

        // Load existing credentials if available
        autoLoginService.loadCredentials().then(credentials => {
            if (credentials) {
                // Check if credentials are valid (not corrupted)
                const isLoginValid =
                    typeof credentials.login === 'string' &&
                    credentials.login.length > 0 &&
                    !credentials.login.includes('□') &&
                    !credentials.login.includes('\\');

                const isPasswordValid =
                    typeof credentials.password === 'string' && credentials.password.length > 0;

                if (isLoginValid && isPasswordValid) {
                    loginInput.value = credentials.login || '';
                    passwordInput.value = credentials.password || '';
                } else {
                    // Clear corrupted credentials
                    autoLoginService.clearCredentials();
                    loginInput.value = '';
                    passwordInput.value = '';
                }
            }
        });

        saveButton.addEventListener('click', async () => {
            // Disable button during save to prevent multiple clicks
            saveButton.disabled = true;
            saveButton.innerHTML = '⏳ Zapisywanie...';
            updateSaveButtonState();

            const login = loginInput.value.trim();
            const password = passwordInput.value.trim();

            if (!login || !password) {
                showStatusMessage('❌ Proszę wypełnić wszystkie pola.', false);
                // Re-enable button
                saveButton.disabled = false;
                saveButton.innerHTML = '✓ Zapisz';
                updateSaveButtonState();
                return;
            }

            const credentials: AutoLoginCredentials = { login, password };

            try {
                showStatusMessage('💾 Zapisywanie danych...', true);

                await autoLoginService.saveCredentials(credentials);

                showStatusMessage('✅ Dane zostały zapisane pomyślnie!', true);
            } catch (error) {
                showStatusMessage(`❌ Błąd podczas zapisywania danych: ${error}`, false);
            } finally {
                // Re-enable button
                saveButton.disabled = false;
                saveButton.innerHTML = '✓ Zapisz';
                updateSaveButtonState();
            }
        });

        clearButton.addEventListener('click', async () => {
            // For now, we'll skip the confirmation dialog to avoid using confirm
            try {
                showStatusMessage('🔄 Czyszczenie danych...', true);

                await autoLoginService.clearCredentials();
                loginInput.value = '';
                passwordInput.value = '';

                showStatusMessage('✅ Dane auto-login zostały wyczyszczone.', true);
            } catch (error) {
                showStatusMessage(`❌ Błąd podczas czyszczenia danych: ${error}`, false);
            }
        });

        cancelButton.addEventListener('click', () => {
            closeModal(null);
        });

        buttonsContainer.appendChild(saveButton);
        buttonsContainer.appendChild(clearButton);
        buttonsContainer.appendChild(cancelButton);

        modal.appendChild(title);
        modal.appendChild(loginInput);
        modal.appendChild(passwordContainer);
        modal.appendChild(infoNote);
        modal.appendChild(statusMessage);
        modal.appendChild(buttonsContainer);

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
