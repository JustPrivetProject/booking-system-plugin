// Global Response mock for tests
export function setupResponseMock() {
    if (!(global as any).Response) {
        ;(global as any).Response = class MockResponse {
            ok: boolean
            status: number
            statusText: string
            headers: any
            private _text: string

            constructor(body: string, init?: any) {
                this._text = body
                this.ok = init?.status >= 200 && init?.status < 300
                this.status = init?.status || 200
                this.statusText = init?.statusText || 'OK'
                this.headers = init?.headers || {}
            }

            text() {
                return Promise.resolve(this._text)
            }
        }
    }
}

// Auto-setup when imported
setupResponseMock()
