const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const scriptFiles = [
    'formulas/constants.js',
    'properties/objects/tank-properties.js',
    'formulas/objects/tank-formulas.js'
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

function evaluateTank(props = {}, fluidProps = {}) {
    return vm.runInContext(`
(() => {
    const props = ${JSON.stringify(props)};
    const fluidProps = ${JSON.stringify(fluidProps)};
    return evaluateTankPressureSafety(props, fluidProps);
})()
`, context);
}

function normalizeProps(props = {}) {
    return vm.runInContext(`
(() => {
    const props = ${JSON.stringify(props)};
    normalizeTankProps(props);
    return props;
})()
`, context);
}

function applyCodePreset(props = {}, codeBasis) {
    return vm.runInContext(`
(() => {
    const props = ${JSON.stringify(props)};
    applyTankCodeBasisReferencePreset(props, ${JSON.stringify(codeBasis)});
    return props;
})()
`, context);
}

function defaultTankProps(overrides = {}) {
    return vm.runInContext(`
(() => {
    const props = {};
    Object.keys(TANK_SCHEMA).forEach(key => {
        props[key] = TANK_SCHEMA[key].default;
    });
    Object.assign(props, ${JSON.stringify(overrides)});
    normalizeTankProps(props);
    return props;
})()
`, context);
}

function warningIncludes(result, text) {
    return result.warnings.some(item => item.includes(text));
}

const defaultProps = defaultTankProps();
assertClose('default liquid volume', defaultProps.liquidVolume, 58.905, 0.001);
assertClose('default total capacity', defaultProps.totalCapacity, 117.81, 0.001);
assertClose('default fill percent', defaultProps.fillPercent, 50, 0.001);

const validTank = evaluateTank(defaultTankProps({
    tankDesignPressure: 50,
    designVacuum: 10,
    pressureVentSet: 25,
    vacuumVentSet: 5,
    emergencyVentProvided: 'Provided'
}), { vaporPressure: 0.0317 });
assert(validTank.status === 'OK', `Expected valid tank to be OK, got ${validTank.warnings.join(' | ')}`);

const badLevelOrder = evaluateTank(defaultTankProps({ hll: 2, nll: 3, lll: 1 }));
assert(warningIncludes(badLevelOrder, 'HLL > NLL > LLL'), 'Expected HLL/NLL/LLL ordering warning');

const aboveHll = evaluateTank(defaultTankProps({ liquidLevel: 5.5, hll: 5 }));
assert(warningIncludes(aboveHll, 'above HLL'), 'Expected current level above HLL warning');

const aboveHeight = evaluateTank(defaultTankProps({ liquidLevel: 7, tankHeight: 6, hll: 5 }));
assert(warningIncludes(aboveHeight, 'above tank height'), 'Expected current level above tank height warning');

const pressureVentHigh = evaluateTank(defaultTankProps({
    tankDesignPressure: 50,
    pressureVentSet: 60,
    designVacuum: 10,
    vacuumVentSet: 5,
    emergencyVentProvided: 'Provided'
}));
assert(warningIncludes(pressureVentHigh, 'above tank design pressure'), 'Expected pressure vent over design pressure warning');

const vacuumVentHigh = evaluateTank(defaultTankProps({
    tankDesignPressure: 50,
    pressureVentSet: 25,
    designVacuum: 10,
    vacuumVentSet: 15,
    emergencyVentProvided: 'Provided'
}));
assert(warningIncludes(vacuumVentHigh, 'above design vacuum'), 'Expected vacuum vent over design vacuum warning');

const operatingVacuumHigh = evaluateTank(defaultTankProps({
    pressure: -0.02,
    tankDesignPressure: 50,
    pressureVentSet: 25,
    designVacuum: 10,
    vacuumVentSet: 5,
    emergencyVentProvided: 'Provided'
}));
assert(warningIncludes(operatingVacuumHigh, 'normal operating vacuum'), 'Expected vacuum vent versus operating vacuum warning');
assert(warningIncludes(operatingVacuumHigh, 'Operating vapor space vacuum is above design vacuum'), 'Expected operating vacuum over design vacuum warning');

const outletAboveLiquid = evaluateTank(defaultTankProps({
    liquidLevel: 0.5,
    lll: 0.2,
    outletNozzleElevation: 7,
    tankDesignPressure: 50,
    pressureVentSet: 25,
    designVacuum: 10,
    vacuumVentSet: 5,
    emergencyVentProvided: 'Provided'
}));
assert(warningIncludes(outletAboveLiquid, 'Outlet nozzle elevation is above current liquid level'), 'Expected outlet nozzle above liquid level warning');

const migrated = normalizeProps({
    pressureInputBasis: 'Gauge',
    pressure: 0,
    diameter: 5,
    liquidLevel: 3,
    tankHeight: 6,
    hll: 5,
    nll: 3,
    lll: 1.5,
    designPressure: 0.15,
    psvSet: 0.05
});
assertClose('legacy designPressure migration', migrated.tankDesignPressure, 150, 0.001);
assertClose('legacy psvSet migration', migrated.pressureVentSet, 50, 0.001);
assert(migrated._legacyTankPressureFieldMigrated === true, 'Expected legacy pressure field migration flag');

const api650Preset = applyCodePreset({ elevation: 6 }, 'API 650 Atmospheric Tank');
assertClose('API 650 preset diameter', api650Preset.diameter, 5, 0.001);
assertClose('API 650 preset tank height', api650Preset.tankHeight, 6, 0.001);
assertClose('API 650 preset inlet nozzle datum elevation', api650Preset.inletNozzleElevation, 9, 0.001);
assertClose('API 650 preset outlet nozzle datum elevation', api650Preset.outletNozzleElevation, 7, 0.001);
assertClose('API 650 preset design pressure', api650Preset.tankDesignPressure, 25, 0.001);
assertClose('API 650 preset pressure vent', api650Preset.pressureVentSet, 20, 0.001);
assertClose('API 650 preset design vacuum', api650Preset.designVacuum, 5, 0.001);
assertClose('API 650 preset vacuum vent', api650Preset.vacuumVentSet, 3, 0.001);
assert(api650Preset.emergencyVentProvided === 'Provided', 'Expected API 650 preset emergency vent to be Provided');

const api620Preset = applyCodePreset({ elevation: 6 }, 'API 620 Low-pressure Storage Tank');
assertClose('API 620 preset operating pressure', api620Preset.pressure, 0.05, 0.001);
assertClose('API 620 preset design pressure', api620Preset.tankDesignPressure, 500, 0.001);
assertClose('API 620 preset pressure vent', api620Preset.pressureVentSet, 450, 0.001);
assertClose('API 620 preset design vacuum', api620Preset.designVacuum, 25, 0.001);
assertClose('API 620 preset vacuum vent', api620Preset.vacuumVentSet, 20, 0.001);

const api620Evaluation = evaluateTank(api620Preset);
assert(api620Evaluation.status === 'OK', `Expected API 620 preset to evaluate OK, got ${api620Evaluation.warnings.join(' | ')}`);

console.log(JSON.stringify({
    passed: true,
    defaultLiquidVolume: defaultProps.liquidVolume,
    defaultTotalCapacity: defaultProps.totalCapacity,
    defaultFillPercent: defaultProps.fillPercent,
    validStatus: validTank.status,
    migration: {
        tankDesignPressure: migrated.tankDesignPressure,
        pressureVentSet: migrated.pressureVentSet
    },
    operatingVacuumWarnings: operatingVacuumHigh.warnings,
    outletAboveLiquidWarnings: outletAboveLiquid.warnings,
    presets: {
        api650DesignPressure: api650Preset.tankDesignPressure,
        api620DesignPressure: api620Preset.tankDesignPressure
    }
}, null, 2));
