let taskWindowDragState = null;

const FLUID_AUTO_NAMES = ['Water', 'Methanol', 'Palm Oil', 'Crude Oil'];

const FLUID_TASK_FIELDS = [
    { key: 'density', label: 'Density', unit: 'kg/m3', digits: 3 },
    { key: 'viscosity', label: 'Kinematic Viscosity', unit: 'cSt', digits: 3 },
    { key: 'vaporPressure', label: 'Vapor Pressure', unit: 'bar a', digits: 3 },
    { key: 'sg', label: 'Specific Gravity', unit: '', digits: 5 },
    { key: 'dynViscosity', label: 'Dynamic Viscosity', unit: 'cP', digits: 3 },
    { key: 'specificHeat', label: 'Specific Heat', unit: 'kJ/kg.K', digits: 3 },
    { key: 'bulkModulus', label: 'Bulk Modulus', unit: 'GPa', digits: 3 },
    { key: 'specVolume', label: 'Specific Volume', unit: 'm3/kg', digits: 8 },
    { key: 'specWeight', label: 'Specific Weight', unit: 'N/m3', digits: 3 },
    { key: 'speedOfSound', label: 'Speed of Sound', unit: 'm/s', digits: 3 }
];

const FLUID_EDITABLE_ADVANCED_KEYS = ['sg', 'dynViscosity', 'vaporPressure', 'specificHeat', 'bulkModulus'];
const FLUID_EDITABLE_BASIC_KEYS = ['density', 'viscosity', 'vaporPressure'];

function initTaskWindow() {
    const taskWindow = document.getElementById('taskWindow');
    const header = document.getElementById('taskWindowHeader');
    const closeButton = document.getElementById('taskWindowClose');
    if (!taskWindow || taskWindow.dataset.initialized === 'true') return;

    closeButton?.addEventListener('click', (e) => {
        e.preventDefault();
        closeTaskWindow();
    });

    header?.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;
        const rect = taskWindow.getBoundingClientRect();
        taskWindowDragState = {
            pointerId: e.pointerId,
            offsetX: e.clientX - rect.left,
            offsetY: e.clientY - rect.top
        };
        header.setPointerCapture(e.pointerId);
    });

    header?.addEventListener('pointermove', (e) => {
        if (!taskWindowDragState || taskWindowDragState.pointerId !== e.pointerId) return;
        const width = taskWindow.offsetWidth;
        const height = taskWindow.offsetHeight;
        const maxLeft = Math.max(8, window.innerWidth - width - 8);
        const maxTop = Math.max(8, window.innerHeight - height - 8);
        taskWindow.style.left = `${Math.max(8, Math.min(maxLeft, e.clientX - taskWindowDragState.offsetX))}px`;
        taskWindow.style.top = `${Math.max(8, Math.min(maxTop, e.clientY - taskWindowDragState.offsetY))}px`;
        taskWindow.style.transform = 'none';
    });

    header?.addEventListener('pointerup', (e) => {
        if (taskWindowDragState?.pointerId === e.pointerId) {
            taskWindowDragState = null;
            header.releasePointerCapture(e.pointerId);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !taskWindow.hidden) closeTaskWindow();
    });

    taskWindow.dataset.initialized = 'true';
}

function openTaskWindow(title, content, options = {}) {
    const taskWindow = document.getElementById('taskWindow');
    const taskTitle = document.getElementById('taskWindowTitle');
    const taskBody = document.getElementById('taskWindowBody');
    if (!taskWindow || !taskTitle || !taskBody) return;

    initTaskWindow();
    taskTitle.textContent = title;
    taskBody.replaceChildren();
    taskBody.className = `task-window-body${options.bodyClass ? ` ${options.bodyClass}` : ''}`;

    if (content instanceof Node) {
        taskBody.appendChild(content);
    } else if (typeof content === 'string') {
        taskBody.innerHTML = content;
    }

    taskWindow.hidden = false;
    taskWindow.classList.toggle('task-window-fluid-active', options.kind === 'fluid');
    if (options.kind !== 'fluid') closeTabletFluidBottomDock();
    if (!taskWindow.style.left || !taskWindow.style.top) {
        taskWindow.style.left = '50%';
        taskWindow.style.top = '50%';
        taskWindow.style.transform = 'translate(-50%, -50%)';
    }
}

