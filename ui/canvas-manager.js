function isInstrumentType(type) {
    return INSTRUMENT_TYPES.includes(type);
}

const TOOLBAR_DRAG_THRESHOLD_PX = 6;
const RIBBON_CLICK_OBJECT_GAP_PX = 44;
const RIBBON_CLICK_MIN_STEP_PX = 104;
let toolbarDragState = null;
let ribbonClickPlacementState = null;

const VISUAL_OBJECT_BASE_SIZES = {
    tank: { width: 82, height: 62 },
    separator: { width: 76, height: 44 },
    verticalVessel: { width: 44, height: 72 }
};

function isVisualResizableType(type) {
    return !!VISUAL_OBJECT_BASE_SIZES[type];
}

function getVisualScale(props = {}) {
    const rawScale = parseFloat(props.visualScale);
    if (!Number.isFinite(rawScale)) return 1;
    return Math.max(0.45, Math.min(2.5, rawScale / 100));
}

function applyObjectVisuals(nodeId) {
    const node = globalModel[nodeId];
    const el = getObjectElement(nodeId);
    if (!node || !el) return;

    el.classList.add(`object-type-${node.type}`);
    el.dataset.type = node.type;
    updateObjectOperatingStatusVisual(nodeId);

    if (!isVisualResizableType(node.type)) return;

    const base = VISUAL_OBJECT_BASE_SIZES[node.type];
    const scale = getVisualScale(node.props);
    el.style.setProperty('--visual-width', `${base.width * scale}px`);
    el.style.setProperty('--visual-height', `${base.height * scale}px`);
}

const PUMP_OPERATING_STATUS_CLASSES = [
    'pump-status-safe',
    'pump-status-warning',
    'pump-status-risk',
    'pump-status-incomplete'
];

const PUMP_OPERATING_STATUS_LABELS = {
    safe: 'Safe',
    warning: 'Warning',
    risk: 'NPSH Risk',
    incomplete: 'Incomplete',
    normal: ''
};

const WARNING_PANEL_STATUS_PRIORITY = {
    risk: 0,
    warning: 1,
    advisory: 2,
    incomplete: 3,
    normal: 4
};

const CANVAS_WARNING_PANEL_MARGIN = 12;
let canvasWarningPanelDragState = null;
let canvasWarningPanelViewportFrame = null;

function getPumpOperatingWarnings(node) {
    return Array.isArray(node?.results?.warnings)
        ? node.results.warnings.filter(Boolean)
        : [];
}

function hasPumpOperatingWarning(node) {
    if (!node || node.type !== 'pump') return false;
    return ['warning', 'risk'].includes(getPumpOperatingVisualStatus(node));
}

function getPumpOperatingVisualStatus(node) {
    if (!node || node.type !== 'pump') return 'normal';

    const status = String(node.results?.status || '').trim().toLowerCase();
    const cavitationStatus = String(node.results?.cavitationStatus || '').trim().toLowerCase();
    const warnings = getPumpOperatingWarnings(node);
    const unresolvedState = `${status} ${cavitationStatus}`;

    if (cavitationStatus.includes('risk')) return 'risk';
    if (cavitationStatus.includes('warning')) return 'warning';
    if (
        unresolvedState.includes('incomplete')
        || unresolvedState.includes('invalid')
        || unresolvedState.includes('unknown')
        || unresolvedState.includes('no operating solution')
        || status === '-'
        || cavitationStatus === '-'
    ) {
        return 'incomplete';
    }
    if (status === 'warning' || warnings.length > 0) return 'warning';
    if (cavitationStatus.includes('safe') || status === 'ok') return 'safe';
    return 'normal';
}

function formatPumpStatusMetric(value, unit = '') {
    if (value === null || value === undefined || value === '') return null;
    const text = String(value).trim();
    if (!text || text === '-') return null;
    return unit ? `${text} ${unit}` : text;
}

function addPumpStatusMetric(lines, label, value, unit = '') {
    const formatted = formatPumpStatusMetric(value, unit);
    if (formatted) lines.push(`${label}: ${formatted}`);
}

function getPumpOperatingStatusTooltip(node, visualStatus) {
    const results = node?.results || {};
    const warnings = getPumpOperatingWarnings(node);
    const lines = [
        `Pump status: ${results.cavitationStatus || results.status || visualStatus || 'Review operating results'}`
    ];

    addPumpStatusMetric(lines, 'NPSHa', results.npsha, 'm');
    addPumpStatusMetric(lines, 'NPSHr', results.npshr, 'm');
    addPumpStatusMetric(lines, 'NPSH margin', results.npshMargin, 'm');
    addPumpStatusMetric(lines, 'NPSH ratio', results.npshRatio);
    addPumpStatusMetric(lines, 'Dominant suction loss', results.dominantSuctionLoss);

    if (warnings.length > 0) {
        lines.push(`Warnings: ${warnings.join(' | ')}`);
    }

    return lines.join('\n');
}

function updatePumpStatusBadge(el, visualStatus) {
    const badge = el.querySelector('.pump-status-badge');
    if (!badge) return;

    badge.classList.remove(
        'pump-status-badge-safe',
        'pump-status-badge-warning',
        'pump-status-badge-risk',
        'pump-status-badge-incomplete'
    );

    const label = PUMP_OPERATING_STATUS_LABELS[visualStatus] || '';
    if (!label) {
        badge.hidden = true;
        badge.textContent = '';
        return;
    }

    badge.hidden = false;
    badge.textContent = label;
    badge.classList.add(`pump-status-badge-${visualStatus}`);
}

function isPumpLiveResultAvailable(node) {
    if (!node || node.type !== 'pump') return false;
    const status = String(node.results?.status || '').trim().toLowerCase();
    const cavitationStatus = String(node.results?.cavitationStatus || '').trim().toLowerCase();
    if (!cavitationStatus || cavitationStatus === '-') return false;
    return !(
        status.includes('incomplete')
        || status.includes('invalid')
        || status.includes('no operating')
        || cavitationStatus.includes('incomplete')
        || cavitationStatus.includes('unknown')
        || cavitationStatus === '-'
    );
}

function getPumpLiveDisplayUnit(quantity, options = {}) {
    if (typeof getDisplayUnit === 'function') return getDisplayUnit(quantity, options);
    if (quantity === 'flow') return 'm3/h';
    if (quantity === 'pressureAbs') return 'bar a';
    if (quantity === 'head') return 'm';
    return options.unit || '';
}

function formatPumpLiveNumber(value, digits = 1, options = {}) {
    const number = parseFloat(value);
    if (!Number.isFinite(number)) return '-';
    const abs = Math.abs(number);
    const formatted = abs > 0 && abs < 0.001
        ? number.toExponential(2)
        : number.toFixed(digits);
    return options.showSign && number > 0 ? `+${formatted}` : formatted;
}

function getPumpLiveDisplayValue(value, quantity, digits = 1, options = {}) {
    const number = parseFloat(value);
    if (!Number.isFinite(number)) return '-';
    const displayValue = typeof convertToDisplay === 'function'
        ? convertToDisplay(number, quantity)
        : number;
    return formatPumpLiveNumber(displayValue, digits, options);
}

function getPumpLiveVaporPressureBasis() {
    const vaporPressure = parseFloat(globalModel.FLUID?.props?.vaporPressure);
    return Number.isFinite(vaporPressure) ? vaporPressure : null;
}

