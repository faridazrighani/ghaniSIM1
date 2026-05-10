const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const scriptFiles = [
    'formulas/constants.js',
    'properties/objects/pipe-properties.js',
    'formulas/objects/pipe-formulas.js',
    'formulas/objects/hydraulic-network-formulas.js'
];

const context = { console, Math, Number, parseFloat, JSON };
context.window = context;
vm.createContext(context);

vm.runInContext(`
var globalModel = {};
var connections = [];
var sourceLinks = [];
`, context, { filename: 'pipe-validation-prelude.js' });

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

function evaluatePipe(pipeProps, flowM3H = 10, fluidProps = { viscosity: 1 }) {
    context.globalModel.FLUID = {
        type: 'fluid',
        props: {
            density: 1000,
            viscosity: fluidProps.viscosity,
            vaporPressure: fluidProps.vaporPressure ?? 0.0317
        }
    };
    context.globalModel['PIPE-1'] = { type: 'pipe', name: 'PIPE-1', props: pipeProps };
    return vm.runInContext(`calculatePipeHydraulicSegments(${flowM3H}, globalModel['PIPE-1'].props)`, context);
}

const basePipe = {
    routeStyle: 'Straight',
    elevationProfileMode: 'End Elevations',
    segments: [{
        name: 'Segment 1',
        pipeSize: 'Custom diameter',
        material: 'Commercial steel',
        diameter: 0.1,
        length: 10,
        roughness: 0.000045,
        fittingType: 'None',
        fittingQuantity: 0,
        fittingK: 0,
        minorLoss: 0
    }]
};

const majorOnly = evaluatePipe(structuredClone(basePipe), 10)[0];
const q = 10 / 3600;
const area = Math.PI * Math.pow(0.1, 2) / 4;
const velocity = q / area;
const velocityHead = Math.pow(velocity, 2) / (2 * 9.81);
const expectedMajorLoss = majorOnly.frictionFactor * (10 / 0.1) * velocityHead;
assertClose('velocity', majorOnly.velocity, velocity, 1e-9);
assertClose('Darcy-Weisbach major loss', majorOnly.majorLoss, expectedMajorLoss, 1e-9);
assert(majorOnly.flowRegime === 'Turbulent', `Expected turbulent flow, got ${majorOnly.flowRegime}`);

const minorPipe = structuredClone(basePipe);
minorPipe.segments[0].fittingType = 'Custom K';
minorPipe.segments[0].fittingQuantity = 2;
minorPipe.segments[0].fittingK = 0.5;
minorPipe.segments[0].minorLoss = 1;
const minorResult = evaluatePipe(minorPipe, 10)[0];
assertClose('minor K total', minorResult.minorLossK, 2, 1e-12);
assertClose('minor head loss', minorResult.minorLoss, 2 * velocityHead, 1e-9);
assertClose('total loss', minorResult.totalLoss, minorResult.majorLoss + minorResult.minorLoss, 1e-12);

const allowancePipe = structuredClone(basePipe);
allowancePipe.roughnessAgingFactor = 2;
allowancePipe.headLossAllowancePercent = 20;
const allowanceResult = evaluatePipe(allowancePipe, 10)[0];
assertClose('effective roughness aging', allowanceResult.effectiveRoughness, basePipe.segments[0].roughness * 2, 1e-12);
assertClose('head loss allowance', allowanceResult.allowanceLoss, allowanceResult.baseTotalLoss * 0.2, 1e-12);
assertClose('allowed total loss', allowanceResult.totalLoss, allowanceResult.baseTotalLoss * 1.2, 1e-12);
assert(allowanceResult.materialSource.status === 'Typical', 'Expected material source status');
assert(allowanceResult.fittingSource.status === 'Exact', 'Expected fitting source status for None');

const multiSegmentPipe = structuredClone(basePipe);
multiSegmentPipe.segments.push({
    ...structuredClone(basePipe.segments[0]),
    name: 'Segment 2',
    diameter: 0.05,
    length: 5,
    minorLoss: 0.7
});
context.globalModel.FLUID = { type: 'fluid', props: { density: 1000, viscosity: 1, vaporPressure: 0.0317 } };
context.globalModel['PIPE-1'] = { type: 'pipe', name: 'PIPE-1', props: multiSegmentPipe };
const multiDetails = vm.runInContext('calculatePipeHydraulicSegments(10, globalModel["PIPE-1"].props)', context);
const multiHeadLoss = vm.runInContext('calculatePipeHeadLoss(10, globalModel["PIPE-1"].props)', context);
assert(multiDetails.length === 2, 'Expected two pipe segment results');
assertClose('multi-segment total', multiHeadLoss, multiDetails.reduce((sum, item) => sum + item.totalLoss, 0), 1e-12);

