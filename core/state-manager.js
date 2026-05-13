// --- Global Data Model ---
let appMode = 'SELECT';
let pendingConnectionStart = null;
let onCanvasMouseMove = null;
let connections = [];
let instrumentLinks = [];
let sourceLinks = [];

const INSTRUMENT_TYPES = ['pressureIndicator', 'flowIndicator', 'temperatureIndicator', 'lineMonitor', 'levelController'];
const SOURCE_TEMP_MODE_FLUID_BASIS = 'Use Fluid Basis';
const SOURCE_TEMP_MODE_CUSTOM = 'Custom';
const SOURCE_FLOW_MODE_VOLUME = 'Volumetric Flow';
const SOURCE_FLOW_MODE_MASS = 'Mass Flow';
const SOURCE_FLOW_MODE_SOLVE = 'Solve from Network';
const SOURCE_TYPE_OPEN_TANK = 'Open Tank / Reservoir';
const SOURCE_TYPE_PRESSURIZED_VESSEL = 'Pressurized Vessel';
const SOURCE_TYPE_EXTERNAL_HEADER = 'External Header / Pipe Tie-in';
const SOURCE_TYPE_FIXED_FLOW = 'Fixed Flow Source';
const SOURCE_TYPE_STANDALONE = 'Standalone Boundary Source';
const SOURCE_TYPE_OPTIONS = [
    SOURCE_TYPE_OPEN_TANK,
    SOURCE_TYPE_PRESSURIZED_VESSEL,
    SOURCE_TYPE_EXTERNAL_HEADER,
    SOURCE_TYPE_FIXED_FLOW,
    SOURCE_TYPE_STANDALONE
];
const SOURCE_TYPE_DESCRIPTIONS = {
    [SOURCE_TYPE_OPEN_TANK]: 'Atmospheric tank/reservoir boundary; may inherit tank pressure and level through a dashed attachment.',
    [SOURCE_TYPE_PRESSURIZED_VESSEL]: 'Closed vessel boundary; may inherit vessel pressure and liquid elevation through a dashed attachment.',
    [SOURCE_TYPE_EXTERNAL_HEADER]: 'External piping/header tie-in with manual pressure, elevation, and static/total pressure basis.',
    [SOURCE_TYPE_FIXED_FLOW]: 'Specified inlet flow boundary; use a solid pipe and review the resulting pressure/head balance.',
    [SOURCE_TYPE_STANDALONE]: 'Generic manual pressure, elevation, temperature, and flow boundary connected by a solid pipe.'
};
const SOURCE_BOUNDARY_DATA_MANUAL = 'Manual';
const SOURCE_BOUNDARY_DATA_INHERIT = 'Inherit from Attached Equipment';
const SOURCE_PRESSURE_ENERGY_STATIC = 'Static Pressure';
const SOURCE_PRESSURE_ENERGY_TOTAL = 'Total / Stagnation Pressure';
const SOURCE_DEFAULT_MASS_FLOW_KGH = 9500;
const SINK_BOUNDARY_MODE_PRESSURE = 'Outlet Pressure';
const SINK_BOUNDARY_MODE_FLOW = 'Flow Demand';
const SINK_ACTIVE = 'Active';
const SINK_INACTIVE = 'Inactive';

const globalModel = {
    "SETTINGS": typeof createDefaultSimulationSettings === 'function'
        ? createDefaultSimulationSettings()
        : {
            type: 'settings',
            name: 'Simulation Settings',
            props: {
                unitStandard: 'Metric / European Engineering',
                basisConfirmed: false,
                basisDirty: false,
                lastConfirmedFluid: '',
                lastConfirmedTemperature: null,
                lastConfirmedUnitStandard: 'Metric / European Engineering',
                migratedFromLegacy: false
            }
        },
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
            vaporPressureHead: 0.011714180554413423,
            speedOfSound: 1427.3
        } 
    }
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
            levelTrend: '-',
            sourceFeedFlow: null,
            sourceFeedFlows: [],
            operatingPressureAbsolute: null,
            operatingPressureGauge: null,
            operatingPressureGaugeMbar: null,
            hydraulicStatus: '-',
            pressureBasis: '-',
            vaporPressure: null,
            liquidVolume: null,
            totalCapacity: null,
            fillPercent: null,
            tankDesignPressure: null,
            designVacuum: null,
            pressureVentSet: null,
            vacuumVentSet: null,
            ventingBasis: '-',
            ventingStatus: '-',
            geometryStatus: '-',
            emergencyVentProvided: '-',
            status: '-',
            warnings: [],
            calculationTrace: null
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
        vaporPressureBasis: null,
        vaporPressureLive: null,
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
    if (!node || !isStorageBoundaryAttachmentTarget(node)) return false;
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
    if (link) {
        link.connectionType = link.connectionType || 'semantic';
        link.attachmentType = link.attachmentType || 'source-boundary';
        link.visualStyle = link.visualStyle || 'dashed';
    }
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