function buildPumpLiveParameterRows(node) {
    const solved = isPumpLiveResultAvailable(node);
    const results = node.results || {};
    const flowUnit = getPumpLiveDisplayUnit('flow');
    const headUnit = getPumpLiveDisplayUnit('head');
    const vaporPressureUnit = getPumpLiveDisplayUnit('pressureAbs');
    const basisVaporPressure = Number.isFinite(parseFloat(results.vaporPressureBasis))
        ? parseFloat(results.vaporPressureBasis)
        : getPumpLiveVaporPressureBasis();
    const liveVaporPressure = parseFloat(results.vaporPressureLive);
    const solvedValue = (key, quantity, digits = 1, options = {}) => (
        solved ? getPumpLiveDisplayValue(results[key], quantity, digits, options) : '-'
    );
    const pressureValue = (value) => getPumpLiveDisplayValue(value, 'pressureAbs', 3);

    return [
        { label: 'Q', title: 'Operating flow rate', value: solvedValue('flow', 'flow', 1), unit: flowUnit },
        { label: 'H', title: 'Pump head', value: solvedValue('head', 'head', 1), unit: headUnit },
        { label: 'NPSHa', title: 'Available NPSH', value: solvedValue('npsha', 'head', 1), unit: headUnit },
        { label: 'NPSHr', title: 'Required NPSH', value: solvedValue('npshr', 'head', 1), unit: headUnit },
        { label: 'M', title: 'NPSH margin', value: solvedValue('npshMargin', 'head', 1, { showSign: true }), unit: headUnit },
        { label: 'R', title: 'NPSH ratio', value: solved ? formatPumpLiveNumber(results.npshRatio, 2) : '-', unit: '' },
        { label: 'PvB', title: 'Fluid Basis vapor pressure', value: pressureValue(basisVaporPressure), unit: vaporPressureUnit },
        { label: 'PvP', title: 'Live pump vapor pressure used in NPSH', value: solved ? pressureValue(liveVaporPressure) : '-', unit: vaporPressureUnit }
    ];
}

function updatePumpLiveParameterPanel(el, node, visualStatus) {
    const panel = el.querySelector('.pump-live-params');
    if (!panel) return;

    panel.classList.remove(
        'pump-live-params-safe',
        'pump-live-params-warning',
        'pump-live-params-risk',
        'pump-live-params-incomplete'
    );
    if (visualStatus !== 'normal') {
        panel.classList.add(`pump-live-params-${visualStatus}`);
    }

    const rows = buildPumpLiveParameterRows(node);
    panel.replaceChildren();
    rows.forEach(row => {
        const item = document.createElement('div');
        item.className = 'pump-live-param-row';
        item.title = row.title;

        const label = document.createElement('span');
        label.className = 'pump-live-param-label';
        label.textContent = row.label;

        const value = document.createElement('strong');
        value.className = 'pump-live-param-value';
        value.textContent = row.value;

        const unit = document.createElement('span');
        unit.className = 'pump-live-param-unit';
        unit.textContent = row.value === '-' ? '' : row.unit;

        item.append(label, value, unit);
        panel.appendChild(item);
    });
}

function getGenericNodeWarnings(node) {
    return Array.isArray(node?.results?.warnings)
        ? node.results.warnings.filter(Boolean)
        : [];
}

function getGenericWarningStatus(node) {
    const status = String(node?.results?.status || '').trim().toLowerCase();
    const warnings = getGenericNodeWarnings(node);

    if (
        status.includes('incomplete')
        || status.includes('invalid')
        || status.includes('unknown')
        || status.includes('no operating')
    ) {
        return 'incomplete';
    }

    if (status.includes('advisory')) return 'advisory';
    if (status === 'warning' || warnings.length > 0) return 'warning';
    return 'normal';
}

function getEquipmentWarningSummary(nodeId, node) {
    if (!node || nodeId === 'FLUID' || nodeId === 'SETTINGS' || node.type === 'pipe' || node.type === 'settings') return null;

    if (node.type === 'pump') {
        const visualStatus = getPumpOperatingVisualStatus(node);
        if (!['risk', 'warning', 'incomplete'].includes(visualStatus)) return null;

        const results = node.results || {};
        const details = [];
        addPumpStatusMetric(details, 'NPSHa', results.npsha, 'm');
        addPumpStatusMetric(details, 'NPSHr', results.npshr, 'm');
        addPumpStatusMetric(details, 'Margin', results.npshMargin, 'm');
        if (results.dominantSuctionLoss && results.dominantSuctionLoss !== '-') {
            details.push(`Dominant loss: ${results.dominantSuctionLoss}`);
        }

        const warnings = getPumpOperatingWarnings(node);
        const fallback = warnings[0] || results.cavitationStatus || results.status || 'Review pump operating results.';

        return {
            nodeId,
            name: node.name || nodeId,
            type: node.type,
            status: visualStatus,
            label: PUMP_OPERATING_STATUS_LABELS[visualStatus] || 'Warning',
            detail: details.join(' | ') || fallback
        };
    }

    const status = getGenericWarningStatus(node);
    if (status === 'normal') return null;

    const warnings = getGenericNodeWarnings(node);
    return {
        nodeId,
        name: node.name || nodeId,
        type: node.type,
        status,
        label: status === 'incomplete' ? 'Incomplete' : (status === 'advisory' ? 'Advisory' : 'Warning'),
        detail: warnings[0] || node.results?.status || 'Review operating results.'
    };
}

function focusWarningNode(nodeId) {
    const el = getObjectElement(nodeId);
    if (!el) return;
    if (typeof selectNode === 'function') selectNode(nodeId, el);
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
}

function getCanvasWarningPanelViewportBounds(canvas, panel) {
    const margin = CANVAS_WARNING_PANEL_MARGIN;
    const rect = canvas.getBoundingClientRect?.() || { width: canvas.clientWidth || 0, height: canvas.clientHeight || 0 };
    const viewportWidth = canvas.clientWidth || rect.width || panel.offsetWidth + (margin * 2);
    const viewportHeight = canvas.clientHeight || rect.height || panel.offsetHeight + (margin * 2);
    const panelWidth = panel.offsetWidth || panel.getBoundingClientRect?.().width || 0;
    const panelHeight = panel.offsetHeight || panel.getBoundingClientRect?.().height || 0;
    const minLeft = (canvas.scrollLeft || 0) + margin;
    const minTop = (canvas.scrollTop || 0) + margin;

    return {
        minLeft,
        minTop,
        maxLeft: Math.max(minLeft, (canvas.scrollLeft || 0) + viewportWidth - panelWidth - margin),
        maxTop: Math.max(minTop, (canvas.scrollTop || 0) + viewportHeight - panelHeight - margin)
    };
}

function clampCanvasWarningPanelPosition(left, top) {
    const canvas = document.getElementById('canvas');
    const panel = document.getElementById('canvasWarningPanel');
    if (!canvas || !panel) return { left, top };

    const bounds = getCanvasWarningPanelViewportBounds(canvas, panel);

    return {
        left: Math.max(bounds.minLeft, Math.min(bounds.maxLeft, left)),
        top: Math.max(bounds.minTop, Math.min(bounds.maxTop, top))
    };
}

