const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const context = { console, Math, Number, parseFloat, JSON };
context.window = context;
vm.createContext(context);

vm.runInContext(`
function renderSidebar() {}
function updateSimulation() {}
function drawConnections() {}
function getObjectElement() { return null; }
function selectNode() {}
function isInstrumentType() { return false; }
`, context, { filename: 'source-ui-prelude.js' });

vm.runInContext(
    fs.readFileSync(path.join(projectRoot, 'core/state-manager.js'), 'utf8'),
    context,
    { filename: 'core/state-manager.js' }
);

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

vm.runInContext(`
Object.keys(globalModel).forEach(key => delete globalModel[key]);
Object.assign(globalModel, {
    'SRC-100': {
        type: 'source',
        name: 'SRC-100',
        props: {
            sourceType: SOURCE_TYPE_OPEN_TANK,
            boundaryDataSource: SOURCE_BOUNDARY_DATA_MANUAL
        }
    },
    'TK-101': {
        type: 'tank',
        name: 'TK-101',
        props: { pressure: 0, pressureInputBasis: 'Gauge', elevation: 0, liquidLevel: 5 }
    },
    'P-100': {
        type: 'pump',
        name: 'P-100',
        props: {}
    },
    'V-100': {
        type: 'valve',
        name: 'V-100',
        props: {}
    }
});
sourceLinks.splice(0, sourceLinks.length);
`, context);

const tankAttachAllowed = vm.runInContext(`isSourceAttachTarget('TK-101')`, context);
const pumpAttachAllowed = vm.runInContext(`isSourceAttachTarget('P-100')`, context);
const valveAttachAllowed = vm.runInContext(`isSourceAttachTarget('V-100')`, context);

assert(tankAttachAllowed === true, 'Tank should be a valid semantic SRC attachment target');
assert(pumpAttachAllowed === false, 'Pump must not be a semantic SRC attachment target');
assert(valveAttachAllowed === false, 'Valve must not be a semantic SRC attachment target');

vm.runInContext(`attachSourceToEquipment('SRC-100', 'TK-101')`, context);
assert(vm.runInContext(`sourceLinks.length`, context) === 1, 'Open Tank SRC should attach semantically to tank');
assert(
    vm.runInContext(`globalModel['SRC-100'].props.boundaryDataSource`, context) === 'Inherit from Attached Equipment',
    'Open Tank SRC attached to tank should default to inherited boundary data'
);
assert(
    vm.runInContext(`getSourceTypeDescription(SOURCE_TYPE_OPEN_TANK).includes('Atmospheric tank')`, context),
    'Open Tank source type should expose a clear UI description'
);

const hydraulicTypeConstants = [
    'SOURCE_TYPE_EXTERNAL_HEADER',
    'SOURCE_TYPE_FIXED_FLOW',
    'SOURCE_TYPE_STANDALONE'
];

hydraulicTypeConstants.forEach(typeConstant => {
    vm.runInContext(`
    Object.keys(globalModel).forEach(key => {
        if (globalModel[key]?.type === 'pipe') delete globalModel[key];
    });
    connections.splice(0, connections.length);
    sourceLinks.splice(0, sourceLinks.length, {
        sourceId: 'SRC-100',
        targetId: 'TK-101',
        targetPort: '.port.inlet',
        connectionType: 'semantic',
        attachmentType: 'source-boundary',
        visualStyle: 'dashed'
    });
    globalModel['SRC-100'].props.sourceType = ${typeConstant};
    globalModel['SRC-100'].props.boundaryDataSource = SOURCE_BOUNDARY_DATA_INHERIT;
    reconcileSourceBoundaryConfiguration('SRC-100', { detachInvalidAttachment: true });
    `, context);

    assert(vm.runInContext(`sourceLinks.length`, context) === 0, `${typeConstant} should convert stale dashed attachment away from sourceLinks`);
    assert(vm.runInContext(`connections.length`, context) === 1, `${typeConstant} should convert dashed attachment to a solid hydraulic connection`);
    assert(
        vm.runInContext(`connections[0].from === 'SRC-100' && connections[0].to === 'TK-101'`, context),
        `${typeConstant} converted hydraulic connection should preserve the SRC-to-tank relationship`
    );
    assert(
        vm.runInContext(`!!globalModel[connections[0].pipeId] && globalModel[connections[0].pipeId].type === 'pipe'`, context),
        `${typeConstant} converted hydraulic connection should create a pipe object`
    );
    assert(
        vm.runInContext(`globalModel['SRC-100'].props.boundaryDataSource`, context) === 'Manual',
        `${typeConstant} must force Manual boundary data source`
    );
});

