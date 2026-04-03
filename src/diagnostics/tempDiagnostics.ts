// TEMP-DIAGNOSTICS: Remove this file after the investigation is complete.

export const TEMP_DIAGNOSTICS_TAG = 'TEMP-DIAGNOSTICS';
export const TEMP_DIAGNOSTICS_CONTENT_MESSAGE_TYPE = 'RUN_TEMP_DIAGNOSTICS';
export const TEMP_DIAGNOSTICS_STORAGE_KEY = '__tempDiagnosticsProbe';
const TEMP_DIAGNOSTICS_PROBE_TIMEOUT_MS = 1500;

export type DiagnosticsContextName = 'background' | 'popup' | 'content';
export type DiagnosticsProbeMode = 'callback' | 'promise' | 'meta';

export interface DiagnosticsProbeResult {
    name: string;
    api: string;
    mode: DiagnosticsProbeMode;
    success: boolean;
    threw: boolean;
    callbackCalled: boolean;
    callbackResultDefined: boolean;
    runtimeLastError: string | null;
    errorMessage: string | null;
    returnedKeys: string[];
    durationMs: number;
    details?: Record<string, unknown>;
}

export interface DiagnosticsContextReport {
    context: DiagnosticsContextName;
    timestamp: string;
    userAgent: string;
    url: string | null;
    probes: DiagnosticsProbeResult[];
}

export interface DiagnosticsReport {
    kind: 'TEMP_DIAGNOSTICS_REPORT';
    tag: string;
    generatedAt: string;
    extensionVersion: string;
    activeTabUrl: string | null;
    summary: {
        classifications: string[];
        recommendedInterpretation: string[];
    };
    contexts: {
        popup: DiagnosticsContextReport;
        background: DiagnosticsContextReport;
        content: DiagnosticsContextReport | null;
    };
}

function nowIso(): string {
    return new Date().toISOString();
}

function getUserAgentSafe(): string {
    try {
        return globalThis.navigator?.userAgent || 'unknown';
    } catch {
        return 'unknown';
    }
}

function getLocationHrefSafe(): string | null {
    try {
        return globalThis.location?.href || null;
    } catch {
        return null;
    }
}

function getManifestVersionSafe(): string {
    try {
        return chrome.runtime.getManifest().version;
    } catch {
        return 'unknown';
    }
}

function getRuntimeLastErrorMessage(): string | null {
    try {
        return chrome.runtime.lastError?.message || null;
    } catch {
        return null;
    }
}

function getReturnedKeys(result: unknown): string[] {
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
        return [];
    }

    return Object.keys(result as Record<string, unknown>);
}

function toErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

async function runCallbackProbe(
    name: string,
    api: string,
    executor: (done: (result?: unknown) => void) => void,
): Promise<DiagnosticsProbeResult> {
    const startedAt = Date.now();
    let callbackCalled = false;
    let callbackResultDefined = false;
    let runtimeLastError: string | null = null;
    let errorMessage: string | null = null;
    let threw = false;
    let returnedKeys: string[] = [];
    let success = false;

    await new Promise<void>(resolve => {
        let settled = false;
        const timeoutId = setTimeout(() => {
            if (settled) {
                return;
            }
            settled = true;
            errorMessage = 'Probe timed out before callback completion';
            resolve();
        }, TEMP_DIAGNOSTICS_PROBE_TIMEOUT_MS);

        const done = (result?: unknown) => {
            if (settled) {
                return;
            }

            settled = true;
            clearTimeout(timeoutId);
            callbackCalled = true;
            callbackResultDefined = result !== undefined;
            runtimeLastError = getRuntimeLastErrorMessage();
            returnedKeys = getReturnedKeys(result);
            success = !runtimeLastError;
            resolve();
        };

        try {
            executor(done);
        } catch (error) {
            if (!settled) {
                settled = true;
                clearTimeout(timeoutId);
                threw = true;
                errorMessage = toErrorMessage(error);
                resolve();
            }
        }
    });

    return {
        name,
        api,
        mode: 'callback',
        success,
        threw,
        callbackCalled,
        callbackResultDefined,
        runtimeLastError,
        errorMessage,
        returnedKeys,
        durationMs: Date.now() - startedAt,
    };
}

export async function runStorageGetProbe(
    areaName: 'session' | 'local',
): Promise<DiagnosticsProbeResult> {
    return runCallbackProbe(`storage-${areaName}-get`, `chrome.storage.${areaName}.get`, done => {
        const storageArea = chrome.storage?.[areaName];
        if (!storageArea) {
            throw new Error(`chrome.storage.${areaName} is unavailable`);
        }

        storageArea.get({ [TEMP_DIAGNOSTICS_STORAGE_KEY]: null }, result => done(result));
    });
}

export async function runStorageSetProbe(
    areaName: 'session' | 'local',
): Promise<DiagnosticsProbeResult> {
    const probe = await runCallbackProbe(
        `storage-${areaName}-set`,
        `chrome.storage.${areaName}.set`,
        done => {
            const storageArea = chrome.storage?.[areaName];
            if (!storageArea) {
                throw new Error(`chrome.storage.${areaName} is unavailable`);
            }

            storageArea.set(
                {
                    [TEMP_DIAGNOSTICS_STORAGE_KEY]: {
                        tag: TEMP_DIAGNOSTICS_TAG,
                        timestamp: nowIso(),
                    },
                },
                () => done(),
            );
        },
    );

    try {
        chrome.storage?.[areaName]?.remove?.(TEMP_DIAGNOSTICS_STORAGE_KEY, () => undefined);
    } catch {
        // TEMP-DIAGNOSTICS: Cleanup is best-effort only.
    }

    return probe;
}

