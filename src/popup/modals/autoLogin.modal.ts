import type { AutoLoginCredentials } from '../../services/autoLoginService';
import { autoLoginService } from '../../services/autoLoginService';

export function showAutoLoginModal(): Promise<AutoLoginCredentials | null> {
    return new Promise(resolve => {
        const initialBodyHeight = document.querySelector('body')!.style.height;
        document.body.style.height = '280px';

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

        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.display = 'flex';
        buttonsContainer.style.justifyContent = 'space-between';
        buttonsContainer.style.gap = '10px';

        const saveButton = document.createElement('button');
        saveButton.textContent = '✅ Zapisz';
        saveButton.style.padding = '10px 20px';
        saveButton.style.backgroundColor = '#00aacc';
        saveButton.style.color = 'white';
        saveButton.style.border = 'none';
        saveButton.style.borderRadius = '4px';
        saveButton.style.cursor = 'pointer';
        saveButton.style.flex = '1';

        const clearButton = document.createElement('button');
        clearButton.textContent = '🗑️ Wyczyść';
        clearButton.style.padding = '10px 20px';
        clearButton.style.backgroundColor = '#ff6b6b';
        clearButton.style.color = 'white';
        clearButton.style.border = 'none';
        clearButton.style.borderRadius = '4px';
        clearButton.style.cursor = 'pointer';
        clearButton.style.flex = '1';

        const cancelButton = document.createElement('button');
        cancelButton.textContent = '❌ Anuluj';
        cancelButton.style.padding = '10px 20px';
        cancelButton.style.backgroundColor = '#f0f0f0';
        cancelButton.style.color = '#333';
        cancelButton.style.border = 'none';
        cancelButton.style.borderRadius = '4px';
        cancelButton.style.cursor = 'pointer';
        cancelButton.style.flex = '1';

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
                    console.log('Detected corrupted auto-login credentials, clearing...');
                    autoLoginService.clearCredentials();
                    loginInput.value = '';
                    passwordInput.value = '';
                }
            }
        });

        saveButton.addEventListener('click', async () => {
            const login = loginInput.value.trim();
            const password = passwordInput.value.trim();

            if (!login || !password) {
                alert('Proszę wypełnić wszystkie pola.');
                return;
            }

            const credentials: AutoLoginCredentials = { login, password };

            try {
                await autoLoginService.saveCredentials(credentials);
                document.body.removeChild(overlay);
                document.body.style.height = initialBodyHeight;
                resolve(credentials);
            } catch (error) {
                alert(`Błąd podczas zapisywania danych: ${error}`);
            }
        });

        clearButton.addEventListener('click', async () => {
            try {
                await autoLoginService.clearCredentials();
                loginInput.value = '';
                passwordInput.value = '';
                alert('Dane auto-login zostały wyczyszczone.');
            } catch (error) {
                alert(`Błąd podczas czyszczenia danych: ${error}`);
            }
        });

        cancelButton.addEventListener('click', () => {
            document.body.removeChild(overlay);
            document.body.style.height = initialBodyHeight;
            resolve(null);
        });

        buttonsContainer.appendChild(saveButton);
        buttonsContainer.appendChild(clearButton);
        buttonsContainer.appendChild(cancelButton);

        modal.appendChild(title);
        modal.appendChild(loginInput);
        modal.appendChild(passwordContainer);
        modal.appendChild(infoNote);
        modal.appendChild(buttonsContainer);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    });
}