const regimes = vm.runInContext(`({
    laminar: getPipeFlowRegime(2300),
    transitional: getPipeFlowRegime(3000),
    turbulent: getPipeFlowRegime(4000),
    warning: getPipeFlowRegimeWarning(3000)
})`, context);
assert(regimes.laminar === 'Laminar', `Expected Re 2300 to be laminar, got ${regimes.laminar}`);
assert(regimes.transitional === 'Transitional', `Expected Re 3000 to be transitional, got ${regimes.transitional}`);
assert(regimes.turbulent === 'Turbulent', `Expected Re 4000 to be turbulent, got ${regimes.turbulent}`);
assert(regimes.warning.includes('Transitional'), 'Expected transitional flow warning');

function evaluateElevationMode(mode) {
    return vm.runInContext(`
(() => {
    globalModel = {
        FLUID: { type: 'fluid', props: { density: 1000, viscosity: 1, vaporPressure: 0.1 } },
        A: { type: 'junction', props: { elevation: 2 } },
        B: { type: 'junction', props: { elevation: 3 } },
        'PIPE-1': {
            type: 'pipe',
            name: 'PIPE-1',
            props: {
                routeStyle: 'Straight',
                elevationProfileMode: '${mode}',
                startElevation: 100,
                endElevation: 90,
                highPointElevation: 30,
                segments: [{
                    name: 'Segment 1',
                    pipeSize: 'Custom diameter',
                    material: 'Commercial steel',
                    diameter: 0.1,
                    length: 10,
                    roughness: 0.000045,
                    fittingType: 'None',
                    fittingQuantity: 0,
                    fittingK: 0,
                    minorLoss: 0
                }]
            }
        }
    };
    setPipeHydraulicResult(
        globalModel,
        { pipeId: 'PIPE-1', from: 'A', fromPort: '.port.outlet', to: 'B', toPort: '.port.inlet' },
        10,
        20,
        18,
        1000,
        10000
    );
    return globalModel['PIPE-1'].results;
})()
`, context);
}

const ignoreElevation = evaluateElevationMode('Ignore');
assertClose('ignore mode start elevation', ignoreElevation.startElevation, 2, 0.001);
assertClose('ignore mode end elevation', ignoreElevation.endElevation, 3, 0.001);
assert(ignoreElevation.highPointPressure === null, 'Ignore mode must not calculate stale high point pressure');

const endElevations = evaluateElevationMode('End Elevations');
assertClose('end elevations start override', endElevations.startElevation, 100, 0.001);
assertClose('end elevations end override', endElevations.endElevation, 90, 0.001);
assert(endElevations.highPointPressure === null, 'End Elevations mode must ignore stale high point elevation');

const highPoint = evaluateElevationMode('High Point Check');
assertClose('high point start override', highPoint.startElevation, 100, 0.001);
assertClose('high point end override', highPoint.endElevation, 90, 0.001);
assert(Number.isFinite(highPoint.highPointPressure), 'High Point Check must calculate high point pressure');
assert(Number.isFinite(highPoint.highPointVaporMargin), 'High Point Check must calculate vapor margin');
assert(highPoint.warnings.some(item => item.includes('high point pressure')), 'Expected high point pressure warning');

const perSegmentHighPoint = vm.runInContext(`
(() => {
    globalModel = {
        FLUID: { type: 'fluid', props: { density: 1000, viscosity: 1, vaporPressure: 0.1 } },
        A: { type: 'junction', props: { elevation: 0 } },
        B: { type: 'junction', props: { elevation: 0 } },
        'PIPE-2': {
            type: 'pipe',
            name: 'PIPE-2',
            props: {
                routeStyle: 'Straight',
                elevationProfileMode: 'High Point Check',
                highPointElevation: 90,
                highPointLocationPercent: 10,
                segments: [
                    {
                        name: 'First',
                        pipeSize: 'Custom diameter',
                        material: 'Commercial steel',
                        diameter: 0.1,
                        length: 5,
                        roughness: 0.000045,
                        fittingType: 'None',
                        fittingQuantity: 0,
                        fittingK: 0,
                        minorLoss: 0,
                        startElevation: 0,
                        endElevation: 2,
                        highPointElevation: '',
                        highPointLocationPercent: 50
                    },
                    {
                        name: 'Second',
                        pipeSize: 'Custom diameter',
                        material: 'Commercial steel',
                        diameter: 0.1,
                        length: 5,
                        roughness: 0.000045,
                        fittingType: 'None',
                        fittingQuantity: 0,
                        fittingK: 0,
                        minorLoss: 0,
                        startElevation: 2,
                        endElevation: 0,
                        highPointElevation: 25,
                        highPointLocationPercent: 25
                    }
                ]
            }
        }
    };
    setPipeHydraulicResult(
        globalModel,
        { pipeId: 'PIPE-2', from: 'A', fromPort: '.port.outlet', to: 'B', toPort: '.port.inlet' },
        10,
        30,
        25,
        1000,
        10000
    );
    return globalModel['PIPE-2'].results;
})()
`, context);
assert(perSegmentHighPoint.segmentProfiles.length === 2, 'Expected two segment pressure profiles');
assert(perSegmentHighPoint.highPointSegment === 'Second', `Expected controlling high point on second segment, got ${perSegmentHighPoint.highPointSegment}`);
assertClose('segment start elevation override', perSegmentHighPoint.segmentProfiles[1].startElevation, 2, 0.001);
assertClose('segment high point location', perSegmentHighPoint.segmentProfiles[1].highPointLocationPercent, 25, 0.001);

