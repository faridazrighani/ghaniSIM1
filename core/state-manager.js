// --- Global Data Model ---
let appMode = 'SELECT';
let pendingConnectionStart = null;
let onCanvasMouseMove = null;
let connections = [
    { from: 'TK-100', fromPort: '.port.outlet', to: 'P-100', toPort: '.port.inlet', pipeId: 'PIPE-1' },
    { from: 'P-100', fromPort: '.port.outlet', to: 'TK-101', toPort: '.port.inlet', pipeId: 'PIPE-2' }
];
let instrumentLinks = [];
let sourceLinks = [];

const INSTRUMENT_TYPES = ['pressureIndicator', 'flowIndicator', 'temperatureIndicator', 'lineMonitor', 'levelController'];
const SOURCE_TEMP_MODE_FLUID_BASIS = 'Use Fluid Basis';
const SOURCE_TEMP_MODE_CUSTOM = 'Custom';
const SOURCE_FLOW_MODE_VOLUME = 'Volumetric Flow';
const SOURCE_FLOW_MODE_MASS = 'Mass Flow';
const SOURCE_DEFAULT_MASS_FLOW_KGH = 9500;
const SINK_BOUNDARY_MODE_PRESSURE = 'Outlet Pressure';
const SINK_BOUNDARY_MODE_FLOW = 'Flow Demand';
const SINK_ACTIVE = 'Active';
const SINK_INACTIVE = 'Inactive';

const globalModel = {
    "FLUID":  { 
        type: "fluid", 
        name: "Fluid Basis", 
        props: { 
            inputMode: "Basic",
            fluidName: "Palm Oil", 
            temp: 60, 
            density: 883.47,
            sg: 0.8835, 
            viscosity: 24.75,
            dynViscosity: 21.87,
            vaporPressure: 0.001,
            specificHeat: 2.0,
            bulkModulus: 1.8,
            specVolume: 0.001132,
            specWeight: 8666.8,
            speedOfSound: 1427.3
        } 
    },
    "TK-100": { type: "tank", name: "TK-100", desc: "Storage Tank", props: { ...getDefaultProps('tank'), elevation: 5 } },
    "PIPE-1": { type: "pipe", name: "PIPE-1", desc: "Suction Line", props: { minorLoss: 2.5, segments: [{ name: "Suction 12 in", pipeSize: "Custom diameter", diameter: 0.15, length: 20, roughness: 0.000045 }] } },
    "P-100":  { type: "pump", name: "P-100", desc: "Transfer Pump", props: getDefaultProps('pump'), results: { flow: 0, head: 0, power: 0, npsha: 0, npshr: 0 } },
    "PIPE-2": { type: "pipe", name: "PIPE-2", desc: "Discharge Line", props: { minorLoss: 5.0, segments: [{ name: "Discharge 4 in", pipeSize: "Custom diameter", diameter: 0.1, length: 300, roughness: 0.000045 }] } },
    "TK-101": { type: "tank", name: "TK-101", desc: "Processing Tank", props: { ...getDefaultProps('tank'), elevation: 25 } }
};

let currentSelectedNode = null;
let pumpChartInstance = null;
let activeChartPumpId = null;
let nextPipeRouteStyle = 'Straight';

// --- State Modifiers ---

function createDefaultResults(type) {
    if (type === 'tank') {
        return {
            connectedPipes: [],
            connectedSources: [],
            calculatedPressure: null,
            inletPressure: null,
            outletPressure: null,
            stagnationPressure: null,
            inletFlow: null,
            outletFlow: null,
            netFlow: null,
            sourceFeedFlow: null,
            operatingPressureAbsolute: null,
            operatingPressureGauge: null,
            hydraulicStatus: '-',
            pressureBasis: '-',
            vaporPressure: null,
            suggestedPsv: 0,
            psvBasis: 'Not available',
            status: '-',
            warnings: []
        };
    }

    if (type === 'sink') {
        return {
            attachedPipe: '',
            boundaryPressure: null,
            boundaryPressureInput: null,
            pressureInputBasis: 'Absolute',
            calculatedPressure: null,
            staticPressure: null,
            stagnationPressure: null,
            pressureResidual: null,
            flow: null,
            massFlow: null,
            temperature: null,
            hydraulicHead: null,
            pressureBasis: 'Static',
            boundaryMode: 'Outlet Pressure',
            status: '-',
            warnings: []
        };
    }

    if (type !== 'pump') return null;

    return {
        flow: 0,
        head: 0,
        efficiency: 0,
        power: 0,
        npsha: 0,
        npshr: 0,
        npshrSource: '-',
        npshMargin: 0,
        npshRatio: 0,
        cavitationStatus: '-',
        bepPercent: 0,
        operatingRegion: '-',
        status: '-',
        warnings: [],
        suctionPressure: 0,
        dischargePressure: 0,
        suctionLoss: 0,
        dischargeLoss: 0,
        suctionVelocityHead: 0,
        vaporPressureHead: 0,
        dominantSuctionLoss: '-',
        engineeringNotes: [],
        solveMode: '-',
        flowBasis: '-',
        fixedFlow: null,
        requiredSystemHead: null,
        pumpHeadAtFlow: null,
        headResidual: null,
        pressureResidual: null,
        downstreamBoundary: '-',
        optimization: null,
        npshEvaluation: null,
        curveSource: '-',
        modelBasis: '-',
        modelWarnings: [],
        sysCurve: [],
        pumpCurve: []
    };
}

