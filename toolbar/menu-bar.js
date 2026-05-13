// --- Menu Bar Logic & State Management ---

// History State
let undoStack = [];
let redoStack = [];
const MAX_UNDO = 20;
let currentFileHandle = null;
const HYSYS_FILE_TYPES = [{
    description: 'HYSYS Simulator File',
    accept: {'application/json': ['.hysys', '.json']}
}];
let uiToastCounter = 0;

function getUiToastRegion() {
    let region = document.getElementById('uiToastRegion');
    if (region) return region;

    region = document.createElement('div');
    region.id = 'uiToastRegion';
    region.className = 'ui-toast-region';
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'false');
    document.body.appendChild(region);
    return region;
}

function showUiToast(message, options = {}) {
    if (!message || typeof document === 'undefined') return null;

    const region = getUiToastRegion();
    const toast = document.createElement('div');
    const variant = options.variant || 'info';
    const duration = Number.isFinite(options.duration) ? options.duration : 4200;
    const toastId = `ui-toast-${++uiToastCounter}`;

    toast.id = toastId;
    toast.className = `ui-toast ui-toast-${variant}`;
    toast.setAttribute('role', variant === 'error' ? 'alert' : 'status');

    const body = document.createElement('div');
    body.className = 'ui-toast-body';

    if (options.title) {
        const title = document.createElement('strong');
        title.textContent = options.title;
        body.appendChild(title);
    }

    const text = document.createElement('span');
    text.textContent = message;
    body.appendChild(text);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'ui-toast-close';
    close.setAttribute('aria-label', 'Dismiss notification');
    close.textContent = 'X';

    const dismiss = () => {
        toast.classList.add('ui-toast-exit');
        window.setTimeout(() => toast.remove(), 160);
    };

    close.addEventListener('click', dismiss);
    toast.append(body, close);
    region.appendChild(toast);

    if (duration > 0) {
        window.setTimeout(dismiss, duration);
    }

    return toastId;
}

function downloadSimulationFile() {
    const json = getSimulationState();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

    link.href = url;
    link.download = `hysys-simulation-${timestamp}.hysys`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showUiToast('Simulation file download has started.', {
        title: 'Save As',
        variant: 'success'
    });
}

function openSimulationFileFallback() {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.hysys,.json,application/json';
        input.style.display = 'none';

        input.addEventListener('change', async () => {
            try {
                const file = input.files && input.files[0];
                if (!file) return resolve();
                const text = await file.text();
                applySimulationState(text);
                currentFileHandle = null;
                undoStack = [];
                redoStack = [];
                resolve(true);
            } catch (err) {
                reject(err);
            } finally {
                input.remove();
            }
        }, { once: true });

        input.addEventListener('cancel', () => {
            input.remove();
            resolve(false);
        }, { once: true });

        document.body.appendChild(input);
        input.click();
    });
}

function getSimulationState() {
    const data = {
        model: globalModel,
        connections: connections,
        instrumentLinks: instrumentLinks,
        sourceLinks: sourceLinks,
        visuals: {}
    };
    document.querySelectorAll('.pfd-object').forEach(el => {
        if (el.dataset.id === 'FLUID') return;
        data.visuals[el.dataset.id] = {
            left: el.style.left,
            top: el.style.top
        };
    });
    return JSON.stringify(data);
}

