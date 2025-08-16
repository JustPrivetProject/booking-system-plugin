// Mock Supabase client before importing data-helpers
jest.mock('../../../src/services/supabaseClient', () => ({
    supabase: {
        from: jest.fn(() => ({
            insert: jest.fn(),
        })),
    },
}))

// Mock errorLogService
jest.mock('../../../src/services/errorLogService', () => ({
    errorLogService: {
        logError: jest.fn(),
        logRequestError: jest.fn(),
    },
}))

import {
    normalizeFormData,
    createFormData,
    getLastProperty,
    getPropertyById,
    extractFirstId,
    generateUniqueId,
    JSONstringify,
} from '../../../src/utils/data-helpers'

// Mock crypto for generateUniqueId
Object.defineProperty(global, 'crypto', {
    value: {
        randomUUID: jest.fn(() => 'test-uuid-12345'),
    },
})

describe('Data Helpers Functions', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('normalizeFormData', () => {
        it('should normalize form data with single item arrays', () => {
            const formData = {
                name: ['John Doe'],
                email: ['john@example.com'],
                age: ['25'],
                hobbies: ['reading', 'gaming'],
                active: ['true'],
            }

            const result = normalizeFormData(formData)

            expect(result).toEqual({
                name: 'John Doe',
                email: 'john@example.com',
                age: '25',
                hobbies: ['reading', 'gaming'],
                active: 'true',
            })
        })

        it('should keep multi-item arrays unchanged', () => {
            const formData = {
                tags: ['tag1', 'tag2', 'tag3'],
                categories: ['cat1', 'cat2'],
            }

            const result = normalizeFormData(formData)

            expect(result).toEqual({
                tags: ['tag1', 'tag2', 'tag3'],
                categories: ['cat1', 'cat2'],
            })
        })

        it('should handle non-array values', () => {
            const formData = {
                name: 'John Doe',
                age: 25,
                active: true,
                data: null,
            }

            const result = normalizeFormData(formData)

            expect(result).toEqual({
                name: 'John Doe',
                age: 25,
                active: true,
                data: null,
            })
        })

        it('should handle empty arrays', () => {
            const formData = {
                tags: [],
                categories: ['cat1'],
            }

            const result = normalizeFormData(formData)

            expect(result).toEqual({
                tags: [],
                categories: 'cat1', // Массив с одним элементом нормализуется
            })
        })

        it('should handle empty object', () => {
            const result = normalizeFormData({})
            expect(result).toEqual({})
        })
    })

    describe('createFormData', () => {
        it('should create FormData from object with simple values', () => {
            const formDataObj = {
                name: 'John Doe',
                email: 'john@example.com',
                age: '25',
            }

            const result = createFormData(formDataObj)

            expect(result).toBeInstanceOf(FormData)
            expect(result.get('name')).toBe('John Doe')
            expect(result.get('email')).toBe('john@example.com')
            expect(result.get('age')).toBe('25')
        })

        it('should handle array values', () => {
            const formDataObj = {
                tags: ['tag1', 'tag2', 'tag3'],
                categories: ['cat1'],
            }

            const result = createFormData(formDataObj)

            expect(result).toBeInstanceOf(FormData)
            expect(result.getAll('tags')).toEqual(['tag1', 'tag2', 'tag3'])
            expect(result.getAll('categories')).toEqual(['cat1'])
        })

        it('should handle Blob values', () => {
            const blob = new Blob(['test content'], { type: 'text/plain' })
            const formDataObj = {
                file: blob,
                name: 'test.txt',
            }

            const result = createFormData(formDataObj)

            expect(result).toBeInstanceOf(FormData)
            expect(result.has('file')).toBe(true)
            expect(result.get('name')).toBe('test.txt')
        })

        it('should handle mixed value types', () => {
            const formDataObj = {
                name: 'John Doe',
                tags: ['tag1', 'tag2'],
                file: new Blob(['content']),
                active: 'true',
            }

            const result = createFormData(formDataObj)

            expect(result).toBeInstanceOf(FormData)
            expect(result.get('name')).toBe('John Doe')
            expect(result.getAll('tags')).toEqual(['tag1', 'tag2'])
            expect(result.get('file')).toBeInstanceOf(Blob)
            expect(result.get('active')).toBe('true')
        })

        it('should log error for unsupported value types', () => {
            const consoleErrorSpy = jest
                .spyOn(require('../../../src/utils/logging'), 'consoleError')
                .mockImplementation()

            const formDataObj = {
                name: 'John Doe',
                data: { complex: 'object' },
                number: 123,
            }

            createFormData(formDataObj)

            expect(consoleErrorSpy).toHaveBeenCalledTimes(2)
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Unsupported value type for key "data":',
                { complex: 'object' }
            )
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Unsupported value type for key "number":',
                123
            )

            consoleErrorSpy.mockRestore()
        })
    })

    describe('getLastProperty', () => {
        it('should return the last property from object', () => {
            const obj = {
                first: { id: 1, name: 'First' },
                second: { id: 2, name: 'Second' },
                third: { id: 3, name: 'Third' },
            }

            const result = getLastProperty(obj)

            expect(result).toEqual({ id: 3, name: 'Third' })
        })

        it('should return null for empty object', () => {
            const result = getLastProperty({})
            expect(result).toBeNull()
        })

        it('should return copy of the last property', () => {
            const obj = {
                first: { id: 1, name: 'First' },
                second: { id: 2, name: 'Second' },
            }

            const result = getLastProperty(obj)
            if (result) {
                result.name = 'Modified'

                expect(result.name).toBe('Modified')
                expect(obj.second.name).toBe('Second') // Original should be unchanged
            }
        })
    })

    describe('getPropertyById', () => {
        it('should return property by id', () => {
            const obj = {
                'id-1': { id: 'id-1', name: 'First' },
                'id-2': { id: 'id-2', name: 'Second' },
            }

            const result = getPropertyById(obj, 'id-2')

            expect(result).toEqual({ id: 'id-2', name: 'Second' })
        })

        it('should return null for non-existent id', () => {
            const obj = {
                'id-1': { id: 'id-1', name: 'First' },
            }

            const result = getPropertyById(obj, 'non-existent')

            expect(result).toBeNull()
        })

        it('should return copy of the property', () => {
            const obj = {
                'id-1': { id: 'id-1', name: 'First' },
            }

            const result = getPropertyById(obj, 'id-1')
            if (result) {
                result.name = 'Modified'

                expect(result.name).toBe('Modified')
                expect(obj['id-1'].name).toBe('First') // Original should be unchanged
            }
        })
    })

    describe('extractFirstId', () => {
        it('should return the first id from object', () => {
            const obj = {
                'id-1': { name: 'First' },
                'id-2': { name: 'Second' },
                'id-3': { name: 'Third' },
            }

            const result = extractFirstId(obj)

            expect(result).toBe('id-1')
        })

        it('should return null for empty object', () => {
            const result = extractFirstId({})
            expect(result).toBeNull()
        })
    })

    describe('generateUniqueId', () => {
        it('should generate unique id using crypto.randomUUID', () => {
            const result = generateUniqueId()

            expect(result).toBe('test-uuid-12345')
            expect(global.crypto.randomUUID).toHaveBeenCalled()
        })
    })

    describe('JSONstringify', () => {
        it('should stringify object with proper formatting', () => {
            const obj = {
                name: 'John',
                age: 30,
                active: true,
            }

            const result = JSONstringify(obj)

            expect(result).toBe(JSON.stringify(obj, null, 2))
        })

        it('should handle complex nested objects', () => {
            const obj = {
                user: {
                    name: 'John',
                    preferences: {
                        theme: 'dark',
                        language: 'en',
                    },
                },
                settings: {
                    notifications: true,
                },
            }

            const result = JSONstringify(obj)

            expect(result).toBe(JSON.stringify(obj, null, 2))
        })

        it('should handle arrays', () => {
            const obj = {
                items: ['item1', 'item2', 'item3'],
                numbers: [1, 2, 3, 4, 5],
            }

            const result = JSONstringify(obj)

            expect(result).toBe(JSON.stringify(obj, null, 2))
        })
    })
})
