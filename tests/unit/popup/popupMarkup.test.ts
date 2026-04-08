import fs from 'node:fs';
import path from 'node:path';

describe('Popup booking markup parity', () => {
    const popupHtmlPath = path.resolve(__dirname, '../../../src/popup/popup.html');
    const popupCssPath = path.resolve(__dirname, '../../../src/popup/popup.css');

    it('should give both booking tables the shared parity classes', () => {
        const popupHtml = fs.readFileSync(popupHtmlPath, 'utf8');

        expect(popupHtml).toContain('<table id="queueTable" class="booking-queue-table">');
        expect(popupHtml).toContain(
            '<tbody id="queueTableBody" class="booking-queue-body"></tbody>',
        );
        expect(popupHtml).toContain('<table id="bctQueueTable" class="booking-queue-table">');
        expect(popupHtml).toContain(
            '<tbody id="bctQueueTableBody" class="booking-queue-body"></tbody>',
        );
    });

    it('should style booking queue states through shared selectors instead of DCT-only ids', () => {
        const popupCss = fs.readFileSync(popupCssPath, 'utf8');

        expect(popupCss).toContain('.booking-queue-body:empty::after');
        expect(popupCss).toContain('.booking-queue-table td:first-child');
        expect(popupCss).not.toContain('#queueTableBody:empty::after');
        expect(popupCss).not.toContain('#queueTable td:first-child');
    });
});