function closeTaskWindow() {
    const taskWindow = document.getElementById('taskWindow');
    if (taskWindow) {
        taskWindow.hidden = true;
        taskWindow.classList.remove('task-window-fluid-active');
    }
    closeTabletFluidBottomDock();
}

function isFluidAuto(fluidName) {
    return FLUID_AUTO_NAMES.includes(fluidName);
}

function getFluidReferenceDensity() {
    return typeof FLUID_TRACE_WATER_REF_DENSITY === 'number' ? FLUID_TRACE_WATER_REF_DENSITY : 999.972;
}

function formatFluidTaskNumber(value, digits = 3) {
    const number = parseFloat(value);
    if (!Number.isFinite(number)) return '-';
    const abs = Math.abs(number);
    if (abs > 0 && abs < 0.000001) return number.toExponential(4);
    if (abs > 0 && abs < 0.001) return number.toExponential(6);
    return number.toFixed(digits);
}

function formatFluidTaskValue(value, unit = '', digits = 3) {
    if (!unit && value !== null && value !== undefined && value !== '') {
        const numeric = parseFloat(value);
        if (!Number.isFinite(numeric)) return String(value);
    }
    const display = formatFluidTaskNumber(value, digits);
    return display === '-' || !unit ? display : `${display} ${unit}`;
}

function getFluidFieldDefinition(key) {
    return FLUID_TASK_FIELDS.find(field => field.key === key) || { key, label: key, unit: '', digits: 3 };
}

function updateAutoFluidProperties(fluidName) {
    if (fluidName === 'Water' && typeof updateWaterProperties === 'function') updateWaterProperties();
    if (fluidName === 'Methanol' && typeof updateMethanolProperties === 'function') updateMethanolProperties();
    if (fluidName === 'Palm Oil' && typeof updatePalmOilProperties === 'function') updatePalmOilProperties();
    if (fluidName === 'Crude Oil' && typeof updateCrudeOilProperties === 'function') updateCrudeOilProperties();
}

function recalcManualFluidProperties(props, changedKey) {
    const densityRef = getFluidReferenceDensity();
    const density = parseFloat(props.density);
    const dynamicViscosity = parseFloat(props.dynViscosity);
    const kinematicViscosity = parseFloat(props.viscosity);

    if (changedKey === 'sg') {
        props.density = parseFloat(props.sg) * densityRef;
    } else if (changedKey === 'density' && Number.isFinite(density)) {
        props.sg = density / densityRef;
    }

    const updatedDensity = parseFloat(props.density);
    if (Number.isFinite(updatedDensity) && updatedDensity > 0) {
        if (changedKey === 'viscosity' && Number.isFinite(kinematicViscosity)) {
            props.dynViscosity = kinematicViscosity * (updatedDensity / 1000);
        } else if (Number.isFinite(dynamicViscosity)) {
            props.viscosity = dynamicViscosity / (updatedDensity / 1000);
        } else if (Number.isFinite(kinematicViscosity)) {
            props.dynViscosity = kinematicViscosity * (updatedDensity / 1000);
        }
    }

    if (typeof recalcExtendedFluidProps === 'function') {
        recalcExtendedFluidProps(globalModel.FLUID);
    }
}

