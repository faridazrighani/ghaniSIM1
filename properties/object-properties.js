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
                            <td class="prop-label">Current Level above Base</td>
                            <td class="prop-value"><input class="prop-input-field tank-inventory-input" type="number" data-node="${escapeHtml(nodeId)}" data-key="liquidLevel" value="${escapeHtml(node.props.liquidLevel)}"> m</td>
                        </tr>
                        <tr>
                            <td class="prop-label">HLL above Base</td>
                            <td class="prop-value"><input class="prop-input-field tank-inventory-input" type="number" data-node="${escapeHtml(nodeId)}" data-key="hll" value="${escapeHtml(node.props.hll)}"> m</td>
                        </tr>
                        <tr>
                            <td class="prop-label">NLL above Base</td>
                            <td class="prop-value"><input class="prop-input-field tank-inventory-input" type="number" data-node="${escapeHtml(nodeId)}" data-key="nll" value="${escapeHtml(node.props.nll)}"> m</td>
                        </tr>
                        <tr>
                            <td class="prop-label">LLL above Base</td>
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

function renderTankSourceFeedFlowBreakdown(sourceFeedFlows = []) {
    if (!Array.isArray(sourceFeedFlows) || sourceFeedFlows.length === 0) {
        return '<div class="tank-source-feed-empty">-</div>';
    }

    return sourceFeedFlows.map(row => `
        <div class="tank-source-feed-row">
            <span>${escapeHtml(row.sourceId || '-')}</span>
            <strong>${formatReadoutValue(row.flow)} m3/h</strong>
        </div>
    `).join('');
}

function formatTankTraceDisplayValue(value, unit = '') {
    if (value === null || value === undefined || value === '') return '-';
    const display = typeof formatReadoutValue === 'function' ? formatReadoutValue(value) : String(value);
    return `${display}${unit && display !== '-' ? ` ${unit}` : ''}`;
}

function renderTankTraceMetric(label, value, unit = '') {
    return `
        <div class="pipe-trace-metric tank-trace-metric">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(formatTankTraceDisplayValue(value, unit))}</strong>
        </div>
    `;
}

function renderTankTraceTextMetric(label, value) {
    return `
        <div class="pipe-trace-metric tank-trace-metric tank-trace-metric-wide">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value || '-')}</strong>
        </div>
    `;
}

function renderTankTraceStepRows(steps = []) {
    if (!steps.length) {
        return '<tr><td colspan="5" class="pipe-trace-empty">No tank trace steps available.</td></tr>';
    }
    return steps.map((step, index) => `
        <tr>
            <td data-label="Step">${index + 1}. ${escapeHtml(step.title || '-')}</td>
            <td data-label="Formula"><code>${escapeHtml(step.formula || '-')}</code></td>
            <td data-label="Substitution">${escapeHtml(step.substitution || '-')}</td>
            <td data-label="Result">${escapeHtml(formatTankTraceDisplayValue(step.result, step.unit || ''))}</td>
            <td data-label="Reference">${escapeHtml(step.reference || '-')}</td>
        </tr>
    `).join('');
}

function renderTankTraceList(items = [], emptyText = 'None') {
    const rows = (items || []).filter(Boolean);
    return `
        <ul class="pipe-trace-list tank-trace-list">
            ${(rows.length ? rows : [emptyText]).map(item => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
    `;
}

function renderTankTraceSourceFeedList(sourceFeedFlows = []) {
    if (!Array.isArray(sourceFeedFlows) || sourceFeedFlows.length === 0) {
        return '<div class="pipe-trace-empty">No attached SRC feed flow rows.</div>';
    }
    return `
        <ul class="pipe-trace-list tank-trace-list">
            ${sourceFeedFlows.map(row => `
                <li>${escapeHtml(row.sourceId || 'SRC')}: ${escapeHtml(formatTankTraceDisplayValue(row.flow, 'm3/h'))} (${escapeHtml(row.sourceType || '-')})</li>
            `).join('')}
        </ul>
    `;
}

function renderTankCalculationTraceReport(trace) {
    if (!trace) {
        return '<div class="pipe-trace-empty">Tank calculation trace is not available.</div>';
    }

    const input = trace.inputBasis || {};
    const geometry = trace.geometry || {};
    const inventory = trace.inventory || {};
    const flow = trace.flowBalance || {};
    const pressure = trace.pressureVenting || {};
    const warnings = trace.warnings || [];

    return `
        <div class="pipe-trace-status ${warnings.length ? 'pipe-trace-status-unsolved' : 'pipe-trace-status-solved'}">
            ${escapeHtml(trace.status || '-')}
        </div>
        <div class="pipe-trace-block tank-trace-block">
            <h4>Input Basis</h4>
            <div class="pipe-trace-metric-grid">
                ${renderTankTraceTextMetric('Tank Code Basis', input.codeBasis)}
                ${renderTankTraceTextMetric('Model Basis', input.modelBasis)}
                ${renderTankTraceMetric('Pressure Input', input.pressureInput, input.pressureInputUnit || '')}
                ${renderTankTraceTextMetric('Pressure Basis', input.pressureInputBasis)}
                ${renderTankTraceTextMetric('Emergency Vent', input.emergencyVent)}
            </div>
        </div>
        <div class="pipe-trace-block tank-trace-block">
            <h4>Geometry & Inventory</h4>
            <div class="pipe-trace-metric-grid">
                ${renderTankTraceMetric('Diameter', geometry.diameter, 'm')}
                ${renderTankTraceMetric('Tank Height', geometry.tankHeight, 'm')}
                ${renderTankTraceMetric('Area', geometry.crossSectionArea, 'm2')}
                ${renderTankTraceMetric('Base Elevation', geometry.baseElevation, 'm')}
                ${renderTankTraceMetric('Top Elevation', geometry.topElevation, 'm')}
                ${renderTankTraceMetric('Liquid Level above Base', geometry.liquidLevel, 'm')}
                ${renderTankTraceMetric('Liquid Surface Elev.', geometry.liquidSurfaceElevation, 'm')}
                ${renderTankTraceMetric('Outlet Nozzle Elev.', geometry.outletNozzleElevation, 'm')}
                ${renderTankTraceMetric('Outlet Submergence', geometry.outletSubmergence, 'm')}
                ${renderTankTraceMetric('Liquid Volume', inventory.liquidVolume, 'm3')}
                ${renderTankTraceMetric('Total Capacity', inventory.totalCapacity, 'm3')}
                ${renderTankTraceMetric('Fill', inventory.fillPercent, '%')}
            </div>
        </div>
        <div class="pipe-trace-block tank-trace-block">
            <h4>Flow Balance</h4>
            <div class="pipe-trace-metric-grid">
                ${renderTankTraceTextMetric('Connected Pipes', (flow.connectedPipes || []).join(', ') || '-')}
                ${renderTankTraceTextMetric('Connected Sources', (flow.connectedSources || []).join(', ') || '-')}
                ${renderTankTraceMetric('Pipe Inlet Flow', flow.pipeInletFlow, 'm3/h')}
                ${renderTankTraceMetric('Total SRC Feed Flow', flow.sourceFeedFlow, 'm3/h')}
                ${renderTankTraceMetric('Inlet Flow', flow.inletFlow, 'm3/h')}
                ${renderTankTraceMetric('Outlet Flow', flow.outletFlow, 'm3/h')}
                ${renderTankTraceMetric('Net Flow', flow.netFlow, 'm3/h')}
                ${renderTankTraceTextMetric('Level Trend', flow.levelTrend)}
            </div>
            <div class="pipe-trace-source-note">SRC Feed Flow Breakdown</div>
            ${renderTankTraceSourceFeedList(flow.sourceFeedFlows)}
        </div>
        <div class="pipe-trace-block tank-trace-block">
            <h4>Tank Pressure & Venting</h4>
            <div class="pipe-trace-metric-grid">
                ${renderTankTraceMetric('Operating Abs. P', pressure.operatingPressureAbsolute, 'bar a')}
                ${renderTankTraceMetric('Operating Gauge P', pressure.operatingGaugePressureMbar, 'mbar g')}
                ${renderTankTraceMetric('Operating Vacuum', pressure.operatingVacuumMbar, 'mbar vacuum')}
                ${renderTankTraceMetric('Fluid Vapor P', pressure.vaporPressure, 'bar a')}
                ${renderTankTraceMetric('Tank Design P', pressure.tankDesignPressure, 'mbar g')}
                ${renderTankTraceMetric('Design Vacuum', pressure.designVacuum, 'mbar vacuum')}
                ${renderTankTraceMetric('Pressure Vent Set', pressure.pressureVentSet, 'mbar g')}
                ${renderTankTraceMetric('Vacuum Vent Set', pressure.vacuumVentSet, 'mbar vacuum')}
                ${renderTankTraceMetric('Pressure Vent Margin', pressure.pressureVentMargin, 'mbar')}
                ${renderTankTraceMetric('Vacuum Vent Margin', pressure.vacuumVentMargin, 'mbar')}
                ${renderTankTraceTextMetric('Venting Basis', pressure.ventingBasis)}
            </div>
        </div>
        <div class="pipe-trace-block tank-trace-block">
            <h4>Equation Steps</h4>
            <div class="pipe-trace-table-scroll">
                <table class="pipe-trace-table tank-trace-table">
                    <thead>
                        <tr>
                            <th>Step</th>
                            <th>Formula</th>
                            <th>Substitution</th>
                            <th>Result</th>
                            <th>Reference</th>
                        </tr>
                    </thead>
                    <tbody>${renderTankTraceStepRows(trace.steps || [])}</tbody>
                </table>
            </div>
        </div>
        <div class="pipe-trace-block tank-trace-block">
            <h4>Warnings / Advisories</h4>
            ${renderTankTraceList(trace.warnings, 'OK')}
        </div>
        <div class="pipe-trace-block tank-trace-block">
            <h4>Academic Assumptions</h4>
            ${renderTankTraceList(trace.assumptions)}
        </div>
        <div class="pipe-trace-block tank-trace-block">
            <h4>References</h4>
            ${renderTankTraceList(trace.references)}
        </div>
    `;
}

