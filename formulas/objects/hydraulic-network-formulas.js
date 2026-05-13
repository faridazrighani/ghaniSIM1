const HYDRAULIC_PASS_THROUGH_TYPES = [
    'valve',
    'checkValve',
    'junction',
    'mixer',
    'heatExchanger',
    'separator',
    'verticalVessel',
    'tank'
];

function toHydraulicNumber(value, fallback = 0) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function getHydraulicGravity() {
    return typeof GRAVITY === 'number' ? GRAVITY : 9.81;
}

function pressureBarToHead(pressureBar, density) {
    const rho = Math.max(toHydraulicNumber(density, 1000), 1);
    return toHydraulicNumber(pressureBar) * 100000 / (rho * getHydraulicGravity());
}

function pressureHeadToBar(pressureHead, density) {
    const rho = Math.max(toHydraulicNumber(density, 1000), 1);
    return toHydraulicNumber(pressureHead) * rho * getHydraulicGravity() / 100000;
}

function getSinkBoundaryModeValue(node) {
    const mode = node?.props?.boundaryMode;
    const freeMode = typeof SINK_BOUNDARY_MODE_FREE !== 'undefined'
        ? SINK_BOUNDARY_MODE_FREE
        : 'Free Outlet / Atmospheric Discharge';
    const pressureMode = typeof SINK_BOUNDARY_MODE_PRESSURE !== 'undefined'
        ? SINK_BOUNDARY_MODE_PRESSURE
        : 'Outlet Pressure Boundary';
    const flowMode = typeof SINK_BOUNDARY_MODE_FLOW !== 'undefined'
        ? SINK_BOUNDARY_MODE_FLOW
        : 'Flow Demand Boundary';

    if (mode === freeMode) return freeMode;
    if (mode === pressureMode || mode === 'Outlet Pressure' || mode === 'Pressure') return pressureMode;
    if (mode === flowMode || mode === 'Flow Demand') return flowMode;

    const pressure = toHydraulicNumber(node?.props?.pressure, NaN);
    if (!mode && Number.isFinite(pressure) && Math.abs(pressure) > 1e-9) return pressureMode;
    return mode || freeMode;
}

function isSinkActiveBoundary(node) {
    return !!(node && node.type === 'sink' && node.props?.active !== 'Inactive');
}

function isSinkFreeOutletBoundary(node) {
    return !!(isSinkActiveBoundary(node) && getSinkBoundaryModeValue(node) === 'Free Outlet / Atmospheric Discharge');
}

function isSinkPressureBoundary(node) {
    return !!(isSinkActiveBoundary(node) && getSinkBoundaryModeValue(node) !== 'Flow Demand Boundary');
}

function isSinkFlowDemandBoundary(node) {
    return !!(isSinkActiveBoundary(node) && getSinkBoundaryModeValue(node) === 'Flow Demand Boundary');
}

function getSinkPressureInputBasis(node) {
    if (isSinkFreeOutletBoundary(node)) return 'Gauge';
    return node?.props?.pressureInputBasis || (typeof PRESSURE_INPUT_BASIS_ABSOLUTE !== 'undefined' ? PRESSURE_INPUT_BASIS_ABSOLUTE : 'Absolute');
}

function getSinkPressureInputValue(node) {
    if (isSinkFreeOutletBoundary(node)) return 0;
    return toHydraulicNumber(node?.props?.pressure, 0);
}

function getSinkPressureBasis(node) {
    if (isSinkFreeOutletBoundary(node)) return 'Static';
    return node?.props?.pressureBasis || 'Static';
}

function getSinkBoundaryAbsolutePressureBar(node) {
    const atm = typeof ATM_PRESSURE_BAR === 'number' ? ATM_PRESSURE_BAR : 1.01325;
    if (!node || !node.props) return null;
    if (isSinkFreeOutletBoundary(node)) return atm;
    const pressure = getSinkPressureInputValue(node);
    const basis = getSinkPressureInputBasis(node);
    if (typeof pressureInputToAbsoluteBar === 'function') {
        return pressureInputToAbsoluteBar(pressure, basis);
    }
    return basis === 'Gauge' ? pressure + atm : pressure;
}

function getPipeVelocityHead(pipeId, flowRateM3H, model, segmentSelector = 'outlet') {
    const pipe = model[pipeId];
    if (!pipe || pipe.type !== 'pipe' || !pipe.props || typeof calculatePipeHydraulicSegments !== 'function') return 0;

    const segments = calculatePipeHydraulicSegments(flowRateM3H, pipe.props);
    if (!segments.length) return 0;

    let segment = segments[segments.length - 1];
    if (segmentSelector === 'inlet') segment = segments[0];
    if (segmentSelector === 'average') {
        const average = segments.reduce((sum, item) => sum + Math.pow(item.velocity, 2) / (2 * getHydraulicGravity()), 0) / segments.length;
        return Number.isFinite(average) ? average : 0;
    }

    const velocityHead = Math.pow(segment.velocity, 2) / (2 * getHydraulicGravity());
    return Number.isFinite(velocityHead) ? velocityHead : 0;
}

function getBoundaryPipeVelocityHead(node, flowRateM3H, path, model) {
    if (!node || !path || !Array.isArray(path.steps) || path.steps.length === 0) return 0;
    const terminalStep = path.steps[path.steps.length - 1];
    if (!terminalStep || (terminalStep.to !== node.name && model[terminalStep.to] !== node)) return 0;
    return getPipeVelocityHead(terminalStep.pipeId, flowRateM3H, model, 'outlet');
}

function isHydraulicPassThroughNode(node) {
    return !!(node && HYDRAULIC_PASS_THROUGH_TYPES.includes(node.type));
}

function getCheckValveDirectionWarning(conn, model) {
    if (!conn || !model) return '';
    const fromNode = model[conn.from];
    const toNode = model[conn.to];

    if (toNode?.type === 'checkValve' && getHydraulicPortRole(conn.toPort) === 'outlet') {
        return `${conn.to} blocks reverse hydraulic flow; connect upstream pipe to the check valve inlet.`;
    }

    if (fromNode?.type === 'checkValve' && getHydraulicPortRole(conn.fromPort) === 'inlet') {
        return `${conn.from} blocks reverse hydraulic flow; connect downstream pipe from the check valve outlet.`;
    }

    return '';
}

function isHydraulicBoundaryNode(node, direction) {
    if (!node) return false;
    if (direction === 'upstream') return node.type === 'source';
    if (direction === 'downstream') return node.type === 'sink' && node.props?.active !== 'Inactive';
    return node.type === 'source' || node.type === 'sink';
}

function getHydraulicPortRole(portSelector = '') {
    if (String(portSelector).includes('.outlet')) return 'outlet';
    if (String(portSelector).includes('.inlet')) return 'inlet';
    return '';
}

function isHydraulicConnectionEdge(conn, model = globalModel) {
    if (!conn || conn.connectionType === 'semantic') return false;
    if (!conn.pipeId) return false;
    return !model || !model[conn.pipeId] || model[conn.pipeId].type === 'pipe';
}

function getSourceLinkForSource(sourceId) {
    if (typeof sourceLinks === 'undefined' || !Array.isArray(sourceLinks)) return null;
    return sourceLinks.find(link => link.sourceId === sourceId) || null;
}

function getSourceLiteral(name, fallback) {
    return typeof window !== 'undefined' && window[name] ? window[name] : fallback;
}

function getSourceTypeValue(source, link = null, model = globalModel) {
    const explicitType = source?.props?.sourceType;
    if (explicitType) return explicitType;
    const targetNode = link ? model[link.targetId] : null;
    if (targetNode?.type === 'tank') return 'Open Tank / Reservoir';
    if (targetNode?.type === 'separator' || targetNode?.type === 'verticalVessel') return 'Pressurized Vessel';
    return 'Standalone Boundary Source';
}

function isSemanticSourceAttachmentType(sourceType) {
    return sourceType === 'Open Tank / Reservoir' || sourceType === 'Pressurized Vessel';
}

function isStorageBoundaryNode(node) {
    return !!(node && (node.type === 'tank' || node.type === 'separator' || node.type === 'verticalVessel'));
}

function getSourceBoundaryDataSource(source, link = null, model = globalModel) {
    if (source?.props?.boundaryDataSource) return source.props.boundaryDataSource;
    const attachedNode = link ? model?.[link.targetId] : null;
    return isStorageBoundaryNode(attachedNode) ? 'Inherit from Attached Equipment' : 'Manual';
}

function isSourceInheritMode(source, link = null, model = globalModel) {
    return getSourceBoundaryDataSource(source, link, model) === 'Inherit from Attached Equipment';
}

function getNodeAbsolutePressureForHydraulics(node) {
    if (!node || !node.props) return null;
    if (typeof getNodeAbsolutePressureBar === 'function') return getNodeAbsolutePressureBar(node);
    const pressure = toHydraulicNumber(node.props.pressure, NaN);
    const basis = node.props.pressureInputBasis || 'Absolute';
    if (!Number.isFinite(pressure)) return null;
    const atm = typeof ATM_PRESSURE_BAR === 'number' ? ATM_PRESSURE_BAR : 1.01325;
    return basis === 'Gauge' ? pressure + atm : pressure;
}

function hasFiniteProp(props, key) {
    return Number.isFinite(parseFloat(props?.[key]));
}

function getStorageLiquidLevelElevation(node) {
    if (!node || !node.props) return null;
    const baseElevation = toHydraulicNumber(node.props.elevation, 0);
    if (!hasFiniteProp(node.props, 'liquidLevel')) return null;
    return baseElevation + toHydraulicNumber(node.props.liquidLevel, 0);
}

function getStorageNozzleElevation(node, portSelector = '') {
    if (!node || !node.props) return 0;
    const role = getHydraulicPortRole(portSelector);
    if (role === 'inlet' && hasFiniteProp(node.props, 'inletNozzleElevation')) {
        return toHydraulicNumber(node.props.inletNozzleElevation, 0);
    }
    if (role === 'outlet' && hasFiniteProp(node.props, 'outletNozzleElevation')) {
        return toHydraulicNumber(node.props.outletNozzleElevation, 0);
    }
    return toHydraulicNumber(node.props.elevation, 0);
}

function getPumpPortElevation(node, portSelector = '') {
    if (!node || !node.props) return 0;
    const role = getHydraulicPortRole(portSelector);
    if (role === 'inlet' && hasFiniteProp(node.props, 'suctionElevation')) {
        return toHydraulicNumber(node.props.suctionElevation, 0);
    }
    if (role === 'outlet' && hasFiniteProp(node.props, 'dischargeElevation')) {
        return toHydraulicNumber(node.props.dischargeElevation, 0);
    }
    return toHydraulicNumber(node.props.elevation, 0);
}

function getNodePortHydraulicElevation(nodeId, portSelector = '', model = globalModel) {
    const node = model ? model[nodeId] : null;
    if (!node || !node.props) return 0;
    if (node.type === 'pump') return getPumpPortElevation(node, portSelector);
    if (node.type === 'tank' || node.type === 'separator' || node.type === 'verticalVessel') {
        return getStorageNozzleElevation(node, portSelector);
    }
    return getNodeHydraulicElevation(node);
}

function orientHydraulicConnection(conn, model = globalModel) {
    if (!isHydraulicConnectionEdge(conn, model)) return null;
    const fromRole = getHydraulicPortRole(conn.fromPort);
    const toRole = getHydraulicPortRole(conn.toPort);

    if (fromRole === 'inlet' && toRole === 'outlet') {
        return {
            ...conn,
            from: conn.to,
            fromPort: conn.toPort,
            to: conn.from,
            toPort: conn.fromPort,
            rawFrom: conn.from,
            rawFromPort: conn.fromPort,
            rawTo: conn.to,
            rawToPort: conn.toPort,
            hydraulicReversed: true
        };
    }

    const fromNode = model ? model[conn.from] : null;
    const toNode = model ? model[conn.to] : null;
    if (fromNode?.type === 'sink' || toNode?.type === 'source') {
        return {
            ...conn,
            from: conn.to,
            fromPort: conn.toPort,
            to: conn.from,
            toPort: conn.fromPort,
            rawFrom: conn.from,
            rawFromPort: conn.fromPort,
            rawTo: conn.to,
            rawToPort: conn.toPort,
            hydraulicReversed: true
        };
    }

    return {
        ...conn,
        rawFrom: conn.from,
        rawFromPort: conn.fromPort,
        rawTo: conn.to,
        rawToPort: conn.toPort,
        hydraulicReversed: false
    };
}

function getAttachedSourceBoundaryIds(nodeId, model) {
    if (typeof sourceLinks === 'undefined' || !Array.isArray(sourceLinks)) return [];
    return sourceLinks
        .filter(item => {
            const source = model[item.sourceId];
            return item.targetId === nodeId
                && item.connectionType !== 'hydraulic'
                && source?.type === 'source'
                && isSemanticSourceAttachmentType(getSourceTypeValue(source, item, model))
                && isStorageBoundaryNode(model[item.targetId]);
        })
        .map(item => item.sourceId);
}

