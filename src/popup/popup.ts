import './popup.css'
import {
    normalizeFormData,
    consoleLog,
    consoleError,
    sortStatusesByPriority,
} from '../utils/utils-function'
import { createConfirmationModal } from './modals/confirmation.modal'
import { Statuses, Actions } from '../data'
import { RetryObjectArray } from '../types/baltichub'
import { authService } from '../services/authService'

function sendMessageToBackground(
    action,
    data,
    options = { updateQueue: true }
) {
    chrome.runtime.sendMessage(
        {
            target: 'background',
            action: action,
            data: data,
        },
        (response) => {
            if (chrome.runtime.lastError) {
                consoleError('Error sending message:', chrome.runtime.lastError)
                return
            }

            // Обработка ответа от background.js
            if (response && response.success) {
                consoleLog(`Action ${action} completed successfully`)
                if (options.updateQueue) {
                    updateQueueDisplay() // Обновление отображения очереди
                }
            } else {
                consoleError(`Action ${action} failed`)
            }
        }
    )
}

async function removeRequestFromRetryQueue(id) {
    return sendMessageToBackground(Actions.REMOVE_REQUEST, { id: id })
}

async function setStatusRequest(id, status, status_message) {
    return sendMessageToBackground(Actions.UPDATE_REQUEST_STATUS, {
        id: id,
        status: status,
        status_message: status_message,
    })
}

async function restoreGroupStates() {
    try {
        const { groupStates = {} } =
            await chrome.storage.local.get('groupStates')

        document
            .querySelectorAll<HTMLElement>('.group-header.toggle-cell')
            .forEach((header) => {
                const groupRow: HTMLElement = header.closest('.group-row')!
                if (!groupRow) return

                const groupId = groupRow.dataset.groupId!
                const isOpen = groupStates[groupId] || false
                groupRow.dataset.isOpen = isOpen
                // Update header state
                header.classList.toggle('open', isOpen)
                const toggleIcon = header.querySelector('.toggle-icon')
                if (toggleIcon) {
                    toggleIcon.textContent = isOpen
                        ? 'expand_less'
                        : 'expand_more'
                }

                // Toggle visibility of child rows
                let nextRow = groupRow.nextElementSibling
                while (
                    nextRow &&
                    !nextRow.querySelector('.group-header.toggle-cell')
                ) {
                    ;(nextRow as HTMLElement).style.display = isOpen
                        ? 'table-row'
                        : 'none'
                    nextRow = nextRow.nextElementSibling
                }
            })
    } catch (error) {
        consoleError('Error restoring group states:', error)
    }
}

/**
 * Delete a group state by ID from Chrome storage
 * @param {string|number} groupId - The ID of the group state to delete
 * @returns {Promise<Object>} - The updated group states object
 */
async function deleteGroupStateById(groupId: string | number): Promise<object> {
    // Get current groupStates from storage
    const { groupStates = {} } = await chrome.storage.local.get('groupStates')

    // Delete the specified group ID if it exists
    if (groupId in groupStates) {
        delete groupStates[groupId]

        // Save the updated groupStates back to storage
        await chrome.storage.local.set({ groupStates })
        consoleLog(`Group state with ID ${groupId} was deleted`)
    } else {
        consoleLog(`Group state with ID ${groupId} does not exist`)
    }

    return groupStates
}

async function clearStateGroups() {
    // Get current groupStates from storage
    const { groupStates = {} } = await chrome.storage.local.get('groupStates')

    if (!!Object.entries(groupStates).length) {
        await chrome.storage.local.set({ groupStates: {} })
        consoleLog(`Group state was cleared`)
    }

    return groupStates
}

// set up google icons
function getStatusIcon(status: string) {
    if (status === Statuses.IN_PROGRESS) return 'loop'
    if (status === Statuses.SUCCESS) return 'check_circle'
    if (status === Statuses.ANOTHER_TASK) return 'check_circle'
    if (status === Statuses.PAUSED) return 'pause_circle'
    if (status === Statuses.AUTHORIZATION_ERROR) return 'report'
    return 'report'
}

function isDisabled(status: string) {
    if (
        status === Statuses.ANOTHER_TASK ||
        status === Statuses.SUCCESS ||
        status === Statuses.ERROR
    )
        return 'disabled'
    return ''
}

