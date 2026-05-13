const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const canvasManager = fs.readFileSync(path.join(projectRoot, 'ui/canvas-manager.js'), 'utf8');
const simulationEngine = fs.readFileSync(path.join(projectRoot, 'core/simulation-engine.js'), 'utf8');
const stateManager = fs.readFileSync(path.join(projectRoot, 'core/state-manager.js'), 'utf8');
const styles = fs.readFileSync(path.join(projectRoot, 'style.css'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

assert(canvasManager.includes('pump-live-params'), 'Pump canvas markup should include a live parameter panel');
assert(canvasManager.includes('function buildPumpLiveParameterRows(node)'), 'Canvas manager should build live pump parameter rows');
assert(canvasManager.includes('function updatePumpLiveParameterPanel(el, node, visualStatus)'), 'Pump status refresh should update the live parameter panel');
assert(canvasManager.includes('updatePumpLiveParameterPanel(el, node, visualStatus)'), 'Pump visual update should refresh live pump parameters');

['Q', 'H', 'NPSHa', 'NPSHr', 'M', 'R', 'PvB', 'PvP'].forEach(label => {
    assert(canvasManager.includes(`label: '${label}'`), `Live pump panel should include ${label}`);
});

assert(canvasManager.includes('Fluid Basis vapor pressure'), 'Panel should distinguish Fluid Basis vapor pressure');
assert(canvasManager.includes('Live pump vapor pressure used in NPSH'), 'Panel should distinguish live pump vapor pressure');
assert(canvasManager.includes("getPumpLiveDisplayUnit('pressureAbs')"), 'Vapor pressure should use absolute-pressure display units');
assert(canvasManager.includes("solved ? pressureValue(liveVaporPressure) : '-'"), 'Live pump vapor pressure should not show a misleading value before NPSH is solved');

assert(stateManager.includes('vaporPressureBasis: null'), 'Pump default results should include Fluid Basis vapor pressure storage');
assert(stateManager.includes('vaporPressureLive: null'), 'Pump default results should include live pump vapor pressure storage');
assert(simulationEngine.includes('pump.results.vaporPressureBasis'), 'Simulation should store Fluid Basis vapor pressure on pump results');
assert(simulationEngine.includes('pump.results.vaporPressureLive'), 'Simulation should store live pump vapor pressure on pump results');
assert(simulationEngine.includes('detailedNpshEvaluation?.calculationTrace?.basis?.vaporPressureBarA'), 'Live vapor pressure should come from the pump NPSH trace when available');

assert(styles.includes('.pump-live-params'), 'Live parameter panel should be styled');
assert(styles.includes('position: absolute'), 'Live parameter panel should not alter object layout or connection geometry');
assert(styles.includes('pointer-events: none'), 'Live parameter panel should not interfere with object selection or dragging');
assert(styles.includes('.pump-live-params-risk'), 'Live parameter panel should expose risk styling');
assert(styles.includes('.pump-live-param-row'), 'Live parameter rows should use compact row styling');

console.log(JSON.stringify({
    passed: true,
    livePumpPanel: true,
    vaporPressureComparison: true,
    nonDisruptiveCanvasLayout: true
}, null, 2));
