function isSidebarEditActive() {
    const active = document.activeElement;
    return !!(active && active.closest && (
        active.closest('#propTableBody') || active.closest('#pumpPropertiesBody')
    ) && active.matches('input, select, textarea'));
}

function setSidebarReadout(key, value, unit = '') {
    const elements = document.querySelectorAll(`.prop-value[data-key="${key}"], strong[data-key="${key}"]`);
    if (!elements.length) return;
    if (value === null || value === undefined || value === '') {
        elements.forEach(el => {
            el.textContent = '-';
        });
        return;
    }
    const displayValue = formatNumericReadout(value);
    elements.forEach(el => {
        el.textContent = displayValue + (unit ? ' ' + unit : '');
    });
}

function formatReadoutValue(value) {
    if (value === null || value === undefined || value === '') return '-';
    return formatNumericReadout(value);
}

function formatNumericReadout(value) {
    if (typeof value !== 'number' || Number.isInteger(value)) return value;
    const abs = Math.abs(value);
    if (abs > 0 && abs < 0.01) return value.toFixed(6);
    return value.toFixed(3);
}

function refreshFluidBasisReadouts(node) {
    const readoutUnits = {
        sg: '',
        density: 'kg/m3',
        dynViscosity: 'cP',
        viscosity: 'cSt',
        vaporPressure: 'bar a',
        specificHeat: 'kJ/kg.K',
        thermalConductivity: 'W/m.K',
        bulkModulus: 'GPa',
        specVolume: 'm3/kg',
        specWeight: 'N/m3',
        speedOfSound: 'm/s'
    };
    Object.entries(readoutUnits).forEach(([key, unit]) => {
        setSidebarReadout(key, node.props[key], unit);
    });
    if (typeof updateFluidCalculationTraceReadout === 'function') {
        updateFluidCalculationTraceReadout(node);
    }
}

function formatEngineeringValue(value, digits = 2) {
    const number = parseFloat(value);
    if (!Number.isFinite(number)) return '-';
    return number.toFixed(digits);
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function captureSidebarEdit(target) {
    if (typeof captureState !== 'function' || !target) return;
    if (target.dataset.historyCaptured === 'true') return;
    captureState();
    target.dataset.historyCaptured = 'true';
}

function releaseSidebarEditCapture(target) {
    if (target?.dataset) delete target.dataset.historyCaptured;
}

function clearSelection() {
    document.querySelectorAll('.pfd-object').forEach(el => el.classList.remove('selected'));
    currentSelectedNode = null;
    document.getElementById('propTableHeader').textContent = 'Select an Object';
    document.getElementById('propTableBody').innerHTML = `
        <tr>
            <td colspan="2" style="text-align: center; color: #666; padding: 20px;">
                Click on an equipment or stream on the canvas to view its properties here.
            </td>
        </tr>
    `;
    document.getElementById('editorHint').style.display = 'none';
    renderPumpPropertiesSidebar(null);
}

function addPumpPropertiesRow(tbody, label, value, key, options = {}) {
    const {
        readonly = true,
        unit = '',
        inputType = 'number',
        choices = []
    } = options;
    const tr = document.createElement('tr');
    const tdLabel = document.createElement('td');
    tdLabel.className = 'prop-label';
    tdLabel.textContent = label;

    const tdValue = document.createElement('td');
    tdValue.className = 'prop-value';

    if (readonly) {
        if (key) tdValue.dataset.key = key;
        const displayValue = formatReadoutValue(value);
        tdValue.textContent = displayValue + (unit && displayValue !== '-' ? ' ' + unit : '');
    } else {
        let input;
        if (inputType === 'select') {
            input = document.createElement('select');
            choices.forEach(choice => {
                const option = document.createElement('option');
                option.value = choice;
                option.textContent = choice;
                if (choice === value) option.selected = true;
                input.appendChild(option);
            });
        } else {
            input = document.createElement('input');
            input.type = inputType;
            input.value = value;
        }

        input.className = 'prop-input-field pump-limit-input';
        input.dataset.key = key;
        tdValue.appendChild(input);
        if (unit) tdValue.appendChild(document.createTextNode(' ' + unit));
    }

    tr.appendChild(tdLabel);
    tr.appendChild(tdValue);
    tbody.appendChild(tr);
    return tr;
}

function addPumpPropertiesSection(tbody, title) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="2" class="prop-section-header">${escapeHtml(title)}</td>`;
    tbody.appendChild(tr);
}

function getPumpWarningsText(pump) {
    return (pump?.results?.warnings || []).join(' | ') || 'OK';
}

function getPumpEvaluationStatusClass(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized.includes('risk')) return 'risk';
    if (normalized.includes('warning')) return 'warning';
    if (normalized.includes('safe')) return 'safe';
    if (normalized.includes('incomplete') || normalized.includes('unknown') || normalized === '-') return 'incomplete';
    return 'neutral';
}

function addPumpEvaluationSummary(tbody, pump) {
    const results = pump.results || {};
    const status = results.cavitationStatus || results.status || '-';
    const statusClass = getPumpEvaluationStatusClass(status);
    const cards = [
        { label: 'Cavitation Status', value: status, key: 'result-cavitation-status', className: `pump-eval-status pump-eval-status-${statusClass}` },
        { label: 'NPSHa', value: results.npsha, key: 'result-npsha', unit: 'm' },
        { label: 'NPSHr', value: results.npshr, key: 'result-npshr', unit: 'm' },
        { label: 'Margin', value: results.npshMargin, key: 'result-npsh-margin', unit: 'm' },
        { label: 'Ratio', value: results.npshRatio, key: 'result-npsh-ratio' },
        { label: 'NPSHr Source', value: results.npshrSource || '-', key: 'result-npshr-source' },
        { label: 'Dominant Loss', value: results.dominantSuctionLoss || '-', key: 'result-dominant-loss', wide: true }
    ];

    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 2;
    td.className = 'pump-eval-summary-cell';
    const grid = document.createElement('div');
    grid.className = 'pump-eval-summary';

    cards.forEach(card => {
        const item = document.createElement('div');
        item.className = `pump-eval-card${card.wide ? ' pump-eval-card-wide' : ''}`;
        const label = document.createElement('span');
        label.textContent = card.label;
        const value = document.createElement('strong');
        value.className = `prop-value ${card.className || ''}`.trim();
        if (card.key) value.dataset.key = card.key;
        const displayValue = formatReadoutValue(card.value);
        value.textContent = displayValue + (card.unit && displayValue !== '-' ? ' ' + card.unit : '');
        item.appendChild(label);
        item.appendChild(value);
        grid.appendChild(item);
    });

    td.appendChild(grid);
    tr.appendChild(td);
    tbody.appendChild(tr);
}

function addPumpEngineeringNotes(tbody, pump) {
    const notes = (pump.results?.engineeringNotes || []).filter(Boolean);
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 2;
    td.className = 'pump-notes-cell';

    const wrapper = document.createElement('div');
    wrapper.className = 'pump-notes';
    wrapper.dataset.key = 'result-engineering-notes';

    if (notes.length === 0) {
        const empty = document.createElement('span');
        empty.className = 'pump-notes-empty';
        empty.textContent = '-';
        wrapper.appendChild(empty);
    } else {
        const list = document.createElement('ul');
        notes.forEach(note => {
            const item = document.createElement('li');
            item.textContent = note;
            list.appendChild(item);
        });
        wrapper.appendChild(list);
    }

    td.appendChild(wrapper);
    tr.appendChild(td);
    tbody.appendChild(tr);
}

function formatPumpLossValue(value) {
    const number = parseFloat(value);
    return Number.isFinite(number) ? number.toFixed(3) : '-';
}

function getPumpSuctionLossBreakdownEntries(pump) {
    const breakdown = pump?.results?.npshEvaluation?.suctionLossBreakdown || [];
    return breakdown.filter(item => item && Number.isFinite(parseFloat(item.headLoss)));
}

function renderPumpSuctionLossBreakdownContent(wrapper, pump) {
    const entries = getPumpSuctionLossBreakdownEntries(pump);
    wrapper.replaceChildren();

    if (entries.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'pump-loss-empty';
        empty.textContent = 'No suction loss breakdown available.';
        wrapper.appendChild(empty);
        return;
    }

    const table = document.createElement('table');
    table.className = 'pump-loss-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Component</th>
                <th>Type</th>
                <th>Major</th>
                <th>Minor</th>
                <th>Total</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    const body = table.querySelector('tbody');
    entries.forEach(entry => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHtml(entry.label || entry.id || '-')}</td>
            <td>${escapeHtml(entry.type || '-')}</td>
            <td>${formatPumpLossValue(entry.majorLoss)}</td>
            <td>${formatPumpLossValue(entry.minorLoss)}</td>
            <td>${formatPumpLossValue(entry.headLoss)}</td>
        `;
        body.appendChild(row);
    });
    wrapper.appendChild(table);
}

function updatePumpSuctionLossBreakdownReadout(pump) {
    document.querySelectorAll('.pump-loss-breakdown[data-key="result-suction-loss-breakdown"]').forEach(wrapper => {
        renderPumpSuctionLossBreakdownContent(wrapper, pump);
    });
}

function addPumpSuctionLossBreakdown(tbody, pump) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 2;
    td.className = 'pump-loss-breakdown-cell';

    const wrapper = document.createElement('div');
    wrapper.className = 'pump-loss-breakdown';
    wrapper.dataset.key = 'result-suction-loss-breakdown';
    renderPumpSuctionLossBreakdownContent(wrapper, pump);

    td.appendChild(wrapper);
    tr.appendChild(td);
    tbody.appendChild(tr);
}