function isPlayDisabled(status: string) {
    if (status === Statuses.IN_PROGRESS) return 'disabled'
    return isDisabled(status)
}

function isPauseDisabled(status: string) {
    if (status === Statuses.PAUSED || status === Statuses.AUTHORIZATION_ERROR)
        return 'disabled'
    return isDisabled(status)
}

async function updateQueueDisplay() {
    consoleLog('updateQueueDisplay')
    const isAuthenticated = await authService.isAuthenticated()
    if (!isAuthenticated) {
        return // Don't update the queue if user is not authenticated
    }

    try {
        // Get the queue from storage
        const { retryQueue } = await new Promise<{
            retryQueue: RetryObjectArray
        }>((resolve) => chrome.storage.local.get({ retryQueue: [] }, resolve))

        // Grouping by TvAppId
        const groupedData = retryQueue.reduce(
            (acc: Record<string, RetryObjectArray>, req) => {
                const tvAppId = req.tvAppId
                if (!acc[tvAppId]) acc[tvAppId] = []
                acc[tvAppId].push(req)
                return acc
            },
            {}
        )

        let tableBody = document.getElementById('queueTableBody')!
        tableBody.innerHTML = '' // Clear the table

        const data = Object.entries(groupedData) as [string, RetryObjectArray][]
        // clear states on empty grid
        if (!data.length) {
            clearStateGroups()
        }
        // Populate the table with data from the queue
        data.forEach(([tvAppId, items]) => {
            const statusForGroup = sortStatusesByPriority(
                items.map((item: RetryObjectArray[0]) => item.status)
            )[0]
            const statusIconForGroup = getStatusIcon(statusForGroup)
            const groupRow = document.createElement('tr')
            groupRow.dataset.groupId = tvAppId
            groupRow.classList.add('group-row')
            groupRow.innerHTML = `
        <td class="group-header toggle-cell"><span class="toggle-icon material-icons">expand_more</span></td>
        <td class="group-header status ${statusForGroup}" title="Status kontenera">
                    <span class="status-icon material-icons" style="font-size: 28px;">
                        ${statusIconForGroup}
                    </span></td>
        <td class="group-header">${items[0].driverName ? items[0].driverName : 'Brak nazwy kierowcy'}</td>
        <td class="group-header" title="Nr kontenera">${items[0].containerNumber ? items[0].containerNumber : '-'}</td>
        <td class="group-header actions">
            <button class="group-remove-button remove-button" title="Usuń grupę">
                <span class="material-icons">delete</span>
            </button>
        </td>`
            tableBody.appendChild(groupRow)

            items.forEach((req: RetryObjectArray[0]) => {
                let containerInfo = normalizeFormData(req.body).formData
                const row = document.createElement('tr')
                row.innerHTML = `
                <td></td>
                <td class="status ${req.status}" title="${req.status_message}">
                    <span class="status-icon material-icons" style="font-size: 28px;">
                        ${getStatusIcon(req.status)}
                    </span>
                </td>
                <td>${containerInfo.SlotStart[0].split(' ')[0]}</td>
                <td>${containerInfo.SlotStart[0].split(' ')[1].slice(0, 5)} - ${containerInfo.SlotEnd[0].split(' ')[1].slice(0, 5)}</td>
                <td class="actions">
                    <button class="resume-button" data-id="${req.id}" title="Wznów" ${isPlayDisabled(req.status)}>
                        <span class="material-icons icon">play_arrow</span>
                    </button>
                    <button class="pause-button" data-id="${req.id}" title="Wstrzymaj" ${isPauseDisabled(req.status)}>
                        <span class="material-icons icon">pause</span>
                    </button>
                    <button class="remove-button" data-id="${req.id}" title="Usuń">
                        <span class="material-icons icon">delete</span>
                    </button>
                </td>
            `
                tableBody.appendChild(row)
            })
        })
        // Spellcheck suppression for Polish words
        // kontenera, Brak, nazwy, kierowcy, Usuń, grupę, Wznów, Wstrzymaj

        restoreGroupStates()

        // Add button handlers
        document
            .querySelectorAll<HTMLElement>(
                '.remove-button:not(.group-remove-button)'
            )
            .forEach((btn) => {
                btn.addEventListener('click', () =>
                    removeRequestFromRetryQueue(btn.dataset.id)
                )
            })
        document
            .querySelectorAll<HTMLElement>('.pause-button')
            .forEach((btn) => {
                btn.addEventListener('click', () =>
                    setStatusRequest(
                        btn.dataset.id,
                        'paused',
                        'Zadanie jest wstrzymane'
                    )
                )
            })
        document
            .querySelectorAll<HTMLElement>('.resume-button')
            .forEach((btn) => {
                btn.addEventListener('click', () =>
                    setStatusRequest(
                        btn.dataset.id,
                        'in-progress',
                        'Zadanie jest w trakcie realizacji'
                    )
                )
            })
        document
            .querySelectorAll<HTMLElement>('.group-header.toggle-cell')
            .forEach((header) => {
                header.addEventListener('click', async function () {
                    const groupRow = this.closest<HTMLElement>('.group-row')
                    if (!groupRow) return

                    const groupId = groupRow.dataset.groupId!
                    const toggleIcon = this.querySelector('.toggle-icon')

                    // Toggle open state
                    const isCurrentlyOpen = this.classList.contains('open')
                    this.classList.toggle('open')

                    if (toggleIcon) {
                        toggleIcon.textContent = isCurrentlyOpen
                            ? 'expand_more'
                            : 'expand_less'
                    }

                    // Toggle child rows visibility
                    let nextRow = groupRow.nextElementSibling as HTMLElement
                    while (
                        nextRow &&
                        !nextRow.querySelector<HTMLElement>('.group-header')
                    ) {
                        nextRow.style.display = isCurrentlyOpen
                            ? 'none'
                            : 'table-row'
                        nextRow = nextRow.nextElementSibling as HTMLElement
                    }
                    groupRow.dataset.isOpen = (!isCurrentlyOpen).toString()
                    // Save group state
                    try {
                        const { groupStates = {} } =
                            await chrome.storage.local.get('groupStates')
                        groupStates[groupId] = !isCurrentlyOpen
                        await chrome.storage.local.set({ groupStates })
                    } catch (error) {
                        consoleError('Error saving group state:', error)
                    }
                })
            })
        document
            .querySelectorAll<HTMLElement>('.group-row .group-remove-button')
            .forEach((removeButton) => {
                removeButton.addEventListener('click', async function (event) {
                    event.stopPropagation()

                    const confirmed = await createConfirmationModal(
                        'Na pewno chcesz usunąć całą grupę zadań?'
                    )

                    if (!confirmed) return

                    const groupHeaderRow =
                        this.closest<HTMLElement>('.group-row')
                    if (!groupHeaderRow) return
                    const idsToDelete: string[] = []

                    let nextRow = groupHeaderRow.nextElementSibling
                    while (
                        nextRow &&
                        !nextRow.classList.contains('group-row')
                    ) {
                        const removeBtn =
                            nextRow.querySelector<HTMLElement>('.remove-button')
                        if (removeBtn?.dataset?.id) {
                            idsToDelete.push(removeBtn.dataset.id)
                        }
                        nextRow = nextRow.nextElementSibling
                    }

                    for (const id of idsToDelete) {
                        await removeRequestFromRetryQueue(id)
                    }

                    idsToDelete.forEach((id) => {
                        const row = document
                            .querySelector(`.remove-button[data-id="${id}"]`)
                            ?.closest('tr')
                        if (row) row.remove()
                    })

                    groupHeaderRow.remove()
                    deleteGroupStateById(groupHeaderRow.dataset.groupId!)
                })
            })
    } catch (error) {
        consoleError('Error updating queue display:', error)
    }
}

