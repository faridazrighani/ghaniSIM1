const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const scriptFiles = [
    'formulas/constants.js',
    'formulas/fluids/common-fluid-formulas.js',
    'formulas/fluids/water-formulas.js',
    'formulas/fluids/methanol-formulas.js',
    'formulas/fluids/palm-oil-formulas.js',
    'formulas/fluids/crude-oil-formulas.js'
];

const context = {
    console,
    Math,
    Number,
    parseFloat,
    JSON
};
context.window = context;
vm.createContext(context);

vm.runInContext(`
var globalModel = {
    FLUID: {
        type: 'fluid',
        name: 'Fluid Basis',
        props: {
            inputMode: 'Basic',
            fluidName: 'Water',
            temp: 25,
            density: 997,
            sg: 0.997,
            viscosity: 0.89,
            dynViscosity: 0.89,
            vaporPressure: 0.0317,
            specificHeat: 4.18,
            bulkModulus: 2.2
        }
    }
};
`, context, { filename: 'fluid-test-prelude.js' });

scriptFiles.forEach(file => {
    const fullPath = path.join(projectRoot, file);
    vm.runInContext(fs.readFileSync(fullPath, 'utf8'), context, { filename: file });
});

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function assertClose(label, actual, expected, tolerance) {
    const delta = Math.abs(actual - expected);
    if (!Number.isFinite(actual) || delta > tolerance) {
        throw new Error(`${label}: expected ${expected}, got ${actual} (delta ${delta})`);
    }
}

function evaluateWaterTrace() {
    return vm.runInContext(`
(() => {
    globalModel.FLUID.props.inputMode = 'Basic';
    globalModel.FLUID.props.fluidName = 'Water';
    globalModel.FLUID.props.temp = 25;
    updateWaterProperties();
    return buildFluidCalculationTrace(globalModel.FLUID);
})()
`, context);
}

function evaluateCustomAdvancedTrace(overrides = {}) {
    return vm.runInContext(`
(() => {
    Object.assign(globalModel.FLUID.props, {
        inputMode: 'Advanced',
        fluidName: 'Custom',
        temp: 40,
        density: 900,
        sg: 0.9,
        dynViscosity: 18,
        viscosity: 20,
        vaporPressure: 0.12,
        specificHeat: 2.1,
        bulkModulus: 1.7
    }, ${JSON.stringify(overrides)});
    recalcExtendedFluidProps(globalModel.FLUID);
    return buildFluidCalculationTrace(globalModel.FLUID);
})()
`, context);
}

function evaluateCustomBasicTrace(overrides = {}) {
    return vm.runInContext(`
(() => {
    Object.assign(globalModel.FLUID.props, {
        inputMode: 'Basic',
        fluidName: 'Custom',
        temp: 25,
        density: 800,
        sg: 0.8,
        dynViscosity: 99,
        viscosity: 2,
        vaporPressure: 0.2,
        specificHeat: 2.1,
        bulkModulus: 1.6
    }, ${JSON.stringify(overrides)});
    recalcExtendedFluidProps(globalModel.FLUID);
    return buildFluidCalculationTrace(globalModel.FLUID);
})()
`, context);
}

const waterTrace = evaluateWaterTrace();
const waterDensity = waterTrace.propertySourceMap.find(item => item.property === 'Density').value;
const waterVaporPressure = waterTrace.propertySourceMap.find(item => item.property === 'Vapor pressure').value;
const waterVaporPressureHead = waterTrace.propertySourceMap.find(item => item.property === 'Vapor pressure head').value;
const waterSourceMapProperties = waterTrace.propertySourceMap.map(item => item.property);
const waterStepTitles = waterTrace.steps.map(step => step.title);
const waterSgStep = waterTrace.steps.find(step => step.title === 'Specific Gravity');
const waterSpecificVolumeStep = waterTrace.steps.find(step => step.title === 'Specific Volume');
const waterSpecificWeightStep = waterTrace.steps.find(step => step.title === 'Specific Weight');
const waterVaporHeadStep = waterTrace.steps.find(step => step.title === 'Vapor Pressure Head');