function getAttachedSourceBoundaryId(nodeId, model) {
    const sourceIds = getAttachedSourceBoundaryIds(nodeId, model);
    return sourceIds && sourceIds.length ? sourceIds[0] : null;
}

function getNodeHydraulicElevation(node) {
    if (!node || !node.props) return 0;
    if (node.type === 'tank') {
        return toHydraulicNumber(node.props.elevation) + toHydraulicNumber(node.props.liquidLevel);
    }
    return toHydraulicNumber(node.props.elevation);
}

function resolveSourceBoundaryData(sourceIdOrNode, model = globalModel) {
    const sourceId = typeof sourceIdOrNode === 'string'
        ? sourceIdOrNode
        : Object.keys(model || {}).find(nodeId => model[nodeId] === sourceIdOrNode);
    const source = typeof sourceIdOrNode === 'string' ? model?.[sourceIdOrNode] : sourceIdOrNode;
    if (!source || source.type !== 'source') return null;

    const rawLink = sourceId ? getSourceLinkForSource(sourceId) : null;
    const sourceType = getSourceTypeValue(source, rawLink, model);
    const link = rawLink && isSemanticSourceAttachmentType(sourceType) ? rawLink : null;
    const attachedNode = link ? model?.[link.targetId] : null;
    const useInherited = !!(link && isStorageBoundaryNode(attachedNode) && isSourceInheritMode(source, link, model));
    const pressureNode = useInherited ? attachedNode : source;
    const pressureAbsBar = getNodeAbsolutePressureForHydraulics(pressureNode);
    const warnings = [];

    if (rawLink && !link) {
        warnings.push(`${sourceType} uses a solid hydraulic connection. Dashed attachment is ignored for calculations.`);
    } else if (rawLink && !isStorageBoundaryNode(model?.[rawLink.targetId])) {
        warnings.push('Dashed SRC attachment is only valid to tank/vessel boundaries. This attachment is ignored for hydraulic calculations.');
    }

    let elevation = toHydraulicNumber(source.props?.elevation, 0);
    if (useInherited) {
        const inheritedElevation = getStorageLiquidLevelElevation(attachedNode);
        if (Number.isFinite(inheritedElevation)) {
            elevation = inheritedElevation;
        } else {
            warnings.push('Attached tank/vessel does not define liquid level elevation. Source elevation cannot be inherited.');
        }
    } else if (link && attachedNode && source.props?.boundaryDataSource === 'Inherit from Attached Equipment') {
        warnings.push('Boundary inheritance is only available for attached tank/vessel liquid level sources. Select Manual or attach SRC to a tank/vessel.');
    } else if (link && attachedNode && hasFiniteProp(source.props, 'pressure') && hasFiniteProp(attachedNode.props, 'pressure')) {
        warnings.push('SRC pressure and attached equipment pressure are both defined. Select manual or inherited boundary data.');
    }

    if (!Number.isFinite(pressureAbsBar)) {
        warnings.push('Source boundary pressure is missing or invalid.');
    }
    if (!Number.isFinite(elevation)) {
        warnings.push('Pump suction elevation or source elevation is missing. NPSH may be invalid.');
    }

    return {
        sourceId,
        source,
        sourceType,
        boundaryDataSource: getSourceBoundaryDataSource(source, link, model),
        pressureEnergyBasis: source.props?.pressureEnergyBasis || 'Static Pressure',
        attachedEquipmentId: link?.targetId || '',
        attachedEquipment: attachedNode || null,
        isInherited: useInherited,
        pressureAbsBar,
        elevation,
        warnings
    };
}

function roundSourceTraceNumber(value, digits = 3) {
    const numeric = parseFloat(value);
    if (!Number.isFinite(numeric)) return null;
    return Number(numeric.toFixed(digits));
}

function formatSourceTraceNumber(value, digits = 3) {
    const numeric = parseFloat(value);
    if (!Number.isFinite(numeric)) return '-';
    const abs = Math.abs(numeric);
    if (abs > 0 && abs < 0.001) return numeric.toExponential(6);
    return numeric.toFixed(digits);
}

function createSourceTraceStep(title, formula, substitution, result, unit = '', reference = '') {
    return { title, formula, substitution, result, unit, reference };
}

function getSourceTraceHydraulicConnections(
    sourceId,
    model = (typeof globalModel !== 'undefined' ? globalModel : {}),
    connectionList = (typeof connections !== 'undefined' ? connections : [])
) {
    return (connectionList || [])
        .map(conn => typeof orientHydraulicConnection === 'function' ? orientHydraulicConnection(conn, model) : conn)
        .filter(conn => conn && conn.pipeId && conn.connectionType !== 'semantic' && (conn.from === sourceId || conn.to === sourceId))
        .map(conn => ({
            pipeId: conn.pipeId,
            from: conn.from,
            to: conn.to,
            otherId: conn.from === sourceId ? conn.to : conn.from,
            text: `${conn.pipeId} -> ${conn.from === sourceId ? conn.to : conn.from}`
        }));
}

function getSourceTracePumpPathInfo(
    sourceId,
    model = (typeof globalModel !== 'undefined' ? globalModel : {}),
    connectionList = (typeof connections !== 'undefined' ? connections : []),
    density = 1000,
    vaporPressurePa = 0
) {
    if (typeof createPumpHydraulicContext !== 'function') {
        return { status: 'Not evaluated', pumpId: '', pathText: '-', warnings: [] };
    }

    const source = model?.[sourceId];
    const link = typeof getSourceLinkForSource === 'function' ? getSourceLinkForSource(sourceId) : null;
    const attachedTargetId = link?.targetId || '';
    const pumpIds = Object.keys(model || {}).filter(id => model[id]?.type === 'pump');
    const collectedWarnings = [];

    for (const pumpId of pumpIds) {
        const context = createPumpHydraulicContext(
            pumpId,
            model,
            connectionList,
            Number.isFinite(density) ? density : 1000,
            Number.isFinite(vaporPressurePa) ? vaporPressurePa : 0
        );
        const suctionPath = context?.suctionPath || {};
        const sourceMatches = suctionPath.boundaryId === sourceId;
        const attachedEquipmentMatches = attachedTargetId
            && (suctionPath.boundaryId === attachedTargetId || suctionPath.boundaryAttachmentTargetId === attachedTargetId);
        const warnings = context?.networkWarnings || suctionPath.warnings || [];
        warnings.forEach(warning => {
            if (warning && !collectedWarnings.includes(warning)) collectedWarnings.push(warning);
        });

        if (sourceMatches || attachedEquipmentMatches) {
            const steps = suctionPath.steps || [];
            const pathText = steps.length
                ? steps.map(step => `${step.from} - ${step.pipeId} -> ${step.to}`).join(' | ')
                : (attachedEquipmentMatches ? attachedTargetId : sourceId);
            const semanticSource = source && isSemanticSourceAttachmentType(getSourceTypeValue(source, link, model));
            const boundaryLabel = attachedEquipmentMatches && semanticSource
                ? `Attached equipment ${attachedTargetId}`
                : sourceId;
            return {
                status: context.isComplete ? `Valid to ${pumpId}` : `Incomplete to ${pumpId}`,
                pumpId,
                pathText,
                boundaryLabel,
                warnings
            };
        }
    }

    return {
        status: attachedTargetId
            ? 'Missing path from attached equipment to pump suction'
            : 'Missing hydraulic path to pump suction',
        pumpId: '',
        pathText: '-',
        boundaryLabel: attachedTargetId || sourceId,
        warnings: collectedWarnings
    };
}

