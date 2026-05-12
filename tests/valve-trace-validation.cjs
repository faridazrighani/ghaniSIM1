const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const context = { console, Math, Number, parseFloat, JSON };
context.window = context;
vm.createContext(context);

vm.runInContext(`
var TANK_SCHEMA = {};
var PUMP_DEFAULT_PROPS = { curveData: [] };
var SEPARATOR_SCHEMA = {};
var VERTICAL_VESSEL_SCHEMA = {};
var HEAT_EXCHANGER_SCHEMA = {};
var MIXER_SCHEMA = {};
var PRESSURE_INDICATOR_SCHEMA = {};
var FLOW_INDICATOR_SCHEMA = {};
var TEMPERATURE_INDICATOR_SCHEMA = {};
var LINE_MONITOR_SCHEMA = {};
var LEVEL_CONTROLLER_SCHEMA = {};
var SOURCE_SCHEMA = {};
var SINK_SCHEMA = {};
var JUNCTION_SCHEMA = {};
var sourceLinks = [];
var hydraulicNetworkState = { pipes: {}, pumps: {} };
var connections = [
    { from: 'SRC-400', to: 'V-400', pipeId: 'PIPE-V-IN', connectionType: 'hydraulic' },
    { from: 'V-400', to: 'P-400', pipeId: 'PIPE-V-OUT', connectionType: 'hydraulic' },
    { from: 'SRC-401', to: 'CV-400', pipeId: 'PIPE-CV-IN', connectionType: 'hydraulic' },
    { from: 'CV-400', to: 'P-401', pipeId: 'PIPE-CV-OUT', connectionType: 'hydraulic' },
    { from: 'SRC-402', to: 'V-CV', pipeId: 'PIPE-CV-MODEL-IN', connectionType: 'hydraulic' },
    { from: 'V-CV', to: 'P-402', pipeId: 'PIPE-CV-MODEL-OUT', connectionType: 'hydraulic' },
    { from: 'SRC-403', to: 'V-CONTROL', pipeId: 'PIPE-CONTROL-IN', connectionType: 'hydraulic' },
    { from: 'V-CONTROL', to: 'P-403', pipeId: 'PIPE-CONTROL-OUT', connectionType: 'hydraulic' }
];
var globalModel = {
    SETTINGS: {
        type: 'settings',
        name: 'Simulation Settings',
        props: {
            unitStandard: 'Metric / European Engineering',
            basisConfirmed: true,
            basisDirty: false,
            lastConfirmedUnitStandard: 'Metric / European Engineering'
        }
    },
    FLUID: {
        type: 'fluid',
        name: 'Fluid Basis',
        props: {
            fluidName: 'Water',
            temp: 25,
            density: 997.047,
            sg: 0.99707,
            viscosity: 0.893,
            vaporPressure: 0.031698
        }
    },
    'SRC-400': { type: 'source', name: 'SRC-400', props: { sourceType: 'Standalone Boundary Source', pressure: 0, pressureInputBasis: 'Gauge', elevation: 4 } },
    'SRC-401': { type: 'source', name: 'SRC-401', props: { sourceType: 'Standalone Boundary Source', pressure: 0, pressureInputBasis: 'Gauge', elevation: 4 } },
    'SRC-402': { type: 'source', name: 'SRC-402', props: { sourceType: 'Standalone Boundary Source', pressure: 0, pressureInputBasis: 'Gauge', elevation: 4 } },
    'SRC-403': { type: 'source', name: 'SRC-403', props: { sourceType: 'Standalone Boundary Source', pressure: 0, pressureInputBasis: 'Gauge', elevation: 4 } },
    'P-400': { type: 'pump', name: 'P-400', props: { suctionElevation: 0 } },
    'P-401': { type: 'pump', name: 'P-401', props: { suctionElevation: 0 } },
    'P-402': { type: 'pump', name: 'P-402', props: { suctionElevation: 0 } },
    'P-403': { type: 'pump', name: 'P-403', props: { suctionElevation: 0 } },
    'PIPE-V-IN': { type: 'pipe', name: 'PIPE-V-IN', props: {}, results: { pressureCalculated: true, flow: 20 } },
    'PIPE-V-OUT': { type: 'pipe', name: 'PIPE-V-OUT', props: {}, results: { pressureCalculated: true, flow: 20 } },
    'PIPE-CV-IN': { type: 'pipe', name: 'PIPE-CV-IN', props: {}, results: { pressureCalculated: true, flow: 20 } },
    'PIPE-CV-OUT': { type: 'pipe', name: 'PIPE-CV-OUT', props: {}, results: { pressureCalculated: true, flow: 20 } },
    'PIPE-CV-MODEL-IN': { type: 'pipe', name: 'PIPE-CV-MODEL-IN', props: {}, results: { pressureCalculated: true, flow: 20 } },
    'PIPE-CV-MODEL-OUT': { type: 'pipe', name: 'PIPE-CV-MODEL-OUT', props: {}, results: { pressureCalculated: true, flow: 20 } },
    'PIPE-CONTROL-IN': { type: 'pipe', name: 'PIPE-CONTROL-IN', props: {}, results: { pressureCalculated: true, flow: 20 } },
    'PIPE-CONTROL-OUT': { type: 'pipe', name: 'PIPE-CONTROL-OUT', props: {}, results: { pressureCalculated: true, flow: 20 } },
    'V-400': {
        type: 'valve',
        name: 'V-400',
        props: {
            valveType: 'Globe Valve',
            lossModel: 'K coefficient',
            flowCharacteristic: 'Linear',
            kValue: 4,
            diameter: 0.1,
            opening: 50
        }
    },
    'CV-400': {
        type: 'checkValve',
        name: 'CV-400',
        props: {
            lossModel: 'K coefficient',
            kValue: 2,
            crackingPressure: 0.1,
            diameter: 0.1,
            reverseFlow: 'Blocked'
        }
    },
    'V-CV': {
        type: 'valve',
        name: 'V-CV',
        props: {
            valveType: 'Globe Valve',
            lossModel: 'Cv',
            flowCharacteristic: 'Linear',
            cv: 100,
            diameter: 0.1,
            opening: 100
        }
    },
    'V-CONTROL': {
        type: 'valve',
        name: 'V-CONTROL',
        props: {
            valveType: 'Control Valve',
            lossModel: 'Cv',
            flowCharacteristic: 'Equal percentage',
            cv: 120,
            diameter: 0.1,
            opening: 50
        }
    }
};
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}
function formatReadoutValue(value) {
    if (value === null || value === undefined || value === '') return '-';
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return String(value);
    return numeric.toFixed(3);
}
function isInstrumentType() { return false; }
`, context, { filename: 'valve-trace-prelude.js' });

