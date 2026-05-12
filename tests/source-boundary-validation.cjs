const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const scriptFiles = [
    'formulas/constants.js',
    'properties/objects/pipe-properties.js',
    'properties/objects/pump-properties.js',
    'formulas/objects/pipe-formulas.js',
    'formulas/objects/pump-formulas.js',
    'formulas/objects/hydraulic-network-formulas.js',
    'core/simulation-engine.js'
];

const context = { console, Math, Number, parseFloat, JSON };
context.window = context;
vm.createContext(context);

vm.runInContext(`
var connections = [];
var sourceLinks = [];
var currentSelectedNode = null;
var activeChartPumpId = null;
var pumpChartInstance = null;
function setSidebarReadout() {}
function updatePumpChart() {}
function renderSidebar() {}
function updateAllObjectOperatingStatusVisuals() {}
function ensureNodeResults(node) {
    if (!node.results) node.results = {};
}
var globalModel = {};
`, context, { filename: 'source-boundary-prelude.js' });

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

function evaluateNetwork(options = {}) {
    return vm.runInContext(`
(() => {
    const options = ${JSON.stringify(options)};
    const flow = options.flow ?? 20;
    const density = options.density ?? 997;
    const vaporPressure = options.vaporPressure ?? 0.031698;
    const pipeLength = options.pipeLength ?? 10;
    const diameter = options.diameter ?? 0.1;
    const sourceType = options.sourceType || 'Standalone Boundary Source';
    const pressureEnergyBasis = options.pressureEnergyBasis || 'Static Pressure';
    const sourceElevation = options.sourceElevation ?? 0;
    const pumpElevation = options.pumpElevation ?? 0;
    const pumpSuctionElevation = options.pumpSuctionElevation ?? pumpElevation;
    const tankBaseElevation = options.tankBaseElevation ?? 0;
    const tankLiquidLevel = options.tankLiquidLevel ?? 0;
    const tankPressure = options.tankPressure ?? 0;
    const sourcePressure = options.sourcePressure ?? 0;
    const sourceBoundaryDataSource = options.sourceBoundaryDataSource || 'Manual';

    Object.keys(globalModel).forEach(key => delete globalModel[key]);
    Object.assign(globalModel, {
        FLUID: {
            type: 'fluid',
            name: 'Fluid Basis',
            props: {
                fluidName: 'Water',
                temp: 25,
                density,
                viscosity: options.viscosity ?? 0.893,
                vaporPressure,
                sg: density / 999.972
            }
        },
        'SRC-100': {
            type: 'source',
            name: 'SRC-100',
            props: {
                sourceType,
                boundaryDataSource: sourceBoundaryDataSource,
                pressureInputBasis: options.sourcePressureBasis || 'Gauge',
                pressure: sourcePressure,
                pressureEnergyBasis,
                elevation: sourceElevation,
                temperatureMode: 'Use Fluid Basis',
                flowInputMode: 'Mass Flow',
                flow,
                massFlow: flow * density
            }
        },
        'TK-101': {
            type: 'tank',
            name: 'TK-101',
            props: {
                pressureInputBasis: options.tankPressureBasis || 'Gauge',
                pressure: tankPressure,
                elevation: tankBaseElevation,
                liquidLevel: tankLiquidLevel,
                inletNozzleElevation: tankBaseElevation,
                outletNozzleElevation: options.tankOutletElevation ?? tankBaseElevation
            }
        },
        'PIPE-1': {
            type: 'pipe',
            name: 'PIPE-1',
            props: {
                routeStyle: 'Straight',
                elevationProfileMode: options.highPointElevation === undefined ? 'End Elevations' : 'High Point Check',
                highPointElevation: options.highPointElevation ?? '',
                segments: [{
                    name: 'Segment 1',
                    pipeSize: 'Custom diameter',
                    material: 'Commercial steel',
                    diameter,
                    length: pipeLength,
                    roughness: 0.000045,
                    fittingType: 'None',
                    fittingQuantity: 0,
                    fittingK: 0,
                    minorLoss: 0
                }]
            }
        },
        'PIPE-2': {
            type: 'pipe',
            name: 'PIPE-2',
            props: {
                routeStyle: 'Straight',
                segments: [{
                    name: 'Segment 1',
                    pipeSize: 'Custom diameter',
                    material: 'Commercial steel',
                    diameter: 0.1,
                    length: 1,
                    roughness: 0.000045,
                    fittingType: 'None',
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
                inputMode: 'Basic',
                npshrSourceMode: 'Estimated',
                elevation: pumpElevation,
                suctionElevation: pumpSuctionElevation,
                dischargeElevation: pumpElevation,
                designFlow: flow,
                bepFlow: flow,
                designHead: 30,
                designEfficiency: 75,
                designNpshr: 2,
                porMinPercent: 70,
                porMaxPercent: 120,
                aorMinPercent: 50,
                aorMaxPercent: 130,
                minNpshMarginRatio: 1.1,
                minNpshMargin: 0.5,
                curveData: []
            },
            results: { flow }
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
    if (options.suctionConnection === 'tank') {
        connections.push({ from: 'TK-101', fromPort: '.port.outlet', to: 'P-100', toPort: '.port.inlet', pipeId: 'PIPE-1', connectionType: 'hydraulic' });
    } else if (options.suctionConnection === 'source') {
        connections.push({ from: 'SRC-100', fromPort: '.port.outlet', to: 'P-100', toPort: '.port.inlet', pipeId: 'PIPE-1', connectionType: 'hydraulic' });
    }
    connections.push({ from: 'P-100', fromPort: '.port.outlet', to: 'SNK-100', toPort: '.port.inlet', pipeId: 'PIPE-2', connectionType: 'hydraulic' });

    sourceLinks.splice(0, sourceLinks.length);
    if (options.attachSourceToTank) {
        sourceLinks.push({
            sourceId: 'SRC-100',
            targetId: 'TK-101',
            targetPort: '.port.inlet',
            connectionType: 'semantic',
            attachmentType: 'source-boundary',
            visualStyle: 'dashed'
        });
    }
    if (options.attachSourceToPump) {
        sourceLinks.push({
            sourceId: 'SRC-100',
            targetId: 'P-100',
            targetPort: '.port.inlet',
            connectionType: 'semantic',
            attachmentType: 'source-boundary',
            visualStyle: 'dashed'
        });
    }
    if (options.attachSecondSourceToTank) {
        globalModel['SRC-103'] = {
            type: 'source',
            name: 'SRC-103',
            props: {
                sourceType: options.secondSourceType || 'Open Tank / Reservoir',
                boundaryDataSource: options.secondSourceBoundaryDataSource || 'Inherit from Attached Equipment',
                pressureInputBasis: 'Gauge',
                pressure: options.secondSourcePressure ?? 0,
                elevation: options.secondSourceElevation ?? 0,
                temperatureMode: 'Use Fluid Basis',
                flowInputMode: 'Mass Flow',
                flow: options.secondSourceFlow ?? 5,
                massFlow: (options.secondSourceFlow ?? 5) * density
            }
        };
        sourceLinks.push({
            sourceId: 'SRC-103',
            targetId: 'TK-101',
            targetPort: '.port.inlet',
            connectionType: 'semantic',
            attachmentType: 'source-boundary',
            visualStyle: 'dashed'
        });
    }

    const context = createPumpHydraulicContext('P-100', globalModel, connections, density, vaporPressure * 100000);
    const result = runPumpNpshEvaluation('P-100');
    const snapshot = context.isComplete ? calculatePumpHydraulicSnapshot(context, flow, 30) : null;
    if (snapshot && options.applyPathResults) {
        applyHydraulicPathResults(context, snapshot, flow);
    }
    return { context, result, snapshot, pipe: globalModel['PIPE-1'], sourceBoundary: resolveSourceBoundaryData('SRC-100', globalModel) };
})()
`, context);
}