function formatPumpTraceValue(value, unit = '') {
    const displayValue = formatReadoutValue(value);
    return displayValue + (unit && displayValue !== '-' ? ` ${unit}` : '');
}

function addPumpTraceMetric(grid, labelText, value, unit = '') {
    const item = document.createElement('div');
    item.className = 'pump-trace-metric';

    const label = document.createElement('span');
    label.textContent = labelText;

    const output = document.createElement('strong');
    output.textContent = formatPumpTraceValue(value, unit);

    item.append(label, output);
    grid.appendChild(item);
}

function addPumpTraceTextMetric(grid, labelText, value) {
    const item = document.createElement('div');
    item.className = 'pump-trace-metric pump-trace-metric-wide';

    const label = document.createElement('span');
    label.textContent = labelText;

    const output = document.createElement('strong');
    output.textContent = value || '-';

    item.append(label, output);
    grid.appendChild(item);
}

function addPumpTraceBlock(parent, title) {
    const block = document.createElement('section');
    block.className = 'pump-trace-block';

    const heading = document.createElement('h4');
    heading.textContent = title;
    block.appendChild(heading);

    parent.appendChild(block);
    return block;
}

function addPumpTraceList(parent, items, className = 'pump-trace-list') {
    const list = document.createElement('ul');
    list.className = className;
    (items || []).filter(Boolean).forEach(text => {
        const item = document.createElement('li');
        item.textContent = text;
        list.appendChild(item);
    });
    parent.appendChild(list);
}

function renderPumpTraceBasisBlock(wrapper, trace) {
    const block = addPumpTraceBlock(wrapper, 'Basis Data');
    const grid = document.createElement('div');
    grid.className = 'pump-trace-grid';

    addPumpTraceTextMetric(grid, 'Fluid', trace.basis?.fluidName);
    addPumpTraceMetric(grid, 'Temperature', trace.basis?.temperature, 'deg C');
    addPumpTraceMetric(grid, 'Density', trace.basis?.density, 'kg/m3');
    addPumpTraceMetric(grid, 'Viscosity', trace.basis?.viscosity, 'cSt');
    addPumpTraceMetric(grid, 'Vapor Pressure', trace.basis?.vaporPressureBarA, 'bar a');
    addPumpTraceMetric(grid, 'Gravity', trace.basis?.gravity, 'm/s2');

    block.appendChild(grid);
}

function renderPumpTraceBoundaryBlock(wrapper, trace) {
    const block = addPumpTraceBlock(wrapper, 'Boundary & Path');
    const grid = document.createElement('div');
    grid.className = 'pump-trace-grid';

    addPumpTraceTextMetric(grid, 'Source Boundary', trace.boundary?.id || trace.boundary?.name);
    addPumpTraceTextMetric(grid, 'Pressure Basis', trace.boundary?.pressureInputBasis);
    addPumpTraceMetric(grid, 'Pressure Input', trace.boundary?.pressureInput, trace.boundary?.pressureInputUnit || '');
    addPumpTraceMetric(grid, 'Absolute Pressure', trace.boundary?.absolutePressureBar, 'bar a');
    addPumpTraceMetric(grid, 'Boundary Elevation', trace.boundary?.elevation, 'm');
    addPumpTraceMetric(grid, 'Pump Elevation', trace.pump?.elevation, 'm');
    addPumpTraceMetric(grid, 'Operating Flow', trace.pump?.flow, 'm3/h');
    addPumpTraceTextMetric(grid, 'Suction Path', trace.path?.text);
    addPumpTraceTextMetric(grid, 'Dominant Loss', trace.path?.dominantLoss);

    block.appendChild(grid);
}

function renderPumpTraceLossBlock(wrapper, trace) {
    const block = addPumpTraceBlock(wrapper, 'Suction Loss Summary');
    const grid = document.createElement('div');
    grid.className = 'pump-trace-grid';

    addPumpTraceMetric(grid, 'Pipe Major Loss', trace.losses?.major, 'm');
    addPumpTraceMetric(grid, 'Fitting/Valve Minor Loss', trace.losses?.minor, 'm');
    addPumpTraceMetric(grid, 'Total Suction Loss', trace.losses?.total, 'm');
    addPumpTraceTextMetric(grid, 'Loss Method', 'Darcy-Weisbach + minor loss K');

    block.appendChild(grid);
}

function renderPumpTraceEquationSteps(wrapper, trace) {
    const block = addPumpTraceBlock(wrapper, 'Equation Steps');
    const steps = document.createElement('div');
    steps.className = 'pump-trace-steps';

    (trace.steps || []).forEach((step, index) => {
        const item = document.createElement('article');
        item.className = 'pump-trace-step';

        const title = document.createElement('div');
        title.className = 'pump-trace-step-title';
        title.textContent = `${index + 1}. ${step.title || 'Calculation step'}`;

        const reference = document.createElement('div');
        reference.className = 'pump-trace-reference';
        reference.textContent = step.reference || '-';

        const formula = document.createElement('code');
        formula.className = 'pump-trace-formula';
        formula.textContent = step.formula || '-';

        const substitution = document.createElement('div');
        substitution.className = 'pump-trace-substitution';
        substitution.textContent = step.substitution || '-';

        const result = document.createElement('strong');
        result.className = 'pump-trace-result';
        result.textContent = formatPumpTraceValue(step.result, step.unit || '');

        item.append(title, reference, formula, substitution, result);
        steps.appendChild(item);
    });

    block.appendChild(steps);
}

function renderPumpTraceInterpretationBlock(wrapper, trace) {
    const block = addPumpTraceBlock(wrapper, 'Interpretation');
    const grid = document.createElement('div');
    grid.className = 'pump-trace-grid';

    addPumpTraceTextMetric(grid, 'Status', trace.interpretation?.status);
    addPumpTraceMetric(grid, 'Margin', trace.interpretation?.margin, 'm');
    addPumpTraceMetric(grid, 'Ratio', trace.interpretation?.ratio, '');
    addPumpTraceTextMetric(grid, 'Message', trace.interpretation?.message);

    block.appendChild(grid);

    if (trace.references?.length) {
        const referenceTitle = document.createElement('div');
        referenceTitle.className = 'pump-trace-small-title';
        referenceTitle.textContent = 'Formula References';
        block.appendChild(referenceTitle);
        addPumpTraceList(block, trace.references);
    }

    if (trace.limitations?.length) {
        const limitationTitle = document.createElement('div');
        limitationTitle.className = 'pump-trace-small-title';
        limitationTitle.textContent = 'Academic Notes';
        block.appendChild(limitationTitle);
        addPumpTraceList(block, trace.limitations);
    }
}

function renderPumpCalculationTraceContent(wrapper, pump) {
    const trace = pump?.results?.npshEvaluation?.calculationTrace || null;
    wrapper.replaceChildren();

    if (!trace) {
        const empty = document.createElement('div');
        empty.className = 'pump-trace-empty';
        empty.textContent = 'Calculation trace is available after the pump has a complete upstream SRC, downstream boundary, and solved NPSH evaluation.';
        wrapper.appendChild(empty);

        const warnings = (pump?.results?.warnings || []).filter(Boolean);
        if (warnings.length) {
            addPumpTraceList(wrapper, warnings, 'pump-trace-list pump-trace-warning-list');
        }
        return;
    }

    renderPumpTraceBasisBlock(wrapper, trace);
    renderPumpTraceBoundaryBlock(wrapper, trace);
    renderPumpTraceLossBlock(wrapper, trace);
    renderPumpTraceEquationSteps(wrapper, trace);
    renderPumpTraceInterpretationBlock(wrapper, trace);
}

function updatePumpCalculationTraceReadout(pump) {
    document.querySelectorAll('.pump-calculation-trace[data-key="result-calculation-trace"]').forEach(wrapper => {
        renderPumpCalculationTraceContent(wrapper, pump);
    });
}

function addPumpCalculationTrace(tbody, pump) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 2;
    td.className = 'pump-calculation-trace-cell';

    const wrapper = document.createElement('div');
    wrapper.className = 'pump-calculation-trace';
    wrapper.dataset.key = 'result-calculation-trace';
    renderPumpCalculationTraceContent(wrapper, pump);

    td.appendChild(wrapper);
    tr.appendChild(td);
    tbody.appendChild(tr);
}

function formatFluidTraceUiValue(value, unit = '') {
    const displayValue = formatReadoutValue(value);
    return displayValue + (unit && displayValue !== '-' ? ` ${unit}` : '');
}

function addFluidTraceBlock(parent, title) {
    const block = document.createElement('section');
    block.className = 'fluid-trace-block';

    const heading = document.createElement('h4');
    heading.textContent = title;
    block.appendChild(heading);

    parent.appendChild(block);
    return block;
}

function addFluidTraceMetric(grid, labelText, value, unit = '') {
    const item = document.createElement('div');
    item.className = 'fluid-trace-metric';

    const label = document.createElement('span');
    label.textContent = labelText;

    const output = document.createElement('strong');
    output.textContent = formatFluidTraceUiValue(value, unit);

    item.append(label, output);
    grid.appendChild(item);
}

function addFluidTraceTextMetric(grid, labelText, value) {
    const item = document.createElement('div');
    item.className = 'fluid-trace-metric fluid-trace-metric-wide';

    const label = document.createElement('span');
    label.textContent = labelText;

    const output = document.createElement('strong');
    output.textContent = value || '-';

    item.append(label, output);
    grid.appendChild(item);
}