function runFluidBasisUpdate(changedKey) {
    const fluidNode = globalModel.FLUID;
    if (!fluidNode) return;
    const props = fluidNode.props;

    if (isFluidAuto(props.fluidName)) {
        updateAutoFluidProperties(props.fluidName);
    } else {
        recalcManualFluidProperties(props, changedKey);
    }

    if (typeof syncSourceTemperatureFromFluidBasis === 'function') {
        Object.keys(globalModel).forEach(nodeId => {
            if (globalModel[nodeId]?.type === 'source') syncSourceTemperatureFromFluidBasis(nodeId);
        });
    }
    if (typeof updateSimulation === 'function') updateSimulation({ renderSidebarAfter: false });
    if (typeof drawConnections === 'function') drawConnections();
}

function createFluidFieldRow(field, value, editable) {
    const row = document.createElement('label');
    row.className = 'fluid-field-row';
    row.dataset.fieldKey = field.key;

    const label = document.createElement('span');
    label.className = 'fluid-field-label';
    label.textContent = field.label;

    const controlWrap = document.createElement('span');
    controlWrap.className = 'fluid-field-control';

    if (editable) {
        const input = document.createElement('input');
        input.type = 'number';
        input.step = 'any';
        input.className = 'fluid-task-input';
        input.value = Number.isFinite(parseFloat(value)) ? value : '';
        input.dataset.fluidControl = field.key;
        controlWrap.appendChild(input);
    } else {
        const output = document.createElement('strong');
        output.className = 'fluid-task-readout';
        output.dataset.fluidValue = field.key;
        output.textContent = formatFluidTaskValue(value, field.unit, field.digits);
        output.title = Number.isFinite(parseFloat(value)) ? String(value) : '';
        controlWrap.appendChild(output);
    }

    if (field.unit && editable) {
        const unit = document.createElement('span');
        unit.className = 'fluid-field-unit';
        unit.textContent = field.unit;
        controlWrap.appendChild(unit);
    }

    row.append(label, controlWrap);
    return row;
}

function createFluidSelectRow(labelText, key, value, options) {
    const row = document.createElement('label');
    row.className = 'fluid-field-row';

    const label = document.createElement('span');
    label.className = 'fluid-field-label';
    label.textContent = labelText;

    const select = document.createElement('select');
    select.className = 'fluid-task-input';
    select.dataset.fluidControl = key;
    options.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option.value;
        opt.textContent = option.label;
        if (option.value === value) opt.selected = true;
        select.appendChild(opt);
    });

    row.append(label, select);
    return row;
}

function createFluidTemperatureRow(value) {
    const row = document.createElement('label');
    row.className = 'fluid-field-row';

    const label = document.createElement('span');
    label.className = 'fluid-field-label';
    label.textContent = 'Temperature';

    const control = document.createElement('span');
    control.className = 'fluid-field-control';

    const input = document.createElement('input');
    input.type = 'number';
    input.step = 'any';
    input.className = 'fluid-task-input';
    input.value = Number.isFinite(parseFloat(value)) ? value : '';
    input.dataset.fluidControl = 'temp';

    const unit = document.createElement('span');
    unit.className = 'fluid-field-unit';
    unit.textContent = 'deg C';

    control.append(input, unit);
    row.append(label, control);
    return row;
}

