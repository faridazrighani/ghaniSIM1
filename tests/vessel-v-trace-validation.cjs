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
var sourceLinks = [{ sourceId: 'SRC-201', targetId: 'VES-200' }];
var connections = [
    { from: 'SRC-200', to: 'VES-200', pipeId: 'PIPE-200', connectionType: 'hydraulic' }
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
    'SRC-200': {
        type: 'source',
        name: 'SRC-200',
        props: {
            sourceType: 'Standalone Boundary Source'
        }
    },
    'SRC-201': {
        type: 'source',
        name: 'SRC-201',
        props: {
            sourceType: 'Pressurized Vessel',
            flowInputMode: 'Volumetric Flow',
            flow: 6.5
        }
    },
    'PIPE-200': {
        type: 'pipe',
        name: 'PIPE-200',
        props: {},
        results: {
            pressureCalculated: true,
            flow: 80
        }
    },
    'VES-200': {
        type: 'verticalVessel',
        name: 'VES-200',
        props: {
            visualScale: 100,
            elevation: 4,
            liquidLevel: 5,
            inletNozzleElevation: 8,
            outletNozzleElevation: 4.8,
            pressureInputBasis: 'Gauge',
            pressure: 0.15,
            pressureDrop: 0.08,
            residenceTime: 8,
            orientation: 'Vertical'
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
`, context, { filename: 'vessel-v-trace-prelude.js' });

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

const trace = vm.runInContext(`buildSeparatorCalculationTrace('VES-200', globalModel, connections)`, context);
assert(trace.status === 'OK', 'Vessel V trace should be OK for complete basic inputs');
assert(trace.inputBasis.vesselLabel === 'Vessel V', 'Vessel V trace should use Vessel V label');
assert(trace.inputBasis.vesselType === 'Vessel V / Vertical Vessel', 'Vessel V trace should identify vertical vessel type');
assert(trace.inputBasis.orientation === 'Vertical', 'Vessel V trace should keep vertical orientation');
assert(trace.standardExample.vesselLabel === 'Vessel V', 'Vessel V standard example should use Vessel V label');
assert(trace.standardExample.orientation === 'Vertical', 'Vessel V standard example should be vertical');
assertClose('standard example base elevation', trace.standardExample.baseElevation, 4, 1e-9);
assertClose('standard example liquid level', trace.standardExample.liquidLevel, 5, 1e-9);
assertClose('standard example inlet nozzle', trace.standardExample.inletNozzleElevation, 8, 1e-9);
assertClose('standard example outlet nozzle', trace.standardExample.outletNozzleElevation, 4.8, 1e-9);
assertClose('standard example pressure', trace.standardExample.pressure, 0.15, 1e-9);
assertClose('standard example pressure drop', trace.standardExample.pressureDrop, 0.08, 1e-9);
assertClose('standard example residence time', trace.standardExample.residenceTime, 8, 1e-9);
assertClose('absolute pressure', trace.boundary.pressureAbsBar, 1.16325, 1e-9);
assertClose('liquid surface elevation', trace.boundary.liquidSurfaceElevation, 9, 1e-9);
assertClose('outlet submergence', trace.boundary.outletSubmergence, 4.2, 1e-9);
assertClose('hydraulic inlet flow', trace.flowBalance.hydraulicInletFlow, 80, 1e-9);
assertClose('total SRC feed flow', trace.flowBalance.sourceFeedFlow, 6.5, 1e-9);
assertClose('net flow', trace.flowBalance.netFlow, 86.5, 1e-9);
assert(trace.flowBalance.levelTrend === 'Rising', 'Vessel V level trend should be Rising for positive net flow');
assert(trace.dependencyChain.some(item => item.includes('Vessel V')), 'Vessel V dependency chain should use Vessel V wording');
assert(trace.steps.some(step => step.title === 'Total SRC Feed Flow'), 'Vessel V trace should include source feed equation');
assert(trace.steps.some(step => step.title === 'Vessel Net Flow'), 'Vessel V trace should include net flow equation');
assert(trace.references.some(item => item.includes('pdf_ref/ref4')), 'Vessel V trace should cite local NPSH reference');
assertClose('vertical schema default base elevation', vm.runInContext(`VERTICAL_VESSEL_SCHEMA.elevation.default`, context), 4, 1e-9);
assertClose('vertical schema default liquid level', vm.runInContext(`VERTICAL_VESSEL_SCHEMA.liquidLevel.default`, context), 5, 1e-9);
assertClose('vertical schema default inlet nozzle', vm.runInContext(`VERTICAL_VESSEL_SCHEMA.inletNozzleElevation.default`, context), 8, 1e-9);
assertClose('vertical schema default outlet nozzle', vm.runInContext(`VERTICAL_VESSEL_SCHEMA.outletNozzleElevation.default`, context), 4.8, 1e-9);
assertClose('vertical schema default pressure', vm.runInContext(`VERTICAL_VESSEL_SCHEMA.pressure.default`, context), 0.15, 1e-9);
assert(vm.runInContext(`VERTICAL_VESSEL_SCHEMA.orientation.default`, context) === 'Vertical', 'Vertical vessel schema should default to vertical orientation');

vm.runInContext(`globalModel.SETTINGS.props.unitStandard = UNIT_STANDARD_US;`, context);
const usHtml = vm.runInContext(`renderSeparatorCalculationTraceReport(buildSeparatorCalculationTrace('VES-200', globalModel, connections))`, context);
assert(usHtml.includes('Vessel V / Vertical Vessel'), 'US Vessel V report should render vertical vessel type');
assert(usHtml.includes('psig'), 'US Vessel V trace should show gauge pressure as psig');
assert(usHtml.includes('psia'), 'US Vessel V trace should show absolute pressure as psia');
assert(usHtml.includes('ft'), 'US Vessel V trace should show elevation/head as ft');
assert(usHtml.includes('gpm'), 'US Vessel V trace should show flow as gpm');
assert(usHtml.includes('ft3'), 'US Vessel V trace should show holdup volume as ft3');
assert(usHtml.includes('Flow Balance'), 'Vessel V report should render Flow Balance');
assert(usHtml.includes('SRC Feed Flow Breakdown'), 'Vessel V report should render SRC feed breakdown');
assert(usHtml.includes('Example values are applied to new Vessel V objects'), 'Vessel V standard example note should be object-specific');
assert(!usHtml.includes('new Vessel H objects'), 'Vessel V report should not use Vessel H standard example wording');

console.log('vessel-v-trace-validation: ok');