function getTankCalculationTraceForRender(node) {
    if (!node) return null;
    const fluidProps = typeof globalModel !== 'undefined' ? (globalModel.FLUID?.props || {}) : {};
    if (typeof buildTankCalculationTrace === 'function') {
        return buildTankCalculationTrace(node, fluidProps, node.results || {});
    }
    return node.results?.calculationTrace || null;
}

function renderTankCalculationTrace(node, tbody) {
    const trace = getTankCalculationTraceForRender(node);
    const tr = document.createElement('tr');
    const openAttribute = typeof window === 'undefined' || window.innerWidth >= 700 ? 'open' : '';
    tr.innerHTML = `
        <td colspan="2" class="pipe-trace-cell tank-trace-cell">
            <details class="pipe-calculation-trace tank-calculation-trace" ${openAttribute}>
                <summary>Calculation Trace / Step-by-step Report</summary>
                <div class="pipe-calculation-trace-body tank-calculation-trace-body" data-key="tank-calculation-trace-body">
                    ${renderTankCalculationTraceReport(trace)}
                </div>
            </details>
        </td>
    `;
    tbody.appendChild(tr);
}

function formatSeparatorTraceDisplayValue(value, unit = '', digits = 3) {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof formatDisplayUnitValueByUnit === 'function') {
        return formatDisplayUnitValueByUnit(value, unit, digits, '', unit);
    }
    const display = typeof formatReadoutValue === 'function' ? formatReadoutValue(value) : String(value);
    return `${display}${unit && display !== '-' ? ` ${unit}` : ''}`;
}

function renderSeparatorTraceMetric(label, value, unit = '', key = '', digits = 3) {
    return `
        <div class="pipe-trace-metric separator-trace-metric">
            <span>${escapeHtml(label)}</span>
            <strong${key ? ` class="prop-value" data-key="${escapeHtml(key)}"` : ''}>${escapeHtml(formatSeparatorTraceDisplayValue(value, unit, digits))}</strong>
        </div>
    `;
}

function renderSeparatorTraceTextMetric(label, value) {
    return `
        <div class="pipe-trace-metric separator-trace-metric separator-trace-metric-wide">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value || '-')}</strong>
        </div>
    `;
}

function renderSeparatorTraceReadouts(readouts = [], vesselLabel = 'Vessel') {
    if (!Array.isArray(readouts) || readouts.length === 0) {
        return `<div class="pipe-trace-empty">No ${escapeHtml(vesselLabel)} readout available.</div>`;
    }
    return `
        <div class="pipe-trace-metric-grid">
            ${readouts.map(item => renderSeparatorTraceMetric(item.label, item.value, item.unit || '', item.key || '', item.digits ?? 3)).join('')}
        </div>
    `;
}

function renderSeparatorTraceStepRows(steps = [], vesselLabel = 'Vessel') {
    if (!steps.length) {
        return `<tr><td colspan="5" class="pipe-trace-empty">No ${escapeHtml(vesselLabel)} trace steps available.</td></tr>`;
    }
    return steps.map((step, index) => `
        <tr>
            <td data-label="Step">${index + 1}. ${escapeHtml(step.title || '-')}</td>
            <td data-label="Formula"><code>${escapeHtml(step.formula || '-')}</code></td>
            <td data-label="Substitution">${escapeHtml(step.substitution || '-')}</td>
            <td data-label="Result">${escapeHtml(formatSeparatorTraceDisplayValue(step.result, step.unit || '', step.digits ?? 3))}</td>
            <td data-label="Reference">${escapeHtml(step.reference || '-')}</td>
        </tr>
    `).join('');
}

function renderSeparatorTraceList(items = [], emptyText = 'None') {
    const rows = (items || []).filter(Boolean);
    return `
        <ul class="pipe-trace-list separator-trace-list">
            ${(rows.length ? rows : [emptyText]).map(item => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
    `;
}

function renderSeparatorTraceSourceFeedList(sourceFeedFlows = []) {
    if (!Array.isArray(sourceFeedFlows) || sourceFeedFlows.length === 0) {
        return '<div class="pipe-trace-empty">No attached SRC feed flow rows.</div>';
    }
    return `
        <ul class="pipe-trace-list separator-trace-list">
            ${sourceFeedFlows.map(row => `
                <li>
                    ${escapeHtml(row.sourceId || 'SRC')}:
                    ${escapeHtml(formatSeparatorTraceDisplayValue(row.flow, 'm3/h'))}
                    (${escapeHtml(row.sourceType || '-')}; ${escapeHtml(row.role || 'feed specification')})
                </li>
            `).join('')}
        </ul>
    `;
}

function renderSeparatorDependencyChain(items = [], vesselLabel = 'Vessel') {
    const rows = (items || []).filter(Boolean);
    if (!rows.length) {
        return `<div class="pipe-trace-empty">No ${escapeHtml(vesselLabel)} dependency chain available.</div>`;
    }
    return `
        <ol class="pipe-trace-list separator-trace-list separator-dependency-chain">
            ${rows.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
        </ol>
    `;
}