function ensureNodeResults(node) {
    if (!node.results) {
        node.results = createDefaultResults(node.type) || {};
    } else if (node.type === 'pump' || node.type === 'sink' || node.type === 'tank') {
        const defaults = createDefaultResults(node.type) || {};
        Object.keys(defaults).forEach(key => {
            if (node.results[key] === undefined) node.results[key] = defaults[key];
        });
    }
    return node.results;
}

function cancelPendingConnection(redraw = true) {
    if (onCanvasMouseMove) {
        document.removeEventListener('pointermove', onCanvasMouseMove);
    }
    pendingConnectionStart = null;
    onCanvasMouseMove = null;
    if (redraw) drawConnections();
}

function attachInstrumentToPipe(instrumentId, pipeId, location = 0.5) {
    const instrument = globalModel[instrumentId];
    const pipe = globalModel[pipeId];
    if (!instrument || !pipe || !isInstrumentType(instrument.type) || pipe.type !== 'pipe') return;

    const tapLocation = Math.max(0, Math.min(1, parseFloat(location)));
    instrumentLinks = instrumentLinks.filter(link => link.instrumentId !== instrumentId);
    instrumentLinks.push({ instrumentId, pipeId, location: Number.isFinite(tapLocation) ? tapLocation : 0.5 });
    instrument.props.attachedTo = pipeId;
    cancelPendingConnection(false);
    updateSimulation({ renderSidebarAfter: false });
    selectNode(instrumentId, getObjectElement(instrumentId));
    drawConnections();
}

function isSourceAttachTarget(nodeId) {
    const node = globalModel[nodeId];
    if (!node || node.type === 'source' || node.type === 'pipe') return false;
    if (typeof isInstrumentType === 'function' && isInstrumentType(node.type)) return false;
    return true;
}

function getSourceLink(sourceId) {
    return sourceLinks.find(link => link.sourceId === sourceId) || null;
}

function syncSourceAttachmentProps(sourceId) {
    const source = globalModel[sourceId];
    if (!source || source.type !== 'source') return;
    if (!source.props) source.props = {};

    const link = getSourceLink(sourceId);
    source.props.attachedTo = link ? link.targetId : '';
}

function getFluidBasisTemperature() {
    const temperature = parseFloat(globalModel.FLUID?.props?.temp);
    return Number.isFinite(temperature) ? temperature : 25;
}

function getFluidBasisDensity() {
    const density = parseFloat(globalModel.FLUID?.props?.density);
    return Number.isFinite(density) && density > 0 ? density : 1000;
}

function calculateSourceVolumetricFlowFromMass(massFlowKgH, density = getFluidBasisDensity()) {
    const massFlow = parseFloat(massFlowKgH);
    const rho = parseFloat(density);
    if (!Number.isFinite(massFlow) || !Number.isFinite(rho) || rho <= 0) return 0;
    return massFlow / rho;
}

function calculateSourceMassFlowFromVolumetric(flowM3H, density = getFluidBasisDensity()) {
    const flow = parseFloat(flowM3H);
    const rho = parseFloat(density);
    if (!Number.isFinite(flow) || !Number.isFinite(rho) || rho <= 0) return 0;
    return flow * rho;
}

function isSourceUsingFluidBasisTemperature(source) {
    return !source?.props || source.props.temperatureMode !== SOURCE_TEMP_MODE_CUSTOM;
}