// Listen for storage changes and update UI when retryQueue changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.retryQueue) {
        consoleLog('Queue data changed, updating UI')
        updateQueueDisplay()
    }
})

async function saveHeaderState(isHidden: boolean) {
    await chrome.storage.local.set({ headerHidden: isHidden })
}

async function restoreHeaderState() {
    const { headerHidden = false } =
        await chrome.storage.local.get('headerHidden')
    const header = document.querySelector('.header') as HTMLElement
    const toggleHeaderIcon = document.getElementById(
        'toggleHeaderIcon'
    ) as HTMLElement
    const mainContent = document.getElementById('mainContent') as HTMLElement
    if (header && toggleHeaderIcon && mainContent) {
        if (headerHidden) {
            header.style.display = 'none'
            toggleHeaderIcon.textContent = 'arrow_drop_down'
            mainContent.classList.add('header-hidden')
        } else {
            header.style.display = ''
            toggleHeaderIcon.textContent = 'arrow_drop_up'
            mainContent.classList.remove('header-hidden')
        }
    }
}

function toggleHeaderVisibility() {
    const header = document.querySelector('.header') as HTMLElement
    const toggleHeaderBtn = document.getElementById(
        'toggleHeaderBtn'
    ) as HTMLButtonElement
    const toggleHeaderIcon = document.getElementById(
        'toggleHeaderIcon'
    ) as HTMLElement
    const mainContent = document.getElementById('mainContent') as HTMLElement
    if (header && toggleHeaderBtn && toggleHeaderIcon && mainContent) {
        // Инициализация состояния из storage
        chrome.storage.local.get('headerHidden', (result) => {
            let headerHidden = result.headerHidden || false
            // Установить правильный title при инициализации
            toggleHeaderBtn.title = headerHidden ? 'Pokaż nagłówek' : 'Ukryj'
            toggleHeaderBtn.addEventListener('click', async () => {
                headerHidden = !headerHidden
                if (headerHidden) {
                    header.style.display = 'none'
                    toggleHeaderIcon.textContent = 'arrow_drop_down'
                    mainContent.classList.add('header-hidden')
                    toggleHeaderBtn.title = 'Pokaż'
                } else {
                    header.style.display = ''
                    toggleHeaderIcon.textContent = 'arrow_drop_up'
                    mainContent.classList.remove('header-hidden')
                    toggleHeaderBtn.title = 'Ukryj'
                }
                await saveHeaderState(headerHidden)
            })
            // expose for UI control
            ;(window as any)._toggleHeaderReset = async () => {
                headerHidden = false
                header.style.display = ''
                toggleHeaderIcon.textContent = 'arrow_drop_up'
                mainContent.classList.remove('header-hidden')
                toggleHeaderBtn.title = 'Ukryj'
                await saveHeaderState(false)
            }
        })
    }
}

