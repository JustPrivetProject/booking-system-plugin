import { consoleError } from './logging';

type FormDataAppendable = string | Blob;
type RequestBody = NonNullable<chrome.webRequest.OnBeforeRequestDetails['requestBody']>;

function isFormDataAppendable(value: unknown): value is FormDataAppendable {
    return typeof value === 'string' || value instanceof Blob;
}

export function getFirstFormDataString(values?: chrome.webRequest.FormDataItem[]): string | null {
    const value = values?.[0];
    return typeof value === 'string' ? value : null;
}

export function normalizeFormData(formData: RequestBody): RequestBody;
export function normalizeFormData<T extends Record<string, unknown>>(formData: T): T;
export function normalizeFormData(formData: undefined): undefined;
export function normalizeFormData<T extends RequestBody | Record<string, unknown> | undefined>(
    formData: T,
): T {
    if (!formData) {
        return formData;
    }

    const input = formData as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const key in input) {
        const value = input[key];

        // If it's an array with only one item, use that item directly
        if (Array.isArray(value) && value.length === 1) {
            result[key] = value[0];
        } else {
            result[key] = value;
        }
    }

    return result as T;
}

export function createFormData<T extends Record<string, unknown>>(formDataObj: T): FormData {
    const formData = new FormData();

    Object.entries(formDataObj).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.forEach(item => {
                if (isFormDataAppendable(item)) {
                    formData.append(key, item);
                } else {
                    consoleError(`Unsupported array item type for key "${key}":`, item);
                }
            });
        } else if (isFormDataAppendable(value)) {
            formData.append(key, value);
        } else {
            consoleError(`Unsupported value type for key "${key}":`, value);
        }
    });

    return formData;
}

export function getLastProperty<T>(obj: Record<string, T>): T | null {
    const keys = Object.keys(obj); // Get all keys
    if (keys.length === 0) return null; // Return null if the object is empty

    const lastKey = keys[keys.length - 1]; // Get the last key
    return { ...obj[lastKey] }; // Return both key and value
}

export function getPropertyById<T>(obj: Record<string, T>, id: string): T | null {
    if (!Object.prototype.hasOwnProperty.call(obj, id)) return null;
    return { ...obj[id] }; // Возвращаем копию объекта по id
}

export function extractFirstId(obj: Record<string, unknown>): string | null {
    const keys = Object.keys(obj);
    return keys.length > 0 ? keys[0] : null;
}

export function generateUniqueId(): string {
    return crypto.randomUUID();
}

export function JSONstringify(object: unknown): string {
    return JSON.stringify(object, null, 2);
}