function applySimulationState(jsonString) {
    const data = JSON.parse(jsonString);
    if(!data.model || !data.connections) throw new Error("Invalid format");
    const hadSettings = !!data.model.SETTINGS;
    
    Object.keys(globalModel).forEach(k => delete globalModel[k]);
    Object.assign(globalModel, data.model);
    if (typeof ensureSimulationSettings === 'function') {
        ensureSimulationSettings(globalModel);
        if (!hadSettings && globalModel.SETTINGS?.props) {
            globalModel.SETTINGS.props.unitStandard = typeof DEFAULT_UNIT_STANDARD !== 'undefined'
                ? DEFAULT_UNIT_STANDARD
                : 'Metric / European Engineering';
            globalModel.SETTINGS.props.basisConfirmed = true;
            globalModel.SETTINGS.props.basisDirty = false;
            globalModel.SETTINGS.props.migratedFromLegacy = true;
            globalModel.SETTINGS.props.lastConfirmedUnitStandard = globalModel.SETTINGS.props.unitStandard;
            globalModel.SETTINGS.props.lastConfirmedFluid = globalModel.FLUID?.props?.fluidName || '';
            globalModel.SETTINGS.props.lastConfirmedTemperature = globalModel.FLUID?.props?.temp ?? null;
        }
    }
    if (globalModel.FLUID) globalModel.FLUID.name = 'Fluid Basis';
    connections.splice(0, connections.length, ...data.connections);
    instrumentLinks.splice(0, instrumentLinks.length, ...(data.instrumentLinks || []));
    sourceLinks.splice(0, sourceLinks.length, ...(data.sourceLinks || []));
    if (typeof syncSourceAttachmentProps === 'function') {
        Object.keys(globalModel).forEach(nodeId => {
            if (globalModel[nodeId]?.type === 'source') {
                syncSourceAttachmentProps(nodeId);
                if (typeof syncSourceTemperatureFromFluidBasis === 'function') {
                    syncSourceTemperatureFromFluidBasis(nodeId);
                }
                if (typeof syncSourceFlowFromInputMode === 'function') {
                    syncSourceFlowFromInputMode(nodeId);
                }
            }
        });
    }
    
    const canvas = document.getElementById('canvas');
    canvas.querySelectorAll('.pfd-object').forEach(el => el.remove());
    
    for (let key in globalModel) {
        if (key === 'FLUID' || key === 'SETTINGS' || globalModel[key].type === 'pipe') continue;
        
        const node = globalModel[key];
        const div = document.createElement('div');
        const type = node.type;
        div.className = getObjectClassName(type);
        div.id = 'obj-' + key.toLowerCase().replace(/-/g, '');
        div.dataset.id = key;
        div.dataset.type = type;
        
        if (data.visuals && data.visuals[key]) {
            div.style.left = data.visuals[key].left;
            div.style.top = data.visuals[key].top;
        } else {
            div.style.left = '300px';
            div.style.top = '300px';
        }
        
        div.innerHTML = getObjectMarkup(type, key, node.desc || getDefaultDescription(type));
        
        canvas.appendChild(div);
        applyObjectVisuals(key);
        makeDraggable(div);
    }
    
    currentSelectedNode = null;
    renderSidebar(null);
    if (typeof clearObjectTaskMinimizedDock === 'function') clearObjectTaskMinimizedDock();
    updateSimulation({ renderSidebarAfter: false });
    drawConnections();
    if (typeof updateBasisStatusPill === 'function') updateBasisStatusPill();
}

function captureState() {
    undoStack.push(getSimulationState());
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack = [];
}

function undoAction() {
    if (undoStack.length === 0) return;
    redoStack.push(getSimulationState());
    applySimulationState(undoStack.pop());
}

function redoAction() {
    if (redoStack.length === 0) return;
    undoStack.push(getSimulationState());
    applySimulationState(redoStack.pop());
}

