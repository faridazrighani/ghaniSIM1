const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const canvasManager = fs.readFileSync(path.join(projectRoot, 'ui/canvas-manager.js'), 'utf8');
const taskWindowSource = fs.readFileSync(path.join(projectRoot, 'ui/task-window.js'), 'utf8');
const styles = fs.readFileSync(path.join(projectRoot, 'style.css'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

assert(canvasManager.includes('source-live-params'), 'SRC canvas markup should include a live parameter panel');
assert(canvasManager.includes('function updateSourceLiveParameterPanel(el, nodeId, node, visualStatus)'), 'SRC visual refresh should update the live parameter panel');
assert(canvasManager.includes('function getSourceLivePumpImpact(sourceId)'), 'SRC live panel should detect the related pump suction path');
assert(canvasManager.includes('resolveSourceBoundaryData(sourceId, globalModel)'), 'SRC live panel should use resolved source boundary data');

['Mode', 'Qout', 'Psrc', 'zSRC', 'Hsrc', 'hLs', 'NPSHa@P'].forEach(label => {
    assert(canvasManager.includes(`label: '${label}'`), `SRC live panel should display ${label}`);
});

assert(!canvasManager.includes("label: 'NPSHr'") || canvasManager.indexOf("label: 'NPSHr'") < canvasManager.indexOf('function getSourceBoundaryShortMode'), 'SRC live panel should keep NPSHr on pump panel only');

assert(styles.includes('.source-live-params'), 'SRC live panel should be styled');
assert(styles.includes('.source-live-params-incomplete'), 'SRC live panel should expose incomplete styling');
assert(styles.includes('.source-live-param-row'), 'SRC live rows should use compact row styling');
assert(styles.includes('pointer-events: none'), 'SRC live panel should not interfere with selection or dragging');

assert(taskWindowSource.includes('Realtime Canvas Readout Interpretation'), 'SRC help should explain realtime canvas readout');
assert(taskWindowSource.includes('Canvas Panel Scope and Thesis Interpretation'), 'SRC help should include thesis scope notes');
assert(taskWindowSource.includes('Equation / Dependency Map for SRC Live Panel'), 'SRC help should include the live-panel equation map');
assert(taskWindowSource.includes('NPSHa@P = Hsrc - hLs - zPump - Hv'), 'SRC help should document the pump-suction NPSHa equation');
assert(taskWindowSource.includes('not the final cavitation verdict panel'), 'SRC help should prevent confusing SRC contribution with pump verdict');
assert(taskWindowSource.includes('NPSHr, Margin, and Ratio remain on the pump panel'), 'SRC help should keep final pump metrics on the pump panel');

console.log(JSON.stringify({
    passed: true,
    liveSourcePanel: true,
    pumpSuctionScope: true,
    helpGuidance: true,
    compactCanvasLayout: true
}, null, 2));