function buildSourceCalculationTrace(
    sourceId,
    model = (typeof globalModel !== 'undefined' ? globalModel : {}),
    connectionList = (typeof connections !== 'undefined' ? connections : [])
) {
    const source = model?.[sourceId];
    if (!source || source.type !== 'source') {
        return {
            status: 'SRC not found',
            inputBasis: {},
            readouts: [],
            steps: [],
            warnings: ['SRC object is not available in the active model.'],
            assumptions: [],
            references: []
        };
    }

    const props = source.props || {};
    const fluidProps = model?.FLUID?.props || {};
    const sourceLink = typeof getSourceLinkForSource === 'function' ? getSourceLinkForSource(sourceId) : null;
    const sourceType = getSourceTypeValue(source, sourceLink, model);
    const isSemantic = isSemanticSourceAttachmentType(sourceType);
    const attachedNode = sourceLink ? model?.[sourceLink.targetId] : null;
    const boundary = resolveSourceBoundaryData(sourceId, model);
    const effectiveFluid = typeof getFluidPropsAtSourceTemperature === 'function'
        ? getFluidPropsAtSourceTemperature(source, fluidProps)
        : { ...fluidProps, warnings: [] };
    const density = Math.max(toHydraulicNumber(effectiveFluid.density, 1000), 1);
    const viscosity = toHydraulicNumber(effectiveFluid.viscosity, NaN);
    const vaporPressure = toHydraulicNumber(effectiveFluid.vaporPressure, NaN);
    const temperature = toHydraulicNumber(effectiveFluid.temp ?? props.temp ?? fluidProps.temp, NaN);
    const pressureNode = boundary?.isInherited && boundary.attachedEquipment ? boundary.attachedEquipment : source;
    const pressureInputBasis = typeof getNodePressureInputBasis === 'function'
        ? getNodePressureInputBasis(pressureNode)
        : (pressureNode?.props?.pressureInputBasis || 'Absolute');
    const pressureInput = toHydraulicNumber(pressureNode?.props?.pressure, 0);
    const pressureInputUnit = typeof getPressureInputUnit === 'function'
        ? getPressureInputUnit(pressureInputBasis)
        : (pressureInputBasis === 'Gauge' ? 'bar g' : 'bar a');
    const absolutePressure = boundary?.pressureAbsBar;
    const pressureHead = Number.isFinite(absolutePressure)
        ? pressureBarToHead(absolutePressure, density)
        : null;
    const flowMode = props.flowInputMode || 'Mass Flow';
    const massFlow = toHydraulicNumber(props.massFlow, NaN);
    const volumetricFlow = toHydraulicNumber(props.flow, NaN);
    const calculatedFlow = flowMode === 'Mass Flow' && Number.isFinite(massFlow)
        ? massFlow / density
        : volumetricFlow;
    const calculatedMassFlow = flowMode === 'Volumetric Flow' && Number.isFinite(volumetricFlow)
        ? volumetricFlow * density
        : massFlow;
    const hydraulicConnections = getSourceTraceHydraulicConnections(sourceId, model, connectionList);
    const firstHydraulicConnection = hydraulicConnections[0] || null;
    const velocityHead = sourceType === 'External Header / Pipe Tie-in'
        && (props.pressureEnergyBasis || 'Static Pressure') === 'Static Pressure'
        && firstHydraulicConnection
        && Number.isFinite(calculatedFlow)
            ? getPipeVelocityHead(firstHydraulicConnection.pipeId, calculatedFlow, model, 'inlet')
            : 0;
    const totalSourceHead = Number.isFinite(pressureHead) && Number.isFinite(boundary?.elevation)
        ? pressureHead + boundary.elevation + velocityHead
        : null;
    const pumpPath = getSourceTracePumpPathInfo(sourceId, model, connectionList, density, toHydraulicNumber(vaporPressure, 0) * 100000);
    const warnings = [
        ...(boundary?.warnings || []),
        ...(effectiveFluid?.warnings || []),
        ...(pumpPath.warnings || [])
    ].filter(Boolean);

    if (isSemantic && sourceLink && pumpPath.status.startsWith('Missing')) {
        warnings.push(`${sourceId} is attached to ${sourceLink.targetId}, but no hydraulic path exists from the equipment outlet to the pump suction. Add pipe/hydraulic components to calculate flow and pressure loss.`);
    }
    if (!isSemantic && hydraulicConnections.length === 0) {
        warnings.push(`${sourceType} requires a solid hydraulic pipe/component from the SRC port before flow and pressure loss can be calculated.`);
    }

    const role = isSemantic ? 'Semantic attachment boundary' : 'Hydraulic boundary / tie-in';
    const connectionStyle = isSemantic ? 'Dashed attachment, not hydraulic traversal' : 'Solid hydraulic connection required';
    const steps = [
        createSourceTraceStep(
            'Source role',
            'SRC role = sourceType rule',
            `${sourceType} -> ${connectionStyle}`,
            role,
            '',
            'SRC boundary model: semantic attachment edges are excluded from hydraulic graph traversal'
        )
    ];

    if (pressureInputBasis === 'Gauge') {
        const atm = typeof ATM_PRESSURE_BAR === 'number' ? ATM_PRESSURE_BAR : 1.01325;
        steps.push(createSourceTraceStep(
            'Absolute pressure',
            'Pabs = Pgauge + Patm',
            `${formatSourceTraceNumber(pressureInput)} + ${formatSourceTraceNumber(atm, 5)} = ${formatSourceTraceNumber(absolutePressure)} bar a`,
            roundSourceTraceNumber(absolutePressure, 6),
            'bar a',
            'NIST Guide to the SI Appendix B: 1 standard atmosphere = 101325 Pa = 1.01325 bar'
        ));
    } else {
        steps.push(createSourceTraceStep(
            'Absolute pressure',
            'Pabs = Pabsolute input',
            `${formatSourceTraceNumber(pressureInput)} ${pressureInputUnit}`,
            roundSourceTraceNumber(absolutePressure, 6),
            'bar a',
            'Pressure basis conversion'
        ));
    }

    if (boundary?.isInherited && attachedNode) {
        const baseElevation = toHydraulicNumber(attachedNode.props?.elevation, 0);
        const liquidLevel = toHydraulicNumber(attachedNode.props?.liquidLevel, 0);
        steps.push(createSourceTraceStep(
            'Source elevation',
            'z_source = z_tank base + liquid level',
            `${formatSourceTraceNumber(baseElevation)} + ${formatSourceTraceNumber(liquidLevel)} = ${formatSourceTraceNumber(boundary.elevation)} m`,
            roundSourceTraceNumber(boundary.elevation, 3),
            'm',
            'Tank/vessel liquid level elevation for reservoir/vessel source head'
        ));
    } else {
        steps.push(createSourceTraceStep(
            'Source elevation',
            'z_source = manual SRC elevation',
            `${formatSourceTraceNumber(props.elevation)} m`,
            roundSourceTraceNumber(boundary?.elevation, 3),
            'm',
            'Manual SRC boundary elevation'
        ));
    }

    steps.push(createSourceTraceStep(
        'Pressure head',
        'Hp = Pabs x 100000 / (rho x g)',
        `${formatSourceTraceNumber(absolutePressure, 6)} x 100000 / (${formatSourceTraceNumber(density)} x ${formatSourceTraceNumber(getHydraulicGravity())}) = ${formatSourceTraceNumber(pressureHead)} m`,
        roundSourceTraceNumber(pressureHead, 3),
        'm',
        'Pressure-to-head conversion'
    ));

    if (flowMode === 'Mass Flow') {
        steps.push(createSourceTraceStep(
            'Flow conversion',
            'Q = massFlow / density',
            `${formatSourceTraceNumber(massFlow)} / ${formatSourceTraceNumber(density)} = ${formatSourceTraceNumber(calculatedFlow)} m3/h`,
            roundSourceTraceNumber(calculatedFlow, 3),
            'm3/h',
            'Mass-flow to volumetric-flow conversion using effective SRC density'
        ));
    } else if (flowMode === 'Volumetric Flow') {
        steps.push(createSourceTraceStep(
            'Mass flow conversion',
            'massFlow = Q x density',
            `${formatSourceTraceNumber(volumetricFlow)} x ${formatSourceTraceNumber(density)} = ${formatSourceTraceNumber(calculatedMassFlow)} kg/h`,
            roundSourceTraceNumber(calculatedMassFlow, 3),
            'kg/h',
            'Volumetric-flow to mass-flow conversion using effective SRC density'
        ));
    } else {
        steps.push(createSourceTraceStep(
            'Flow basis',
            'Flow = solved from network',
            'No fixed SRC flow is imposed',
            'Solved from network',
            '',
            'Hydraulic solver flow mode'
        ));
    }

    if (sourceType === 'External Header / Pipe Tie-in') {
        steps.push(createSourceTraceStep(
            'Source velocity head',
            props.pressureEnergyBasis === 'Total / Stagnation Pressure'
                ? 'Hvel = 0 when pressure input is total/stagnation'
                : 'Hvel = v^2 / (2g) for static pressure tie-in',
            props.pressureEnergyBasis === 'Total / Stagnation Pressure'
                ? 'Total/stagnation pressure already includes velocity head'
                : `${firstHydraulicConnection?.pipeId || 'No hydraulic pipe'} inlet velocity head = ${formatSourceTraceNumber(velocityHead)} m`,
            roundSourceTraceNumber(velocityHead, 3),
            'm',
            'Bernoulli total head basis for external pipe tie-in'
        ));
    }

    steps.push(createSourceTraceStep(
        'Source hydraulic head',
        sourceType === 'External Header / Pipe Tie-in' && (props.pressureEnergyBasis || 'Static Pressure') === 'Static Pressure'
            ? 'Hsource = Hp + z_source + Hvel'
            : 'Hsource = Hp + z_source',
        `${formatSourceTraceNumber(pressureHead)} + ${formatSourceTraceNumber(boundary?.elevation)} + ${formatSourceTraceNumber(velocityHead)} = ${formatSourceTraceNumber(totalSourceHead)} m`,
        roundSourceTraceNumber(totalSourceHead, 3),
        'm',
        'Hydraulic energy head used by source boundary calculations'
    ));

    steps.push(createSourceTraceStep(
        'Hydraulic traversal',
        isSemantic ? 'Dashed attachment is excluded from hydraulic graph' : 'Hydraulic graph uses solid pipe/component edges',
        isSemantic
            ? `${sourceId} dashed-attached to ${sourceLink?.targetId || '-'}; pump path starts from attached equipment outlet pipe`
            : hydraulicConnections.map(item => item.text).join(', ') || 'No solid hydraulic pipe from SRC',
        pumpPath.status,
        '',
        'Hydraulic graph traversal rule'
    ));

    const readouts = [
        { label: 'Boundary Pressure Input', value: pressureInput, unit: pressureInputUnit, key: 'source-trace-pressure-input' },
        { label: 'Calculated Abs. Pressure', value: absolutePressure, unit: 'bar a', key: 'source-absolute-pressure' },
        { label: 'Source Elevation', value: boundary?.elevation, unit: 'm', key: 'source-effective-elevation' },
        { label: 'Pressure Head', value: pressureHead, unit: 'm', key: 'source-trace-pressure-head' },
        { label: 'Velocity Head', value: velocityHead, unit: 'm', key: 'source-trace-velocity-head' },
        { label: 'Source Hydraulic Head', value: totalSourceHead, unit: 'm', key: 'source-trace-hydraulic-head' },
        { label: 'Mass Flow', value: calculatedMassFlow, unit: 'kg/h', key: 'source-mass-flow' },
        { label: 'Volumetric Flow', value: calculatedFlow, unit: 'm3/h', key: 'source-flow' },
        { label: 'Temperature', value: temperature, unit: 'deg C', key: 'source-temperature' },
        { label: 'Density Used', value: density, unit: 'kg/m3', key: 'source-fluid-density' },
        { label: 'Kinematic Viscosity', value: viscosity, unit: 'cSt', key: 'source-fluid-viscosity' },
        { label: 'Vapor Pressure', value: vaporPressure, unit: 'bar a', key: 'source-fluid-vapor-pressure' }
    ];
    const dependencyChain = [
        'Source Type -> semantic dashed attachment or solid hydraulic boundary rule.',
        'Boundary Data Source -> manual SRC pressure/elevation or inherited tank/vessel pressure and liquid level elevation.',
        'Pressure Basis -> absolute source pressure; gauge inputs add standard atmosphere.',
        'Absolute pressure + density -> pressure head.',
        'Source elevation + pressure head + optional tie-in velocity head -> source hydraulic head.',
        'Temperature Mode -> effective Fluid Basis density, viscosity, and vapor pressure at SRC conditions.',
        'Density + mass/volume flow input -> converted volumetric or mass flow.',
        'Source Type + connection style -> hydraulic traversal eligibility; dashed SRC attachment is excluded from hydraulic path calculation.',
        'Vapor pressure and source hydraulic head feed pump NPSHA through the pump calculation trace.'
    ];

    return {
        status: warnings.length ? 'Review' : 'OK',
        inputBasis: {
            sourceId,
            sourceType,
            role,
            connectionStyle,
            boundaryDataSource: boundary?.boundaryDataSource || props.boundaryDataSource || 'Manual',
            attachedEquipment: boundary?.attachedEquipmentId || sourceLink?.targetId || '-',
            pressureInputBasis,
            pressureEnergyBasis: props.pressureEnergyBasis || 'Static Pressure',
            temperatureMode: props.temperatureMode || 'Use Fluid Basis',
            flowInputMode: flowMode,
            unitStandard: typeof getUnitStandard === 'function' ? getUnitStandard() : 'Internal metric engineering units',
            hydraulicPipes: hydraulicConnections.map(item => item.text),
            pumpPathStatus: pumpPath.status,
            pumpPath: pumpPath.pathText
        },
        dependencyChain,
        boundary: {
            pressureInput,
            pressureInputUnit,
            absolutePressureBar: roundSourceTraceNumber(absolutePressure, 6),
            elevation: roundSourceTraceNumber(boundary?.elevation, 3),
            pressureHead: roundSourceTraceNumber(pressureHead, 3),
            velocityHead: roundSourceTraceNumber(velocityHead, 3),
            totalSourceHead: roundSourceTraceNumber(totalSourceHead, 3)
        },
        readouts,
        steps,
        warnings: [...new Set(warnings)],
        assumptions: [
            'SRC is a hydraulic boundary definition, not a pipe or pressure-loss element.',
            'Dashed SRC attachment does not create hydraulic traversal or pressure drop.',
            'Open tank/reservoir surface velocity head is neglected unless the SRC is modeled as an External Header static-pressure tie-in.'
        ],
        references: [
            'pdf_ref/ref4-standar_ANSI-9-6-2024_rotodynamic_pump_guidline_for_NPSH_margin-hydraulic-institute.pdf: NPSHA terms, vapor pressure head, suction velocity head, suction loss, and datum concept.',
            'pdf_ref/ref1-fluid-mechanics-fundaments-and-applications.pdf: pressure head, Bernoulli/energy balance, specific weight, and head-loss fundamentals.',
            'pdf_ref/ref2-introduction-fluid-mechanics.pdf: Bernoulli equation and incompressible steady-flow energy balance.',
            'pdf_ref/ref3-cavitations_and_centrifugal_pump_book_edward.pdf: cavitation/NPSH context for centrifugal pump suction.',
            'NIST Guide to the SI Appendix B: 1 standard atmosphere = 101325 Pa exactly; NASA Glenn Bernoulli page: static pressure plus dynamic pressure forms total pressure for the external-header pressure basis.',
            'Flow conversion uses effective SRC density from active Fluid Basis or custom SRC temperature calculation.'
        ]
    };
}

function roundSinkTraceNumber(value, digits = 3) {
    return roundSourceTraceNumber(value, digits);
}

function formatSinkTraceNumber(value, digits = 3) {
    return formatSourceTraceNumber(value, digits);
}

function createSinkTraceStep(title, formula, substitution, result, unit = '', reference = '') {
    return { title, formula, substitution, result, unit, reference };
}

function getSinkTraceHydraulicConnections(
    sinkId,
    model = (typeof globalModel !== 'undefined' ? globalModel : {}),
    connectionList = (typeof connections !== 'undefined' ? connections : [])
) {
    return (connectionList || [])
        .map(conn => typeof orientHydraulicConnection === 'function' ? orientHydraulicConnection(conn, model) : conn)
        .filter(conn => conn && conn.pipeId && conn.connectionType !== 'semantic' && (conn.from === sinkId || conn.to === sinkId))
        .map(conn => ({
            pipeId: conn.pipeId,
            from: conn.from,
            to: conn.to,
            otherId: conn.from === sinkId ? conn.to : conn.from,
            text: `${conn.from === sinkId ? conn.to : conn.from} -> ${conn.pipeId}`
        }));
}

function getSinkTracePipeFlow(pipe, fallback = null) {
    const flow = toHydraulicNumber(pipe?.results?.flow, NaN);
    return Number.isFinite(flow) && (pipe?.results?.pressureCalculated || flow > 0) ? flow : fallback;
}

function getSinkTracePipeStaticPressure(pipe, conn, sinkId) {
    if (typeof getPipePressureForNodeSide === 'function') {
        return getPipePressureForNodeSide(pipe, conn || {}, sinkId);
    }
    if (!pipe?.results || !conn) return null;
    if (conn.to === sinkId) return toHydraulicNumber(pipe.results.outletPressure, NaN);
    if (conn.from === sinkId) return toHydraulicNumber(pipe.results.inletPressure, NaN);
    return toHydraulicNumber(pipe.results.pressure, NaN);
}

function getSinkTracePipeStagnationPressure(pipe, conn, sinkId, density, velocityHead = 0) {
    if (typeof getPipeStagnationPressureForNodeSide === 'function') {
        return getPipeStagnationPressureForNodeSide(pipe, conn || {}, sinkId);
    }
    const staticPressure = getSinkTracePipeStaticPressure(pipe, conn, sinkId);
    if (!Number.isFinite(staticPressure)) return null;
    return staticPressure + pressureHeadToBar(velocityHead, density);
}