function setCanvasWarningPanelPosition(left, top, options = {}) {
    const panel = document.getElementById('canvasWarningPanel');
    const canvas = document.getElementById('canvas');
    if (!panel) return;
    const position = clampCanvasWarningPanelPosition(left, top);
    panel.style.left = `${position.left}px`;
    panel.style.top = `${position.top}px`;
    panel.style.right = 'auto';
    panel.style.transform = 'none';
    if (canvas && options.rememberViewport !== false) {
        panel.dataset.viewportLeft = `${position.left - (canvas.scrollLeft || 0)}`;
        panel.dataset.viewportTop = `${position.top - (canvas.scrollTop || 0)}`;
    }
}

function keepCanvasWarningPanelInViewport() {
    const canvas = document.getElementById('canvas');
    const panel = document.getElementById('canvasWarningPanel');
    if (!canvas || !panel) return;

    if (panel.dataset.userMoved !== 'true') {
        positionCanvasWarningPanelDefault();
        return;
    }

    const viewportLeft = parseFloat(panel.dataset.viewportLeft);
    const viewportTop = parseFloat(panel.dataset.viewportTop);
    const left = (canvas.scrollLeft || 0) + (Number.isFinite(viewportLeft) ? viewportLeft : panel.offsetLeft - (canvas.scrollLeft || 0));
    const top = (canvas.scrollTop || 0) + (Number.isFinite(viewportTop) ? viewportTop : panel.offsetTop - (canvas.scrollTop || 0));
    setCanvasWarningPanelPosition(left, top);
}

function requestCanvasWarningPanelViewportClamp() {
    if (canvasWarningPanelViewportFrame !== null) return;
    canvasWarningPanelViewportFrame = requestAnimationFrame(() => {
        canvasWarningPanelViewportFrame = null;
        keepCanvasWarningPanelInViewport();
    });
}

function positionCanvasWarningPanelDefault() {
    const canvas = document.getElementById('canvas');
    const legend = document.querySelector('.canvas-status-legend');
    const panel = document.getElementById('canvasWarningPanel');
    if (!canvas || !panel) return;

    if (panel.dataset.userMoved === 'true') {
        keepCanvasWarningPanelInViewport();
        return;
    }

    const margin = CANVAS_WARNING_PANEL_MARGIN;
    const legendHidden = !legend || window.getComputedStyle(legend).display === 'none';
    if (legendHidden) {
        setCanvasWarningPanelPosition((canvas.scrollLeft || 0) + margin, (canvas.scrollTop || 0) + margin);
        return;
    }

    const defaultTop = (canvas.scrollTop || 0) + margin + legend.offsetHeight + 10;
    const defaultLeft = (canvas.scrollLeft || 0) + canvas.clientWidth - panel.offsetWidth - margin;
    setCanvasWarningPanelPosition(defaultLeft, defaultTop);
}

function initCanvasWarningPanelWindow() {
    const panel = document.getElementById('canvasWarningPanel');
    const header = document.getElementById('canvasWarningHeader');
    const canvas = document.getElementById('canvas');
    if (!panel || !header || !canvas || panel.dataset.windowInitialized === 'true') return;

    header.addEventListener('pointerdown', event => {
        if (event.button !== undefined && event.button !== 0) return;
        const startLeft = panel.offsetLeft;
        const startTop = panel.offsetTop;
        canvasWarningPanelDragState = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startLeft,
            startTop
        };
        panel.dataset.userMoved = 'true';
        header.setPointerCapture?.(event.pointerId);
        event.stopPropagation();
        event.preventDefault();
    });

    header.addEventListener('pointermove', event => {
        if (!canvasWarningPanelDragState || canvasWarningPanelDragState.pointerId !== event.pointerId) return;
        const dx = event.clientX - canvasWarningPanelDragState.startX;
        const dy = event.clientY - canvasWarningPanelDragState.startY;
        setCanvasWarningPanelPosition(
            canvasWarningPanelDragState.startLeft + dx,
            canvasWarningPanelDragState.startTop + dy
        );
        event.stopPropagation();
        event.preventDefault();
    });

    const stopDrag = event => {
        if (!canvasWarningPanelDragState || canvasWarningPanelDragState.pointerId !== event.pointerId) return;
        canvasWarningPanelDragState = null;
        header.releasePointerCapture?.(event.pointerId);
        event.stopPropagation();
    };

    header.addEventListener('pointerup', stopDrag);
    header.addEventListener('pointercancel', stopDrag);
    canvas.addEventListener('scroll', requestCanvasWarningPanelViewportClamp, { passive: true });
    window.addEventListener('resize', requestCanvasWarningPanelViewportClamp);
    window.addEventListener('orientationchange', requestCanvasWarningPanelViewportClamp);

    panel.dataset.windowInitialized = 'true';
}

function updateCanvasWarningPanel() {
    const panel = document.getElementById('canvasWarningPanel');
    const list = document.getElementById('canvasWarningList');
    const count = document.getElementById('canvasWarningCount');
    if (!panel || !list || !count) return;

    initCanvasWarningPanelWindow();

    const summaries = Object.entries(globalModel)
        .map(([nodeId, node]) => getEquipmentWarningSummary(nodeId, node))
        .filter(Boolean)
        .sort((a, b) => {
            const priorityDiff = WARNING_PANEL_STATUS_PRIORITY[a.status] - WARNING_PANEL_STATUS_PRIORITY[b.status];
            if (priorityDiff !== 0) return priorityDiff;
            return a.name.localeCompare(b.name);
        });

    count.textContent = String(summaries.length);
    panel.classList.toggle('has-warnings', summaries.length > 0);
    list.replaceChildren();

    if (summaries.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'canvas-warning-empty';
        empty.textContent = 'No active warnings';
        list.appendChild(empty);
        return;
    }

    summaries.forEach(summary => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = `canvas-warning-item canvas-warning-item-${summary.status}`;
        item.dataset.nodeId = summary.nodeId;

        const title = document.createElement('span');
        title.className = 'canvas-warning-item-title';
        title.textContent = `${summary.name} - ${summary.label}`;

        const detail = document.createElement('span');
        detail.className = 'canvas-warning-item-detail';
        detail.textContent = summary.detail;

        item.append(title, detail);
        item.addEventListener('click', event => {
            event.stopPropagation();
            focusWarningNode(summary.nodeId);
        });
        list.appendChild(item);
    });
}

function updateObjectOperatingStatusVisual(nodeId) {
    const node = globalModel[nodeId];
    const el = getObjectElement(nodeId);
    if (!node || !el) return;

    const visualStatus = getPumpOperatingVisualStatus(node);
    PUMP_OPERATING_STATUS_CLASSES.forEach(className => el.classList.remove(className));
    if (node.type === 'pump') {
        if (visualStatus !== 'normal') {
            el.classList.add(`pump-status-${visualStatus}`);
        }
        el.dataset.operatingStatus = visualStatus;
        el.title = getPumpOperatingStatusTooltip(node, visualStatus);
        updatePumpStatusBadge(el, visualStatus);
        updatePumpLiveParameterPanel(el, node, visualStatus);
        return;
    }

    delete el.dataset.operatingStatus;
    el.title = '';
}

function updateAllObjectOperatingStatusVisuals() {
    Object.keys(globalModel).forEach(updateObjectOperatingStatusVisual);
    updateCanvasWarningPanel();
}

