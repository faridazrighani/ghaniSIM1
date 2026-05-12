const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const context = { console, Math, Number, parseFloat, JSON };
context.window = context;
vm.createContext(context);

vm.runInContext(`
var globalModel = {
    FLUID: {
        type: 'fluid',
        name: 'Fluid Basis',
        props: { fluidName: 'Water', temp: 25 }
    }
};
`, context, { filename: 'unit-system-prelude.js' });

['formulas/constants.js', 'core/unit-system.js'].forEach(file => {
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

const defaultStandard = vm.runInContext(`getUnitStandard()`, context);
assert(defaultStandard === 'Metric / European Engineering', 'Default unit standard should be Metric / European Engineering');
assert(vm.runInContext(`getSimulationSettings().basisConfirmed`, context) === false, 'Fresh project basis should start unconfirmed');

vm.runInContext(`setUnitStandard(UNIT_STANDARD_SI, { markDirty: false })`, context);
assert(vm.runInContext(`getDisplayUnit('pressureAbs')`, context) === 'kPa a', 'SI absolute pressure display unit should be kPa a');
assert(vm.runInContext(`getDisplayUnit('flow')`, context) === 'm3/s', 'SI flow display unit should be m3/s');
assertClose('1.01325 bar to kPa', vm.runInContext(`convertToDisplay(1.01325, 'pressureAbs')`, context), 101.325, 1e-9);
assertClose('101.325 kPa to bar', vm.runInContext(`convertFromDisplay(101.325, 'pressureAbs')`, context), 1.01325, 1e-9);
assertClose('3600 m3/h to m3/s', vm.runInContext(`convertToDisplay(3600, 'flow')`, context), 1, 1e-12);
assertClose('1 m3/s to m3/h', vm.runInContext(`convertFromDisplay(1, 'flow')`, context), 3600, 1e-12);

vm.runInContext(`setUnitStandard(UNIT_STANDARD_US, { markDirty: false })`, context);
assert(vm.runInContext(`getDisplayUnit('pressureGauge')`, context) === 'psig', 'US gauge pressure display unit should be psig');
assert(vm.runInContext(`getDisplayUnit('diameter')`, context) === 'in', 'US diameter display unit should be inches');
assertClose('25 C to 77 F', vm.runInContext(`convertToDisplay(25, 'temperature')`, context), 77, 1e-12);
assertClose('77 F to 25 C', vm.runInContext(`convertFromDisplay(77, 'temperature')`, context), 25, 1e-12);
assertClose('1 m3/h to gpm', vm.runInContext(`convertToDisplay(1, 'flow')`, context), 4.402867539, 1e-9);
assertClose('4.402867539 gpm to m3/h', vm.runInContext(`convertFromDisplay(4.402867539, 'flow')`, context), 1, 1e-9);
assertClose('1 m to ft', vm.runInContext(`convertToDisplay(1, 'head')`, context), 3.280839895, 1e-9);
assertClose('1 m diameter to inch', vm.runInContext(`convertToDisplay(1, 'diameter')`, context), 39.37007874, 1e-8);
assertClose('1 kW to hp', vm.runInContext(`convertToDisplay(1, 'power')`, context), 1.34102209, 1e-8);

vm.runInContext(`confirmBasisSetup()`, context);
assert(vm.runInContext(`getSimulationSettings().basisConfirmed`, context) === true, 'Basis confirmation should be stored');
vm.runInContext(`setUnitStandard(UNIT_STANDARD_METRIC)`, context);
assert(vm.runInContext(`getSimulationSettings().basisDirty`, context) === true, 'Changing unit standard after confirmation should mark basis dirty');
assert(vm.runInContext(`isBasisConfirmed()`, context) === false, 'Dirty basis should not be considered confirmed');

const inferredPressure = vm.runInContext(`getDisplayFieldMeta('source', 'pressure', 'Boundary Pressure', 'bar g')`, context);
assert(inferredPressure.quantity === 'pressureGauge', 'Gauge pressure field should infer pressureGauge quantity');
const inferredPressureHead = vm.runInContext(`getDisplayFieldMeta('fluid', 'vaporPressureHead', 'Vapor Pressure Head', 'm')`, context);
assert(inferredPressureHead.quantity === 'head', 'Vapor Pressure Head should infer head quantity, not pressure');
assert(inferredPressureHead.unit === 'm', 'Metric vapor pressure head display unit should remain m');
vm.runInContext(`setUnitStandard(UNIT_STANDARD_US, { markDirty: false })`, context);
const inferredPressureDropHead = vm.runInContext(`getDisplayFieldMeta('valve', 'Cv Pressure Drop Head', 'Cv Pressure Drop Head', 'm')`, context);
assert(inferredPressureDropHead.quantity === 'head', 'Cv Pressure Drop Head should infer head quantity, not pressure');
assert(inferredPressureDropHead.unit === 'ft', 'US Cv Pressure Drop Head display unit should be ft');

const unitSystemSource = fs.readFileSync(path.join(projectRoot, 'core/unit-system.js'), 'utf8');
const styles = fs.readFileSync(path.join(projectRoot, 'style.css'), 'utf8');
assert(unitSystemSource.includes('basis-status-confirmed-clean'), 'Basis status pill should expose a confirmed/clean class');
assert(styles.includes('@media (max-width: 640px)') && styles.includes('.basis-status-pill.basis-status-confirmed-clean'), 'Mobile layout should hide the confirmed/clean basis status pill');
assert(styles.includes('(pointer: coarse)'), 'Cellular landscape hiding should be limited to coarse pointer devices');

console.log('unit-system-validation: ok');