function getSinkTracePumpPathInfo(
    sinkId,
    model = (typeof globalModel !== 'undefined' ? globalModel : {}),
    connectionList = (typeof connections !== 'undefined' ? connections : []),
    density = 1000,
    vaporPressurePa = 0
) {
    if (typeof createPumpHydraulicContext !== 'function') {
        return { status: 'Not evaluated', pumpId: '', pathText: '-', warnings: [], role: 'Downstream boundary not evaluated' };
    }

    const pumpIds = Object.keys(model || {}).filter(id => model[id]?.type === 'pump');
    const collectedWarnings = [];

    for (const pumpId of pumpIds) {
        const context = createPumpHydraulicContext(
            pumpId,
            model,
            connectionList,
            Number.isFinite(density) ? density : 1000,
            Number.isFinite(vaporPressurePa) ? vaporPressurePa : 0
        );
        const dischargePath = context?.dischargePath || {};
        const warnings = context?.networkWarnings || dischargePath.warnings || [];
        warnings.forEach(warning => {
            if (warning && !collectedWarnings.includes(warning)) collectedWarnings.push(warning);
        });

        if (dischargePath.boundaryId === sinkId) {
            const steps = dischargePath.steps || [];
            const pathText = steps.length
                ? steps.map(step => `${step.from} - ${step.pipeId} -> ${step.to}`).join(' | ')
                : sinkId;
            const pump = model[pumpId];
            const flow = toHydraulicNumber(pump?.results?.flow, NaN);
            const head = toHydraulicNumber(pump?.results?.head, NaN);
            const npsha = toHydraulicNumber(pump?.results?.npsha, NaN);
            const npshr = toHydraulicNumber(pump?.results?.npshr, NaN);
            const npshMargin = toHydraulicNumber(pump?.results?.npshMargin, NaN);
            const npshRatio = toHydraulicNumber(pump?.results?.npshRatio, NaN);
            return {
                status: context.isComplete ? `Valid from ${pumpId}` : `Incomplete from ${pumpId}`,
                pumpId,
                pathText,
                role: 'Discharge fluid-out boundary for pump operating point and NPSH check',
                flow: Number.isFinite(flow) ? flow : null,
                head: Number.isFinite(head) ? head : null,
                npsha: Number.isFinite(npsha) ? npsha : null,
                npshr: Number.isFinite(npshr) ? npshr : null,
                npshMargin: Number.isFinite(npshMargin) ? npshMargin : null,
                npshRatio: Number.isFinite(npshRatio) ? npshRatio : null,
                cavitationStatus: pump?.results?.cavitationStatus || '-',
                warnings
            };
        }
    }

    return {
        status: 'Missing hydraulic path from pump discharge',
        pumpId: '',
        pathText: '-',
        role: 'Downstream boundary not connected to a pump discharge path',
        warnings: collectedWarnings
    };
}

function buildSinkCalculationTrace(
    sinkId,
    model = (typeof globalModel !== 'undefined' ? globalModel : {}),
    connectionList = (typeof connections !== 'undefined' ? connections : [])
) {
    const sink = model?.[sinkId];
    if (!sink || sink.type !== 'sink') {
        return {
            status: 'SNK not found',
            inputBasis: {},
            readouts: [],
            steps: [],
            warnings: ['SNK object is not available in the active model.'],
            assumptions: [],
            references: []
        };
    }

    const props = sink.props || {};
    const fluidProps = model?.FLUID?.props || {};
    const density = Math.max(toHydraulicNumber(fluidProps.density, 1000), 1);
    const temperature = toHydraulicNumber(fluidProps.temp, NaN);
    const vaporPressureBar = toHydraulicNumber(fluidProps.vaporPressure, NaN);
    const vaporPressurePa = Number.isFinite(vaporPressureBar) ? vaporPressureBar * 100000 : 0;
    const mode = getSinkBoundaryModeValue(sink);
    const pressureInputBasis = getSinkPressureInputBasis(sink);
    const pressureInputUnit = typeof getPressureInputUnit === 'function'
        ? getPressureInputUnit(pressureInputBasis)
        : (pressureInputBasis === 'Gauge' ? 'bar g' : 'bar a');
    const pressureInput = getSinkPressureInputValue(sink);
    const pressureBasis = getSinkPressureBasis(sink);
    const boundaryPressureAbs = getSinkBoundaryAbsolutePressureBar(sink);
    const elevation = getNodeHydraulicElevation(sink);
    const pressureHead = Number.isFinite(boundaryPressureAbs)
        ? pressureBarToHead(boundaryPressureAbs, density)
        : null;
    const hydraulicConnections = getSinkTraceHydraulicConnections(sinkId, model, connectionList);
    const firstHydraulicConnection = hydraulicConnections[0] || null;
    const pipe = firstHydraulicConnection ? model[firstHydraulicConnection.pipeId] : null;
    const demandFlow = Math.max(0, toHydraulicNumber(props.demandFlow, 0));
    const flow = getSinkTracePipeFlow(pipe, isSinkFlowDemandBoundary(sink) ? demandFlow : null);
    const terminalPath = firstHydraulicConnection ? { steps: [firstHydraulicConnection] } : null;
    const terminalVelocityHead = pressureBasis === 'Static' && Number.isFinite(flow)
        ? getBoundaryPipeVelocityHead(sink, flow, terminalPath, model)
        : 0;
    const staticPressure = getSinkTracePipeStaticPressure(pipe, firstHydraulicConnection, sinkId);
    const stagnationPressure = getSinkTracePipeStagnationPressure(pipe, firstHydraulicConnection, sinkId, density, terminalVelocityHead);
    const calculatedPressure = pressureBasis === 'Stagnation' ? stagnationPressure : staticPressure;
    const pressureResidual = isSinkPressureBoundary(sink)
        && Number.isFinite(calculatedPressure)
        && Number.isFinite(boundaryPressureAbs)
            ? calculatedPressure - boundaryPressureAbs
            : null;
    const hydraulicHead = isSinkFlowDemandBoundary(sink) || !Number.isFinite(pressureHead)
        ? null
        : pressureHead + elevation + (pressureBasis === 'Static' ? terminalVelocityHead : 0);
    const massFlow = Number.isFinite(flow) ? flow * density : null;
    const pumpPath = getSinkTracePumpPathInfo(sinkId, model, connectionList, density, vaporPressurePa);
    const warnings = [];
    if (props.active === 'Inactive') warnings.push('SNK is inactive and is excluded from the hydraulic boundary solution.');
    if (!hydraulicConnections.length) warnings.push('SNK has no solid hydraulic pipe connection.');
    if (hydraulicConnections.length > 1 && pressureBasis === 'Static') {
        warnings.push('Static discharge boundary should normally connect to one terminal pipe. Use Stagnation only for reservoir/header style total-pressure boundary behavior.');
    }
    if (isSinkFlowDemandBoundary(sink) && demandFlow <= 0) warnings.push('Flow Demand Boundary requires a positive demand flow.');
    if (isSinkPressureBoundary(sink) && Number.isFinite(pressureResidual) && Math.abs(pressureResidual) > 0.02) {
        warnings.push('Pressure residual exceeds 0.02 bar; review pump operating point, discharge losses, or boundary pressure basis.');
    }
    if (!isSinkFreeOutletBoundary(sink) && pressureInputBasis === 'Absolute' && Number.isFinite(boundaryPressureAbs) && boundaryPressureAbs <= 0) {
        warnings.push('Outlet pressure is at or below 0 bar a. Use 0 bar g or 1.01325 bar a for atmospheric discharge.');
    }
    if (Number.isFinite(calculatedPressure) && Number.isFinite(vaporPressureBar) && calculatedPressure <= vaporPressureBar) {
        warnings.push('Calculated outlet pressure is at or below the active fluid vapor pressure.');
    }
    (pumpPath.warnings || []).forEach(warning => {
        if (warning && !warnings.includes(warning)) warnings.push(warning);
    });

    const steps = [];
    steps.push(createSinkTraceStep(
        'SNK boundary role',
        'SNK = downstream Fluid Out Boundary',
        `${sinkId} uses ${mode}`,
        mode,
        '',
        'Boundary condition definition for pump discharge network solution'
    ));
    steps.push(createSinkTraceStep(
        'Outlet pressure basis',
        isSinkFreeOutletBoundary(sink)
            ? 'Pout,abs = Patm'
            : 'Pout,abs = Pinput + Patm when gauge; Pout,abs = Pinput when absolute',
        isSinkFreeOutletBoundary(sink)
            ? 'Free outlet imposes 0 bar g = 1.01325 bar a'
            : `${formatSinkTraceNumber(pressureInput)} ${pressureInputUnit}, basis = ${pressureInputBasis}`,
        roundSinkTraceNumber(boundaryPressureAbs, 6),
        'bar a',
        'NIST standard atmosphere and pressure head convention'
    ));
    steps.push(createSinkTraceStep(
        'Outlet pressure head',
        'Hp = Pabs x 100000 / (rho x g)',
        `${formatSinkTraceNumber(boundaryPressureAbs, 6)} bar a, rho = ${formatSinkTraceNumber(density)} kg/m3`,
        roundSinkTraceNumber(pressureHead, 3),
        'm',
        'Bernoulli pressure-head term'
    ));
    steps.push(createSinkTraceStep(
        'Outlet elevation head',
        'zSNK = user specified outlet elevation',
        `${sinkId} elevation = ${formatSinkTraceNumber(elevation)} m`,
        roundSinkTraceNumber(elevation, 3),
        'm',
        'Hydraulic datum/elevation term'
    ));
    steps.push(createSinkTraceStep(
        'Terminal velocity head',
        pressureBasis === 'Static'
            ? 'Hvel = v^2 / (2g)'
            : 'Hvel = 0 when boundary pressure is stagnation/total pressure',
        pressureBasis === 'Static'
            ? `${firstHydraulicConnection?.pipeId || 'No terminal pipe'} outlet velocity head = ${formatSinkTraceNumber(terminalVelocityHead)} m`
            : 'Stagnation pressure already includes velocity head',
        roundSinkTraceNumber(terminalVelocityHead, 3),
        'm',
        'Bernoulli static-to-total pressure relation'
    ));
    steps.push(createSinkTraceStep(
        isSinkFlowDemandBoundary(sink) ? 'Flow demand specification' : 'SNK hydraulic head',
        isSinkFlowDemandBoundary(sink)
            ? 'Qpump = Qdemand; required discharge pressure is solved from pump head and discharge losses'
            : (pressureBasis === 'Static' ? 'HSNK = Hp + zSNK + Hvel' : 'HSNK = Hp + zSNK'),
        isSinkFlowDemandBoundary(sink)
            ? `Qdemand = ${formatSinkTraceNumber(demandFlow)} m3/h`
            : `${formatSinkTraceNumber(pressureHead)} + ${formatSinkTraceNumber(elevation)} + ${formatSinkTraceNumber(terminalVelocityHead)} = ${formatSinkTraceNumber(hydraulicHead)} m`,
        isSinkFlowDemandBoundary(sink) ? roundSinkTraceNumber(demandFlow, 3) : roundSinkTraceNumber(hydraulicHead, 3),
        isSinkFlowDemandBoundary(sink) ? 'm3/h' : 'm',
        'Pump/system operating point and downstream boundary energy balance'
    ));
    steps.push(createSinkTraceStep(
        'Pump and NPSH influence',
        'SNK changes discharge system head or imposed flow, which moves the pump operating point',
        pumpPath.pumpId
            ? `${pumpPath.pumpId}: Q = ${formatSinkTraceNumber(pumpPath.flow)} m3/h, H = ${formatSinkTraceNumber(pumpPath.head)} m, NPSHA = ${formatSinkTraceNumber(pumpPath.npsha)} m, NPSHR = ${formatSinkTraceNumber(pumpPath.npshr)} m`
            : pumpPath.status,
        pumpPath.cavitationStatus || pumpPath.status,
        '',
        'Hydraulic Institute NPSH margin guidance and pump curve operating point method'
    ));

    const readouts = [
        { label: 'Boundary Mode', value: mode, unit: '', key: 'sink-trace-boundary-mode', kind: 'text' },
        { label: 'Boundary Pressure Input', value: pressureInput, unit: pressureInputUnit, key: 'sink-trace-pressure-input' },
        { label: 'Boundary Abs. Pressure', value: boundaryPressureAbs, unit: 'bar a', key: 'sink-boundary-pressure' },
        { label: 'SNK Elevation', value: elevation, unit: 'm', key: 'sink-trace-elevation' },
        { label: 'Pressure Head', value: pressureHead, unit: 'm', key: 'sink-trace-pressure-head' },
        { label: 'Terminal Velocity Head', value: terminalVelocityHead, unit: 'm', key: 'sink-trace-velocity-head' },
        { label: 'SNK Hydraulic Head', value: hydraulicHead, unit: 'm', key: 'sink-hydraulic-head' },
        { label: 'Flow Rate', value: flow, unit: 'm3/h', key: 'sink-flow' },
        { label: 'Mass Flow', value: massFlow, unit: 'kg/h', key: 'sink-mass-flow' },
        { label: 'Static Pipe Pressure', value: staticPressure, unit: 'bar a', key: 'sink-static-pressure' },
        { label: 'Stagnation Pressure', value: stagnationPressure, unit: 'bar a', key: 'sink-stagnation-pressure' },
        { label: isSinkFlowDemandBoundary(sink) ? 'Required Boundary P' : 'Pressure Residual', value: isSinkFlowDemandBoundary(sink) ? calculatedPressure : pressureResidual, unit: isSinkFlowDemandBoundary(sink) ? 'bar a' : 'bar', key: isSinkFlowDemandBoundary(sink) ? 'sink-calculated-pressure' : 'sink-pressure-residual' },
        { label: 'Temperature', value: temperature, unit: 'deg C', key: 'sink-temperature' },
        { label: 'Density Used', value: density, unit: 'kg/m3', key: 'sink-fluid-density' },
        { label: 'Vapor Pressure', value: vaporPressureBar, unit: 'bar a', key: 'sink-fluid-vapor-pressure' },
        { label: 'Pump NPSHA', value: pumpPath.npsha, unit: 'm', key: 'sink-pump-npsha' },
        { label: 'Pump NPSHR', value: pumpPath.npshr, unit: 'm', key: 'sink-pump-npshr' },
        { label: 'NPSH Margin', value: pumpPath.npshMargin, unit: 'm', key: 'sink-pump-npsh-margin' },
        { label: 'NPSH Ratio', value: pumpPath.npshRatio, unit: '', key: 'sink-pump-npsh-ratio' }
    ];

    const dependencyChain = [
        'SNK Active state -> determines whether the downstream boundary participates in hydraulic solving.',
        'Boundary Mode -> selects atmospheric pressure, specified outlet pressure, or imposed discharge flow.',
        'Pressure Basis -> gauge/absolute conversion to absolute pressure; free outlet fixes 0 bar g / 1.01325 bar a.',
        'Outlet elevation + pressure head + optional velocity head -> downstream boundary head.',
        'Pipe/fitting/valve/equipment configuration upstream of SNK -> discharge loss seen by the pump.',
        'For pressure/free outlet modes, pump flow is obtained from the pump curve and system curve intersection.',
        'For flow demand mode, pump flow is imposed and required discharge pressure/head is reported as the consequence.',
        'Changed pump flow changes suction losses and NPSHR; changed suction losses directly affect NPSHA.',
        'Fluid Basis density and vapor pressure remain the thermodynamic basis for NPSHA and cavitation margin.'
    ];

    return {
        status: warnings.length ? 'Review' : 'OK',
        inputBasis: {
            sinkId,
            boundaryRole: 'Fluid Out Boundary',
            boundaryMode: mode,
            active: props.active || 'Active',
            pressureInputBasis,
            pressureBasis,
            unitStandard: typeof getUnitStandard === 'function' ? getUnitStandard() : 'Internal metric engineering units',
            hydraulicPipes: hydraulicConnections.map(item => item.text),
            pumpPathStatus: pumpPath.status,
            pumpPath: pumpPath.pathText,
            pumpImpactRole: pumpPath.role
        },
        dependencyChain,
        boundary: {
            pressureInput,
            pressureInputUnit,
            absolutePressureBar: roundSinkTraceNumber(boundaryPressureAbs, 6),
            elevation: roundSinkTraceNumber(elevation, 3),
            pressureHead: roundSinkTraceNumber(pressureHead, 3),
            velocityHead: roundSinkTraceNumber(terminalVelocityHead, 3),
            hydraulicHead: roundSinkTraceNumber(hydraulicHead, 3),
            demandFlow: roundSinkTraceNumber(demandFlow, 3)
        },
        pumpImpact: {
            pumpId: pumpPath.pumpId,
            flow: pumpPath.flow,
            head: pumpPath.head,
            npsha: pumpPath.npsha,
            npshr: pumpPath.npshr,
            npshMargin: pumpPath.npshMargin,
            npshRatio: pumpPath.npshRatio,
            cavitationStatus: pumpPath.cavitationStatus,
            explanation: isSinkFlowDemandBoundary(sink)
                ? 'Flow demand fixes the operating flow. The application then evaluates whether the pump curve can provide the head and NPSH margin at that flow.'
                : 'Downstream pressure/elevation/losses define system head. The pump operating point shifts to the pump curve and system curve intersection.'
        },
        readouts,
        steps,
        warnings: [...new Set(warnings)],
        assumptions: [
            'SNK is a boundary condition for fluid leaving the modeled network; it is not itself a pressure-loss element.',
            'Discharge restriction is calculated from modeled pipes, fittings, valves, vessels, and heat exchangers, not from the SNK label alone.',
            'Free outlet represents atmospheric discharge at the outlet plane with 0 bar gauge pressure.',
            'NPSHA is evaluated on the suction side, but SNK can still change NPSHA indirectly by moving the pump operating flow and suction-side losses.'
        ],
        references: [
            'pdf_ref/ref4-standar_ANSI-9-6-2024_rotodynamic_pump_guidline_for_NPSH_margin-hydraulic-institute.pdf: NPSHA, NPSHR, NPSH margin, and pump operating margin guidance.',
            'pdf_ref/ref1-fluid-mechanics-fundaments-and-applications.pdf: Bernoulli equation, pressure head, elevation head, velocity head, and head-loss fundamentals.',
            'pdf_ref/ref2-introduction-fluid-mechanics.pdf: steady incompressible flow energy equation and pressure boundary interpretation.',
            'pdf_ref/ref3-cavitations_and_centrifugal_pump_book_edward.pdf: centrifugal pump cavitation and suction-condition interpretation.',
            'NIST Guide to the SI Appendix B: 1 standard atmosphere = 101325 Pa exactly; NASA Glenn Bernoulli page: static plus dynamic pressure forms stagnation pressure.'
        ]
    };
}

