const EQUIPMENT_SCHEMAS = {
    tank: TANK_SCHEMA,
    pipe: PIPE_SCHEMA,
    valve: VALVE_SCHEMA,
    checkValve: CHECK_VALVE_SCHEMA,
    separator: SEPARATOR_SCHEMA,
    verticalVessel: VERTICAL_VESSEL_SCHEMA,
    heatExchanger: HEAT_EXCHANGER_SCHEMA,
    mixer: MIXER_SCHEMA,
    pressureIndicator: PRESSURE_INDICATOR_SCHEMA,
    flowIndicator: FLOW_INDICATOR_SCHEMA,
    temperatureIndicator: TEMPERATURE_INDICATOR_SCHEMA,
    lineMonitor: LINE_MONITOR_SCHEMA,
    levelController: LEVEL_CONTROLLER_SCHEMA,
    source: SOURCE_SCHEMA,
    sink: SINK_SCHEMA,
    junction: JUNCTION_SCHEMA
};

function copyDefaultValue(value) {
    if (Array.isArray(value)) return value.map(item => ({ ...item }));
    if (value && typeof value === 'object') return { ...value };
    return value;
}

function getDefaultProps(type) {
    if (type === 'pump') {
        return {
            ...PUMP_DEFAULT_PROPS,
            curveData: PUMP_DEFAULT_PROPS.curveData.map(point => ({ ...point }))
        };
    }

    const props = {};
    if (EQUIPMENT_SCHEMAS[type]) {
        for (let key in EQUIPMENT_SCHEMAS[type]) {
            props[key] = copyDefaultValue(EQUIPMENT_SCHEMAS[type][key].default);
        }
    }

    if (type === 'pipe') {
        props.segments = PIPE_DEFAULT_SEGMENTS.map(segment => ({ ...segment }));
    }

    return props;
}

function getSourceHydraulicConnectionRows(nodeId) {
    if (typeof connections === 'undefined' || !Array.isArray(connections)) return [];
    return connections
        .filter(conn => conn && conn.pipeId && conn.connectionType !== 'semantic' && (conn.from === nodeId || conn.to === nodeId))
        .map(conn => {
            const otherId = conn.from === nodeId ? conn.to : conn.from;
            return {
                pipeId: conn.pipeId,
                otherId,
                text: `${conn.pipeId} -> ${otherId || '-'}`
            };
        });
}

function getSourcePumpPathInfo(nodeId) {
    if (typeof createPumpHydraulicContext !== 'function') {
        return { status: 'Not evaluated', pumpId: '', pathText: '-', warnings: [] };
    }

    const fluidProps = globalModel.FLUID?.props || {};
    const density = parseFloat(fluidProps.density);
    const vaporPressurePa = parseFloat(fluidProps.vaporPressure) * 100000;
    const pumpIds = Object.keys(globalModel).filter(id => globalModel[id]?.type === 'pump');

    for (const pumpId of pumpIds) {
        const context = createPumpHydraulicContext(
            pumpId,
            globalModel,
            connections,
            Number.isFinite(density) ? density : 1000,
            Number.isFinite(vaporPressurePa) ? vaporPressurePa : 0
        );
        if (context?.suctionPath?.boundaryId === nodeId) {
            const steps = context.suctionPath.steps || [];
            const pathText = steps.length
                ? steps.map(step => `${step.from} - ${step.pipeId} -> ${step.to}`).join(' | ')
                : nodeId;
            return {
                status: context.isComplete ? `Valid to ${pumpId}` : `Incomplete to ${pumpId}`,
                pumpId,
                pathText,
                warnings: context.networkWarnings || context.suctionPath.warnings || []
            };
        }
    }

    return {
        status: 'Missing path to pump suction',
        pumpId: '',
        pathText: '-',
        warnings: []
    };
}

