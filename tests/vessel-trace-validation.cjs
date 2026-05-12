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
var sourceLinks = [{ sourceId: 'SRC-101', targetId: 'VES-100' }];
var connections = [
    { from: 'SRC-100', to: 'VES-100', pipeId: 'PIPE-100', connectionType: 'hydraulic' }
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
            viscosity: 0.893,
            vaporPressure: 0.031698
        }
    },
    'SRC-100': {
        type: 'source',
        name: 'SRC-100',
        props: {
            sourceType: 'Standalone Boundary Source'
        }
    },
    'SRC-101': {
        type: 'source',
        name: 'SRC-101',
        props: {
            sourceType: 'Open Tank / Reservoir',
            flowInputMode: 'Volumetric Flow',
            flow: 9.528
        }
    },
    'PIPE-100': {
        type: 'pipe',
        name: 'PIPE-100',
        props: {},
        results: {
            pressureCalculated: true,
            flow: 120
        }
    },
    'VES-100': {
        type: 'separator',
        name: 'VES-100',
        props: {
            visualScale: 100,
            elevation: 6,
            liquidLevel: 3,
            inletNozzleElevation: 3,
            outletNozzleElevation: 1,
            pressureInputBasis: 'Gauge',
            pressure: 0.5,
            pressureDrop: 0.1,
            residenceTime: 5,
            orientation: 'Horizontal'
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
`, context, { filename: 'vessel-trace-prelude.js' });

[
    'formulas/constants.js',
    'core/unit-system.js',
    'properties/objects/separator-properties.js',
    'formulas/objects/separator-formulas.js',
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

const trace = vm.runInContext(`buildSeparatorCalculationTrace('VES-100', globalModel, connections)`, context);
assert(trace.status === 'OK', 'Vessel H trace should be OK for complete basic inputs');
assertClose('absolute pressure', trace.boundary.pressureAbsBar, 1.51325, 1e-9);
assertClose('liquid surface elevation', trace.boundary.liquidSurfaceElevation, 9, 1e-9);
assertClose('outlet submergence', trace.boundary.outletSubmergence, 8, 1e-9);
assertClose('solved hydraulic flow', trace.boundary.flow, 120, 1e-9);
assertClose('holdup flow basis', trace.boundary.holdupFlow, 129.528, 1e-9);
assertClose('holdup volume', trace.boundary.holdupVolume, 10.794, 1e-9);
assertClose('pressure drop head', trace.boundary.pressureDropHead, 0.1 * 100000 / (997.047 * 9.81), 0.001);
assertClose('hydraulic inlet flow', trace.flowBalance.hydraulicInletFlow, 120, 1e-9);
assertClose('hydraulic outlet flow', trace.flowBalance.hydraulicOutletFlow, 0, 1e-9);
assertClose('total SRC feed flow', trace.flowBalance.sourceFeedFlow, 9.528, 1e-9);
assertClose('inlet flow', trace.flowBalance.inletFlow, 129.528, 1e-9);
assertClose('outlet flow', trace.flowBalance.outletFlow, 0, 1e-9);
assertClose('net flow', trace.flowBalance.netFlow, 129.528, 1e-9);
assert(trace.flowBalance.levelTrend === 'Rising', 'Vessel H level trend should be Rising for positive net flow');
assert(trace.flowBalance.sourceFeedFlows.some(row => row.sourceId === 'SRC-101'), 'Vessel H should include SRC feed flow breakdown rows');
assert(trace.dependencyChain.some(item => item.includes('Pressure Basis')), 'Vessel H trace should include pressure dependency');
assert(trace.dependencyChain.some(item => item.includes('Pressure drop')), 'Vessel H trace should include pressure-drop dependency');
assert(trace.dependencyChain.some(item => item.includes('Total SRC Feed Flow')), 'Vessel H trace should include source feed dependency');
assert(trace.steps.some(step => step.title === 'Pressure Drop Head'), 'Vessel H trace should include pressure drop head equation');
assert(trace.steps.some(step => step.title === 'Total SRC Feed Flow'), 'Vessel H trace should include total SRC feed equation');
assert(trace.steps.some(step => step.title === 'Vessel Net Flow'), 'Vessel H trace should include net flow equation');
assert(trace.steps.some(step => step.title === 'Level Trend'), 'Vessel H trace should include level trend equation');
assert(trace.steps.some(step => step.title === 'Residence Holdup'), 'Vessel H trace should include residence holdup equation');
assert(trace.references.some(item => item.includes('pdf_ref/ref4')), 'Vessel H trace should cite local HI/NPSH reference');
assert(trace.references.some(item => item.includes('NIST Guide to the SI')), 'Vessel H trace should cite NIST standard atmosphere source');
assertClose('standard example pressure', trace.standardExample.pressure, 0.1, 1e-9);
assertClose('standard example base elevation', trace.standardExample.baseElevation, 6, 1e-9);
assertClose('standard example liquid level', trace.standardExample.liquidLevel, 3, 1e-9);
assertClose('standard example outlet nozzle', trace.standardExample.outletNozzleElevation, 1, 1e-9);
assertClose('schema default base elevation', vm.runInContext(`SEPARATOR_SCHEMA.elevation.default`, context), 6, 1e-9);
assertClose('schema default vessel pressure', vm.runInContext(`SEPARATOR_SCHEMA.pressure.default`, context), 0.1, 1e-9);

vm.runInContext(`globalModel.SETTINGS.props.unitStandard = UNIT_STANDARD_US;`, context);
const usHtml = vm.runInContext(`renderSeparatorCalculationTraceReport(buildSeparatorCalculationTrace('VES-100', globalModel, connections))`, context);
assert(usHtml.includes('psig'), 'US Vessel H trace should show gauge pressure as psig');
assert(usHtml.includes('psia'), 'US Vessel H trace should show absolute pressure as psia');
assert(usHtml.includes('psi'), 'US Vessel H trace should show pressure drop as psi');
assert(usHtml.includes('ft'), 'US Vessel H trace should show elevation/head as ft');
assert(usHtml.includes('gpm'), 'US Vessel H trace should show flow as gpm');
assert(usHtml.includes('ft3'), 'US Vessel H trace should show holdup volume as ft3');
assert(usHtml.includes('lb/ft3'), 'US Vessel H trace should show density as lb/ft3');
assert(usHtml.includes('Dependency Chain'), 'Vessel H Task Window report should render Dependency Chain');
assert(usHtml.includes('Equation Steps'), 'Vessel H Task Window report should render Equation Steps');
assert(usHtml.includes('Standard Example Values'), 'Vessel H Task Window report should render standard example values');
assert(usHtml.includes('Flow Balance'), 'Vessel H Task Window report should render Flow Balance');
assert(usHtml.includes('SRC Feed Flow Breakdown'), 'Vessel H Task Window report should render SRC feed breakdown');
assert(usHtml.includes('Rising'), 'Vessel H Task Window report should render level trend');
assert(usHtml.includes('19.685 ft'), 'US Vessel H standard example should convert 6 m base elevation to ft');

console.log('vessel-trace-validation: ok');