const missingPath = evaluateNetwork({
    attachSourceToTank: true,
    suctionConnection: null,
    sourceType: 'Open Tank / Reservoir',
    sourceBoundaryDataSource: 'Inherit from Attached Equipment'
});
assert(!missingPath.context.suctionPath.boundaryId, 'Dashed SRC attachment alone must not create a suction boundary');
assert(missingPath.context.networkWarnings.some(item => item.includes('no hydraulic path exists')), 'Expected missing hydraulic path warning for semantic SRC attachment');

const invalidPumpAttachment = evaluateNetwork({
    attachSourceToPump: true,
    suctionConnection: null,
    sourceType: 'Open Tank / Reservoir',
    sourceBoundaryDataSource: 'Inherit from Attached Equipment'
});
assert(!invalidPumpAttachment.context.suctionPath.boundaryId, 'Dashed SRC attachment to pump must not create a suction boundary');
assert(
    invalidPumpAttachment.context.networkWarnings.some(item => item.includes('only valid for tank/vessel boundary inheritance')),
    'Expected invalid dashed SRC-to-pump warning'
);

const attachedTank = evaluateNetwork({
    attachSourceToTank: true,
    suctionConnection: 'tank',
    sourceType: 'Open Tank / Reservoir',
    sourceBoundaryDataSource: 'Inherit from Attached Equipment',
    tankBaseElevation: 2,
    tankLiquidLevel: 5,
    tankPressure: 0.4,
    pumpSuctionElevation: 1,
    pipeLength: 0
});
assert(attachedTank.context.suctionPath.boundaryId === 'TK-101', 'Expected tank to be the pump suction boundary');
assertClose('tank boundary elevation', attachedTank.result.calculationTrace.boundary.elevation, 7, 0.001);
assertClose('tank boundary pressure', attachedTank.result.calculationTrace.boundary.absolutePressureBar, 1.413, 0.001);
assertClose('tank liquid level static contribution', attachedTank.result.calculationTrace.steps.find(step => step.title === 'Elevation Head').result, 6, 0.001);