function getSourceVelocityHeadForBoundary(source, flowRateM3H, path, model) {
    const sourceId = Object.keys(model || {}).find(nodeId => model[nodeId] === source) || source?.name;
    const sourceType = getSourceTypeValue(source, getSourceLinkForSource(sourceId), model);
    const isExternalHeader = sourceType === 'External Header / Pipe Tie-in';
    const isStaticBasis = (source?.props?.pressureEnergyBasis || 'Static Pressure') === 'Static Pressure';
    if (!isExternalHeader || !isStaticBasis || !path?.steps?.length) return 0;

    const firstStep = path.steps[0];
    return getPipeVelocityHead(firstStep.pipeId, flowRateM3H, model, 'inlet');
}

function getBoundaryHydraulicHead(node, density, flowRateM3H = 0, path = null, model = globalModel) {
    if (!node || !node.props) return null;
    if (isSinkFlowDemandBoundary(node)) return null;

    if (node.type === 'source') {
        const boundary = resolveSourceBoundaryData(node, model);
        if (!boundary || !Number.isFinite(boundary.pressureAbsBar)) return null;
        const velocityHead = getSourceVelocityHeadForBoundary(node, flowRateM3H, path, model);
        return pressureBarToHead(boundary.pressureAbsBar, density) + boundary.elevation + velocityHead;
    }

    const boundaryPressure = node.type === 'sink' && typeof getSinkBoundaryAbsolutePressureBar === 'function'
        ? getSinkBoundaryAbsolutePressureBar(node)
        : (typeof getNodeAbsolutePressureBar === 'function'
            ? getNodeAbsolutePressureBar(node)
            : node.props.pressure);
    const pressureHead = pressureBarToHead(boundaryPressure, density);
    let boundaryHead = pressureHead + getNodeHydraulicElevation(node);

    if (node.type === 'sink' && getSinkPressureBasis(node) === 'Static') {
        boundaryHead += getBoundaryPipeVelocityHead(node, flowRateM3H, path, model);
    }

    return boundaryHead;
}

function getBoundaryAbsolutePressureWarnings(node, label) {
    if (!node || !node.props) return [];
    if (node.type === 'sink' && isSinkFreeOutletBoundary(node)) return [];
    const pressureInputBasis = node.type === 'sink' && typeof getSinkPressureInputBasis === 'function'
        ? getSinkPressureInputBasis(node)
        : node.props.pressureInputBasis;
    if (pressureInputBasis !== PRESSURE_INPUT_BASIS_ABSOLUTE) return [];
    const sourceBoundary = node.type === 'source' ? resolveSourceBoundaryData(node, globalModel) : null;
    const absolutePressure = node.type === 'sink' && typeof getSinkBoundaryAbsolutePressureBar === 'function'
        ? getSinkBoundaryAbsolutePressureBar(node)
        : sourceBoundary
        ? sourceBoundary.pressureAbsBar
        : (typeof getNodeAbsolutePressureBar === 'function'
            ? getNodeAbsolutePressureBar(node)
            : toHydraulicNumber(node.props.pressure, NaN));
    if (Number.isFinite(absolutePressure) && absolutePressure <= 0) {
        return [`${label} pressure is 0 bar a/vacuum absolute; use 0 bar g or 1.01325 bar a for atmospheric service.`];
    }
    return [];
}

function traceHydraulicPath(startNodeId, direction, model, connectionList) {
    const reverseSearch = direction === 'upstream';
    const traversed = [];
    const warnings = [];
    const visitedNodes = new Set([startNodeId]);
    const visitedPipes = new Set();
    let currentId = startNodeId;
    let boundaryId = null;
    let boundaryAttachmentTargetId = null;
    const hydraulicConnections = (connectionList || [])
        .map(conn => orientHydraulicConnection(conn, model))
        .filter(Boolean);
    const finalize = (overrides = {}) => ({
        direction,
        boundaryId,
        boundaryAttachmentTargetId,
        steps: reverseSearch ? traversed.slice().reverse() : traversed.slice(),
        isComplete: !!boundaryId && !overrides.isUnsupported,
        warnings: [...warnings, ...(overrides.warnings || [])],
        isUnsupported: !!overrides.isUnsupported,
        isBranched: !!overrides.isBranched
    });
    const resolveUpstreamBoundaryAtNode = (nodeId) => {
        const node = model[nodeId];
        if (isStorageBoundaryNode(node)) {
            boundaryId = nodeId;
            boundaryAttachmentTargetId = nodeId;
            return finalize();
        }

        const attachedSourceIds = getAttachedSourceBoundaryIds(nodeId, model) || [];
        if (attachedSourceIds.length > 1) {
            return finalize({
                isUnsupported: true,
                isBranched: true,
                warnings: [`Multiple SRC boundaries are attached to ${nodeId}; multi-source suction networks require a nodal solver.`]
            });
        }
        if (attachedSourceIds.length === 1) {
            boundaryId = attachedSourceIds[0];
            boundaryAttachmentTargetId = nodeId;
            return finalize();
        }
        return null;
    };

    for (let stepCount = 0; stepCount < 80; stepCount++) {
        if (reverseSearch && currentId !== startNodeId) {
            const boundary = resolveUpstreamBoundaryAtNode(currentId);
            if (boundary) return boundary;
        }

        const candidates = hydraulicConnections.filter(conn => (
            reverseSearch ? conn.to === currentId : conn.from === currentId
        )).filter(item => !visitedPipes.has(item.pipeId));

        if (candidates.length > 1) {
            return finalize({
                isUnsupported: true,
                isBranched: true,
                warnings: [`Branched ${direction} hydraulic network at ${currentId}; this solver supports one series path per pump.`]
            });
        }

        const conn = candidates[0];
        if (!conn) break;

        const checkValveWarning = getCheckValveDirectionWarning(conn, model);
        if (checkValveWarning) {
            return finalize({
                isUnsupported: true,
                warnings: [checkValveWarning]
            });
        }

        traversed.push({
            pipeId: conn.pipeId,
            from: conn.from,
            fromPort: conn.fromPort,
            to: conn.to,
            toPort: conn.toPort
        });
        visitedPipes.add(conn.pipeId);

        const nextId = reverseSearch ? conn.from : conn.to;
        const nextNode = model[nextId];
        if (!nextNode) break;

        if (reverseSearch) {
            const boundary = resolveUpstreamBoundaryAtNode(nextId);
            if (boundary) return boundary;
        }

        if (isHydraulicBoundaryNode(nextNode, direction)) {
            boundaryId = nextId;
            return finalize();
        }

        if (!isHydraulicPassThroughNode(nextNode)) {
            return finalize({
                isUnsupported: true,
                warnings: [`${nextId} is not a hydraulic pass-through node for ${direction} tracing.`]
            });
        }

        if (visitedNodes.has(nextId)) {
            return finalize({
                isUnsupported: true,
                warnings: [`Loop detected at ${nextId}; recirculation networks require a nodal/iterative solver.`]
            });
        }

        visitedNodes.add(nextId);
        currentId = nextId;
    }

    return finalize();
}

