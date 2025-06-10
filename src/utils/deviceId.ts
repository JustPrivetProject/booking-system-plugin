export async function getOrCreateDeviceId(): Promise<string> {
    // Try to get existing device ID from storage
    const result = await chrome.storage.local.get('deviceId')

    if (result.deviceId) {
        return result.deviceId
    }

    // Generate new device ID if none exists
    const newDeviceId = crypto.randomUUID()

    // Save to storage
    await chrome.storage.local.set({ deviceId: newDeviceId })

    return newDeviceId
}