function renderSeparatorReadoutCards(nodeId, node, tbody) {
    const trace = getSeparatorCalculationTraceForRender(nodeId, node);
    const flow = trace?.flowBalance || {};
    const vesselLabel = trace?.inputBasis?.vesselLabel || 'Vessel';
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td colspan="2" style="padding: 10px 12px;">
            ${renderSeparatorTraceReadouts(trace?.readouts || [], vesselLabel)}
            <div class="pipe-trace-source-note">SRC Feed Flow Breakdown</div>
            ${renderSeparatorTraceSourceFeedList(flow.sourceFeedFlows)}
        </td>
    `;
    tbody.appendChild(tr);
}

function renderSeparatorStandardExample(example = {}) {
    const vesselLabel = example.vesselLabel || 'vessel';
    return `
        <div class="pipe-trace-metric-grid">
            ${renderSeparatorTraceTextMetric('Example Basis', 'Reference starting values')}
            ${renderSeparatorTraceTextMetric('Pressure Basis', example.pressureInputBasis || 'Gauge')}
            ${renderSeparatorTraceMetric('Vessel Pressure', example.pressure, example.pressureInputUnit || 'bar g')}
            ${renderSeparatorTraceMetric('Pressure Drop', example.pressureDrop, 'bar')}
            ${renderSeparatorTraceMetric('Base Elevation', example.baseElevation, 'm')}
            ${renderSeparatorTraceMetric('Liquid Level Offset', example.liquidLevel, 'm')}
            ${renderSeparatorTraceMetric('Liquid Surface Elev.', example.liquidSurfaceElevation, 'm')}
            ${renderSeparatorTraceMetric('Inlet Nozzle Elev.', example.inletNozzleElevation, 'm')}
            ${renderSeparatorTraceMetric('Outlet Nozzle Elev.', example.outletNozzleElevation, 'm')}
            ${renderSeparatorTraceMetric('Outlet Submergence', example.outletSubmergence, 'm')}
            ${renderSeparatorTraceMetric('Residence Time', example.residenceTime, 'min')}
        </div>
        <div class="pipe-trace-source-note">
            Example values are applied to new ${escapeHtml(vesselLabel)} objects as a starting point and remain editable. They are not a vessel/separator sizing guarantee.
        </div>
    `;
}

function renderSeparatorCalculationTraceReport(trace) {
    if (!trace) {
        return '<div class="pipe-trace-empty">Vessel calculation trace is not available.</div>';
    }

    const input = trace.inputBasis || {};
    const vesselLabel = input.vesselLabel || 'Vessel';
    const flow = trace.flowBalance || {};
    const warnings = trace.warnings || [];
    const statusClass = warnings.length
        ? 'pipe-trace-status-unsolved'
        : 'pipe-trace-status-solved';

    return `
        <div class="pipe-trace-status ${statusClass}">
            ${escapeHtml(trace.status || '-')}
        </div>
        <div class="pipe-trace-block separator-trace-block">
            <h4>Input Basis</h4>
            <div class="pipe-trace-metric-grid">
                ${renderSeparatorTraceTextMetric('Vessel', input.vesselId)}
                ${renderSeparatorTraceTextMetric('Type', input.vesselType)}
                ${renderSeparatorTraceTextMetric('Orientation', input.orientation)}
                ${renderSeparatorTraceTextMetric('Model Basis', input.modelBasis)}
                ${renderSeparatorTraceTextMetric('Pressure Basis', input.pressureInputBasis)}
                ${renderSeparatorTraceMetric('Pressure Input', trace.boundary?.pressureInput, input.pressureInputUnit || '')}
                ${renderSeparatorTraceTextMetric('Unit Standard', input.unitStandard)}
                ${renderSeparatorTraceTextMetric('Flow Basis', input.flowBasis)}
                ${renderSeparatorTraceTextMetric('Connected Pipe(s)', (input.connectedPipes || []).join(', ') || '-')}
                ${renderSeparatorTraceTextMetric('Attached SRC(s)', (input.attachedSources || []).join(', ') || '-')}
            </div>
        </div>
        <div class="pipe-trace-block separator-trace-block">
            <h4>Standard Example Values</h4>
            ${renderSeparatorStandardExample(trace.standardExample || {})}
        </div>
        <div class="pipe-trace-block separator-trace-block">
            <h4>Calculated Properties / Calculation Trace</h4>
            ${renderSeparatorTraceReadouts(trace.readouts || [], vesselLabel)}
        </div>
        <div class="pipe-trace-block separator-trace-block">
            <h4>Flow Balance</h4>
            <div class="pipe-trace-metric-grid">
                ${renderSeparatorTraceTextMetric('Connected Pipes', (flow.connectedPipes || []).join(', ') || '-')}
                ${renderSeparatorTraceTextMetric('Attached SRC(s)', (flow.connectedSources || []).join(', ') || '-')}
                ${renderSeparatorTraceMetric('Hydraulic Inlet Flow', flow.hydraulicInletFlow, 'm3/h', 'vessel-hydraulic-inlet-flow')}
                ${renderSeparatorTraceMetric('Hydraulic Outlet Flow', flow.hydraulicOutletFlow, 'm3/h', 'vessel-hydraulic-outlet-flow')}
                ${renderSeparatorTraceMetric('Total SRC Feed Flow', flow.sourceFeedFlow, 'm3/h', 'vessel-source-feed-flow')}
                ${renderSeparatorTraceMetric('Inlet Flow', flow.inletFlow, 'm3/h', 'vessel-inlet-flow')}
                ${renderSeparatorTraceMetric('Outlet Flow', flow.outletFlow, 'm3/h', 'vessel-outlet-flow')}
                ${renderSeparatorTraceMetric('Net Flow', flow.netFlow, 'm3/h', 'vessel-net-flow')}
                ${renderSeparatorTraceTextMetric('Level Trend', flow.levelTrend)}
            </div>
            <div class="pipe-trace-source-note">SRC Feed Flow Breakdown</div>
            ${renderSeparatorTraceSourceFeedList(flow.sourceFeedFlows)}
        </div>
        <div class="pipe-trace-block separator-trace-block">
            <h4>Dependency Chain</h4>
            ${renderSeparatorDependencyChain(trace.dependencyChain || [], vesselLabel)}
        </div>
        <div class="pipe-trace-block separator-trace-block">
            <h4>Equation Steps</h4>
            <div class="pipe-trace-table-scroll">
                <table class="pipe-trace-table separator-trace-table">
                    <thead>
                        <tr>
                            <th>Step</th>
                            <th>Formula</th>
                            <th>Substitution</th>
                            <th>Result</th>
                            <th>Reference</th>
                        </tr>
                    </thead>
                    <tbody>${renderSeparatorTraceStepRows(trace.steps || [], vesselLabel)}</tbody>
                </table>
            </div>
        </div>
        <div class="pipe-trace-block separator-trace-block">
            <h4>Warnings / Advisories</h4>
            ${renderSeparatorTraceList(trace.warnings, 'OK')}
        </div>
        <div class="pipe-trace-block separator-trace-block">
            <h4>Assumptions</h4>
            ${renderSeparatorTraceList(trace.assumptions)}
        </div>
        <div class="pipe-trace-block separator-trace-block">
            <h4>References / Method</h4>
            ${renderSeparatorTraceList(trace.references)}
        </div>
    `;
}

function getSeparatorCalculationTraceForRender(nodeId, node) {
    if (!node) return null;
    if (typeof buildSeparatorCalculationTrace === 'function') {
        return buildSeparatorCalculationTrace(nodeId || node, globalModel, connections);
    }
    return node.results?.calculationTrace || null;
}

function renderSeparatorCalculationTrace(nodeId, node, tbody) {
    const trace = getSeparatorCalculationTraceForRender(nodeId, node);
    const tr = document.createElement('tr');
    const openAttribute = typeof window === 'undefined' || window.innerWidth >= 700 ? 'open' : '';
    tr.innerHTML = `
        <td colspan="2" class="pipe-trace-cell separator-trace-cell">
            <details class="pipe-calculation-trace separator-calculation-trace" ${openAttribute}>
                <summary>Calculation Trace / Step-by-step Report</summary>
                <div class="pipe-calculation-trace-body separator-calculation-trace-body"
                    data-key="separator-calculation-trace-body"
                    data-vessel-id="${escapeHtml(nodeId)}">
                    ${renderSeparatorCalculationTraceReport(trace)}
                </div>
            </details>
        </td>
    `;
    tbody.appendChild(tr);
}

function updateSeparatorCalculationTraceReadout(vesselId = null) {
    document.querySelectorAll('[data-key="separator-calculation-trace-body"]').forEach(traceBody => {
        const nodeId = vesselId || traceBody.dataset.vesselId;
        if (!nodeId || (vesselId && traceBody.dataset.vesselId !== vesselId)) return;
        const node = typeof globalModel !== 'undefined' ? globalModel[nodeId] : null;
        const trace = getSeparatorCalculationTraceForRender(nodeId, node);
        traceBody.innerHTML = renderSeparatorCalculationTraceReport(trace);
    });
}

function updateAllSeparatorCalculationTraceReadouts() {
    if (typeof globalModel === 'undefined') return;
    Object.keys(globalModel).forEach(nodeId => {
        if (['separator', 'verticalVessel'].includes(globalModel[nodeId]?.type)) {
            if (typeof buildSeparatorCalculationTrace === 'function') {
                if (!globalModel[nodeId].results) globalModel[nodeId].results = {};
                globalModel[nodeId].results.calculationTrace = buildSeparatorCalculationTrace(nodeId, globalModel, connections);
            }
        }
    });
    updateSeparatorCalculationTraceReadout();
}

function formatInstrumentTraceDisplayValue(value, unit = '', digits = 3) {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof formatDisplayUnitValueByUnit === 'function') {
        return formatDisplayUnitValueByUnit(value, unit, digits, '', unit);
    }
    const display = typeof formatReadoutValue === 'function' ? formatReadoutValue(value) : String(value);
    return `${display}${unit && display !== '-' ? ` ${unit}` : ''}`;
}

function renderInstrumentTraceMetric(label, value, unit = '', key = '') {
    return `
        <div class="pipe-trace-metric instrument-trace-metric">
            <span>${escapeHtml(label)}</span>
            <strong${key ? ` class="prop-value" data-key="${escapeHtml(key)}"` : ''}>${escapeHtml(formatInstrumentTraceDisplayValue(value, unit))}</strong>
        </div>
    `;
}

function renderInstrumentTraceTextMetric(label, value) {
    return `
        <div class="pipe-trace-metric instrument-trace-metric instrument-trace-metric-wide">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value || '-')}</strong>
        </div>
    `;
}

function renderInstrumentTraceReadouts(readouts = []) {
    if (!Array.isArray(readouts) || readouts.length === 0) {
        return '<div class="pipe-trace-empty">No live readout available.</div>';
    }
    return `
        <div class="pipe-trace-metric-grid">
            ${readouts.map(item => renderInstrumentTraceMetric(item.label, item.value, item.unit || '', item.key || '')).join('')}
        </div>
    `;
}

function renderInstrumentTraceStepRows(steps = []) {
    if (!steps.length) {
        return '<tr><td colspan="5" class="pipe-trace-empty">No instrument trace steps available.</td></tr>';
    }
    return steps.map((step, index) => `
        <tr>
            <td data-label="Step">${index + 1}. ${escapeHtml(step.title || '-')}</td>
            <td data-label="Formula"><code>${escapeHtml(step.formula || '-')}</code></td>
            <td data-label="Substitution">${escapeHtml(step.substitution || '-')}</td>
            <td data-label="Result">${escapeHtml(formatInstrumentTraceDisplayValue(step.result, step.unit || ''))}</td>
            <td data-label="Reference">${escapeHtml(step.reference || '-')}</td>
        </tr>
    `).join('');
}

function renderInstrumentTraceList(items = [], emptyText = 'None') {
    const rows = (items || []).filter(Boolean);
    return `
        <ul class="pipe-trace-list instrument-trace-list">
            ${(rows.length ? rows : [emptyText]).map(item => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
    `;
}

function renderInstrumentCalculationTraceReport(trace) {
    if (!trace) {
        return '<div class="pipe-trace-empty">Instrument calculation trace is not available.</div>';
    }

    const input = trace.inputBasis || {};
    const warnings = trace.warnings || [];
    const statusClass = warnings.length || String(trace.status || '').toLowerCase().includes('waiting')
        ? 'pipe-trace-status-unsolved'
        : 'pipe-trace-status-solved';

    return `
        <div class="pipe-trace-status ${statusClass}">
            ${escapeHtml(trace.status || '-')}
        </div>
        <div class="pipe-trace-block instrument-trace-block">
            <h4>Input Basis</h4>
            <div class="pipe-trace-metric-grid">
                ${renderInstrumentTraceTextMetric('Instrument', input.instrumentId)}
                ${renderInstrumentTraceTextMetric('Type', input.instrumentType)}
                ${renderInstrumentTraceTextMetric('Attached Pipe', input.attachedPipe)}
                ${renderInstrumentTraceMetric('Tap Location', input.tapLocationPercent, '%')}
                ${renderInstrumentTraceTextMetric('Unit Standard', input.unitStandard)}
                ${input.outputMode ? renderInstrumentTraceTextMetric('Output Mode', input.outputMode) : ''}
                ${input.setPoint !== undefined && input.setPoint !== '' ? renderInstrumentTraceMetric('Set Point', input.setPoint, '%') : ''}
            </div>
        </div>
        <div class="pipe-trace-block instrument-trace-block">
            <h4>Realtime Readouts</h4>
            ${renderInstrumentTraceReadouts(trace.readouts || [])}
        </div>
        <div class="pipe-trace-block instrument-trace-block">
            <h4>Equation Steps</h4>
            <div class="pipe-trace-table-scroll">
                <table class="pipe-trace-table instrument-trace-table">
                    <thead>
                        <tr>
                            <th>Step</th>
                            <th>Formula</th>
                            <th>Substitution</th>
                            <th>Result</th>
                            <th>Reference</th>
                        </tr>
                    </thead>
                    <tbody>${renderInstrumentTraceStepRows(trace.steps || [])}</tbody>
                </table>
            </div>
        </div>
        <div class="pipe-trace-block instrument-trace-block">
            <h4>Warnings / Advisories</h4>
            ${renderInstrumentTraceList(trace.warnings, 'OK')}
        </div>
        <div class="pipe-trace-block instrument-trace-block">
            <h4>Assumptions</h4>
            ${renderInstrumentTraceList(trace.assumptions)}
        </div>
        <div class="pipe-trace-block instrument-trace-block">
            <h4>References / Method</h4>
            ${renderInstrumentTraceList(trace.references)}
        </div>
    `;
}

function getInstrumentCalculationTraceForRender(nodeId, node) {
    if (!node) return null;
    if (typeof buildInstrumentCalculationTrace === 'function') {
        return buildInstrumentCalculationTrace(nodeId, globalModel, connections);
    }
    return node.results?.calculationTrace || null;
}

function renderInstrumentCalculationTrace(nodeId, node, tbody) {
    const trace = getInstrumentCalculationTraceForRender(nodeId, node);
    const tr = document.createElement('tr');
    const openAttribute = typeof window === 'undefined' || window.innerWidth >= 700 ? 'open' : '';
    tr.innerHTML = `
        <td colspan="2" class="pipe-trace-cell instrument-trace-cell">
            <details class="pipe-calculation-trace instrument-calculation-trace" ${openAttribute}>
                <summary>Calculation Trace / Step-by-step Report</summary>
                <div class="pipe-calculation-trace-body instrument-calculation-trace-body"
                    data-key="instrument-calculation-trace-body"
                    data-instrument-id="${escapeHtml(nodeId)}">
                    ${renderInstrumentCalculationTraceReport(trace)}
                </div>
            </details>
        </td>
    `;
    tbody.appendChild(tr);
}

function updateInstrumentCalculationTraceReadout(instrumentId) {
    document.querySelectorAll('[data-key="instrument-calculation-trace-body"]').forEach(traceBody => {
        const nodeId = instrumentId || traceBody.dataset.instrumentId;
        if (!nodeId || (instrumentId && traceBody.dataset.instrumentId !== instrumentId)) return;
        const node = typeof globalModel !== 'undefined' ? globalModel[nodeId] : null;
        const trace = getInstrumentCalculationTraceForRender(nodeId, node);
        traceBody.innerHTML = renderInstrumentCalculationTraceReport(trace);
    });
}

function formatHeatExchangerTraceDisplayValue(value, unit = '', digits = 3) {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof formatDisplayUnitValueByUnit === 'function') {
        return formatDisplayUnitValueByUnit(value, unit, digits, '', unit);
    }
    const display = typeof formatReadoutValue === 'function' ? formatReadoutValue(value) : String(value);
    return `${display}${unit && display !== '-' ? ` ${unit}` : ''}`;
}

function renderHeatExchangerTraceMetric(label, value, unit = '', key = '', digits = 3) {
    return `
        <div class="pipe-trace-metric heat-exchanger-trace-metric">
            <span>${escapeHtml(label)}</span>
            <strong${key ? ` class="prop-value" data-key="${escapeHtml(key)}"` : ''}>${escapeHtml(formatHeatExchangerTraceDisplayValue(value, unit, digits))}</strong>
        </div>
    `;
}

function renderHeatExchangerTraceTextMetric(label, value) {
    return `
        <div class="pipe-trace-metric heat-exchanger-trace-metric heat-exchanger-trace-metric-wide">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value || '-')}</strong>
        </div>
    `;
}

function renderHeatExchangerTraceReadouts(readouts = []) {
    if (!Array.isArray(readouts) || readouts.length === 0) {
        return '<div class="pipe-trace-empty">No Heat Exchanger readout available.</div>';
    }
    return `
        <div class="pipe-trace-metric-grid">
            ${readouts.map(item => renderHeatExchangerTraceMetric(item.label, item.value, item.unit || '', item.key || '', item.digits ?? 3)).join('')}
        </div>
    `;
}

function renderHeatExchangerTraceStepRows(steps = []) {
    if (!steps.length) {
        return '<tr><td colspan="5" class="pipe-trace-empty">No Heat Exchanger trace steps available.</td></tr>';
    }
    return steps.map((step, index) => `
        <tr>
            <td data-label="Step">${index + 1}. ${escapeHtml(step.title || '-')}</td>
            <td data-label="Formula"><code>${escapeHtml(step.formula || '-')}</code></td>
            <td data-label="Substitution">${escapeHtml(step.substitution || '-')}</td>
            <td data-label="Result">${escapeHtml(formatHeatExchangerTraceDisplayValue(step.result, step.unit || '', step.digits ?? 3))}</td>
            <td data-label="Reference">${escapeHtml(step.reference || '-')}</td>
        </tr>
    `).join('');
}

function renderHeatExchangerTraceList(items = [], emptyText = 'None') {
    const rows = (items || []).filter(Boolean);
    return `
        <ul class="pipe-trace-list heat-exchanger-trace-list">
            ${(rows.length ? rows : [emptyText]).map(item => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
    `;
}

function renderHeatExchangerDependencyChain(items = []) {
    const rows = (items || []).filter(Boolean);
    if (!rows.length) {
        return '<div class="pipe-trace-empty">No Heat Exchanger dependency chain available.</div>';
    }
    return `
        <ol class="pipe-trace-list heat-exchanger-trace-list heat-exchanger-dependency-chain">
            ${rows.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
        </ol>
    `;
}

function getHeatExchangerCalculationTraceForRender(nodeId, node) {
    if (!node) return null;
    if (typeof buildHeatExchangerCalculationTrace === 'function') {
        return buildHeatExchangerCalculationTrace(nodeId || node, globalModel, connections);
    }
    return node.results?.calculationTrace || null;
}

function renderHeatExchangerReadoutCards(nodeId, node, tbody) {
    const trace = getHeatExchangerCalculationTraceForRender(nodeId, node);
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td colspan="2" style="padding: 10px 12px;">
            ${renderHeatExchangerTraceReadouts(trace?.readouts || [])}
        </td>
    `;
    tbody.appendChild(tr);
}

function renderHeatExchangerCalculationTraceReport(trace) {
    if (!trace) {
        return '<div class="pipe-trace-empty">Heat Exchanger calculation trace is not available.</div>';
    }

    const input = trace.inputBasis || {};
    const warnings = trace.warnings || [];
    const statusClass = warnings.length
        ? 'pipe-trace-status-unsolved'
        : 'pipe-trace-status-solved';

    return `
        <div class="pipe-trace-status ${statusClass}">
            ${escapeHtml(trace.status || '-')}
        </div>
        <div class="pipe-trace-block heat-exchanger-trace-block">
            <h4>Input Basis</h4>
            <div class="pipe-trace-metric-grid">
                ${renderHeatExchangerTraceTextMetric('Heat Exchanger', input.exchangerId)}
                ${renderHeatExchangerTraceTextMetric('Model Basis', input.modelBasis)}
                ${renderHeatExchangerTraceTextMetric('Unit Standard', input.unitStandard)}
                ${renderHeatExchangerTraceTextMetric('Active Fluid', input.fluidName)}
                ${renderHeatExchangerTraceTextMetric('Flow Basis', input.flowBasis)}
                ${renderHeatExchangerTraceTextMetric('Connected Pipe(s)', (input.connectedPipes || []).join(', ') || '-')}
                ${renderHeatExchangerTraceTextMetric('Pump Path Role', input.npshPathRole)}
            </div>
        </div>
        <div class="pipe-trace-block heat-exchanger-trace-block">
            <h4>Calculated Properties / Calculation Trace</h4>
            ${renderHeatExchangerTraceReadouts(trace.readouts || [])}
        </div>
        <div class="pipe-trace-block heat-exchanger-trace-block">
            <h4>NPSH Role</h4>
            <div class="pipe-trace-metric-grid">
                ${renderHeatExchangerTraceMetric('Pressure Drop Head', trace.hydraulic?.pressureDropHead, 'm', 'hx-pressure-drop-head')}
                ${renderHeatExchangerTraceMetric('NPSH Loss Contribution', trace.hydraulic?.npshLossContribution, 'm', 'hx-npsh-loss-contribution')}
                ${renderHeatExchangerTraceTextMetric('Detected Role', input.npshPathRole)}
            </div>
            ${renderHeatExchangerTraceList((trace.npshPathInfo || []).map(row => `${row.pumpId}: ${row.role}; ${row.npshEffect}`), 'No detected pump suction/discharge path role.')}
        </div>
        <div class="pipe-trace-block heat-exchanger-trace-block">
            <h4>Dependency Chain</h4>
            ${renderHeatExchangerDependencyChain(trace.dependencyChain || [])}
        </div>
        <div class="pipe-trace-block heat-exchanger-trace-block">
            <h4>Equation Steps</h4>
            <div class="pipe-trace-table-scroll">
                <table class="pipe-trace-table heat-exchanger-trace-table">
                    <thead>
                        <tr>
                            <th>Step</th>
                            <th>Formula</th>
                            <th>Substitution</th>
                            <th>Result</th>
                            <th>Reference</th>
                        </tr>
                    </thead>
                    <tbody>${renderHeatExchangerTraceStepRows(trace.steps || [])}</tbody>
                </table>
            </div>
        </div>
        <div class="pipe-trace-block heat-exchanger-trace-block">
            <h4>Warnings / Advisories</h4>
            ${renderHeatExchangerTraceList(trace.warnings, 'OK')}
        </div>
        <div class="pipe-trace-block heat-exchanger-trace-block">
            <h4>Assumptions</h4>
            ${renderHeatExchangerTraceList(trace.assumptions)}
        </div>
        <div class="pipe-trace-block heat-exchanger-trace-block">
            <h4>References / Method</h4>
            ${renderHeatExchangerTraceList(trace.references)}
        </div>
    `;
}

function renderHeatExchangerCalculationTrace(nodeId, node, tbody) {
    const trace = getHeatExchangerCalculationTraceForRender(nodeId, node);
    const tr = document.createElement('tr');
    const openAttribute = typeof window === 'undefined' || window.innerWidth >= 700 ? 'open' : '';
    tr.innerHTML = `
        <td colspan="2" class="pipe-trace-cell heat-exchanger-trace-cell">
            <details class="pipe-calculation-trace heat-exchanger-calculation-trace" ${openAttribute}>
                <summary>Calculation Trace / Step-by-step Report</summary>
                <div class="pipe-calculation-trace-body heat-exchanger-calculation-trace-body"
                    data-key="heat-exchanger-calculation-trace-body"
                    data-exchanger-id="${escapeHtml(nodeId)}">
                    ${renderHeatExchangerCalculationTraceReport(trace)}
                </div>
            </details>
        </td>
    `;
    tbody.appendChild(tr);
}

function updateHeatExchangerCalculationTraceReadout(exchangerId = null) {
    document.querySelectorAll('[data-key="heat-exchanger-calculation-trace-body"]').forEach(traceBody => {
        const nodeId = exchangerId || traceBody.dataset.exchangerId;
        if (!nodeId || (exchangerId && traceBody.dataset.exchangerId !== exchangerId)) return;
        const node = typeof globalModel !== 'undefined' ? globalModel[nodeId] : null;
        const trace = getHeatExchangerCalculationTraceForRender(nodeId, node);
        traceBody.innerHTML = renderHeatExchangerCalculationTraceReport(trace);
    });
}

function updateAllHeatExchangerCalculationTraceReadouts() {
    if (typeof globalModel === 'undefined') return;
    Object.keys(globalModel).forEach(nodeId => {
        if (globalModel[nodeId]?.type === 'heatExchanger' && typeof buildHeatExchangerCalculationTrace === 'function') {
            if (!globalModel[nodeId].results) globalModel[nodeId].results = {};
            globalModel[nodeId].results.calculationTrace = buildHeatExchangerCalculationTrace(nodeId, globalModel, connections);
        }
    });
    updateHeatExchangerCalculationTraceReadout();
}

function formatValveTraceDisplayValue(value, unit = '', digits = 3, key = '', label = '') {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'string') return value;
    if (typeof formatDisplayUnitValueByUnit === 'function') {
        return formatDisplayUnitValueByUnit(value, unit, digits, key, label || unit);
    }
    const display = typeof formatReadoutValue === 'function' ? formatReadoutValue(value) : String(value);
    return `${display}${unit && display !== '-' ? ` ${unit}` : ''}`;
}

function renderValveTraceMetric(label, value, unit = '', key = '', digits = 3) {
    return `
        <div class="pipe-trace-metric valve-trace-metric">
            <span>${escapeHtml(label)}</span>
            <strong${key ? ` class="prop-value" data-key="${escapeHtml(key)}"` : ''}>${escapeHtml(formatValveTraceDisplayValue(value, unit, digits, key, label))}</strong>
        </div>
    `;
}

function renderValveTraceTextMetric(label, value) {
    return `
        <div class="pipe-trace-metric valve-trace-metric valve-trace-metric-wide">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value || '-')}</strong>
        </div>
    `;
}

function renderValveTraceReadouts(readouts = []) {
    if (!Array.isArray(readouts) || readouts.length === 0) {
        return '<div class="pipe-trace-empty">No valve readout available.</div>';
    }
    return `
        <div class="pipe-trace-metric-grid">
            ${readouts.map(item => {
                if (item.kind === 'text') return renderValveTraceTextMetric(item.label, item.value);
                return renderValveTraceMetric(item.label, item.value, item.unit || '', item.key || '', item.digits ?? 3);
            }).join('')}
        </div>
    `;
}

function renderValveTraceStepRows(steps = []) {
    if (!steps.length) {
        return '<tr><td colspan="5" class="pipe-trace-empty">No valve trace steps available.</td></tr>';
    }
    return steps.map((step, index) => `
        <tr>
            <td data-label="Step">${index + 1}. ${escapeHtml(step.title || '-')}</td>
            <td data-label="Formula"><code>${escapeHtml(step.formula || '-')}</code></td>
            <td data-label="Substitution">${escapeHtml(step.substitution || '-')}</td>
            <td data-label="Result">${escapeHtml(formatValveTraceDisplayValue(step.result, step.unit || '', step.digits ?? 3, step.title || '', step.title || ''))}</td>
            <td data-label="Reference">${escapeHtml(step.reference || '-')}</td>
        </tr>
    `).join('');
}

function renderValveTraceList(items = [], emptyText = 'None') {
    const rows = (items || []).filter(Boolean);
    return `
        <ul class="pipe-trace-list valve-trace-list">
            ${(rows.length ? rows : [emptyText]).map(item => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
    `;
}

function renderValveDependencyChain(items = []) {
    const rows = (items || []).filter(Boolean);
    if (!rows.length) {
        return '<div class="pipe-trace-empty">No valve dependency chain available.</div>';
    }
    return `
        <ol class="pipe-trace-list valve-trace-list valve-dependency-chain">
            ${rows.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
        </ol>
    `;
}

function getValveCalculationTraceForRender(nodeId, node) {
    if (!node) return null;
    if (typeof buildValveCalculationTrace === 'function') {
        return buildValveCalculationTrace(nodeId || node, globalModel, connections);
    }
    return node.results?.calculationTrace || null;
}

function renderValveReadoutCards(nodeId, node, tbody) {
    const trace = getValveCalculationTraceForRender(nodeId, node);
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td colspan="2" style="padding: 10px 12px;">
            ${renderValveTraceReadouts(trace?.readouts || [])}
        </td>
    `;
    tbody.appendChild(tr);
}

function renderValveCalculationTraceReport(trace) {
    if (!trace) {
        return '<div class="pipe-trace-empty">Valve calculation trace is not available.</div>';
    }

    const input = trace.inputBasis || {};
    const hydraulic = trace.hydraulic || {};
    const warnings = trace.warnings || [];
    const statusClass = warnings.length
        ? 'pipe-trace-status-unsolved'
        : 'pipe-trace-status-solved';

    return `
        <div class="pipe-trace-status ${statusClass}">
            ${escapeHtml(trace.status || '-')}
        </div>
        <div class="pipe-trace-block valve-trace-block">
            <h4>Input Basis</h4>
            <div class="pipe-trace-metric-grid">
                ${renderValveTraceTextMetric('Valve', input.valveId)}
                ${renderValveTraceTextMetric('Object Type', input.objectType)}
                ${renderValveTraceTextMetric('Model Basis', input.modelBasis)}
                ${renderValveTraceTextMetric('Unit Standard', input.unitStandard)}
                ${renderValveTraceTextMetric('Active Fluid', input.activeFluid)}
                ${renderValveTraceTextMetric('Flow Basis', input.flowBasis)}
                ${renderValveTraceTextMetric('Connected Pipe(s)', (input.connectedPipes || []).join(', ') || '-')}
                ${renderValveTraceTextMetric('Pump Path Role', input.npshPathRole)}
            </div>
        </div>
        <div class="pipe-trace-block valve-trace-block">
            <h4>Calculated Properties / Calculation Trace</h4>
            ${renderValveTraceReadouts(trace.readouts || [])}
        </div>
        <div class="pipe-trace-block valve-trace-block">
            <h4>NPSH Role</h4>
            <div class="pipe-trace-metric-grid">
                ${renderValveTraceMetric('Valve Head Loss', hydraulic.headLoss, 'm', 'valve-head-loss')}
                ${renderValveTraceMetric('Valve Pressure Drop', hydraulic.pressureDropBar, 'bar', 'valve-pressure-drop', 6)}
                ${renderValveTraceMetric('NPSH Loss Contribution', hydraulic.npshLossContribution, 'm', 'valve-npsh-loss-contribution')}
                ${renderValveTraceTextMetric('Detected Role', input.npshPathRole)}
            </div>
            ${renderValveTraceList((trace.npshPathInfo || []).map(row => `${row.pumpId}: ${row.role}; ${row.npshEffect}`), 'No detected pump suction/discharge path role.')}
        </div>
        ${trace.controlValve ? `
        <div class="pipe-trace-block valve-trace-block">
            <h4>Control Valve Sizing / NPSH Focus</h4>
            <div class="pipe-trace-metric-grid">
                ${renderValveTraceTextMetric('Sizing Basis', trace.controlValve.sizingBasis)}
                ${renderValveTraceTextMetric('Flow Characteristic', trace.controlValve.flowCharacteristic)}
                ${renderValveTraceMetric('Cv Input', trace.controlValve.cvInput, '', 'control-valve-cv-input')}
                ${renderValveTraceMetric('Effective Cv', trace.controlValve.effectiveCv, '', 'control-valve-effective-cv')}
                ${renderValveTraceMetric('Opening', trace.controlValve.openingPercent, '%', 'control-valve-opening')}
                ${renderValveTraceMetric('Pressure Drop', trace.controlValve.pressureDropBar, 'bar', 'control-valve-pressure-drop', 6)}
                ${renderValveTraceMetric('Head Loss', trace.controlValve.headLoss, 'm', 'control-valve-head-loss')}
                ${renderValveTraceMetric('NPSH Loss Contribution', trace.controlValve.npshLossContribution, 'm', 'control-valve-npsh-loss-contribution')}
            </div>
            ${renderValveTraceList(trace.controlValve.limitations || [])}
        </div>
        ` : ''}
        <div class="pipe-trace-block valve-trace-block">
            <h4>Dependency Chain</h4>
            ${renderValveDependencyChain(trace.dependencyChain || [])}
        </div>
        <div class="pipe-trace-block valve-trace-block">
            <h4>Equation Steps</h4>
            <div class="pipe-trace-table-scroll">
                <table class="pipe-trace-table valve-trace-table">
                    <thead>
                        <tr>
                            <th>Step</th>
                            <th>Formula</th>
                            <th>Substitution</th>
                            <th>Result</th>
                            <th>Reference</th>
                        </tr>
                    </thead>
                    <tbody>${renderValveTraceStepRows(trace.steps || [])}</tbody>
                </table>
            </div>
        </div>
        <div class="pipe-trace-block valve-trace-block">
            <h4>Warnings / Advisories</h4>
            ${renderValveTraceList(trace.warnings, 'OK')}
        </div>
        <div class="pipe-trace-block valve-trace-block">
            <h4>Assumptions</h4>
            ${renderValveTraceList(trace.assumptions)}
        </div>
        <div class="pipe-trace-block valve-trace-block">
            <h4>References / Method</h4>
            ${renderValveTraceList(trace.references)}
        </div>
    `;
}

function renderValveCalculationTrace(nodeId, node, tbody) {
    const trace = getValveCalculationTraceForRender(nodeId, node);
    const tr = document.createElement('tr');
    const openAttribute = typeof window === 'undefined' || window.innerWidth >= 700 ? 'open' : '';
    tr.innerHTML = `
        <td colspan="2" class="pipe-trace-cell valve-trace-cell">
            <details class="pipe-calculation-trace valve-calculation-trace" ${openAttribute}>
                <summary>Calculation Trace / Step-by-step Report</summary>
                <div class="pipe-calculation-trace-body valve-calculation-trace-body"
                    data-key="valve-calculation-trace-body"
                    data-valve-id="${escapeHtml(nodeId)}">
                    ${renderValveCalculationTraceReport(trace)}
                </div>
            </details>
        </td>
    `;
    tbody.appendChild(tr);
}

function updateValveCalculationTraceReadout(valveId = null) {
    document.querySelectorAll('[data-key="valve-calculation-trace-body"]').forEach(traceBody => {
        const nodeId = valveId || traceBody.dataset.valveId;
        if (!nodeId || (valveId && traceBody.dataset.valveId !== valveId)) return;
        const node = typeof globalModel !== 'undefined' ? globalModel[nodeId] : null;
        const trace = getValveCalculationTraceForRender(nodeId, node);
        traceBody.innerHTML = renderValveCalculationTraceReport(trace);
    });
}

function updateAllValveCalculationTraceReadouts() {
    if (typeof globalModel === 'undefined') return;
    Object.keys(globalModel).forEach(nodeId => {
        if (['valve', 'checkValve'].includes(globalModel[nodeId]?.type) && typeof buildValveCalculationTrace === 'function') {
            if (!globalModel[nodeId].results) globalModel[nodeId].results = {};
            globalModel[nodeId].results.calculationTrace = buildValveCalculationTrace(nodeId, globalModel, connections);
        }
    });
    updateValveCalculationTraceReadout();
}

function formatSourceTraceDisplayValue(value, unit = '', digits = 3) {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof formatDisplayUnitValueByUnit === 'function') {
        return formatDisplayUnitValueByUnit(value, unit, digits, '', unit);
    }
    const display = typeof formatReadoutValue === 'function' ? formatReadoutValue(value) : String(value);
    return `${display}${unit && display !== '-' ? ` ${unit}` : ''}`;
}

function renderSourceTraceMetric(label, value, unit = '', key = '') {
    return `
        <div class="pipe-trace-metric source-trace-metric">
            <span>${escapeHtml(label)}</span>
            <strong${key ? ` class="prop-value" data-key="${escapeHtml(key)}"` : ''}>${escapeHtml(formatSourceTraceDisplayValue(value, unit))}</strong>
        </div>
    `;
}

function renderSourceTraceTextMetric(label, value) {
    return `
        <div class="pipe-trace-metric source-trace-metric source-trace-metric-wide">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value || '-')}</strong>
        </div>
    `;
}

function renderSourceTraceReadouts(readouts = []) {
    if (!Array.isArray(readouts) || readouts.length === 0) {
        return '<div class="pipe-trace-empty">No SRC boundary readout available.</div>';
    }
    return `
        <div class="pipe-trace-metric-grid">
            ${readouts.map(item => renderSourceTraceMetric(item.label, item.value, item.unit || '', item.key || '')).join('')}
        </div>
    `;
}

function renderSourceTraceStepRows(steps = []) {
    if (!steps.length) {
        return '<tr><td colspan="5" class="pipe-trace-empty">No SRC trace steps available.</td></tr>';
    }
    return steps.map((step, index) => `
        <tr>
            <td data-label="Step">${index + 1}. ${escapeHtml(step.title || '-')}</td>
            <td data-label="Formula"><code>${escapeHtml(step.formula || '-')}</code></td>
            <td data-label="Substitution">${escapeHtml(step.substitution || '-')}</td>
            <td data-label="Result">${escapeHtml(formatSourceTraceDisplayValue(step.result, step.unit || ''))}</td>
            <td data-label="Reference">${escapeHtml(step.reference || '-')}</td>
        </tr>
    `).join('');
}

function renderSourceTraceList(items = [], emptyText = 'None') {
    const rows = (items || []).filter(Boolean);
    return `
        <ul class="pipe-trace-list source-trace-list">
            ${(rows.length ? rows : [emptyText]).map(item => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
    `;
}

function renderSourceDependencyChain(items = []) {
    const rows = (items || []).filter(Boolean);
    if (!rows.length) {
        return '<div class="pipe-trace-empty">No SRC dependency chain available.</div>';
    }
    return `
        <ol class="pipe-trace-list source-trace-list source-dependency-chain">
            ${rows.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
        </ol>
    `;
}

function renderSourceCalculationTraceReport(trace) {
    if (!trace) {
        return '<div class="pipe-trace-empty">SRC calculation trace is not available.</div>';
    }

    const input = trace.inputBasis || {};
    const warnings = trace.warnings || [];
    const statusClass = warnings.length || String(trace.status || '').toLowerCase().includes('missing')
        ? 'pipe-trace-status-unsolved'
        : 'pipe-trace-status-solved';

    return `
        <div class="pipe-trace-status ${statusClass}">
            ${escapeHtml(trace.status || '-')}
        </div>
        <div class="pipe-trace-block source-trace-block">
            <h4>Input Basis</h4>
            <div class="pipe-trace-metric-grid">
                ${renderSourceTraceTextMetric('SRC', input.sourceId)}
                ${renderSourceTraceTextMetric('Source Type', input.sourceType)}
                ${renderSourceTraceTextMetric('Boundary Role', input.role)}
                ${renderSourceTraceTextMetric('Connection Rule', input.connectionStyle)}
                ${renderSourceTraceTextMetric('Boundary Data Source', input.boundaryDataSource)}
                ${renderSourceTraceTextMetric('Attached Equipment', input.attachedEquipment)}
                ${renderSourceTraceTextMetric('Pressure Basis', input.pressureInputBasis)}
                ${renderSourceTraceTextMetric('Pressure Energy Basis', input.pressureEnergyBasis)}
                ${renderSourceTraceTextMetric('Temperature Mode', input.temperatureMode)}
                ${renderSourceTraceTextMetric('Flow Input Mode', input.flowInputMode)}
                ${renderSourceTraceTextMetric('Unit Standard', input.unitStandard)}
                ${renderSourceTraceTextMetric('Hydraulic Pipe(s)', (input.hydraulicPipes || []).join(', ') || '-')}
                ${renderSourceTraceTextMetric('Pump Path Status', input.pumpPathStatus)}
                ${renderSourceTraceTextMetric('Pump Path', input.pumpPath)}
            </div>
        </div>
        <div class="pipe-trace-block source-trace-block">
            <h4>Boundary / Fluid Readouts</h4>
            ${renderSourceTraceReadouts(trace.readouts || [])}
        </div>
        <div class="pipe-trace-block source-trace-block">
            <h4>Dependency Chain</h4>
            ${renderSourceDependencyChain(trace.dependencyChain || [])}
        </div>
        <div class="pipe-trace-block source-trace-block">
            <h4>Equation Steps</h4>
            <div class="pipe-trace-table-scroll">
                <table class="pipe-trace-table source-trace-table">
                    <thead>
                        <tr>
                            <th>Step</th>
                            <th>Formula</th>
                            <th>Substitution</th>
                            <th>Result</th>
                            <th>Reference</th>
                        </tr>
                    </thead>
                    <tbody>${renderSourceTraceStepRows(trace.steps || [])}</tbody>
                </table>
            </div>
        </div>
        <div class="pipe-trace-block source-trace-block">
            <h4>Warnings / Advisories</h4>
            ${renderSourceTraceList(trace.warnings, 'OK')}
        </div>
        <div class="pipe-trace-block source-trace-block">
            <h4>Assumptions</h4>
            ${renderSourceTraceList(trace.assumptions)}
        </div>
        <div class="pipe-trace-block source-trace-block">
            <h4>References / Method</h4>
            ${renderSourceTraceList(trace.references)}
        </div>
    `;
}

function getSourceCalculationTraceForRender(nodeId, node) {
    if (!node) return null;
    if (typeof buildSourceCalculationTrace === 'function') {
        return buildSourceCalculationTrace(nodeId, globalModel, connections);
    }
    return node.results?.calculationTrace || null;
}

function renderSourceCalculationTrace(nodeId, node, tbody) {
    const trace = getSourceCalculationTraceForRender(nodeId, node);
    const tr = document.createElement('tr');
    const openAttribute = typeof window === 'undefined' || window.innerWidth >= 700 ? 'open' : '';
    tr.innerHTML = `
        <td colspan="2" class="pipe-trace-cell source-trace-cell">
            <details class="pipe-calculation-trace source-calculation-trace" ${openAttribute}>
                <summary>Calculation Trace / Step-by-step Report</summary>
                <div class="pipe-calculation-trace-body source-calculation-trace-body"
                    data-key="source-calculation-trace-body"
                    data-source-id="${escapeHtml(nodeId)}">
                    ${renderSourceCalculationTraceReport(trace)}
                </div>
            </details>
        </td>
    `;
    tbody.appendChild(tr);
}

function updateSourceCalculationTraceReadout(sourceId = null) {
    document.querySelectorAll('[data-key="source-calculation-trace-body"]').forEach(traceBody => {
        const nodeId = sourceId || traceBody.dataset.sourceId;
        if (!nodeId || (sourceId && traceBody.dataset.sourceId !== sourceId)) return;
        const node = typeof globalModel !== 'undefined' ? globalModel[nodeId] : null;
        const trace = getSourceCalculationTraceForRender(nodeId, node);
        traceBody.innerHTML = renderSourceCalculationTraceReport(trace);
    });
}

function updateAllSourceCalculationTraceReadouts() {
    if (typeof globalModel === 'undefined') return;
    Object.keys(globalModel).forEach(nodeId => {
        if (globalModel[nodeId]?.type === 'source') {
            if (typeof buildSourceCalculationTrace === 'function') {
                if (!globalModel[nodeId].results) globalModel[nodeId].results = {};
                globalModel[nodeId].results.calculationTrace = buildSourceCalculationTrace(nodeId, globalModel, connections);
            }
        }
    });
    updateSourceCalculationTraceReadout();
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
                    <span>Total SRC Feed Flow</span>
                    <strong class="prop-value" data-key="tank-source-feed-flow">${formatReadoutValue(results.sourceFeedFlow)} m3/h</strong>
                </div>
                <div class="boundary-result-card">
                    <span>Net Flow</span>
                    <strong class="prop-value" data-key="tank-net-flow">${formatReadoutValue(results.netFlow)} m3/h</strong>
                </div>
                <div class="boundary-result-card">
                    <span>Level Trend</span>
                    <strong class="prop-value" data-key="tank-level-trend">${escapeHtml(results.levelTrend || '-')}</strong>
                </div>
                <div class="boundary-result-card boundary-result-card-wide">
                    <span>SRC Feed Flow Breakdown</span>
                    <div class="tank-source-feed-breakdown" data-key="tank-source-feed-breakdown">${renderTankSourceFeedFlowBreakdown(results.sourceFeedFlows)}</div>
                </div>
                <div class="boundary-result-card">
                    <span>Operating Abs. P</span>
                    <strong class="prop-value" data-key="tank-operating-abs-pressure">${formatReadoutValue(results.operatingPressureAbsolute)} bar a</strong>
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
        addRow('Current Level above Base', node.props.liquidLevel, 'liquidLevel', false, 'm', 'number');
        addRow('HLL above Base', node.props.hll, 'hll', false, 'm', 'number');
        addRow('NLL above Base', node.props.nll, 'nll', false, 'm', 'number');
        addRow('LLL above Base', node.props.lll, 'lll', false, 'm', 'number');
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
        appendSectionHeader(tbody, 'Calculation Trace');
        renderTankCalculationTrace(node, tbody);
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
        const sourceTypeMeaning = typeof getSourceTypeDescription === 'function'
            ? getSourceTypeDescription(node)
            : sourceMeaning;
        const elevationLabel = inheritedBoundary
            ? 'Liquid Level Elev. (Inherited)'
            : (node.props.sourceType === externalHeaderType ? 'Tie-in Elevation' : 'Source Elevation');

        appendSectionHeader(tbody, 'Source Definition');
        addRow('Source Type', node.props.sourceType, 'sourceType', false, '', 'select', sourceTypeOptions);
        addRow('Type Meaning', sourceTypeMeaning, 'source-type-meaning', true);
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
        const effectiveFluidProps = typeof getFluidPropsAtSourceTemperature === 'function'
            ? getFluidPropsAtSourceTemperature(node, fluidProps)
            : fluidProps;

        addRow(
            linkedToFluidBasis ? 'Temperature (Fluid Basis)' : 'Temperature',
            node.props.temp,
            linkedToFluidBasis ? 'source-temperature' : 'temp',
            linkedToFluidBasis,
            'deg C',
            'number'
        );
        addRow('Density Used', effectiveFluidProps.density, 'source-fluid-density', true, 'kg/m3');
        addRow('Kinematic Visc. Used', effectiveFluidProps.viscosity, 'source-fluid-viscosity', true, 'cSt');
        addRow('Vapor Pressure Used', effectiveFluidProps.vaporPressure, 'source-fluid-vapor-pressure', true, 'bar a');
        if (effectiveFluidProps.warnings?.length) {
            addRow('Fluid Property Warning', effectiveFluidProps.warnings.join(' | '), 'source-fluid-warning', true);
        }

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
        appendSectionHeader(tbody, 'Calculation Trace');
        renderSourceCalculationTrace(nodeId, node, tbody);
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

    if ((type === 'valve' || type === 'checkValve') && typeof updateValveCompatibilityResult === 'function') {
        updateValveCompatibilityResult(nodeId, globalModel, connections, { syncDiameter: true });
    }

    if (typeof isInstrumentType === 'function' && isInstrumentType(type) && typeof updateInstrumentReadout === 'function') {
        updateInstrumentReadout(nodeId);
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

    if (type === 'separator' || type === 'verticalVessel') {
        appendSectionHeader(tbody, 'Calculated Vessel Readout');
        renderSeparatorReadoutCards(nodeId, node, tbody);
        appendSectionHeader(tbody, 'Calculation Trace');
        renderSeparatorCalculationTrace(nodeId, node, tbody);
    }

    if (type === 'heatExchanger') {
        if (typeof updateHeatExchangerReadout === 'function') {
            updateHeatExchangerReadout(nodeId);
        }
        appendSectionHeader(tbody, 'Calculated Exchanger Readout');
        renderHeatExchangerReadoutCards(nodeId, node, tbody);
        appendSectionHeader(tbody, 'Calculation Trace');
        renderHeatExchangerCalculationTrace(nodeId, node, tbody);
    }

    if (type === 'checkValve') {
        addRow('Check Status', node.props.checkStatus || '-', 'checkStatus', true, '');
    }

    if (type === 'valve' || type === 'checkValve') {
        if (typeof updateValveReadout === 'function') {
            updateValveReadout(nodeId);
        }
        const audit = typeof updateValveCompatibilityResult === 'function'
            ? updateValveCompatibilityResult(nodeId, globalModel, connections, { syncDiameter: true })
            : node.results?.pipeCompatibility;
        const warnings = audit?.warnings || node.results?.warnings || [];
        appendSectionHeader(tbody, 'Calculated Valve Readout');
        renderValveReadoutCards(nodeId, node, tbody);
        appendSectionHeader(tbody, 'Pipe / Valve Compatibility');
        addRow('Connected Pipe(s)', audit?.connectedPipeText || '-', 'valve-connected-pipes', true);
        addRow('Size Match', audit?.sizeMatchStatus || '-', 'valve-size-match', true);
        addRow('Diameter Basis', audit?.diameterBasis || 'No connected pipe', 'valve-diameter-basis', true);
        addRow('Bore Basis', audit?.boreBasis || '-', 'valve-bore-basis', true);
        addRow('Spec Basis', audit?.specBasis || '-', 'valve-spec-basis', true);
        addRow('Reducer/Expander', audit?.reducerExpanderBasis || '-', 'valve-reducer-expander-basis', true);
        addRow('Equivalent Loss', audit?.equivalentLossText || '-', 'valve-equivalent-loss', true);
        addRow('Loss Source', audit?.lossSourceText || '-', 'valve-loss-source', true);
        addRow('Severity', audit?.severity || '-', 'valve-compatibility-severity', true);
        addRow('Compatibility Warnings', warnings.join(' | ') || 'OK', 'valve-warnings', true);
        appendSectionHeader(tbody, 'Calculation Trace');
        renderValveCalculationTrace(nodeId, node, tbody);
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

        appendSectionHeader(tbody, 'Calculation Trace');
        renderInstrumentCalculationTrace(nodeId, node, tbody);
    }

}