const pipeTrace = vm.runInContext(`buildPipeCalculationTrace(10, globalModel['PIPE-2'].props, globalModel['PIPE-2'].results)`, context);
assert(pipeTrace.isSolved, 'Expected solved pipe calculation trace');
assert(pipeTrace.basis.flowM3H === 10, 'Expected trace flow basis');
assert(pipeTrace.segments.length === 2, 'Expected trace for two segments');
assert(pipeTrace.segments[0].steps.some(step => step.title === 'Area'), 'Expected area step in trace');
assert(pipeTrace.segments[0].steps.some(step => step.title === 'Reynolds Number'), 'Expected Reynolds step in trace');
assert(pipeTrace.segments[0].steps.some(step => step.title === 'Major Loss'), 'Expected major loss step in trace');
assert(pipeTrace.segments[1].pressureSteps.some(step => step.title === 'High Point Vapor Margin'), 'Expected high point margin pressure step');
assert(pipeTrace.totals.totalLoss > 0, 'Expected positive total loss in trace');
assert(pipeTrace.notes.some(note => note.includes('Darcy')), 'Expected Darcy friction note in trace');

const sidebar = fs.readFileSync(path.join(projectRoot, 'ui/sidebar-properties.js'), 'utf8');
const taskWindow = fs.readFileSync(path.join(projectRoot, 'ui/task-window.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const styles = fs.readFileSync(path.join(projectRoot, 'style.css'), 'utf8');
assert(sidebar.includes('bar a'), 'Expected pipe pressure labels to use bar a');
assert(sidebar.includes('Darcy f'), 'Expected segment table to label Darcy friction factor');
assert(sidebar.includes('High Point Margin'), 'Expected high point vapor margin readout');
assert(sidebar.includes('Allowance Loss'), 'Expected allowance loss readout');
assert(sidebar.includes('eps eff'), 'Expected effective roughness readout');
assert(sidebar.includes('Calculation Trace / Step-by-step Report'), 'Expected pipe calculation trace report in sidebar');
assert(sidebar.includes('data-label="Formula"'), 'Expected responsive pipe trace table labels');
assert(taskWindow.includes('openPipePropertiesTaskWindow'), 'Expected pipe properties to open in task window');
assert(taskWindow.includes('task-window-minimized'), 'Expected task window minimize state handling');
assert(taskWindow.includes('clampTaskWindowToViewport'), 'Expected task window viewport clamping for mobile/tablet');
assert(taskWindow.includes('resetScroll'), 'Expected pipe task window to reset scroll on fresh open');
assert(indexHtml.includes('taskWindowMinimize'), 'Expected task window minimize control');
assert(styles.includes('task-window-pipe-active'), 'Expected responsive pipe task window styling');
assert(styles.includes('overflow-x: hidden'), 'Expected task window body to prevent whole-window horizontal scrolling');
assert(styles.includes('pipe-properties-task-open'), 'Expected mobile sidebar suppression while pipe task is open');
assert(styles.includes('pipe-trace-table td::before'), 'Expected responsive card labels for pipe trace steps');

console.log(JSON.stringify({
    passed: true,
    majorLoss: Number(majorOnly.majorLoss.toFixed(6)),
    minorLoss: Number(minorResult.minorLoss.toFixed(6)),
    allowanceLoss: Number(allowanceResult.allowanceLoss.toFixed(6)),
    multiSegmentLoss: Number(multiHeadLoss.toFixed(6)),
    regimes,
    elevationModes: {
        ignoreStart: ignoreElevation.startElevation,
        endOverrideStart: endElevations.startElevation,
        highPointMargin: highPoint.highPointVaporMargin,
        highPointWarning: highPoint.warnings[0],
        perSegmentHighPoint: perSegmentHighPoint.highPointSegment,
        traceSegments: pipeTrace.segments.length
    }
}, null, 2));