function isSourceUsingMassFlow(source) {
    return source?.props?.flowInputMode === SOURCE_FLOW_MODE_MASS;
}

function syncSourceFlowFromInputMode(sourceId) {
    const source = globalModel[sourceId];
    if (!source || source.type !== 'source') return;
    if (!source.props) source.props = {};

    const density = getFluidBasisDensity();
    if (isSourceUsingMassFlow(source)) {
        source.props.flow = calculateSourceVolumetricFlowFromMass(source.props.massFlow, density);
    } else {
        source.props.massFlow = calculateSourceMassFlowFromVolumetric(source.props.flow, density);
    }
}

function normalizeSourceProps(source) {
    if (!source || source.type !== 'source') return;
    if (!source.props) source.props = {};
    if (!source.props.pressureInputBasis) {
        source.props.pressureInputBasis = typeof PRESSURE_INPUT_BASIS_ABSOLUTE !== 'undefined'
            ? PRESSURE_INPUT_BASIS_ABSOLUTE
            : 'Absolute';
    }
    if (!source.props.temperatureMode) {
        source.props.temperatureMode = SOURCE_TEMP_MODE_FLUID_BASIS;
    }
    if (!source.props.flowInputMode) {
        source.props.flowInputMode = SOURCE_FLOW_MODE_MASS;
    }
    if (source.props.pressure === undefined) {
        source.props.pressure = source.props.pressureInputBasis === PRESSURE_INPUT_BASIS_GAUGE ? 0 : 1.013;
    }
    if (source.props.massFlow === undefined) {
        source.props.massFlow = SOURCE_DEFAULT_MASS_FLOW_KGH;
    }
    if (source.props.flow === undefined) {
        source.props.flow = calculateSourceVolumetricFlowFromMass(source.props.massFlow);
    }
    if (source.props.temp === undefined || isSourceUsingFluidBasisTemperature(source)) {
        source.props.temp = getFluidBasisTemperature();
    }
    const sourceId = Object.keys(globalModel).find(nodeId => globalModel[nodeId] === source);
    if (sourceId) syncSourceFlowFromInputMode(sourceId);
}

function normalizeSinkProps(sink) {
    if (!sink || sink.type !== 'sink') return;
    if (!sink.props) sink.props = {};
    if (!sink.props.active) sink.props.active = SINK_ACTIVE;
    if (!sink.props.boundaryMode) sink.props.boundaryMode = SINK_BOUNDARY_MODE_PRESSURE;
    if (!sink.props.pressureInputBasis) {
        sink.props.pressureInputBasis = typeof PRESSURE_INPUT_BASIS_ABSOLUTE !== 'undefined'
            ? PRESSURE_INPUT_BASIS_ABSOLUTE
            : 'Absolute';
    }
    if (!sink.props.pressureBasis) sink.props.pressureBasis = 'Static';
    if (sink.props.pressure === undefined || sink.props.pressure === null || sink.props.pressure === '') {
        sink.props.pressure = sink.props.pressureInputBasis === PRESSURE_INPUT_BASIS_GAUGE ? 0 : 1.013;
    }
    if (sink.props.elevation === undefined || sink.props.elevation === null || sink.props.elevation === '') {
        sink.props.elevation = 0;
    }
    if (sink.props.demandFlow === undefined || sink.props.demandFlow === null || sink.props.demandFlow === '') {
        sink.props.demandFlow = 0;
    }
}

function normalizeAllSinkProps() {
    Object.keys(globalModel).forEach(nodeId => {
        const node = globalModel[nodeId];
        if (node && node.type === 'sink') normalizeSinkProps(node);
    });
}

function syncSourceTemperatureFromFluidBasis(sourceId) {
    const source = globalModel[sourceId];
    if (!source || source.type !== 'source') return;
    normalizeSourceProps(source);
    if (isSourceUsingFluidBasisTemperature(source)) {
        source.props.temp = getFluidBasisTemperature();
    }
}

function syncAllSourceTemperaturesFromFluidBasis() {
    Object.keys(globalModel).forEach(nodeId => {
        if (globalModel[nodeId]?.type === 'source') {
            syncSourceTemperatureFromFluidBasis(nodeId);
            syncSourceFlowFromInputMode(nodeId);
        }
    });
}