// Update the queue when the popup is opened
document.addEventListener('DOMContentLoaded', () => {
    restoreGroupStates()
    updateQueueDisplay()
    toggleHeaderVisibility()
    restoreHeaderState()
})

// DOM Elements
const authContainer = document.getElementById('authContainer')!
const mainContent = document.getElementById('mainContent')!
const loginForm = document.getElementById('loginForm')!
const registerForm = document.getElementById('registerForm')!
const userEmail = document.getElementById('userEmail')!

// Login form elements
const loginEmail = document.getElementById('loginEmail') as HTMLInputElement
const loginPassword = document.getElementById(
    'loginPassword'
) as HTMLInputElement
const loginButton = document.getElementById('loginButton')!
const showRegister = document.getElementById('showRegister')!

// Register form elements
const registerEmail = document.getElementById(
    'registerEmail'
) as HTMLInputElement
const registerPassword = document.getElementById(
    'registerPassword'
) as HTMLInputElement
const registerButton = document.getElementById('registerButton')!
const showLogin = document.getElementById('showLogin')!

// Device unbind form elements
const unbindForm = document.getElementById('unbindForm')!
const unbindEmail = document.getElementById('unbindEmail') as HTMLInputElement
const unbindPassword = document.getElementById(
    'unbindPassword'
) as HTMLInputElement
const unbindButton = document.getElementById('unbindButton')!
const showUnbind = document.getElementById('showUnbind')!
const hideUnbind = document.getElementById('hideUnbind')!

// Logout button
const logoutButton = document.getElementById('logoutButton')!

// Error handling elements
const loginError = document.getElementById('loginError')!
const registerError = document.getElementById('registerError')!
const unbindError = document.getElementById('unbindError')!

function showError(element: HTMLElement, message: string) {
    element.textContent = message
    element.classList.add('show')

    // Hide error after 5 seconds
    setTimeout(() => {
        element.classList.remove('show')
    }, 5000)
}

