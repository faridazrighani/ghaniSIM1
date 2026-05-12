const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const context = { console, Math, Number, parseFloat, JSON };
context.window = context;
vm.createContext(context);

vm.runInContext(`
var TANK_SCHEMA = {};
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
var SOURCE_SCHEMA = {};
var SINK_SCHEMA = {};
var JUNCTION_SCHEMA = {};
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
    'SRC-100': {
        type: 'source',
        name: 'SRC-100',
        props: {
            sourceType: 'Standalone Boundary Source',
            boundaryDataSource: 'Manual',
            pressureInputBasis: 'Gauge',
            pressure: 0,
            pressureEnergyBasis: 'Static Pressure',
            elevation: 0,
            temperatureMode: 'Use Fluid Basis',
            temp: 25,
            flowInputMode: 'Mass Flow',
            massFlow: 9500,
            flow: 9500 / 997.047
        }
    },
    'TK-100': {
        type: 'tank',
        name: 'TK-100',
        props: {
            pressureInputBasis: 'Gauge',
            pressure: 0.1,
            elevation: 6,
            liquidLevel: 3,
            outletNozzleElevation: 1
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
`, context, { filename: 'source-trace-prelude.js' });

[
    'formulas/constants.js',
    'core/unit-system.js',
    'properties/objects/pipe-properties.js',
    'formulas/objects/pipe-formulas.js',
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

const manualTrace = vm.runInContext(`buildSourceCalculationTrace('SRC-100', globalModel, connections)`, context);
assert(manualTrace.status === 'Review', 'Standalone SRC without pipe should be Review');
assert(manualTrace.warnings.some(item => item.includes('solid hydraulic pipe')), 'Standalone SRC should warn about missing solid pipe');
assertClose('manual source absolute pressure', manualTrace.boundary.absolutePressureBar, 1.01325, 1e-9);
assertClose('manual source flow conversion', manualTrace.readouts.find(item => item.label === 'Volumetric Flow').value, 9500 / 997.047, 1e-9);
assert(manualTrace.steps.some(step => step.title === 'Absolute pressure'), 'SRC trace should include pressure conversion');
assert(manualTrace.steps.some(step => step.title === 'Flow conversion'), 'SRC trace should include flow conversion');
assert(manualTrace.steps.some(step => step.title === 'Source hydraulic head'), 'SRC trace should include source head');
assert(manualTrace.steps.some(step => step.title === 'Hydraulic traversal'), 'SRC trace should include traversal rule');
assert(manualTrace.dependencyChain.some(item => item.includes('Pressure Basis')), 'SRC trace should expose pressure dependency chain');
assert(manualTrace.references.some(item => item.includes('pdf_ref/ref4')), 'SRC trace should cite local HI NPSH reference');
assert(manualTrace.references.some(item => item.includes('NIST Guide to the SI')), 'SRC trace should cite NIST standard atmosphere source');

vm.runInContext(`
globalModel.SETTINGS.props.unitStandard = UNIT_STANDARD_US;
`, context);
const usHtml = vm.runInContext(`renderSourceCalculationTraceReport(buildSourceCalculationTrace('SRC-100', globalModel, connections))`, context);
assert(usHtml.includes('psig'), 'US SRC trace should show gauge pressure as psig');
assert(usHtml.includes('psia'), 'US SRC trace should show absolute pressure as psia');
assert(usHtml.includes('ft'), 'US SRC trace should show head/elevation as ft');
assert(usHtml.includes('gpm'), 'US SRC trace should show volumetric flow as gpm');
assert(usHtml.includes('lb/h'), 'US SRC trace should show mass flow as lb/h');
assert(usHtml.includes('deg F'), 'US SRC trace should show temperature as deg F');
assert(usHtml.includes('lb/ft3'), 'US SRC trace should show density as lb/ft3');
assert(usHtml.includes('Dependency Chain'), 'SRC Task Window report should render Dependency Chain');
assert(usHtml.includes('pdf_ref/ref4'), 'SRC Task Window report should render local reference path');

const inheritedTrace = vm.runInContext(`
globalModel.SETTINGS.props.unitStandard = UNIT_STANDARD_METRIC;
globalModel['SRC-100'].props.sourceType = 'Open Tank / Reservoir';
globalModel['SRC-100'].props.boundaryDataSource = 'Inherit from Attached Equipment';
sourceLinks.splice(0, sourceLinks.length, {
    sourceId: 'SRC-100',
    targetId: 'TK-100',
    targetPort: '.port.inlet',
    connectionType: 'semantic',
    attachmentType: 'source-boundary',
    visualStyle: 'dashed'
});
buildSourceCalculationTrace('SRC-100', globalModel, connections);
`, context);
assertClose('inherited source pressure', inheritedTrace.boundary.absolutePressureBar, 1.11325, 1e-9);
assertClose('inherited source elevation', inheritedTrace.boundary.elevation, 9, 1e-9);
assert(inheritedTrace.steps.some(step => step.formula === 'z_source = z_tank base + liquid level'), 'Inherited SRC should trace liquid-level source elevation');
assert(inheritedTrace.inputBasis.connectionStyle.includes('Dashed'), 'Open Tank SRC should trace dashed semantic connection rule');
assert(inheritedTrace.warnings.some(item => item.includes('no hydraulic path exists')), 'Attached SRC without tank-to-pump pipe should warn about missing hydraulic path');

console.log('source-trace-validation: ok');
