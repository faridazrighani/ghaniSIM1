function calculateHeatDutyKW(massFlowKgS, specificHeatKJkgK, deltaTempK) {
    return (massFlowKgS || 0) * (specificHeatKJkgK || 0) * (deltaTempK || 0);
}

function toHeatExchangerTraceNumber(value, fallback = NaN) {
    const numeric = parseFloat(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function roundHeatExchangerTraceNumber(value, digits = 3) {
    const numeric = parseFloat(value);
    if (!Number.isFinite(numeric)) return null;
    return Number(numeric.toFixed(digits));
}

function formatHeatExchangerTraceNumber(value, digits = 3) {
    const numeric = parseFloat(value);
    if (!Number.isFinite(numeric)) return '-';
    return numeric.toFixed(digits);
}

function getHeatExchangerGravity() {
    return typeof getHydraulicGravity === 'function' ? getHydraulicGravity() : 9.81;
}

function pressureDropBarToHeatExchangerHead(dpBar, density) {
    const dp = Math.max(toHeatExchangerTraceNumber(dpBar, 0), 0);
    const rho = Math.max(toHeatExchangerTraceNumber(density, 1000), 1);
    if (typeof pressureBarToHead === 'function') return pressureBarToHead(dp, rho);
    return dp * 100000 / (rho * getHeatExchangerGravity());
}

function createHeatExchangerTraceStep(title, formula, substitution, result, unit, reference, digits = 3) {
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

function getHeatExchangerTraceConnections(nodeId, model = globalModel, connectionList = connections) {
    if (!nodeId || !Array.isArray(connectionList)) return [];
    return connectionList
        .filter(conn => conn && conn.pipeId && conn.connectionType !== 'semantic' && (conn.from === nodeId || conn.to === nodeId))
        .map(conn => (typeof getOrientedHydraulicConnection === 'function'
            ? getOrientedHydraulicConnection(conn)
            : conn))
        .filter(Boolean)
        .map(conn => {
            const pipe = model?.[conn.pipeId];
            const flow = toHeatExchangerTraceNumber(pipe?.results?.flow, NaN);
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

function getHeatExchangerTraceFlowBasis(connectionRows = []) {
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

function heatExchangerPathContainsNode(path, nodeId, terminalNodeId, model) {
    if (!path || !nodeId || !Array.isArray(path.steps)) return false;
    const entryNodeId = typeof getHydraulicPathEntryEquipmentNodeId === 'function'
        ? getHydraulicPathEntryEquipmentNodeId(path, terminalNodeId, model)
        : null;
    if (entryNodeId === nodeId) return true;
    return path.steps.some(step => step.from === nodeId || step.to === nodeId);
}

function getHeatExchangerNpshPathInfo(nodeId, model = globalModel, connectionList = connections, density = 1000, vaporPressureBar = 0) {
    const pumpIds = Object.keys(model || {}).filter(id => model[id]?.type === 'pump');
    const rows = [];

    pumpIds.forEach(pumpId => {
        let suctionPath = null;
        let dischargePath = null;
        if (typeof createPumpHydraulicContext === 'function') {
            const context = createPumpHydraulicContext(
                pumpId,
                model,
                connectionList,
                density,
                Math.max(toHeatExchangerTraceNumber(vaporPressureBar, 0), 0) * 100000
            );
            suctionPath = context?.suctionPath || null;
            dischargePath = context?.dischargePath || null;
        } else if (typeof window !== 'undefined' && window.hydraulicNetworkState?.pumps?.[pumpId]) {
            suctionPath = window.hydraulicNetworkState.pumps[pumpId].suctionPath || null;
            dischargePath = window.hydraulicNetworkState.pumps[pumpId].dischargePath || null;
        }

        if (heatExchangerPathContainsNode(suctionPath, nodeId, pumpId, model)) {
            rows.push({ pumpId, role: 'Suction path', npshEffect: 'Subtracts from NPSHA as suction loss' });
        } else if (heatExchangerPathContainsNode(dischargePath, nodeId, dischargePath?.boundaryId, model)) {
            rows.push({ pumpId, role: 'Discharge path', npshEffect: 'Does not subtract from pump suction NPSHA' });
        }
    });

    return rows;
}

function buildHeatExchangerCalculationTrace(nodeIdOrNode, model = globalModel, connectionList = connections) {
    const nodeId = typeof nodeIdOrNode === 'string' ? nodeIdOrNode : (nodeIdOrNode?.id || nodeIdOrNode?.name || '');
    const node = typeof nodeIdOrNode === 'string' ? model?.[nodeIdOrNode] : nodeIdOrNode;
    if (!node || node.type !== 'heatExchanger') return null;

    const props = node.props || {};
    const fluidProps = model?.FLUID?.props || {};
    const density = Math.max(toHeatExchangerTraceNumber(fluidProps.density, 1000), 1);
    const specificHeatInput = toHeatExchangerTraceNumber(fluidProps.specificHeat, NaN);
    const specificHeat = Number.isFinite(specificHeatInput) ? specificHeatInput : 4.181;
    const vaporPressure = toHeatExchangerTraceNumber(fluidProps.vaporPressure, 0);
    const fluidTemp = toHeatExchangerTraceNumber(fluidProps.temp, 25);
    const dutyInput = toHeatExchangerTraceNumber(props.duty, 0);
    const pressureDropBar = toHeatExchangerTraceNumber(props.pressureDrop, 0);
    const positivePressureDropBar = Math.max(pressureDropBar, 0);
    const outletTemp = toHeatExchangerTraceNumber(props.outletTemp, fluidTemp);
    const deltaTemp = outletTemp - fluidTemp;
    const pressureDropHead = pressureDropBarToHeatExchangerHead(pressureDropBar, density);
    const connectionRows = getHeatExchangerTraceConnections(nodeId, model, connectionList);
    const flowBasis = getHeatExchangerTraceFlowBasis(connectionRows);
    const flowM3H = Number.isFinite(flowBasis.flow) ? flowBasis.flow : null;
    const massFlowKgH = Number.isFinite(flowM3H) ? flowM3H * density : null;
    const massFlowKgS = Number.isFinite(massFlowKgH) ? massFlowKgH / 3600 : null;
    const calculatedDuty = Number.isFinite(massFlowKgS)
        ? calculateHeatDutyKW(massFlowKgS, specificHeat, deltaTemp)
        : null;
    const dutyResidual = Number.isFinite(calculatedDuty) ? dutyInput - calculatedDuty : null;
    const pathInfo = getHeatExchangerNpshPathInfo(nodeId, model, connectionList, density, vaporPressure);
    const suctionPathRows = pathInfo.filter(row => row.role === 'Suction path');
    const npshLossContribution = suctionPathRows.length ? pressureDropHead : 0;
    const warnings = [];
    const assumptions = [
        'Heat Exchanger is modeled as simplified hydraulic equipment with user-entered pressure drop; detailed UA/LMTD/NTU sizing is not calculated.',
        'Pressure drop is converted to liquid head using the active Fluid Basis density and is included by the hydraulic solver when the exchanger lies on a solid hydraulic path.',
        'Thermal duty from flow is a realtime consistency check only: Qdot = m_dot x Cp x (Tout - Tin).',
        'NPSH vapor pressure still comes from the active Fluid Basis temperature. Change Fluid Basis or SRC temperature mode when suction fluid temperature changes before the pump.'
    ];

    if (pressureDropBar < 0) {
        warnings.push('Pressure Drop is negative; hydraulic loss calculation clamps it to zero.');
    }
    if (!connectionRows.length) {
        warnings.push('Heat Exchanger is not connected by a solid hydraulic pipe path.');
    } else if (!connectionRows.some(row => row.solved)) {
        warnings.push('Connected pipe flow is not solved; thermal duty from flow is unavailable.');
    }
    if (!Number.isFinite(specificHeatInput)) {
        warnings.push('Specific heat is missing from Fluid Basis; fallback 4.181 kJ/kg.K is used for the duty check.');
    }

    const flowStepSubstitution = Number.isFinite(flowM3H)
        ? `${connectionRows.filter(row => Number.isFinite(row.flow)).map(row => `${row.pipeId} ${formatHeatExchangerTraceNumber(row.flow)} m3/h`).join(' + ')} = ${formatHeatExchangerTraceNumber(flowM3H)} m3/h`
        : 'No solved connected pipe flow';
    const massFlowSubstitution = Number.isFinite(massFlowKgH)
        ? `${formatHeatExchangerTraceNumber(flowM3H)} x ${formatHeatExchangerTraceNumber(density)} = ${formatHeatExchangerTraceNumber(massFlowKgH)} kg/h`
        : 'Flow unavailable x density';
    const dutySubstitution = Number.isFinite(calculatedDuty)
        ? `(${formatHeatExchangerTraceNumber(massFlowKgH)} / 3600) x ${formatHeatExchangerTraceNumber(specificHeat)} x ${formatHeatExchangerTraceNumber(deltaTemp)} = ${formatHeatExchangerTraceNumber(calculatedDuty)} kW`
        : 'Mass flow unavailable x Cp x deltaT';
    const npshSubstitution = suctionPathRows.length
        ? `${formatHeatExchangerTraceNumber(pressureDropHead)} m is included in suction path loss before pump suction`
        : 'Not in a detected pump suction path = 0 m direct NPSHA loss contribution';

    const steps = [
        createHeatExchangerTraceStep(
            'Pressure Drop Sanitization',
            'dP_loss = max(dP_input, 0)',
            `max(${formatHeatExchangerTraceNumber(pressureDropBar)}, 0) = ${formatHeatExchangerTraceNumber(positivePressureDropBar)} bar`,
            roundHeatExchangerTraceNumber(positivePressureDropBar, 6),
            'bar',
            'Hydraulic solver uses non-negative equipment pressure loss',
            3
        ),
        createHeatExchangerTraceStep(
            'Pressure Drop Head',
            'hL = dP x 100000 / (rho x g)',
            `${formatHeatExchangerTraceNumber(positivePressureDropBar)} x 100000 / (${formatHeatExchangerTraceNumber(density)} x ${formatHeatExchangerTraceNumber(getHeatExchangerGravity())}) = ${formatHeatExchangerTraceNumber(pressureDropHead)} m`,
            roundHeatExchangerTraceNumber(pressureDropHead, 3),
            'm',
            'Pressure-head conversion from Bernoulli/energy balance; hydraulic solver treats HX pressure drop as equipment loss',
            3
        ),
        createHeatExchangerTraceStep(
            'Temperature Change',
            'deltaT = Tout - Tin',
            `${formatHeatExchangerTraceNumber(outletTemp)} - ${formatHeatExchangerTraceNumber(fluidTemp)} = ${formatHeatExchangerTraceNumber(deltaTemp)} deg C`,
            roundHeatExchangerTraceNumber(deltaTemp, 3),
            'deg C',
            'Temperature difference in deg C has the same interval magnitude as kelvin',
            3
        ),
        createHeatExchangerTraceStep(
            'Hydraulic Flow Basis',
            'Q = solved connected hydraulic pipe flow',
            flowStepSubstitution,
            Number.isFinite(flowM3H) ? roundHeatExchangerTraceNumber(flowM3H, 3) : null,
            'm3/h',
            flowBasis.basis,
            3
        ),
        createHeatExchangerTraceStep(
            'Mass Flow',
            'm_dot = Q x rho',
            massFlowSubstitution,
            Number.isFinite(massFlowKgH) ? roundHeatExchangerTraceNumber(massFlowKgH, 3) : null,
            'kg/h',
            'Density from active Fluid Basis converts volumetric flow to mass flow',
            3
        ),
        createHeatExchangerTraceStep(
            'Thermal Duty from Flow',
            'Qdot = (m_dot / 3600) x Cp x deltaT',
            dutySubstitution,
            Number.isFinite(calculatedDuty) ? roundHeatExchangerTraceNumber(calculatedDuty, 3) : null,
            'kW',
            'Steady-flow sensible heat relation Qdot = m_dot Cp deltaT',
            3
        ),
        createHeatExchangerTraceStep(
            'Duty Residual',
            'Residual = Duty input - calculated duty',
            Number.isFinite(dutyResidual)
                ? `${formatHeatExchangerTraceNumber(dutyInput)} - ${formatHeatExchangerTraceNumber(calculatedDuty)} = ${formatHeatExchangerTraceNumber(dutyResidual)} kW`
                : 'Duty input - unavailable calculated duty',
            Number.isFinite(dutyResidual) ? roundHeatExchangerTraceNumber(dutyResidual, 3) : null,
            'kW',
            'Residual is a consistency check, not a solver correction',
            3
        ),
        createHeatExchangerTraceStep(
            'NPSH Loss Contribution',
            'NPSHA effect = -hL_HX if HX is on pump suction path',
            npshSubstitution,
            roundHeatExchangerTraceNumber(npshLossContribution, 3),
            'm',
            'NPSHA subtracts suction path losses before vapor pressure head comparison',
            3
        )
    ];

    const readouts = [
        { label: 'Duty Input', value: dutyInput, unit: 'kW', key: 'hx-duty-input' },
        { label: 'Pressure Drop', value: pressureDropBar, unit: 'bar', key: 'hx-pressure-drop' },
        { label: 'Pressure Drop Head', value: pressureDropHead, unit: 'm', key: 'hx-pressure-drop-head' },
        { label: 'Fluid Basis Inlet Temp', value: fluidTemp, unit: 'deg C', key: 'hx-inlet-temp' },
        { label: 'Outlet Temp', value: outletTemp, unit: 'deg C', key: 'hx-outlet-temp' },
        { label: 'Delta T', value: deltaTemp, unit: 'deg C', key: 'hx-delta-temp' },
        { label: 'Solved HX Flow', value: flowM3H, unit: 'm3/h', key: 'hx-flow' },
        { label: 'Mass Flow', value: massFlowKgH, unit: 'kg/h', key: 'hx-mass-flow' },
        { label: 'Calculated Thermal Duty', value: calculatedDuty, unit: 'kW', key: 'hx-calculated-duty' },
        { label: 'Duty Residual', value: dutyResidual, unit: 'kW', key: 'hx-duty-residual' },
        { label: 'Fluid Density Used', value: density, unit: 'kg/m3', key: 'hx-density' },
        { label: 'Specific Heat Used', value: specificHeat, unit: 'kJ/kg.K', key: 'hx-specific-heat' },
        { label: 'Fluid Vapor Pressure', value: vaporPressure, unit: 'bar a', key: 'hx-vapor-pressure' },
        { label: 'NPSH Loss Contribution', value: npshLossContribution, unit: 'm', key: 'hx-npsh-loss-contribution' }
    ];

    const dependencyChain = [
        'Active Fluid Basis density + Heat Exchanger pressure drop -> pressure-drop head.',
        'Solid hydraulic connection membership -> exchanger pressure drop is included as equipment loss in the hydraulic path.',
        'If Heat Exchanger is upstream of pump suction, pressure-drop head subtracts from NPSHA as suction loss.',
        'If Heat Exchanger is on discharge side, its pressure drop affects discharge/system head but not pump suction NPSHA.',
        'Active Fluid Basis temperature + Heat Exchanger outlet temperature -> deltaT.',
        'Solved hydraulic flow + active Fluid Basis density -> mass flow.',
        'Mass flow + Fluid Basis specific heat + deltaT -> calculated sensible heat duty.',
        'Active Fluid Basis vapor pressure -> pump vapor pressure head; exchanger outlet temperature does not automatically redefine NPSH vapor pressure.'
    ];

    return {
        status: warnings.length ? 'Review' : 'OK',
        inputBasis: {
            exchangerId: nodeId || node.name || '-',
            modelBasis: 'Simplified hydraulic/process heat exchanger; fixed pressure drop plus sensible heat duty check.',
            unitStandard: typeof getUnitStandard === 'function' ? getUnitStandard() : 'Internal metric engineering units',
            fluidName: fluidProps.fluidName || 'Fluid Basis',
            flowBasis: flowBasis.basis,
            connectedPipes: connectionRows.map(row => row.text),
            npshPathRole: pathInfo.length
                ? pathInfo.map(row => `${row.pumpId}: ${row.role}`).join(' | ')
                : 'No detected pump suction/discharge path role'
        },
        hydraulic: {
            pressureDropBar: roundHeatExchangerTraceNumber(pressureDropBar, 6),
            positivePressureDropBar: roundHeatExchangerTraceNumber(positivePressureDropBar, 6),
            pressureDropHead: roundHeatExchangerTraceNumber(pressureDropHead, 3),
            flow: Number.isFinite(flowM3H) ? roundHeatExchangerTraceNumber(flowM3H, 3) : null,
            massFlowKgH: Number.isFinite(massFlowKgH) ? roundHeatExchangerTraceNumber(massFlowKgH, 3) : null,
            npshLossContribution: roundHeatExchangerTraceNumber(npshLossContribution, 3)
        },
        thermal: {
            dutyInput: roundHeatExchangerTraceNumber(dutyInput, 3),
            inletTemp: roundHeatExchangerTraceNumber(fluidTemp, 3),
            outletTemp: roundHeatExchangerTraceNumber(outletTemp, 3),
            deltaTemp: roundHeatExchangerTraceNumber(deltaTemp, 3),
            specificHeat: roundHeatExchangerTraceNumber(specificHeat, 3),
            calculatedDuty: Number.isFinite(calculatedDuty) ? roundHeatExchangerTraceNumber(calculatedDuty, 3) : null,
            dutyResidual: Number.isFinite(dutyResidual) ? roundHeatExchangerTraceNumber(dutyResidual, 3) : null
        },
        fluid: {
            density: roundHeatExchangerTraceNumber(density, 3),
            vaporPressure: roundHeatExchangerTraceNumber(vaporPressure, 6),
            specificHeat: roundHeatExchangerTraceNumber(specificHeat, 3)
        },
        npshPathInfo: pathInfo,
        readouts,
        dependencyChain,
        steps,
        warnings: [...new Set(warnings)],
        assumptions,
        references: [
            'pdf_ref/ref1-fluid-mechanics-fundaments-and-applications.pdf: pressure head, Bernoulli/energy balance, specific heat, and head-loss fundamentals.',
            'pdf_ref/ref2-introduction-fluid-mechanics.pdf: steady-flow energy balance and pressure/elevation head interpretation.',
            'pdf_ref/ref4-standar_ANSI-9-6-2024_rotodynamic_pump_guidline_for_NPSH_margin-hydraulic-institute.pdf: NPSHA definition, vapor pressure head, suction loss, and datum context.',
            'NIST Chemistry WebBook SRD 69: active Fluid Basis property reference for supported pure fluids.',
            'NASA Glenn Bernoulli page: static plus dynamic pressure as energy/pressure terms for hydraulic head interpretation.'
        ]
    };
}