[
    'formulas/constants.js',
    'core/unit-system.js',
    'properties/objects/pipe-properties.js',
    'properties/objects/valve-properties.js',
    'formulas/objects/pipe-formulas.js',
    'formulas/objects/valve-formulas.js',
    'formulas/objects/hydraulic-network-formulas.js',
    'properties/object-properties.js'
].forEach(file => {
    vm.runInContext(
        fs.readFileSync(path.join(projectRoot, file), 'utf8'),
        context,
        { filename: file }
    );
});

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function assertClose(label, actual, expected, tolerance = 1e-9) {
    const delta = Math.abs(actual - expected);
    if (!Number.isFinite(actual) || delta > tolerance) {
        throw new Error(`${label}: expected ${expected}, got ${actual} (delta ${delta})`);
    }
}

const kTrace = vm.runInContext(`buildValveCalculationTrace('V-400', globalModel, connections)`, context);
const q = 20 / 3600;
const area = Math.PI * Math.pow(0.1, 2) / 4;
const velocity = q / area;
const velocityHead = Math.pow(velocity, 2) / (2 * 9.81);
const effectiveK = 4 / Math.pow(0.5, 2);
const expectedKHeadLoss = effectiveK * velocityHead;
const expectedKPressureDrop = expectedKHeadLoss * 997.047 * 9.81 / 100000;

assert(kTrace.status === 'Review' || kTrace.status === 'OK', 'Valve K trace should build');
assertClose('effective K', kTrace.hydraulic.effectiveK, effectiveK, 0.000001);
assertClose('velocity head', kTrace.hydraulic.velocityHead, velocityHead, 0.000001);
assertClose('K head loss', kTrace.hydraulic.headLoss, expectedKHeadLoss, 0.000001);
assertClose('K pressure drop', kTrace.hydraulic.pressureDropBar, expectedKPressureDrop, 0.000001);
assertClose('K NPSH contribution', kTrace.hydraulic.npshLossContribution, expectedKHeadLoss, 0.000001);
assert(kTrace.inputBasis.npshPathRole.includes('P-400: Suction path'), 'Valve should be detected in pump suction path');
assert(kTrace.dependencyChain.some(item => item.includes('NPSHA')), 'Valve dependency chain should include NPSHA');
assert(kTrace.steps.some(step => step.title === 'Valve K Head Loss'), 'Valve K trace should include K loss step');
assert(kTrace.steps.some(step => step.title === 'NPSH Loss Contribution'), 'Valve trace should include NPSH contribution step');
assert(kTrace.references.some(item => item.includes('pdf_ref/ref4')), 'Valve trace should include local HI/NPSH reference');

const checkTrace = vm.runInContext(`buildValveCalculationTrace('CV-400', globalModel, connections)`, context);
const crackingHead = 0.1 * 100000 / (997.047 * 9.81);
const checkForwardLoss = 2 * velocityHead;
assert(checkTrace.status === 'Review' || checkTrace.status === 'OK', 'Check valve trace should build');
assertClose('check cracking head', checkTrace.hydraulic.crackingHead, crackingHead, 0.000001);
assertClose('check valve total head loss', checkTrace.hydraulic.headLoss, crackingHead + checkForwardLoss, 0.000001);
assert(checkTrace.steps.some(step => step.title === 'Cracking Pressure Head'), 'Check valve trace should include cracking pressure step');
assert(checkTrace.steps.some(step => step.title === 'Forward K Loss'), 'Check valve trace should include forward K loss step');