function addFluidTraceList(parent, items, className = 'fluid-trace-list') {
    const list = document.createElement('ul');
    list.className = className;
    (items || []).filter(Boolean).forEach(text => {
        const item = document.createElement('li');
        item.textContent = text;
        list.appendChild(item);
    });
    parent.appendChild(list);
}

function renderFluidTraceInputBlock(wrapper, trace) {
    const block = addFluidTraceBlock(wrapper, 'Input Basis');
    const grid = document.createElement('div');
    grid.className = 'fluid-trace-grid';

    addFluidTraceTextMetric(grid, 'Fluid', trace.inputBasis?.fluidName);
    addFluidTraceTextMetric(grid, 'Input Mode', trace.inputBasis?.inputMode);
    addFluidTraceMetric(grid, 'Temperature', trace.inputBasis?.temperature, 'deg C');
    addFluidTraceTextMetric(grid, 'Property Method', trace.inputBasis?.propertyMethod);
    addFluidTraceTextMetric(grid, 'Trace Status', trace.status || '-');

    block.appendChild(grid);
}

function renderFluidTraceSourceMap(wrapper, trace) {
    const block = addFluidTraceBlock(wrapper, 'Property Source Map');
    const tableWrap = document.createElement('div');
    tableWrap.className = 'fluid-trace-source-map';
    const table = document.createElement('table');
    table.className = 'fluid-trace-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Property</th>
                <th>Value</th>
                <th>Source</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    const body = table.querySelector('tbody');

    (trace.propertySourceMap || []).forEach(row => {
        const tr = document.createElement('tr');
        const value = formatFluidTraceUiValue(row.value, row.unit || '');
        tr.innerHTML = `
            <td>${escapeHtml(row.property || '-')}</td>
            <td>${escapeHtml(value)}</td>
            <td>${escapeHtml(row.source || '-')}</td>
        `;
        body.appendChild(tr);
    });

    tableWrap.appendChild(table);
    block.appendChild(tableWrap);
}

function renderFluidTraceDependencyBlock(wrapper, trace) {
    const block = addFluidTraceBlock(wrapper, 'Dependency Chain');
    addFluidTraceList(block, trace.dependencyChain);
}

function renderFluidTraceEquationSteps(wrapper, trace) {
    const block = addFluidTraceBlock(wrapper, 'Equation Steps');
    const steps = document.createElement('div');
    steps.className = 'fluid-trace-steps';

    (trace.steps || []).forEach((step, index) => {
        const item = document.createElement('article');
        item.className = 'fluid-trace-step';

        const title = document.createElement('div');
        title.className = 'fluid-trace-step-title';
        title.textContent = `${index + 1}. ${step.title || 'Calculation step'}`;

        const reference = document.createElement('div');
        reference.className = 'fluid-trace-reference';
        reference.textContent = step.reference || '-';

        const formula = document.createElement('code');
        formula.className = 'fluid-trace-formula';
        formula.textContent = step.formula || '-';

        const substitution = document.createElement('div');
        substitution.className = 'fluid-trace-substitution';
        substitution.textContent = step.substitution || '-';

        const result = document.createElement('strong');
        result.className = 'fluid-trace-result';
        result.textContent = formatFluidTraceUiValue(step.result, step.unit || '');

        item.append(title, reference, formula, substitution, result);
        steps.appendChild(item);
    });

    block.appendChild(steps);
}

function renderFluidTraceNotesBlock(wrapper, trace) {
    const block = addFluidTraceBlock(wrapper, 'NPSH Relevance & Academic Notes');

    const npshTitle = document.createElement('div');
    npshTitle.className = 'fluid-trace-small-title';
    npshTitle.textContent = 'NPSH Relevance';
    block.appendChild(npshTitle);
    addFluidTraceList(block, trace.npshRelevance);

    if (trace.warnings?.length) {
        const warningTitle = document.createElement('div');
        warningTitle.className = 'fluid-trace-small-title fluid-trace-warning-title';
        warningTitle.textContent = 'Needs Review';
        block.appendChild(warningTitle);
        addFluidTraceList(block, trace.warnings, 'fluid-trace-list fluid-trace-warning-list');
    }

    const notesTitle = document.createElement('div');
    notesTitle.className = 'fluid-trace-small-title';
    notesTitle.textContent = 'Academic Notes';
    block.appendChild(notesTitle);
    addFluidTraceList(block, [...(trace.assumptions || []), ...(trace.academicNotes || [])]);

    const refTitle = document.createElement('div');
    refTitle.className = 'fluid-trace-small-title';
    refTitle.textContent = 'Reference Labels';
    block.appendChild(refTitle);
    addFluidTraceList(block, trace.references);
}

function renderFluidCalculationTraceContent(wrapper, fluidNode) {
    wrapper.replaceChildren();

    if (typeof buildFluidCalculationTrace !== 'function') {
        const empty = document.createElement('div');
        empty.className = 'fluid-trace-empty';
        empty.textContent = 'Fluid calculation trace is not available.';
        wrapper.appendChild(empty);
        return;
    }

    const trace = buildFluidCalculationTrace(fluidNode);
    renderFluidTraceInputBlock(wrapper, trace);
    renderFluidTraceDependencyBlock(wrapper, trace);
    renderFluidTraceEquationSteps(wrapper, trace);
}

function updateFluidCalculationTraceReadout(fluidNode) {
    document.querySelectorAll('.fluid-calculation-trace[data-key="fluid-calculation-trace"]').forEach(wrapper => {
        renderFluidCalculationTraceContent(wrapper, fluidNode);
    });
}

function addFluidCalculationTrace(tbody, fluidNode) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 2;
    td.className = 'fluid-calculation-trace-cell';

    const wrapper = document.createElement('div');
    wrapper.className = 'fluid-calculation-trace';
    wrapper.dataset.key = 'fluid-calculation-trace';
    renderFluidCalculationTraceContent(wrapper, fluidNode);

    td.appendChild(wrapper);
    tr.appendChild(td);
    tbody.appendChild(tr);
}

function renderPumpPropertiesSidebar(nodeId) {
    const panel = document.getElementById('pumpPropertiesSidebar');
    const header = document.getElementById('pumpPropertiesHeader');
    const tbody = document.getElementById('pumpPropertiesBody');
    const node = nodeId ? globalModel[nodeId] : null;

    if (!panel || !header || !tbody) return;

    if (!node || node.type !== 'pump') {
        panel.hidden = true;
        header.textContent = 'Select a Pump';
        tbody.innerHTML = `
            <tr>
                <td colspan="2" style="text-align: center; color: #666; padding: 20px;">
                    Select a pump to view operating results and system residuals.
                </td>
            </tr>
        `;
        return;
    }

    if (typeof normalizePumpProps === 'function') normalizePumpProps(node.props);
    if (typeof ensureNodeResults === 'function') ensureNodeResults(node);

    panel.hidden = false;
    header.textContent = node.name || nodeId;
    tbody.innerHTML = '';

    addPumpPropertiesSection(tbody, 'Operating Results');
    addPumpPropertiesRow(tbody, 'Status', node.results.status, 'result-status');
    addPumpPropertiesRow(tbody, 'Flow Rate (Q)', node.results.flow, 'result-flow', { unit: 'm3/h' });
    addPumpPropertiesRow(tbody, 'Total Head', node.results.head, 'result-head', { unit: 'm' });
    addPumpPropertiesRow(tbody, 'Efficiency', node.results.efficiency, 'result-efficiency', { unit: '%' });
    addPumpPropertiesRow(tbody, 'Shaft Power', node.results.power, 'result-power', { unit: 'kW' });
    addPumpPropertiesRow(tbody, 'Suction Pressure', node.results.suctionPressure, 'result-suction-pressure', { unit: 'bar a' });
    addPumpPropertiesRow(tbody, 'Discharge Pressure', node.results.dischargePressure, 'result-discharge-pressure', { unit: 'bar a' });
    addPumpEvaluationSummary(tbody, node);
    addPumpPropertiesRow(tbody, 'Suction Loss', node.results.suctionLoss, 'result-suction-loss', { unit: 'm' });
    addPumpPropertiesRow(tbody, 'Suction Velocity Head', node.results.suctionVelocityHead, 'result-suction-velocity-head', { unit: 'm' });
    addPumpPropertiesRow(tbody, 'Vapor Pressure Head', node.results.vaporPressureHead, 'result-vapor-pressure-head', { unit: 'm' });
    addPumpPropertiesSection(tbody, 'Engineering Notes');
    addPumpEngineeringNotes(tbody, node);
    addPumpPropertiesSection(tbody, 'Suction Loss Breakdown');
    addPumpSuctionLossBreakdown(tbody, node);
    addPumpPropertiesRow(tbody, 'BEP Flow Ratio', node.results.bepPercent, 'result-bep-percent', { unit: '% BEP' });
    addPumpPropertiesRow(tbody, 'Operating Region', node.results.operatingRegion, 'result-operating-region');
    addPumpPropertiesRow(tbody, 'Warnings', getPumpWarningsText(node), 'result-warnings');

    addPumpPropertiesSection(tbody, 'System Residual');
    addPumpPropertiesRow(tbody, 'Solve Mode', node.results.solveMode || '-', 'result-solve-mode');
    addPumpPropertiesRow(tbody, 'Flow Basis', node.results.flowBasis || '-', 'result-flow-basis');
    addPumpPropertiesRow(tbody, 'Fixed Flow', node.results.fixedFlow, 'result-fixed-flow', { unit: 'm3/h' });
    addPumpPropertiesRow(tbody, 'Required System Head', node.results.requiredSystemHead, 'result-required-system-head', { unit: 'm' });
    addPumpPropertiesRow(tbody, 'Pump Head @ Flow', node.results.pumpHeadAtFlow, 'result-pump-head-at-flow', { unit: 'm' });
    addPumpPropertiesRow(tbody, 'Head Residual', node.results.headResidual, 'result-head-residual', { unit: 'm' });
    addPumpPropertiesRow(tbody, 'Pressure Residual', node.results.pressureResidual, 'result-pressure-residual', { unit: 'bar' });
    addPumpPropertiesRow(tbody, 'Downstream Boundary', node.results.downstreamBoundary || '-', 'result-downstream-boundary');
    addPumpPropertiesRow(tbody, 'Curve Source', node.results.curveSource || '-', 'result-curve-source');
    addPumpPropertiesRow(tbody, 'Model Basis', node.results.modelBasis || '-', 'result-model-basis');
    addPumpPropertiesRow(tbody, 'Model Limits', (node.results.modelWarnings || []).join(' | ') || 'None', 'result-model-warnings');

    addPumpPropertiesSection(tbody, 'Calculation Trace');
    addPumpCalculationTrace(tbody, node);
}