function renderSourceConnectionControls(nodeId, node, addRow, tbody) {
    if (typeof syncSourceAttachmentProps === 'function') {
        syncSourceAttachmentProps(nodeId);
    }
    const canUseSemanticAttachment = typeof isSourceTypeSemanticAttachmentCapable === 'function'
        ? isSourceTypeSemanticAttachmentCapable(node)
        : ['Open Tank / Reservoir', 'Pressurized Vessel'].includes(node.props?.sourceType);
    const sourceLink = typeof getSourceLink === 'function' ? getSourceLink(nodeId) : null;
    const hydraulicConnections = getSourceHydraulicConnectionRows(nodeId);
    const pumpPath = getSourcePumpPathInfo(nodeId);

    appendSectionHeader(tbody, canUseSemanticAttachment ? 'Semantic Attachment' : 'Hydraulic Connection');

    if (canUseSemanticAttachment) {
        addRow('Attachment Role', 'Semantic only - not a hydraulic pipe', 'source-attachment-role', true);
        addRow('Attached Equipment', node.props.attachedTo || '-', 'source-attached-to', true);
        addRow('Hydraulic Requirement', 'Add pipe/hydraulic components from attached equipment outlet to pump suction.', 'source-connection-requirement', true);
    } else {
        addRow('Connection Role', 'Hydraulic boundary; solid pipe required', 'source-attachment-role', true);
        addRow('Solid Pipe(s)', hydraulicConnections.map(item => item.text).join(', ') || '-', 'source-hydraulic-pipes', true);
        addRow('Hydraulic Requirement', 'Connect the SRC outlet to pipe/valve/equipment/pump suction with a solid hydraulic connection.', 'source-connection-requirement', true);
    }

    addRow('Hydraulic Path to Pump', pumpPath.status, 'source-pump-path-status', true);
    addRow('Suction Path', pumpPath.pathText, 'source-pump-path', true);
    if (pumpPath.warnings?.length) {
        addRow('Path Warnings', pumpPath.warnings.join(' | '), 'source-pump-path-warnings', true);
    }

    const note = canUseSemanticAttachment
        ? 'Attachment only. Hydraulic flow path must be created using pipe or hydraulic components.'
        : 'This source type is a hydraulic boundary/tie-in. Use a solid pipe or hydraulic component from the SRC port.';

    const actionTr = document.createElement('tr');
    const attachButton = canUseSemanticAttachment
        ? `<button class="btn-add-segment" data-node="${nodeId}">Start Dashed Tank/Vessel Attachment</button>`
        : `<button class="btn-add-segment source-start-pipe" data-node="${nodeId}">Start Solid Hydraulic Pipe from SRC</button>`;
    const detachButton = sourceLink
        ? `<button class="btn-disconnect-pipe" data-node="${nodeId}" style="margin-top: 6px;">${canUseSemanticAttachment ? 'Detach from equipment' : 'Clear dashed attachment'}</button>`
        : '';
    actionTr.innerHTML = `
        <td colspan="2" style="padding: 8px 12px;">
            <div class="source-attachment-note">${escapeHtml(note)}</div>
            ${attachButton}
            ${detachButton}
        </td>
    `;
    tbody.appendChild(actionTr);

    actionTr.querySelector('.btn-add-segment:not(.source-start-pipe)')?.addEventListener('click', () => {
        setAppMode('CONNECT');
        startSourceAttachment(nodeId);
    });
    actionTr.querySelector('.source-start-pipe')?.addEventListener('click', () => {
        if (typeof startHydraulicConnectionFromSource === 'function') {
            startHydraulicConnectionFromSource(nodeId);
        }
    });
    actionTr.querySelector('.btn-disconnect-pipe')?.addEventListener('click', () => {
        detachSourceFromEquipment(nodeId);
    });
}