function clearErrors() {
    loginError.classList.remove('show')
    registerError.classList.remove('show')
    unbindError.classList.remove('show')
    loginError.textContent = ''
    registerError.textContent = ''
    unbindError.textContent = ''
}

let manualRegisterMode = false
let isRegistering = false
let isLoggingIn = false
let cameFromAuthenticated = false

// Event Listeners
loginButton.addEventListener('click', (e) => {
    e.preventDefault()
    handleLogin()
    updateQueueDisplay()
})
registerButton.addEventListener('click', (e) => {
    e.preventDefault()
    handleRegister()
    updateQueueDisplay()
})

// Fix registration form toggle
showRegister.addEventListener('click', (e) => {
    e.preventDefault()
    loginForm.classList.add('hidden')
    registerForm.classList.remove('hidden')
    clearErrors()
    manualRegisterMode = true
})

showLogin.addEventListener('click', (e) => {
    e.preventDefault()
    registerForm.classList.add('hidden')
    loginForm.classList.remove('hidden')
    clearErrors()
    manualRegisterMode = false
})

logoutButton.addEventListener('click', async (e) => {
    e.preventDefault()
    const confirmed = await createConfirmationModal(
        'Na pewno chcesz się wylogować?'
    )
    if (confirmed) {
        handleLogout()
    }
})

// Add event listeners for unbind form
unbindButton.addEventListener('click', (e) => {
    e.preventDefault()
    handleUnbind()
})

// Add unbind button to authenticated UI
const unbindDeviceButton = document.getElementById('unbindDeviceButton')!
unbindDeviceButton.addEventListener('click', (e) => {
    e.preventDefault()
    cameFromAuthenticated = true
    mainContent.classList.add('hidden')
    authContainer.classList.remove('hidden')
    unbindForm.classList.remove('hidden')
    loginForm.classList.add('hidden')
    registerForm.classList.add('hidden')
    backToAppButton.classList.remove('hidden')
    hideUnbind.classList.add('hidden') // Hide Back to Login button
    clearErrors()
})

// Update showUnbind handler
showUnbind.addEventListener('click', (e) => {
    e.preventDefault()
    cameFromAuthenticated = false
    loginForm.classList.add('hidden')
    registerForm.classList.add('hidden')
    unbindForm.classList.remove('hidden')
    backToAppButton.classList.add('hidden')
    hideUnbind.classList.remove('hidden') // Show Back to Login button
    clearErrors()
})

// Update hideUnbind handler
hideUnbind.addEventListener('click', (e) => {
    e.preventDefault()
    unbindForm.classList.add('hidden')
    if (cameFromAuthenticated) {
        mainContent.classList.remove('hidden')
        authContainer.classList.add('hidden')
    } else {
        loginForm.classList.remove('hidden')
    }
    backToAppButton.classList.add('hidden')
    hideUnbind.classList.remove('hidden') // Reset button visibility
    clearErrors()
})

// Add back button handler
const backToAppButton = document.getElementById('backToAppButton')!
backToAppButton.addEventListener('click', (e) => {
    e.preventDefault()
    cameFromAuthenticated = false
    authContainer.classList.add('hidden')
    mainContent.classList.remove('hidden')
    unbindForm.classList.add('hidden')
    clearErrors()
})

// Prevent form submit for login and register forms
loginForm.addEventListener('submit', (e) => {
    e.preventDefault()
})
registerForm.addEventListener('submit', (e) => {
    e.preventDefault()
})

// Functions
async function handleLogin() {
    consoleLog('handleLogin called', Date.now(), Math.random())
    if (isLoggingIn) return
    isLoggingIn = true
    try {
        clearErrors()
        if (!loginEmail.value || !loginPassword.value) {
            showError(loginError, 'Please fill in all fields')
            return
        }
        const user = await authService.login(
            loginEmail.value,
            loginPassword.value
        )
        if (user) {
            showAuthenticatedUI(user)
            manualRegisterMode = false
        }
    } catch (error) {
        const errorMessage =
            error instanceof Error ? error.message : 'An error occurred'
        const friendlyMessage = getFriendlyErrorMessage(errorMessage)
        showError(loginError, friendlyMessage)
    } finally {
        isLoggingIn = false
    }
}