function createFluidInputCard(fluidNode, trace) {
    const props = fluidNode.props;
    const isAuto = isFluidAuto(props.fluidName);
    const card = document.createElement('section');
    card.className = 'fluid-input-card';

    const heading = document.createElement('h3');
    heading.textContent = 'Input Basis';
    card.appendChild(heading);

    const fields = document.createElement('div');
    fields.className = 'fluid-field-list';

    fields.appendChild(createFluidSelectRow('Input Mode', 'inputMode', props.inputMode || 'Basic', [
        { value: 'Basic', label: 'Basic' },
        { value: 'Advanced', label: 'Advanced' }
    ]));
    fields.appendChild(createFluidSelectRow('Fluid Name', 'fluidName', props.fluidName || 'Custom', [
        { value: 'Custom', label: 'Custom Fluid' },
        { value: 'Water', label: 'Water (Auto)' },
        { value: 'Methanol', label: 'Methanol (Auto)' },
        { value: 'Palm Oil', label: 'Palm Oil (Liquid Table)' },
        { value: 'Crude Oil', label: 'Crude Oil (Estimated)' }
    ]));
    fields.appendChild(createFluidTemperatureRow(props.temp));

    if (props.fluidName === 'Crude Oil' && typeof normalizeCrudeOilProps === 'function') {
        normalizeCrudeOilProps(props);
        [
            { key: 'crudeApiGravity', label: 'API Gravity @ 60F', unit: 'deg API' },
            { key: 'crudeViscosity40C', label: 'Kinematic Visc. @ 40C', unit: 'cSt' },
            { key: 'crudeViscosity100C', label: 'Kinematic Visc. @ 100C', unit: 'cSt' },
            { key: 'crudeRvp', label: 'RVP @ 37.8C', unit: 'bar a' }
        ].forEach(field => {
            fields.appendChild(createFluidFieldRow({ ...field, digits: 3 }, props[field.key], true));
        });
    }

    FLUID_TASK_FIELDS.forEach(field => {
        const editableKeys = props.inputMode === 'Advanced' ? FLUID_EDITABLE_ADVANCED_KEYS : FLUID_EDITABLE_BASIC_KEYS;
        const editable = !isAuto && editableKeys.includes(field.key);
        fields.appendChild(createFluidFieldRow(field, props[field.key], editable));
    });

    const method = document.createElement('div');
    method.className = 'fluid-method-strip';
    method.innerHTML = `
        <span>Property method</span>
        <strong data-fluid-meta="propertyMethod">${escapeTaskHtml(trace.inputBasis?.propertyMethod || '-')}</strong>
        <span>Trace status</span>
        <strong data-fluid-meta="traceStatus">${escapeTaskHtml(trace.status || '-')}</strong>
    `;

    card.append(fields, method);
    return card;
}

function createMetricCard(label, value, unit, digits, key) {
    const item = document.createElement('div');
    item.className = 'fluid-metric';
    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    const valueEl = document.createElement('strong');
    valueEl.dataset.fluidMetric = key;
    valueEl.textContent = formatFluidTaskValue(value, unit, digits);
    valueEl.title = Number.isFinite(parseFloat(value)) ? String(value) : '';
    item.append(labelEl, valueEl);
    return item;
}

function renderFluidCalculatedCard(card, fluidNode, trace) {
    card.replaceChildren();
    const heading = document.createElement('h3');
    heading.textContent = 'Calculated Properties / Calculation Trace';

    const basis = document.createElement('div');
    basis.className = 'fluid-basis-summary';
    basis.appendChild(createMetricCard('Fluid', trace.inputBasis?.fluidName || '-', '', 3, 'fluidName'));
    basis.appendChild(createMetricCard('Input Mode', trace.inputBasis?.inputMode || '-', '', 3, 'inputMode'));
    basis.appendChild(createMetricCard('Temperature', trace.inputBasis?.temperature, 'deg C', 3, 'temp'));
    basis.appendChild(createMetricCard('Status', trace.status || '-', '', 3, 'status'));

    const grid = document.createElement('div');
    grid.className = 'fluid-readout-grid';
    FLUID_TASK_FIELDS.forEach(field => {
        grid.appendChild(createMetricCard(field.label, fluidNode.props[field.key], field.unit, field.digits, field.key));
    });

    if (trace.warnings?.length) {
        const warningBox = document.createElement('div');
        warningBox.className = 'fluid-warning-box';
        const title = document.createElement('strong');
        title.textContent = 'Needs Review';
        const list = document.createElement('ul');
        trace.warnings.forEach(warning => {
            const item = document.createElement('li');
            item.textContent = warning;
            list.appendChild(item);
        });
        warningBox.append(title, list);
        card.append(heading, basis, grid, warningBox);
        return;
    }

    card.append(heading, basis, grid);
}