function getSourceEffectiveDensityForFlow(source) {
    const baseDensity = getFluidBasisDensity();
    if (typeof getFluidPropsAtSourceTemperature !== 'function') return baseDensity;

    const fluidProps = getFluidPropsAtSourceTemperature(source, globalModel.FLUID?.props || {});
    const density = parseFloat(fluidProps?.density);
    return Number.isFinite(density) && density > 0 ? density : baseDensity;
}

function isSourceUsingFluidBasisTemperature(source) {
    return !source?.props || source.props.temperatureMode !== SOURCE_TEMP_MODE_CUSTOM;
}

function isSourceUsingMassFlow(source) {
    return source?.props?.flowInputMode === SOURCE_FLOW_MODE_MASS;
}

function isSourceSolvingFlowFromNetwork(source) {
    return source?.props?.flowInputMode === SOURCE_FLOW_MODE_SOLVE;
}

function getDefaultSourceTypeForAttachment(targetNode) {
    if (!targetNode) return SOURCE_TYPE_STANDALONE;
    if (targetNode.type === 'tank') return SOURCE_TYPE_OPEN_TANK;
    if (targetNode.type === 'separator' || targetNode.type === 'verticalVessel') return SOURCE_TYPE_PRESSURIZED_VESSEL;
    return SOURCE_TYPE_STANDALONE;
}

function isSourceTypeSemanticAttachmentCapable(sourceOrType) {
    const sourceType = typeof sourceOrType === 'string'
        ? sourceOrType
        : sourceOrType?.props?.sourceType;
    return sourceType === SOURCE_TYPE_OPEN_TANK || sourceType === SOURCE_TYPE_PRESSURIZED_VESSEL;
}

function isSourceTypeHydraulicBoundary(sourceOrType) {
    return !isSourceTypeSemanticAttachmentCapable(sourceOrType);
}

function getSourceTypeDescription(sourceOrType) {
    const sourceType = typeof sourceOrType === 'string'
        ? sourceOrType
        : sourceOrType?.props?.sourceType;
    return SOURCE_TYPE_DESCRIPTIONS[sourceType]
        || 'Source boundary type used to define the upstream hydraulic condition.';
}

function isStorageBoundaryAttachmentTarget(node) {
    return !!(node && ['tank', 'separator', 'verticalVessel'].includes(node.type));
}

function canSourceInheritBoundaryData(source, attachedNode) {
    return isSourceTypeSemanticAttachmentCapable(source) && isStorageBoundaryAttachmentTarget(attachedNode);
}

function getNextGeneratedPipeId() {
    let pipeNum = 1;
    while (globalModel['PIPE-' + pipeNum]) pipeNum++;
    return 'PIPE-' + pipeNum;
}

