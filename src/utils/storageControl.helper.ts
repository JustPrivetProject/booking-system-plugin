/**
 * Получает значение из chrome.storage.local
 * @param {string|string[]} keys — ключ или массив ключей
 * @returns {Promise<object>}
 */
export function getStorage<T extends string | string[]>(
    keys: T
): Promise<{ [K in T extends string ? T : T[number]]: any }> {
    return new Promise((resolve) => {
        chrome.storage.local.get(keys, (result) => {
            return resolve(
                result as { [K in T extends string ? T : T[number]]: any }
            )
        })
    })
}

/**
 * Устанавливает значение в chrome.storage.local
 * @param {object} data — объект ключ-значение
 * @returns {Promise<void>}
 */
export function setStorage(data: object): Promise<void> {
    return new Promise<void>((resolve) => {
        chrome.storage.local.set(data, () => {
            resolve()
        })
    })
}

/**
 * Подписка на изменения в chrome.storage.local
 * @param {string} key — ключ, за которым следим
 * @param {(newValue: any, oldValue: any) => void} callback
 */
export function onStorageChange(key, callback) {
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[key]) {
            callback(changes[key].newValue, changes[key].oldValue)
        }
    })
}

/**
 * Удаление значений из chrome.storage.local
 * @param {string|string[]} keys — ключ или список ключей
 * @returns {Promise<void>}
 */
export function removeStorage(keys: string | string[]): Promise<void> {
    return new Promise<void>((resolve) => {
        chrome.storage.local.remove(keys, () => {
            resolve()
        })
    })
}
