let taskWindowDragState = null;
let pipePropertiesTaskNodeId = null;
let pipePropertiesTaskDismissedNodeId = null;
let pipePropertiesTaskRequestedNodeId = null;
let tankPropertiesTaskNodeId = null;
let tankPropertiesTaskDismissedNodeId = null;
let tankPropertiesTaskRequestedNodeId = null;
let objectPropertiesTaskNodeId = null;
let objectPropertiesTaskDismissedNodeId = null;
let objectPropertiesTaskRequestedNodeId = null;
let taskWindowLauncherNodeId = null;
let taskWindowLauncherKind = null;
let fluidBasisSetupPrompt = null;
let objectTaskMinimizedEntries = [];

const FLUID_AUTO_NAMES = ['Water', 'Methanol', 'Palm Oil', 'Crude Oil'];

const FLUID_TASK_FIELDS = [
    { key: 'density', label: 'Density', unit: 'kg/m3', digits: 3 },
    { key: 'viscosity', label: 'Kinematic Viscosity', unit: 'cSt', digits: 3 },
    { key: 'vaporPressure', label: 'Vapor Pressure', unit: 'bar a', digits: 6 },
    { key: 'sg', label: 'Specific Gravity', unit: '', digits: 5 },
    { key: 'dynViscosity', label: 'Dynamic Viscosity', unit: 'cP', digits: 3 },
    { key: 'specificHeat', label: 'Specific Heat', unit: 'kJ/kg.K', digits: 3 },
    { key: 'bulkModulus', label: 'Bulk Modulus', unit: 'GPa', digits: 3 },
    { key: 'specVolume', label: 'Specific Volume', unit: 'm3/kg', digits: 8 },
    { key: 'specWeight', label: 'Specific Weight', unit: 'N/m3', digits: 3 },
    { key: 'vaporPressureHead', label: 'Vapor Pressure Head', unit: 'm', digits: 3 },
    { key: 'speedOfSound', label: 'Speed of Sound', unit: 'm/s', digits: 3 }
];

const FLUID_EDITABLE_ADVANCED_KEYS = ['sg', 'dynViscosity', 'vaporPressure', 'specificHeat', 'bulkModulus'];
const FLUID_EDITABLE_BASIC_KEYS = ['density', 'viscosity', 'vaporPressure'];

function initTaskWindow() {
    const taskWindow = document.getElementById('taskWindow');
    const header = document.getElementById('taskWindowHeader');
    const closeButton = document.getElementById('taskWindowClose');
    const minimizeButton = document.getElementById('taskWindowMinimize');
    if (!taskWindow || taskWindow.dataset.initialized === 'true') return;

    closeButton?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeTaskWindow();
    });

    minimizeButton?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isTaskWindowMinimized()) {
            restoreTaskWindow();
        } else {
            minimizeTaskWindow();
        }
    });

    header?.addEventListener('click', (e) => {
        if (!isTaskWindowMinimized() || e.target.closest('button')) return;
        restoreTaskWindow();
    });

    header?.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;
        if (isTaskWindowMinimized()) {
            restoreTaskWindow();
            return;
        }
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
        taskWindow.classList.add('task-window-user-positioned');
        const width = taskWindow.offsetWidth;
        const height = taskWindow.offsetHeight;
        const maxLeft = Math.max(8, window.innerWidth - width - 8);
        const maxTop = Math.max(8, window.innerHeight - height - 8);
        taskWindow.style.left = `${Math.max(8, Math.min(maxLeft, e.clientX - taskWindowDragState.offsetX))}px`;
        taskWindow.style.top = `${Math.max(8, Math.min(maxTop, e.clientY - taskWindowDragState.offsetY))}px`;
        taskWindow.style.right = '';
        taskWindow.style.bottom = '';
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

    document.addEventListener('pointerdown', minimizeTaskWindowOnOutsidePointerDown, true);

    window.addEventListener('resize', clampTaskWindowToViewport);
    window.addEventListener('orientationchange', () => {
        window.setTimeout(clampTaskWindowToViewport, 120);
    });

    taskWindow.dataset.initialized = 'true';
    updateTaskWindowMinimizeButton();
}

function resetTaskWindowPlacement(taskWindow) {
    if (!taskWindow) return;
    taskWindow.classList.remove('task-window-user-positioned');
    taskWindow.style.left = '';
    taskWindow.style.top = '';
    taskWindow.style.right = '';
    taskWindow.style.bottom = '';
    taskWindow.style.transform = '';
}

function clampTaskWindowToViewport() {
    const taskWindow = document.getElementById('taskWindow');
    if (!taskWindow || taskWindow.hidden || isTaskWindowMinimized()) return;
    if (!taskWindow.classList.contains('task-window-user-positioned')) return;

    const width = taskWindow.offsetWidth;
    const height = taskWindow.offsetHeight;
    const rect = taskWindow.getBoundingClientRect();
    const margin = window.innerWidth <= 640 ? 6 : 8;
    const maxLeft = Math.max(margin, window.innerWidth - width - margin);
    const maxTop = Math.max(margin, window.innerHeight - height - margin);
    taskWindow.style.left = `${Math.max(margin, Math.min(maxLeft, rect.left))}px`;
    taskWindow.style.top = `${Math.max(margin, Math.min(maxTop, rect.top))}px`;
    taskWindow.style.right = '';
    taskWindow.style.bottom = '';
}

function isTaskWindowMinimized() {
    const taskWindow = document.getElementById('taskWindow');
    return !!taskWindow?.classList.contains('task-window-minimized');
}

function updateTaskWindowMinimizeButton() {
    const minimizeButton = document.getElementById('taskWindowMinimize');
    if (!minimizeButton) return;
    const minimized = isTaskWindowMinimized();
    minimizeButton.textContent = minimized ? '^' : '_';
    minimizeButton.setAttribute('aria-label', minimized ? 'Restore task window' : 'Minimize task window');
    minimizeButton.title = minimized ? 'Restore' : 'Minimize';
}

function isObjectPropertiesTaskKind(kind) {
    return kind === 'pipe' || kind === 'tank' || kind === 'object';
}

function getObjectTaskDockKey(kind, nodeId) {
    return `${kind}:${nodeId}`;
}

function getObjectTaskNodeIdForKind(kind) {
    if (kind === 'pipe') return pipePropertiesTaskNodeId;
    if (kind === 'tank') return tankPropertiesTaskNodeId;
    if (kind === 'object') return objectPropertiesTaskNodeId;
    return null;
}

