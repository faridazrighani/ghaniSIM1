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

function isSinkPressureBoundary(node) {
    return !!(node && node.type === 'sink' && node.props?.active !== 'Inactive' && node.props?.boundaryMode !== 'Flow Demand');
}

function isSinkFlowDemandBoundary(node) {
    return !!(node && node.type === 'sink' && node.props?.active !== 'Inactive' && node.props?.boundaryMode === 'Flow Demand');
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

function orientHydraulicConnection(conn, model = globalModel) {
    if (!conn) return null;
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
        .filter(item => item.targetId === nodeId && model[item.sourceId]?.type === 'source')
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

function getBoundaryHydraulicHead(node, density, flowRateM3H = 0, path = null, model = globalModel) {
    if (!node || !node.props) return null;
    if (isSinkFlowDemandBoundary(node)) return null;

    const boundaryPressure = typeof getNodeAbsolutePressureBar === 'function'
        ? getNodeAbsolutePressureBar(node)
        : node.props.pressure;
    const pressureHead = pressureBarToHead(boundaryPressure, density);
    let boundaryHead = pressureHead + getNodeHydraulicElevation(node);

    if (node.type === 'sink' && node.props.pressureBasis === 'Static') {
        boundaryHead += getBoundaryPipeVelocityHead(node, flowRateM3H, path, model);
    }

    return boundaryHead;
}

function getBoundaryAbsolutePressureWarnings(node, label) {
    if (!node || !node.props || node.props.pressureInputBasis !== PRESSURE_INPUT_BASIS_ABSOLUTE) return [];
    const absolutePressure = typeof getNodeAbsolutePressureBar === 'function'
        ? getNodeAbsolutePressureBar(node)
        : toHydraulicNumber(node.props.pressure, NaN);
    if (Number.isFinite(absolutePressure) && absolutePressure <= 0) {
        return [`${label} pressure is 0 bar a/vacuum absolute; use 0 bar g or 1.013 bar a for atmospheric service.`];
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
    const hydraulicConnections = (connectionList || [])
        .map(conn => orientHydraulicConnection(conn, model))
        .filter(Boolean);
    const finalize = (overrides = {}) => ({
        direction,
        boundaryId,
        steps: reverseSearch ? traversed.slice().reverse() : traversed.slice(),
        isComplete: !!boundaryId && !overrides.isUnsupported,
        warnings: [...warnings, ...(overrides.warnings || [])],
        isUnsupported: !!overrides.isUnsupported,
        isBranched: !!overrides.isBranched
    });

    for (let stepCount = 0; stepCount < 80; stepCount++) {
        if (reverseSearch) {
            const attachedSourceIds = getAttachedSourceBoundaryIds(currentId, model) || [];
            if (attachedSourceIds.length > 1) {
                return finalize({
                    isUnsupported: true,
                    isBranched: true,
                    warnings: [`Multiple SRC boundaries are attached to ${currentId}; multi-source suction networks require a nodal solver.`]
                });
            }
            if (attachedSourceIds.length === 1) {
                boundaryId = attachedSourceIds[0];
                return finalize();
            }
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
            const attachedSourceIds = getAttachedSourceBoundaryIds(nextId, model) || [];
            if (attachedSourceIds.length > 1) {
                return finalize({
                    isUnsupported: true,
                    isBranched: true,
                    warnings: [`Multiple SRC boundaries are attached to ${nextId}; multi-source suction networks require a nodal solver.`]
                });
            }
            if (attachedSourceIds.length === 1) {
                boundaryId = attachedSourceIds[0];
                return finalize();
            }
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

function calculateHydraulicPipeLossHead(pipeId, flowRateM3H, model) {
    const pipe = model[pipeId];
    if (!pipe || pipe.type !== 'pipe' || !pipe.props || typeof calculatePipeHeadLoss !== 'function') {
        return 0;
    }
    return calculatePipeHeadLoss(flowRateM3H, pipe.props);
}

function calculateHydraulicPipeLossBreakdown(pipeId, flowRateM3H, model) {
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

    const details = calculatePipeHydraulicSegments(flowRateM3H, pipe.props);
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

function calculateHydraulicPathLossHead(path, flowRateM3H, model, density, terminalNodeId) {
    if (!path || !path.isComplete) return null;

    const breakdown = calculateHydraulicPathLossBreakdown(path, flowRateM3H, model, density, terminalNodeId);
    return breakdown ? breakdown.totalHeadLoss : null;
}

function calculateHydraulicPathLossBreakdown(path, flowRateM3H, model, density, terminalNodeId) {
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
            ...calculateHydraulicPipeLossBreakdown(step.pipeId, flowRateM3H, model),
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

function createPumpHydraulicContext(pumpId, model, connectionList, density, vaporPressurePa) {
    const suctionPath = traceHydraulicPath(pumpId, 'upstream', model, connectionList);
    const dischargePath = traceHydraulicPath(pumpId, 'downstream', model, connectionList);
    const suctionBoundary = suctionPath.boundaryId ? model[suctionPath.boundaryId] : null;
    const dischargeBoundary = dischargePath.boundaryId ? model[dischargePath.boundaryId] : null;
    const networkWarnings = [
        ...(suctionPath.warnings || []),
        ...(dischargePath.warnings || []),
        ...getBoundaryAbsolutePressureWarnings(suctionBoundary, suctionPath.boundaryId || 'Suction boundary'),
        ...getBoundaryAbsolutePressureWarnings(dischargeBoundary, dischargePath.boundaryId || 'Discharge boundary')
    ];
    const isSupported = !suctionPath.isUnsupported && !dischargePath.isUnsupported;

    return {
        pumpId,
        pump: model[pumpId],
        density,
        vaporPressurePa,
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
        context.pumpId
    );
    const dischargeLoss = calculateHydraulicPathLossHead(
        context.dischargePath,
        flowRateM3H,
        globalModel,
        context.density,
        context.dischargePath.boundaryId
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
        context.pumpId
    );
    const dischargeLossBreakdown = calculateHydraulicPathLossBreakdown(
        context.dischargePath,
        flowRateM3H,
        globalModel,
        context.density,
        context.dischargePath.boundaryId
    );
    if ([suctionBoundaryHead, dischargeBoundaryHead, suctionLossBreakdown, dischargeLossBreakdown].some(value => value === null)) {
        return null;
    }

    const pumpElevation = getNodeHydraulicElevation(context.pump);
    const suctionLoss = suctionLossBreakdown.totalHeadLoss;
    const dischargeLoss = dischargeLossBreakdown.totalHeadLoss;
    const suctionHeadAtPump = suctionBoundaryHead - suctionLoss;
    const dischargeHeadAtPump = suctionHeadAtPump + pumpHead;
    const vaporPressureHead = context.vaporPressurePa / (context.density * getHydraulicGravity());
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
        context.pumpId
    );
    const dischargeLossBreakdown = calculateHydraulicPathLossBreakdown(
        context.dischargePath,
        flowRateM3H,
        globalModel,
        context.density,
        context.dischargePath.boundaryId
    );
    if ([suctionBoundaryHead, suctionLossBreakdown, dischargeLossBreakdown].some(value => value === null)) {
        return null;
    }

    const pumpElevation = getNodeHydraulicElevation(context.pump);
    const boundaryElevation = getNodeHydraulicElevation(context.dischargeBoundary);
    const terminalVelocityHead = getBoundaryPipeVelocityHead(context.dischargeBoundary, flowRateM3H, context.dischargePath, globalModel);
    const suctionLoss = suctionLossBreakdown.totalHeadLoss;
    const dischargeLoss = dischargeLossBreakdown.totalHeadLoss;
    const suctionHeadAtPump = suctionBoundaryHead - suctionLoss;
    const dischargeHeadAtPump = suctionHeadAtPump + pumpHead;
    const dischargeBoundaryHead = dischargeHeadAtPump - dischargeLoss;
    const vaporPressureHead = context.vaporPressurePa / (context.density * getHydraulicGravity());
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
        node.results = {
            flow: 0,
            pressure: null,
            inletPressure: null,
            outletPressure: null,
            hydraulicHead: null,
            pressureCalculated: false
        };
    });

    window.hydraulicNetworkState = {
        pipes: {},
        pumps: {}
    };
}

function setPipeHydraulicResult(model, step, flowRateM3H, inletHead, outletHead, density) {
    const pipe = model[step.pipeId];
    if (!pipe || pipe.type !== 'pipe') return;

    const fromElevation = getNodeHydraulicElevation(model[step.from]);
    const toElevation = getNodeHydraulicElevation(model[step.to]);
    const midHead = (inletHead + outletHead) / 2;
    const midElevation = (fromElevation + toElevation) / 2;
    const inletVelocityHead = getPipeVelocityHead(step.pipeId, flowRateM3H, model, 'inlet');
    const outletVelocityHead = getPipeVelocityHead(step.pipeId, flowRateM3H, model, 'outlet');
    const averageVelocityHead = getPipeVelocityHead(step.pipeId, flowRateM3H, model, 'average');

    const result = {
        flow: Number(flowRateM3H.toFixed(3)),
        pressure: Number(pressureHeadToBar(midHead - midElevation - averageVelocityHead, density).toFixed(3)),
        inletPressure: Number(pressureHeadToBar(inletHead - fromElevation - inletVelocityHead, density).toFixed(3)),
        outletPressure: Number(pressureHeadToBar(outletHead - toElevation - outletVelocityHead, density).toFixed(3)),
        inletStagnationPressure: Number(pressureHeadToBar(inletHead - fromElevation, density).toFixed(3)),
        outletStagnationPressure: Number(pressureHeadToBar(outletHead - toElevation, density).toFixed(3)),
        velocityHead: Number(averageVelocityHead.toFixed(3)),
        inletHydraulicHead: Number(inletHead.toFixed(3)),
        outletHydraulicHead: Number(outletHead.toFixed(3)),
        hydraulicHead: Number(midHead.toFixed(3)),
        pressureCalculated: true
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
        const pipeLoss = calculateHydraulicPipeLossHead(step.pipeId, flowRateM3H, globalModel);
        const outletHead = currentHead - pipeLoss;
        setPipeHydraulicResult(globalModel, step, flowRateM3H, currentHead, outletHead, context.density);
        currentHead = outletHead;
        if (step.to !== context.pumpId) {
            currentHead -= calculateHydraulicEquipmentLossHead(globalModel[step.to], flowRateM3H, context.density, globalModel);
        }
    });

    currentHead = snapshot.dischargeHeadAtPump;
    context.dischargePath.steps.forEach(step => {
        const pipeLoss = calculateHydraulicPipeLossHead(step.pipeId, flowRateM3H, globalModel);
        const outletHead = currentHead - pipeLoss;
        setPipeHydraulicResult(globalModel, step, flowRateM3H, currentHead, outletHead, context.density);
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