export async function runSetAccessLevelProbe(): Promise<DiagnosticsProbeResult> {
    const startedAt = Date.now();
    let runtimeLastError: string | null = null;
    let errorMessage: string | null = null;
    let success = false;

    try {
        if (!chrome.storage?.session?.setAccessLevel) {
            throw new Error('chrome.storage.session.setAccessLevel is unavailable');
        }

        await chrome.storage.session.setAccessLevel({
            accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS',
        });
        runtimeLastError = getRuntimeLastErrorMessage();
        success = !runtimeLastError;
    } catch (error) {
        errorMessage = toErrorMessage(error);
    }

    return {
        name: 'storage-session-set-access-level',
        api: 'chrome.storage.session.setAccessLevel',
        mode: 'promise',
        success,
        threw: Boolean(errorMessage),
        callbackCalled: false,
        callbackResultDefined: false,
        runtimeLastError,
        errorMessage,
        returnedKeys: [],
        durationMs: Date.now() - startedAt,
    };
}

export async function runRuntimeSendMessageProbe(
    message: Record<string, unknown>,
): Promise<DiagnosticsProbeResult> {
    return runCallbackProbe('runtime-send-message', 'chrome.runtime.sendMessage', done => {
        chrome.runtime.sendMessage(message, response => done(response));
    });
}

export function createContextReport(
    context: DiagnosticsContextName,
    probes: DiagnosticsProbeResult[],
    url: string | null = getLocationHrefSafe(),
): DiagnosticsContextReport {
    return {
        context,
        timestamp: nowIso(),
        userAgent: getUserAgentSafe(),
        url,
        probes,
    };
}

export function createDiagnosticsSummary(report: {
    background: DiagnosticsContextReport;
    popup: DiagnosticsContextReport;
    content: DiagnosticsContextReport | null;
}): DiagnosticsReport['summary'] {
    const classifications: string[] = [];
    const recommendedInterpretation: string[] = [];

    const backgroundSessionOk = report.background.probes
        .filter(probe => probe.name.startsWith('storage-session-'))
        .every(probe => probe.success);
    const popupSessionOk = report.popup.probes
        .filter(probe => probe.name.startsWith('storage-session-'))
        .every(probe => probe.success);
    const contentSessionProbes =
        report.content?.probes.filter(probe => probe.name.startsWith('storage-session-')) || [];
    const contentSessionDenied = contentSessionProbes.some(
        probe =>
            !probe.success &&
            (probe.runtimeLastError?.includes(
                'Access to storage is not allowed from this context',
            ) ||
                probe.errorMessage?.includes('Access to storage is not allowed from this context')),
    );
    const contentUndefinedCallback = contentSessionProbes.some(
        probe => probe.callbackCalled && !probe.callbackResultDefined,
    );
    const accessLevelFailed = report.background.probes.some(
        probe => probe.name === 'storage-session-set-access-level' && !probe.success,
    );

    if (!report.content) {
        classifications.push('no_content_script');
        recommendedInterpretation.push(
            'Content diagnostics were not collected. Ensure the active tab is a supported BalticHub page.',
        );
    }

    if (backgroundSessionOk) {
        classifications.push('background_session_ok');
    }

    if (popupSessionOk) {
        classifications.push('popup_session_ok');
    }

    if (contentSessionDenied) {
        classifications.push('content_session_denied');
        recommendedInterpretation.push(
            'chrome.storage.session is denied in content context while trusted extension contexts still work.',
        );
    }

    if (contentUndefinedCallback) {
        classifications.push('malformed_callback_payload');
        recommendedInterpretation.push(
            'A callback completed without a defined result payload. Unsafe destructuring in logging code will fail in this case.',
        );
    }

    if (accessLevelFailed) {
        classifications.push('access_level_set_failed');
        recommendedInterpretation.push(
            'storage.session access level could not be opened to untrusted contexts. Content access may remain blocked.',
        );
    }

    if (!classifications.length) {
        classifications.push('no_obvious_failure_detected');
        recommendedInterpretation.push(
            'Diagnostics did not detect a clear storage restriction. Compare this report with a failing machine.',
        );
    }

    return {
        classifications,
        recommendedInterpretation,
    };
}

export function buildDiagnosticsReport(input: {
    activeTabUrl: string | null;
    popup: DiagnosticsContextReport;
    background: DiagnosticsContextReport;
    content: DiagnosticsContextReport | null;
}): DiagnosticsReport {
    return {
        kind: 'TEMP_DIAGNOSTICS_REPORT',
        tag: TEMP_DIAGNOSTICS_TAG,
        generatedAt: nowIso(),
        extensionVersion: getManifestVersionSafe(),
        activeTabUrl: input.activeTabUrl,
        summary: createDiagnosticsSummary(input),
        contexts: {
            popup: input.popup,
            background: input.background,
            content: input.content,
        },
    };
}