function clearObjectTaskNodeIdForKind(kind) {
    if (kind === 'pipe') pipePropertiesTaskNodeId = null;
    if (kind === 'tank') tankPropertiesTaskNodeId = null;
    if (kind === 'object') objectPropertiesTaskNodeId = null;
}

function setObjectTaskDismissed(kind, nodeId) {
    if (!nodeId) return;
    if (kind === 'pipe') pipePropertiesTaskDismissedNodeId = nodeId;
    if (kind === 'tank') tankPropertiesTaskDismissedNodeId = nodeId;
    if (kind === 'object') objectPropertiesTaskDismissedNodeId = nodeId;
}

function getActiveObjectTaskRef() {
    const taskWindow = document.getElementById('taskWindow');
    const kind = taskWindow?.dataset.kind;
    if (!taskWindow || taskWindow.hidden || !isObjectPropertiesTaskKind(kind)) return null;
    const nodeId = taskWindow.dataset.nodeId || getObjectTaskNodeIdForKind(kind);
    if (!nodeId || !globalModel?.[nodeId]) return null;
    return {
        kind,
        nodeId,
        title: document.getElementById('taskWindowTitle')?.textContent || getTaskWindowLauncherLabel(kind, globalModel[nodeId])
    };
}

function getObjectTaskDockLabel(kind, nodeId) {
    const node = globalModel?.[nodeId];
    return node?.name || nodeId;
}

function getObjectTaskDockTitle(kind, nodeId, title = '') {
    const node = globalModel?.[nodeId];
    const label = getObjectTaskDockLabel(kind, nodeId);
    const fullTitle = title || getTaskWindowLauncherLabel(kind, node);
    return `${fullTitle} - ${label}`;
}

function ensureObjectTaskMinimizedDock() {
    let dock = document.getElementById('objectTaskMinimizedDock');
    if (dock) return dock;

    dock = document.createElement('section');
    dock.id = 'objectTaskMinimizedDock';
    dock.className = 'object-task-minimized-dock';
    dock.hidden = true;
    dock.setAttribute('aria-label', 'Minimized object property windows');
    document.body.appendChild(dock);
    return dock;
}

function isObjectTaskDocked(kind, nodeId) {
    return objectTaskMinimizedEntries.some(entry => entry.kind === kind && entry.nodeId === nodeId);
}

function removeObjectTaskDockEntry(kind, nodeId, options = {}) {
    const previousLength = objectTaskMinimizedEntries.length;
    objectTaskMinimizedEntries = objectTaskMinimizedEntries.filter(entry => !(entry.kind === kind && entry.nodeId === nodeId));
    if (options.render !== false && previousLength !== objectTaskMinimizedEntries.length) {
        renderObjectTaskMinimizedDock();
    }
}

function addObjectTaskDockEntry(ref) {
    if (!ref?.kind || !ref?.nodeId || !globalModel?.[ref.nodeId]) return;
    removeObjectTaskDockEntry(ref.kind, ref.nodeId, { render: false });
    objectTaskMinimizedEntries.push({
        kind: ref.kind,
        nodeId: ref.nodeId,
        title: ref.title || getTaskWindowLauncherLabel(ref.kind, globalModel[ref.nodeId])
    });
    renderObjectTaskMinimizedDock();
}

function restoreObjectTaskDockEntry(kind, nodeId) {
    if (!globalModel?.[nodeId]) {
        removeObjectTaskDockEntry(kind, nodeId);
        return;
    }
    removeObjectTaskDockEntry(kind, nodeId, { render: false });
    if (kind === 'pipe') requestPipePropertiesTaskWindowOpen(nodeId);
    if (kind === 'tank') requestTankPropertiesTaskWindowOpen(nodeId);
    if (kind === 'object') requestObjectPropertiesTaskWindowOpen(nodeId);

    const element = typeof getObjectElement === 'function' ? getObjectElement(nodeId) : null;
    if (element && typeof selectNode === 'function') {
        selectNode(nodeId, element);
    } else if (typeof renderSidebar === 'function') {
        renderSidebar(nodeId);
    }
    renderObjectTaskMinimizedDock();
}

function closeObjectTaskDockEntry(kind, nodeId) {
    removeObjectTaskDockEntry(kind, nodeId);
    setObjectTaskDismissed(kind, nodeId);
}

function renderObjectTaskMinimizedDock() {
    const dock = ensureObjectTaskMinimizedDock();
    if (!dock) return;

    objectTaskMinimizedEntries = objectTaskMinimizedEntries.filter(entry => !!globalModel?.[entry.nodeId]);
    dock.replaceChildren();
    dock.hidden = objectTaskMinimizedEntries.length === 0;
    if (dock.hidden) return;

    objectTaskMinimizedEntries.forEach(entry => {
        const item = document.createElement('div');
        item.className = 'object-task-dock-item';
        item.dataset.kind = entry.kind;
        item.dataset.nodeId = entry.nodeId;
        item.title = getObjectTaskDockTitle(entry.kind, entry.nodeId, entry.title);

        const restore = document.createElement('button');
        restore.type = 'button';
        restore.className = 'object-task-dock-restore';
        restore.textContent = getObjectTaskDockLabel(entry.kind, entry.nodeId);
        restore.setAttribute('aria-label', `Restore ${item.title}`);
        restore.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            restoreObjectTaskDockEntry(entry.kind, entry.nodeId);
        });

        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'object-task-dock-close';
        close.textContent = 'X';
        close.setAttribute('aria-label', `Close ${item.title}`);
        close.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            closeObjectTaskDockEntry(entry.kind, entry.nodeId);
        });

        item.append(restore, close);
        dock.appendChild(item);
    });
}

function clearObjectTaskMinimizedDock() {
    objectTaskMinimizedEntries = [];
    renderObjectTaskMinimizedDock();
}

function setTaskWindowMinimized(minimized) {
    const taskWindow = document.getElementById('taskWindow');
    if (!taskWindow) return;
    taskWindow.classList.toggle('task-window-minimized', minimized);
    taskWindow.setAttribute('aria-expanded', minimized ? 'false' : 'true');
    updateTaskWindowMinimizeButton();
}

function minimizeTaskWindow() {
    const taskWindow = document.getElementById('taskWindow');
    if (!taskWindow || taskWindow.hidden) return;
    taskWindowDragState = null;
    const activeObjectTask = getActiveObjectTaskRef();
    if (activeObjectTask) {
        addObjectTaskDockEntry(activeObjectTask);
        taskWindow.hidden = true;
        taskWindow.classList.remove('task-window-fluid-active', 'task-window-pipe-active', 'task-window-tank-active', 'task-window-object-active', 'task-window-minimized');
        delete taskWindow.dataset.kind;
        delete taskWindow.dataset.nodeId;
        taskWindow.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('pipe-properties-task-open', 'tank-properties-task-open', 'object-properties-task-open');
        clearObjectTaskNodeIdForKind(activeObjectTask.kind);
        updateTaskWindowMinimizeButton();
        return;
    }
    setTaskWindowMinimized(true);
}