function renderFluidDependencyCard(card, trace) {
    card.replaceChildren();
    const heading = document.createElement('h3');
    heading.textContent = 'Dependency Chain';
    const list = document.createElement('ul');
    list.className = 'fluid-dependency-list';
    (trace.dependencyChain || []).forEach(text => {
        const item = document.createElement('li');
        item.textContent = text;
        list.appendChild(item);
    });
    card.append(heading, list);
}

function renderFluidEquationCard(card, trace) {
    card.replaceChildren();
    const heading = document.createElement('h3');
    heading.textContent = 'Equation Steps';
    const steps = document.createElement('div');
    steps.className = 'fluid-equation-steps';

    (trace.steps || []).forEach((step, index) => {
        const item = document.createElement('article');
        item.className = 'fluid-equation-step';
        const title = document.createElement('div');
        title.className = 'fluid-equation-title';
        title.textContent = `${index + 1}. ${step.title || 'Calculation Step'}`;
        const reference = document.createElement('div');
        reference.className = 'fluid-equation-reference';
        reference.textContent = step.reference || step.source || '-';
        const formula = document.createElement('code');
        formula.className = 'fluid-equation-formula';
        formula.textContent = step.formula || '-';
        const substitution = document.createElement('div');
        substitution.className = 'fluid-equation-substitution';
        substitution.textContent = step.substitution || '-';
        const result = document.createElement('strong');
        result.className = 'fluid-equation-result';
        result.textContent = formatFluidTaskValue(step.result, step.unit || '', 3);
        item.append(title, reference, formula, substitution, result);
        steps.appendChild(item);
    });

    card.append(heading, steps);
}

function getFluidTrace() {
    if (typeof buildFluidCalculationTrace !== 'function') return null;
    return buildFluidCalculationTrace(globalModel.FLUID);
}

function refreshFluidBasisTask() {
    const fluidNode = globalModel.FLUID;
    const trace = getFluidTrace();
    if (!fluidNode || !trace) return;

    document.querySelectorAll('[data-fluid-value]').forEach(el => {
        const key = el.dataset.fluidValue;
        const field = getFluidFieldDefinition(key);
        const value = fluidNode.props[key];
        el.textContent = formatFluidTaskValue(value, field.unit, field.digits);
        el.title = Number.isFinite(parseFloat(value)) ? String(value) : '';
    });

    document.querySelectorAll('[data-fluid-meta="propertyMethod"]').forEach(el => {
        el.textContent = trace.inputBasis?.propertyMethod || '-';
    });
    document.querySelectorAll('[data-fluid-meta="traceStatus"]').forEach(el => {
        el.textContent = trace.status || '-';
    });

    const calculatedCard = document.querySelector('.fluid-calculated-card');
    const dependencyCard = document.querySelector('.fluid-dependency-card');
    const equationCard = document.querySelector('.fluid-equation-card');
    if (calculatedCard) renderFluidCalculatedCard(calculatedCard, fluidNode, trace);
    if (dependencyCard) renderFluidDependencyCard(dependencyCard, trace);
    if (equationCard) renderFluidEquationCard(equationCard, trace);
    renderTabletFluidBottomDock(trace);
}

function captureTaskWindowEdit(target) {
    if (typeof captureState !== 'function' || !target) return;
    if (target.dataset.historyCaptured === 'true') return;
    captureState();
    target.dataset.historyCaptured = 'true';
}

function releaseTaskWindowEdit(target) {
    if (target?.dataset) delete target.dataset.historyCaptured;
}