const standalone = evaluateNetwork({
    suctionConnection: 'source',
    sourceType: 'Standalone Boundary Source',
    sourceElevation: 3
});
assert(standalone.context.suctionPath.boundaryId === 'SRC-100', 'Standalone hydraulic SRC pipe should create a valid source boundary');
assert(standalone.result.status !== 'Incomplete', 'Standalone SRC connected by hydraulic pipe should evaluate');

const externalStatic = evaluateNetwork({
    suctionConnection: 'source',
    sourceType: 'External Header / Pipe Tie-in',
    pressureEnergyBasis: 'Static Pressure',
    diameter: 0.05,
    flow: 20
});
const externalTotal = evaluateNetwork({
    suctionConnection: 'source',
    sourceType: 'External Header / Pipe Tie-in',
    pressureEnergyBasis: 'Total / Stagnation Pressure',
    diameter: 0.05,
    flow: 20
});
const externalStaticVelocityStep = externalStatic.result.calculationTrace.steps.find(step => step.title === 'Source Velocity Head');
const externalStaticNpshaStep = externalStatic.result.calculationTrace.steps.find(step => step.title === 'NPSHa');
const externalStaticPressureStep = externalStatic.result.calculationTrace.steps.find(step => step.title === 'Pressure Head');
const externalStaticElevationStep = externalStatic.result.calculationTrace.steps.find(step => step.title === 'Elevation Head');
const externalStaticLossStep = externalStatic.result.calculationTrace.steps.find(step => step.title === 'Suction Loss');
const externalStaticVaporStep = externalStatic.result.calculationTrace.steps.find(step => step.title === 'Vapor Pressure Head');
const externalTraceNpshaSum = externalStaticPressureStep.result
    + externalStaticElevationStep.result
    + externalStaticVelocityStep.result
    - externalStaticLossStep.result
    - externalStaticVaporStep.result;