function getFluidSpecificGravity(model) {
    const fluid = model.FLUID;
    if (fluid && fluid.props && Number.isFinite(parseFloat(fluid.props.sg))) {
        return Math.max(parseFloat(fluid.props.sg), 0.001);
    }
    const density = fluid && fluid.props ? toHydraulicNumber(fluid.props.density, 1000) : 1000;
    return Math.max(density / 999.972, 0.001);
}

function calculateCvPressureDropBar(flowRateM3H, cv, specificGravity) {
    const flow = Math.max(toHydraulicNumber(flowRateM3H), 0);
    const effectiveCv = Math.max(toHydraulicNumber(cv), 0.001);
    if (flow <= 0) return 0;

    const flowGpm = flow * 4.402867;
    const dpPsi = Math.max(toHydraulicNumber(specificGravity, 1), 0.001) * Math.pow(flowGpm / effectiveCv, 2);
    return dpPsi * 0.0689476;
}

function calculateVelocityHeadForDiameter(flowRateM3H, diameterM) {
    const flow = Math.max(toHydraulicNumber(flowRateM3H), 0);
    const diameter = Math.max(toHydraulicNumber(diameterM, 0.1), 0.0001);
    if (flow <= 0) return 0;

    const area = Math.PI * Math.pow(diameter, 2) / 4;
    const velocity = (flow / 3600) / area;
    return Math.pow(velocity, 2) / (2 * getHydraulicGravity());
}

function calculateKHeadLoss(flowRateM3H, diameterM, lossK) {
    const kValue = Math.max(toHydraulicNumber(lossK), 0);
    return kValue * calculateVelocityHeadForDiameter(flowRateM3H, diameterM);
}

function calculateEquivalentLengthHeadLoss(flowRateM3H, props = {}) {
    const diameter = Math.max(toHydraulicNumber(props.diameter, 0.1), 0.0001);
    const length = Math.max(toHydraulicNumber(props.equivLength, 0), 0);
    const velocityHead = calculateVelocityHeadForDiameter(flowRateM3H, diameter);
    if (length <= 0 || velocityHead <= 0 || typeof calculateFrictionFactor !== 'function') return 0;

    const fluid = globalModel["FLUID"];
    const kinVisc = Math.max(toHydraulicNumber(fluid?.props?.viscosity, 1), 0.000001) * 1e-6;
    const area = Math.PI * Math.pow(diameter, 2) / 4;
    const velocity = (Math.max(toHydraulicNumber(flowRateM3H), 0) / 3600) / area;
    const reynolds = (velocity * diameter) / kinVisc;
    const frictionFactor = calculateFrictionFactor(reynolds, 0.000045, diameter);
    const openingEffect = typeof calculateValveOpeningEffect === 'function'
        ? calculateValveOpeningEffect(props.opening, props.flowCharacteristic)
        : Math.max(toHydraulicNumber(props.opening, 100), 0) / 100;
    if (openingEffect <= 0) return 1000000;

    return frictionFactor * (length / diameter) * velocityHead / Math.pow(openingEffect, 2);
}

function calculateValveLossHead(flowRateM3H, props = {}, density, model) {
    const opening = Math.max(0, Math.min(100, toHydraulicNumber(props.opening, 100)));
    if (opening <= 0) return 1000000;

    const lossModel = props.lossModel || VALVE_LOSS_MODEL_CV;
    if (lossModel === VALVE_LOSS_MODEL_K) {
        const effectiveK = typeof getValveEffectiveK === 'function'
            ? getValveEffectiveK(props)
            : Math.max(toHydraulicNumber(props.kValue, 10), 0);
        if (!Number.isFinite(effectiveK)) return 1000000;
        return calculateKHeadLoss(flowRateM3H, props.diameter, effectiveK);
    }

    if (lossModel === VALVE_LOSS_MODEL_EQUIVALENT_LENGTH) {
        return calculateEquivalentLengthHeadLoss(flowRateM3H, props);
    }

    const effectiveCv = typeof getValveEffectiveCv === 'function'
        ? getValveEffectiveCv(props)
        : Math.max(toHydraulicNumber(props.cv, 100) * (opening / 100), 0.001);
    const dpBar = calculateCvPressureDropBar(flowRateM3H, effectiveCv, getFluidSpecificGravity(model));
    return pressureBarToHead(dpBar, density);
}

function calculateCheckValveLossHead(flowRateM3H, props = {}, density, model) {
    if (flowRateM3H <= 0) {
        props.checkStatus = 'Closed';
        return 0;
    }

    props.checkStatus = 'Open';
    const crackingDropBar = Math.max(toHydraulicNumber(props.crackingPressure), 0);
    const crackingLoss = pressureBarToHead(crackingDropBar, density);
    if ((props.lossModel || VALVE_LOSS_MODEL_CV) === VALVE_LOSS_MODEL_K) {
        return crackingLoss + calculateKHeadLoss(flowRateM3H, props.diameter, props.kValue || 2);
    }

    const cvDropBar = calculateCvPressureDropBar(flowRateM3H, props.cv || 100, getFluidSpecificGravity(model));
    return crackingLoss + pressureBarToHead(cvDropBar, density);
}

function calculateHydraulicEquipmentLossHead(node, flowRateM3H, density, model) {
    if (!node || !node.props) return 0;
    if (flowRateM3H <= 0) {
        if (node.type === 'checkValve') node.props.checkStatus = 'Closed';
        return 0;
    }

    if (node.type === 'valve') {
        return calculateValveLossHead(flowRateM3H, node.props, density, model);
    }

    if (node.type === 'checkValve') {
        return calculateCheckValveLossHead(flowRateM3H, node.props, density, model);
    }

    if (node.type === 'heatExchanger' || node.type === 'separator' || node.type === 'verticalVessel') {
        const dpBar = Math.max(toHydraulicNumber(node.props.pressureDrop), 0);
        return pressureBarToHead(dpBar, density);
    }

    return 0;
}

function calculateHydraulicPipeLossHead(pipeId, flowRateM3H, model, fluidProps = null) {
    const pipe = model[pipeId];
    if (!pipe || pipe.type !== 'pipe' || !pipe.props || typeof calculatePipeHeadLoss !== 'function') {
        return 0;
    }
    return calculatePipeHeadLoss(flowRateM3H, pipe.props, fluidProps);
}

function calculateHydraulicPipeLossBreakdown(pipeId, flowRateM3H, model, fluidProps = null) {
    const pipe = model[pipeId];
    if (!pipe || pipe.type !== 'pipe' || !pipe.props || typeof calculatePipeHydraulicSegments !== 'function') {
        return {
            id: pipeId,
            label: pipeId,
            type: 'pipe',
            headLoss: 0,
            majorLoss: 0,
            minorLoss: 0,
            details: []
        };
    }

    const details = calculatePipeHydraulicSegments(flowRateM3H, pipe.props, fluidProps);
    const majorLoss = details.reduce((sum, segment) => sum + segment.majorLoss, 0);
    const minorLoss = details.reduce((sum, segment) => sum + segment.minorLoss, 0);
    return {
        id: pipeId,
        label: pipe.name || pipeId,
        type: 'pipe',
        headLoss: majorLoss + minorLoss,
        majorLoss,
        minorLoss,
        details
    };
}

function calculateHydraulicEquipmentLossBreakdown(nodeId, flowRateM3H, model, density) {
    const node = model[nodeId];
    const headLoss = calculateHydraulicEquipmentLossHead(node, flowRateM3H, density, model);
    return {
        id: nodeId,
        label: node?.name || nodeId,
        type: node?.type || 'equipment',
        headLoss,
        majorLoss: 0,
        minorLoss: headLoss,
        details: []
    };
}

function getHydraulicPathEntryEquipmentNodeId(path, terminalNodeId, model) {
    if (!path || path.direction !== 'upstream' || !Array.isArray(path.steps) || path.steps.length === 0) return null;
    const entryNodeId = path.steps[0].from;
    if (!entryNodeId || entryNodeId === terminalNodeId) return null;

    const attachedSourceIds = getAttachedSourceBoundaryIds(entryNodeId, model) || [];
    if (!attachedSourceIds.includes(path.boundaryId)) return null;
    return isHydraulicPassThroughNode(model[entryNodeId]) ? entryNodeId : null;
}

function calculateHydraulicPathEntryLossHead(path, flowRateM3H, model, density, terminalNodeId) {
    const entryNodeId = getHydraulicPathEntryEquipmentNodeId(path, terminalNodeId, model);
    return entryNodeId
        ? calculateHydraulicEquipmentLossHead(model[entryNodeId], flowRateM3H, density, model)
        : 0;
}

function calculateHydraulicPathLossHead(path, flowRateM3H, model, density, terminalNodeId, fluidProps = null) {
    if (!path || !path.isComplete) return null;

    const breakdown = calculateHydraulicPathLossBreakdown(path, flowRateM3H, model, density, terminalNodeId, fluidProps);
    return breakdown ? breakdown.totalHeadLoss : null;
}

function calculateHydraulicPathLossBreakdown(path, flowRateM3H, model, density, terminalNodeId, fluidProps = null) {
    if (!path || !path.isComplete) return null;

    const entries = [];
    const entryNodeId = getHydraulicPathEntryEquipmentNodeId(path, terminalNodeId, model);
    if (entryNodeId) {
        entries.push({
            ...calculateHydraulicEquipmentLossBreakdown(entryNodeId, flowRateM3H, model, density),
            role: 'suction-entry-equipment'
        });
    }

    path.steps.forEach(step => {
        entries.push({
            ...calculateHydraulicPipeLossBreakdown(step.pipeId, flowRateM3H, model, fluidProps),
            role: 'pipe'
        });

        if (step.to !== terminalNodeId) {
            entries.push({
                ...calculateHydraulicEquipmentLossBreakdown(step.to, flowRateM3H, model, density),
                role: 'inline-equipment'
            });
        }
    });

    const totalHeadLoss = entries.reduce((sum, item) => sum + (Number.isFinite(item.headLoss) ? item.headLoss : 0), 0);
    const dominant = entries
        .filter(item => Number.isFinite(item.headLoss) && item.headLoss > 0)
        .sort((a, b) => b.headLoss - a.headLoss)[0] || null;

    return {
        entries,
        totalHeadLoss,
        dominant
    };
}

function getFluidPropsAtSourceTemperature(source, baseFluidProps = {}) {
    const base = {
        density: toHydraulicNumber(baseFluidProps.density, 1000),
        viscosity: toHydraulicNumber(baseFluidProps.viscosity, 1),
        vaporPressure: toHydraulicNumber(baseFluidProps.vaporPressure, 0),
        temp: toHydraulicNumber(baseFluidProps.temp, 25)
    };
    const warnings = [];
    if (!source || source.type !== 'source' || source.props?.temperatureMode !== 'Custom') {
        return { ...base, warnings };
    }

    const temp = toHydraulicNumber(source.props.temp, base.temp);
    const fluidName = baseFluidProps.fluidName || 'Custom';
    let calculated = null;
    if (fluidName === 'Water' && typeof calculateIapwsWaterProperties === 'function') {
        calculated = calculateIapwsWaterProperties(temp);
    } else if (fluidName === 'Methanol' && typeof calculateMethanolProperties === 'function') {
        calculated = calculateMethanolProperties(temp);
    } else if (fluidName === 'Palm Oil' && typeof calculatePalmOilProperties === 'function') {
        calculated = calculatePalmOilProperties(temp);
    } else if (fluidName === 'Crude Oil' && typeof calculateCrudeOilProperties === 'function') {
        calculated = calculateCrudeOilProperties(temp, baseFluidProps);
    }

    if (!calculated) {
        warnings.push('SRC uses custom temperature but fluid properties were not recalculated.');
        return { ...base, temp, warnings };
    }

    return {
        ...base,
        density: calculated.density,
        viscosity: calculated.kinematicViscosity,
        vaporPressure: calculated.vaporPressure,
        temp,
        warnings
    };
}

function getSemanticAttachmentWarningsForMissingPath(model, suctionPath) {
    if (suctionPath?.boundaryId || typeof sourceLinks === 'undefined' || !Array.isArray(sourceLinks)) return [];
    const activeLinks = sourceLinks.filter(link => {
        const source = model[link.sourceId];
        return source?.type === 'source'
            && model[link.targetId]
            && isSemanticSourceAttachmentType(getSourceTypeValue(source, link, model))
            && isStorageBoundaryNode(model[link.targetId]);
    });
    if (!activeLinks.length) return [];
    return activeLinks.map(link => (
        `${link.sourceId} is attached to ${link.targetId}, but no hydraulic path exists from the equipment outlet to the pump suction. Add pipe/hydraulic components to calculate flow and pressure loss.`
    ));
}