function handleFluidTaskInput(e) {
    const target = e.target.closest('[data-fluid-control]');
    if (!target || !globalModel.FLUID) return;
    if (e.type === 'change' && target.tagName !== 'SELECT') return;

    const key = target.dataset.fluidControl;
    const props = globalModel.FLUID.props;
    const isTextValue = key === 'fluidName' || key === 'inputMode';
    const value = isTextValue ? target.value : parseFloat(target.value);
    captureTaskWindowEdit(target);

    if (!isTextValue && !Number.isFinite(value)) return;

    props[key] = value;

    if (key === 'fluidName') {
        runFluidBasisUpdate(key);
        renderFluidBasisTaskWindow();
        return;
    }

    if (key === 'inputMode') {
        runFluidBasisUpdate(key);
        renderFluidBasisTaskWindow();
        return;
    }

    runFluidBasisUpdate(key);
    refreshFluidBasisTask();
}

function createFluidBasisTaskRoot() {
    const fluidNode = globalModel.FLUID;
    const trace = getFluidTrace();
    const root = document.createElement('div');
    root.className = 'fluid-basis-task';
    if (!fluidNode || !trace) {
        const empty = document.createElement('div');
        empty.className = 'fluid-task-empty';
        empty.textContent = 'Fluid Basis is not available in the current model.';
        root.appendChild(empty);
        return root;
    }

    const grid = document.createElement('div');
    grid.className = 'fluid-basis-grid';
    const inputCard = createFluidInputCard(fluidNode, trace);
    const calculatedCard = document.createElement('section');
    calculatedCard.className = 'fluid-calculated-card';
    renderFluidCalculatedCard(calculatedCard, fluidNode, trace);
    grid.append(inputCard, calculatedCard);

    const traceLayout = document.createElement('div');
    traceLayout.className = 'fluid-trace-layout';
    const dependencyCard = document.createElement('section');
    dependencyCard.className = 'fluid-dependency-card';
    const equationCard = document.createElement('section');
    equationCard.className = 'fluid-equation-card';
    renderFluidDependencyCard(dependencyCard, trace);
    renderFluidEquationCard(equationCard, trace);
    traceLayout.append(dependencyCard, equationCard);

    root.append(grid, traceLayout);
    root.addEventListener('input', handleFluidTaskInput);
    root.addEventListener('change', handleFluidTaskInput);
    root.addEventListener('blur', (e) => {
        if (e.target?.dataset?.fluidControl) releaseTaskWindowEdit(e.target);
    }, true);

    renderTabletFluidBottomDock(trace);
    return root;
}

function renderFluidBasisTaskWindow() {
    const root = createFluidBasisTaskRoot();
    openTaskWindow('Fluid Basis', root, { kind: 'fluid', bodyClass: 'fluid-basis-task-body' });
    document.body.classList.add('fluid-basis-task-open');
}

function openFluidBasisTaskWindow() {
    if (!globalModel.FLUID) return;
    globalModel.FLUID.name = 'Fluid Basis';
    renderFluidBasisTaskWindow();
}

function getSourceMapDigits(row) {
    const property = String(row?.property || '').toLowerCase();
    if (property.includes('specific volume')) return 9;
    if (property.includes('specific gravity')) return 5;
    if (property.includes('dynamic') || property.includes('kinematic')) return 3;
    if (property.includes('vapor pressure head')) return 3;
    if (property.includes('vapor pressure')) return 3;
    if (property.includes('speed of sound')) return 3;
    if (property.includes('specific heat')) return 3;
    if (property.includes('bulk modulus')) return 3;
    return 3;
}

function createFluidHelpCard(title, content) {
    const card = document.createElement('section');
    card.className = 'fluid-help-card';
    const heading = document.createElement('h3');
    heading.textContent = title;
    card.appendChild(heading);
    if (content instanceof Node) {
        card.appendChild(content);
    }
    return card;
}

function createFluidHelpList(items, className = 'fluid-help-list') {
    const list = document.createElement('ul');
    list.className = className;
    (items || []).forEach(text => {
        const item = document.createElement('li');
        item.textContent = text;
        list.appendChild(item);
    });
    return list;
}