function restoreTaskWindow() {
    const taskWindow = document.getElementById('taskWindow');
    if (!taskWindow) return;
    taskWindow.hidden = false;
    setTaskWindowMinimized(false);
}

function ensureTaskWindowLauncher() {
    let launcher = document.getElementById('taskWindowLauncher');
    if (launcher) return launcher;

    launcher = document.createElement('button');
    launcher.type = 'button';
    launcher.id = 'taskWindowLauncher';
    launcher.className = 'task-window-launcher';
    launcher.hidden = true;
    launcher.setAttribute('aria-label', 'Show properties task window');

    const title = document.createElement('span');
    title.className = 'task-window-launcher-title';
    const meta = document.createElement('span');
    meta.className = 'task-window-launcher-meta';
    launcher.append(title, meta);

    launcher.addEventListener('click', () => {
        const nodeId = launcher.dataset.nodeId || taskWindowLauncherNodeId;
        const kind = launcher.dataset.kind || taskWindowLauncherKind;
        if (!nodeId || !kind) return;

        if (kind === 'pipe' && typeof requestPipePropertiesTaskWindowOpen === 'function') {
            requestPipePropertiesTaskWindowOpen(nodeId);
        } else if (kind === 'tank' && typeof requestTankPropertiesTaskWindowOpen === 'function') {
            requestTankPropertiesTaskWindowOpen(nodeId);
        } else if (kind === 'object' && typeof requestObjectPropertiesTaskWindowOpen === 'function') {
            requestObjectPropertiesTaskWindowOpen(nodeId);
        }

        if (typeof renderSidebar === 'function') renderSidebar(nodeId);
    });

    document.body.appendChild(launcher);
    return launcher;
}

function getTaskWindowLauncherLabel(kind, node) {
    if (kind === 'pipe') return 'Pipe Object Properties';
    if (kind === 'tank') return 'Tank Object Properties';
    if (kind === 'object') return getObjectPropertiesTaskLabel(node);
    return 'Object Properties';
}

function showTaskWindowLauncher(kind, nodeId) {
    const node = globalModel?.[nodeId];
    if (!node) return;

    const launcher = ensureTaskWindowLauncher();
    if (!launcher) return;

    const label = getTaskWindowLauncherLabel(kind, node);
    taskWindowLauncherKind = kind;
    taskWindowLauncherNodeId = nodeId;
    launcher.dataset.kind = kind;
    launcher.dataset.nodeId = nodeId;
    launcher.querySelector('.task-window-launcher-title').textContent = `Show ${label}`;
    launcher.querySelector('.task-window-launcher-meta').textContent = node.name || nodeId;
    launcher.setAttribute('aria-label', `Show ${label} for ${node.name || nodeId}`);
    launcher.hidden = false;
}

function hideTaskWindowLauncher(kind = null, nodeId = null) {
    const launcher = document.getElementById('taskWindowLauncher');
    if (!launcher) return;
    if (kind && launcher.dataset.kind !== kind) return;
    if (nodeId && launcher.dataset.nodeId !== nodeId) return;

    launcher.hidden = true;
    delete launcher.dataset.kind;
    delete launcher.dataset.nodeId;
    taskWindowLauncherKind = null;
    taskWindowLauncherNodeId = null;
}

function openTaskWindow(title, content, options = {}) {
    const taskWindow = document.getElementById('taskWindow');
    const taskTitle = document.getElementById('taskWindowTitle');
    const taskBody = document.getElementById('taskWindowBody');
    if (!taskWindow || !taskTitle || !taskBody) return;

    initTaskWindow();
    hideTaskWindowLauncher();
    const shouldPreserveMinimized = options.preserveMinimized === true && isTaskWindowMinimized();
    taskTitle.textContent = title;
    taskBody.replaceChildren();
    taskBody.className = `task-window-body${options.bodyClass ? ` ${options.bodyClass}` : ''}`;
    if (options.resetScroll) {
        taskBody.scrollTop = 0;
        taskBody.scrollLeft = 0;
    }

    if (content instanceof Node) {
        taskBody.appendChild(content);
    } else if (typeof content === 'string') {
        taskBody.innerHTML = content;
    }

    taskWindow.hidden = false;
    taskWindow.dataset.kind = options.kind || '';
    if (options.nodeId) {
        taskWindow.dataset.nodeId = options.nodeId;
    } else {
        delete taskWindow.dataset.nodeId;
    }
    if (isObjectPropertiesTaskKind(options.kind) && options.nodeId) {
        removeObjectTaskDockEntry(options.kind, options.nodeId);
    }
    taskWindow.classList.toggle('task-window-fluid-active', options.kind === 'fluid');
    taskWindow.classList.toggle('task-window-pipe-active', options.kind === 'pipe');
    taskWindow.classList.toggle('task-window-tank-active', options.kind === 'tank');
    taskWindow.classList.toggle('task-window-object-active', options.kind === 'object');
    document.body.classList.toggle('pipe-properties-task-open', options.kind === 'pipe');
    document.body.classList.toggle('tank-properties-task-open', options.kind === 'tank');
    document.body.classList.toggle('object-properties-task-open', options.kind === 'object');
    if (options.kind !== 'fluid') closeTabletFluidBottomDock();
    setTaskWindowMinimized(shouldPreserveMinimized);
    if (options.resetPosition && !shouldPreserveMinimized) {
        resetTaskWindowPlacement(taskWindow);
    }
}

