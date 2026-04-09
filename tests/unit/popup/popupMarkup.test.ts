import fs from 'node:fs';
import path from 'node:path';

describe('Popup booking markup parity', () => {
    const popupHtmlPath = path.resolve(__dirname, '../../../src/popup/popup.html');
    const popupCssPath = path.resolve(__dirname, '../../../src/popup/popup.css');
    const popupTsPath = path.resolve(__dirname, '../../../src/popup/popup.ts');

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
        expect(popupCss).toContain('.booking-queue-table tbody tr:not(.group-row) td:first-child');
        expect(popupCss).not.toContain('#queueTableBody:empty::after');
        expect(popupCss).not.toContain('#queueTable td:first-child');
    });

    it('should not force a taller empty BCT or GCT tab than DCT', () => {
        const popupCss = fs.readFileSync(popupCssPath, 'utf8');

        expect(popupCss).toContain('#bctView,');
        expect(popupCss).toContain('#gctView {');
        expect(popupCss).not.toContain(
            '#bctView,\n#gctView {\n    width: 100%;\n    min-width: var(--app-width);\n    min-height: 240px;',
        );
    });

    it('should keep booking group state terminal-scoped without a DCT-only popup branch', () => {
        const popupTs = fs.readFileSync(popupTsPath, 'utf8');
        const popupCss = fs.readFileSync(popupCssPath, 'utf8');

        expect(popupTs).not.toContain('function isLegacyDctGroupBehavior');
        expect(popupTs).toContain('const groupStateCache');
        expect(popupTs).toContain('await getCachedGroupStates(terminal);');
        expect(popupTs).toContain("!nextRow.classList.contains('group-row')");
        expect(popupTs).toContain('.group-row .group-header:not(.actions)');
        expect(popupTs).toContain('setGroupExpandedState(groupRow, isOpen);');
        expect(popupCss).toContain('td.group-header.actions {');
        expect(popupCss).toContain('td.group-header {');
        expect(popupCss).toContain('cursor: pointer;');
        expect(popupCss).toContain(
            '.booking-queue-table tbody tr:not(.group-row) td:first-child {',
        );
        expect(popupCss).not.toContain('width: 22px !important;');
    });
});
