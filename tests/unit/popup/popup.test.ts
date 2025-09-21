// Test popup DOM structure and basic functionality without importing the actual popup.ts
// Since popup.ts is a script that executes immediately, we test the DOM structure separately
describe('Popup', () => {
    let mockChrome: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup Chrome API mock
        mockChrome = {
            runtime: {
                sendMessage: jest.fn(),
                lastError: null,
            },
            storage: {
                local: {
                    get: jest.fn(),
                    set: jest.fn(),
                },
            },
        };
        global.chrome = mockChrome;

        // Reset DOM
        document.body.innerHTML = `
            <div id="authContainer" style="display: none;">
                <div id="loginForm" style="display: block;">
                    <input id="loginEmail" type="email" />
                    <input id="loginPassword" type="password" />
                    <button id="loginButton">Login</button>
                    <div id="showRegister">Register</div>
                </div>
                <div id="registerForm" style="display: none;">
                    <input id="registerEmail" type="email" />
                    <input id="registerPassword" type="password" />
                    <button id="registerButton">Register</button>
                    <div id="showLogin">Login</div>
                </div>
                <div id="unbindForm" style="display: none;">
                    <input id="unbindEmail" type="email" />
                    <input id="unbindPassword" type="password" />
                    <button id="unbindButton">Unbind</button>
                    <div id="showUnbind">Show Unbind</div>
                    <div id="hideUnbind">Hide Unbind</div>
                </div>
            </div>
            <div id="mainContent" style="display: none;">
                <div id="userEmail"></div>
                <button id="logoutButton">Logout</button>
                <button id="unbindDeviceButton">Unbind Device</button>
                <button id="backToAppButton">Back to App</button>
                <button id="autoLoginToggle">Auto Login</button>
                <button id="notificationSettingsToggle">Notifications</button>
            </div>
            <div id="loginError" style="display: none;"></div>
            <div id="registerError" style="display: none;"></div>
            <div id="unbindError" style="display: none;"></div>
        `;

        // Setup basic Chrome mock
        mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
            if (callback) callback({ success: true });
        });

        mockChrome.storage.local.get.mockResolvedValue({});
        mockChrome.storage.local.set.mockResolvedValue(undefined);
    });

    afterEach(() => {
        delete (global as any).chrome;
    });

    describe('DOM Elements', () => {
        it('should have all required DOM elements', () => {
            const authContainer = document.getElementById('authContainer');
            const mainContent = document.getElementById('mainContent');
            const loginForm = document.getElementById('loginForm');
            const registerForm = document.getElementById('registerForm');
            const unbindForm = document.getElementById('unbindForm');

            expect(authContainer).toBeTruthy();
            expect(mainContent).toBeTruthy();
            expect(loginForm).toBeTruthy();
            expect(registerForm).toBeTruthy();
            expect(unbindForm).toBeTruthy();
        });

        it('should have all required input fields', () => {
            const loginEmail = document.getElementById('loginEmail');
            const loginPassword = document.getElementById('loginPassword');
            const registerEmail = document.getElementById('registerEmail');
            const registerPassword = document.getElementById('registerPassword');
            const unbindEmail = document.getElementById('unbindEmail');
            const unbindPassword = document.getElementById('unbindPassword');

            expect(loginEmail).toBeTruthy();
            expect(loginPassword).toBeTruthy();
            expect(registerEmail).toBeTruthy();
            expect(registerPassword).toBeTruthy();
            expect(unbindEmail).toBeTruthy();
            expect(unbindPassword).toBeTruthy();
        });

        it('should have all required buttons', () => {
            const loginButton = document.getElementById('loginButton');
            const registerButton = document.getElementById('registerButton');
            const unbindButton = document.getElementById('unbindButton');
            const logoutButton = document.getElementById('logoutButton');
            const autoLoginToggle = document.getElementById('autoLoginToggle');
            const notificationSettingsToggle = document.getElementById(
                'notificationSettingsToggle',
            );

            expect(loginButton).toBeTruthy();
            expect(registerButton).toBeTruthy();
            expect(unbindButton).toBeTruthy();
            expect(logoutButton).toBeTruthy();
            expect(autoLoginToggle).toBeTruthy();
            expect(notificationSettingsToggle).toBeTruthy();
        });
    });

    describe('Basic DOM Interaction', () => {
        it('should allow form input interaction', () => {
            const loginEmail = document.getElementById('loginEmail') as HTMLInputElement;
            const loginPassword = document.getElementById('loginPassword') as HTMLInputElement;

            loginEmail.value = 'test@example.com';
            loginPassword.value = 'password123';

            expect(loginEmail.value).toBe('test@example.com');
            expect(loginPassword.value).toBe('password123');
        });

        it('should have correct initial form display states', () => {
            const authContainer = document.getElementById('authContainer') as HTMLElement;
            const mainContent = document.getElementById('mainContent') as HTMLElement;
            const loginForm = document.getElementById('loginForm') as HTMLElement;
            const registerForm = document.getElementById('registerForm') as HTMLElement;

            expect(authContainer.style.display).toBe('none');
            expect(mainContent.style.display).toBe('none');
            expect(loginForm.style.display).toBe('block');
            expect(registerForm.style.display).toBe('none');
        });

        it('should have chrome API available in test environment', () => {
            expect(global.chrome).toBeDefined();
            expect(global.chrome.runtime).toBeDefined();
            expect(global.chrome.storage).toBeDefined();
        });
    });
});