function getDefaultHydraulicPipePropsForConversion() {
    if (typeof getDefaultProps === 'function') {
        return getDefaultProps('pipe');
    }

    return {
        routeStyle: 'Straight',
        elevationProfileMode: 'End Elevations',
        startElevation: '',
        endElevation: '',
        highPointElevation: '',
        minorLoss: 0,
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
}

function convertDirectSourceStoragePipeToSemanticAttachment(sourceId) {
    const source = globalModel[sourceId];
    if (!source || source.type !== 'source' || !isSourceTypeSemanticAttachmentCapable(source)) return false;
    if (typeof connections === 'undefined' || !Array.isArray(connections)) return false;

    const convertibleConnections = connections.filter(conn => {
        if (!conn || !conn.pipeId || conn.connectionType === 'semantic') return false;
        if (conn.from === sourceId && isStorageBoundaryAttachmentTarget(globalModel[conn.to])) return true;
        if (conn.to === sourceId && isStorageBoundaryAttachmentTarget(globalModel[conn.from])) return true;
        return false;
    });
    if (convertibleConnections.length === 0) return false;

    const firstConnection = convertibleConnections[0];
    const targetId = firstConnection.from === sourceId ? firstConnection.to : firstConnection.from;
    const targetPort = firstConnection.from === sourceId
        ? (firstConnection.toPort || '.port.inlet')
        : (firstConnection.fromPort || '.port.inlet');
    const convertedPipeIds = new Set(convertibleConnections.map(conn => conn.pipeId).filter(Boolean));

    connections = connections.filter(conn => !convertedPipeIds.has(conn.pipeId));
    convertedPipeIds.forEach(pipeId => {
        if (globalModel[pipeId]?.type === 'pipe') delete globalModel[pipeId];
    });

    sourceLinks = sourceLinks.filter(link => link.sourceId !== sourceId);
    sourceLinks.push({
        sourceId,
        targetId,
        targetPort,
        connectionType: 'semantic',
        attachmentType: 'source-boundary',
        visualStyle: 'dashed'
    });
    source.props.boundaryDataSource = SOURCE_BOUNDARY_DATA_INHERIT;
    return true;
}

function convertSemanticAttachmentToDirectSourcePipe(sourceId) {
    const source = globalModel[sourceId];
    if (!source || source.type !== 'source' || isSourceTypeSemanticAttachmentCapable(source)) return false;
    if (typeof connections === 'undefined' || !Array.isArray(connections)) return false;

    const link = getSourceLink(sourceId);
    if (!link) return false;

    const target = globalModel[link.targetId];
    if (!target) return false;

    const existingConnection = connections.find(conn => conn && conn.pipeId
        && conn.connectionType !== 'semantic'
        && ((conn.from === sourceId && conn.to === link.targetId)
            || (conn.from === link.targetId && conn.to === sourceId)));

    if (!existingConnection) {
        const pipeId = getNextGeneratedPipeId();
        const pipeProps = getDefaultHydraulicPipePropsForConversion();
        pipeProps.routeStyle = pipeProps.routeStyle || 'Straight';

        globalModel[pipeId] = { type: 'pipe', name: pipeId, desc: 'Pipe Line', props: pipeProps };

        const newConnection = {
            from: sourceId,
            fromPort: '.port.outlet',
            to: link.targetId,
            toPort: link.targetPort || '.port.inlet',
            pipeId,
            connectionType: 'hydraulic'
        };
        const orientedConnection = typeof orientHydraulicConnection === 'function'
            ? orientHydraulicConnection(newConnection, globalModel)
            : newConnection;
        if (orientedConnection) connections.push(orientedConnection);
    }

    sourceLinks = sourceLinks.filter(item => item.sourceId !== sourceId);
    source.props.boundaryDataSource = SOURCE_BOUNDARY_DATA_MANUAL;
    return true;
}

function reconcileSourceBoundaryConfiguration(sourceId, options = {}) {
    const source = globalModel[sourceId];
    if (!source || source.type !== 'source') return false;
    if (!source.props) source.props = {};

    const detachInvalidAttachment = options.detachInvalidAttachment !== false;
    let changed = false;
    let link = getSourceLink(sourceId);
    const attachedNode = link ? globalModel[link.targetId] : null;

    if (isSourceTypeSemanticAttachmentCapable(source)) {
        changed = convertDirectSourceStoragePipeToSemanticAttachment(sourceId) || changed;
        link = getSourceLink(sourceId);
    } else {
        changed = convertSemanticAttachmentToDirectSourcePipe(sourceId) || changed;
        link = getSourceLink(sourceId);
    }

    if (link && !isSourceTypeSemanticAttachmentCapable(source) && detachInvalidAttachment) {
        sourceLinks = sourceLinks.filter(item => item.sourceId !== sourceId);
        link = null;
        changed = true;
    }

    const currentAttachedNode = link ? globalModel[link.targetId] : null;
    if (!canSourceInheritBoundaryData(source, currentAttachedNode)
        && source.props.boundaryDataSource === SOURCE_BOUNDARY_DATA_INHERIT) {
        source.props.boundaryDataSource = SOURCE_BOUNDARY_DATA_MANUAL;
        changed = true;
    }

    syncSourceAttachmentProps(sourceId);
    return changed;
}

function reconcileAllSourceBoundaryConfigurations(options = {}) {
    let changed = false;
    Object.keys(globalModel).forEach(nodeId => {
        if (globalModel[nodeId]?.type === 'source') {
            changed = reconcileSourceBoundaryConfiguration(nodeId, options) || changed;
        }
    });
    return changed;
}

function syncSourceFlowFromInputMode(sourceId) {
    const source = globalModel[sourceId];
    if (!source || source.type !== 'source') return;
    if (!source.props) source.props = {};
    if (isSourceSolvingFlowFromNetwork(source)) return;

    const density = getSourceEffectiveDensityForFlow(source);
    if (isSourceUsingMassFlow(source)) {
        source.props.flow = calculateSourceVolumetricFlowFromMass(source.props.massFlow, density);
    } else {
        source.props.massFlow = calculateSourceMassFlowFromVolumetric(source.props.flow, density);
    }
}

function normalizeSourceProps(source) {
    if (!source || source.type !== 'source') return;
    if (!source.props) source.props = {};
    const sourceId = Object.keys(globalModel).find(nodeId => globalModel[nodeId] === source);
    const link = sourceId ? getSourceLink(sourceId) : null;
    const attachedNode = link ? globalModel[link.targetId] : null;

    if (!source.props.sourceType) {
        source.props.sourceType = getDefaultSourceTypeForAttachment(attachedNode);
    }
    if (!source.props.boundaryDataSource) {
        source.props.boundaryDataSource = canSourceInheritBoundaryData(source, attachedNode)
            ? SOURCE_BOUNDARY_DATA_INHERIT
            : SOURCE_BOUNDARY_DATA_MANUAL;
    } else if (!canSourceInheritBoundaryData(source, attachedNode)
        && source.props.boundaryDataSource === SOURCE_BOUNDARY_DATA_INHERIT) {
        source.props.boundaryDataSource = SOURCE_BOUNDARY_DATA_MANUAL;
    }
    if (!source.props.pressureEnergyBasis) {
        source.props.pressureEnergyBasis = SOURCE_PRESSURE_ENERGY_STATIC;
    }
    if (!source.props.pressureInputBasis) {
        source.props.pressureInputBasis = typeof PRESSURE_INPUT_BASIS_GAUGE !== 'undefined'
            ? PRESSURE_INPUT_BASIS_GAUGE
            : 'Gauge';
    }
    if (!source.props.temperatureMode) {
        source.props.temperatureMode = SOURCE_TEMP_MODE_FLUID_BASIS;
    }
    if (!source.props.flowInputMode) {
        source.props.flowInputMode = SOURCE_FLOW_MODE_MASS;
    }
    if (source.props.pressure === undefined) {
        const atm = typeof ATM_PRESSURE_BAR === 'number' ? ATM_PRESSURE_BAR : 1.01325;
        source.props.pressure = source.props.pressureInputBasis === PRESSURE_INPUT_BASIS_GAUGE ? 0 : atm;
    }
    if (source.props.elevation === undefined || source.props.elevation === null || source.props.elevation === '') {
        source.props.elevation = 0;
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
        const atm = typeof ATM_PRESSURE_BAR === 'number' ? ATM_PRESSURE_BAR : 1.01325;
        sink.props.pressure = sink.props.pressureInputBasis === PRESSURE_INPUT_BASIS_GAUGE ? 0 : atm;
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
    if (!isSourceTypeSemanticAttachmentCapable(source)) return;

    sourceLinks = sourceLinks.filter(link => link.sourceId !== sourceId);
    sourceLinks.push({
        sourceId,
        targetId,
        targetPort: '.port.inlet',
        connectionType: 'semantic',
        attachmentType: 'source-boundary',
        visualStyle: 'dashed'
    });

    const attachedNode = globalModel[targetId];
    source.props.sourceType = source.props.sourceType || getDefaultSourceTypeForAttachment(attachedNode);
    source.props.boundaryDataSource = canSourceInheritBoundaryData(source, attachedNode)
        ? SOURCE_BOUNDARY_DATA_INHERIT
        : SOURCE_BOUNDARY_DATA_MANUAL;

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
    if (typeof renderObjectTaskMinimizedDock === 'function') renderObjectTaskMinimizedDock();

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
    if (typeof renderObjectTaskMinimizedDock === 'function') renderObjectTaskMinimizedDock();
    
    drawConnections();
    updateSimulation();
}