function closeTaskWindow(options = {}) {
    const taskWindow = document.getElementById('taskWindow');
    let dismissedPipeId = null;
    let dismissedTankId = null;
    let dismissedObjectId = null;
    if (taskWindow) {
        const closingKind = taskWindow.dataset.kind;
        if (closingKind === 'pipe' && options.markDismissed !== false) {
            dismissedPipeId = pipePropertiesTaskNodeId || currentSelectedNode || null;
            pipePropertiesTaskDismissedNodeId = dismissedPipeId;
        }
        if (closingKind === 'tank' && options.markDismissed !== false) {
            dismissedTankId = tankPropertiesTaskNodeId || currentSelectedNode || null;
            tankPropertiesTaskDismissedNodeId = dismissedTankId;
        }
        if (closingKind === 'object' && options.markDismissed !== false) {
            dismissedObjectId = objectPropertiesTaskNodeId || currentSelectedNode || null;
            objectPropertiesTaskDismissedNodeId = dismissedObjectId;
        }
        taskWindow.hidden = true;
        taskWindow.classList.remove('task-window-fluid-active', 'task-window-pipe-active', 'task-window-tank-active', 'task-window-object-active', 'task-window-minimized');
        delete taskWindow.dataset.kind;
        delete taskWindow.dataset.nodeId;
        updateTaskWindowMinimizeButton();
    }
    document.body.classList.remove('pipe-properties-task-open', 'tank-properties-task-open', 'object-properties-task-open');
    pipePropertiesTaskNodeId = null;
    tankPropertiesTaskNodeId = null;
    objectPropertiesTaskNodeId = null;
    closeTabletFluidBottomDock();
    if (dismissedPipeId && typeof showPipePropertiesTaskNotice === 'function') {
        showPipePropertiesTaskNotice(dismissedPipeId);
    }
    if (dismissedTankId && typeof showTankPropertiesTaskNotice === 'function') {
        showTankPropertiesTaskNotice(dismissedTankId);
    }
    if (dismissedObjectId && typeof showObjectPropertiesTaskNotice === 'function') {
        showObjectPropertiesTaskNotice(dismissedObjectId);
    }
}

function closePipePropertiesTaskWindow() {
    const taskWindow = document.getElementById('taskWindow');
    if (taskWindow?.dataset.kind === 'pipe') closeTaskWindow({ markDismissed: false });
}

function closeTankPropertiesTaskWindow() {
    const taskWindow = document.getElementById('taskWindow');
    if (taskWindow?.dataset.kind === 'tank') closeTaskWindow({ markDismissed: false });
}

function closeObjectPropertiesTaskWindow() {
    const taskWindow = document.getElementById('taskWindow');
    if (taskWindow?.dataset.kind === 'object') closeTaskWindow({ markDismissed: false });
}

function closeFluidBasisTaskWindow() {
    const taskWindow = document.getElementById('taskWindow');
    if (taskWindow?.dataset.kind === 'fluid') {
        closeTaskWindow({ markDismissed: false });
        return;
    }
    closeTabletFluidBottomDock();
}

function requestPipePropertiesTaskWindowOpen(nodeId) {
    pipePropertiesTaskRequestedNodeId = nodeId || null;
    if (nodeId && pipePropertiesTaskDismissedNodeId === nodeId) {
        pipePropertiesTaskDismissedNodeId = null;
    }
}

function isPipePropertiesTaskDismissed(nodeId) {
    if (nodeId && pipePropertiesTaskRequestedNodeId === nodeId) return false;
    return !!(nodeId && (pipePropertiesTaskDismissedNodeId === nodeId || isObjectTaskDocked('pipe', nodeId)));
}

function isTaskWindowOutsidePointerTarget(target, taskWindow) {
    if (!target || !taskWindow) return false;
    if (taskWindow.contains(target)) return false;
    if (target.closest?.('#taskWindowLauncher')) return false;
    return true;
}

function minimizeTaskWindowOnOutsidePointerDown(event) {
    const taskWindow = document.getElementById('taskWindow');
    if (!taskWindow || taskWindow.hidden) return;
    if (isTaskWindowMinimized()) return;
    if (!isTaskWindowOutsidePointerTarget(event.target, taskWindow)) return;

    minimizeTaskWindow();
}

function createPipePropertiesTaskRoot(nodeId) {
    const root = document.createElement('div');
    root.className = 'pipe-properties-task';
    root.dataset.pipeNode = nodeId;

    const table = document.createElement('table');
    table.className = 'prop-table pipe-task-prop-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const headerCell = document.createElement('th');
    headerCell.colSpan = 2;
    headerCell.id = 'pipeTaskPropTableHeader';
    headerCell.textContent = 'Pipe Object Properties';
    headerRow.appendChild(headerCell);
    thead.appendChild(headerRow);

    const tbody = document.createElement('tbody');
    tbody.id = 'pipeTaskPropTableBody';

    table.append(thead, tbody);
    root.appendChild(table);
    return root;
}

function openPipePropertiesTaskWindow(nodeId) {
    const node = globalModel?.[nodeId];
    if (!node || node.type !== 'pipe') return false;

    const taskWindow = document.getElementById('taskWindow');
    const previousPipeTaskNodeId = pipePropertiesTaskNodeId;
    const wasPipeTask = taskWindow?.dataset.kind === 'pipe';
    const preserveMinimized = wasPipeTask && previousPipeTaskNodeId === nodeId && isTaskWindowMinimized();
    const requestedOpen = pipePropertiesTaskRequestedNodeId === nodeId;
    pipePropertiesTaskRequestedNodeId = null;
    if (pipePropertiesTaskDismissedNodeId === nodeId && !requestedOpen) return false;

    pipePropertiesTaskDismissedNodeId = null;
    pipePropertiesTaskNodeId = nodeId;
    openTaskWindow(
        'Pipe Object Properties',
        createPipePropertiesTaskRoot(nodeId),
        {
            kind: 'pipe',
            nodeId,
            bodyClass: 'pipe-properties-task-body',
            preserveMinimized,
            resetPosition: !wasPipeTask,
            resetScroll: !wasPipeTask || previousPipeTaskNodeId !== nodeId
        }
    );
    return true;
}

function getPipePropertiesTaskTargets() {
    const header = document.getElementById('pipeTaskPropTableHeader');
    const body = document.getElementById('pipeTaskPropTableBody');
    if (!header || !body) return null;
    return { header, body };
}

function showPipePropertiesTaskNotice(nodeId) {
    const node = globalModel?.[nodeId];
    if (!node) return;
    const dismissed = isPipePropertiesTaskDismissed(nodeId);

    if (isObjectTaskDocked('pipe', nodeId)) {
        hideTaskWindowLauncher('pipe', nodeId);
        return;
    }
    if (dismissed) {
        showTaskWindowLauncher('pipe', nodeId);
    } else {
        hideTaskWindowLauncher('pipe', nodeId);
    }
}

function requestTankPropertiesTaskWindowOpen(nodeId) {
    tankPropertiesTaskRequestedNodeId = nodeId || null;
    if (nodeId && tankPropertiesTaskDismissedNodeId === nodeId) {
        tankPropertiesTaskDismissedNodeId = null;
    }
}

