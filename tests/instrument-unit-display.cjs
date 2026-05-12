const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const context = { console, Math, Number, parseFloat, JSON };
context.window = context;
vm.createContext(context);

vm.runInContext(`
var cells = {
    pressureValue: { textContent: '' },
    pressureUnit: { textContent: '' },
    temperatureValue: { textContent: '' },
    temperatureUnit: { textContent: '' },
    flowValue: { textContent: '' },
    flowUnit: { textContent: '' }
};
var mockObjectEl = {
    classList: { toggle() {} },
    querySelector(selector) {
        if (selector === '[data-readout-key="pressure"]') return cells.pressureValue;
        if (selector === '[data-readout-unit="pressure"]') return cells.pressureUnit;
        if (selector === '[data-readout-key="temperature"]') return cells.temperatureValue;
        if (selector === '[data-readout-unit="temperature"]') return cells.temperatureUnit;
        if (selector === '[data-readout-key="flow"]') return cells.flowValue;
        if (selector === '[data-readout-unit="flow"]') return cells.flowUnit;
        return null;
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
    'PTF-100': {
        type: 'lineMonitor',
        name: 'PTF-100',
        props: {
            measuredPressure: 1.01325,
            measuredTemperature: 25,
            measuredFlow: 10,
            attachedTo: 'PIP-100'
        }
    }
};
function getObjectElement(id) { return id === 'PTF-100' ? mockObjectEl : null; }
function isInstrumentType(type) { return ['lineMonitor', 'pressureIndicator', 'flowIndicator', 'temperatureIndicator', 'levelController'].includes(type); }
var currentSelectedNode = null;
var activeChartPumpId = null;
function updateBasisStatusPill() {}
function renderSidebar() {}
`, context, { filename: 'instrument-unit-prelude.js' });

['formulas/constants.js', 'core/unit-system.js', 'core/simulation-engine.js'].forEach(file => {
    vm.runInContext(
        fs.readFileSync(path.join(projectRoot, file), 'utf8'),
        context,
        { filename: file }
    );
});

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

vm.runInContext(`updateLineMonitorCanvasReadout('PTF-100')`, context);
assert(vm.runInContext(`cells.pressureValue.textContent`, context) === '1.01', 'Metric pressure value should remain in bar a');
assert(vm.runInContext(`cells.pressureUnit.textContent`, context) === 'bar a', 'Metric pressure unit should be bar a');
assert(vm.runInContext(`cells.temperatureUnit.textContent`, context) === 'deg C', 'Metric temperature unit should be deg C');
assert(vm.runInContext(`cells.flowUnit.textContent`, context) === 'm3/h', 'Metric flow unit should be m3/h');

vm.runInContext(`globalModel.SETTINGS.props.unitStandard = UNIT_STANDARD_US; updateLineMonitorCanvasReadout('PTF-100')`, context);
assert(vm.runInContext(`cells.pressureUnit.textContent`, context) === 'psia', 'US pressure unit should be psia');
assert(vm.runInContext(`cells.temperatureValue.textContent`, context) === '77.0', 'US temperature value should convert to deg F');
assert(vm.runInContext(`cells.temperatureUnit.textContent`, context) === 'deg F', 'US temperature unit should be deg F');
assert(vm.runInContext(`cells.flowValue.textContent`, context) === '44.03', 'US flow value should convert to gpm');
assert(vm.runInContext(`cells.flowUnit.textContent`, context) === 'gpm', 'US flow unit should be gpm');

vm.runInContext(`globalModel.SETTINGS.props.unitStandard = UNIT_STANDARD_SI; updateLineMonitorCanvasReadout('PTF-100')`, context);
assert(vm.runInContext(`cells.pressureValue.textContent`, context) === '101.33', 'SI pressure value should convert to kPa a');
assert(vm.runInContext(`cells.pressureUnit.textContent`, context) === 'kPa a', 'SI pressure unit should be kPa a');
assert(vm.runInContext(`cells.flowValue.textContent`, context) === '0.0028', 'SI flow display should convert to m3/s with useful canvas rounding');
assert(vm.runInContext(`cells.flowUnit.textContent`, context) === 'm3/s', 'SI flow unit should be m3/s');

console.log('instrument-unit-display: ok');