function attachSourceToEquipment(sourceId, targetId) {
    const source = globalModel[sourceId];
    if (!source || source.type !== 'source' || !isSourceAttachTarget(targetId)) return;

    sourceLinks = sourceLinks.filter(link => link.sourceId !== sourceId);
    sourceLinks.push({
        sourceId,
        targetId,
        targetPort: '.port.inlet'
    });

    syncSourceAttachmentProps(sourceId);
    cancelPendingConnection(false);
    updateSimulation({ renderSidebarAfter: false });
    selectNode(sourceId, getObjectElement(sourceId));
    drawConnections();
}

function detachSourceFromEquipment(sourceId) {
    const source = globalModel[sourceId];
    if (!source || source.type !== 'source') return;

    sourceLinks = sourceLinks.filter(link => link.sourceId !== sourceId);
    syncSourceAttachmentProps(sourceId);

    if (currentSelectedNode === sourceId) {
        renderSidebar(sourceId);
    }

    drawConnections();
    updateSimulation({ renderSidebarAfter: currentSelectedNode !== null });
}

function detachInstrumentFromPipe(instrumentId) {
    const instrument = globalModel[instrumentId];
    if (!instrument || !isInstrumentType(instrument.type)) return;

    instrumentLinks = instrumentLinks.filter(link => link.instrumentId !== instrumentId);
    if (instrument.props) {
        instrument.props.attachedTo = '';
        instrument.props.measuredValue = null;
        instrument.props.measuredPercent = null;
        instrument.props.measuredPressure = null;
        instrument.props.measuredFlow = null;
        instrument.props.measuredTemperature = null;
        instrument.props.pressureSignal = null;
        instrument.props.flowSignal = null;
        instrument.props.temperatureSignal = null;
    }

    if (typeof updateLineMonitorCanvasReadout === 'function') {
        updateLineMonitorCanvasReadout(instrumentId);
    }

    if (currentSelectedNode === instrumentId) {
        renderSidebar(instrumentId);
    }
    drawConnections();
}

function disconnectPipe(pipeId, options = {}) {
    const { recordHistory = true } = options;
    const hadConnection = connections.some(conn => conn.pipeId === pipeId);
    if (!hadConnection && !globalModel[pipeId]) return;

    if (recordHistory) captureState();

    if (pendingConnectionStart) cancelPendingConnection(false);

    instrumentLinks = instrumentLinks.filter(link => {
        if (link.pipeId !== pipeId) return true;
        const instrument = globalModel[link.instrumentId];
        if (instrument && instrument.props) {
            instrument.props.attachedTo = '';
            instrument.props.measuredValue = null;
            instrument.props.measuredPercent = null;
            instrument.props.measuredPressure = null;
            instrument.props.measuredFlow = null;
            instrument.props.measuredTemperature = null;
            instrument.props.pressureSignal = null;
            instrument.props.flowSignal = null;
            instrument.props.temperatureSignal = null;
        }
        return false;
    });

    connections = connections.filter(conn => conn.pipeId !== pipeId);
    delete globalModel[pipeId];

    if (currentSelectedNode === pipeId) {
        clearSelection();
    }

    drawConnections();
    updateSimulation({ renderSidebarAfter: currentSelectedNode !== null });
}

function deleteNode(nodeId) {
    if (nodeId === 'FLUID' || !globalModel[nodeId]) return;
    
    captureState();

    if (globalModel[nodeId].type === 'pipe') {
        disconnectPipe(nodeId, { recordHistory: false });
        return;
    }
    
    if (globalModel[nodeId].type === 'source') {
        detachSourceFromEquipment(nodeId);
    }

    sourceLinks = sourceLinks.filter(link => link.sourceId !== nodeId && link.targetId !== nodeId);

    Object.keys(globalModel).forEach(id => {
        if (globalModel[id]?.type === 'source') {
            syncSourceAttachmentProps(id);
        }
    });

    if (isInstrumentType(globalModel[nodeId].type)) {
        detachInstrumentFromPipe(nodeId);
    }
    
    const connectedPipes = connections.filter(c => c.from === nodeId || c.to === nodeId).map(c => c.pipeId);
    connectedPipes.forEach(pipeId => disconnectPipe(pipeId, { recordHistory: false }));
    
    delete globalModel[nodeId];
    
    const el = document.getElementById('obj-' + nodeId.toLowerCase().replace(/-/g, ''));
    if (el) el.remove();
    
    if (currentSelectedNode === nodeId) {
        clearSelection();
    }
    
    drawConnections();
    updateSimulation();
}