function isTankPropertiesTaskDismissed(nodeId) {
    if (nodeId && tankPropertiesTaskRequestedNodeId === nodeId) return false;
    return !!(nodeId && (tankPropertiesTaskDismissedNodeId === nodeId || isObjectTaskDocked('tank', nodeId)));
}

function createTankPropertiesTaskRoot(nodeId) {
    const root = document.createElement('div');
    root.className = 'pipe-properties-task tank-properties-task';
    root.dataset.tankNode = nodeId;

    const table = document.createElement('table');
    table.className = 'prop-table pipe-task-prop-table tank-task-prop-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const headerCell = document.createElement('th');
    headerCell.colSpan = 2;
    headerCell.id = 'tankTaskPropTableHeader';
    headerCell.textContent = 'Tank Object Properties';
    headerRow.appendChild(headerCell);
    thead.appendChild(headerRow);

    const tbody = document.createElement('tbody');
    tbody.id = 'tankTaskPropTableBody';

    table.append(thead, tbody);
    root.appendChild(table);
    return root;
}

function openTankPropertiesTaskWindow(nodeId) {
    const node = globalModel?.[nodeId];
    if (!node || node.type !== 'tank') return false;

    const taskWindow = document.getElementById('taskWindow');
    const previousTankTaskNodeId = tankPropertiesTaskNodeId;
    const wasTankTask = taskWindow?.dataset.kind === 'tank';
    const preserveMinimized = wasTankTask && previousTankTaskNodeId === nodeId && isTaskWindowMinimized();
    const requestedOpen = tankPropertiesTaskRequestedNodeId === nodeId;
    tankPropertiesTaskRequestedNodeId = null;
    if (tankPropertiesTaskDismissedNodeId === nodeId && !requestedOpen) return false;

    tankPropertiesTaskDismissedNodeId = null;
    tankPropertiesTaskNodeId = nodeId;
    openTaskWindow(
        'Tank Object Properties',
        createTankPropertiesTaskRoot(nodeId),
        {
            kind: 'tank',
            nodeId,
            bodyClass: 'pipe-properties-task-body tank-properties-task-body',
            preserveMinimized,
            resetPosition: !wasTankTask,
            resetScroll: !wasTankTask || previousTankTaskNodeId !== nodeId
        }
    );
    return true;
}

function getTankPropertiesTaskTargets() {
    const header = document.getElementById('tankTaskPropTableHeader');
    const body = document.getElementById('tankTaskPropTableBody');
    if (!header || !body) return null;
    return { header, body };
}

function showTankPropertiesTaskNotice(nodeId) {
    const node = globalModel?.[nodeId];
    if (!node) return;
    const dismissed = isTankPropertiesTaskDismissed(nodeId);

    if (isObjectTaskDocked('tank', nodeId)) {
        hideTaskWindowLauncher('tank', nodeId);
        return;
    }
    if (dismissed) {
        showTaskWindowLauncher('tank', nodeId);
    } else {
        hideTaskWindowLauncher('tank', nodeId);
    }
}

function getObjectPropertiesTaskLabel(node) {
    if (!node) return 'Object';
    if (node.type === 'valve' && String(node.props?.valveType || '').toLowerCase().includes('control valve')) {
        return 'Control Valve Object Properties';
    }
    const labels = {
        pump: 'Pump Object Properties',
        source: 'Source Object Properties',
        sink: 'Sink Object Properties',
        valve: 'Valve Object Properties',
        checkValve: 'Check Valve Object Properties',
        separator: 'Separator Object Properties',
        horizontalVessel: 'Horizontal Vessel Object Properties',
        verticalVessel: 'Vertical Vessel Object Properties',
        heatExchanger: 'Heat Exchanger Object Properties',
        mixer: 'Mixer Object Properties',
        instrument: 'Instrument Object Properties',
        lineMonitor: 'Line Monitor Object Properties',
        levelController: 'Level Controller Object Properties',
        networkNode: 'Network Node Object Properties'
    };
    return labels[node.type] || 'Object Properties';
}

function requestObjectPropertiesTaskWindowOpen(nodeId) {
    objectPropertiesTaskRequestedNodeId = nodeId || null;
    if (nodeId && objectPropertiesTaskDismissedNodeId === nodeId) {
        objectPropertiesTaskDismissedNodeId = null;
    }
}

function isObjectPropertiesTaskDismissed(nodeId) {
    if (nodeId && objectPropertiesTaskRequestedNodeId === nodeId) return false;
    return !!(nodeId && (objectPropertiesTaskDismissedNodeId === nodeId || isObjectTaskDocked('object', nodeId)));
}

function createObjectPropertiesTaskRoot(nodeId) {
    const root = document.createElement('div');
    root.className = 'pipe-properties-task object-properties-task';
    root.dataset.objectNode = nodeId;

    const table = document.createElement('table');
    table.className = 'prop-table pipe-task-prop-table object-task-prop-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const headerCell = document.createElement('th');
    headerCell.colSpan = 2;
    headerCell.id = 'objectTaskPropTableHeader';
    headerCell.textContent = 'Object Properties';
    headerRow.appendChild(headerCell);
    thead.appendChild(headerRow);

    const tbody = document.createElement('tbody');
    tbody.id = 'objectTaskPropTableBody';

    table.append(thead, tbody);
    root.appendChild(table);
    return root;
}

function openObjectPropertiesTaskWindow(nodeId) {
    const node = globalModel?.[nodeId];
    if (!node || ['pipe', 'tank', 'fluid'].includes(node.type)) return false;

    const taskWindow = document.getElementById('taskWindow');
    const previousObjectTaskNodeId = objectPropertiesTaskNodeId;
    const wasObjectTask = taskWindow?.dataset.kind === 'object';
    const preserveMinimized = wasObjectTask && previousObjectTaskNodeId === nodeId && isTaskWindowMinimized();
    const requestedOpen = objectPropertiesTaskRequestedNodeId === nodeId;
    objectPropertiesTaskRequestedNodeId = null;
    if (objectPropertiesTaskDismissedNodeId === nodeId && !requestedOpen) return false;

    objectPropertiesTaskDismissedNodeId = null;
    objectPropertiesTaskNodeId = nodeId;
    const label = getObjectPropertiesTaskLabel(node);
    openTaskWindow(
        label,
        createObjectPropertiesTaskRoot(nodeId),
        {
            kind: 'object',
            nodeId,
            bodyClass: 'pipe-properties-task-body object-properties-task-body',
            preserveMinimized,
            resetPosition: !wasObjectTask,
            resetScroll: !wasObjectTask || previousObjectTaskNodeId !== nodeId
        }
    );
    return true;
}

