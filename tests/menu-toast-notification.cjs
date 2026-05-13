const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const menuBarSource = fs.readFileSync(path.join(projectRoot, 'toolbar/menu-bar.js'), 'utf8');
const styles = fs.readFileSync(path.join(projectRoot, 'style.css'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

assert(menuBarSource.includes('function showUiToast'), 'Menu bar should expose a nonblocking toast notification helper');
assert(menuBarSource.includes('aria-live'), 'Toast region should announce nonblocking file notifications accessibly');
assert(menuBarSource.includes('ui-toast-${variant}'), 'Toast helper should support variant-specific notifications');
assert(!menuBarSource.includes('alert('), 'Menu file actions should not use blocking browser alerts');
assert(menuBarSource.includes('Simulation file download has started.'), 'Fallback Save As should inform the user with a toast');
assert(menuBarSource.includes('File saved successfully.'), 'Save should report success with a toast');
assert(menuBarSource.includes('Simulation file loaded successfully.'), 'Open should report success with a toast');
assert(menuBarSource.includes('Failed to open file.'), 'Open errors should still provide user-facing feedback');
assert(styles.includes('.ui-toast-region'), 'Toast region should be styled');
assert(styles.includes('.ui-toast-success'), 'Toast styles should support success notifications');
assert(styles.includes('.ui-toast-error'), 'Toast styles should support error notifications');
assert(styles.includes('pointer-events: none'), 'Toast region should not block the canvas outside each toast');
assert(styles.includes('.ui-toast-close'), 'Toast should include a compact dismiss control');

console.log(JSON.stringify({
    passed: true,
    blockingAlertsRemoved: true,
    nonblockingToast: true,
    accessibleToastRegion: true
}, null, 2));
