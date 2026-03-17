import type { GctGroupDraft, GctTargetSlotDraft, GctWatcherSettings } from '../../gct/types';
import { gctWatcherService } from '../../services/gct/gctWatcherService';
import { saveGctSettings } from '../../gct/storage';

export type GctMessageType =
    | 'GET_STATE'
    | 'ADD_GROUP'
    | 'REMOVE_GROUP'
    | 'REMOVE_ROW'
    | 'UPDATE_ROW_SLOT'
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
    groupId?: string;
    rowId?: string;
    slot?: GctTargetSlotDraft;
    settings?: Partial<GctWatcherSettings>;
}

export class GctHandler {
    async handleMessage(message: GctMessage): Promise<unknown> {
        switch (message.type) {
            case 'GET_STATE':
                return gctWatcherService.getState();

            case 'ADD_GROUP':
                if (!message.group) {
                    throw new Error('Group payload is required');
                }
                return gctWatcherService.addGroup(message.group);

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

            case 'UPDATE_ROW_SLOT':
                if (!message.groupId || !message.rowId || !message.slot) {
                    throw new Error('groupId, rowId and slot are required');
                }
                return gctWatcherService.updateRowSlot(
                    message.groupId,
                    message.rowId,
                    message.slot,
                );

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