function getObjectPropertiesTaskTargets() {
    const header = document.getElementById('objectTaskPropTableHeader');
    const body = document.getElementById('objectTaskPropTableBody');
    if (!header || !body) return null;
    return { header, body };
}

function showObjectPropertiesTaskNotice(nodeId) {
    const node = globalModel?.[nodeId];
    if (!node) return;
    const dismissed = isObjectPropertiesTaskDismissed(nodeId);

    if (isObjectTaskDocked('object', nodeId)) {
        hideTaskWindowLauncher('object', nodeId);
        return;
    }
    if (dismissed) {
        showTaskWindowLauncher('object', nodeId);
    } else {
        hideTaskWindowLauncher('object', nodeId);
    }
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

function getFluidDisplayMeta(key, label = '', unit = '') {
    if (typeof getDisplayFieldMeta !== 'function') {
        return { quantity: null, unit, pressureBasis: '' };
    }
    return getDisplayFieldMeta('fluid', key, label, unit);
}

function getFluidDisplayValue(key, value, field = {}) {
    const meta = getFluidDisplayMeta(key, field.label || key, field.unit || '');
    return meta.quantity ? convertToDisplay(value, meta.quantity) : value;
}

function getFluidInternalInputValue(key, value, field = {}) {
    const meta = getFluidDisplayMeta(key, field.label || key, field.unit || '');
    return meta.quantity ? convertFromDisplay(value, meta.quantity) : value;
}

function getFluidDisplayUnit(key, field = {}) {
    return getFluidDisplayMeta(key, field.label || key, field.unit || '').unit || field.unit || '';
}

function formatFluidTaskFieldValue(key, value, field = {}) {
    const displayValue = getFluidDisplayValue(key, value, field);
    const unit = getFluidDisplayUnit(key, field);
    return formatFluidTaskValue(displayValue, unit, field.digits ?? 3);
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
    const isBasic = props.inputMode !== 'Advanced';

    if (changedKey === 'sg') {
        props.density = parseFloat(props.sg) * densityRef;
    } else if (changedKey === 'density' && Number.isFinite(density)) {
        props.sg = density / densityRef;
    }

    const updatedDensity = parseFloat(props.density);
    if (Number.isFinite(updatedDensity) && updatedDensity > 0) {
        if (isBasic) {
            if (Number.isFinite(kinematicViscosity)) {
                props.dynViscosity = kinematicViscosity * (updatedDensity / 1000);
            }
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
    if (typeof markBasisDirty === 'function') {
        markBasisDirty(`${changedKey || 'Fluid Basis'} changed.`);
    }

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
    const row = document.createElement(editable ? 'label' : 'div');
    row.className = 'fluid-field-row';
    row.dataset.fieldKey = field.key;

    const label = document.createElement('span');
    label.className = 'fluid-field-label';
    label.textContent = field.label;

    const controlWrap = document.createElement('span');
    controlWrap.className = 'fluid-field-control';
    const displayValue = getFluidDisplayValue(field.key, value, field);
    const displayUnit = getFluidDisplayUnit(field.key, field);
    const meta = getFluidDisplayMeta(field.key, field.label, field.unit);

    if (editable) {
        const input = document.createElement('input');
        input.type = 'number';
        input.step = 'any';
        input.className = 'fluid-task-input';
        input.value = Number.isFinite(parseFloat(displayValue)) ? displayValue : '';
        input.dataset.fluidControl = field.key;
        input.dataset.quantity = meta.quantity || '';
        input.dataset.baseUnit = field.unit || '';
        controlWrap.appendChild(input);
    } else {
        const output = document.createElement('strong');
        output.className = 'fluid-task-readout';
        output.dataset.fluidValue = field.key;
        output.textContent = formatFluidTaskFieldValue(field.key, value, field);
        output.title = Number.isFinite(parseFloat(value)) ? String(value) : '';
        controlWrap.appendChild(output);
    }

    if (displayUnit && editable) {
        const unit = document.createElement('span');
        unit.className = 'fluid-field-unit';
        unit.textContent = displayUnit;
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
    const field = { key: 'temp', label: 'Temperature', unit: 'deg C', digits: 3 };
    const displayValue = getFluidDisplayValue('temp', value, field);
    input.value = Number.isFinite(parseFloat(displayValue)) ? displayValue : '';
    input.dataset.fluidControl = 'temp';
    input.dataset.quantity = 'temperature';
    input.dataset.baseUnit = 'deg C';

    const unit = document.createElement('span');
    unit.className = 'fluid-field-unit';
    unit.textContent = getFluidDisplayUnit('temp', field);

    control.append(input, unit);
    row.append(label, control);
    return row;
}

function createBasisSetupNotice() {
    const settings = typeof getSimulationSettings === 'function' ? getSimulationSettings() : null;
    const shouldShow = fluidBasisSetupPrompt || !settings?.basisConfirmed || settings?.basisDirty;
    if (!shouldShow) return null;

    const notice = document.createElement('div');
    notice.className = `fluid-basis-setup-notice${settings?.basisDirty ? ' fluid-basis-setup-dirty' : ''}`;
    const title = document.createElement('strong');
    title.textContent = settings?.basisDirty ? 'Basis changed after confirmation' : 'Set calculation basis first';
    const text = document.createElement('span');
    text.textContent = fluidBasisSetupPrompt
        || settings?.dirtyReason
        || 'Choose Fluid Basis and Unit Standard before adding or evaluating objects.';
    notice.append(title, text);
    return notice;
}

function createBasisApplyBar() {
    const bar = document.createElement('div');
    bar.className = 'fluid-basis-apply-bar';
    const status = document.createElement('span');
    const settings = typeof getSimulationSettings === 'function' ? getSimulationSettings() : null;
    status.textContent = settings?.basisConfirmed && !settings?.basisDirty
        ? 'Basis is confirmed for the current simulation.'
        : 'Confirm this basis to start or continue modeling.';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'fluid-basis-apply-btn';
    button.dataset.fluidAction = 'confirm-basis';
    button.textContent = 'Apply Basis / Start Modeling';
    bar.append(status, button);
    return bar;
}

function createFluidInputCard(fluidNode, trace) {
    const props = fluidNode.props;
    const isAuto = isFluidAuto(props.fluidName);
    const card = document.createElement('section');
    card.className = 'fluid-input-card';

    const heading = document.createElement('h3');
    heading.textContent = 'Input Basis';
    card.appendChild(heading);
    const setupNotice = createBasisSetupNotice();
    if (setupNotice) card.appendChild(setupNotice);

    const fields = document.createElement('div');
    fields.className = 'fluid-field-list';

    if (typeof UNIT_STANDARD_OPTIONS !== 'undefined' && typeof getUnitStandard === 'function') {
        fields.appendChild(createFluidSelectRow('Unit Standard', 'unitStandard', getUnitStandard(), UNIT_STANDARD_OPTIONS.map(option => ({
            value: option,
            label: option
        }))));
    }
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

    card.append(fields, method, createBasisApplyBar());
    return card;
}

function createMetricCard(label, value, unit, digits, key) {
    const item = document.createElement('div');
    item.className = 'fluid-metric';
    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    const valueEl = document.createElement('strong');
    valueEl.dataset.fluidMetric = key;
    const field = getFluidFieldDefinition(key);
    const displayField = key === 'temp'
        ? { key: 'temp', label: 'Temperature', unit: 'deg C', digits }
        : { ...field, label, unit, digits };
    valueEl.textContent = formatFluidTaskFieldValue(key, value, displayField);
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
        result.textContent = typeof formatDisplayUnitValueByUnit === 'function'
            ? formatDisplayUnitValueByUnit(step.result, step.unit || '', step.digits ?? 3, step.title || '', step.title || '')
            : formatFluidTaskValue(step.result, step.unit || '', step.digits ?? 3);
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
        el.textContent = formatFluidTaskFieldValue(key, value, field);
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
    if (key === 'unitStandard') {
        captureTaskWindowEdit(target);
        if (typeof setUnitStandard === 'function') setUnitStandard(target.value);
        renderFluidBasisTaskWindow();
        return;
    }

    const isTextValue = key === 'fluidName' || key === 'inputMode';
    const rawNumber = parseFloat(target.value);
    const field = getFluidFieldDefinition(key);
    const quantity = target.dataset.quantity || '';
    const value = isTextValue
        ? target.value
        : (quantity && typeof convertFromDisplay === 'function'
            ? convertFromDisplay(rawNumber, quantity)
            : getFluidInternalInputValue(key, rawNumber, field));
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

function handleFluidTaskAction(e) {
    const actionTarget = e.target.closest('[data-fluid-action]');
    if (!actionTarget) return;
    if (actionTarget.dataset.fluidAction === 'confirm-basis') {
        e.preventDefault();
        if (typeof confirmBasisSetup === 'function') confirmBasisSetup();
        fluidBasisSetupPrompt = null;
        closeFluidBasisTaskWindow();
    }
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
    root.addEventListener('click', handleFluidTaskAction);
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

function openFluidBasisTaskWindow(options = {}) {
    if (!globalModel.FLUID) return;
    globalModel.FLUID.name = 'Fluid Basis';
    fluidBasisSetupPrompt = options.reason || null;
    renderFluidBasisTaskWindow();
}

function ensureBasisConfirmedBeforeModeling(message) {
    if (typeof isBasisConfirmed === 'function' && isBasisConfirmed()) return true;
    openFluidBasisTaskWindow({
        setupRequired: true,
        reason: message || 'Set Fluid Basis and Unit Standard before adding equipment.'
    });
    return false;
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

function createSrcHelpTextBlock(paragraphs = []) {
    const wrap = document.createElement('div');
    wrap.className = 'src-help-text';
    paragraphs.forEach(text => {
        const p = document.createElement('p');
        p.textContent = text;
        wrap.appendChild(p);
    });
    return wrap;
}

function createSrcHelpSection(title, content, open = false) {
    const section = document.createElement('details');
    section.className = 'fluid-help-card src-help-section';
    section.open = open;
    const summary = document.createElement('summary');
    summary.textContent = title;
    section.appendChild(summary);
    if (content instanceof Node) {
        section.appendChild(content);
    }
    return section;
}

function createSrcDecisionMatrix(rows = []) {
    const labels = ['SRC Type', 'Pressure & Elevation', 'Flow Basis', 'Connection', 'Use Case'];
    const matrix = document.createElement('div');
    matrix.className = 'src-decision-matrix';

    const header = document.createElement('div');
    header.className = 'src-decision-header';
    labels.forEach(label => {
        const cell = document.createElement('div');
        cell.textContent = label;
        header.appendChild(cell);
    });
    matrix.appendChild(header);

    rows.forEach(row => {
        const rowEl = document.createElement('div');
        rowEl.className = 'src-decision-row';
        row.forEach((value, index) => {
            const cell = document.createElement('div');
            cell.className = 'src-decision-cell';
            cell.dataset.label = labels[index];
            cell.textContent = value;
            rowEl.appendChild(cell);
        });
        matrix.appendChild(rowEl);
    });

    return matrix;
}

function createSrcHelpContent() {
    const root = document.createElement('div');
    root.className = 'fluid-help-layout src-help-layout';

    root.append(
        createFluidHelpCard('Fundamental SRC Boundary Concept', createSrcHelpTextBlock([
            'SRC represents the upstream source boundary for the pump suction network. It supplies the hydraulic datum used by the solver: pressure energy, elevation head, and, when specified, flow rate.',
            'The NPSH calculation does not depend on the source type name alone. The controlling inputs are Source Type, Boundary Data Source, and whether the connection is a semantic dashed attachment or a solid hydraulic path.',
            'Open Tank / Reservoir and Pressurized Vessel are semantic equipment-boundary cases. They may inherit pressure and liquid surface elevation from attached equipment. External Header, Fixed Flow Source, and Standalone Boundary Source are direct hydraulic boundary cases and use SRC-entered boundary data.'
        ])),
        createFluidHelpCard('NPSH Data Selection Matrix', createSrcDecisionMatrix([
            [
                'Open Tank / Reservoir',
                'With Boundary Data Source = Inherit, pressure is taken from the tank and elevation is tank base elevation plus liquid level. With Manual, pressure and elevation are taken from the SRC.',
                'NPSH flow is the solved flow through the actual outlet pipe path from tank to pump. Dashed SRC flow is treated as tank feed/inventory balance, not as a pressure-loss path.',
                'Use dashed SRC-to-tank attachment for inheritance, then a solid pipe from the tank outlet to the pump suction.',
                'Atmospheric tank, sump, reservoir, or open storage tank.'
            ],
            [
                'Pressurized Vessel',
                'With Boundary Data Source = Inherit, pressure is taken from the vessel and elevation is vessel base elevation plus liquid level. With Manual, pressure and elevation are taken from the SRC.',
                'NPSH flow is the solved flow through the actual outlet pipe path from vessel to pump. Dashed SRC flow is treated as vessel feed/inventory balance.',
                'Use dashed SRC-to-vessel attachment for inheritance, then a solid pipe from the vessel outlet to the pump suction.',
                'Drum, separator, horizontal/vertical vessel, or pressurized suction source.'
            ],
            [
                'External Header / Pipe Tie-in',
                'Pressure and elevation are always taken from the SRC. Pressure Energy Basis distinguishes static pressure from total/stagnation pressure.',
                'Flow uses SRC input when Flow Input Mode is not Solve from Network. If Solve from Network is selected, flow is determined by the hydraulic network and other boundaries.',
                'Use a solid hydraulic pipe from the SRC outlet to the modeled network. Dashed attachments are ignored for hydraulic calculations.',
                'Tie-in to plant header, external pipeline, or upstream system not modeled in detail.'
            ],
            [
                'Fixed Flow Source',
                'Pressure and elevation are taken from the SRC.',
                'SRC flow becomes the operating flow specification when Flow Input Mode is Mass Flow or Volumetric Flow. Avoid Solve from Network when a fixed flow is intended.',
                'Use a solid hydraulic pipe from the SRC outlet to the modeled network.',
                'Known upstream supply flow, such as an external pump or process unit imposing flow.'
            ],
            [
                'Standalone Boundary Source',
                'Pressure and elevation are taken from the SRC.',
                'Flow is taken from SRC input when Mass Flow or Volumetric Flow is selected; it may be solved by the network when Flow Input Mode = Solve from Network.',
                'Use a solid hydraulic pipe from the SRC outlet to the modeled network.',
                'Generic upstream boundary when the source does not need to be represented as a tank, vessel, or header.'
            ]
        ])),
        createSrcHelpSection('Boundary Data Source', createFluidHelpList([
            'Manual means NPSH uses the pressure and elevation entered directly on the SRC object.',
            'Inherit from Attached Equipment is valid only for Open Tank / Reservoir or Pressurized Vessel connected by a dashed semantic attachment to tank/vessel equipment.',
            'When inheritance is active, pressure and liquid surface elevation are taken from the attached equipment. SRC pressure/elevation fields behave as effective readouts rather than the primary boundary definition.',
            'For External Header, Fixed Flow Source, and Standalone Boundary Source, the model treats the SRC as a direct manual hydraulic boundary. Tank/vessel data are not inherited.'
        ]), true),
        createSrcHelpSection('Connection Rule: Dashed Attachment vs Solid Pipe', createFluidHelpList([
            'A dashed SRC attachment is a semantic relationship used for equipment data inheritance and feed/inventory balance only.',
            'Dashed SRC attachment is excluded from hydraulic traversal. It contributes no pipe length, no friction loss, and no minor-loss coefficient.',
            'A solid pipe or hydraulic component is required before the solver can evaluate flow path, suction losses, high-point pressure warning, and pump NPSH.',
            'For tank/vessel sources, connect SRC to the equipment with a dashed attachment, then connect the equipment outlet to pump suction with a solid hydraulic path.',
            'For External Header, Fixed Flow Source, and Standalone Boundary Source, begin the solid hydraulic path directly from the SRC port.'
        ]), true),
        createSrcHelpSection('NPSH Terms Affected by SRC', createFluidHelpList([
            'Conceptually, NPSHa = boundary pressure head + boundary elevation head - pump suction elevation - suction losses - vapor pressure head.',
            'Boundary pressure head is based on absolute pressure. If pressure input basis is Gauge, the application adds standard atmospheric pressure.',
            'For Open Tank / Reservoir and Pressurized Vessel with inherited data, the boundary elevation is the liquid surface elevation of the attached equipment.',
            'For External Header, Fixed Flow Source, and Standalone Boundary Source, the boundary elevation is the Source/Tie-in Elevation entered on the SRC.',
            'Flow rate affects velocity, Reynolds number, friction factor, major loss, minor loss, and therefore the suction-loss term in NPSHa.'
        ])),
        createSrcHelpSection('Recommended Engineering Workflow', createFluidHelpList([
            '1. Identify the physical suction source: open tank, pressurized vessel, external header, fixed-flow supply, or generic boundary.',
            '2. Select the SRC Source Type that represents that physical boundary.',
            '3. For tank/vessel sources where NPSH should use equipment data, use dashed attachment and set Boundary Data Source = Inherit from Attached Equipment.',
            '4. For header, fixed-flow, or standalone sources, enter pressure, pressure basis, elevation, temperature mode, and flow input on the SRC.',
            '5. Create a solid hydraulic path to the pump suction. Without a solid path, NPSH evaluation will remain incomplete or will report warnings only.',
            '6. Review the pump calculation trace to confirm suction boundary, elevation basis, pressure basis, flow basis, and suction losses.'
        ])),
        createSrcHelpSection('Common Modeling Errors to Avoid', createFluidHelpList([
            'Treating a dashed SRC-to-tank/vessel attachment as a pipe. Dashed attachment is not a pressure-loss path.',
            'Selecting Open Tank / Reservoir while entering pressure/elevation on SRC, when the intended boundary is the tank. Use Inherit from Attached Equipment for that case.',
            'Selecting External Header and then relying on a dashed attachment to a tank. For this type, dashed attachment is ignored; use a solid hydraulic pipe from SRC.',
            'Confusing gauge pressure and absolute pressure. Confirm that the pressure basis matches the field data source.',
            'Using Fixed Flow Source while Flow Input Mode remains Solve from Network. Select Mass Flow or Volumetric Flow when the source flow must be fixed.'
        ]))
    );

    return root;
}

function openSrcHelp() {
    openTaskWindow('SRC Boundary Guidance', createSrcHelpContent(), {
        bodyClass: 'fluid-help-body src-help-body',
        resetScroll: true,
        resetPosition: true
    });
}

function createPropertySourceMapTable(trace) {
    const wrap = document.createElement('div');
    wrap.className = 'fluid-table-wrap';
    const table = document.createElement('table');
    table.className = 'fluid-table fluid-source-map-table';
    const head = document.createElement('thead');
    const headRow = document.createElement('tr');
    ['Property', 'Status', 'Current Value', 'Unit', 'Method', 'Formula / Dependency', 'Reference / Audit Basis'].forEach(label => {
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
            row.status || 'Needs Verification',
            formatFluidTaskNumber(row.value, getSourceMapDigits(row)),
            row.unit || '-',
            row.method || row.source || '-',
            row.formula || '-',
            row.reference || '-'
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