function createPropertySourceMapTable(trace) {
    const wrap = document.createElement('div');
    wrap.className = 'fluid-table-wrap';
    const table = document.createElement('table');
    table.className = 'fluid-table';
    const head = document.createElement('thead');
    const headRow = document.createElement('tr');
    ['Property', 'Current Value', 'Unit', 'Method', 'Formula / Dependency', 'Reference', 'Status'].forEach(label => {
        const th = document.createElement('th');
        th.textContent = label;
        headRow.appendChild(th);
    });
    head.appendChild(headRow);

    const body = document.createElement('tbody');
    (trace.propertySourceMap || []).forEach(row => {
        const tr = document.createElement('tr');
        [
            row.property,
            formatFluidTaskNumber(row.value, getSourceMapDigits(row)),
            row.unit || '-',
            row.method || row.source || '-',
            row.formula || '-',
            row.reference || '-',
            row.status || 'Needs verification'
        ].forEach(value => {
            const td = document.createElement('td');
            td.textContent = value;
            if (value === row.status) td.className = `fluid-status-${String(value).toLowerCase().replace(/[^a-z]+/g, '-')}`;
            tr.appendChild(td);
        });
        body.appendChild(tr);
    });

    table.append(head, body);
    wrap.appendChild(table);
    return wrap;
}

function createNpshNotesContent(trace) {
    const root = document.createElement('div');
    root.className = 'fluid-help-layout';
    const statusItems = (trace.propertySourceMap || []).map(row => `${row.property}: ${row.status || 'Needs verification'} (${row.method || row.source || '-'})`);
    root.append(
        createFluidHelpCard('NPSH Relevance', createFluidHelpList(trace.npshRelevance)),
        createFluidHelpCard('Academic / Engineering Notes', createFluidHelpList(trace.academicNotes)),
        createFluidHelpCard('Audit Status by Property', createFluidHelpList(statusItems)),
        createFluidHelpCard('Assumptions', createFluidHelpList(trace.assumptions)),
        createFluidHelpCard('References Used', createFluidHelpList(trace.references))
    );

    if (trace.warnings?.length) {
        root.appendChild(createFluidHelpCard('Needs Review', createFluidHelpList(trace.warnings, 'fluid-help-list fluid-warning-list')));
    }
    return root;
}

function openFluidPropertiesHelp(kind) {
    const trace = getFluidTrace();
    if (!trace) {
        const empty = document.createElement('div');
        empty.className = 'fluid-task-empty';
        empty.textContent = 'Fluid property audit data is not available in the current model.';
        openTaskWindow('Fluid Properties', empty, { bodyClass: 'fluid-help-body' });
        return;
    }

    if (kind === 'source-map') {
        const root = document.createElement('div');
        root.className = 'fluid-help-layout fluid-source-map-help';
        root.appendChild(createFluidHelpCard('Property Source Map', createPropertySourceMapTable(trace)));
        openTaskWindow('Property Source Map', root, { bodyClass: 'fluid-help-body' });
        return;
    }

    openTaskWindow('NPSH Relevance & Academic Notes', createNpshNotesContent(trace), { bodyClass: 'fluid-help-body' });
}

function renderTabletFluidBottomDock(trace) {
    const dock = document.getElementById('tabletFluidBottomDock');
    if (!dock || !trace) return;
    dock.hidden = false;
    dock.replaceChildren();

    const dependencyCard = document.createElement('section');
    dependencyCard.className = 'fluid-dependency-card';
    const equationCard = document.createElement('section');
    equationCard.className = 'fluid-equation-card';
    renderFluidDependencyCard(dependencyCard, trace);
    renderFluidEquationCard(equationCard, trace);
    dock.append(dependencyCard, equationCard);
}

function closeTabletFluidBottomDock() {
    const dock = document.getElementById('tabletFluidBottomDock');
    if (dock) {
        dock.hidden = true;
        dock.replaceChildren();
    }
    document.body.classList.remove('fluid-basis-task-open');
}

function escapeTaskHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}