function renderSidebar(nodeId) {
    const node = globalModel[nodeId];
    if (!node) {
        clearSelection();
        return;
    }

    renderPumpPropertiesSidebar(nodeId);
    document.getElementById('propTableHeader').textContent = node.name || nodeId;
    
    const tbody = document.getElementById('propTableBody');
    tbody.innerHTML = ''; // clear
    
    // Helper to add rows
    const addRow = (label, value, key, isReadOnly = false, unit = '', inputType = null, options = []) => {
        const tr = document.createElement('tr');
        
        const tdLabel = document.createElement('td');
        tdLabel.className = 'prop-label';
        tdLabel.textContent = label;
        
        const tdVal = document.createElement('td');
        tdVal.className = 'prop-value';
        
        if (isReadOnly) {
            if (key) tdVal.dataset.key = key;
            const displayValue = formatReadoutValue(value);
            tdVal.textContent = displayValue + (unit && displayValue !== '-' ? ' ' + unit : '');
        } else {
            let inp;
            if (inputType === 'select') {
                inp = document.createElement('select');
                inp.className = 'prop-input-field';
                inp.style.padding = '2px';
                options.forEach(opt => {
                    const optEl = document.createElement('option');
                    optEl.value = opt;
                    optEl.textContent = opt;
                    if (opt === value) optEl.selected = true;
                    inp.appendChild(optEl);
                });
            } else {
                inp = document.createElement('input');
                inp.type = typeof value === 'number' ? 'number' : 'text';
                inp.className = 'prop-input-field';
                inp.value = value;
            }
            inp.dataset.key = key;
            inp.dataset.node = nodeId;
            inp.addEventListener('blur', () => releaseSidebarEditCapture(inp));
            
            // On input change, update model and resimulate
            inp.addEventListener(inputType === 'select' ? 'change' : 'input', (e) => {
                const k = e.target.dataset.key;
                const n = e.target.dataset.node;
                const v = e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
                captureSidebarEdit(e.target);
                const previousValue = globalModel[n].props[k];
                globalModel[n].props[k] = v;

                if (isVisualResizableType(globalModel[n].type) && k === 'visualScale') {
                    applyObjectVisuals(n);
                    drawConnections();
                    return;
                }
                 
                // Auto-calculate for Advanced Fluid Properties
                if (n === 'FLUID' && globalModel[n].props.inputMode === 'Advanced') {
                    if (k === 'sg') {
                        const densityRef = typeof FLUID_TRACE_WATER_REF_DENSITY === 'number' ? FLUID_TRACE_WATER_REF_DENSITY : 999.972;
                        globalModel[n].props.density = v * densityRef;
                        if (globalModel[n].props.dynViscosity && globalModel[n].props.density > 0) {
                            globalModel[n].props.viscosity = globalModel[n].props.dynViscosity / (globalModel[n].props.density / 1000);
                        }
                        recalcExtendedFluidProps(globalModel[n]);
                        setSidebarReadout('density', globalModel[n].props.density, 'kg/m3');
                        setSidebarReadout('viscosity', globalModel[n].props.viscosity, 'cSt');
                        setSidebarReadout('specVolume', globalModel[n].props.specVolume, 'm3/kg');
                        setSidebarReadout('specWeight', globalModel[n].props.specWeight, 'N/m3');
                        setSidebarReadout('speedOfSound', globalModel[n].props.speedOfSound, 'm/s');
                    } else if (k === 'dynViscosity') {
                        if (globalModel[n].props.density > 0) {
                            globalModel[n].props.viscosity = v / (globalModel[n].props.density / 1000);
                        }
                        setSidebarReadout('viscosity', globalModel[n].props.viscosity, 'cSt');
                    } else if (k === 'density' || k === 'bulkModulus') {
                        // Re-trigger extended calc if primary inputs change
                        recalcExtendedFluidProps(globalModel[n]);
                        setSidebarReadout('specVolume', globalModel[n].props.specVolume, 'm3/kg');
                        setSidebarReadout('specWeight', globalModel[n].props.specWeight, 'N/m3');
                        setSidebarReadout('speedOfSound', globalModel[n].props.speedOfSound, 'm/s');
                    }
                }

                if (n === 'FLUID' && globalModel[n].props.fluidName === 'Crude Oil' && typeof updateCrudeOilProperties === 'function') {
                    const crudeKeys = ['crudeApiGravity', 'crudeViscosity40C', 'crudeViscosity100C', 'crudeRvp'];
                    if (crudeKeys.includes(k)) {
                        updateCrudeOilProperties();
                        refreshFluidBasisReadouts(globalModel[n]);
                        updateSimulation({ renderSidebarAfter: false });
                        return;
                    }
                }

                if (n === 'FLUID' && typeof updateFluidCalculationTraceReadout === 'function') {
                    updateFluidCalculationTraceReadout(globalModel[n]);
                }
                
                // Auto-calculate geometry for Tank
                if (globalModel[n].type === 'tank') {
                    if (k === 'liquidLevel' || k === 'diameter') {
                        const L = globalModel[n].props.liquidLevel || 0;
                        const D = globalModel[n].props.diameter || 0;
                        globalModel[n].props.volume = calculateTankLiquidVolume(D, L);
                        const rVol = document.querySelector(`td.prop-value[data-key="volume"]`);
                        if (rVol) rVol.textContent = globalModel[n].props.volume.toFixed(3) + ' m3';
                    }

                    if (['pressure', 'pressureInputBasis', 'designPressure', 'psvMode', 'psvSet'].includes(k)) {
                        if (typeof normalizeTankProps === 'function') normalizeTankProps(globalModel[n]);
                        if (typeof updateTankPressureReadout === 'function') updateTankPressureReadout(n);

                        if (k === 'psvMode' || k === 'pressureInputBasis') {
                            renderSidebar(n);
                            updateSimulation({ renderSidebarAfter: false });
                            return;
                        }

                        updateSimulation({ renderSidebarAfter: false });
                        return;
                    }
                }
                
                // Auto-calculate for Pipe Material
                if (globalModel[n].type === 'pipe' && k === 'material') {
                    let r = 0.045; // default Commercial Steel
                    if (v === 'PVC / Plastic') r = 0.0015;
                    else if (v === 'Stainless Steel') r = 0.015;
                    else if (v === 'Galvanized Iron') r = 0.15;
                    else if (v === 'Cast Iron') r = 0.26;
                    else if (v === 'Concrete') r = 1.5;
                    
                    globalModel[n].props.roughness = r;
                    renderSidebar(n); // re-render to show updated roughness
                    return; // renderSidebar calls updateSimulation
                }

                if (globalModel[n].type === 'pipe' && k === 'routeStyle') {
                    if (typeof normalizePipeProps === 'function') normalizePipeProps(globalModel[n].props);
                    drawConnections();
                    renderSidebar(n);
                    updateSimulation({ renderSidebarAfter: false });
                    return;
                }

                if (globalModel[n].type === 'valve' && k === 'valveType' && typeof getValveDefaultK === 'function') {
                    const previousDefaultK = getValveDefaultK(previousValue);
                    const currentK = parseFloat(globalModel[n].props.kValue);
                    if (!Number.isFinite(currentK) || Math.abs(currentK - previousDefaultK) < 1e-9) {
                        globalModel[n].props.kValue = getValveDefaultK(v);
                    }
                    renderSidebar(n);
                    updateSimulation({ renderSidebarAfter: false });
                    return;
                }

                if (globalModel[n].type === 'source' && k === 'temperatureMode') {
                    if (typeof syncSourceTemperatureFromFluidBasis === 'function') {
                        syncSourceTemperatureFromFluidBasis(n);
                    }
                    renderSidebar(n);
                    updateSimulation();
                    return;
                }

                if (globalModel[n].type === 'source' && (k === 'pressure' || k === 'pressureInputBasis')) {
                    if (typeof normalizeSourceProps === 'function') normalizeSourceProps(globalModel[n]);
                    if (k === 'pressureInputBasis') {
                        renderSidebar(n);
                    } else if (typeof getNodeAbsolutePressureBar === 'function') {
                        setSidebarReadout('source-absolute-pressure', getNodeAbsolutePressureBar(globalModel[n]), 'bar a');
                    }
                    updateSimulation({ renderSidebarAfter: false });
                    return;
                }

                if (globalModel[n].type === 'source' && k === 'flowInputMode') {
                    if (v === SOURCE_FLOW_MODE_MASS) {
                        globalModel[n].props.massFlow = calculateSourceMassFlowFromVolumetric(globalModel[n].props.flow);
                    } else {
                        globalModel[n].props.flow = calculateSourceVolumetricFlowFromMass(globalModel[n].props.massFlow);
                    }
                    syncSourceFlowFromInputMode(n);
                    renderSidebar(n);
                    updateSimulation();
                    return;
                }

                if (globalModel[n].type === 'source' && (k === 'massFlow' || k === 'flow')) {
                    syncSourceFlowFromInputMode(n);
                    setSidebarReadout('source-flow', globalModel[n].props.flow, 'm3/h');
                    setSidebarReadout('source-mass-flow', globalModel[n].props.massFlow, 'kg/h');
                    updateSimulation({ renderSidebarAfter: false });
                    return;
                }

                if (globalModel[n].type === 'sink' && ['boundaryMode', 'pressure', 'pressureInputBasis', 'pressureBasis', 'demandFlow'].includes(k)) {
                    if (typeof normalizeSinkProps === 'function') normalizeSinkProps(globalModel[n]);
                    if (typeof updateSinkReadout === 'function') updateSinkReadout(n);
                    if (k === 'boundaryMode' || k === 'pressureInputBasis') {
                        renderSidebar(n);
                    } else if (typeof getNodeAbsolutePressureBar === 'function') {
                        setSidebarReadout('sink-absolute-pressure', getNodeAbsolutePressureBar(globalModel[n]), 'bar a');
                    }
                    updateSimulation({ renderSidebarAfter: false });
                    return;
                }

                if (globalModel[n].type === 'pump' && k === 'npshrSourceMode') {
                    if (typeof normalizePumpProps === 'function') normalizePumpProps(globalModel[n].props);
                    renderSidebar(n);
                    updateSimulation({ renderSidebarAfter: false });
                    return;
                }
                
                updateSimulation(); // Recalculate
            });
            
            tdVal.appendChild(inp);
            if (unit) {
                tdVal.appendChild(document.createTextNode(' ' + unit));
            }
        }
        
        tr.appendChild(tdLabel);
        tr.appendChild(tdVal);
        tbody.appendChild(tr);
    };

    // Render based on type
    if (node.type === 'fluid') {
        const modeTr = document.createElement('tr');
        modeTr.innerHTML = `
            <td class="prop-label">Input Mode</td>
            <td class="prop-value">
                <select class="prop-input-field" style="padding:2px;" id="fluidInputMode">
                    <option value="Basic" ${node.props.inputMode === 'Basic' ? 'selected' : ''}>Basic</option>
                    <option value="Advanced" ${node.props.inputMode === 'Advanced' ? 'selected' : ''}>Advanced</option>
                </select>
            </td>
        `;
        tbody.appendChild(modeTr);
        
        document.getElementById('fluidInputMode').addEventListener('change', (e) => {
            captureSidebarEdit(e.target);
            node.props.inputMode = e.target.value;
            renderSidebar(nodeId);
        });

        const fluidTr = document.createElement('tr');
        fluidTr.innerHTML = `
            <td class="prop-label">Fluid Name</td>
            <td class="prop-value">
                <select class="prop-input-field" style="padding:2px;" id="fluidNameSelect">
                    <option value="Custom" ${node.props.fluidName === 'Custom' ? 'selected' : ''}>Custom Fluid</option>
                    <option value="Water" ${node.props.fluidName === 'Water' ? 'selected' : ''}>Water (Auto)</option>
                    <option value="Methanol" ${node.props.fluidName === 'Methanol' ? 'selected' : ''}>Methanol (Auto)</option>
                    <option value="Palm Oil" ${node.props.fluidName === 'Palm Oil' ? 'selected' : ''}>Palm Oil (Liquid Table)</option>
                    <option value="Crude Oil" ${node.props.fluidName === 'Crude Oil' ? 'selected' : ''}>Crude Oil (Estimated)</option>
                </select>
            </td>
        `;
        tbody.appendChild(fluidTr);
        
        document.getElementById('fluidNameSelect').addEventListener('change', (e) => {
            captureSidebarEdit(e.target);
            node.props.fluidName = e.target.value;
            if (e.target.value === 'Water') {
                updateWaterProperties();
                updateSimulation();
            } else if (e.target.value === 'Methanol') {
                updateMethanolProperties();
                updateSimulation();
            } else if (e.target.value === 'Palm Oil') {
                updatePalmOilProperties();
                updateSimulation();
            } else if (e.target.value === 'Crude Oil') {
                updateCrudeOilProperties();
                updateSimulation();
            }
            renderSidebar(nodeId);
        });

        const tempRow = document.createElement('tr');
        tempRow.innerHTML = `
            <td class="prop-label">Temperature</td>
            <td class="prop-value">
                <input type="number" class="prop-input-field" value="${node.props.temp}" id="fluidTempInput" style="width: 70%;"> deg C
            </td>
        `;
        tbody.appendChild(tempRow);
        
        document.getElementById('fluidTempInput').addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) || 0;
            captureSidebarEdit(e.target);
            node.props.temp = val;
            if (node.props.fluidName === 'Water' || node.props.fluidName === 'Methanol' || node.props.fluidName === 'Palm Oil' || node.props.fluidName === 'Crude Oil') {
                if (node.props.fluidName === 'Water') updateWaterProperties();
                if (node.props.fluidName === 'Methanol') updateMethanolProperties();
                if (node.props.fluidName === 'Palm Oil') updatePalmOilProperties();
                if (node.props.fluidName === 'Crude Oil') updateCrudeOilProperties();
                
                refreshFluidBasisReadouts(node);
            }
            updateSimulation();
        });

        if (node.props.fluidName === 'Crude Oil' && typeof normalizeCrudeOilProps === 'function') {
            normalizeCrudeOilProps(node.props);

            const crudeHeader = document.createElement('tr');
            crudeHeader.innerHTML = '<td colspan="2" style="background:#eee; font-weight:bold; padding:4px 8px; text-align:center;">Crude Oil Basis</td>';
            tbody.appendChild(crudeHeader);

            addRow('API Gravity @ 60F', node.props.crudeApiGravity, 'crudeApiGravity', false, 'deg API', 'number');
            addRow('Kinematic Visc. @ 40C', node.props.crudeViscosity40C, 'crudeViscosity40C', false, 'cSt', 'number');
            addRow('Kinematic Visc. @ 100C', node.props.crudeViscosity100C, 'crudeViscosity100C', false, 'cSt', 'number');
            addRow('RVP @ 37.8C', node.props.crudeRvp, 'crudeRvp', false, 'bar a', 'number');
        }
        
        const isAuto = node.props.fluidName === 'Water' || node.props.fluidName === 'Methanol' || node.props.fluidName === 'Palm Oil' || node.props.fluidName === 'Crude Oil';
        
        if (node.props.inputMode === 'Basic') {
            addRow('Density', node.props.density, 'density', isAuto, 'kg/m3');
            addRow('Kinematic Visc.', node.props.viscosity, 'viscosity', isAuto, 'cSt');
            addRow('Vapor Pressure', node.props.vaporPressure, 'vaporPressure', isAuto, 'bar a');
        } else {
            const advHeader = document.createElement('tr');
            advHeader.innerHTML = '<td colspan="2" style="background:#eee; font-weight:bold; padding:4px 8px; text-align:center;">Advanced Properties</td>';
            tbody.appendChild(advHeader);
            
            addRow('Spec. Gravity', node.props.sg, 'sg', isAuto, '');
            addRow('Density', node.props.density, 'density', true, 'kg/m3');
            addRow('Dynamic Visc.', node.props.dynViscosity, 'dynViscosity', isAuto, 'cP');
            addRow('Kinematic Visc.', node.props.viscosity, 'viscosity', true, 'cSt');
            addRow('Vapor Pressure', node.props.vaporPressure, 'vaporPressure', isAuto, 'bar a');
            addRow('Specific Heat', node.props.specificHeat, 'specificHeat', isAuto, 'kJ/kg.K');
            if (node.props.thermalConductivity !== undefined) {
                addRow('Thermal Cond.', node.props.thermalConductivity, 'thermalConductivity', true, 'W/m.K');
            }
            addRow('Bulk Modulus', node.props.bulkModulus, 'bulkModulus', isAuto, 'GPa');
            
            const extHeader = document.createElement('tr');
            extHeader.innerHTML = '<td colspan="2" style="background:#eee; font-weight:bold; padding:4px 8px; text-align:center;">Extended Properties</td>';
            tbody.appendChild(extHeader);
            
            addRow('Spec. Volume', node.props.specVolume, 'specVolume', true, 'm3/kg');
            addRow('Spec. Weight', node.props.specWeight, 'specWeight', true, 'N/m3');
            addRow('Speed of Sound', node.props.speedOfSound, 'speedOfSound', true, 'm/s');
        }

        addPumpPropertiesSection(tbody, 'Fluid Basis Calculation Trace');
        addFluidCalculationTrace(tbody, node);
    } else if (node.type === 'pump') {
        if (typeof normalizePumpProps === 'function') {
            normalizePumpProps(node.props);
        }

        const modeTr = document.createElement('tr');
        modeTr.innerHTML = `
            <td class="prop-label">Input Mode</td>
            <td class="prop-value">
                <select class="prop-input-field" style="padding:2px;" id="pumpInputMode" data-node="${nodeId}">
                    <option value="Basic" ${node.props.inputMode === 'Basic' ? 'selected' : ''}>Basic</option>
                    <option value="Advanced" ${node.props.inputMode === 'Advanced' ? 'selected' : ''}>Advanced</option>
                </select>
            </td>
        `;
        tbody.appendChild(modeTr);
        
        document.getElementById('pumpInputMode').addEventListener('change', (e) => {
            captureSidebarEdit(e.target);
            node.props.inputMode = e.target.value;
            renderSidebar(nodeId);
            updateSimulation();
        });
        
        addRow('Evaluation Mode', 'Realtime calculation + manual report', 'npshEvaluationMode', true);
        addRow('Elevation', node.props.elevation, 'elevation', false, 'm', 'number');

        const optTr = document.createElement('tr');
        optTr.innerHTML = `
            <td colspan="2" style="padding: 8px 12px;">
                <button class="btn-add-segment" data-node="${nodeId}" id="btnEvaluateNpsh">Run NPSH Evaluation</button>
            </td>
        `;
        tbody.appendChild(optTr);
        optTr.querySelector('#btnEvaluateNpsh').addEventListener('click', () => {
            if (typeof runPumpNpshEvaluation !== 'function') return;
            updateSimulation({ renderSidebarAfter: false });
            const result = runPumpNpshEvaluation(nodeId);
            if (globalModel[nodeId]) {
                ensureNodeResults(globalModel[nodeId]);
                globalModel[nodeId].results.npshEvaluation = result;
            }
            renderSidebar(nodeId);
        });

        if (node.results?.npshEvaluation) {
            const opt = node.results.npshEvaluation;
            const notes = [
                ...(opt.notes || []),
                ...(opt.warnings || [])
            ].join(' | ') || 'OK';
            const optHeader = document.createElement('tr');
            optHeader.innerHTML = '<td colspan="2" style="background:#eee; font-weight:bold; padding:4px 8px; text-align:center;">NPSH Evaluation Report</td>';
            tbody.appendChild(optHeader);
            addRow('Evaluation Status', opt.status || '-', 'pump-eval-status', true);
            addRow('Flow Evaluated', opt.flow ?? null, 'pump-eval-flow', true, 'm3/h');
            addRow('Pump Head', opt.pumpHead ?? null, 'pump-eval-head', true, 'm');
            addRow('NPSHa', opt.npsha ?? null, 'pump-eval-npsha', true, 'm');
            addRow('NPSHr', opt.npshr ?? null, 'pump-eval-npshr', true, 'm');
            addRow('NPSHr Source', opt.npshrSource || '-', 'pump-eval-npshr-source', true);
            addRow('NPSH Margin', opt.npshMargin ?? null, 'pump-eval-margin', true, 'm');
            addRow('NPSH Ratio', opt.npshRatio ?? null, 'pump-eval-ratio', true);
            addRow('Suction Pressure', opt.suctionPressureAbs ?? null, 'pump-eval-suction-pressure', true, 'bar a');
            addRow('Suction Loss', opt.suctionLoss ?? null, 'pump-eval-suction-loss', true, 'm');
            addRow('Dominant Loss', opt.dominantLoss || '-', 'pump-eval-dominant-loss', true);
            addRow('Notes', notes, 'pump-opt-notes', true);
        }

        if (node.props.inputMode === 'Basic') {
            const manualNpshr = typeof PUMP_NPSHR_SOURCE_MANUAL !== 'undefined' ? PUMP_NPSHR_SOURCE_MANUAL : 'Manual';
            const estimatedNpshr = typeof PUMP_NPSHR_SOURCE_ESTIMATED !== 'undefined' ? PUMP_NPSHR_SOURCE_ESTIMATED : 'Estimated';
            const npshrOptions = typeof PUMP_NPSHR_SOURCE_OPTIONS !== 'undefined'
                ? PUMP_NPSHR_SOURCE_OPTIONS
                : [manualNpshr, estimatedNpshr];
            const npshrSourceMode = node.props.npshrSourceMode || estimatedNpshr;
            addRow('NPSHr Source', npshrSourceMode, 'npshrSourceMode', false, '', 'select', npshrOptions);
            addRow('Design Flow', node.props.designFlow, 'designFlow', false, 'm3/h', 'number');
            addRow('Design Head', node.props.designHead, 'designHead', false, 'm', 'number');
            addRow('Design Eff.', node.props.designEfficiency, 'designEfficiency', false, '%', 'number');
            addRow(npshrSourceMode === manualNpshr ? 'Manual NPSHr' : 'NPSHr @ BEP', node.props.designNpshr, 'designNpshr', false, 'm', 'number');
        } else {
            addRow('NPSHr Source', typeof PUMP_NPSHR_SOURCE_CURVE !== 'undefined' ? PUMP_NPSHR_SOURCE_CURVE : 'Manufacturer/Test Curve', 'npshrSourceMode', true);
            // Advanced curve table
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 2;
            td.style.padding = '0';
            
            let curveHtml = `
                <div style="padding: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <span style="font-weight: bold; color: #1c4568;">Curve Data</span>
                        <button class="btn-add-segment" data-node="${nodeId}">Add point</button>
                    </div>
                    <div style="overflow-x: auto;">
                        <table class="segment-table" id="pumpCurveTable">
                            <thead>
                                <tr>
                                    <th>Flow</th>
                                    <th>Head</th>
                                    <th>Eff %</th>
                                    <th>NPSHr</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
            `;
            
            node.props.curveData.forEach((pt, i) => {
                curveHtml += `
                    <tr>
                        <td><input type="number" class="segment-input" data-idx="${i}" data-field="flow" value="${pt.flow}"></td>
                        <td><input type="number" class="segment-input" data-idx="${i}" data-field="head" value="${pt.head}"></td>
                        <td><input type="number" class="segment-input" data-idx="${i}" data-field="eff" value="${pt.eff}"></td>
                        <td><input type="number" class="segment-input" data-idx="${i}" data-field="npshr" value="${pt.npshr}"></td>
                        <td><button class="btn-remove-segment" data-idx="${i}" data-node="${nodeId}">X</button></td>
                    </tr>
                `;
            });
            
            curveHtml += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            td.innerHTML = curveHtml;
            tr.appendChild(td);
            tbody.appendChild(tr);
            
            td.querySelectorAll('.segment-input').forEach(inp => {
                inp.addEventListener('blur', () => releaseSidebarEditCapture(inp));
                inp.addEventListener('input', (e) => {
                    const idx = parseInt(e.target.dataset.idx);
                    const field = e.target.dataset.field;
                    captureSidebarEdit(e.target);
                    node.props.curveData[idx][field] = parseFloat(e.target.value) || 0;
                    updateSimulation({ renderSidebarAfter: false });
                });
            });
            
            td.querySelector('.btn-add-segment').addEventListener('click', () => {
                captureState();
                const last = node.props.curveData[node.props.curveData.length - 1];
                node.props.curveData.push({
                    flow: last ? last.flow + 50 : 50,
                    head: last ? Math.max(0, last.head - 10) : 40,
                    eff: 75,
                    npshr: 2
                });
                renderSidebar(nodeId);
                updateSimulation();
            });
            
            td.querySelectorAll('.btn-remove-segment').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(e.target.dataset.idx);
                    captureState();
                    node.props.curveData.splice(idx, 1);
                    renderSidebar(nodeId);
                    updateSimulation();
                });
            });
        }

        const hiHeader = document.createElement('tr');
        hiHeader.innerHTML = '<td colspan="2" style="background:#eee; font-weight:bold; padding:4px 8px; text-align:center;">Pump Operating Limits</td>';
        tbody.appendChild(hiHeader);

        addRow('BEP Flow', node.props.bepFlow, 'bepFlow', false, 'm3/h', 'number');
        addRow('POR Min', node.props.porMinPercent, 'porMinPercent', false, '% BEP', 'number');
        addRow('POR Max', node.props.porMaxPercent, 'porMaxPercent', false, '% BEP', 'number');
        addRow('AOR Min', node.props.aorMinPercent, 'aorMinPercent', false, '% BEP', 'number');
        addRow('AOR Max', node.props.aorMaxPercent, 'aorMaxPercent', false, '% BEP', 'number');
        addRow('Min NPSH Ratio', node.props.minNpshMarginRatio, 'minNpshMarginRatio', false, '', 'number');
        addRow('Min NPSH Margin', node.props.minNpshMargin, 'minNpshMargin', false, 'm', 'number');
    } else if (node.type === 'pipe') {
        if (node.props.routeStyle === undefined) node.props.routeStyle = 'Straight';
        normalizePipeProps(node.props);
        addRow('Pipe Routing', node.props.routeStyle, 'routeStyle', false, '', 'select', ['Straight', 'Elbow']);

        const flowForPipe = node.results && node.results.pressureCalculated ? parseFloat(node.results.flow) || 0 : 0;
        const segmentResults = calculatePipeHydraulicSegments(flowForPipe, node.props);
        const segmentResultByIndex = new Map(segmentResults.map(result => [result.index, result]));
        const totalHeadLoss = segmentResults.reduce((sum, result) => sum + result.totalLoss, 0);
        const totalMajorLoss = segmentResults.reduce((sum, result) => sum + result.majorLoss, 0);
        const totalFittingLoss = segmentResults.reduce((sum, result) => sum + result.minorLoss, 0);
        const totalMinorK = segmentResults.reduce((sum, result) => sum + result.minorLossK, 0);

        const pipeResultsTr = document.createElement('tr');
        pipeResultsTr.innerHTML = `
            <td colspan="2" style="padding: 10px 12px;">
                <div class="pipe-result-grid">
                    <div class="pipe-result-card">
                        <span>Flow Rate</span>
                        <strong data-key="pipe-flow">${formatReadoutValue(node.results?.flow ?? 0)} m3/h</strong>
                    </div>
                    <div class="pipe-result-card">
                        <span>Pipe Pressure</span>
                        <strong data-key="pipe-pressure">${formatReadoutValue(node.results?.pressure)} bar</strong>
                    </div>
                    <div class="pipe-result-card">
                        <span>Inlet Pressure</span>
                        <strong data-key="pipe-inlet-pressure">${formatReadoutValue(node.results?.inletPressure)} bar</strong>
                    </div>
                    <div class="pipe-result-card">
                        <span>Outlet Pressure</span>
                        <strong data-key="pipe-outlet-pressure">${formatReadoutValue(node.results?.outletPressure)} bar</strong>
                    </div>
                    <div class="pipe-result-card pipe-result-card-wide">
                        <span>Total Head Loss</span>
                        <strong data-key="pipe-head-loss">${formatReadoutValue(totalHeadLoss)} m</strong>
                    </div>
                    <div class="pipe-result-card">
                        <span>Major Loss</span>
                        <strong data-key="pipe-major-loss">${formatReadoutValue(totalMajorLoss)} m</strong>
                    </div>
                    <div class="pipe-result-card">
                        <span>Fitting Loss</span>
                        <strong data-key="pipe-fitting-loss">${formatReadoutValue(totalFittingLoss)} m</strong>
                    </div>
                    <div class="pipe-result-card">
                        <span>Total K</span>
                        <strong data-key="pipe-total-k">${formatReadoutValue(totalMinorK)}</strong>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(pipeResultsTr);

        const disconnectTr = document.createElement('tr');
        disconnectTr.innerHTML = `
            <td colspan="2" style="padding: 8px 12px;">
                <button class="btn-disconnect-pipe" data-pipe-id="${nodeId}">Disconnect pipe</button>
            </td>
        `;
        tbody.appendChild(disconnectTr);
        disconnectTr.querySelector('.btn-disconnect-pipe').addEventListener('click', () => {
            disconnectPipe(nodeId);
        });
        
        // Segments table
        const segTr = document.createElement('tr');
        const segTd = document.createElement('td');
        segTd.colSpan = 2;
        segTd.style.padding = '0';
        const pipeSizeOptionsHtml = (PIPE_SIZE_OPTIONS || []).map(option => `<option value="${escapeHtml(option.label)}">${escapeHtml(option.label)}</option>`).join('');
        const materialOptionsHtml = (PIPE_MATERIAL_OPTIONS || []).map(option => `<option value="${escapeHtml(option.label)}">${escapeHtml(option.label)}</option>`).join('');
        const fittingOptionsHtml = (PIPE_FITTING_OPTIONS || []).map(option => `<option value="${escapeHtml(option.label)}">${escapeHtml(option.label)}</option>`).join('');
        let segHtml = `
            <div style="padding: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <span style="font-weight: bold; color: #1c4568;">Pipe Segments</span>
                    <button class="btn-add-segment" data-node="${nodeId}">Add Segment</button>
                </div>
                <div class="segment-table-scroll">
                    <table class="segment-table" id="pipeSegmentTable">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>NPS / Schedule</th>
                                <th>ID (m)</th>
                                <th>Len (m)</th>
                                <th>Material</th>
                                <th>eps (mm)</th>
                                <th>Fitting</th>
                                <th>Qty</th>
                                <th>K each</th>
                                <th>Add K</th>
                                <th>Total K</th>
                                <th>V (m/s)</th>
                                <th>Re</th>
                                <th>f</th>
                                <th>Major hL</th>
                                <th>Fitting hL</th>
                                <th>Total hL</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        node.props.segments.forEach((seg, i) => {
            const result = segmentResultByIndex.get(i) || {};
            const diameterReadonly = seg.pipeSize !== 'Custom diameter' ? 'readonly' : '';
            const fittingKReadonly = seg.fittingType !== PIPE_FITTING_CUSTOM ? 'readonly' : '';
            segHtml += `
                <tr>
                    <td><input type="text" class="segment-input" data-idx="${i}" data-field="name" value="${escapeHtml(seg.name)}"></td>
                    <td><select class="segment-input" data-idx="${i}" data-field="pipeSize" data-value="${escapeHtml(seg.pipeSize)}">${pipeSizeOptionsHtml}</select></td>
                    <td><input type="number" class="segment-input" data-idx="${i}" data-field="diameter" value="${formatEngineeringValue(seg.diameter, 5)}" step="0.001" ${diameterReadonly}></td>
                    <td><input type="number" class="segment-input" data-idx="${i}" data-field="length" value="${formatEngineeringValue(seg.length, 2)}" step="0.1"></td>
                    <td><select class="segment-input" data-idx="${i}" data-field="material" data-value="${escapeHtml(seg.material)}">${materialOptionsHtml}</select></td>
                    <td><input type="number" class="segment-input" data-idx="${i}" data-field="roughnessMm" value="${formatEngineeringValue((seg.roughness || 0) * 1000, 4)}" step="0.001"></td>
                    <td><select class="segment-input" data-idx="${i}" data-field="fittingType" data-value="${escapeHtml(seg.fittingType)}">${fittingOptionsHtml}</select></td>
                    <td><input type="number" class="segment-input" data-idx="${i}" data-field="fittingQuantity" value="${formatEngineeringValue(seg.fittingQuantity || 0, 0)}" step="1"></td>
                    <td><input type="number" class="segment-input" data-idx="${i}" data-field="fittingK" value="${formatEngineeringValue(seg.fittingK || 0, 3)}" step="0.01" ${fittingKReadonly}></td>
                    <td><input type="number" class="segment-input" data-idx="${i}" data-field="minorLoss" value="${formatEngineeringValue(seg.minorLoss || 0, 2)}" step="0.1"></td>
                    <td class="segment-readout" data-segment-result="minorLossK">${formatEngineeringValue(result.minorLossK, 2)}</td>
                    <td class="segment-readout" data-segment-result="velocity">${formatEngineeringValue(result.velocity, 2)}</td>
                    <td class="segment-readout" data-segment-result="reynolds">${Number.isFinite(result.reynolds) ? Math.round(result.reynolds).toLocaleString() : '-'}</td>
                    <td class="segment-readout" data-segment-result="frictionFactor">${formatEngineeringValue(result.frictionFactor, 4)}</td>
                    <td class="segment-readout" data-segment-result="majorLoss">${formatEngineeringValue(result.majorLoss, 2)}</td>
                    <td class="segment-readout" data-segment-result="fittingLoss">${formatEngineeringValue(result.minorLoss, 2)}</td>
                    <td class="segment-readout" data-segment-result="totalLoss">${formatEngineeringValue(result.totalLoss, 2)}</td>
                    <td><button class="btn-remove-segment" data-idx="${i}" data-node="${nodeId}">X</button></td>
                </tr>
            `;
        });
        
        segHtml += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        segTd.innerHTML = segHtml;
        segTr.appendChild(segTd);
        tbody.appendChild(segTr);

        segTd.querySelectorAll('select.segment-input').forEach(select => {
            select.value = select.dataset.value;
        });

        const refreshPipeSegmentReadouts = () => {
            normalizePipeProps(node.props);
            updateSimulation({ renderSidebarAfter: false });
            const updatedFlow = node.results && node.results.pressureCalculated ? parseFloat(node.results.flow) || 0 : 0;
            const updatedDetails = new Map(calculatePipeHydraulicSegments(updatedFlow, node.props).map(result => [result.index, result]));
            const updatedHeadLoss = [...updatedDetails.values()].reduce((sum, result) => sum + result.totalLoss, 0);
            const updatedMajorLoss = [...updatedDetails.values()].reduce((sum, result) => sum + result.majorLoss, 0);
            const updatedFittingLoss = [...updatedDetails.values()].reduce((sum, result) => sum + result.minorLoss, 0);
            const updatedTotalK = [...updatedDetails.values()].reduce((sum, result) => sum + result.minorLossK, 0);

            setSidebarReadout('pipe-flow', node.results?.flow ?? 0, 'm3/h');
            setSidebarReadout('pipe-pressure', node.results?.pressure, 'bar');
            setSidebarReadout('pipe-inlet-pressure', node.results?.inletPressure, 'bar');
            setSidebarReadout('pipe-outlet-pressure', node.results?.outletPressure, 'bar');
            setSidebarReadout('pipe-head-loss', updatedHeadLoss, 'm');
            setSidebarReadout('pipe-major-loss', updatedMajorLoss, 'm');
            setSidebarReadout('pipe-fitting-loss', updatedFittingLoss, 'm');
            setSidebarReadout('pipe-total-k', updatedTotalK, '');

            segTd.querySelectorAll('#pipeSegmentTable tbody tr').forEach((row, idx) => {
                const result = updatedDetails.get(idx) || {};
                const velocityCell = row.querySelector('[data-segment-result="velocity"]');
                const reynoldsCell = row.querySelector('[data-segment-result="reynolds"]');
                const frictionCell = row.querySelector('[data-segment-result="frictionFactor"]');
                const totalKCell = row.querySelector('[data-segment-result="minorLossK"]');
                const majorLossCell = row.querySelector('[data-segment-result="majorLoss"]');
                const fittingLossCell = row.querySelector('[data-segment-result="fittingLoss"]');
                const totalLossCell = row.querySelector('[data-segment-result="totalLoss"]');
                if (velocityCell) velocityCell.textContent = formatEngineeringValue(result.velocity, 2);
                if (reynoldsCell) reynoldsCell.textContent = Number.isFinite(result.reynolds) ? Math.round(result.reynolds).toLocaleString() : '-';
                if (frictionCell) frictionCell.textContent = formatEngineeringValue(result.frictionFactor, 4);
                if (totalKCell) totalKCell.textContent = formatEngineeringValue(result.minorLossK, 2);
                if (majorLossCell) majorLossCell.textContent = formatEngineeringValue(result.majorLoss, 2);
                if (fittingLossCell) fittingLossCell.textContent = formatEngineeringValue(result.minorLoss, 2);
                if (totalLossCell) totalLossCell.textContent = formatEngineeringValue(result.totalLoss, 2);
            });
        };
        
        segTd.querySelectorAll('.segment-input').forEach(inp => {
            inp.addEventListener('blur', () => releaseSidebarEditCapture(inp));
            inp.addEventListener('input', (e) => {
                if (e.target.tagName === 'SELECT') return;
                const idx = parseInt(e.target.dataset.idx);
                const field = e.target.dataset.field;
                const segment = node.props.segments[idx];
                if (!segment) return;
                captureSidebarEdit(e.target);

                if (field === 'pipeSize') {
                    segment.pipeSize = e.target.value;
                    const sizeOption = getPipeSizeOption(segment.pipeSize);
                    if (sizeOption && sizeOption.diameter) {
                        segment.diameter = sizeOption.diameter;
                        const diameterInput = e.target.closest('tr')?.querySelector('[data-field="diameter"]');
                        if (diameterInput) diameterInput.value = formatEngineeringValue(segment.diameter, 5);
                    }
                    refreshPipeSegmentReadouts();
                    return;
                }

                if (field === 'material') {
                    segment.material = e.target.value;
                    const materialOption = getPipeMaterialOption(segment.material);
                    if (materialOption && materialOption.roughness !== null) {
                        segment.roughness = materialOption.roughness;
                        const roughnessInput = e.target.closest('tr')?.querySelector('[data-field="roughnessMm"]');
                        if (roughnessInput) roughnessInput.value = formatEngineeringValue(segment.roughness * 1000, 4);
                    }
                    refreshPipeSegmentReadouts();
                    return;
                }

                if (field === 'roughnessMm') {
                    segment.roughness = Math.max(0, (parseFloat(e.target.value) || 0) / 1000);
                    if (segment.material !== 'Custom roughness') segment.material = 'Custom roughness';
                } else if (field === 'fittingK') {
                    segment.routeFittingAuto = false;
                    segment.fittingType = PIPE_FITTING_CUSTOM;
                    segment.fittingK = Math.max(0, parseFloat(e.target.value) || 0);
                    const fittingSelect = e.target.closest('tr')?.querySelector('[data-field="fittingType"]');
                    if (fittingSelect) fittingSelect.value = PIPE_FITTING_CUSTOM;
                } else if (field === 'fittingQuantity' || field === 'minorLoss') {
                    segment.routeFittingAuto = false;
                    segment[field] = Math.max(0, parseFloat(e.target.value) || 0);
                } else if (e.target.type === 'number') {
                    segment[field] = Math.max(0, parseFloat(e.target.value) || 0);
                } else {
                    segment[field] = e.target.value;
                }

                refreshPipeSegmentReadouts();
            });

            inp.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                const field = e.target.dataset.field;
                const segment = node.props.segments[idx];
                if (segment) captureSidebarEdit(e.target);
                if (segment && field === 'fittingType') {
                    segment.routeFittingAuto = false;
                    segment.fittingType = e.target.value;
                    const fittingOption = getPipeFittingOption(segment.fittingType);
                    if (fittingOption.label !== PIPE_FITTING_CUSTOM) {
                        segment.fittingType = fittingOption.label;
                        segment.fittingK = fittingOption.k || 0;
                    } else {
                        segment.fittingK = Math.max(0, parseFloat(segment.fittingK) || 0);
                    }
                    if (segment.fittingType === PIPE_FITTING_NONE) {
                        segment.fittingQuantity = 0;
                    } else if (!Number.isFinite(parseFloat(segment.fittingQuantity)) || parseFloat(segment.fittingQuantity) <= 0) {
                        segment.fittingQuantity = 1;
                    }
                    normalizePipeProps(node.props);
                    renderSidebar(nodeId);
                    updateSimulation({ renderSidebarAfter: false });
                    return;
                }
                if (segment && field === 'pipeSize') {
                    segment.pipeSize = e.target.value;
                    const sizeOption = getPipeSizeOption(segment.pipeSize);
                    if (sizeOption && sizeOption.diameter) {
                        segment.diameter = sizeOption.diameter;
                        const diameterInput = e.target.closest('tr')?.querySelector('[data-field="diameter"]');
                        if (diameterInput) diameterInput.value = formatEngineeringValue(segment.diameter, 5);
                    }
                }
                if (segment && field === 'material') {
                    segment.material = e.target.value;
                    const materialOption = getPipeMaterialOption(segment.material);
                    if (materialOption && materialOption.roughness !== null) {
                        segment.roughness = materialOption.roughness;
                        const roughnessInput = e.target.closest('tr')?.querySelector('[data-field="roughnessMm"]');
                        if (roughnessInput) roughnessInput.value = formatEngineeringValue(segment.roughness * 1000, 4);
                    }
                }
                refreshPipeSegmentReadouts();
            });
        });
        
        segTd.querySelector('.btn-add-segment').addEventListener('click', () => {
            captureState();
            node.props.segments.push({
                name: "New Seg",
                pipeSize: "Custom diameter",
                material: "Commercial steel",
                diameter: 0.1,
                length: 10,
                roughness: 0.000045,
                fittingType: PIPE_FITTING_NONE,
                fittingQuantity: 0,
                fittingK: 0,
                minorLoss: 0
            });
            renderSidebar(nodeId);
            updateSimulation();
        });
        
        segTd.querySelectorAll('.btn-remove-segment').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                captureState();
                node.props.segments.splice(idx, 1);
                renderSidebar(nodeId);
                updateSimulation();
            });
        });

    } else {
        if (typeof renderObjectProperties === 'function') {
            renderObjectProperties(node.type, nodeId, node, addRow, tbody);
        } else {
            addRow('Notes', 'No custom properties defined for this object type.', '', true);
        }
    }
}