function getInvalidSemanticAttachmentWarnings(model) {
    if (typeof sourceLinks === 'undefined' || !Array.isArray(sourceLinks)) return [];
    return sourceLinks
        .filter(link => {
            const source = model[link.sourceId];
            const target = model[link.targetId];
            return source?.type === 'source'
                && target
                && link.connectionType !== 'hydraulic'
                && (
                    !isSemanticSourceAttachmentType(getSourceTypeValue(source, link, model))
                    || !isStorageBoundaryNode(target)
                );
        })
        .map(link => `${link.sourceId} dashed attachment to ${link.targetId} is not a hydraulic path and is only valid for tank/vessel boundary inheritance. Use a solid hydraulic pipe for flow.`);
}

function getSourceBoundaryWarnings(sourceBoundary, model) {
    if (!sourceBoundary || sourceBoundary.type !== 'source') return [];
    const boundary = resolveSourceBoundaryData(sourceBoundary, model);
    return boundary?.warnings || [];
}

function getPumpElevationWarnings(pump) {
    if (!pump || pump.type !== 'pump') return [];
    if (!hasFiniteProp(pump.props, 'suctionElevation') && !hasFiniteProp(pump.props, 'elevation')) {
        return ['Pump suction elevation or source elevation is missing. NPSH may be invalid.'];
    }
    return [];
}

function getHydraulicPathEquipmentWarnings(path, terminalNodeId, model) {
    if (!path || !Array.isArray(path.steps)) return [];
    const warnings = [];
    const addNodeWarnings = (nodeId) => {
        const nodeWarnings = model?.[nodeId]?.results?.warnings || [];
        nodeWarnings.forEach(warning => {
            if (warning && !warnings.includes(warning)) warnings.push(warning);
        });
    };

    const entryNodeId = getHydraulicPathEntryEquipmentNodeId(path, terminalNodeId, model);
    if (entryNodeId) addNodeWarnings(entryNodeId);
    path.steps.forEach(step => {
        if (step.to && step.to !== terminalNodeId) addNodeWarnings(step.to);
    });

    return warnings;
}

function createPumpHydraulicContext(pumpId, model, connectionList, density, vaporPressurePa) {
    const suctionPath = traceHydraulicPath(pumpId, 'upstream', model, connectionList);
    const dischargePath = traceHydraulicPath(pumpId, 'downstream', model, connectionList);
    const suctionBoundary = suctionPath.boundaryId ? model[suctionPath.boundaryId] : null;
    const dischargeBoundary = dischargePath.boundaryId ? model[dischargePath.boundaryId] : null;
    const fluidProps = getFluidPropsAtSourceTemperature(suctionBoundary, model.FLUID?.props || {});
    const contextDensity = Math.max(toHydraulicNumber(fluidProps.density, density), 1);
    const contextVaporPressurePa = toHydraulicNumber(fluidProps.vaporPressure, vaporPressurePa / 100000) * 100000;
    const networkWarnings = [
        ...(suctionPath.warnings || []),
        ...(dischargePath.warnings || []),
        ...getInvalidSemanticAttachmentWarnings(model),
        ...getSemanticAttachmentWarningsForMissingPath(model, suctionPath),
        ...getSourceBoundaryWarnings(suctionBoundary, model),
        ...getPumpElevationWarnings(model[pumpId]),
        ...(fluidProps.warnings || []),
        ...getBoundaryAbsolutePressureWarnings(suctionBoundary, suctionPath.boundaryId || 'Suction boundary'),
        ...getBoundaryAbsolutePressureWarnings(dischargeBoundary, dischargePath.boundaryId || 'Discharge boundary'),
        ...getHydraulicPathEquipmentWarnings(suctionPath, pumpId, model),
        ...getHydraulicPathEquipmentWarnings(dischargePath, dischargePath.boundaryId, model)
    ];
    const isSupported = !suctionPath.isUnsupported && !dischargePath.isUnsupported;

    return {
        pumpId,
        pump: model[pumpId],
        density: contextDensity,
        vaporPressurePa: contextVaporPressurePa,
        fluidProps,
        suctionPath,
        dischargePath,
        suctionBoundary,
        dischargeBoundary,
        isSupported,
        networkWarnings,
        isComplete: !!(suctionBoundary && dischargeBoundary && isSupported)
    };
}

function calculatePumpSystemHead(context, flowRateM3H) {
    if (!context || !context.isComplete) return null;

    if (isSinkFlowDemandBoundary(context.dischargeBoundary)) return null;

    const suctionBoundaryHead = getBoundaryHydraulicHead(context.suctionBoundary, context.density, flowRateM3H, context.suctionPath, globalModel);
    const dischargeBoundaryHead = getBoundaryHydraulicHead(context.dischargeBoundary, context.density, flowRateM3H, context.dischargePath, globalModel);
    if (suctionBoundaryHead === null || dischargeBoundaryHead === null) return null;

    const suctionLoss = calculateHydraulicPathLossHead(
        context.suctionPath,
        flowRateM3H,
        globalModel,
        context.density,
        context.pumpId,
        context.fluidProps
    );
    const dischargeLoss = calculateHydraulicPathLossHead(
        context.dischargePath,
        flowRateM3H,
        globalModel,
        context.density,
        context.dischargePath.boundaryId,
        context.fluidProps
    );
    if (suctionLoss === null || dischargeLoss === null) return null;

    return (dischargeBoundaryHead - suctionBoundaryHead) + suctionLoss + dischargeLoss;
}

function calculatePumpHydraulicSnapshot(context, flowRateM3H, pumpHead) {
    if (!context || !context.isComplete) return null;

    const suctionBoundaryHead = getBoundaryHydraulicHead(context.suctionBoundary, context.density, flowRateM3H, context.suctionPath, globalModel);
    const dischargeBoundaryHead = getBoundaryHydraulicHead(context.dischargeBoundary, context.density, flowRateM3H, context.dischargePath, globalModel);
    const suctionLossBreakdown = calculateHydraulicPathLossBreakdown(
        context.suctionPath,
        flowRateM3H,
        globalModel,
        context.density,
        context.pumpId,
        context.fluidProps
    );
    const dischargeLossBreakdown = calculateHydraulicPathLossBreakdown(
        context.dischargePath,
        flowRateM3H,
        globalModel,
        context.density,
        context.dischargePath.boundaryId,
        context.fluidProps
    );
    if ([suctionBoundaryHead, dischargeBoundaryHead, suctionLossBreakdown, dischargeLossBreakdown].some(value => value === null)) {
        return null;
    }

    const pumpElevation = getPumpPortElevation(context.pump, '.port.inlet');
    const suctionLoss = suctionLossBreakdown.totalHeadLoss;
    const dischargeLoss = dischargeLossBreakdown.totalHeadLoss;
    const suctionHeadAtPump = suctionBoundaryHead - suctionLoss;
    const dischargeHeadAtPump = suctionHeadAtPump + pumpHead;
    const vaporPressureHead = context.vaporPressurePa / (context.density * getHydraulicGravity());
    const sourceVelocityHead = getSourceVelocityHeadForBoundary(
        context.suctionBoundary,
        flowRateM3H,
        context.suctionPath,
        globalModel
    );
    const suctionTerminalStep = context.suctionPath.steps[context.suctionPath.steps.length - 1];
    const suctionVelocityHead = suctionTerminalStep
        ? getPipeVelocityHead(suctionTerminalStep.pipeId, flowRateM3H, globalModel, 'outlet')
        : 0;

    return {
        suctionBoundaryHead,
        dischargeBoundaryHead,
        suctionLoss,
        dischargeLoss,
        suctionLossBreakdown,
        dischargeLossBreakdown,
        suctionHeadAtPump,
        dischargeHeadAtPump,
        pumpElevation,
        vaporPressureHead,
        sourceVelocityHead,
        suctionVelocityHead,
        npsha: suctionHeadAtPump - pumpElevation - vaporPressureHead,
        suctionPressureBar: pressureHeadToBar(suctionHeadAtPump - pumpElevation, context.density),
        dischargePressureBar: pressureHeadToBar(dischargeHeadAtPump - pumpElevation, context.density),
        systemHead: (dischargeBoundaryHead - suctionBoundaryHead) + suctionLoss + dischargeLoss
    };
}

function calculatePumpFlowDemandSnapshot(context, flowRateM3H, pumpHead) {
    if (!context || !context.isComplete || !isSinkFlowDemandBoundary(context.dischargeBoundary)) return null;

    const suctionBoundaryHead = getBoundaryHydraulicHead(context.suctionBoundary, context.density, flowRateM3H, context.suctionPath, globalModel);
    const suctionLossBreakdown = calculateHydraulicPathLossBreakdown(
        context.suctionPath,
        flowRateM3H,
        globalModel,
        context.density,
        context.pumpId,
        context.fluidProps
    );
    const dischargeLossBreakdown = calculateHydraulicPathLossBreakdown(
        context.dischargePath,
        flowRateM3H,
        globalModel,
        context.density,
        context.dischargePath.boundaryId,
        context.fluidProps
    );
    if ([suctionBoundaryHead, suctionLossBreakdown, dischargeLossBreakdown].some(value => value === null)) {
        return null;
    }

    const pumpElevation = getPumpPortElevation(context.pump, '.port.inlet');
    const boundaryElevation = getNodePortHydraulicElevation(context.dischargePath.boundaryId, '.port.inlet', globalModel);
    const terminalVelocityHead = getBoundaryPipeVelocityHead(context.dischargeBoundary, flowRateM3H, context.dischargePath, globalModel);
    const suctionLoss = suctionLossBreakdown.totalHeadLoss;
    const dischargeLoss = dischargeLossBreakdown.totalHeadLoss;
    const suctionHeadAtPump = suctionBoundaryHead - suctionLoss;
    const dischargeHeadAtPump = suctionHeadAtPump + pumpHead;
    const dischargeBoundaryHead = dischargeHeadAtPump - dischargeLoss;
    const vaporPressureHead = context.vaporPressurePa / (context.density * getHydraulicGravity());
    const sourceVelocityHead = getSourceVelocityHeadForBoundary(
        context.suctionBoundary,
        flowRateM3H,
        context.suctionPath,
        globalModel
    );
    const suctionTerminalStep = context.suctionPath.steps[context.suctionPath.steps.length - 1];
    const suctionVelocityHead = suctionTerminalStep
        ? getPipeVelocityHead(suctionTerminalStep.pipeId, flowRateM3H, globalModel, 'outlet')
        : 0;
    const sinkStaticPressureBar = pressureHeadToBar(dischargeBoundaryHead - boundaryElevation - terminalVelocityHead, context.density);
    const sinkStagnationPressureBar = pressureHeadToBar(dischargeBoundaryHead - boundaryElevation, context.density);

    return {
        suctionBoundaryHead,
        dischargeBoundaryHead,
        suctionLoss,
        dischargeLoss,
        suctionLossBreakdown,
        dischargeLossBreakdown,
        suctionHeadAtPump,
        dischargeHeadAtPump,
        terminalVelocityHead,
        pumpElevation,
        vaporPressureHead,
        sourceVelocityHead,
        suctionVelocityHead,
        sinkStaticPressureBar,
        sinkStagnationPressureBar,
        npsha: suctionHeadAtPump - pumpElevation - vaporPressureHead,
        suctionPressureBar: pressureHeadToBar(suctionHeadAtPump - pumpElevation, context.density),
        dischargePressureBar: pressureHeadToBar(dischargeHeadAtPump - pumpElevation, context.density),
        systemHead: pumpHead
    };
}

function resetHydraulicPipeResults(model) {
    Object.keys(model).forEach(nodeId => {
        const node = model[nodeId];
        if (!node || node.type !== 'pipe') return;
        const connectionList = typeof connections !== 'undefined' ? connections : [];
        const compatibilityWarnings = typeof getPipeValveCompatibilityWarnings === 'function'
            ? getPipeValveCompatibilityWarnings(nodeId, model, connectionList)
            : [];
        node.results = {
            flow: 0,
            pressure: null,
            inletPressure: null,
            outletPressure: null,
            hydraulicHead: null,
            pressureCalculated: false,
            highPointPressure: null,
            highPointVaporMargin: null,
            highPointSegment: '',
            highPointLocationPercent: null,
            vaporPressure: null,
            segmentProfiles: [],
            warnings: compatibilityWarnings
        };
    });

    window.hydraulicNetworkState = {
        pipes: {},
        pumps: {}
    };
}

function getPipeElevationProfileMode(pipe) {
    return pipe?.props?.elevationProfileMode || 'End Elevations';
}

function getPipeEndpointElevation(pipe, endpointKey, nodeId, portSelector, model) {
    if (getPipeElevationProfileMode(pipe) === 'Ignore') {
        return getNodePortHydraulicElevation(nodeId, portSelector, model);
    }
    const override = toHydraulicNumber(pipe?.props?.[endpointKey], NaN);
    if (Number.isFinite(override)) return override;
    return getNodePortHydraulicElevation(nodeId, portSelector, model);
}