assert(waterTrace.status === 'OK', `Expected water trace OK, got ${waterTrace.status}`);
assert(waterTrace.inputBasis.propertyMethod.includes('IAPWS'), 'Expected water trace to include IAPWS method label');
assert(waterTrace.inputBasis.propertyMethod.includes('IAPWS-based'), 'Expected water trace to use professional IAPWS-based method wording');
assert(waterTrace.propertySourceMap.find(item => item.property === 'Density').source.includes('IAPWS'), 'Expected water density source classification');
[
    'Density',
    'Dynamic Viscosity',
    'Vapor Pressure',
    'Specific Heat',
    'Bulk Modulus',
    'Specific Gravity',
    'Kinematic Viscosity',
    'Specific Weight',
    'Specific Volume',
    'Vapor Pressure Head',
    'Speed of Sound'
].forEach(title => {
    assert(waterStepTitles.includes(title), `Expected Equation Steps to include ${title}`);
});
waterSourceMapProperties.forEach(property => {
    const stepTitle = property.replace('Dynamic viscosity', 'Dynamic Viscosity')
        .replace('Kinematic viscosity', 'Kinematic Viscosity')
        .replace('Vapor pressure head', 'Vapor Pressure Head')
        .replace('Vapor pressure', 'Vapor Pressure')
        .replace('Specific gravity', 'Specific Gravity')
        .replace('Specific volume', 'Specific Volume')
        .replace('Specific weight', 'Specific Weight')
        .replace('Specific heat', 'Specific Heat')
        .replace('Bulk modulus', 'Bulk Modulus')
        .replace('Speed of sound', 'Speed of Sound');
    assert(waterStepTitles.includes(stepTitle), `Expected source map property ${property} to have an equation/source step`);
});
assertClose('water SG trace', waterSgStep.result, waterDensity / 999.972, 0.00001);
assertClose('water specific volume trace', waterSpecificVolumeStep.result, 1 / waterDensity, 0.00000001);
assertClose('water specific weight trace', waterSpecificWeightStep.result, waterDensity * 9.81, 0.01);
assertClose('water vapor pressure head trace', waterVaporHeadStep.result, waterVaporPressure * 100000 / (waterDensity * 9.81), 0.01);
assertClose('water vapor pressure head source map matches equation', waterVaporHeadStep.result, waterVaporPressureHead, 0.0001);
assert(waterTrace.npshRelevance.some(item => item.includes('Vapor pressure')), 'Expected NPSH relevance notes');

const customTrace = evaluateCustomAdvancedTrace();
assert(customTrace.status === 'Needs Review', `Expected custom trace to need review, got ${customTrace.status}`);
assert(customTrace.propertySourceMap.find(item => item.property === 'Density').source === 'User input', 'Expected custom density to be user input');
assert(customTrace.steps.find(step => step.title === 'Kinematic Viscosity').substitution.includes('18.000000'), 'Expected custom viscosity substitution from dynamic viscosity');
assert(customTrace.warnings.some(item => item.includes('Custom Advanced')), 'Expected custom advanced validation note');

const customBasicTrace = evaluateCustomBasicTrace();
assertClose('custom basic dynamic viscosity from kinematic input', customBasicTrace.steps.find(step => step.title === 'Dynamic Viscosity').result, 1.6, 0.000001);
assertClose('custom basic kinematic viscosity remains input basis', customBasicTrace.steps.find(step => step.title === 'Kinematic Viscosity').result, 2, 0.000001);

const invalidTrace = evaluateCustomAdvancedTrace({ density: 0, viscosity: 0, vaporPressure: -1 });
assert(invalidTrace.status === 'Needs Review', 'Expected invalid trace to need review');
assert(invalidTrace.warnings.some(item => item.includes('Density must be greater than zero')), 'Expected density warning');
assert(invalidTrace.warnings.some(item => item.includes('Vapor pressure must be zero or positive')), 'Expected vapor pressure warning');

const taskWindowSource = fs.readFileSync(path.join(projectRoot, 'ui/task-window.js'), 'utf8');
const toolbarSource = fs.readFileSync(path.join(projectRoot, 'toolbar/menu-bar.js'), 'utf8');
const appSource = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
assert(taskWindowSource.includes('Reference / Audit Basis'), 'Property Source Map should use academic audit-basis heading');
assert(taskWindowSource.includes('fluid-source-map-table'), 'Property Source Map should use compact source-map table styling');
assert(taskWindowSource.includes('function closeFluidBasisTaskWindow()'), 'Fluid Basis should have a dedicated close helper');
assert(taskWindowSource.includes("taskWindow?.dataset.kind === 'fluid'"), 'Fluid Basis close helper should only close the Fluid Basis task window');
assert(taskWindowSource.includes('closeFluidBasisTaskWindow();'), 'Applying Fluid Basis should close the Fluid Basis task window');
assert(!taskWindowSource.includes('Reconfirm Basis'), 'Fluid Basis apply action should use one consistent apply/start label');
assert(toolbarSource.includes('function openFluidBasis()'), 'Toolbar should keep the explicit Fluid Basis opener');
assert(appSource.includes("btnFluidBasis.addEventListener('click', () => openFluidBasis())"), 'Fluid Basis ribbon button should reopen the Fluid Basis task window');

console.log(JSON.stringify({
    passed: true,
    water: {
        status: waterTrace.status,
        method: waterTrace.inputBasis.propertyMethod,
        vaporPressureHead: waterVaporHeadStep.result
    },
    custom: {
        status: customTrace.status,
        densitySource: customTrace.propertySourceMap.find(item => item.property === 'Density').source
    },
    invalidWarnings: invalidTrace.warnings.length
}, null, 2));
