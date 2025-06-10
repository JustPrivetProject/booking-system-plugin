export type RetryObject = {
    body: RequestCacheBodyObject
    driverName?: string
    containerNumber?: string // MSNU2991953
    headersCache: RequestCacheHeaderBody
    id: string
    startSlot: string // "05.06.2025 19:00:00"
    status: string // e.g. "paused"
    status_message: string // e.g. "Zadanie jest wstrzymane"
    timestamp: number
    tvAppId: string
    url: string
}

export type RetryObjectArray = RetryObject[]

export type GroupsStates = {
    [tvAppId: string]: boolean
}

export type RequestCacheBodes = {
    [id: string]: RequestCacheBodyObject
}

export type RequestCacheBodyObject = {
    body: {
        formData: {
            BaypassWeightValidation: [string]
            Chassis1PlateNo: [string, string]
            Chassis2PlateNo: [string, string]
            CombainedTransport: string[] // иногда один элемент, иногда два
            SelectedDriver: [string, string]
            [key: `SelectedTasks[${number}].ContainerDoorDirection`]: [string]
            [key: `SelectedTasks[${number}].ContainerPosition`]: [string]
            [key: `SelectedTasks[${number}].TaskNo`]: [string]
            SlotEnd: [string]
            SlotStart: [string]
            SlotType: [string]
            TSType: [string, string]
            TruckPlateNo: [string, string]
            TvAppId: [string]
            __RequestVerificationToken: [string]
        }
    }
    timestamp: number
    url: string
}

export type RequestCacheHeaders = {
    [id: string]: RequestCacheHeaderBody
}

export type RequestCacheHeaderBody = {
    headers: {
        /** Name of the HTTP header. */
        name: string
        /** Value of the HTTP header if it can be represented by UTF-8. */
        value?: string | undefined
        /** Value of the HTTP header if it cannot be represented by UTF-8, stored as individual byte values (0..255). */
        binaryValue?: ArrayBuffer | undefined
    }[]
    timestamp: number
    url: string
}