assertClose('external header source velocity head trace', externalStaticVelocityStep.result, externalStatic.snapshot.sourceVelocityHead, 0.001);
assertClose('external header static NPSHa trace sum', externalTraceNpshaSum, externalStaticNpshaStep.result, 0.01);
assertClose('external header total pressure source velocity head trace', externalTotal.result.calculationTrace.steps.find(step => step.title === 'Source Velocity Head').result, 0, 0.001);
const externalDashedAttachment = evaluateNetwork({
    attachSourceToTank: true,
    suctionConnection: 'tank',
    sourceType: 'External Header / Pipe Tie-in',
    sourceBoundaryDataSource: 'Inherit from Attached Equipment'
});
assert(externalDashedAttachment.context.suctionPath.boundaryId === 'TK-101', 'External Header dashed attachment should be ignored while the tank remains the suction boundary');
assert(
    externalDashedAttachment.sourceBoundary.warnings.some(item => item.includes('solid hydraulic connection')),
    'Expected External Header dashed attachment to be ignored with a clear warning'
);
assert(externalStatic.snapshot.npsha > externalTotal.snapshot.npsha + 0.3, 'Static pressure tie-in should include velocity head once; total pressure tie-in should not double count it');

const elevationCase = evaluateNetwork({
    attachSourceToTank: true,
    suctionConnection: 'tank',
    sourceType: 'Open Tank / Reservoir',
    sourceBoundaryDataSource: 'Inherit from Attached Equipment',
    tankBaseElevation: 0,
    tankLiquidLevel: 5,
    pumpSuctionElevation: 1,
    pipeLength: 0
});
assertClose('NPSHA elevation contribution', elevationCase.result.calculationTrace.steps.find(step => step.title === 'Elevation Head').result, 4, 0.001);

const multiSourcePump = evaluateNetwork({
    attachSourceToTank: true,
    attachSecondSourceToTank: true,
    suctionConnection: 'tank',
    sourceType: 'Open Tank / Reservoir',
    sourceBoundaryDataSource: 'Inherit from Attached Equipment',
    tankBaseElevation: 2,
    tankLiquidLevel: 5,
    tankPressure: 0.4,
    pumpSuctionElevation: 1,
    pipeLength: 0
});
assert(multiSourcePump.context.suctionPath.boundaryId === 'TK-101', 'Multi-SRC tank feed should use the tank as the pump suction boundary');
assert(multiSourcePump.result.status !== 'Incomplete', 'Multi-SRC tank feed must not make pump NPSH incomplete');
assert(
    !multiSourcePump.context.networkWarnings.some(item => item.includes('Multiple SRC boundaries')),
    'Multi-SRC tank feed should not trigger nodal solver warning for pump suction'
);

const highPoint = evaluateNetwork({
    attachSourceToTank: true,
    suctionConnection: 'tank',
    sourceType: 'Open Tank / Reservoir',
    sourceBoundaryDataSource: 'Inherit from Attached Equipment',
    tankBaseElevation: 0,
    tankLiquidLevel: 5,
    pumpSuctionElevation: 1,
    highPointElevation: 20,
    applyPathResults: true
});
assert(highPoint.pipe.results.warnings.some(item => item.includes('high point pressure')), 'Expected high point pressure warning');

const overSpecifiedWarnings = vm.runInContext(`
getOverSpecifiedFlowPressureWarnings(
    { source: 'source-flow' },
    { dischargeBoundary: { type: 'sink', props: { active: 'Active', boundaryMode: 'Pressure' } } }
)
`, context);
assert(
    overSpecifiedWarnings.some(item => item.includes('Flow, downstream pressure, and pump curve are all fixed')),
    'Expected over-specified fixed-flow/downstream-pressure warning'
);