function updateSourceTypeFromContextMenu(sourceId, sourceType) {
    const source = globalModel[sourceId];
    if (!source || source.type !== 'source' || !sourceType) return null;
    const sourceTypeChanged = source.props?.sourceType !== sourceType;

    if (sourceTypeChanged && typeof captureState === 'function') captureState();
    if (!source.props) source.props = {};
    source.props.sourceType = sourceType;

    if (sourceTypeChanged && typeof reconcileSourceBoundaryConfiguration === 'function') {
        reconcileSourceBoundaryConfiguration(sourceId, { detachInvalidAttachment: true });
    }
    if (typeof normalizeSourceProps === 'function') {
        normalizeSourceProps(source);
    }
    if (typeof syncSourceFlowFromInputMode === 'function') {
        syncSourceFlowFromInputMode(sourceId);
    }
    if (typeof drawConnections === 'function') drawConnections();
    if (typeof renderSidebar === 'function') renderSidebar(sourceId);
    if (typeof updateSimulation === 'function') updateSimulation({ renderSidebarAfter: false });
    return source;
}

function startSourceTypeActionFromContextMenu(sourceId, sourceType, e) {
    const source = updateSourceTypeFromContextMenu(sourceId, sourceType);
    if (!source) return;

    if (typeof isSourceTypeSemanticAttachmentCapable === 'function'
        ? isSourceTypeSemanticAttachmentCapable(source)
        : sourceType === 'Open Tank / Reservoir' || sourceType === 'Pressurized Vessel') {
        setAppMode('CONNECT');
        startSourceAttachment(sourceId, e);
        return;
    }

    startHydraulicConnectionFromSource(sourceId, e);
}

function setAppMode(mode) {
    appMode = mode;

    const btnSelect = document.getElementById('btn-mode-select');
    const btnConnect = document.getElementById('btn-mode-connect');
    const canvas = document.getElementById('canvas');

    if (btnSelect && btnConnect) {
        btnSelect.classList.toggle('active', mode === 'SELECT');
        btnConnect.classList.toggle('active', mode === 'CONNECT');
    }

    if (canvas) {
        canvas.classList.toggle('connect-mode', mode === 'CONNECT');
    }

    if (mode !== 'CONNECT' && pendingConnectionStart) cancelPendingConnection();
}

function activateConnectTool(routeStyle = 'Straight') {
    nextPipeRouteStyle = routeStyle;
    setAppMode('CONNECT');
}
function getToolbarItem(type) {
    const groups = window.TOOLBAR_GROUPS || [];
    for (const group of groups) {
        const item = group.items.find(entry => entry.type === type);
        if (item) return item;
    }
    return null;
}

function getObjectPrefix(type) {
    if (type === 'pump') return 'P-';
    if (type === 'tank') return 'TK-';
    if (type === 'valve') return 'V-';
    if (type === 'checkValve') return 'CV-';
    if (type === 'separator' || type === 'verticalVessel') return 'VES-';
    if (type === 'heatExchanger') return 'E-';
    if (type === 'mixer') return 'M-';
    if (type === 'source') return 'SRC-';
    if (type === 'sink') return 'SNK-';
    if (type === 'junction') return 'J-';
    if (isInstrumentType(type)) return 'I-';
    return 'OBJ-';
}

function getObjectIconPath(type) {
    const catalogItem = getToolbarItem(type);
    return catalogItem?.icon || 'toolbar/icons/pump.svg';
}

function getObjectPortsHtml(type) {
    if (isInstrumentType(type)) return '';

    if (type === 'tank') {
        return `
            <div class="port inlet" style="top: 50%; left: 6%; transform: translate(-50%, -50%);"></div>
            <div class="port outlet" style="top: 50%; right: 6%; transform: translate(50%, -50%); background: #ff0;"></div>
        `;
    }

    if (type === 'separator') {
        return `
            <div class="port inlet" style="top: 50%; left: 0; transform: translate(-50%, -50%);"></div>
            <div class="port outlet" style="top: 50%; right: 0; transform: translate(50%, -50%); background: #ff0;"></div>
        `;
    }

    if (type === 'verticalVessel') {
        return `
            <div class="port inlet" style="top: 28%; left: 0; transform: translate(-50%, -50%);"></div>
            <div class="port outlet" style="top: 58%; right: 0; transform: translate(50%, -50%); background: #ff0;"></div>
        `;
    }

    if (type === 'mixer') {
        return `
            <div class="port inlet" style="top: 25%; left: -6px;"></div>
            <div class="port inlet" style="top: 75%; left: -6px;"></div>
            <div class="port outlet" style="top: 50%; right: -6px;"></div>
        `;
    }

    if (type === 'source') {
        return `<div class="port outlet" style="top: 50%; right: 5px; transform: translateY(-50%);"></div>`;
    }

    if (type === 'sink') {
        return `<div class="port inlet" style="top: 50%; left: 5px; transform: translateY(-50%);"></div>`;
    }

    if (type === 'junction') {
        return `
            <div class="port inlet" style="top: 50%; left: -5px; transform: translateY(-50%);"></div>
            <div class="port outlet" style="top: 50%; right: -5px; transform: translateY(-50%);"></div>
            <div class="port top"></div>
            <div class="port bottom"></div>
        `;
    }

    return `
        <div class="port inlet" style="top: 50%; left: -5px; transform: translateY(-50%);"></div>
        <div class="port outlet" style="top: 50%; right: -5px; transform: translateY(-50%);"></div>
    `;
}

function getObjectClassName(type) {
    return `${isInstrumentType(type) ? 'pfd-object instrument pfd-instrument' : 'pfd-object equipment'} object-type-${type}`;
}