const cvTrace = vm.runInContext(`buildValveCalculationTrace('V-CV', globalModel, connections)`, context);
const flowGpm = 20 * 4.402867;
const expectedCvDpBar = 0.99707 * Math.pow(flowGpm / 100, 2) * 0.0689476;
const expectedCvHead = expectedCvDpBar * 100000 / (997.047 * 9.81);
assertClose('Cv pressure drop', cvTrace.hydraulic.pressureDropBar, expectedCvDpBar, 0.000001);
assertClose('Cv head loss', cvTrace.hydraulic.headLoss, expectedCvHead, 0.000001);
assert(cvTrace.steps.some(step => step.title === 'Cv Pressure Drop'), 'Cv trace should include Cv pressure-drop step');
assert(cvTrace.warnings.some(item => item.includes('Cv is treated as user/manufacturer input')), 'Cv trace should warn that Cv must be verified');

const controlTrace = vm.runInContext(`buildValveCalculationTrace('V-CONTROL', globalModel, connections)`, context);
const controlOpeningEffect = vm.runInContext(`calculateValveOpeningEffect(50, 'Equal percentage')`, context);
const controlEffectiveCv = 120 * controlOpeningEffect;
const expectedControlDpBar = 0.99707 * Math.pow(flowGpm / controlEffectiveCv, 2) * 0.0689476;
const expectedControlHead = expectedControlDpBar * 100000 / (997.047 * 9.81);
assert(controlTrace.inputBasis.objectType === 'Control Valve', 'Control Valve trace should identify object type');
assert(controlTrace.inputBasis.modelBasis.includes('Cv/opening characteristic'), 'Control Valve model basis should be specific');
assert(controlTrace.controlValve, 'Control Valve trace should include controlValve focus payload');
assertClose('control effective Cv', controlTrace.hydraulic.effectiveCv, controlEffectiveCv, 0.000001);
assertClose('control pressure drop', controlTrace.hydraulic.pressureDropBar, expectedControlDpBar, 0.000001);
assertClose('control NPSH contribution', controlTrace.hydraulic.npshLossContribution, expectedControlHead, 0.000001);
assert(controlTrace.dependencyChain.some(item => item.includes('Control Valve Cv input')), 'Control Valve dependency chain should include Cv/opening dependency');
assert(controlTrace.steps.some(step => step.title === 'Effective Cv'), 'Control Valve trace should include effective Cv step');
assert(controlTrace.steps.some(step => step.title === 'NPSH Loss Contribution'), 'Control Valve trace should include NPSH loss step');
assert(controlTrace.warnings.some(item => item.includes('IEC/ISA liquid choking')), 'Control Valve trace should disclose control-valve sizing limitations');
assert(!controlTrace.readouts.some(item => item.label === 'Cracking Head'), 'Control Valve should not render Check Valve cracking head readout');

const controlHtml = vm.runInContext(`renderValveCalculationTraceReport(buildValveCalculationTrace('V-CONTROL', globalModel, connections))`, context);
assert(controlHtml.includes('Control Valve Sizing / NPSH Focus'), 'Control Valve report should render sizing/NPSH focus');
assert(controlHtml.includes('Control Valve'), 'Control Valve report should name Control Valve');

vm.runInContext(`globalModel.SETTINGS.props.unitStandard = UNIT_STANDARD_US;`, context);
const usHtml = vm.runInContext(`renderValveCalculationTraceReport(buildValveCalculationTrace('V-400', globalModel, connections))`, context);
assert(usHtml.includes('gpm'), 'US Valve trace should show flow as gpm');
assert(usHtml.includes('ft'), 'US Valve trace should show head as ft');
assert(usHtml.includes('psi'), 'US Valve trace should show pressure drop as psi');
assert(usHtml.includes('3.93701 in'), 'US Valve trace should show hydraulic diameter as in');
assert(usHtml.includes('lb/ft3'), 'US Valve trace should show density as lb/ft3');
assert(usHtml.includes('Dependency Chain'), 'Valve report should render Dependency Chain');
assert(usHtml.includes('Equation Steps'), 'Valve report should render Equation Steps');
assert(usHtml.includes('NPSH Role'), 'Valve report should render NPSH Role section');

const usControlHtml = vm.runInContext(`renderValveCalculationTraceReport(buildValveCalculationTrace('V-CONTROL', globalModel, connections))`, context);
assert(usControlHtml.includes('Control Valve Sizing / NPSH Focus'), 'US Control Valve report should render control-valve focus');
assert(usControlHtml.includes('gpm'), 'US Control Valve trace should show flow as gpm');
assert(usControlHtml.includes('psi'), 'US Control Valve trace should show pressure drop as psi');

const valveSchemaOptions = vm.runInContext(`VALVE_SCHEMA.valveType.options`, context);
assert(valveSchemaOptions.includes('Control Valve'), 'Valve Type dropdown should include Control Valve');

const taskWindowSource = fs.readFileSync(path.join(projectRoot, 'ui/task-window.js'), 'utf8');
assert(taskWindowSource.includes('Control Valve Object Properties'), 'Task window should have Control Valve title support');

console.log('valve-trace-validation: ok');
