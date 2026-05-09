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

function renderSourceAttachmentControls(nodeId, node, addRow, tbody) {
    if (typeof syncSourceAttachmentProps === 'function') {
        syncSourceAttachmentProps(nodeId);
    }

    const attachmentHeader = document.createElement('tr');
    attachmentHeader.innerHTML = '<td colspan="2" style="background:#eee; font-weight:bold; padding:4px 8px; text-align:center;">Equipment Attachment</td>';
    tbody.appendChild(attachmentHeader);

    addRow('Attached Equipment', node.props.attachedTo || '-', 'source-attached-to', true);

    const actionTr = document.createElement('tr');
    actionTr.innerHTML = `
        <td colspan="2" style="padding: 8px 12px;">
            <button class="btn-add-segment" data-node="${nodeId}">Attach to equipment</button>
            <button class="btn-disconnect-pipe" data-node="${nodeId}" style="margin-top: 6px;">Detach from equipment</button>
        </td>
    `;
    tbody.appendChild(actionTr);

    actionTr.querySelector('.btn-add-segment').addEventListener('click', () => {
        setAppMode('CONNECT');
        startSourceAttachment(nodeId);
    });
    actionTr.querySelector('.btn-disconnect-pipe').addEventListener('click', () => {
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
                            <td class="prop-label">Total Volume</td>
                            <td class="prop-value" data-key="volume">${formatReadoutValue(node.props.volume)} m3</td>
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
                            <td class="prop-label">Transmitter Elev.</td>
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

            if (key === 'diameter' || key === 'liquidLevel') {
                node.props.volume = typeof calculateTankLiquidVolume === 'function'
                    ? calculateTankLiquidVolume(node.props.diameter || 0, node.props.liquidLevel || 0)
                    : node.props.volume;
                const volumeCell = tr.querySelector('[data-key="volume"]');
                if (volumeCell) volumeCell.textContent = `${formatReadoutValue(node.props.volume)} m3`;
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
                    <span>Suggested PSV</span>
                    <strong class="prop-value" data-key="tank-suggested-psv">${formatReadoutValue(results.suggestedPsv)} bar g</strong>
                </div>
                <div class="boundary-result-card">
                    <span>PSV Basis</span>
                    <strong class="prop-value" data-key="tank-psv-basis">${escapeHtml(results.psvBasis || '-')}</strong>
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

        const suggestedMode = typeof TANK_PSV_MODE_SUGGESTED !== 'undefined' ? TANK_PSV_MODE_SUGGESTED : 'Suggested';
        const manualMode = typeof TANK_PSV_MODE_MANUAL !== 'undefined' ? TANK_PSV_MODE_MANUAL : 'Manual';
        const psvReadonly = node.props.psvMode === suggestedMode;
        const pressureOptions = typeof PRESSURE_INPUT_BASIS_OPTIONS !== 'undefined'
            ? PRESSURE_INPUT_BASIS_OPTIONS
            : ['Gauge', 'Absolute'];
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
        addRow('Base Elevation', node.props.elevation, 'elevation', false, 'm', 'number');

        appendSectionHeader(tbody, 'Pressure & PSV');
        addRow('Pressure Basis', pressureBasis, 'pressureInputBasis', false, '', 'select', pressureOptions);
        addRow('Operating Pressure', node.props.pressure, 'pressure', false, pressureUnit, 'number');
        addRow('Calculated Abs. Pressure', operatingAbsPressure, 'tank-operating-abs-pressure', true, 'bar a');
        addRow('Design Pressure / MAWP', node.props.designPressure, 'designPressure', false, 'bar g', 'number');
        addRow('PSV Mode', node.props.psvMode, 'psvMode', false, '', 'select', [manualMode, suggestedMode]);
        addRow('PSV Set Pressure', node.props.psvSet, 'psvSet', psvReadonly, 'bar g', 'number');
        addRow('Fluid Vapor Pressure', node.results?.vaporPressure ?? node.props.vaporPressure, 'tank-fluid-vapor-pressure', true, 'bar a');

        appendSectionHeader(tbody, 'Pass-through Hydraulic Readout');
        renderTankReadoutCards(node, tbody);
        renderTankAdvancedInventoryData(nodeId, node, tbody);
        return;
    }

    if (type === 'source') {
        if (typeof normalizeSourceProps === 'function') {
            normalizeSourceProps(node);
        }

        const fluidBasisMode = typeof SOURCE_TEMP_MODE_FLUID_BASIS !== 'undefined' ? SOURCE_TEMP_MODE_FLUID_BASIS : 'Use Fluid Basis';
        const customMode = typeof SOURCE_TEMP_MODE_CUSTOM !== 'undefined' ? SOURCE_TEMP_MODE_CUSTOM : 'Custom';
        const linkedToFluidBasis = !node.props || node.props.temperatureMode !== customMode;
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

        addRow('Pressure Basis', pressureBasis, 'pressureInputBasis', false, '', 'select', pressureOptions);
        addRow('Boundary Pressure', node.props.pressure, 'pressure', false, pressureUnit, 'number');
        addRow('Calculated Abs. Pressure', absolutePressure, 'source-absolute-pressure', true, 'bar a');
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

        const volumetricFlowMode = typeof SOURCE_FLOW_MODE_VOLUME !== 'undefined' ? SOURCE_FLOW_MODE_VOLUME : 'Volumetric Flow';
        const massFlowMode = typeof SOURCE_FLOW_MODE_MASS !== 'undefined' ? SOURCE_FLOW_MODE_MASS : 'Mass Flow';
        if (typeof syncSourceFlowFromInputMode === 'function') {
            syncSourceFlowFromInputMode(nodeId);
        }

        const usingMassFlow = node.props.flowInputMode === massFlowMode;
        addRow('Flow Input Mode', node.props.flowInputMode || volumetricFlowMode, 'flowInputMode', false, '', 'select', [volumetricFlowMode, massFlowMode]);
        if (usingMassFlow) {
            addRow('Mass Flow', node.props.massFlow, 'massFlow', false, 'kg/h', 'number');
            addRow('Volumetric Flow (Calculated)', node.props.flow, 'source-flow', true, 'm3/h');
        } else {
            addRow('Volumetric Flow', node.props.flow, 'flow', false, 'm3/h', 'number');
            addRow('Mass Flow (Calculated)', node.props.massFlow, 'source-mass-flow', true, 'kg/h');
        }

        renderSourceAttachmentControls(nodeId, node, addRow, tbody);
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