function appendSectionHeader(tbody, title) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="2" class="prop-section-header">${title}</td>`;
    tbody.appendChild(tr);
}

function renderTankAdvancedInventoryData(nodeId, node, tbody) {
    const tr = document.createElement('tr');
    tr.className = 'tank-advanced-inventory-row';
    tr.innerHTML = `
        <td colspan="2" class="advanced-section-cell">
            <details class="advanced-section tank-advanced-inventory">
                <summary>Advanced Inventory Data</summary>
                <table class="advanced-section-table">
                    <tbody>
                        <tr>
                            <td class="prop-label">Tank Diameter</td>
                            <td class="prop-value"><input class="prop-input-field tank-inventory-input" type="number" data-node="${escapeHtml(nodeId)}" data-key="diameter" value="${escapeHtml(node.props.diameter)}"> m</td>
                        </tr>
                        <tr>
                            <td class="prop-label">Tank Height</td>
                            <td class="prop-value"><input class="prop-input-field tank-inventory-input" type="number" data-node="${escapeHtml(nodeId)}" data-key="tankHeight" value="${escapeHtml(node.props.tankHeight)}"> m</td>
                        </tr>
                        <tr>
                            <td class="prop-label">Liquid Volume</td>
                            <td class="prop-value" data-key="tank-liquid-volume">${formatReadoutValue(node.props.liquidVolume)} m3</td>
                        </tr>
                        <tr>
                            <td class="prop-label">Total Capacity</td>
                            <td class="prop-value" data-key="tank-total-capacity">${formatReadoutValue(node.props.totalCapacity)} m3</td>
                        </tr>
                        <tr>
                            <td class="prop-label">Fill Percentage</td>
                            <td class="prop-value" data-key="tank-fill-percent">${formatReadoutValue(node.props.fillPercent)} %</td>
                        </tr>
                        <tr>
                            <td class="prop-label">Current Level</td>
                            <td class="prop-value"><input class="prop-input-field tank-inventory-input" type="number" data-node="${escapeHtml(nodeId)}" data-key="liquidLevel" value="${escapeHtml(node.props.liquidLevel)}"> m</td>
                        </tr>
                        <tr>
                            <td class="prop-label">High Liquid Level (HLL)</td>
                            <td class="prop-value"><input class="prop-input-field tank-inventory-input" type="number" data-node="${escapeHtml(nodeId)}" data-key="hll" value="${escapeHtml(node.props.hll)}"> m</td>
                        </tr>
                        <tr>
                            <td class="prop-label">Normal Liq. Level (NLL)</td>
                            <td class="prop-value"><input class="prop-input-field tank-inventory-input" type="number" data-node="${escapeHtml(nodeId)}" data-key="nll" value="${escapeHtml(node.props.nll)}"> m</td>
                        </tr>
                        <tr>
                            <td class="prop-label">Low Liquid Level (LLL)</td>
                            <td class="prop-value"><input class="prop-input-field tank-inventory-input" type="number" data-node="${escapeHtml(nodeId)}" data-key="lll" value="${escapeHtml(node.props.lll)}"> m</td>
                        </tr>
                        <tr>
                            <td class="prop-label">Transmitter Elev. from Datum</td>
                            <td class="prop-value"><input class="prop-input-field tank-inventory-input" type="number" data-node="${escapeHtml(nodeId)}" data-key="tLevelElev" value="${escapeHtml(node.props.tLevelElev)}"> m</td>
                        </tr>
                    </tbody>
                </table>
            </details>
        </td>
    `;
    tbody.appendChild(tr);

    tr.querySelectorAll('.tank-inventory-input').forEach(input => {
        input.addEventListener('blur', () => {
            if (typeof releaseSidebarEditCapture === 'function') releaseSidebarEditCapture(input);
        });
        input.addEventListener('input', event => {
            const key = event.target.dataset.key;
            const value = parseFloat(event.target.value) || 0;
            if (typeof captureSidebarEdit === 'function') captureSidebarEdit(event.target);
            node.props[key] = value;

            if (['diameter', 'tankHeight', 'liquidLevel'].includes(key)) {
                if (typeof refreshTankInventoryCalculations === 'function') {
                    refreshTankInventoryCalculations(node.props);
                } else if (typeof calculateTankLiquidVolume === 'function') {
                    node.props.liquidVolume = calculateTankLiquidVolume(node.props.diameter || 0, node.props.liquidLevel || 0);
                }
                const liquidVolumeCell = tr.querySelector('[data-key="tank-liquid-volume"]');
                const capacityCell = tr.querySelector('[data-key="tank-total-capacity"]');
                const fillCell = tr.querySelector('[data-key="tank-fill-percent"]');
                if (liquidVolumeCell) liquidVolumeCell.textContent = `${formatReadoutValue(node.props.liquidVolume)} m3`;
                if (capacityCell) capacityCell.textContent = `${formatReadoutValue(node.props.totalCapacity)} m3`;
                if (fillCell) fillCell.textContent = `${formatReadoutValue(node.props.fillPercent)} %`;
            }

            if (typeof updateSimulation === 'function') {
                updateSimulation({ renderSidebarAfter: false });
            }
        });
    });
}

function renderSinkReadoutCards(node, tbody) {
    const results = node.results || {};
    const warnings = results.warnings || [];
    const calculatedPressureLabel = results.boundaryMode === 'Flow Demand'
        ? 'Required Boundary P'
        : 'Calc. Boundary P';
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td colspan="2" style="padding: 10px 12px;">
            <div class="boundary-result-grid">
                <div class="boundary-result-card">
                    <span>Attached Pipe</span>
                    <strong class="prop-value" data-key="sink-attached-pipe">${escapeHtml(results.attachedPipe || '-')}</strong>
                </div>
                <div class="boundary-result-card">
                    <span>Boundary Pressure Abs.</span>
                    <strong class="prop-value" data-key="sink-boundary-pressure">${formatReadoutValue(results.boundaryPressure)} bar a</strong>
                </div>
                <div class="boundary-result-card">
                    <span>${calculatedPressureLabel}</span>
                    <strong class="prop-value" data-key="sink-calculated-pressure">${formatReadoutValue(results.calculatedPressure)} bar a</strong>
                </div>
                <div class="boundary-result-card">
                    <span>Pressure Residual</span>
                    <strong class="prop-value" data-key="sink-pressure-residual">${formatReadoutValue(results.pressureResidual)} bar</strong>
                </div>
                <div class="boundary-result-card">
                    <span>Static Pipe P</span>
                    <strong class="prop-value" data-key="sink-static-pressure">${formatReadoutValue(results.staticPressure)} bar a</strong>
                </div>
                <div class="boundary-result-card">
                    <span>Stagnation P</span>
                    <strong class="prop-value" data-key="sink-stagnation-pressure">${formatReadoutValue(results.stagnationPressure)} bar a</strong>
                </div>
                <div class="boundary-result-card">
                    <span>Flow Rate</span>
                    <strong class="prop-value" data-key="sink-flow">${formatReadoutValue(results.flow)} m3/h</strong>
                </div>
                <div class="boundary-result-card">
                    <span>Mass Flow</span>
                    <strong class="prop-value" data-key="sink-mass-flow">${formatReadoutValue(results.massFlow)} kg/h</strong>
                </div>
                <div class="boundary-result-card">
                    <span>Temperature</span>
                    <strong class="prop-value" data-key="sink-temperature">${formatReadoutValue(results.temperature)} deg C</strong>
                </div>
                <div class="boundary-result-card">
                    <span>Hydraulic Head</span>
                    <strong class="prop-value" data-key="sink-hydraulic-head">${formatReadoutValue(results.hydraulicHead)} m</strong>
                </div>
                <div class="boundary-result-card boundary-result-card-wide">
                    <span>Status</span>
                    <strong class="prop-value" data-key="sink-status">${escapeHtml(results.status || '-')}</strong>
                </div>
                <div class="boundary-result-card boundary-result-card-wide">
                    <span>Warnings</span>
                    <strong class="prop-value" data-key="sink-warnings">${escapeHtml(warnings.join(' | ') || 'OK')}</strong>
                </div>
            </div>
        </td>
    `;
    tbody.appendChild(tr);
}