async function handleRegister() {
    if (isRegistering) return
    isRegistering = true
    try {
        clearErrors()
        if (!registerEmail.value || !registerPassword.value) {
            showError(registerError, 'Please fill in all fields')
            return
        }
        if (registerPassword.value.length < 6) {
            showError(
                registerError,
                'Password must be at least 6 characters long'
            )
            return
        }
        const user = await authService.register(
            registerEmail.value,
            registerPassword.value
        )
        if (user) {
            // Показываем сообщение о необходимости подтверждения email
            registerForm.classList.add('hidden')
            showEmailConfirmationMessage(registerEmail.value)
            manualRegisterMode = false
        }
    } catch (error: any) {
        const friendlyMessage = getFriendlyErrorMessage(
            error?.code ? error : error?.message || error
        )
        showError(registerError, friendlyMessage)
    } finally {
        isRegistering = false
    }
}

function showEmailConfirmationMessage(email: string) {
    // Создаём или находим контейнер для сообщения
    let confirmMsg = document.getElementById('emailConfirmMsg')
    if (!confirmMsg) {
        confirmMsg = document.createElement('div')
        confirmMsg.id = 'emailConfirmMsg'
        confirmMsg.className = 'email-confirm-message'
        authContainer.appendChild(confirmMsg)
    }
    confirmMsg.innerHTML = `
        Please confirm your email address (${email}) via the link sent to your inbox.
        <br>
        <button id="backToLoginBtn" style="margin-top:10px;">OK</button>
    `
    confirmMsg.classList.add('show')

    // Функция возврата к форме входа и скрытия сообщения
    function hideConfirmMsg() {
        confirmMsg?.classList.remove('show')
        registerForm.classList.add('hidden')
        loginForm.classList.remove('hidden')
    }

    // Обработчик кнопки
    const backBtn = document.getElementById('backToLoginBtn')
    if (backBtn) {
        backBtn.addEventListener('click', hideConfirmMsg)
    }

    // Автоматическое скрытие через 7 секунд
    setTimeout(hideConfirmMsg, 7000)
}

async function handleLogout() {
    try {
        // Pause all in-progress tasks before logout
        const { retryQueue } = await chrome.storage.local.get({
            retryQueue: [],
        })
        for (const item of retryQueue) {
            if (item.status === Statuses.IN_PROGRESS) {
                await setStatusRequest(
                    item.id,
                    Statuses.PAUSED,
                    'Task paused due to logout'
                )
            }
        }

        await authService.logout()
        showUnauthenticatedUI()
    } catch (error) {
        alert('Logout failed: ' + (error as Error).message)
    }
}

async function handleUnbind() {
    if (!unbindEmail.value || !unbindPassword.value) {
        showError(unbindError, 'Please fill in all fields')
        return
    }

    try {
        // Pause all retry queue items before unbinding
        const { retryQueue } = await chrome.storage.local.get({
            retryQueue: [],
        })
        for (const item of retryQueue) {
            await setStatusRequest(
                item.id,
                Statuses.PAUSED,
                'Task paused due to device unbinding'
            )
        }

        await authService.unbindDevice(unbindEmail.value, unbindPassword.value)

        // After successful unbinding, logout and show login form
        await authService.logout()
        cameFromAuthenticated = false
        unbindForm.classList.add('hidden')
        loginForm.classList.remove('hidden')
        backToAppButton.classList.add('hidden')
        hideUnbind.classList.remove('hidden') // Reset button visibility
        clearErrors()
        // Clear the form
        unbindEmail.value = ''
        unbindPassword.value = ''
        // Show unauthenticated UI
        showUnauthenticatedUI()
    } catch (error) {
        const errorMessage =
            error instanceof Error ? error.message : 'An error occurred'
        const friendlyMessage = getFriendlyErrorMessage(errorMessage)
        showError(unbindError, friendlyMessage)
    }
}