const multiSourceTank = vm.runInContext(`
(() => {
    Object.keys(globalModel).forEach(key => delete globalModel[key]);
    Object.assign(globalModel, {
        FLUID: {
            type: 'fluid',
            name: 'Fluid Basis',
            props: { density: 997, vaporPressure: 0.031698 }
        },
        'TK-100': {
            type: 'tank',
            name: 'TK-100',
            props: {
                pressureInputBasis: 'Gauge',
                pressure: 0,
                elevation: 0,
                liquidLevel: 5
            }
        },
        'SRC-100': {
            type: 'source',
            name: 'SRC-100',
            props: {
                sourceType: 'Open Tank / Reservoir',
                flow: 104.81
            }
        },
        'SRC-103': {
            type: 'source',
            name: 'SRC-103',
            props: {
                sourceType: 'Open Tank / Reservoir',
                flow: 20.19
            }
        }
    });
    connections.splice(0, connections.length);
    sourceLinks.splice(0, sourceLinks.length,
        {
            sourceId: 'SRC-100',
            targetId: 'TK-100',
            targetPort: '.port.inlet',
            connectionType: 'semantic',
            attachmentType: 'source-boundary',
            visualStyle: 'dashed'
        },
        {
            sourceId: 'SRC-103',
            targetId: 'TK-100',
            targetPort: '.port.inlet',
            connectionType: 'semantic',
            attachmentType: 'source-boundary',
            visualStyle: 'dashed'
        }
    );
    updateTankPressureReadout('TK-100');
    return globalModel['TK-100'].results;
})()
`, context);
assert(multiSourceTank.connectedSources.length === 2, 'Expected tank to track both attached SRC ids');
assert(multiSourceTank.sourceFeedFlows.length === 2, 'Expected tank to expose per-SRC feed flow breakdown');
assertClose('multi-source SRC-100 feed flow', multiSourceTank.sourceFeedFlows[0].flow, 104.81, 0.001);
assertClose('multi-source SRC-103 feed flow', multiSourceTank.sourceFeedFlows[1].flow, 20.19, 0.001);
assertClose('multi-source total SRC feed flow', multiSourceTank.sourceFeedFlow, 125, 0.001);
assertClose('multi-source tank net flow', multiSourceTank.netFlow, 125, 0.001);
assert(multiSourceTank.levelTrend === 'Rising', 'Expected positive tank net flow to show Rising level trend');
assert(multiSourceTank.status === 'Advisory', 'Expected inventory imbalance alone to be advisory');
assert(
    multiSourceTank.warnings.some(item => item.includes('Tank inventory advisory')),
    'Expected inventory advisory message for non-zero tank net flow'
);

console.log(JSON.stringify({
    passed: true,
    missingPathWarning: missingPath.context.networkWarnings[0],
    invalidPumpAttachmentWarning: invalidPumpAttachment.context.networkWarnings[0],
    tankBoundaryElevation: attachedTank.result.calculationTrace.boundary.elevation,
    standaloneStatus: standalone.result.status,
    externalHeaderDelta: Number((externalStatic.snapshot.npsha - externalTotal.snapshot.npsha).toFixed(3)),
    externalDashedWarning: externalDashedAttachment.sourceBoundary.warnings[0],
    highPointWarning: highPoint.pipe.results.warnings[0],
    overSpecifiedWarning: overSpecifiedWarnings[0],
    multiSourceTank: {
        connectedSources: multiSourceTank.connectedSources,
        sourceFeedFlows: multiSourceTank.sourceFeedFlows,
        totalSourceFeedFlow: multiSourceTank.sourceFeedFlow,
        netFlow: multiSourceTank.netFlow,
        levelTrend: multiSourceTank.levelTrend,
        status: multiSourceTank.status
    },
    multiSourcePump: {
        suctionBoundary: multiSourcePump.context.suctionPath.boundaryId,
        status: multiSourcePump.result.status,
        networkWarnings: multiSourcePump.context.networkWarnings
    }
}, null, 2));
