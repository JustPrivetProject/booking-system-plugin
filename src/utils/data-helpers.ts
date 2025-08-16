import { consoleError } from './logging'

export function normalizeFormData(formData: any): Record<string, any> {
    const result = {}

    for (const key in formData) {
        // If it's an array with only one item, use that item directly
        if (Array.isArray(formData[key]) && formData[key].length === 1) {
            result[key] = formData[key][0]
        } else {
            result[key] = formData[key]
        }
    }

    return result
}

export function createFormData(formDataObj: any): FormData {
    const formData = new FormData()

    Object.entries(formDataObj).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.forEach((item) => {
                formData.append(key, item)
            })
        } else {
            if (typeof value === 'string' || value instanceof Blob) {
                formData.append(key, value)
            } else {
                consoleError(`Unsupported value type for key "${key}":`, value)
            }
        }
    })

    return formData
}

export function getLastProperty<T>(obj: Record<string, T>): T | null {
    let keys = Object.keys(obj) // Get all keys
    if (keys.length === 0) return null // Return null if the object is empty

    let lastKey = keys[keys.length - 1] // Get the last key
    return { ...obj[lastKey] } // Return both key and value
}

export function getPropertyById<T>(
    obj: Record<string, T>,
    id: string
): T | null {
    if (!obj.hasOwnProperty(id)) return null
    return { ...obj[id] } // Возвращаем копию объекта по id
}

export function extractFirstId(obj: Record<string, unknown>): string | null {
    const keys = Object.keys(obj)
    return keys.length > 0 ? keys[0] : null
}

export function generateUniqueId(): string {
    return crypto.randomUUID()
}

export function JSONstringify(object: any): string {
    return JSON.stringify(object, null, 2)
}
