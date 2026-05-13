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
var VALVE_SCHEMA = {};
var CHECK_VALVE_SCHEMA = {};
var SEPARATOR_SCHEMA = {};
var VERTICAL_VESSEL_SCHEMA = {};
var HEAT_EXCHANGER_SCHEMA = {};
var MIXER_SCHEMA = {};
var PRESSURE_INDICATOR_SCHEMA = {};
var FLOW_INDICATOR_SCHEMA = {};
var TEMPERATURE_INDICATOR_SCHEMA = {};
var LINE_MONITOR_SCHEMA = {};
var LEVEL_CONTROLLER_SCHEMA = {};
var connections = [];
var sourceLinks = [];
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
            sg: 0.99707
        }
    },
    'SNK-100': {
        type: 'sink',
        name: 'SNK-100',
        props: {
            active: 'Active',
            boundaryMode: 'Free Outlet / Atmospheric Discharge',
            pressureInputBasis: 'Gauge',
            pressure: 0,
            pressureBasis: 'Static',
            elevation: 2,
            demandFlow: 0
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
`, context, { filename: 'sink-trace-prelude.js' });

[
    'formulas/constants.js',
    'core/unit-system.js',
    'properties/objects/network-node-properties.js',
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

assert(vm.runInContext(`SINK_SCHEMA.boundaryMode.default`, context) === 'Free Outlet / Atmospheric Discharge', 'SNK default boundary mode should be free outlet');
assert(vm.runInContext(`SINK_SCHEMA.boundaryMode.options.includes('Outlet Pressure Boundary')`, context), 'SNK schema should expose pressure boundary mode');
assert(vm.runInContext(`SINK_SCHEMA.boundaryMode.options.includes('Flow Demand Boundary')`, context), 'SNK schema should expose flow demand boundary mode');
assert(vm.runInContext(`isSinkFreeOutletBoundary(globalModel['SNK-100'])`, context), 'Free outlet SNK should be detected');
assertClose('free outlet pressure', vm.runInContext(`getSinkBoundaryAbsolutePressureBar(globalModel['SNK-100'])`, context), 1.01325, 1e-12);

const freeTrace = vm.runInContext(`buildSinkCalculationTrace('SNK-100', globalModel, connections)`, context);
assert(freeTrace.status === 'Review', 'Free outlet without pipe should be Review');
assert(freeTrace.steps.some(step => step.title === 'SNK boundary role'), 'SNK trace should include boundary role');
assert(freeTrace.steps.some(step => step.substitution.includes('0 bar g = 1.01325 bar a')), 'Free outlet trace should document atmospheric pressure');
assert(freeTrace.dependencyChain.some(item => item.includes('Boundary Mode')), 'SNK trace should expose mode dependency');
assert(freeTrace.references.some(item => item.includes('pdf_ref/ref4')), 'SNK trace should cite local HI NPSH reference');
assert(freeTrace.references.some(item => item.includes('NIST Guide to the SI')), 'SNK trace should cite standard atmosphere source');

vm.runInContext(`globalModel.SETTINGS.props.unitStandard = UNIT_STANDARD_US;`, context);
const usHtml = vm.runInContext(`renderSinkCalculationTraceReport(buildSinkCalculationTrace('SNK-100', globalModel, connections))`, context);
assert(usHtml.includes('psia'), 'US SNK trace should show absolute pressure as psia');
assert(usHtml.includes('ft'), 'US SNK trace should show elevation/head as ft');
assert(usHtml.includes('deg F'), 'US SNK trace should show temperature as deg F');
assert(usHtml.includes('lb/ft3'), 'US SNK trace should show density as lb/ft3');
assert(usHtml.includes('Dependency Chain'), 'SNK Task Window report should render Dependency Chain');
assert(usHtml.includes('Equation Steps'), 'SNK Task Window report should render Equation Steps');

const pressureTrace = vm.runInContext(`
globalModel.SETTINGS.props.unitStandard = UNIT_STANDARD_METRIC;
globalModel['SNK-100'].props.boundaryMode = 'Outlet Pressure';
globalModel['SNK-100'].props.pressureInputBasis = 'Gauge';
globalModel['SNK-100'].props.pressure = 2;
buildSinkCalculationTrace('SNK-100', globalModel, connections);
`, context);
assert(vm.runInContext(`getSinkBoundaryModeValue(globalModel['SNK-100'])`, context) === 'Outlet Pressure Boundary', 'Legacy outlet pressure mode should normalize to new label');
assertClose('pressure boundary absolute pressure', pressureTrace.boundary.absolutePressureBar, 3.01325, 1e-12);

const flowTrace = vm.runInContext(`
globalModel['SNK-100'].props.boundaryMode = 'Flow Demand';
globalModel['SNK-100'].props.demandFlow = 20;
buildSinkCalculationTrace('SNK-100', globalModel, connections);
`, context);
assert(vm.runInContext(`isSinkFlowDemandBoundary(globalModel['SNK-100'])`, context), 'Legacy flow demand mode should be detected');
assert(flowTrace.steps.some(step => step.title === 'Flow demand specification'), 'Flow demand trace should include demand step');
assert(flowTrace.readouts.some(item => item.label === 'Required Boundary P'), 'Flow demand trace should expose required boundary pressure readout');

const objectSource = fs.readFileSync(path.join(projectRoot, 'properties/object-properties.js'), 'utf8');
const simulationSource = fs.readFileSync(path.join(projectRoot, 'core/simulation-engine.js'), 'utf8');
const unitSource = fs.readFileSync(path.join(projectRoot, 'core/unit-system.js'), 'utf8');
assert(objectSource.includes('renderSinkCalculationTrace'), 'SNK task window should render calculation trace');
assert(simulationSource.includes('updateAllSinkCalculationTraceReadouts'), 'Simulation update should refresh SNK traces');
assert(unitSource.includes('updateAllSinkCalculationTraceReadouts'), 'Unit change should refresh SNK traces');

console.log('sink-trace-validation: ok');