function clearSimulationCanvas() {
    if(!confirm("Are you sure you want to clear the canvas? Unsaved changes will be lost.")) return;
    captureState();
    
    Object.keys(globalModel).forEach(k => delete globalModel[k]);
    if (typeof createDefaultSimulationSettings === 'function') {
        globalModel.SETTINGS = createDefaultSimulationSettings();
    }
    globalModel["FLUID"] = { 
        type: "fluid", 
        name: "Fluid Basis", 
        props: { 
            inputMode: "Basic",
            fluidName: "Water", 
            temp: 25, 
            density: 997,
            sg: 0.997, 
            viscosity: 0.89,
            dynViscosity: 0.89,
            vaporPressure: 0.0317,
            specificHeat: 4.18,
            bulkModulus: 2.2,
            specVolume: 0.001,
            specWeight: 9780,
            vaporPressureHead: 0.3241119893830319,
            speedOfSound: 1482
        } 
    };
    if (typeof updateWaterProperties === 'function') updateWaterProperties();
    connections.splice(0, connections.length);
    instrumentLinks.splice(0, instrumentLinks.length);
    sourceLinks.splice(0, sourceLinks.length);
    
    const canvas = document.getElementById('canvas');
    canvas.querySelectorAll('.pfd-object').forEach(el => el.remove());

    currentSelectedNode = null;
    renderSidebar(null);
    if (typeof clearObjectTaskMinimizedDock === 'function') clearObjectTaskMinimizedDock();
    drawConnections();
    updateSimulation();
    if (typeof updateBasisStatusPill === 'function') updateBasisStatusPill();
}

async function fileClose() {
    clearSimulationCanvas();
    currentFileHandle = null;
}

async function fileSaveAs() {
    if (!window.showSaveFilePicker) {
        downloadSimulationFile();
        return;
    }

    try {
        const handle = await window.showSaveFilePicker({
            types: HYSYS_FILE_TYPES
        });
        currentFileHandle = handle;
        await fileSave();
    } catch (err) {
        if (err?.name === 'AbortError') return;
        console.error(err);
    }
}

async function fileSave() {
    if (!currentFileHandle) {
        return fileSaveAs();
    }

    try {
        const json = getSimulationState();
        
        const writable = await currentFileHandle.createWritable();
        await writable.write(json);
        await writable.close();
        showUiToast('File saved successfully.', {
            title: 'Save',
            variant: 'success'
        });
    } catch (err) {
        if (err?.name === 'AbortError') return;
        console.error(err);
        showUiToast('Failed to save file. Please check browser file permissions and try again.', {
            title: 'Save failed',
            variant: 'error',
            duration: 6200
        });
    }
}

async function fileOpen() {
    try {
        const loaded = await openSimulationFileFallback();
        if (loaded) {
            showUiToast('Simulation file loaded successfully.', {
                title: 'Open',
                variant: 'success'
            });
        }
    } catch (err) {
        console.error(err);
        showUiToast('Failed to open file. Please choose a valid .hysys or .json file saved by this app.', {
            title: 'Open failed',
            variant: 'error',
            duration: 7200
        });
    }
}

function openFluidBasis() {
    if (!globalModel.FLUID) return;
    globalModel.FLUID.name = 'Fluid Basis';
    if (typeof setAppMode === 'function') setAppMode('SELECT');
    if (typeof hideContextMenu === 'function') hideContextMenu();
    if (typeof openFluidBasisTaskWindow === 'function') {
        openFluidBasisTaskWindow();
    } else {
        selectNode('FLUID', null);
    }
}

function openAboutDialog() {
    const modal = document.getElementById('aboutModal');
    const closeButton = document.getElementById('closeAbout');
    if (!modal) return;

    modal.hidden = false;
    closeButton?.focus();
}

function closeAboutDialog() {
    const modal = document.getElementById('aboutModal');
    if (modal) modal.hidden = true;
}

