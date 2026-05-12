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

function buildDefaultTrace(overrides = {}, results = {}, fluidProps = { vaporPressure: 0.0317 }) {
    return vm.runInContext(`
(() => {
    const props = {};
    Object.keys(TANK_SCHEMA).forEach(key => {
        props[key] = TANK_SCHEMA[key].default;
    });
    Object.assign(props, ${JSON.stringify(overrides)});
    normalizeTankProps(props);
    const tank = {
        type: 'tank',
        name: 'TK-100',
        props,
        results: ${JSON.stringify(results)}
    };
    return buildTankCalculationTrace(tank, ${JSON.stringify(fluidProps)}, tank.results);
})()
`, context);
}

function findStep(trace, title) {
    return trace.steps.find(step => step.title === title);
}

const trace = buildDefaultTrace(
    {
        elevation: 6,
        diameter: 5,
        tankHeight: 6,
        liquidLevel: 3,
        outletNozzleElevation: 7,
        emergencyVentProvided: 'Provided'
    },
    {
        connectedPipes: ['PIPE-1'],
        connectedSources: ['SRC-100', 'SRC-103'],
        sourceFeedFlows: [
            { sourceId: 'SRC-100', sourceType: 'Open Tank / Reservoir', flow: 104.81 },
            { sourceId: 'SRC-103', sourceType: 'Open Tank / Reservoir', flow: 20.19 }
        ],
        sourceFeedFlow: 125,
        inletFlow: 150,
        outletFlow: 40,
        netFlow: 110,
        levelTrend: 'Rising',
        status: 'Advisory',
        warnings: ['Tank inventory advisory: Net Flow = +110.000 m3/h; level will rise.']
    }
);

assert(trace.inputBasis.modelBasis.includes('not an ASME pressure vessel'), 'Expected storage tank, not pressure vessel model note');
assertClose('trace area', trace.geometry.crossSectionArea, 19.635, 0.001);
assertClose('trace total capacity', trace.inventory.totalCapacity, 117.81, 0.001);
assertClose('trace liquid volume', trace.inventory.liquidVolume, 58.905, 0.001);
assertClose('trace fill percent', trace.inventory.fillPercent, 50, 0.001);
assertClose('trace liquid surface elevation', trace.geometry.liquidSurfaceElevation, 9, 0.001);
assertClose('trace outlet submergence', trace.geometry.outletSubmergence, 2, 0.001);
assertClose('trace source feed flow', trace.flowBalance.sourceFeedFlow, 125, 0.001);
assertClose('trace pipe inlet flow', trace.flowBalance.pipeInletFlow, 25, 0.001);
assertClose('trace net flow', trace.flowBalance.netFlow, 110, 0.001);
assertClose('trace absolute pressure', trace.pressureVenting.operatingPressureAbsolute, 1.01325, 0.001);
assert(findStep(trace, 'Total SRC Feed Flow').substitution.includes('SRC-100'), 'Expected source feed step to list SRC rows');
assert(findStep(trace, 'Tank Net Flow').formula === 'Qnet = Qin - Qout', 'Expected net flow equation step');
assert(trace.references.some(item => item.includes('API 2000')), 'Expected API 2000 reference note');

const vacuumTrace = buildDefaultTrace({
    pressure: -0.02,
    designVacuum: 10,
    vacuumVentSet: 5,
    tankDesignPressure: 50,
    pressureVentSet: 25,
    emergencyVentProvided: 'Provided'
});
assertClose('trace operating vacuum', vacuumTrace.pressureVenting.operatingVacuumMbar, 20, 0.001);
assert(vacuumTrace.warnings.some(item => item.includes('normal operating vacuum')), 'Expected vacuum vent warning in trace');
assert(vacuumTrace.warnings.some(item => item.includes('above design vacuum')), 'Expected design vacuum warning in trace');

const outletTrace = buildDefaultTrace({
    elevation: 6,
    liquidLevel: 0.5,
    lll: 0.2,
    outletNozzleElevation: 7,
    tankDesignPressure: 50,
    pressureVentSet: 25,
    designVacuum: 10,
    vacuumVentSet: 5,
    emergencyVentProvided: 'Provided'
});
assertClose('trace negative outlet submergence', outletTrace.geometry.outletSubmergence, -0.5, 0.001);
assert(outletTrace.warnings.some(item => item.includes('Outlet nozzle elevation is above current liquid level')), 'Expected outlet nozzle warning in trace');

console.log(JSON.stringify({
    passed: true,
    area: trace.geometry.crossSectionArea,
    liquidVolume: trace.inventory.liquidVolume,
    sourceFeedFlow: trace.flowBalance.sourceFeedFlow,
    netFlow: trace.flowBalance.netFlow,
    operatingVacuum: vacuumTrace.pressureVenting.operatingVacuumMbar,
    outletSubmergence: outletTrace.geometry.outletSubmergence
}, null, 2));