// Modal Chart Init (lazy-loaded to keep the initial PageSpeed path light)
let pumpChartLibraryPromise = null;

function loadChartLibrary() {
    if (window.Chart) return Promise.resolve(window.Chart);
    if (pumpChartLibraryPromise) return pumpChartLibraryPromise;

    pumpChartLibraryPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'vendor/chart.umd.min.js';
        script.defer = true;
        script.onload = () => resolve(window.Chart);
        script.onerror = () => reject(new Error('Failed to load Chart.js'));
        document.head.appendChild(script);
    });

    return pumpChartLibraryPromise;
}

async function ensurePumpChartReady() {
    if (pumpChartInstance) return pumpChartInstance;
    await loadChartLibrary();
    return initializeChart();
}

function initializeChart() {
    if (pumpChartInstance) return pumpChartInstance;

    const chartCanvas = document.getElementById('pumpChart');
    if (!chartCanvas || !window.Chart) return null;

    const ctx = chartCanvas.getContext('2d');
    Chart.defaults.font.family = "'Segoe UI', sans-serif";
    
    pumpChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'Pump Head', data: [], borderColor: '#1c4568', borderWidth: 2, tension: 0.4 },
                { label: 'System Curve', data: [], borderColor: '#e63946', borderWidth: 2, borderDash: [5, 5], tension: 0.4 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: 'Flow Rate (m3/h)' }, grid: { color: '#f0f0f0'} },
                y: { title: { display: true, text: 'Head (m)' }, min: 0, grid: { color: '#f0f0f0'} }
            }
        }
    });

    return pumpChartInstance;
}

