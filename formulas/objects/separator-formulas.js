function calculateSeparatorHoldupVolume(flowRateM3H, residenceTimeMin) {
    return (flowRateM3H || 0) * ((residenceTimeMin || 0) / 60);
}

function toSeparatorTraceNumber(value, fallback = NaN) {
    const numeric = parseFloat(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function roundSeparatorTraceNumber(value, digits = 3) {
    const numeric = parseFloat(value);
    if (!Number.isFinite(numeric)) return null;
    return Number(numeric.toFixed(digits));
}

function formatSeparatorTraceNumber(value, digits = 3) {
    const numeric = parseFloat(value);
    if (!Number.isFinite(numeric)) return '-';
    return numeric.toFixed(digits);
}

function getSeparatorGravity() {
    return typeof getHydraulicGravity === 'function' ? getHydraulicGravity() : 9.81;
}

function getSeparatorPressureAbsBar(node) {
    if (typeof getNodeAbsolutePressureBar === 'function') return getNodeAbsolutePressureBar(node);
    const pressure = toSeparatorTraceNumber(node?.props?.pressure, 0);
    const basis = node?.props?.pressureInputBasis || 'Gauge';
    const atm = typeof ATM_PRESSURE_BAR === 'number' ? ATM_PRESSURE_BAR : 1.01325;
    return basis === 'Gauge' ? pressure + atm : pressure;
}

function pressureDropBarToSeparatorHead(dpBar, density) {
    const dp = Math.max(toSeparatorTraceNumber(dpBar, 0), 0);
    const rho = Math.max(toSeparatorTraceNumber(density, 1000), 1);
    if (typeof pressureBarToHead === 'function') return pressureBarToHead(dp, rho);
    return dp * 100000 / (rho * getSeparatorGravity());
}

function createSeparatorTraceStep(title, formula, substitution, result, unit, reference, digits = 3) {
    return {
        title,
        formula,
        substitution,
        result,
        unit,
        reference,
        digits
    };
}

function getSeparatorTraceConnections(nodeId, model = globalModel, connectionList = connections) {
    if (!nodeId || !Array.isArray(connectionList)) return [];
    return connectionList
        .filter(conn => conn && conn.pipeId && conn.connectionType !== 'semantic' && (conn.from === nodeId || conn.to === nodeId))
        .map(conn => (typeof getOrientedHydraulicConnection === 'function'
            ? getOrientedHydraulicConnection(conn)
            : conn))
        .filter(Boolean)
        .map(conn => {
            const pipe = model?.[conn.pipeId];
            const flow = toSeparatorTraceNumber(pipe?.results?.flow, NaN);
            const solved = !!(pipe?.results?.pressureCalculated && Number.isFinite(flow));
            const role = conn.to === nodeId ? 'Inlet' : (conn.from === nodeId ? 'Outlet' : 'Connected');
            const otherId = conn.to === nodeId ? conn.from : conn.to;
            return {
                pipeId: conn.pipeId,
                role,
                otherId,
                flow: solved ? flow : null,
                solved,
                text: `${conn.pipeId} ${role.toLowerCase()} ${otherId || '-'}`
            };
        });
}

function getSeparatorTraceFlowBasis(connectionRows = []) {
    const solvedFlows = connectionRows
        .map(row => row.flow)
        .filter(value => Number.isFinite(value) && value >= 0);
    if (!solvedFlows.length) return { flow: null, basis: 'No solved hydraulic pipe flow' };

    const inletFlows = connectionRows
        .filter(row => row.role === 'Inlet' && Number.isFinite(row.flow))
        .map(row => row.flow);
    const outletFlows = connectionRows
        .filter(row => row.role === 'Outlet' && Number.isFinite(row.flow))
        .map(row => row.flow);
    const source = inletFlows.length ? inletFlows : (outletFlows.length ? outletFlows : solvedFlows);
    const flow = source.reduce((sum, value) => sum + value, 0);
    const basis = inletFlows.length
        ? 'Sum of solved inlet pipe flow'
        : (outletFlows.length ? 'Sum of solved outlet pipe flow' : 'Solved connected pipe flow');
    return { flow, basis };
}

function getSeparatorTraceFlowSum(connectionRows = [], role = '') {
    return (connectionRows || []).reduce((sum, row) => {
        if (role && row.role !== role) return sum;
        const flow = toSeparatorTraceNumber(row.flow, NaN);
        return Number.isFinite(flow) ? sum + flow : sum;
    }, 0);
}

function getSeparatorTraceSourceFeedFlow(source, density) {
    const props = source?.props || {};
    const volumetricFlow = toSeparatorTraceNumber(props.flow, NaN);
    if (Number.isFinite(volumetricFlow)) return volumetricFlow;

    const massFlow = toSeparatorTraceNumber(props.massFlow, NaN);
    const rho = toSeparatorTraceNumber(density, NaN);
    if (Number.isFinite(massFlow) && Number.isFinite(rho) && rho > 0) {
        return massFlow / rho;
    }
    return null;
}

function getSeparatorTraceSourceFeedRows(nodeId, model = globalModel, density = 1000) {
    if (!nodeId || typeof sourceLinks === 'undefined' || !Array.isArray(sourceLinks)) return [];
    return sourceLinks
        .filter(link => link?.targetId === nodeId && model?.[link.sourceId]?.type === 'source')
        .map(link => {
            const source = model?.[link.sourceId];
            const sourceType = source?.props?.sourceType || '-';
            const flow = getSeparatorTraceSourceFeedFlow(source, density);
            const sourceRole = ['Open Tank / Reservoir', 'Pressurized Vessel'].includes(sourceType)
                ? 'Semantic attachment feed specification; not a hydraulic pipe'
                : 'Attached source feed specification';
            return {
                sourceId: link.sourceId,
                sourceType,
                flow: Number.isFinite(flow) ? roundSeparatorTraceNumber(flow, 3) : null,
                flowInputMode: source?.props?.flowInputMode || '-',
                role: sourceRole
            };
        });
}

function getSeparatorTraceSourceFeedTotal(sourceFeedFlows = []) {
    return (sourceFeedFlows || []).reduce((sum, row) => {
        const flow = toSeparatorTraceNumber(row?.flow, NaN);
        return Number.isFinite(flow) ? sum + flow : sum;
    }, 0);
}

function getSeparatorTraceLevelTrend(netFlow, hasFlow, flowTolerance) {
    if (!hasFlow || !Number.isFinite(netFlow)) return 'No flow';
    if (Math.abs(netFlow) <= flowTolerance) return 'Balanced';
    return netFlow > 0 ? 'Rising' : 'Falling';
}

function getSeparatorTraceObjectMeta(nodeOrType = 'separator') {
    const type = typeof nodeOrType === 'string' ? nodeOrType : nodeOrType?.type;
    const isVertical = type === 'verticalVessel';
    return {
        isVertical,
        vesselLabel: isVertical ? 'Vessel V' : 'Vessel H',
        vesselType: isVertical ? 'Vessel V / Vertical Vessel' : 'Vessel H / Horizontal Separator',
        orientation: isVertical ? 'Vertical' : 'Horizontal',
        sizingScope: isVertical
            ? 'vertical vessel/separator sizing and ASME mechanical pressure-vessel design'
            : 'horizontal separator sizing and ASME mechanical pressure-vessel design'
    };
}

function getVesselStandardExample(nodeOrType = 'separator') {
    const meta = getSeparatorTraceObjectMeta(nodeOrType);
    const fallback = {
        elevation: 6,
        liquidLevel: 3,
        inletNozzleElevation: 3,
        outletNozzleElevation: 1,
        pressureInputBasis: 'Gauge',
        pressure: 0.1,
        pressureDrop: 0.1,
        residenceTime: 5
    };
    const source = meta.isVertical && typeof VESSEL_V_STANDARD_EXAMPLE !== 'undefined'
        ? VESSEL_V_STANDARD_EXAMPLE
        : (!meta.isVertical && typeof VESSEL_H_STANDARD_EXAMPLE !== 'undefined'
            ? VESSEL_H_STANDARD_EXAMPLE
            : fallback);
    const pressureInputBasis = source.pressureInputBasis || 'Gauge';
    const pressureInputUnit = pressureInputBasis === 'Gauge' ? 'bar g' : 'bar a';
    return {
        vesselLabel: meta.vesselLabel,
        vesselType: meta.vesselType,
        orientation: source.orientation || meta.orientation,
        pressureInputBasis,
        pressureInputUnit,
        pressure: toSeparatorTraceNumber(source.pressure, 0.1),
        pressureDrop: toSeparatorTraceNumber(source.pressureDrop, 0.1),
        residenceTime: toSeparatorTraceNumber(source.residenceTime, 5),
        baseElevation: toSeparatorTraceNumber(source.elevation, 6),
        liquidLevel: toSeparatorTraceNumber(source.liquidLevel, 3),
        inletNozzleElevation: toSeparatorTraceNumber(source.inletNozzleElevation, 3),
        outletNozzleElevation: toSeparatorTraceNumber(source.outletNozzleElevation, 1)
    };
}

function getVesselHStandardExample() {
    return getVesselStandardExample('separator');
}

function buildSeparatorCalculationTrace(
    nodeIdOrNode,
    model = (typeof globalModel !== 'undefined' ? globalModel : {}),
    connectionList = (typeof connections !== 'undefined' ? connections : [])
) {
    const nodeId = typeof nodeIdOrNode === 'string'
        ? nodeIdOrNode
        : Object.keys(model || {}).find(id => model[id] === nodeIdOrNode);
    const node = typeof nodeIdOrNode === 'string' ? model?.[nodeIdOrNode] : nodeIdOrNode;
    if (!node || !['separator', 'verticalVessel'].includes(node.type)) {
        return {
            status: 'Vessel not found',
            inputBasis: {},
            readouts: [],
            dependencyChain: [],
            steps: [],
            warnings: ['Vessel object is not available in the active model.'],
            assumptions: [],
            references: []
        };
    }

    const props = node.props || {};
    const objectMeta = getSeparatorTraceObjectMeta(node);
    const vesselLabel = objectMeta.vesselLabel;
    const fluidProps = model?.FLUID?.props || {};
    const density = Math.max(toSeparatorTraceNumber(fluidProps.density, 1000), 1);
    const vaporPressure = toSeparatorTraceNumber(fluidProps.vaporPressure, NaN);
    const pressureBasis = props.pressureInputBasis || 'Gauge';
    const pressureInput = toSeparatorTraceNumber(props.pressure, 0);
    const pressureInputUnit = pressureBasis === 'Gauge' ? 'bar g' : 'bar a';
    const pressureAbsBar = getSeparatorPressureAbsBar(node);
    const rawPressureDropBar = toSeparatorTraceNumber(props.pressureDrop, 0);
    const pressureDropBar = Math.max(rawPressureDropBar, 0);
    const pressureDropHead = pressureDropBarToSeparatorHead(pressureDropBar, density);
    const baseElevation = toSeparatorTraceNumber(props.elevation, 0);
    const liquidLevel = toSeparatorTraceNumber(props.liquidLevel, 0);
    const liquidSurfaceElevation = baseElevation + liquidLevel;
    const inletNozzleElevation = toSeparatorTraceNumber(props.inletNozzleElevation, baseElevation);
    const outletNozzleElevation = toSeparatorTraceNumber(props.outletNozzleElevation, baseElevation);
    const outletSubmergence = liquidSurfaceElevation - outletNozzleElevation;
    const residenceTime = toSeparatorTraceNumber(props.residenceTime, 0);
    const connectionRows = getSeparatorTraceConnections(nodeId, model, connectionList);
    const flowBasis = getSeparatorTraceFlowBasis(connectionRows);
    const hydraulicInletFlow = getSeparatorTraceFlowSum(connectionRows, 'Inlet');
    const hydraulicOutletFlow = getSeparatorTraceFlowSum(connectionRows, 'Outlet');
    const sourceFeedFlows = getSeparatorTraceSourceFeedRows(nodeId, model, density);
    const sourceFeedFlow = getSeparatorTraceSourceFeedTotal(sourceFeedFlows);
    const inletFlow = hydraulicInletFlow + sourceFeedFlow;
    const outletFlow = hydraulicOutletFlow;
    const hasFlow = inletFlow > 0 || outletFlow > 0;
    const netFlow = inletFlow - outletFlow;
    const flowTolerance = Math.max(0.01, Math.max(Math.abs(inletFlow), Math.abs(outletFlow)) * 0.02);
    const levelTrend = getSeparatorTraceLevelTrend(netFlow, hasFlow, flowTolerance);
    const holdupFlow = hasFlow
        ? inletFlow
        : (Number.isFinite(flowBasis.flow) ? flowBasis.flow : null);
    const holdupVolume = Number.isFinite(holdupFlow)
        ? calculateSeparatorHoldupVolume(holdupFlow, residenceTime)
        : null;
    const attachedSources = sourceFeedFlows.map(row => row.sourceId);
    const standardExample = getVesselStandardExample(node);
    standardExample.liquidSurfaceElevation = standardExample.baseElevation + standardExample.liquidLevel;
    standardExample.outletSubmergence = standardExample.liquidSurfaceElevation - standardExample.outletNozzleElevation;
    const warnings = [];

    if (pressureBasis === 'Absolute' && Number.isFinite(pressureAbsBar) && pressureAbsBar <= 0) {
        warnings.push('Vessel pressure is 0 bar a/vacuum absolute; use gauge basis for atmospheric service or enter a positive absolute pressure.');
    }
    if (Number.isFinite(vaporPressure) && Number.isFinite(pressureAbsBar) && pressureAbsBar <= vaporPressure) {
        warnings.push('Vessel absolute pressure is at or below active Fluid Basis vapor pressure.');
    }
    if (rawPressureDropBar < 0) {
        warnings.push('Pressure drop cannot be negative; hydraulic loss uses zero minimum.');
    }
    if (!Number.isFinite(residenceTime) || residenceTime <= 0) {
        warnings.push('Residence time should be greater than zero for holdup volume estimation.');
    }
    if (Number.isFinite(outletSubmergence) && outletSubmergence < 0) {
        warnings.push('Outlet nozzle elevation is above liquid surface; source inheritance and suction feed may be invalid.');
    }
    if (connectionRows.length === 0) {
        warnings.push(`${vesselLabel} has no solid hydraulic pipe connection; it will not carry hydraulic flow.`);
    } else if (!connectionRows.some(row => row.solved)) {
        warnings.push('Connected pipe flow is not solved; connect complete upstream/downstream boundaries to calculate residence holdup.');
    }

    const atm = typeof ATM_PRESSURE_BAR === 'number' ? ATM_PRESSURE_BAR : 1.01325;
    const pressureFormula = pressureBasis === 'Gauge' ? 'Pabs = Pgauge + Patm' : 'Pabs = Pabsolute input';
    const pressureSubstitution = pressureBasis === 'Gauge'
        ? `${formatSeparatorTraceNumber(pressureInput)} + ${formatSeparatorTraceNumber(atm, 5)} = ${formatSeparatorTraceNumber(pressureAbsBar, 6)} bar a`
        : `${formatSeparatorTraceNumber(pressureInput)} ${pressureInputUnit}`;
    const flowStepSubstitution = Number.isFinite(flowBasis.flow)
        ? `${connectionRows.filter(row => Number.isFinite(row.flow)).map(row => `${row.pipeId} ${formatSeparatorTraceNumber(row.flow)} m3/h`).join(' + ')} = ${formatSeparatorTraceNumber(flowBasis.flow)} m3/h`
        : 'No solved connected pipe flow';
    const hydraulicInletSubstitution = connectionRows.filter(row => row.role === 'Inlet' && Number.isFinite(row.flow)).length
        ? `${connectionRows.filter(row => row.role === 'Inlet' && Number.isFinite(row.flow)).map(row => `${row.pipeId} ${formatSeparatorTraceNumber(row.flow)} m3/h`).join(' + ')} = ${formatSeparatorTraceNumber(hydraulicInletFlow)} m3/h`
        : `No solved inlet pipe flow = ${formatSeparatorTraceNumber(hydraulicInletFlow)} m3/h`;
    const hydraulicOutletSubstitution = connectionRows.filter(row => row.role === 'Outlet' && Number.isFinite(row.flow)).length
        ? `${connectionRows.filter(row => row.role === 'Outlet' && Number.isFinite(row.flow)).map(row => `${row.pipeId} ${formatSeparatorTraceNumber(row.flow)} m3/h`).join(' + ')} = ${formatSeparatorTraceNumber(hydraulicOutletFlow)} m3/h`
        : `No solved outlet pipe flow = ${formatSeparatorTraceNumber(hydraulicOutletFlow)} m3/h`;
    const sourceFeedSubstitution = (sourceFeedFlows.length
        ? sourceFeedFlows.map(row => `${row.sourceId || 'SRC'} ${formatSeparatorTraceNumber(row.flow)} m3/h`).join(' + ')
        : 'No attached SRC feed flows') + ` = ${formatSeparatorTraceNumber(sourceFeedFlow)} m3/h`;
    const holdupSubstitution = Number.isFinite(holdupVolume)
        ? `${formatSeparatorTraceNumber(holdupFlow)} x (${formatSeparatorTraceNumber(residenceTime)} / 60) = ${formatSeparatorTraceNumber(holdupVolume)} m3`
        : `Flow unavailable x (${formatSeparatorTraceNumber(residenceTime)} / 60)`;

    const steps = [
        createSeparatorTraceStep(
            'Absolute Pressure',
            pressureFormula,
            pressureSubstitution,
            roundSeparatorTraceNumber(pressureAbsBar, 6),
            'bar a',
            pressureBasis === 'Gauge'
                ? 'NIST Guide to the SI Appendix B: 1 standard atmosphere = 101325 Pa = 1.01325 bar'
                : 'Pressure basis conversion',
            3
        ),
        createSeparatorTraceStep(
            'Liquid Surface Elevation',
            'z_liquid = z_base + liquidLevelOffset',
            `${formatSeparatorTraceNumber(baseElevation)} + ${formatSeparatorTraceNumber(liquidLevel)} = ${formatSeparatorTraceNumber(liquidSurfaceElevation)} m`,
            roundSeparatorTraceNumber(liquidSurfaceElevation, 3),
            'm',
            'Tank/vessel boundary inheritance uses liquid surface elevation for source head',
            3
        ),
        createSeparatorTraceStep(
            'Nozzle Elevation Basis',
            'pipe endpoint z = selected inlet/outlet nozzle elevation',
            `zinlet = ${formatSeparatorTraceNumber(inletNozzleElevation)} m; zoutlet = ${formatSeparatorTraceNumber(outletNozzleElevation)} m`,
            roundSeparatorTraceNumber(outletNozzleElevation, 3),
            'm',
            'Hydraulic port elevation model for pipe endpoint elevation',
            3
        ),
        createSeparatorTraceStep(
            'Outlet Submergence',
            'submergence = z_liquid - z_outlet_nozzle',
            `${formatSeparatorTraceNumber(liquidSurfaceElevation)} - ${formatSeparatorTraceNumber(outletNozzleElevation)} = ${formatSeparatorTraceNumber(outletSubmergence)} m`,
            roundSeparatorTraceNumber(outletSubmergence, 3),
            'm',
            'Outlet nozzle should remain below liquid surface for liquid feed service',
            3
        ),
        createSeparatorTraceStep(
            'Pressure Drop Head',
            'hL = dP x 100000 / (rho x g)',
            `${formatSeparatorTraceNumber(pressureDropBar)} x 100000 / (${formatSeparatorTraceNumber(density)} x ${formatSeparatorTraceNumber(getSeparatorGravity())}) = ${formatSeparatorTraceNumber(pressureDropHead)} m`,
            roundSeparatorTraceNumber(pressureDropHead, 3),
            'm',
            'Fluid mechanics pressure-head conversion; hydraulic solver treats vessel pressure drop as equipment minor loss',
            3
        ),
        createSeparatorTraceStep(
            'Solved Flow Basis',
            'Qvessel = solved connected pipe flow',
            flowStepSubstitution,
            Number.isFinite(flowBasis.flow) ? roundSeparatorTraceNumber(flowBasis.flow, 3) : null,
            'm3/h',
            flowBasis.basis,
            3
        ),
        createSeparatorTraceStep(
            'Hydraulic Inlet Flow',
            'Qhyd,in = sum(solved pipe flow entering vessel)',
            hydraulicInletSubstitution,
            roundSeparatorTraceNumber(hydraulicInletFlow, 3),
            'm3/h',
            'Solid hydraulic connections only; dashed SRC attachments are excluded from hydraulic traversal',
            3
        ),
        createSeparatorTraceStep(
            'Hydraulic Outlet Flow',
            'Qhyd,out = sum(solved pipe flow leaving vessel)',
            hydraulicOutletSubstitution,
            roundSeparatorTraceNumber(hydraulicOutletFlow, 3),
            'm3/h',
            'Solid hydraulic connections only; solved pipe direction determines inlet/outlet role',
            3
        ),
        createSeparatorTraceStep(
            'Total SRC Feed Flow',
            'Qsrc,total = sum(attached SRC flow specifications)',
            sourceFeedSubstitution,
            roundSeparatorTraceNumber(sourceFeedFlow, 3),
            'm3/h',
            'Semantic SRC feed/inventory specification; it does not create pipe pressure drop',
            3
        ),
        createSeparatorTraceStep(
            'Vessel Inlet Flow',
            'Qin = Qhyd,in + Qsrc,total',
            `${formatSeparatorTraceNumber(hydraulicInletFlow)} + ${formatSeparatorTraceNumber(sourceFeedFlow)} = ${formatSeparatorTraceNumber(inletFlow)} m3/h`,
            roundSeparatorTraceNumber(inletFlow, 3),
            'm3/h',
            'Steady inventory balance readout',
            3
        ),
        createSeparatorTraceStep(
            'Vessel Net Flow',
            'Qnet = Qin - Qout',
            `${formatSeparatorTraceNumber(inletFlow)} - ${formatSeparatorTraceNumber(outletFlow)} = ${formatSeparatorTraceNumber(netFlow)} m3/h`,
            Number.isFinite(netFlow) ? roundSeparatorTraceNumber(netFlow, 3) : null,
            'm3/h',
            'Positive net flow means vessel level rises; negative net flow means vessel level falls',
            3
        ),
        createSeparatorTraceStep(
            'Level Trend',
            'Level trend = sign(Qnet) with 2% or 0.01 m3/h deadband',
            Number.isFinite(netFlow)
                ? `${formatSeparatorTraceNumber(netFlow)} m3/h with tolerance ${formatSeparatorTraceNumber(flowTolerance)} m3/h`
                : 'No solved or specified flow',
            levelTrend,
            '',
            'Steady inventory readout; liquid level is not dynamically integrated over time',
            3
        ),
        createSeparatorTraceStep(
            'Residence Holdup',
            'Vholdup = Q x residenceTime / 60',
            holdupSubstitution,
            Number.isFinite(holdupVolume) ? roundSeparatorTraceNumber(holdupVolume, 3) : null,
            'm3',
            'Sizing heuristic for residence-time holdup; not an ASME pressure vessel mechanical design calculation',
            3
        )
    ];

    const readouts = [
        { label: 'Vessel Pressure Input', value: pressureInput, unit: pressureInputUnit, key: 'vessel-pressure-input' },
        { label: 'Calculated Abs. Pressure', value: pressureAbsBar, unit: 'bar a', key: 'vessel-absolute-pressure' },
        { label: 'Pressure Drop', value: pressureDropBar, unit: 'bar', key: 'vessel-pressure-drop' },
        { label: 'Pressure Drop Head', value: pressureDropHead, unit: 'm', key: 'vessel-pressure-drop-head' },
        { label: 'Base Elevation', value: baseElevation, unit: 'm', key: 'vessel-base-elevation' },
        { label: 'Liquid Surface Elev.', value: liquidSurfaceElevation, unit: 'm', key: 'vessel-liquid-surface-elevation' },
        { label: 'Inlet Nozzle Elev.', value: inletNozzleElevation, unit: 'm', key: 'vessel-inlet-nozzle-elevation' },
        { label: 'Outlet Nozzle Elev.', value: outletNozzleElevation, unit: 'm', key: 'vessel-outlet-nozzle-elevation' },
        { label: 'Outlet Submergence', value: outletSubmergence, unit: 'm', key: 'vessel-outlet-submergence' },
        { label: 'Residence Time', value: residenceTime, unit: 'min', key: 'vessel-residence-time' },
        { label: 'Solved Vessel Flow', value: flowBasis.flow, unit: 'm3/h', key: 'vessel-flow' },
        { label: 'Hydraulic Inlet Flow', value: hydraulicInletFlow, unit: 'm3/h', key: 'vessel-hydraulic-inlet-flow' },
        { label: 'Hydraulic Outlet Flow', value: hydraulicOutletFlow, unit: 'm3/h', key: 'vessel-hydraulic-outlet-flow' },
        { label: 'Total SRC Feed Flow', value: sourceFeedFlow, unit: 'm3/h', key: 'vessel-source-feed-flow' },
        { label: 'Inlet Flow', value: inletFlow, unit: 'm3/h', key: 'vessel-inlet-flow' },
        { label: 'Outlet Flow', value: outletFlow, unit: 'm3/h', key: 'vessel-outlet-flow' },
        { label: 'Net Flow', value: netFlow, unit: 'm3/h', key: 'vessel-net-flow' },
        { label: 'Level Trend', value: levelTrend, unit: '', key: 'vessel-level-trend' },
        { label: 'Residence Holdup', value: holdupVolume, unit: 'm3', key: 'vessel-holdup-volume' },
        { label: 'Fluid Density Used', value: density, unit: 'kg/m3', key: 'vessel-density' },
        { label: 'Fluid Vapor Pressure', value: vaporPressure, unit: 'bar a', key: 'vessel-vapor-pressure' }
    ];

    const dependencyChain = [
        'Pressure Basis -> vessel absolute pressure; gauge inputs add standard atmosphere.',
        'Base elevation + liquid level offset -> liquid surface elevation used by SRC Pressurized Vessel inheritance.',
        'Inlet/outlet nozzle elevations -> hydraulic pipe endpoint elevations, not source liquid-level elevation.',
        'Pressure drop + active Fluid Basis density -> equipment head loss included in hydraulic path traversal.',
        `Solid hydraulic pipe flows entering/leaving ${vesselLabel} -> Hydraulic Inlet Flow and Hydraulic Outlet Flow.`,
        'Dashed SRC attachment flow specification -> Total SRC Feed Flow for vessel inventory balance only; it is not pressure-drop flow path traversal.',
        'Inlet Flow - Outlet Flow -> Net Flow; Net Flow sign -> Level Trend.',
        'Solved connected pipe flow + residence time -> estimated process holdup volume.',
        'Active Fluid Basis vapor pressure -> warning if vessel pressure approaches vapor pressure.',
        `Dashed SRC attachment may inherit ${vesselLabel} pressure and liquid surface elevation, but hydraulic flow still requires solid pipe connections.`
    ];

    return {
        status: warnings.length ? 'Review' : 'OK',
        inputBasis: {
            vesselId: nodeId || node.name || '-',
            vesselLabel,
            vesselType: objectMeta.vesselType,
            orientation: props.orientation || objectMeta.orientation,
            pressureInputBasis: pressureBasis,
            pressureInputUnit,
            unitStandard: typeof getUnitStandard === 'function' ? getUnitStandard() : 'Internal metric engineering units',
            flowBasis: flowBasis.basis,
            connectedPipes: connectionRows.map(row => row.text),
            attachedSources,
            levelTrend,
            modelBasis: `Simplified hydraulic/process ${objectMeta.orientation.toLowerCase()} vessel boundary; not ${objectMeta.sizingScope}.`
        },
        boundary: {
            pressureInput: roundSeparatorTraceNumber(pressureInput, 6),
            pressureAbsBar: roundSeparatorTraceNumber(pressureAbsBar, 6),
            pressureDropBar: roundSeparatorTraceNumber(pressureDropBar, 6),
            pressureDropHead: roundSeparatorTraceNumber(pressureDropHead, 3),
            baseElevation: roundSeparatorTraceNumber(baseElevation, 3),
            liquidLevel,
            liquidSurfaceElevation: roundSeparatorTraceNumber(liquidSurfaceElevation, 3),
            inletNozzleElevation: roundSeparatorTraceNumber(inletNozzleElevation, 3),
            outletNozzleElevation: roundSeparatorTraceNumber(outletNozzleElevation, 3),
            outletSubmergence: roundSeparatorTraceNumber(outletSubmergence, 3),
            flow: Number.isFinite(flowBasis.flow) ? roundSeparatorTraceNumber(flowBasis.flow, 3) : null,
            holdupFlow: Number.isFinite(holdupFlow) ? roundSeparatorTraceNumber(holdupFlow, 3) : null,
            holdupVolume: Number.isFinite(holdupVolume) ? roundSeparatorTraceNumber(holdupVolume, 3) : null
        },
        flowBalance: {
            connectedPipes: connectionRows.map(row => row.pipeId),
            connectedSources: attachedSources,
            sourceFeedFlows,
            hydraulicInletFlow: roundSeparatorTraceNumber(hydraulicInletFlow, 3),
            hydraulicOutletFlow: roundSeparatorTraceNumber(hydraulicOutletFlow, 3),
            sourceFeedFlow: roundSeparatorTraceNumber(sourceFeedFlow, 3),
            inletFlow: roundSeparatorTraceNumber(inletFlow, 3),
            outletFlow: roundSeparatorTraceNumber(outletFlow, 3),
            netFlow: Number.isFinite(netFlow) ? roundSeparatorTraceNumber(netFlow, 3) : null,
            levelTrend
        },
        standardExample,
        readouts,
        dependencyChain,
        steps,
        warnings: [...new Set(warnings)],
        assumptions: [
            `${vesselLabel} is modeled as a hydraulic equipment/boundary object with user-entered pressure drop and residence-time holdup estimate.`,
            'Mechanical vessel wall thickness, MAWP, nozzle reinforcement, relief sizing, and phase-separation performance are not calculated.',
            'Liquid level offset is relative to base elevation; nozzle elevations are absolute hydraulic port elevations.',
            `${vesselLabel} flow balance is a steady inventory readout. It does not integrate liquid level dynamically with time.`,
            'Attached SRC feed rows contribute to inventory balance but do not replace the required solid hydraulic path for pressure loss and NPSH calculations.',
            'The pressure drop field is converted to head loss using active Fluid Basis density.'
        ],
        references: [
            'pdf_ref/ref1-fluid-mechanics-fundaments-and-applications.pdf: pressure head, Bernoulli/energy balance, hydrostatic elevation, density, vapor pressure, and head-loss fundamentals.',
            'pdf_ref/ref2-introduction-fluid-mechanics.pdf: steady incompressible energy balance and pressure/elevation head interpretation.',
            'pdf_ref/ref4-standar_ANSI-9-6-2024_rotodynamic_pump_guidline_for_NPSH_margin-hydraulic-institute.pdf: NPSH source pressure, vapor pressure head, liquid level/datum, and suction-loss context.',
            'NIST Guide to the SI Appendix B: 1 standard atmosphere = 101325 Pa exactly.',
            'NIST Chemistry WebBook SRD 69: active Fluid Basis density and vapor-pressure checks when a supported pure fluid is selected.',
            'GPSA Engineering Data Book / API 12J are appropriate future references for detailed oil/gas separator sizing; not available in local pdf_ref, so separation-sizing performance remains needs verification.'
        ]
    };
}
