const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const scriptFiles = [
    'formulas/constants.js',
    'properties/objects/pump-properties.js',
    'properties/objects/pipe-properties.js',
    'properties/objects/valve-properties.js',
    'formulas/objects/pipe-formulas.js',
    'formulas/objects/valve-formulas.js',
    'formulas/objects/hydraulic-network-formulas.js',
    'formulas/objects/pump-formulas.js'
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
const ATM_PRESSURE_BAR = 1.01325;

vm.runInContext(`
var globalModel = {};
var connections = [];
var sourceLinks = [];
`, context, { filename: 'test-prelude.js' });

scriptFiles.forEach(file => {
    const fullPath = path.join(projectRoot, file);
    vm.runInContext(fs.readFileSync(fullPath, 'utf8'), context, { filename: file });
});

function assertClose(label, actual, expected, tolerance) {
    const delta = Math.abs(actual - expected);
    if (!Number.isFinite(actual) || delta > tolerance) {
        throw new Error(`${label}: expected ${expected.toFixed(6)}, got ${actual} (delta ${delta})`);
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function manualFrictionFactor(reynolds, roughnessM, diameterM) {
    if (!Number.isFinite(reynolds) || reynolds <= 0 || diameterM <= 0) return 0;
    if (reynolds < 2000) return 64 / reynolds;

    const relRoughness = Math.max(roughnessM, 0) / diameterM;
    let turbulent = 0.25 / Math.pow(Math.log10((relRoughness / 3.7) + (5.74 / Math.pow(Math.max(reynolds, 4000), 0.9))), 2);
    for (let i = 0; i < 20; i += 1) {
        const next = 1 / Math.pow(-2 * Math.log10((relRoughness / 3.7) + (2.51 / (Math.max(reynolds, 4000) * Math.sqrt(turbulent)))), 2);
        if (Math.abs(next - turbulent) < 1e-7) {
            turbulent = next;
            break;
        }
        turbulent = next;
    }

    if (reynolds >= 4000) return turbulent;
    const laminar = 64 / reynolds;
    const blend = (reynolds - 2000) / 2000;
    return laminar + (turbulent - laminar) * blend;
}

function manualSuctionCase({ sourcePressure, sourceBasis, sourceElevation, pumpElevation, flowM3H, diameterM, lengthM, roughnessM, viscosityCSt, density, vaporPressureBarA, valveK, valveOpening }) {
    const g = 9.81;
    const qM3S = flowM3H / 3600;
    const area = Math.PI * Math.pow(diameterM, 2) / 4;
    const velocity = qM3S / area;
    const reynolds = velocity * diameterM / (viscosityCSt * 1e-6);
    const frictionFactor = manualFrictionFactor(reynolds, roughnessM, diameterM);
    const velocityHead = Math.pow(velocity, 2) / (2 * g);
    const pipeLoss = frictionFactor * (lengthM / diameterM) * velocityHead;
    const openingFraction = Math.max(0, Math.min(1, valveOpening / 100));
    const effectiveValveK = valveK / Math.pow(openingFraction, 2);
    const valveLoss = effectiveValveK * velocityHead;
    const sourceAbsBar = sourceBasis === 'Gauge' ? sourcePressure + ATM_PRESSURE_BAR : sourcePressure;
    const sourcePressureHead = sourceAbsBar * 100000 / (density * g);
    const vaporPressureHead = vaporPressureBarA * 100000 / (density * g);
    const npsha = sourcePressureHead + sourceElevation - valveLoss - pipeLoss - pumpElevation - vaporPressureHead;

    return {
        velocity,
        reynolds,
        frictionFactor,
        velocityHead,
        sourcePressureHead,
        pipeLoss,
        valveLoss,
        totalSuctionLoss: pipeLoss + valveLoss,
        vaporPressureHead,
        npsha
    };
}

function evaluateAppCase(options) {
    return vm.runInContext(`
(() => {
    const options = ${JSON.stringify(options)};
    const pipeProps = {
        routeStyle: 'Straight',
        segments: [{
            name: 'Suction segment',
            pipeSize: 'Custom diameter',
            material: 'Commercial steel',
            diameter: options.diameterM,
            length: options.lengthM,
            roughness: options.roughnessM,
            fittingType: 'None',
            fittingQuantity: 0,
            fittingK: 0,
            minorLoss: 0
        }]
    };
    const dischargePipeProps = {
        routeStyle: 'Straight',
        segments: [{
            name: 'Discharge segment',
            pipeSize: 'Custom diameter',
            material: 'Commercial steel',
            diameter: options.diameterM,
            length: 1,
            roughness: options.roughnessM,
            fittingType: 'None',
            fittingQuantity: 0,
            fittingK: 0,
            minorLoss: 0
        }]
    };

    Object.keys(globalModel).forEach(key => delete globalModel[key]);
    Object.assign(globalModel, {
        FLUID: {
            type: 'fluid',
            name: 'Fluid Basis',
            props: {
                density: options.density,
                viscosity: options.viscosityCSt,
                vaporPressure: options.vaporPressureBarA,
                sg: options.density / 1000
            }
        },
        'SRC-100': {
            type: 'source',
            name: 'SRC-100',
            props: {
                sourceType: 'Standalone Boundary Source',
                boundaryDataSource: 'Manual',
                flowInputMode: 'Volumetric Flow',
                pressureInputBasis: options.sourceBasis,
                pressure: options.sourcePressure,
                elevation: options.sourceElevation,
                flow: options.flowM3H
            }
        },
        'V-100': {
            type: 'valve',
            name: 'V-100',
            props: {
                lossModel: 'K coefficient',
                valveType: 'Globe Valve',
                kValue: options.valveK,
                diameter: options.diameterM,
                opening: options.valveOpening,
                flowCharacteristic: 'Linear'
            }
        },
        'PIPE-1': {
            type: 'pipe',
            name: 'PIPE-1',
            props: pipeProps
        },
        'PIPE-1B': {
            type: 'pipe',
            name: 'PIPE-1B',
            props: {
                ...pipeProps,
                segments: [{
                    ...pipeProps.segments[0],
                    name: 'Valve-to-pump connector',
                    length: 0,
                    fittingQuantity: 0,
                    fittingK: 0,
                    minorLoss: 0
                }]
            }
        },
        'P-100': {
            type: 'pump',
            name: 'P-100',
            props: {
                inputMode: options.inputMode || 'Basic',
                npshrSourceMode: options.npshrSourceMode || 'Estimated',
                elevation: options.pumpElevation,
                designFlow: options.designFlowM3H || options.flowM3H,
                bepFlow: options.bepFlowM3H || options.flowM3H,
                designHead: 25,
                designEfficiency: 75,
                designNpshr: options.designNpshr,
                porMinPercent: 70,
                porMaxPercent: 120,
                aorMinPercent: 50,
                aorMaxPercent: 130,
                minNpshMarginRatio: 1.1,
                minNpshMargin: 0.5,
                curveData: options.curveData || []
            },
            results: { flow: options.flowM3H }
        },
        'PIPE-2': {
            type: 'pipe',
            name: 'PIPE-2',
            props: dischargePipeProps
        },
        'SNK-100': {
            type: 'sink',
            name: 'SNK-100',
            props: {
                active: 'Active',
                boundaryMode: 'Outlet Pressure',
                pressureInputBasis: 'Gauge',
                pressure: 0,
                pressureBasis: 'Static',
                elevation: 0
            }
        }
    });

    connections.splice(0, connections.length);
    if (options.attachSource !== false) {
        connections.push(
            { from: 'SRC-100', fromPort: '.port.outlet', to: 'V-100', toPort: '.port.inlet', pipeId: 'PIPE-1' },
            { from: 'V-100', fromPort: '.port.outlet', to: 'P-100', toPort: '.port.inlet', pipeId: 'PIPE-1B' }
        );
    } else {
        connections.push({ from: 'V-100', fromPort: '.port.outlet', to: 'P-100', toPort: '.port.inlet', pipeId: 'PIPE-1' });
    }
    connections.push({ from: 'P-100', fromPort: '.port.outlet', to: 'SNK-100', toPort: '.port.inlet', pipeId: 'PIPE-2' });
    sourceLinks.splice(0, sourceLinks.length);

    return runPumpNpshEvaluation('P-100');
})()
`, context);
}

const baseCase = {
    sourcePressure: 0,
    sourceBasis: 'Gauge',
    sourceElevation: 2,
    pumpElevation: 0,
    flowM3H: 20,
    diameterM: 0.1,
    lengthM: 20,
    roughnessM: 0.000045,
    viscosityCSt: 0.893,
    density: 997,
    vaporPressureBarA: 0.0317,
    valveK: 10,
    valveOpening: 100,
    designNpshr: 3
};

const manualOpen = manualSuctionCase(baseCase);
const appOpen = evaluateAppCase(baseCase);
assert(appOpen.status === 'Safe', `Expected open-valve case to be Safe, got ${appOpen.status}`);
assertClose('open-valve NPSHa', appOpen.npsha, manualOpen.npsha, 0.01);
assertClose('open-valve suction loss', appOpen.suctionLoss, manualOpen.totalSuctionLoss, 0.01);
assert(appOpen.dominantLoss.includes('V-100'), 'Expected suction valve to be dominant loss in open-valve case');
assert(appOpen.npshrSource === 'Estimated basic curve', `Expected estimated NPSHr source, got ${appOpen.npshrSource}`);
assert(appOpen.calculationTrace, 'Expected open-valve result to include a calculation trace');
assert(appOpen.calculationTrace.path.text.includes('SRC-100'), 'Expected calculation trace suction path to include source boundary');
assertClose('trace source pressure head', appOpen.calculationTrace.boundary.pressureHead, manualOpen.sourcePressureHead, 0.01);
assertClose('trace vapor pressure head', appOpen.calculationTrace.steps.find(step => step.title === 'Vapor Pressure Head').result, manualOpen.vaporPressureHead, 0.01);
assertClose('trace NPSHa result', appOpen.calculationTrace.steps.find(step => step.title === 'NPSHa').result, appOpen.npsha, 0.01);
assert(appOpen.calculationTrace.references.includes('Darcy-Weisbach pipe friction'), 'Expected trace to include formula references');

const throttledCase = { ...baseCase, valveOpening: 15 };
const manualThrottled = manualSuctionCase(throttledCase);
const appThrottled = evaluateAppCase(throttledCase);
assert(appThrottled.status === 'Cavitation Risk', `Expected throttled-valve case to be Cavitation Risk, got ${appThrottled.status}`);
assertClose('throttled-valve NPSHa', appThrottled.npsha, manualThrottled.npsha, 0.01);
assertClose('throttled-valve suction loss', appThrottled.suctionLoss, manualThrottled.totalSuctionLoss, 0.01);
assert(appThrottled.npsha < appOpen.npsha, 'Expected throttling suction valve to reduce NPSHa');

const absoluteCase = { ...baseCase, sourceBasis: 'Absolute', sourcePressure: ATM_PRESSURE_BAR };
const appAbsolute = evaluateAppCase(absoluteCase);
assertClose('gauge 0 bar vs absolute 1.01325 bar NPSHa', appAbsolute.npsha, appOpen.npsha, 0.01);

const highVaporCase = { ...baseCase, vaporPressureBarA: 0.5 };
const manualHighVapor = manualSuctionCase(highVaporCase);
const appHighVapor = evaluateAppCase(highVaporCase);
assertClose('high-vapor-pressure NPSHa', appHighVapor.npsha, manualHighVapor.npsha, 0.01);
assert(appHighVapor.npsha < appOpen.npsha, 'Expected higher vapor pressure to reduce NPSHa');

const incompleteCase = evaluateAppCase({ ...baseCase, attachSource: false });
assert(incompleteCase.status === 'Incomplete', `Expected missing SRC attachment to be Incomplete, got ${incompleteCase.status}`);

const manualNpshrCase = {
    ...baseCase,
    npshrSourceMode: 'Manual',
    bepFlowM3H: 40,
    designNpshr: 3
};
const appManualNpshr = evaluateAppCase(manualNpshrCase);
assertClose('manual NPSHr stays constant', appManualNpshr.npshr, 3, 0.001);
assert(appManualNpshr.npshrSource === 'Manual input', `Expected manual NPSHr source, got ${appManualNpshr.npshrSource}`);

const estimatedOffBepCase = {
    ...baseCase,
    npshrSourceMode: 'Estimated',
    bepFlowM3H: 40,
    designNpshr: 3
};
const appEstimatedOffBep = evaluateAppCase(estimatedOffBepCase);
assert(appEstimatedOffBep.npshr < appManualNpshr.npshr, 'Expected estimated NPSHr to follow the generic curve away from BEP');
assert(appEstimatedOffBep.npshrSource === 'Estimated basic curve', `Expected estimated source, got ${appEstimatedOffBep.npshrSource}`);

const advancedCurveCase = {
    ...baseCase,
    inputMode: 'Advanced',
    curveData: [
        { flow: 0, head: 30, eff: 0, npshr: 1 },
        { flow: 20, head: 25, eff: 75, npshr: 4 },
        { flow: 40, head: 15, eff: 60, npshr: 6 }
    ]
};
const appAdvancedCurve = evaluateAppCase(advancedCurveCase);
assertClose('advanced curve NPSHr interpolation', appAdvancedCurve.npshr, 4, 0.001);
assert(appAdvancedCurve.npshrSource === 'Manufacturer/test curve', `Expected curve NPSHr source, got ${appAdvancedCurve.npshrSource}`);

const summary = {
    passed: true,
    cases: {
        openValve: {
            npsha: appOpen.npsha,
            suctionLoss: appOpen.suctionLoss,
            status: appOpen.status
        },
        throttledValve: {
            npsha: appThrottled.npsha,
            suctionLoss: appThrottled.suctionLoss,
            status: appThrottled.status
        },
        absolutePressureBasis: {
            npsha: appAbsolute.npsha,
            status: appAbsolute.status
        },
        highVaporPressure: {
            npsha: appHighVapor.npsha,
            status: appHighVapor.status
        },
        missingSource: {
            status: incompleteCase.status,
            warnings: incompleteCase.warnings
        },
        manualNpshr: {
            npshr: appManualNpshr.npshr,
            npshrSource: appManualNpshr.npshrSource,
            status: appManualNpshr.status
        },
        estimatedOffBep: {
            npshr: appEstimatedOffBep.npshr,
            npshrSource: appEstimatedOffBep.npshrSource,
            status: appEstimatedOffBep.status
        },
        advancedCurve: {
            npshr: appAdvancedCurve.npshr,
            npshrSource: appAdvancedCurve.npshrSource,
            status: appAdvancedCurve.status
        }
    }
};

console.log(JSON.stringify(summary, null, 2));