function getLineMonitorReadoutMarkup() {
    const pressureUnit = typeof getDisplayUnit === 'function' ? getDisplayUnit('pressureAbs') : 'bar a';
    const temperatureUnit = typeof getDisplayUnit === 'function' ? getDisplayUnit('temperature') : 'deg C';
    const flowUnit = typeof getDisplayUnit === 'function' ? getDisplayUnit('flow') : 'm3/h';
    return `
        <div class="line-monitor-readout" aria-label="PTF pipeline readout">
            <table>
                <tbody>
                    <tr>
                        <th scope="row">P</th>
                        <td data-readout-key="pressure">-</td>
                        <td data-readout-unit="pressure">${escapeObjectMarkup(pressureUnit)}</td>
                    </tr>
                    <tr>
                        <th scope="row">T</th>
                        <td data-readout-key="temperature">-</td>
                        <td data-readout-unit="temperature">${escapeObjectMarkup(temperatureUnit)}</td>
                    </tr>
                    <tr>
                        <th scope="row">F</th>
                        <td data-readout-key="flow">-</td>
                        <td data-readout-unit="flow">${escapeObjectMarkup(flowUnit)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
}

function getDefaultDescription(type) {
    const catalogItem = getToolbarItem(type);
    if (catalogItem) return catalogItem.label;
    const words = type.replace(/([A-Z])/g, ' $1').trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
}

function escapeObjectMarkup(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function getObjectMarkup(type, nodeId, desc) {
    const safeNodeId = escapeObjectMarkup(nodeId);
    const safeDesc = escapeObjectMarkup(desc);
    const statusBadge = type === 'pump'
        ? '<div class="pump-status-badge" hidden></div>'
        : '';
    const pumpLivePanel = type === 'pump'
        ? '<div class="pump-live-params" aria-label="Live pump parameters"></div>'
        : '';

    return `
        <div class="object-icon">
            <img class="pfd-icon-img" src="${getObjectIconPath(type)}" alt="">
            ${getObjectPortsHtml(type)}
        </div>
        ${statusBadge}
        <div class="object-name">${safeNodeId}<br><span class="object-desc">${safeDesc}</span></div>
        ${pumpLivePanel}
        ${type === 'lineMonitor' ? getLineMonitorReadoutMarkup() : ''}
    `;
}

function renderToolbarPalette() {
    const palette = document.getElementById('toolbarPalette');
    if (!palette || !window.TOOLBAR_GROUPS) return;

    palette.innerHTML = '';

    window.TOOLBAR_GROUPS.forEach(group => {
        const groupEl = document.createElement('div');
        groupEl.className = 'toolbar-group';

        const title = document.createElement('div');
        title.className = 'toolbar-group-title';
        title.textContent = group.label;
        groupEl.appendChild(title);

        const tools = document.createElement('div');
        tools.className = 'toolbar-tools';

        group.items.forEach(item => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'toolbar-tool';
            btn.title = item.label;
            btn.draggable = false;
            btn.setAttribute('aria-label', `Add ${item.label}`);

            btn.innerHTML = `
                <img class="toolbar-tool-icon" src="${item.icon}" alt="">
                <span>${item.label}</span>
            `;

            btn.addEventListener('click', () => {
                if (btn.dataset.skipNextClick === 'true') {
                    delete btn.dataset.skipNextClick;
                    return;
                }

                if (item.action === 'connect') {
                    activateConnectTool(item.routeStyle || 'Straight');
                } else {
                    addEquipment(item.type, null, { placementMode: 'ribbon-click' });
                }
            });

            if (item.action !== 'connect' && item.type) {
                btn.classList.add('toolbar-tool-draggable');
                attachToolbarDrag(btn, item);
            }

            tools.appendChild(btn);
        });

        groupEl.appendChild(tools);
        palette.appendChild(groupEl);
    });
}
function selectNode(nodeId, element) {
    if (nodeId === 'FLUID' && typeof openFluidBasisTaskWindow === 'function') {
        document.querySelectorAll('.pfd-object').forEach(el => el.classList.remove('selected'));
        currentSelectedNode = null;
        openFluidBasisTaskWindow();
        return;
    }

    // Clear previous selection
    document.querySelectorAll('.pfd-object').forEach(el => el.classList.remove('selected'));
    // Set new selection
    if (element) element.classList.add('selected');
    currentSelectedNode = nodeId;
    renderSidebar(nodeId);
}

function requestUserTaskObjectProperties(nodeId) {
    const node = globalModel?.[nodeId];
    if (!node || node.type === 'fluid') return;

    if (node.type === 'pipe' && typeof requestPipePropertiesTaskWindowOpen === 'function') {
        requestPipePropertiesTaskWindowOpen(nodeId);
    } else if (node.type === 'tank' && typeof requestTankPropertiesTaskWindowOpen === 'function') {
        requestTankPropertiesTaskWindowOpen(nodeId);
    } else if (typeof requestObjectPropertiesTaskWindowOpen === 'function') {
        requestObjectPropertiesTaskWindowOpen(nodeId);
    }

    const element = typeof getObjectElement === 'function' ? getObjectElement(nodeId) : null;
    selectNode(nodeId, element);
}

function createUserTaskObjectPropertiesMenuItem(nodeId) {
    const node = globalModel?.[nodeId];
    if (!node || node.type === 'fluid') return null;

    return {
        label: 'User Task Object Properties',
        action: () => requestUserTaskObjectProperties(nodeId)
    };
}

function addUserTaskObjectPropertiesMenuItem(items, nodeId) {
    const userTaskItem = createUserTaskObjectPropertiesMenuItem(nodeId);
    if (userTaskItem) items.unshift(userTaskItem);
    return items;
}

function getObjectElement(id) {
    return document.getElementById('obj-' + id.toLowerCase().replace(/-/g, ''));
}

function getClientPoint(e) {
    if (e.touches && e.touches.length > 0) return e.touches[0];
    if (e.changedTouches && e.changedTouches.length > 0) return e.changedTouches[0];
    return e;
}

function getCanvasPointFromEvent(e) {
    const point = getClientPoint(e);
    return getCanvasPointFromClient(point.clientX, point.clientY);
}

function getCanvasPointFromClient(clientX, clientY) {
    const canvas = document.getElementById('canvas');
    const canvasRect = canvas.getBoundingClientRect();
    return {
        x: clientX - canvasRect.left + canvas.scrollLeft,
        y: clientY - canvasRect.top + canvas.scrollTop
    };
}

function isPointInsideElement(clientX, clientY, element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return (
        clientX >= rect.left
        && clientX <= rect.right
        && clientY >= rect.top
        && clientY <= rect.bottom
    );
}

function getToolbarPlacementOffset(type) {
    if (isVisualResizableType(type)) {
        const baseSize = VISUAL_OBJECT_BASE_SIZES[type];
        return { x: baseSize.width / 2, y: baseSize.height / 2 };
    }

    if (isInstrumentType(type)) return { x: 18, y: 18 };
    return { x: 28, y: 26 };
}

function getToolbarObjectLayoutSize(type) {
    if (isVisualResizableType(type)) {
        const baseSize = VISUAL_OBJECT_BASE_SIZES[type];
        return { width: baseSize.width, height: baseSize.height };
    }

    if (isInstrumentType(type)) return { width: 38, height: 38 };
    return { width: 56, height: 52 };
}

function getRibbonClickPlacementStep(type) {
    return Math.max(RIBBON_CLICK_MIN_STEP_PX, getToolbarObjectLayoutSize(type).width + RIBBON_CLICK_OBJECT_GAP_PX);
}

function getCanvasObjectElements() {
    const canvas = document.getElementById('canvas');
    if (!canvas) return [];
    return Array.from(canvas.querySelectorAll('.pfd-object'));
}

function getRightmostCanvasObjectPlacement() {
    const objects = getCanvasObjectElements();
    let rightmost = null;

    objects.forEach(element => {
        const left = parseFloat(element.style.left) || 0;
        const top = parseFloat(element.style.top) || 0;
        const width = element.offsetWidth || getToolbarObjectLayoutSize(element.dataset.type).width;
        const height = element.offsetHeight || getToolbarObjectLayoutSize(element.dataset.type).height;
        const right = left + width;

        if (!rightmost || right > rightmost.right) {
            rightmost = {
                right,
                centerY: top + height / 2
            };
        }
    });

    return rightmost;
}

function getRibbonClickCanvasPlacement(type) {
    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();
    const offset = getToolbarPlacementOffset(type);
    const size = getToolbarObjectLayoutSize(type);
    const existingObjects = getCanvasObjectElements();
    let centerX;
    let centerY;

    if (existingObjects.length === 0) {
        centerX = canvas.scrollLeft + rect.width / 2;
        centerY = canvas.scrollTop + rect.height / 2;
    } else if (ribbonClickPlacementState) {
        centerX = ribbonClickPlacementState.nextCenterX;
        centerY = ribbonClickPlacementState.centerY;
    } else {
        const rightmost = getRightmostCanvasObjectPlacement();
        centerX = (rightmost?.right || canvas.scrollLeft + rect.width / 2) + RIBBON_CLICK_OBJECT_GAP_PX + size.width / 2;
        centerY = rightmost?.centerY || canvas.scrollTop + rect.height / 2;
    }

    const placement = normalizeCanvasPlacement({
        left: centerX - offset.x,
        top: centerY - offset.y
    });

    ribbonClickPlacementState = {
        centerY,
        nextCenterX: centerX + getRibbonClickPlacementStep(type)
    };

    return placement;
}

function getDefaultCanvasPlacement(type) {
    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();
    const offset = getToolbarPlacementOffset(type);

    return {
        left: canvas.scrollLeft + rect.width / 2 - offset.x,
        top: canvas.scrollTop + rect.height / 2 - offset.y
    };
}

function getCanvasDropPlacement(e, type) {
    const point = getCanvasPointFromClient(e.clientX, e.clientY);
    const offset = getToolbarPlacementOffset(type);

    return {
        left: point.x - offset.x,
        top: point.y - offset.y
    };
}

function normalizeCanvasPlacement(placement) {
    return {
        left: Math.max(0, parseFloat(placement.left) || 0),
        top: Math.max(0, parseFloat(placement.top) || 0)
    };
}

function minimizeObjectTaskWindowAfterEquipmentAdd(nodeId) {
    const taskWindow = document.getElementById('taskWindow');
    if (!taskWindow || taskWindow.hidden || taskWindow.dataset.nodeId !== nodeId) return;
    if (!['pipe', 'tank', 'object'].includes(taskWindow.dataset.kind)) return;
    if (typeof minimizeTaskWindow === 'function') minimizeTaskWindow();
}

function setToolbarDropActive(active) {
    const canvas = document.getElementById('canvas');
    if (canvas) canvas.classList.toggle('toolbar-drop-active', active);
}

function createToolbarDragGhost(item) {
    const ghost = document.createElement('div');
    ghost.className = 'toolbar-drag-ghost';

    const img = document.createElement('img');
    img.src = item.icon;
    img.alt = '';

    const label = document.createElement('span');
    label.textContent = item.label;

    ghost.append(img, label);
    document.body.appendChild(ghost);
    return ghost;
}

function updateToolbarDragGhost(state, e) {
    if (!state.ghost) return;
    state.ghost.style.left = `${e.clientX + 14}px`;
    state.ghost.style.top = `${e.clientY + 14}px`;
}

function finishToolbarDrag() {
    if (!toolbarDragState) return;

    const { button, pointerId, moveHandler, upHandler, ghost } = toolbarDragState;
    document.removeEventListener('pointermove', moveHandler);
    document.removeEventListener('pointerup', upHandler);
    document.removeEventListener('pointercancel', upHandler);
    button.releasePointerCapture?.(pointerId);
    button.classList.remove('is-dragging');
    document.body.classList.remove('toolbar-dragging');
    setToolbarDropActive(false);

    if (ghost) ghost.remove();
    toolbarDragState = null;
}

function attachToolbarDrag(button, item) {
    button.addEventListener('dragstart', event => event.preventDefault());

    button.addEventListener('pointerdown', event => {
        if (event.button !== undefined && event.button !== 0) return;

        const pointerId = event.pointerId;
        const state = {
            button,
            item,
            pointerId,
            startX: event.clientX,
            startY: event.clientY,
            isDragging: false,
            ghost: null,
            moveHandler: null,
            upHandler: null
        };

        const onMove = moveEvent => {
            if (moveEvent.pointerId !== pointerId) return;

            const dx = moveEvent.clientX - state.startX;
            const dy = moveEvent.clientY - state.startY;

            if (!state.isDragging && Math.hypot(dx, dy) >= TOOLBAR_DRAG_THRESHOLD_PX) {
                state.isDragging = true;
                state.ghost = createToolbarDragGhost(item);
                button.classList.add('is-dragging');
                document.body.classList.add('toolbar-dragging');
            }

            if (state.isDragging) {
                const canvas = document.getElementById('canvas');
                updateToolbarDragGhost(state, moveEvent);
                setToolbarDropActive(isPointInsideElement(moveEvent.clientX, moveEvent.clientY, canvas));
                moveEvent.preventDefault();
            }
        };

        const onEnd = upEvent => {
            if (upEvent.pointerId !== pointerId) return;

            if (state.isDragging) {
                const canvas = document.getElementById('canvas');
                button.dataset.skipNextClick = 'true';
                window.setTimeout(() => {
                    if (button.dataset.skipNextClick === 'true') {
                        delete button.dataset.skipNextClick;
                    }
                }, 0);
                if (isPointInsideElement(upEvent.clientX, upEvent.clientY, canvas)) {
                    addEquipment(item.type, getCanvasDropPlacement(upEvent, item.type));
                }
                upEvent.preventDefault();
            }

            finishToolbarDrag();
        };

        state.moveHandler = onMove;
        state.upHandler = onEnd;
        toolbarDragState = state;

        button.setPointerCapture?.(pointerId);
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onEnd);
        document.addEventListener('pointercancel', onEnd);
    });
}

function isCanvasBackgroundTarget(target) {
    return !!(target && (
        target.id === 'canvas'
        || target.id === 'svg-lines'
        || target.classList?.contains('pfd-lines')
    ));
}

function shouldSourcePortStartSemanticAttachment(source) {
    const type = source?.props?.sourceType || 'Standalone Boundary Source';
    return type === 'Open Tank / Reservoir' || type === 'Pressurized Vessel';
}

function startHydraulicConnectionFromSource(sourceId, e = null) {
    const source = globalModel[sourceId];
    if (!source || source.type !== 'source') return;

    const portSelector = '.port.outlet';
    const startPoint = getPortPosition(sourceId, portSelector) || getObjectCenterPosition(sourceId);
    if (!startPoint) return;

    if (pendingConnectionStart) cancelPendingConnection(false);
    setAppMode('CONNECT');

    const currentPoint = e ? getCanvasPointFromEvent(e) : { x: startPoint.x + 96, y: startPoint.y };
    pendingConnectionStart = {
        kind: 'pipe',
        id: sourceId,
        portSelector,
        routeStyle: nextPipeRouteStyle,
        currentX: currentPoint.x,
        currentY: currentPoint.y
    };

    onCanvasMouseMove = (ev) => {
        const point = getCanvasPointFromEvent(ev);
        pendingConnectionStart.currentX = point.x;
        pendingConnectionStart.currentY = point.y;
        drawConnections();
    };

    document.addEventListener('pointermove', onCanvasMouseMove);
    drawConnections();
}

function makeDraggable(obj) {
    const getDefaultConnectPort = (isStart) => {
        if (isStart) {
            return obj.querySelector('.port.outlet') || obj.querySelector('.port.inlet');
        }
        return obj.querySelector('.port.inlet') || obj.querySelector('.port.outlet');
    };

    obj.addEventListener('dragstart', (e) => e.preventDefault());

    obj.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        if (appMode === 'CONNECT' || e.target.closest('.port')) return;

        const canvas = document.getElementById('canvas');
        const startX = e.clientX;
        const startY = e.clientY;
        const startLeft = parseFloat(obj.style.left) || 0;
        const startTop = parseFloat(obj.style.top) || 0;
        const pointerId = e.pointerId;
        let hasMoved = false;
        let capturedHistory = false;

        selectNode(obj.dataset.id, obj);
        hideContextMenu();
        obj.setPointerCapture?.(pointerId);
        e.preventDefault();

        const moveObject = (ev) => {
            if (ev.pointerId !== pointerId) return;

            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            if (!hasMoved && Math.hypot(dx, dy) < 2) return;

            if (!capturedHistory) {
                captureState();
                capturedHistory = true;
            }

            hasMoved = true;
            obj.style.left = `${Math.max(0, startLeft + dx)}px`;
            obj.style.top = `${Math.max(0, startTop + dy)}px`;
            drawConnections();
            ev.preventDefault();
        };

        const stopDrag = (ev) => {
            if (ev.pointerId !== pointerId) return;
            document.removeEventListener('pointermove', moveObject);
            document.removeEventListener('pointerup', stopDrag);
            document.removeEventListener('pointercancel', stopDrag);
            obj.releasePointerCapture?.(pointerId);

            if (capturedHistory) {
                updateSimulation({ renderSidebarAfter: false });
                if (canvas) {
                    canvas.scrollLeft = Math.max(0, canvas.scrollLeft);
                    canvas.scrollTop = Math.max(0, canvas.scrollTop);
                }
            }
        };

        document.addEventListener('pointermove', moveObject);
        document.addEventListener('pointerup', stopDrag);
        document.addEventListener('pointercancel', stopDrag);
    });

    // Selection
    obj.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (appMode !== 'CONNECT') {
            selectNode(obj.dataset.id, obj);
        }
    });
    
    // Double click for Pump chart
    if (obj.dataset.id.startsWith('P-')) {
        obj.addEventListener('dblclick', async () => {
            if (appMode !== 'CONNECT') {
                activeChartPumpId = obj.dataset.id;
                document.getElementById('fullEditor').style.display = 'flex';
                selectNode(obj.dataset.id, obj);
                updateSimulation();
                try {
                    if (typeof ensurePumpChartReady === 'function') await ensurePumpChartReady();
                    updatePumpChart(activeChartPumpId);
                    if (pumpChartInstance) pumpChartInstance.resize();
                } catch (error) {
                    console.error(error);
                }
            }
        });
    }
    
    // Port Connection Logic
    const ports = obj.querySelectorAll('.port');
    ports.forEach(port => {
        port.addEventListener('mousedown', (e) => {
            if (appMode === 'CONNECT') e.stopPropagation();
        });
        port.addEventListener('click', (e) => {
            if (appMode === 'CONNECT') {
                e.stopPropagation();
                const nodeId = obj.dataset.id;
                const node = globalModel[nodeId];
                if (pendingConnectionStart && pendingConnectionStart.kind === 'instrument') {
                    return;
                }

                if (pendingConnectionStart && pendingConnectionStart.kind === 'source') {
                    if (isSourceAttachTarget(nodeId)) {
                        attachSourceToEquipment(pendingConnectionStart.id, nodeId);
                    }
                    return;
                }

                if (node && node.type === 'source' && shouldSourcePortStartSemanticAttachment(node)) {
                    startSourceAttachment(nodeId, e);
                    return;
                }
                 
                let portClass = '.' + Array.from(port.classList).join('.');
                 
                if (!pendingConnectionStart) {
                    // start
                    const point = getCanvasPointFromEvent(e);
                    pendingConnectionStart = { 
                        kind: 'pipe',
                        id: nodeId, 
                        portSelector: portClass, 
                        routeStyle: nextPipeRouteStyle,
                        currentX: point.x, 
                        currentY: point.y 
                    };
                    
                    onCanvasMouseMove = (ev) => {
                        const currentPoint = getCanvasPointFromEvent(ev);
                        pendingConnectionStart.currentX = currentPoint.x;
                        pendingConnectionStart.currentY = currentPoint.y;
                        drawConnections();
                    };
                    document.addEventListener('pointermove', onCanvasMouseMove);
                    drawConnections();
                } else {
                    // complete
                    if (pendingConnectionStart.id !== nodeId) {
                        document.removeEventListener('pointermove', onCanvasMouseMove);
                        onCanvasMouseMove = null;
                        
                        let pipeNum = 1;
                        while (globalModel['PIPE-' + pipeNum]) pipeNum++;
                        const pipeId = 'PIPE-' + pipeNum;
                        const fromType = globalModel[pendingConnectionStart.id]?.type;
                        const toType = globalModel[nodeId]?.type;
                        const pipeProps = getDefaultProps('pipe');
                        pipeProps.routeStyle = pendingConnectionStart.routeStyle || 'Straight';
                        if (((fromType === 'valve' && toType === 'pump') || (fromType === 'pump' && toType === 'valve')) && pipeProps.routeStyle === 'Straight') {
                            pipeProps.routeStyle = 'Elbow';
                        }
                        
                        captureState();
                        globalModel[pipeId] = { type: "pipe", name: pipeId, desc: "Pipe Line", props: pipeProps };
                        
                        const newConnection = {
                            from: pendingConnectionStart.id,
                            fromPort: pendingConnectionStart.portSelector,
                            to: nodeId,
                            toPort: portClass,
                            pipeId: pipeId,
                            connectionType: 'hydraulic'
                        };
                        connections.push(
                            typeof orientHydraulicConnection === 'function'
                                ? orientHydraulicConnection(newConnection, globalModel)
                                : newConnection
                        );
                        
                        pendingConnectionStart = null;
                        selectNode(pipeId, null);
                        drawConnections();
                        updateSimulation();
                    }
                }
            }
        });
    });

    obj.addEventListener('click', (e) => {
        if (appMode !== 'CONNECT' || e.target.classList.contains('port')) return;
        const nodeId = obj.dataset.id;
        const node = globalModel[nodeId];
        if (pendingConnectionStart && pendingConnectionStart.kind === 'source') {
            e.stopPropagation();
            if (isSourceAttachTarget(nodeId)) {
                attachSourceToEquipment(pendingConnectionStart.id, nodeId);
            }
            return;
        }

        if (node && node.type === 'source' && shouldSourcePortStartSemanticAttachment(node)) {
            e.stopPropagation();
            startSourceAttachment(nodeId, e);
            return;
        }

        if (node && isInstrumentType(node.type)) {
            e.stopPropagation();
            startInstrumentAttachment(nodeId, e);
            return;
        }

        const defaultPort = getDefaultConnectPort(!pendingConnectionStart);
        if (!defaultPort) return;
        e.stopPropagation();
        defaultPort.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            clientX: e.clientX,
            clientY: e.clientY
        }));
    });

    obj.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const nodeId = obj.dataset.id;
        const node = globalModel[nodeId];

        if (node && node.type === 'source') {
            const sourceLink = getSourceLink(nodeId);
            const currentSourceType = node.props?.sourceType || (typeof SOURCE_TYPE_OPEN_TANK !== 'undefined' ? SOURCE_TYPE_OPEN_TANK : 'Open Tank / Reservoir');
            const sourceTypeOptions = typeof SOURCE_TYPE_OPTIONS !== 'undefined'
                ? SOURCE_TYPE_OPTIONS
                : [
                    'Open Tank / Reservoir',
                    'Pressurized Vessel',
                    'External Header / Pipe Tie-in',
                    'Fixed Flow Source',
                    'Standalone Boundary Source'
                ];

            const items = sourceTypeOptions.map(sourceType => ({
                label: sourceType,
                description: typeof getSourceTypeDescription === 'function'
                    ? getSourceTypeDescription(sourceType)
                    : '',
                active: sourceType === currentSourceType,
                action: () => startSourceTypeActionFromContextMenu(nodeId, sourceType, e)
            }));
            addUserTaskObjectPropertiesMenuItem(items, nodeId);

            if (sourceLink) {
                items.push({
                    label: `Detach from ${sourceLink.targetId}`,
                    danger: true,
                    action: () => detachSourceFromEquipment(nodeId)
                });
            }

            items.push({
                label: 'Delete Source',
                danger: true,
                action: () => deleteNode(nodeId)
            });

            showContextMenu(e.clientX, e.clientY, items);
            return;
        }

        if (node && isInstrumentType(node.type)) {
            const items = [
                {
                    label: 'Connect to pipeline',
                    action: () => {
                        setAppMode('CONNECT');
                        startInstrumentAttachment(nodeId, e);
                    }
                }
            ];
            addUserTaskObjectPropertiesMenuItem(items, nodeId);

            if (node.props && node.props.attachedTo) {
                items.push({
                    label: 'Disconnect from pipeline',
                    danger: true,
                    action: () => detachInstrumentFromPipe(nodeId)
                });
            }

            items.push({
                label: 'Delete Instrument',
                danger: true,
                action: () => deleteNode(nodeId)
            });

            showContextMenu(e.clientX, e.clientY, items);
            return;
        }

        if (pendingConnectionStart && pendingConnectionStart.kind === 'source' && isSourceAttachTarget(nodeId)) {
            showContextMenu(e.clientX, e.clientY, addUserTaskObjectPropertiesMenuItem([
                {
                    label: 'Attach source here',
                    action: () => attachSourceToEquipment(pendingConnectionStart.id, nodeId)
                },
                {
                    label: 'Delete Object',
                    danger: true,
                    action: () => deleteNode(nodeId)
                }
            ], nodeId));
            return;
        }

        const defaultPort = getDefaultConnectPort(!pendingConnectionStart);
        if (!defaultPort) return;

        const items = [
            {
                label: pendingConnectionStart ? 'Connect here' : 'Connect',
                action: () => {
                    setAppMode('CONNECT');
                    defaultPort.dispatchEvent(new MouseEvent('click', {
                        bubbles: true,
                        clientX: e.clientX,
                        clientY: e.clientY
                    }));
                }
            },
        ];
        addUserTaskObjectPropertiesMenuItem(items, nodeId);

        const attachedSource = sourceLinks.find(link => link.targetId === nodeId);
        if (attachedSource) {
            items.push({
                label: `Detach ${attachedSource.sourceId}`,
                danger: true,
                action: () => detachSourceFromEquipment(attachedSource.sourceId)
            });
        }

        items.push({
            label: 'Delete Object',
            danger: true,
            action: () => deleteNode(nodeId)
        });

        showContextMenu(e.clientX, e.clientY, items);
    });
}

function startSourceAttachment(sourceId, e = null) {
    const source = globalModel[sourceId];
    if (!source || source.type !== 'source') return;
    if (typeof isSourceTypeSemanticAttachmentCapable === 'function' && !isSourceTypeSemanticAttachmentCapable(source)) return;

    const startPoint = getPortPosition(sourceId, '.port.outlet') || getObjectCenterPosition(sourceId);
    if (!startPoint) return;

    if (pendingConnectionStart) cancelPendingConnection(false);

    const currentPoint = e ? getCanvasPointFromEvent(e) : startPoint;
    pendingConnectionStart = {
        kind: 'source',
        id: sourceId,
        currentX: currentPoint.x,
        currentY: currentPoint.y
    };

    onCanvasMouseMove = (ev) => {
        const point = getCanvasPointFromEvent(ev);
        pendingConnectionStart.currentX = point.x;
        pendingConnectionStart.currentY = point.y;
        drawConnections();
    };

    document.addEventListener('pointermove', onCanvasMouseMove);
    drawConnections();
}

function startInstrumentAttachment(instrumentId, e = null) {
    const instrument = globalModel[instrumentId];
    if (!instrument || !isInstrumentType(instrument.type)) return;

    const startPoint = getObjectCenterPosition(instrumentId);
    if (!startPoint) return;

    if (pendingConnectionStart) cancelPendingConnection(false);

    const currentPoint = e ? getCanvasPointFromEvent(e) : startPoint;
    pendingConnectionStart = {
        kind: 'instrument',
        id: instrumentId,
        currentX: currentPoint.x,
        currentY: currentPoint.y
    };

    onCanvasMouseMove = (ev) => {
        const point = getCanvasPointFromEvent(ev);
        pendingConnectionStart.currentX = point.x;
        pendingConnectionStart.currentY = point.y;
        drawConnections();
    };

    document.addEventListener('pointermove', onCanvasMouseMove);
    drawConnections();
}

function addEquipment(type, placement = null, options = {}) {
    if (typeof ensureBasisConfirmedBeforeModeling === 'function' && !ensureBasisConfirmedBeforeModeling()) {
        return null;
    }
    captureState();

    const prefix = getObjectPrefix(type);
    
    let num = 100;
    while (globalModel[prefix + num] || document.getElementById('obj-' + (prefix + num).toLowerCase())) {
        num++;
    }
    const newId = prefix + num;

    const isInst = isInstrumentType(type);

    const objDiv = document.createElement('div');
    objDiv.className = getObjectClassName(type);
    objDiv.id = 'obj-' + newId.toLowerCase().replace(/-/g, '');
    objDiv.dataset.id = newId;
    objDiv.dataset.type = type;

    const canvas = document.getElementById('canvas');
    const objectPlacement = normalizeCanvasPlacement(
        placement
        || (options.placementMode === 'ribbon-click'
            ? getRibbonClickCanvasPlacement(type)
            : getDefaultCanvasPlacement(type))
    );

    objDiv.style.left = `${objectPlacement.left}px`;
    objDiv.style.top = `${objectPlacement.top}px`;

    canvas.appendChild(objDiv);
    
    // Initialize model
    const props = getDefaultProps(type);
    if (type === 'source') {
        props.temperatureMode = SOURCE_TEMP_MODE_FLUID_BASIS;
        props.temp = getFluidBasisTemperature();
        props.flowInputMode = SOURCE_FLOW_MODE_MASS;
        props.massFlow = SOURCE_DEFAULT_MASS_FLOW_KGH;
        props.flow = calculateSourceVolumetricFlowFromMass(props.massFlow);
    }
    
    const defaultDesc = getDefaultDescription(type);

    const node = {
        type: type,
        name: newId,
        desc: defaultDesc,
        props: props
    };
    const defaultResults = createDefaultResults(type);
    if (defaultResults) node.results = defaultResults;
    globalModel[newId] = node;

    objDiv.innerHTML = getObjectMarkup(type, newId, defaultDesc);

    applyObjectVisuals(newId);
    makeDraggable(objDiv);
    selectNode(newId, objDiv);
    minimizeObjectTaskWindowAfterEquipmentAdd(newId);
    setAppMode('SELECT');
    if (typeof updateSimulation === 'function') {
        updateSimulation({ renderSidebarAfter: false });
    } else if (typeof updateAllObjectOperatingStatusVisuals === 'function') {
        updateAllObjectOperatingStatusVisuals();
    }

    return newId;
}

function initDraggableObjects() {
    document.querySelectorAll('.pfd-object').forEach(makeDraggable);
}