function getFriendlyErrorMessage(
    errorMessage: string | { code?: string; message?: string }
): string {
    if (
        typeof errorMessage === 'string' &&
        errorMessage.includes('Device ID mismatch')
    ) {
        return 'Próbujesz się zalogować z nowego urządzenia. Zaloguj się z tego samego urządzenia z którego się rejestrowałeś'
    }

    const errorMap: { [key: string]: string } = {
        over_email_send_rate_limit:
            'Za dużo prób. Poczekaj minutę i spróbuj ponownie.',
        email_exists: 'Użytkownik z tym adresem email już istnieje.',
        user_already_exists: 'Użytkownik z tymi danymi już istnieje.',
        email_address_invalid:
            'Nieprawidłowy adres email. Użyj prawdziwego adresu.',
        email_not_confirmed:
            'Potwierdź swój adres email poprzez link w wiadomości.',
        invalid_credentials: 'Nieprawidłowy email lub hasło.',
        weak_password: 'Hasło jest zbyt proste. Użyj silniejszego hasła.',
        signup_disabled: 'Rejestracja nowych użytkowników jest wyłączona.',
        bad_jwt: 'Błąd autoryzacji. Spróbuj zalogować się ponownie.',
        session_expired: 'Sesja wygasła. Zaloguj się ponownie.',
        no_authorization: 'Wymagana autoryzacja. Zaloguj się.',
        over_request_rate_limit: 'Za dużo zapytań. Spróbuj później.',
        captcha_failed: 'Błąd weryfikacji CAPTCHA. Spróbuj ponownie.',
        password_should_be_at_least_6_characters:
            'Hasło musi mieć co najmniej 6 znaków.',
        'rate limit exceeded': 'Za dużo prób. Spróbuj ponownie później.',
        user_banned: 'Twoje konto jest zablokowane.',
    }

    // Если error это объект с code/message
    if (typeof errorMessage === 'object' && errorMessage !== null) {
        if (errorMessage.code && errorMap[errorMessage.code]) {
            return errorMap[errorMessage.code]
        }
        if (errorMessage.message) {
            return errorMessage.message
        }
    }

    // Если error это строка в формате JSON
    if (typeof errorMessage === 'string') {
        try {
            const errObj = JSON.parse(errorMessage)
            if (errObj.code && errorMap[errObj.code]) {
                return errorMap[errObj.code]
            }
            if (errObj.message) {
                return errObj.message
            }
        } catch {}
        if (errorMap[errorMessage]) return errorMap[errorMessage]
    }

    return typeof errorMessage === 'string'
        ? errorMessage
        : 'Inccorrect or unknown error occurred. Please try again later.'
}

function showAuthenticatedUI(user: { email: string }) {
    clearErrors()
    authContainer.classList.add('hidden')
    mainContent.classList.remove('hidden')
    userEmail.textContent = user.email
    // Кнопка toggleHeaderBtn всегда видима для авторизованного пользователя
    const toggleHeaderBtn = document.getElementById(
        'toggleHeaderBtn'
    ) as HTMLButtonElement
    if (toggleHeaderBtn) toggleHeaderBtn.style.display = ''
    restoreHeaderState()
    updateQueueDisplay()
}

function showUnauthenticatedUI() {
    clearErrors()
    authContainer.classList.remove('hidden')
    mainContent.classList.add('hidden')
    // Скрываем toggleHeaderBtn только для неавторизованного пользователя
    const toggleHeaderBtn = document.getElementById(
        'toggleHeaderBtn'
    ) as HTMLButtonElement
    if (toggleHeaderBtn) toggleHeaderBtn.style.display = 'none'
    restoreHeaderState()
    if (manualRegisterMode) {
        loginForm.classList.add('hidden')
        registerForm.classList.remove('hidden')
    } else {
        loginForm.classList.remove('hidden')
        registerForm.classList.add('hidden')
    }
    loginEmail.value = ''
    loginPassword.value = ''
    registerEmail.value = ''
    registerPassword.value = ''
}

// Check authentication status on load
async function checkAuth() {
    const isAuthenticated = await authService.isAuthenticated()
    if (isAuthenticated) {
        const user = await authService.getCurrentUser()
        if (user) {
            showAuthenticatedUI(user)
        } else {
            showUnauthenticatedUI()
        }
    } else {
        showUnauthenticatedUI()
    }
}

// Add session check interval
setInterval(checkAuth, 60000) // Check every minute

// Initialize
checkAuth()