function renderTankReadoutCards(node, tbody) {
    const results = node.results || {};
    const warnings = results.warnings || [];
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td colspan="2" style="padding: 10px 12px;">
            <div class="boundary-result-grid">
                <div class="boundary-result-card">
                    <span>Connected Pipes</span>
                    <strong class="prop-value" data-key="tank-connected-pipes">${escapeHtml((results.connectedPipes || []).join(', ') || '-')}</strong>
                </div>
                <div class="boundary-result-card">
                    <span>Connected Sources</span>
                    <strong class="prop-value" data-key="tank-connected-sources">${escapeHtml((results.connectedSources || []).join(', ') || '-')}</strong>
                </div>
                <div class="boundary-result-card">
                    <span>Liquid Volume</span>
                    <strong class="prop-value" data-key="tank-liquid-volume">${formatReadoutValue(results.liquidVolume ?? node.props?.liquidVolume)} m3</strong>
                </div>
                <div class="boundary-result-card">
                    <span>Total Capacity</span>
                    <strong class="prop-value" data-key="tank-total-capacity">${formatReadoutValue(results.totalCapacity ?? node.props?.totalCapacity)} m3</strong>
                </div>
                <div class="boundary-result-card">
                    <span>Fill</span>
                    <strong class="prop-value" data-key="tank-fill-percent">${formatReadoutValue(results.fillPercent ?? node.props?.fillPercent)} %</strong>
                </div>
                <div class="boundary-result-card">
                    <span>Geometry Status</span>
                    <strong class="prop-value" data-key="tank-geometry-status">${escapeHtml(results.geometryStatus || '-')}</strong>
                </div>
                <div class="boundary-result-card boundary-result-card-wide">
                    <span>Hydraulic Pressure Source</span>
                    <strong class="prop-value" data-key="tank-pressure-basis">${escapeHtml(results.pressureBasis || '-')}</strong>
                </div>
                <div class="boundary-result-card">
                    <span>Connected Pressure</span>
                    <strong class="prop-value" data-key="tank-calculated-pressure">${formatReadoutValue(results.calculatedPressure)} bar a</strong>
                </div>
                <div class="boundary-result-card">
                    <span>Inlet Pressure</span>
                    <strong class="prop-value" data-key="tank-inlet-pressure">${formatReadoutValue(results.inletPressure)} bar a</strong>
                </div>
                <div class="boundary-result-card">
                    <span>Outlet Pressure</span>
                    <strong class="prop-value" data-key="tank-outlet-pressure">${formatReadoutValue(results.outletPressure)} bar a</strong>
                </div>
                <div class="boundary-result-card">
                    <span>Stagnation P</span>
                    <strong class="prop-value" data-key="tank-stagnation-pressure">${formatReadoutValue(results.stagnationPressure)} bar a</strong>
                </div>
                <div class="boundary-result-card">
                    <span>Inlet Flow</span>
                    <strong class="prop-value" data-key="tank-inlet-flow">${formatReadoutValue(results.inletFlow)} m3/h</strong>
                </div>
                <div class="boundary-result-card">
                    <span>Outlet Flow</span>
                    <strong class="prop-value" data-key="tank-outlet-flow">${formatReadoutValue(results.outletFlow)} m3/h</strong>
                </div>
                <div class="boundary-result-card">
                    <span>Net Flow</span>
                    <strong class="prop-value" data-key="tank-net-flow">${formatReadoutValue(results.netFlow)} m3/h</strong>
                </div>
                <div class="boundary-result-card">
                    <span>Operating Abs. P</span>
                    <strong class="prop-value" data-key="tank-operating-abs-pressure">${formatReadoutValue(results.operatingPressureAbsolute)} bar a</strong>
                </div>
                <div class="boundary-result-card">
                    <span>SRC Feed Flow</span>
                    <strong class="prop-value" data-key="tank-source-feed-flow">${formatReadoutValue(results.sourceFeedFlow)} m3/h</strong>
                </div>
                <div class="boundary-result-card boundary-result-card-wide">
                    <span>Hydraulic Status</span>
                    <strong class="prop-value" data-key="tank-hydraulic-status">${escapeHtml(results.hydraulicStatus || '-')}</strong>
                </div>
                <div class="boundary-result-card">
                    <span>Fluid Vapor P</span>
                    <strong class="prop-value" data-key="tank-vapor-pressure">${formatReadoutValue(results.vaporPressure ?? node.props?.vaporPressure)} bar a</strong>
                </div>
                <div class="boundary-result-card">
                    <span>Tank Design P</span>
                    <strong class="prop-value" data-key="tank-design-pressure">${formatReadoutValue(results.tankDesignPressure ?? node.props?.tankDesignPressure)} mbar g</strong>
                </div>
                <div class="boundary-result-card">
                    <span>Design Vacuum</span>
                    <strong class="prop-value" data-key="tank-design-vacuum">${formatReadoutValue(results.designVacuum ?? node.props?.designVacuum)} mbar vacuum</strong>
                </div>
                <div class="boundary-result-card">
                    <span>Pressure Vent Set</span>
                    <strong class="prop-value" data-key="tank-pressure-vent-set">${formatReadoutValue(results.pressureVentSet ?? node.props?.pressureVentSet)} mbar g</strong>
                </div>
                <div class="boundary-result-card">
                    <span>Vacuum Vent Set</span>
                    <strong class="prop-value" data-key="tank-vacuum-vent-set">${formatReadoutValue(results.vacuumVentSet ?? node.props?.vacuumVentSet)} mbar vacuum</strong>
                </div>
                <div class="boundary-result-card">
                    <span>Venting Status</span>
                    <strong class="prop-value" data-key="tank-venting-status">${escapeHtml(results.ventingStatus || '-')}</strong>
                </div>
                <div class="boundary-result-card boundary-result-card-wide">
                    <span>Venting Basis</span>
                    <strong class="prop-value" data-key="tank-venting-basis">${escapeHtml(results.ventingBasis || '-')}</strong>
                </div>
                <div class="boundary-result-card boundary-result-card-wide">
                    <span>Status</span>
                    <strong class="prop-value" data-key="tank-status">${escapeHtml(results.status || '-')}</strong>
                </div>
                <div class="boundary-result-card boundary-result-card-wide">
                    <span>Warnings</span>
                    <strong class="prop-value" data-key="tank-warnings">${escapeHtml(warnings.join(' | ') || 'OK')}</strong>
                </div>
            </div>
        </td>
    `;
    tbody.appendChild(tr);
}

function renderObjectProperties(type, nodeId, node, addRow, tbody) {
    const schema = EQUIPMENT_SCHEMAS[type];
    if (!schema) {
        addRow('Notes', 'No custom properties defined for this object type.', '', true);
        return;
    }

    if (type === 'tank') {
        if (typeof normalizeTankProps === 'function') normalizeTankProps(node);
        if (typeof ensureNodeResults === 'function') ensureNodeResults(node);
        if (typeof updateTankPressureReadout === 'function') updateTankPressureReadout(nodeId);

        const pressureOptions = typeof PRESSURE_INPUT_BASIS_OPTIONS !== 'undefined'
            ? PRESSURE_INPUT_BASIS_OPTIONS
            : ['Gauge', 'Absolute'];
        const tankCodeOptions = typeof TANK_CODE_BASIS_OPTIONS !== 'undefined'
            ? TANK_CODE_BASIS_OPTIONS
            : ['API 650 Atmospheric Tank', 'API 620 Low-pressure Storage Tank', 'User-defined'];
        const emergencyVentOptions = typeof TANK_EMERGENCY_VENT_OPTIONS !== 'undefined'
            ? TANK_EMERGENCY_VENT_OPTIONS
            : ['Not specified', 'Provided', 'Not provided'];
        const pressureBasis = typeof getNodePressureInputBasis === 'function'
            ? getNodePressureInputBasis(node)
            : (node.props.pressureInputBasis || 'Gauge');
        const pressureUnit = typeof getPressureInputUnit === 'function'
            ? getPressureInputUnit(pressureBasis)
            : (pressureBasis === 'Gauge' ? 'bar g' : 'bar a');
        const operatingAbsPressure = typeof getNodeAbsolutePressureBar === 'function'
            ? getNodeAbsolutePressureBar(node)
            : node.props.pressure;

        appendSectionHeader(tbody, 'Tank Setup');
        addRow('PFD Size', node.props.visualScale, 'visualScale', false, '%', 'number');
        addRow('Tank Code Basis', node.props.tankCodeBasis, 'tankCodeBasis', false, '', 'select', tankCodeOptions);

        appendSectionHeader(tbody, 'Geometry & Inventory');
        addRow('Base Elevation', node.props.elevation, 'elevation', false, 'm', 'number');
        addRow('Tank Diameter', node.props.diameter, 'diameter', false, 'm', 'number');
        addRow('Tank Height', node.props.tankHeight, 'tankHeight', false, 'm', 'number');
        addRow('Current Level', node.props.liquidLevel, 'liquidLevel', false, 'm', 'number');
        addRow('High Liquid Level (HLL)', node.props.hll, 'hll', false, 'm', 'number');
        addRow('Normal Liq. Level (NLL)', node.props.nll, 'nll', false, 'm', 'number');
        addRow('Low Liquid Level (LLL)', node.props.lll, 'lll', false, 'm', 'number');
        addRow('Transmitter Elev. from Datum', node.props.tLevelElev, 'tLevelElev', false, 'm', 'number');
        addRow('Liquid Volume', node.props.liquidVolume, 'tank-liquid-volume', true, 'm3');
        addRow('Total Capacity', node.props.totalCapacity, 'tank-total-capacity', true, 'm3');
        addRow('Fill Percentage', node.props.fillPercent, 'tank-fill-percent', true, '%');

        appendSectionHeader(tbody, 'Nozzle Elevation');
        addRow('Inlet Nozzle Elev. from Datum', node.props.inletNozzleElevation, 'inletNozzleElevation', false, 'm', 'number');
        addRow('Outlet Nozzle Elev. from Datum', node.props.outletNozzleElevation, 'outletNozzleElevation', false, 'm', 'number');

        appendSectionHeader(tbody, 'Tank Pressure & Venting');
        addRow('Pressure Basis', pressureBasis, 'pressureInputBasis', false, '', 'select', pressureOptions);
        addRow('Operating Vapor Space Pressure', node.props.pressure, 'pressure', false, pressureUnit, 'number');
        addRow('Calculated Abs. Pressure', operatingAbsPressure, 'tank-operating-abs-pressure', true, 'bar a');
        addRow('Tank Design Pressure', node.props.tankDesignPressure, 'tankDesignPressure', false, 'mbar g', 'number');
        addRow('Design Vacuum', node.props.designVacuum, 'designVacuum', false, 'mbar vacuum', 'number');
        addRow('Pressure Vent Set', node.props.pressureVentSet, 'pressureVentSet', false, 'mbar g', 'number');
        addRow('Vacuum Vent Set', node.props.vacuumVentSet, 'vacuumVentSet', false, 'mbar vacuum', 'number');
        addRow('Emergency Vent', node.props.emergencyVentProvided, 'emergencyVentProvided', false, '', 'select', emergencyVentOptions);
        addRow('Fluid Vapor Pressure', node.results?.vaporPressure ?? node.props.vaporPressure, 'tank-fluid-vapor-pressure', true, 'bar a');

        appendSectionHeader(tbody, 'Hydraulic Readout');
        renderTankReadoutCards(node, tbody);
        return;
    }

    if (type === 'source') {
        let sourceBoundaryChanged = false;
        if (typeof reconcileSourceBoundaryConfiguration === 'function') {
            sourceBoundaryChanged = reconcileSourceBoundaryConfiguration(nodeId, { detachInvalidAttachment: true });
            if (sourceBoundaryChanged && typeof drawConnections === 'function') drawConnections();
        }
        if (typeof normalizeSourceProps === 'function') {
            normalizeSourceProps(node);
        }

        const sourceTypeOptions = typeof SOURCE_TYPE_OPTIONS !== 'undefined'
            ? SOURCE_TYPE_OPTIONS
            : ['Open Tank / Reservoir', 'Pressurized Vessel', 'External Header / Pipe Tie-in', 'Fixed Flow Source', 'Standalone Boundary Source'];
        const manualBoundary = typeof SOURCE_BOUNDARY_DATA_MANUAL !== 'undefined' ? SOURCE_BOUNDARY_DATA_MANUAL : 'Manual';
        const inheritBoundary = typeof SOURCE_BOUNDARY_DATA_INHERIT !== 'undefined' ? SOURCE_BOUNDARY_DATA_INHERIT : 'Inherit from Attached Equipment';
        const externalHeaderType = typeof SOURCE_TYPE_EXTERNAL_HEADER !== 'undefined' ? SOURCE_TYPE_EXTERNAL_HEADER : 'External Header / Pipe Tie-in';
        const staticPressure = typeof SOURCE_PRESSURE_ENERGY_STATIC !== 'undefined' ? SOURCE_PRESSURE_ENERGY_STATIC : 'Static Pressure';
        const totalPressure = typeof SOURCE_PRESSURE_ENERGY_TOTAL !== 'undefined' ? SOURCE_PRESSURE_ENERGY_TOTAL : 'Total / Stagnation Pressure';
        const fluidBasisMode = typeof SOURCE_TEMP_MODE_FLUID_BASIS !== 'undefined' ? SOURCE_TEMP_MODE_FLUID_BASIS : 'Use Fluid Basis';
        const customMode = typeof SOURCE_TEMP_MODE_CUSTOM !== 'undefined' ? SOURCE_TEMP_MODE_CUSTOM : 'Custom';
        const linkedToFluidBasis = !node.props || node.props.temperatureMode !== customMode;
        const sourceLink = typeof getSourceLink === 'function' ? getSourceLink(nodeId) : null;
        const attachedNode = sourceLink ? globalModel[sourceLink.targetId] : null;
        const canUseSemanticAttachment = typeof isSourceTypeSemanticAttachmentCapable === 'function'
            ? isSourceTypeSemanticAttachmentCapable(node)
            : ['Open Tank / Reservoir', 'Pressurized Vessel'].includes(node.props?.sourceType);
        const canInheritBoundary = typeof canSourceInheritBoundaryData === 'function'
            ? canSourceInheritBoundaryData(node, attachedNode)
            : !!(attachedNode && ['tank', 'separator', 'verticalVessel'].includes(attachedNode.type));
        if (!canInheritBoundary && node.props.boundaryDataSource === inheritBoundary) {
            node.props.boundaryDataSource = manualBoundary;
        }
        const inheritedBoundary = canInheritBoundary && node.props.boundaryDataSource === inheritBoundary;
        const sourceBoundary = typeof resolveSourceBoundaryData === 'function'
            ? resolveSourceBoundaryData(nodeId, globalModel)
            : null;
        const pressureOptions = typeof PRESSURE_INPUT_BASIS_OPTIONS !== 'undefined'
            ? PRESSURE_INPUT_BASIS_OPTIONS
            : ['Gauge', 'Absolute'];
        const pressureBasis = typeof getNodePressureInputBasis === 'function'
            ? getNodePressureInputBasis(node)
            : (node.props.pressureInputBasis || 'Absolute');
        const pressureUnit = typeof getPressureInputUnit === 'function'
            ? getPressureInputUnit(pressureBasis)
            : (pressureBasis === 'Gauge' ? 'bar g' : 'bar a');
        const absolutePressure = typeof getNodeAbsolutePressureBar === 'function'
            ? getNodeAbsolutePressureBar(node)
            : node.props.pressure;
        const fluidProps = globalModel.FLUID?.props || {};
        const sourceRole = canUseSemanticAttachment
            ? 'Semantic attachment boundary'
            : 'Hydraulic boundary / tie-in';
        const sourceMeaning = canUseSemanticAttachment
            ? 'Dashed attachment may inherit tank/vessel data; flow still needs a real hydraulic path.'
            : 'Solid hydraulic pipe from SRC is required for flow and pressure loss calculation.';
        const elevationLabel = inheritedBoundary
            ? 'Liquid Level Elev. (Inherited)'
            : (node.props.sourceType === externalHeaderType ? 'Tie-in Elevation' : 'Source Elevation');

        appendSectionHeader(tbody, 'Source Definition');
        addRow('Source Type', node.props.sourceType, 'sourceType', false, '', 'select', sourceTypeOptions);
        addRow('Boundary Role', sourceRole, 'source-boundary-role', true);
        addRow('Meaning', sourceMeaning, 'source-boundary-meaning', true);

        appendSectionHeader(tbody, 'Boundary Data');
        if (canInheritBoundary) {
            addRow('Boundary Data Source', node.props.boundaryDataSource || manualBoundary, 'boundaryDataSource', false, '', 'select', [manualBoundary, inheritBoundary]);
        } else {
            addRow('Boundary Data Source', manualBoundary, 'boundaryDataSource', true);
            addRow('Boundary Data Note', 'Inherit is only available for Open Tank/Pressurized Vessel dashed-attached to tank/vessel.', 'source-boundary-data-note', true);
        }
        addRow('Pressure Basis', pressureBasis, 'pressureInputBasis', inheritedBoundary, '', 'select', pressureOptions);
        addRow('Boundary Pressure', inheritedBoundary ? sourceBoundary?.pressureAbsBar : node.props.pressure, inheritedBoundary ? 'source-effective-pressure' : 'pressure', inheritedBoundary, inheritedBoundary ? 'bar a' : pressureUnit, 'number');
        addRow('Calculated Abs. Pressure', sourceBoundary?.pressureAbsBar ?? absolutePressure, 'source-absolute-pressure', true, 'bar a');
        if (node.props.sourceType === externalHeaderType) {
            addRow('Pressure Energy Basis', node.props.pressureEnergyBasis || staticPressure, 'pressureEnergyBasis', false, '', 'select', [staticPressure, totalPressure]);
        }
        addRow(elevationLabel, inheritedBoundary ? sourceBoundary?.elevation : node.props.elevation, inheritedBoundary ? 'source-effective-elevation' : 'elevation', inheritedBoundary, 'm', 'number');

        appendSectionHeader(tbody, 'Fluid Basis Link');
        addRow('Active Fluid Basis', fluidProps.fluidName || 'Custom', 'source-fluid-basis', true);
        addRow('Temperature Mode', node.props.temperatureMode || fluidBasisMode, 'temperatureMode', false, '', 'select', [fluidBasisMode, customMode]);

        if (linkedToFluidBasis && typeof syncSourceTemperatureFromFluidBasis === 'function') {
            syncSourceTemperatureFromFluidBasis(nodeId);
        }

        addRow(
            linkedToFluidBasis ? 'Temperature (Fluid Basis)' : 'Temperature',
            node.props.temp,
            linkedToFluidBasis ? 'source-temperature' : 'temp',
            linkedToFluidBasis,
            'deg C',
            'number'
        );
        addRow('Density Used', fluidProps.density, 'source-fluid-density', true, 'kg/m3');
        addRow('Kinematic Visc. Used', fluidProps.viscosity, 'source-fluid-viscosity', true, 'cSt');
        addRow('Vapor Pressure Used', fluidProps.vaporPressure, 'source-fluid-vapor-pressure', true, 'bar a');

        appendSectionHeader(tbody, 'Flow Specification');
        const volumetricFlowMode = typeof SOURCE_FLOW_MODE_VOLUME !== 'undefined' ? SOURCE_FLOW_MODE_VOLUME : 'Volumetric Flow';
        const massFlowMode = typeof SOURCE_FLOW_MODE_MASS !== 'undefined' ? SOURCE_FLOW_MODE_MASS : 'Mass Flow';
        const solveFlowMode = typeof SOURCE_FLOW_MODE_SOLVE !== 'undefined' ? SOURCE_FLOW_MODE_SOLVE : 'Solve from Network';
        if (typeof syncSourceFlowFromInputMode === 'function') {
            syncSourceFlowFromInputMode(nodeId);
        }

        const usingMassFlow = node.props.flowInputMode === massFlowMode;
        const solvingFlow = node.props.flowInputMode === solveFlowMode;
        addRow('Flow Input Mode', node.props.flowInputMode || volumetricFlowMode, 'flowInputMode', false, '', 'select', [volumetricFlowMode, massFlowMode, solveFlowMode]);
        if (solvingFlow) {
            addRow('Flow', 'Solved from hydraulic network', 'source-flow-mode-note', true);
        } else if (usingMassFlow) {
            addRow('Mass Flow', node.props.massFlow, 'massFlow', false, 'kg/h', 'number');
            addRow('Volumetric Flow (Calculated)', node.props.flow, 'source-flow', true, 'm3/h');
        } else {
            addRow('Volumetric Flow', node.props.flow, 'flow', false, 'm3/h', 'number');
            addRow('Mass Flow (Calculated)', node.props.massFlow, 'source-mass-flow', true, 'kg/h');
        }

        if (sourceBoundary?.warnings?.length) {
            addRow('Boundary Warnings', sourceBoundary.warnings.join(' | '), 'source-boundary-warnings', true);
        }

        renderSourceConnectionControls(nodeId, node, addRow, tbody);
        return;
    }

    if (type === 'sink') {
        if (typeof normalizeSinkProps === 'function') normalizeSinkProps(node);
        if (typeof ensureNodeResults === 'function') ensureNodeResults(node);
        if (typeof updateSinkReadout === 'function') updateSinkReadout(nodeId);
        const pressureOptions = typeof PRESSURE_INPUT_BASIS_OPTIONS !== 'undefined'
            ? PRESSURE_INPUT_BASIS_OPTIONS
            : ['Gauge', 'Absolute'];
        const pressureBasis = typeof getNodePressureInputBasis === 'function'
            ? getNodePressureInputBasis(node)
            : (node.props.pressureInputBasis || 'Absolute');
        const pressureUnit = typeof getPressureInputUnit === 'function'
            ? getPressureInputUnit(pressureBasis)
            : (pressureBasis === 'Gauge' ? 'bar g' : 'bar a');
        const absolutePressure = typeof getNodeAbsolutePressureBar === 'function'
            ? getNodeAbsolutePressureBar(node)
            : node.props.pressure;

        appendSectionHeader(tbody, 'Boundary Conditions');
        addRow('Active', node.props.active, 'active', false, '', 'select', ['Active', 'Inactive']);
        addRow('Boundary Mode', node.props.boundaryMode, 'boundaryMode', false, '', 'select', ['Outlet Pressure', 'Flow Demand']);
        addRow('Pressure Basis', pressureBasis, 'pressureInputBasis', false, '', 'select', pressureOptions);
        if (node.props.boundaryMode === 'Flow Demand') {
            addRow('Flow Demand', node.props.demandFlow, 'demandFlow', false, 'm3/h', 'number');
            addRow('Reference Pressure', node.props.pressure, 'pressure', false, pressureUnit, 'number');
        } else {
            addRow('Outlet Pressure', node.props.pressure, 'pressure', false, pressureUnit, 'number');
        }
        addRow('Calculated Abs. Pressure', absolutePressure, 'sink-absolute-pressure', true, 'bar a');
        addRow('Pipe Pressure Type', node.props.pressureBasis, 'pressureBasis', false, '', 'select', ['Static', 'Stagnation']);
        addRow('Elevation', node.props.elevation, 'elevation', false, 'm', 'number');

        appendSectionHeader(tbody, 'Calculated Outlet Readout');
        renderSinkReadoutCards(node, tbody);
        return;
    }

    Object.keys(schema).forEach(key => {
        const def = schema[key];
        if (!node.props) node.props = {};
        if (node.props[key] === undefined) {
            node.props[key] = copyDefaultValue(def.default);
        }

        addRow(
            def.label || key,
            node.props[key],
            key,
            !!def.readonly,
            def.unit || '',
            def.type === 'select' ? 'select' : def.type,
            def.options || []
        );
    });

    if (type === 'checkValve') {
        addRow('Check Status', node.props.checkStatus || '-', 'checkStatus', true, '');
    }

    if (typeof isInstrumentType === 'function' && isInstrumentType(type)) {
        const readoutHeader = document.createElement('tr');
        readoutHeader.innerHTML = '<td colspan="2" style="background:#eee; font-weight:bold; padding:4px 8px; text-align:center;">Pipeline Readout</td>';
        tbody.appendChild(readoutHeader);

        addRow('Attached Pipe', node.props.attachedTo || '-', 'instrument-attached-to', true);
        if (type === 'lineMonitor') {
            addRow('Pressure', node.props.measuredPressure, 'instrument-pressure', true, 'bar a');
            addRow('Flow', node.props.measuredFlow, 'instrument-flow', true, 'm3/h');
            addRow('Temperature', node.props.measuredTemperature, 'instrument-temperature', true, 'deg C');
        } else {
            addRow('Measured Value', node.props.measuredValue, 'instrument-measured', true, node.props.measuredUnit || '');
            addRow('Signal', node.props.measuredPercent, 'instrument-signal', true, '%');
        }

        const actionTr = document.createElement('tr');
        actionTr.innerHTML = `
            <td colspan="2" style="padding: 8px 12px;">
                <button class="btn-connect-instrument" data-node="${nodeId}">Connect to pipeline</button>
                <button class="btn-disconnect-instrument" data-node="${nodeId}">Disconnect</button>
            </td>
        `;
        tbody.appendChild(actionTr);

        actionTr.querySelector('.btn-connect-instrument').addEventListener('click', () => {
            setAppMode('CONNECT');
            startInstrumentAttachment(nodeId);
        });
        actionTr.querySelector('.btn-disconnect-instrument').addEventListener('click', () => {
            detachInstrumentFromPipe(nodeId);
            updateSimulation({ renderSidebarAfter: false });
        });
    }

}
