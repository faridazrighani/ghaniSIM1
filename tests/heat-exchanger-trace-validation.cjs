const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const context = { console, Math, Number, parseFloat, JSON };
context.window = context;
vm.createContext(context);

vm.runInContext(`
var TANK_SCHEMA = {};
var PIPE_SCHEMA = {};
var PUMP_DEFAULT_PROPS = { curveData: [] };
var VALVE_SCHEMA = {};
var CHECK_VALVE_SCHEMA = {};
var SEPARATOR_SCHEMA = {};
var VERTICAL_VESSEL_SCHEMA = {};
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
var connections = [
    { from: 'SRC-300', to: 'E-300', pipeId: 'PIPE-300', connectionType: 'hydraulic' },
    { from: 'E-300', to: 'P-300', pipeId: 'PIPE-301', connectionType: 'hydraulic' }
];
var hydraulicNetworkState = {
    pipes: {},
    pumps: {
        'P-300': {
            suctionPath: {
                direction: 'upstream',
                boundaryId: 'SRC-300',
                steps: [
                    { from: 'SRC-300', to: 'E-300', pipeId: 'PIPE-300' },
                    { from: 'E-300', to: 'P-300', pipeId: 'PIPE-301' }
                ]
            },
            dischargePath: { direction: 'downstream', boundaryId: 'SNK-300', steps: [] }
        }
    }
};
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
            viscosity: 0.893,
            vaporPressure: 0.031698,
            specificHeat: 4.181
        }
    },
    'SRC-300': { type: 'source', name: 'SRC-300', props: { sourceType: 'Standalone Boundary Source' } },
    'PIPE-300': { type: 'pipe', name: 'PIPE-300', props: {}, results: { pressureCalculated: true, flow: 120 } },
    'PIPE-301': { type: 'pipe', name: 'PIPE-301', props: {}, results: { pressureCalculated: true, flow: 120 } },
    'E-300': {
        type: 'heatExchanger',
        name: 'E-300',
        props: {
            duty: 100,
            pressureDrop: 0.1,
            outletTemp: 60
        }
    },
    'P-300': { type: 'pump', name: 'P-300', props: {} }
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
`, context, { filename: 'heat-exchanger-trace-prelude.js' });

[
    'formulas/constants.js',
    'core/unit-system.js',
    'properties/objects/heat-exchanger-properties.js',
    'formulas/objects/heat-exchanger-formulas.js',
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

const trace = vm.runInContext(`buildHeatExchangerCalculationTrace('E-300', globalModel, connections)`, context);
const expectedHead = 0.1 * 100000 / (997.047 * 9.81);
const expectedMassFlow = 120 * 997.047;
const expectedDuty = (expectedMassFlow / 3600) * 4.181 * 35;

assert(trace.status === 'OK', 'Heat Exchanger trace should be OK for complete connected inputs');
assertClose('pressure drop head', trace.hydraulic.pressureDropHead, expectedHead, 0.001);
assertClose('solved exchanger flow', trace.hydraulic.flow, 120, 0.001);
assertClose('mass flow', trace.hydraulic.massFlowKgH, expectedMassFlow, 0.001);
assertClose('delta temperature', trace.thermal.deltaTemp, 35, 0.001);
assertClose('calculated duty', trace.thermal.calculatedDuty, expectedDuty, 0.001);
assertClose('duty residual', trace.thermal.dutyResidual, 100 - expectedDuty, 0.001);
assertClose('NPSH loss contribution', trace.hydraulic.npshLossContribution, expectedHead, 0.001);
assert(trace.inputBasis.npshPathRole.includes('P-300: Suction path'), 'Expected HX to be detected in pump suction path');
assert(trace.dependencyChain.some(item => item.includes('pressure-drop head')), 'Expected pressure-drop dependency chain');
assert(trace.dependencyChain.some(item => item.includes('NPSHA')), 'Expected NPSH dependency chain');
assert(trace.steps.some(step => step.title === 'Pressure Drop Head'), 'Expected pressure-drop head equation');
assert(trace.steps.some(step => step.title === 'Thermal Duty from Flow'), 'Expected thermal duty equation');
assert(trace.steps.some(step => step.title === 'NPSH Loss Contribution'), 'Expected NPSH contribution equation');
assert(trace.references.some(item => item.includes('pdf_ref/ref4')), 'Expected local HI/NPSH reference');
assert(trace.references.some(item => item.includes('NIST Chemistry WebBook')), 'Expected NIST reference');

vm.runInContext(`globalModel.SETTINGS.props.unitStandard = UNIT_STANDARD_US;`, context);
const usHtml = vm.runInContext(`renderHeatExchangerCalculationTraceReport(buildHeatExchangerCalculationTrace('E-300', globalModel, connections))`, context);
assert(usHtml.includes('hp'), 'US Heat Exchanger trace should show duty as hp');
assert(usHtml.includes('psi'), 'US Heat Exchanger trace should show pressure drop as psi');
assert(usHtml.includes('ft'), 'US Heat Exchanger trace should show pressure-drop head as ft');
assert(usHtml.includes('gpm'), 'US Heat Exchanger trace should show flow as gpm');
assert(usHtml.includes('lb/h'), 'US Heat Exchanger trace should show mass flow as lb/h');
assert(usHtml.includes('deg F'), 'US Heat Exchanger trace should show temperatures as deg F');
assert(usHtml.includes('Btu/lb.F'), 'US Heat Exchanger trace should show specific heat as Btu/lb.F');
assert(usHtml.includes('Dependency Chain'), 'Heat Exchanger report should render Dependency Chain');
assert(usHtml.includes('Equation Steps'), 'Heat Exchanger report should render Equation Steps');
assert(usHtml.includes('NPSH Role'), 'Heat Exchanger report should render NPSH Role section');

console.log('heat-exchanger-trace-validation: ok');