// Menu Initialization
function initMenuBar() {
    const positionDropdown = (container, dropdown) => {
        const rect = container.getBoundingClientRect();
        dropdown.style.left = `${Math.max(6, Math.min(rect.left, window.innerWidth - dropdown.offsetWidth - 6))}px`;
        dropdown.style.top = `${Math.min(rect.bottom + 2, window.innerHeight - 8)}px`;
    };

    // File Menu Logic
    const menuFile = document.getElementById('menu-file');
    const fileDropdown = document.getElementById('file-dropdown-container');
    
    if (menuFile && fileDropdown) {
        const fileDropdownContent = document.getElementById('dropdown-file');
        menuFile.addEventListener('click', (e) => {
            e.stopPropagation();
            editDropdown?.classList.remove('show');
            processDropdown?.classList.remove('show');
            helpDropdown?.classList.remove('show');
            fileDropdown.classList.toggle('show');
            if (fileDropdown.classList.contains('show') && fileDropdownContent) {
                positionDropdown(fileDropdown, fileDropdownContent);
            }
        });
        
        document.addEventListener('click', (e) => {
            if (!fileDropdown.contains(e.target)) {
                fileDropdown.classList.remove('show');
            }
        });

        const menuNew = document.getElementById('menu-new');
        if(menuNew) {
            menuNew.addEventListener('click', (e) => {
                e.preventDefault();
                fileDropdown.classList.remove('show');
                fileClose();
            });
        }

        const menuOpen = document.getElementById('menu-open');
        if(menuOpen) {
            menuOpen.addEventListener('click', (e) => {
                e.preventDefault();
                fileDropdown.classList.remove('show');
                fileOpen();
            });
        }

        const menuSave = document.getElementById('menu-save');
        if(menuSave) {
            menuSave.addEventListener('click', (e) => {
                e.preventDefault();
                fileDropdown.classList.remove('show');
                fileSave();
            });
        }

        const menuSaveAs = document.getElementById('menu-save-as');
        if(menuSaveAs) {
            menuSaveAs.addEventListener('click', (e) => {
                e.preventDefault();
                fileDropdown.classList.remove('show');
                fileSaveAs();
            });
        }

        const menuClearFile = document.getElementById('menu-clear-file');
        if(menuClearFile) {
            menuClearFile.addEventListener('click', (e) => {
                e.preventDefault();
                fileDropdown.classList.remove('show');
                clearSimulationCanvas();
            });
        }
        
        const menuClose = document.getElementById('menu-close');
        if(menuClose) {
            menuClose.addEventListener('click', (e) => {
                e.preventDefault();
                fileDropdown.classList.remove('show');
                fileClose();
            });
        }
    }

    // Edit Menu Logic
    const menuEdit = document.getElementById('menu-edit');
    const editDropdown = document.getElementById('edit-dropdown-container');
    
    if (menuEdit && editDropdown) {
        const editDropdownContent = document.getElementById('dropdown-edit');
        menuEdit.addEventListener('click', (e) => {
            e.stopPropagation();
            fileDropdown?.classList.remove('show');
            processDropdown?.classList.remove('show');
            helpDropdown?.classList.remove('show');
            editDropdown.classList.toggle('show');
            if (editDropdown.classList.contains('show') && editDropdownContent) {
                positionDropdown(editDropdown, editDropdownContent);
            }
        });
        
        document.addEventListener('click', (e) => {
            if (!editDropdown.contains(e.target)) {
                editDropdown.classList.remove('show');
            }
        });

        const menuUndo = document.getElementById('menu-undo');
        if(menuUndo) {
            menuUndo.addEventListener('click', (e) => {
                e.preventDefault();
                editDropdown.classList.remove('show');
                undoAction();
            });
        }

        const menuRedo = document.getElementById('menu-redo');
        if(menuRedo) {
            menuRedo.addEventListener('click', (e) => {
                e.preventDefault();
                editDropdown.classList.remove('show');
                redoAction();
            });
        }

        const menuClear = document.getElementById('menu-clear');
        if(menuClear) {
            menuClear.addEventListener('click', (e) => {
                e.preventDefault();
                editDropdown.classList.remove('show');
                clearSimulationCanvas();
            });
        }
    }

    // Process Menu Logic
    const menuProcess = document.getElementById('menu-process');
    const processDropdown = document.getElementById('process-dropdown-container');

    if (menuProcess && processDropdown) {
        const processDropdownContent = document.getElementById('dropdown-process');
        menuProcess.addEventListener('click', (e) => {
            e.stopPropagation();
            fileDropdown?.classList.remove('show');
            editDropdown?.classList.remove('show');
            helpDropdown?.classList.remove('show');
            processDropdown.classList.toggle('show');
            if (processDropdown.classList.contains('show') && processDropdownContent) {
                positionDropdown(processDropdown, processDropdownContent);
            }
        });

        document.addEventListener('click', (e) => {
            if (!processDropdown.contains(e.target)) {
                processDropdown.classList.remove('show');
            }
        });

        const menuFluidBasis = document.getElementById('menu-fluid-basis');
        if (menuFluidBasis) {
            menuFluidBasis.addEventListener('click', (e) => {
                e.preventDefault();
                processDropdown.classList.remove('show');
                openFluidBasis();
            });
        }
    }

    // Help Menu Logic
    const menuHelp = document.getElementById('menu-help');
    const helpDropdown = document.getElementById('help-dropdown-container');

    if (menuHelp && helpDropdown) {
        const helpDropdownContent = document.getElementById('dropdown-help');
        menuHelp.addEventListener('click', (e) => {
            e.stopPropagation();
            fileDropdown?.classList.remove('show');
            editDropdown?.classList.remove('show');
            processDropdown?.classList.remove('show');
            helpDropdown.classList.toggle('show');
            if (helpDropdown.classList.contains('show') && helpDropdownContent) {
                positionDropdown(helpDropdown, helpDropdownContent);
            }
        });

        document.addEventListener('click', (e) => {
            if (!helpDropdown.contains(e.target)) {
                helpDropdown.classList.remove('show');
            }
        });

        const menuAbout = document.getElementById('menu-about');
        if (menuAbout) {
            menuAbout.addEventListener('click', (e) => {
                e.preventDefault();
                helpDropdown.classList.remove('show');
                openAboutDialog();
            });
        }

        const menuSrcHelp = document.getElementById('menu-src-help');
        if (menuSrcHelp) {
            menuSrcHelp.addEventListener('click', (e) => {
                e.preventDefault();
                helpDropdown.classList.remove('show');
                if (typeof openSrcHelp === 'function') {
                    openSrcHelp();
                }
            });
        }

        const menuFluidProperties = document.getElementById('menu-fluid-properties');
        const fluidPropertiesSubmenu = menuFluidProperties?.closest('.dropdown-submenu');
        if (menuFluidProperties && fluidPropertiesSubmenu) {
            menuFluidProperties.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                fluidPropertiesSubmenu.classList.toggle('show-submenu');
                menuFluidProperties.setAttribute(
                    'aria-expanded',
                    fluidPropertiesSubmenu.classList.contains('show-submenu') ? 'true' : 'false'
                );
            });
        }

        const menuNpshNotes = document.getElementById('menu-npsh-notes');
        if (menuNpshNotes) {
            menuNpshNotes.addEventListener('click', (e) => {
                e.preventDefault();
                helpDropdown.classList.remove('show');
                fluidPropertiesSubmenu?.classList.remove('show-submenu');
                if (menuFluidProperties) menuFluidProperties.setAttribute('aria-expanded', 'false');
                if (typeof openFluidPropertiesHelp === 'function') {
                    openFluidPropertiesHelp('npsh');
                }
            });
        }

        const menuPropertySourceMap = document.getElementById('menu-property-source-map');
        if (menuPropertySourceMap) {
            menuPropertySourceMap.addEventListener('click', (e) => {
                e.preventDefault();
                helpDropdown.classList.remove('show');
                fluidPropertiesSubmenu?.classList.remove('show-submenu');
                if (menuFluidProperties) menuFluidProperties.setAttribute('aria-expanded', 'false');
                if (typeof openFluidPropertiesHelp === 'function') {
                    openFluidPropertiesHelp('source-map');
                }
            });
        }
    }

    const aboutModal = document.getElementById('aboutModal');
    const closeAbout = document.getElementById('closeAbout');

    if (aboutModal) {
        aboutModal.addEventListener('click', (e) => {
            if (e.target === aboutModal) closeAboutDialog();
        });
    }

    if (closeAbout) {
        closeAbout.addEventListener('click', (e) => {
            e.preventDefault();
            closeAboutDialog();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && aboutModal && !aboutModal.hidden) {
            closeAboutDialog();
        }
    });
}