// Modal Drag
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('fullEditor');
    const header = document.getElementById('editorHeader');
    if(modal && header) {
        const closePumpEditor = () => {
            activeChartPumpId = null;
            modal.style.display = 'none';
        };

        let m1 = 0, m2 = 0, m3 = 0, m4 = 0;
        header.onpointerdown = (e) => {
            if (e.target.closest('.modal-close')) return;

            e.preventDefault();
            if (header.setPointerCapture && e.pointerId !== undefined) {
                header.setPointerCapture(e.pointerId);
            }
            m3 = e.clientX; m4 = e.clientY;
            const closeModalDrag = () => {
                document.removeEventListener('pointerup', closeModalDrag);
                document.removeEventListener('pointercancel', closeModalDrag);
                document.removeEventListener('pointermove', moveModal);
            };
            const moveModal = (e) => {
                e.preventDefault();
                m1 = m3 - e.clientX; m2 = m4 - e.clientY;
                m3 = e.clientX; m4 = e.clientY;
                modal.style.top = (modal.offsetTop - m2) + "px";
                modal.style.left = (modal.offsetLeft - m1) + "px";
            };
            document.addEventListener('pointerup', closeModalDrag);
            document.addEventListener('pointercancel', closeModalDrag);
            document.addEventListener('pointermove', moveModal);
        };

        const closeBtn = document.getElementById('closeEditor');
        if(closeBtn) {
            closeBtn.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
            });

            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closePumpEditor();
            });
        }
    }
});
