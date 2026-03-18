import type { GctGroupDraft, GctTargetSlotDraft, GctWatcherSettings } from '../../gct/types';
import { gctWatcherService } from '../../services/gct/gctWatcherService';
import { saveGctSettings } from '../../gct/storage';
import {
    formatGctLocalDateTime,
    getGctCurrentBooking,
    loginToGctWithCredentials,
} from '../../services/gct/gctApi';

export type GctMessageType =
    | 'GET_STATE'
    | 'GET_SLOT_CONTEXT'
    | 'ADD_GROUP'
    | 'REPLACE_GROUP_SLOTS'
    | 'REMOVE_GROUP'
    | 'REMOVE_ROW'
    | 'TOGGLE_GROUP_EXPANDED'
    | 'PAUSE_GROUP'
    | 'RESUME_GROUP'
    | 'PAUSE_ROW'
    | 'RESUME_ROW'
    | 'SAVE_SETTINGS';

export interface GctMessage {
    target: 'gct';
    type: GctMessageType;
    group?: GctGroupDraft;
    credentials?: {
        documentNumber: string;
        vehicleNumber: string;
        containerNumber: string;
    };
    prefetchedToken?: string;
    groupId?: string;
    rowId?: string;
    slots?: GctTargetSlotDraft[];
    settings?: Partial<GctWatcherSettings>;
}

export class GctHandler {
    async handleMessage(message: GctMessage): Promise<unknown> {
        switch (message.type) {
            case 'GET_STATE':
                return gctWatcherService.getState();

            case 'GET_SLOT_CONTEXT': {
                if (!message.credentials) {
                    throw new Error('Credentials payload is required');
                }

                const credentials = {
                    documentNumber: message.credentials.documentNumber.trim(),
                    vehicleNumber: message.credentials.vehicleNumber.trim().toUpperCase(),
                    containerNumber: message.credentials.containerNumber.trim().toUpperCase(),
                };

                const token = await loginToGctWithCredentials(credentials);
                const currentBooking = await getGctCurrentBooking(token);
                const startLocal = currentBooking
                    ? formatGctLocalDateTime(currentBooking.poczatek)
                    : null;
                const [date, startTime] = startLocal ? startLocal.split(' ') : [null, null];

                return {
                    token,
                    currentSlot:
                        date && startTime
                            ? {
                                  date,
                                  startTime,
                              }
                            : null,
                    fetchedAt: new Date().toISOString(),
                };
            }

            case 'ADD_GROUP':
                if (!message.group) {
                    throw new Error('Group payload is required');
                }
                return gctWatcherService.addGroup(message.group, message.prefetchedToken);

            case 'REPLACE_GROUP_SLOTS':
                if (!message.groupId || !message.slots) {
                    throw new Error('groupId and slots are required');
                }
                return gctWatcherService.replaceGroupSlots(message.groupId, message.slots);

            case 'REMOVE_GROUP':
                if (!message.groupId) {
                    throw new Error('groupId is required');
                }
                return gctWatcherService.removeGroup(message.groupId);

            case 'REMOVE_ROW':
                if (!message.groupId || !message.rowId) {
                    throw new Error('groupId and rowId are required');
                }
                return gctWatcherService.removeRow(message.groupId, message.rowId);

            case 'TOGGLE_GROUP_EXPANDED':
                if (!message.groupId) {
                    throw new Error('groupId is required');
                }
                return gctWatcherService.toggleGroupExpanded(message.groupId);

            case 'PAUSE_GROUP':
                if (!message.groupId) {
                    throw new Error('groupId is required');
                }
                return gctWatcherService.pauseGroup(message.groupId);

            case 'RESUME_GROUP':
                if (!message.groupId) {
                    throw new Error('groupId is required');
                }
                return gctWatcherService.resumeGroup(message.groupId);

            case 'PAUSE_ROW':
                if (!message.groupId || !message.rowId) {
                    throw new Error('groupId and rowId are required');
                }
                return gctWatcherService.pauseRow(message.groupId, message.rowId);

            case 'RESUME_ROW':
                if (!message.groupId || !message.rowId) {
                    throw new Error('groupId and rowId are required');
                }
                return gctWatcherService.resumeRow(message.groupId, message.rowId);

            case 'SAVE_SETTINGS':
                await saveGctSettings(message.settings || {});
                await gctWatcherService.ensureSchedules();
                return gctWatcherService.getState();

            default:
                throw new Error(`Unknown GCT message type: ${(message as { type?: string }).type}`);
        }
    }
}
