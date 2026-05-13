const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const canvasManager = fs.readFileSync(path.join(projectRoot, 'ui/canvas-manager.js'), 'utf8');
const simulationEngine = fs.readFileSync(path.join(projectRoot, 'core/simulation-engine.js'), 'utf8');
const styles = fs.readFileSync(path.join(projectRoot, 'style.css'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

assert(canvasManager.includes('sink-live-params'), 'SNK canvas markup should include a live parameter panel');
assert(canvasManager.includes('function buildSinkLiveParameterRows(nodeId, node)'), 'Canvas manager should build live SNK parameter rows');
assert(canvasManager.includes('function updateSinkLiveParameterPanel(el, nodeId, node, visualStatus)'), 'SNK visual refresh should update the live parameter panel');
assert(canvasManager.includes('updateSinkLiveParameterPanel(el, nodeId, node, sinkVisualStatus)'), 'SNK visual update should refresh live SNK parameters');
assert(canvasManager.includes('function getSinkOperatingVisualStatus(node)'), 'SNK panel should classify safe/warning/risk/incomplete states');
assert(canvasManager.includes('getSinkLivePumpImpact(nodeId)'), 'SNK live panel should include downstream pump impact when available');

['Mode', 'Qout', 'Pout', 'zSNK', 'HSNK', 'hLd', 'Pv', 'P-Pv', 'Qdem', 'Preq', 'NPSHm'].forEach(label => {
    assert(canvasManager.includes(`label: '${label}'`), `Live SNK panel should include ${label}`);
});

assert(canvasManager.includes("getPumpLiveDisplayUnit('pressureAbs')"), 'SNK pressure should use absolute-pressure display units');
assert(canvasManager.includes("getPumpLiveDisplayUnit('pressureDelta')"), 'SNK pressure margin should use pressure-delta display units');
assert(canvasManager.includes("getPumpLiveDisplayUnit('head')"), 'SNK head values should use active head display units');
assert(canvasManager.includes("getPumpLiveDisplayUnit('flow')"), 'SNK flow values should use active flow display units');
assert(canvasManager.includes('selectedPressure <= vaporPressure'), 'SNK live status should flag vapor-pressure risk');

assert(simulationEngine.includes('updateObjectOperatingStatusVisual(sinkId)'), 'SNK readout update should refresh the canvas live panel');

assert(styles.includes('.sink-live-params'), 'SNK live panel should be styled');
assert(styles.includes('.sink-live-params-risk'), 'SNK live panel should expose risk styling');
assert(styles.includes('.sink-live-param-row'), 'SNK live rows should use compact row styling');
assert(styles.includes('pointer-events: none'), 'SNK live panel should not interfere with selection or dragging');

console.log(JSON.stringify({
    passed: true,
    liveSinkPanel: true,
    boundaryPressureMargin: true,
    pumpNpshImpact: true,
    compactCanvasLayout: true
}, null, 2));
