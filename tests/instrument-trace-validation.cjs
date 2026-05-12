const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const context = { console, Math, Number, parseFloat, JSON };
context.window = context;
vm.createContext(context);

vm.runInContext(`
var PRESSURE_INDICATOR_SCHEMA = {};
var FLOW_INDICATOR_SCHEMA = {};
var TEMPERATURE_INDICATOR_SCHEMA = {};
var LINE_MONITOR_SCHEMA = {};
var LEVEL_CONTROLLER_SCHEMA = {};
var TANK_SCHEMA = {};
var PIPE_SCHEMA = {};
var VALVE_SCHEMA = {};
var CHECK_VALVE_SCHEMA = {};
var SEPARATOR_SCHEMA = {};
var VERTICAL_VESSEL_SCHEMA = {};
var HEAT_EXCHANGER_SCHEMA = {};
var MIXER_SCHEMA = {};
var SOURCE_SCHEMA = {};
var SINK_SCHEMA = {};
var JUNCTION_SCHEMA = {};
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
var connections = [{ from: 'TK-100', to: 'P-100', pipeId: 'PIP-100', connectionType: 'hydraulic' }];
var instrumentLinks = [{ instrumentId: 'PTF-100', pipeId: 'PIP-100', location: 0.25 }];
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
        props: { fluidName: 'Water', temp: 25, density: 997.047 }
    },
    'PIP-100': {
        type: 'pipe',
        name: 'PIP-100',
        props: {},
        results: {
            pressureCalculated: true,
            inletPressure: 2,
            outletPressure: 1,
            pressure: 1.5,
            flow: 10
        }
    },
    'PTF-100': {
        type: 'lineMonitor',
        name: 'PTF-100',
        props: {
            attachedTo: 'PIP-100',
            pressureRangeMin: 0,
            pressureRangeMax: 10,
            flowRangeMin: 0,
            flowRangeMax: 100,
            tempRangeMin: 0,
            tempRangeMax: 100
        }
    },
    'LIC-100': {
        type: 'levelController',
        name: 'LIC-100',
        props: { setPoint: 55, outputMode: 'Auto' }
    },
    'PTF-101': {
        type: 'lineMonitor',
        name: 'PTF-101',
        props: {
            pressureRangeMin: 0,
            pressureRangeMax: 10,
            flowRangeMin: 0,
            flowRangeMax: 100,
            tempRangeMin: 0,
            tempRangeMax: 100
        }
    }
};
function getInstrumentLink(instrumentId) {
    const instrument = globalModel[instrumentId];
    const attachedTo = instrument && instrument.props ? instrument.props.attachedTo : null;
    return instrumentLinks.find(link => link.instrumentId === instrumentId)
        || (attachedTo ? { instrumentId, pipeId: attachedTo, location: 0.5 } : null);
}
`, context, { filename: 'instrument-trace-prelude.js' });

[
    'formulas/constants.js',
    'core/unit-system.js',
    'formulas/objects/instrument-formulas.js',
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
    if (Math.abs(actual - expected) > tolerance) {
        throw new Error(`${label}: expected ${expected}, got ${actual}`);
    }
}

const ptfTrace = vm.runInContext(`buildInstrumentCalculationTrace('PTF-100', globalModel, connections)`, context);
assert(ptfTrace.status === 'OK', 'PTF trace should be OK for attached pipe');
assertClose('tap pressure', ptfTrace.readouts.find(item => item.label === 'Pressure').value, 1.75);
assertClose('flow readout', ptfTrace.readouts.find(item => item.label === 'Flow').value, 10);
assertClose('temperature readout', ptfTrace.readouts.find(item => item.label === 'Temperature').value, 25);
assertClose('pressure signal', ptfTrace.readouts.find(item => item.label === 'Pressure Signal').value, 17.5);
assert(ptfTrace.steps.some(step => step.title === 'Tap pressure'), 'PTF trace should include tap pressure step');
assert(ptfTrace.steps.some(step => step.title === 'Flow readout'), 'PTF trace should include flow readout step');
assert(ptfTrace.steps.some(step => step.title === 'Temperature readout'), 'PTF trace should include temperature readout step');

const licTrace = vm.runInContext(`buildInstrumentCalculationTrace('LIC-100', globalModel, connections)`, context);
assert(licTrace.status === 'OK - controller trace only', 'LIC trace should be controller trace only');
assertClose('LIC set point', licTrace.readouts.find(item => item.label === 'Controller Set Point').value, 55);
assert(licTrace.steps.some(step => step.title === 'Controller signal'), 'LIC trace should include set-point signal step');

const missingTrace = vm.runInContext(`buildInstrumentCalculationTrace('PTF-101', globalModel, connections)`, context);
assert(missingTrace.status === 'Waiting for pipe attachment', 'Unattached PTF should wait for pipe attachment');
assert(missingTrace.warnings.some(item => item.includes('not attached to a pipe')), 'Unattached PTF should warn about missing pipe attachment');

vm.runInContext(`globalModel.SETTINGS.props.unitStandard = UNIT_STANDARD_US`, context);
const usHtml = vm.runInContext(`renderInstrumentCalculationTraceReport(buildInstrumentCalculationTrace('PTF-100', globalModel, connections))`, context);
assert(usHtml.includes('psia'), 'US instrument trace should show absolute pressure as psia');
assert(usHtml.includes('gpm'), 'US instrument trace should show flow as gpm');
assert(usHtml.includes('deg F'), 'US instrument trace should show temperature as deg F');

console.log('instrument-trace-validation: ok');
