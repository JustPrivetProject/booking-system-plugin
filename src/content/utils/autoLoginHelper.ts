import { Actions } from '../../data'

export interface AutoLoginCredentials {
    login: string
    password: string
}

export const autoLoginHelper = {
    /**
     * Load auto-login credentials from background
     */
    async loadCredentials(): Promise<AutoLoginCredentials | null> {
        return new Promise((resolve) => {
            try {
                if (!chrome.runtime || !chrome.runtime.sendMessage) {
                    console.warn(
                        '[content] Chrome runtime not available for auto-login'
                    )
                    resolve(null)
                    return
                }

                // Add timeout to prevent hanging
                const timeout = setTimeout(() => {
                    console.warn('[content] Auto-login credentials timeout')
                    resolve(null)
                }, 5000)

                chrome.runtime.sendMessage(
                    { action: Actions.LOAD_AUTO_LOGIN_CREDENTIALS },
                    (response) => {
                        clearTimeout(timeout)

                        if (chrome.runtime.lastError) {
                            console.warn(
                                '[content] Runtime error in auto-login:',
                                chrome.runtime.lastError
                            )
                            resolve(null)
                            return
                        }

                        if (!response) {
                            console.warn(
                                '[content] No response from background for auto-login'
                            )
                            resolve(null)
                            return
                        }

                        if (response.success && response.credentials) {
                            resolve(response.credentials)
                        } else {
                            resolve(null)
                        }
                    }
                )
            } catch (error) {
                console.warn(
                    '[content] Error loading auto-login credentials:',
                    error
                )
                resolve(null)
            }
        })
    },

    /**
     * Check if auto-login is enabled
     */
    async isEnabled(): Promise<boolean> {
        try {
            const credentials = await this.loadCredentials()
            return !!credentials
        } catch (error) {
            console.warn('Failed to check auto-login status:', error)
            return false
        }
    },

    /**
     * Fill login form with auto-login credentials
     */
    fillLoginForm(credentials: AutoLoginCredentials): boolean {
        const LOGIN_INPUT_SELECTOR = '#UserName'
        const PASSWORD_INPUT_SELECTOR = '#Password'

        const loginInput =
            document.querySelector<HTMLInputElement>(LOGIN_INPUT_SELECTOR)
        const passwordInput = document.querySelector<HTMLInputElement>(
            PASSWORD_INPUT_SELECTOR
        )

        if (loginInput && passwordInput) {
            loginInput.value = credentials.login
            passwordInput.value = credentials.password

            // Trigger input events to ensure the form recognizes the values
            loginInput.dispatchEvent(new Event('input', { bubbles: true }))
            passwordInput.dispatchEvent(new Event('input', { bubbles: true }))

            return true
        }

        return false
    },
}