function getPipeSegmentElevationProfile(pipe, fromElevation, toElevation, details) {
    const mode = getPipeElevationProfileMode(pipe);
    const segments = Array.isArray(pipe?.props?.segments) ? pipe.props.segments : [];
    const totalLength = details.reduce((sum, detail) => sum + Math.max(toHydraulicNumber(detail.length, 0), 0), 0);
    const count = Math.max(details.length, 1);
    let cumulativeLength = 0;

    return details.map((detail, index) => {
        const segmentLength = Math.max(toHydraulicNumber(detail.length, 0), 0);
        const startFraction = totalLength > 0 ? cumulativeLength / totalLength : index / count;
        cumulativeLength += segmentLength;
        const endFraction = totalLength > 0 ? cumulativeLength / totalLength : (index + 1) / count;
        const defaultStartElevation = fromElevation + ((toElevation - fromElevation) * startFraction);
        const defaultEndElevation = fromElevation + ((toElevation - fromElevation) * endFraction);
        const segment = segments[index] || {};
        const startOverride = toHydraulicNumber(segment.startElevation, NaN);
        const endOverride = toHydraulicNumber(segment.endElevation, NaN);

        return {
            startElevation: mode !== 'Ignore' && Number.isFinite(startOverride) ? startOverride : defaultStartElevation,
            endElevation: mode !== 'Ignore' && Number.isFinite(endOverride) ? endOverride : defaultEndElevation,
            startLength: totalLength > 0 ? totalLength * startFraction : index,
            endLength: totalLength > 0 ? cumulativeLength : index + 1,
            length: segmentLength
        };
    });
}

function getPipeGlobalHighPointCandidate(pipe, details) {
    if (getPipeElevationProfileMode(pipe) !== 'High Point Check') return null;
    const segments = Array.isArray(pipe?.props?.segments) ? pipe.props.segments : [];
    const hasSegmentHighPoint = segments.some(segment => Number.isFinite(toHydraulicNumber(segment.highPointElevation, NaN)));
    if (hasSegmentHighPoint) return null;

    const elevation = toHydraulicNumber(pipe?.props?.highPointElevation, NaN);
    if (!Number.isFinite(elevation)) return null;

    const locationPercent = Math.max(0, Math.min(100, toHydraulicNumber(pipe?.props?.highPointLocationPercent, 50)));
    const totalLength = details.reduce((sum, detail) => sum + Math.max(toHydraulicNumber(detail.length, 0), 0), 0);
    const targetLength = totalLength * (locationPercent / 100);
    const segmentIndex = details.length
        ? Math.min(details.length - 1, Math.max(0, Math.round((locationPercent / 100) * (details.length - 1))))
        : 0;

    return { elevation, locationPercent, targetLength, segmentIndex };
}

function getPipeHighPointCandidateForSegment(pipe, segment, detail, elevationProfile, globalCandidate) {
    if (getPipeElevationProfileMode(pipe) !== 'High Point Check') return null;

    const segmentHighPointElevation = toHydraulicNumber(segment?.highPointElevation, NaN);
    if (Number.isFinite(segmentHighPointElevation)) {
        const localPercent = Math.max(0, Math.min(100, toHydraulicNumber(segment.highPointLocationPercent, 50)));
        return {
            elevation: segmentHighPointElevation,
            localFraction: localPercent / 100,
            locationPercent: localPercent,
            basis: 'Segment'
        };
    }

    if (!globalCandidate) return null;
    const highPointLength = globalCandidate.targetLength;
    const segmentLength = Math.max(elevationProfile.length, 0);
    const inSegment = segmentLength > 0
        ? highPointLength >= elevationProfile.startLength && highPointLength <= elevationProfile.endLength
        : globalCandidate.segmentIndex === detail.index;
    if (!inSegment) return null;

    const localFraction = segmentLength > 0
        ? Math.max(0, Math.min(1, (highPointLength - elevationProfile.startLength) / segmentLength))
        : 0.5;
    return {
        elevation: globalCandidate.elevation,
        localFraction,
        locationPercent: globalCandidate.locationPercent,
        basis: 'Pipe'
    };
}

function calculatePipeSegmentPressureProfile(pipe, flowRateM3H, inletHead, density, vaporPressureBar, fromElevation, toElevation) {
    if (typeof calculatePipeHydraulicSegments !== 'function') return [];
    const details = calculatePipeHydraulicSegments(flowRateM3H, pipe.props);
    const elevations = getPipeSegmentElevationProfile(pipe, fromElevation, toElevation, details);
    const segments = Array.isArray(pipe?.props?.segments) ? pipe.props.segments : [];
    const globalCandidate = getPipeGlobalHighPointCandidate(pipe, details);
    const profiles = [];
    let currentHead = inletHead;

    details.forEach((detail, index) => {
        const elevationProfile = elevations[index] || { startElevation: fromElevation, endElevation: toElevation, length: detail.length, startLength: 0, endLength: 0 };
        const velocityHead = Math.pow(detail.velocity || 0, 2) / (2 * getHydraulicGravity());
        const segmentLoss = toHydraulicNumber(detail.totalLoss, 0);
        const startHead = currentHead;
        const endHead = startHead - segmentLoss;
        const startPressure = pressureHeadToBar(startHead - elevationProfile.startElevation - velocityHead, density);
        const endPressure = pressureHeadToBar(endHead - elevationProfile.endElevation - velocityHead, density);
        const highPointCandidate = getPipeHighPointCandidateForSegment(pipe, segments[index], detail, elevationProfile, globalCandidate);
        let highPointPressure = null;
        let highPointVaporMargin = null;

        if (highPointCandidate) {
            const highPointHead = startHead - (segmentLoss * highPointCandidate.localFraction);
            highPointPressure = pressureHeadToBar(highPointHead - highPointCandidate.elevation - velocityHead, density);
            highPointVaporMargin = Number.isFinite(highPointPressure) && Number.isFinite(vaporPressureBar)
                ? highPointPressure - vaporPressureBar
                : null;
        }

        profiles.push({
            index: detail.index,
            name: detail.name || `Segment ${index + 1}`,
            startElevation: Number(elevationProfile.startElevation.toFixed(3)),
            endElevation: Number(elevationProfile.endElevation.toFixed(3)),
            startPressure: Number(startPressure.toFixed(3)),
            endPressure: Number(endPressure.toFixed(3)),
            startHead: Number(startHead.toFixed(3)),
            endHead: Number(endHead.toFixed(3)),
            highPointElevation: highPointCandidate ? Number(highPointCandidate.elevation.toFixed(3)) : null,
            highPointLocationPercent: highPointCandidate ? Number(highPointCandidate.locationPercent.toFixed(1)) : null,
            highPointBasis: highPointCandidate?.basis || '',
            highPointPressure: Number.isFinite(highPointPressure) ? Number(highPointPressure.toFixed(3)) : null,
            highPointVaporMargin: Number.isFinite(highPointVaporMargin) ? Number(highPointVaporMargin.toFixed(3)) : null
        });

        currentHead = endHead;
    });

    return profiles;
}

function setPipeHydraulicResult(model, step, flowRateM3H, inletHead, outletHead, density, vaporPressurePa = null) {
    const pipe = model[step.pipeId];
    if (!pipe || pipe.type !== 'pipe') return;

    const fromElevation = getPipeEndpointElevation(pipe, 'startElevation', step.from, step.fromPort, model);
    const toElevation = getPipeEndpointElevation(pipe, 'endElevation', step.to, step.toPort, model);
    const midHead = (inletHead + outletHead) / 2;
    const midElevation = (fromElevation + toElevation) / 2;
    const inletVelocityHead = getPipeVelocityHead(step.pipeId, flowRateM3H, model, 'inlet');
    const outletVelocityHead = getPipeVelocityHead(step.pipeId, flowRateM3H, model, 'outlet');
    const averageVelocityHead = getPipeVelocityHead(step.pipeId, flowRateM3H, model, 'average');
    const vaporPressureBar = Number.isFinite(vaporPressurePa) ? vaporPressurePa / 100000 : null;
    const segmentProfiles = calculatePipeSegmentPressureProfile(pipe, flowRateM3H, inletHead, density, vaporPressureBar, fromElevation, toElevation);
    const highPointProfiles = segmentProfiles.filter(profile => Number.isFinite(profile.highPointPressure));
    const controllingHighPoint = highPointProfiles
        .slice()
        .sort((a, b) => {
            const marginA = Number.isFinite(a.highPointVaporMargin) ? a.highPointVaporMargin : a.highPointPressure;
            const marginB = Number.isFinite(b.highPointVaporMargin) ? b.highPointVaporMargin : b.highPointPressure;
            return marginA - marginB;
        })[0] || null;
    const warnings = [];
    highPointProfiles.forEach(profile => {
        if (Number.isFinite(profile.highPointVaporMargin) && profile.highPointVaporMargin <= 0) {
            warnings.push(`Pipe high point pressure at ${profile.name} is at or below vapor pressure; vapor margin ${profile.highPointVaporMargin.toFixed(3)} bar.`);
        }
    });
    if (typeof getPipeValveCompatibilityWarnings === 'function') {
        const connectionList = typeof connections !== 'undefined' ? connections : [];
        getPipeValveCompatibilityWarnings(step.pipeId, model, connectionList).forEach(warning => {
            if (warning && !warnings.includes(warning)) warnings.push(warning);
        });
    }

    const result = {
        flow: Number(flowRateM3H.toFixed(3)),
        pressure: Number(pressureHeadToBar(midHead - midElevation - averageVelocityHead, density).toFixed(3)),
        inletPressure: Number(pressureHeadToBar(inletHead - fromElevation - inletVelocityHead, density).toFixed(3)),
        outletPressure: Number(pressureHeadToBar(outletHead - toElevation - outletVelocityHead, density).toFixed(3)),
        inletStagnationPressure: Number(pressureHeadToBar(inletHead - fromElevation, density).toFixed(3)),
        outletStagnationPressure: Number(pressureHeadToBar(outletHead - toElevation, density).toFixed(3)),
        velocityHead: Number(averageVelocityHead.toFixed(3)),
        startElevation: Number(fromElevation.toFixed(3)),
        endElevation: Number(toElevation.toFixed(3)),
        highPointElevation: controllingHighPoint?.highPointElevation ?? null,
        highPointPressure: controllingHighPoint?.highPointPressure ?? null,
        highPointVaporMargin: controllingHighPoint?.highPointVaporMargin ?? null,
        highPointSegment: controllingHighPoint?.name || '',
        highPointLocationPercent: controllingHighPoint?.highPointLocationPercent ?? null,
        vaporPressure: Number.isFinite(vaporPressureBar) ? Number(vaporPressureBar.toFixed(6)) : null,
        segmentProfiles,
        inletHydraulicHead: Number(inletHead.toFixed(3)),
        outletHydraulicHead: Number(outletHead.toFixed(3)),
        hydraulicHead: Number(midHead.toFixed(3)),
        pressureCalculated: true,
        warnings
    };

    pipe.results = result;
    if (window.hydraulicNetworkState) {
        window.hydraulicNetworkState.pipes[step.pipeId] = result;
    }
}

function applyHydraulicPathResults(context, snapshot, flowRateM3H) {
    if (!context || !snapshot) return;

    let currentHead = snapshot.suctionBoundaryHead;
    const entryNodeId = getHydraulicPathEntryEquipmentNodeId(context.suctionPath, context.pumpId, globalModel);
    if (entryNodeId) {
        currentHead -= calculateHydraulicEquipmentLossHead(globalModel[entryNodeId], flowRateM3H, context.density, globalModel);
    }
    context.suctionPath.steps.forEach(step => {
        const pipeLoss = calculateHydraulicPipeLossHead(step.pipeId, flowRateM3H, globalModel, context.fluidProps);
        const outletHead = currentHead - pipeLoss;
        setPipeHydraulicResult(globalModel, step, flowRateM3H, currentHead, outletHead, context.density, context.vaporPressurePa);
        currentHead = outletHead;
        if (step.to !== context.pumpId) {
            currentHead -= calculateHydraulicEquipmentLossHead(globalModel[step.to], flowRateM3H, context.density, globalModel);
        }
    });

    currentHead = snapshot.dischargeHeadAtPump;
    context.dischargePath.steps.forEach(step => {
        const pipeLoss = calculateHydraulicPipeLossHead(step.pipeId, flowRateM3H, globalModel, context.fluidProps);
        const outletHead = currentHead - pipeLoss;
        setPipeHydraulicResult(globalModel, step, flowRateM3H, currentHead, outletHead, context.density, context.vaporPressurePa);
        currentHead = outletHead;
        if (step.to !== context.dischargePath.boundaryId) {
            currentHead -= calculateHydraulicEquipmentLossHead(globalModel[step.to], flowRateM3H, context.density, globalModel);
        }
    });

    if (window.hydraulicNetworkState) {
        window.hydraulicNetworkState.pumps[context.pumpId] = {
            suctionPath: context.suctionPath,
            dischargePath: context.dischargePath,
            snapshot
        };
    }
}