const semanticTypeConstants = [
    'SOURCE_TYPE_OPEN_TANK',
    'SOURCE_TYPE_PRESSURIZED_VESSEL'
];

semanticTypeConstants.forEach((typeConstant, index) => {
    const pipeId = `PIPE-${77 + index}`;
    vm.runInContext(`
    Object.keys(globalModel).forEach(key => {
        if (globalModel[key]?.type === 'pipe') delete globalModel[key];
    });
    globalModel['SRC-100'].props.sourceType = ${typeConstant};
    globalModel['SRC-100'].props.boundaryDataSource = SOURCE_BOUNDARY_DATA_MANUAL;
    globalModel['${pipeId}'] = { type: 'pipe', name: '${pipeId}', props: {} };
    connections.splice(0, connections.length, {
        from: 'SRC-100',
        fromPort: '.port.outlet',
        to: 'TK-101',
        toPort: '.port.inlet',
        pipeId: '${pipeId}',
        connectionType: 'hydraulic'
    });
    sourceLinks.splice(0, sourceLinks.length);
    reconcileSourceBoundaryConfiguration('SRC-100', { detachInvalidAttachment: true });
    `, context);

    assert(vm.runInContext(`connections.length`, context) === 0, `${typeConstant} direct SRC-to-tank pipe should convert away from hydraulic connections`);
    assert(vm.runInContext(`sourceLinks.length`, context) === 1, `${typeConstant} direct SRC-to-tank pipe should become a dashed sourceLink`);
    assert(vm.runInContext(`!!globalModel['${pipeId}']`, context) === false, `${typeConstant} converted direct SRC-to-tank pipe object should be removed`);
    assert(
        vm.runInContext(`globalModel['SRC-100'].props.boundaryDataSource`, context) === 'Inherit from Attached Equipment',
        `${typeConstant} converted attachment should inherit tank/vessel data`
    );
});

vm.runInContext(`
globalModel.FLUID = {
    type: 'fluid',
    name: 'Fluid Basis',
    props: { density: 1000, temp: 25 }
};
globalModel['SRC-100'].props.temperatureMode = SOURCE_TEMP_MODE_CUSTOM;
globalModel['SRC-100'].props.flowInputMode = SOURCE_FLOW_MODE_MASS;
globalModel['SRC-100'].props.massFlow = 800;
function getFluidPropsAtSourceTemperature() {
    return { density: 800, viscosity: 1, vaporPressure: 0.02, temp: 60, warnings: [] };
}
syncSourceFlowFromInputMode('SRC-100');
`, context);
assert(
    Math.abs(vm.runInContext(`globalModel['SRC-100'].props.flow`, context) - 1) < 1e-9,
    'Mass-flow conversion should use SRC custom-temperature effective density when available'
);

const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const taskWindowSource = fs.readFileSync(path.join(projectRoot, 'ui/task-window.js'), 'utf8');
assert(indexHtml.includes('id="menu-src-help"'), 'Help menu should expose SRC Boundary Guidance');
assert(taskWindowSource.includes('function openSrcHelp()'), 'Task window should implement SRC help opener');
assert(taskWindowSource.includes('NPSH Data Selection Matrix'), 'SRC help should include NPSH decision guidance');
assert(taskWindowSource.includes('src-decision-matrix'), 'SRC help should use compact decision matrix layout');
assert(taskWindowSource.includes('createSrcHelpSection'), 'SRC help should keep detailed guidance collapsible');
assert(taskWindowSource.includes('Dashed SRC attachment is excluded from hydraulic traversal'), 'SRC help should explain dashed attachment behavior');

console.log(JSON.stringify({
    passed: true,
    tankAttachAllowed,
    pumpAttachAllowed,
    valveAttachAllowed,
    externalHeaderLinks: 0,
    hydraulicTypesChecked: hydraulicTypeConstants.length,
    semanticTypesChecked: semanticTypeConstants.length,
    customTemperatureFlowConversion: vm.runInContext(`globalModel['SRC-100'].props.flow`, context),
    convertedConnectionCount: vm.runInContext(`connections.length`, context),
    convertedAttachmentTarget: vm.runInContext(`sourceLinks[0]?.targetId`, context)
}, null, 2));
