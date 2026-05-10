/**
 * Modern Process Simulator - Main Entry Point (Bootstrap)
 */


const DEFERRED_ENGINEERING_SCRIPTS = [
    'properties/objects/tank-properties.js',
    'properties/objects/pipe-properties.js',
    'properties/objects/pump-properties.js',
    'properties/objects/valve-properties.js',
    'properties/objects/separator-properties.js',
    'properties/objects/heat-exchanger-properties.js',
    'properties/objects/mixer-properties.js',
    'properties/objects/instrument-properties.js',
    'properties/objects/network-node-properties.js',
    'properties/object-properties.js',
    'formulas/fluids/common-fluid-formulas.js',
    'formulas/fluids/water-formulas.js',
    'formulas/fluids/methanol-formulas.js',
    'formulas/fluids/palm-oil-formulas.js',
    'formulas/fluids/crude-oil-formulas.js',
    'formulas/objects/pump-formulas.js',
    'formulas/objects/pipe-formulas.js',
    'formulas/objects/tank-formulas.js',
    'formulas/objects/valve-formulas.js',
    'formulas/objects/check-valve-formulas.js',
    'formulas/objects/separator-formulas.js',
    'formulas/objects/heat-exchanger-formulas.js',
    'formulas/objects/mixer-formulas.js',
    'formulas/objects/hydraulic-network-formulas.js',
    'formulas/objects/instrument-formulas.js',
    'formulas/objects/network-node-formulas.js'
];

function loadDeferredScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.defer = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.body.appendChild(script);
    });
}

async function loadDeferredEngineeringScripts() {
    for (const src of DEFERRED_ENGINEERING_SCRIPTS) {
        await loadDeferredScript(src);
    }

    if (globalModel.FLUID?.props?.fluidName === 'Water' && typeof updateWaterProperties === 'function') {
        updateWaterProperties();
    }

    updateSimulation({ renderSidebarAfter: currentSelectedNode !== null });
    drawConnections();
}

function scheduleDeferredEngineeringScripts() {
    window.setTimeout(() => {
        window.engineeringScriptsReady = loadDeferredEngineeringScripts().catch(console.error);
        window.hydraulicNetworkReady = window.engineeringScriptsReady;
    }, 3500);
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize core components
    initMenuBar();
    if (typeof initTaskWindow === 'function') initTaskWindow();
    // Chart.js is lazy-loaded only when the pump chart modal is opened.

    const canvas = document.getElementById('canvas');
    if (canvas) {
        canvas.querySelectorAll('.pfd-object').forEach(el => el.remove());
        const svgLines = document.getElementById('svg-lines');
        if (svgLines) svgLines.innerHTML = '';
    }
    
    // 2. Setup Palette UI
    renderToolbarPalette();
    
    // 3. Initialize existing objects
    initDraggableObjects();
    if (window.DEFAULT_SIMULATION_STATE) {
        applySimulationState(JSON.stringify(window.DEFAULT_SIMULATION_STATE));
    }

    // 4. Setup Global Mode Button Listeners
    const btnSelect = document.getElementById('btn-mode-select');
    const btnConnect = document.getElementById('btn-mode-connect');
    const btnFluidBasis = document.getElementById('btn-fluid-basis');
    
    if (btnSelect) {
        btnSelect.addEventListener('click', () => setAppMode('SELECT'));
    }
    
    if (btnConnect) {
        btnConnect.addEventListener('click', () => activateConnectTool('Straight'));
    }

    if (btnFluidBasis) {
        btnFluidBasis.addEventListener('click', () => openFluidBasis());
    }

    // 5. Canvas Event Listeners
    if (canvas) {
        canvas.addEventListener('click', (e) => {
            hideContextMenu();
            if (appMode === 'CONNECT' && pendingConnectionStart && !e.target.classList.contains('port')) {
                cancelPendingConnection();
            }
        });

        canvas.addEventListener('dblclick', (e) => {
            if (!isCanvasBackgroundTarget(e.target)) return;
            hideContextMenu();
            if (pendingConnectionStart) cancelPendingConnection(false);
            setAppMode('SELECT');
            drawConnections();
        });

        // Touch support for double-tap to reset mode
        let lastCanvasTapAt = 0;
        canvas.addEventListener('pointerup', (e) => {
            if (e.pointerType === 'mouse' || !isCanvasBackgroundTarget(e.target)) return;
            const now = Date.now();
            if (now - lastCanvasTapAt < 320) {
                hideContextMenu();
                if (pendingConnectionStart) cancelPendingConnection(false);
                setAppMode('SELECT');
                drawConnections();
                lastCanvasTapAt = 0;
                return;
            }
            lastCanvasTapAt = now;
        });
    }

    // 6. Global Window Event Listeners
    let resizeTimer = null;
    const handleViewportChange = () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => {
            drawConnections();
            if (activeChartPumpId && typeof ensurePumpChartReady === 'function') {
                ensurePumpChartReady().then(() => {
                    updatePumpChart(activeChartPumpId);
                    if (pumpChartInstance) pumpChartInstance.resize();
                }).catch(console.error);
            } else if (pumpChartInstance) {
                pumpChartInstance.resize();
            }
        }, 80);
    };
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);

    document.addEventListener('click', (e) => {
        // Global click to hide context menu if not clicking on items
        if (!e.target.closest('.context-menu')) {
            hideContextMenu();
        }
    });

    const isTextEntryActive = () => {
        const active = document.activeElement;
        return !!(active && (
            active.matches?.('input, select, textarea')
            || active.isContentEditable
        ));
    };

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideContextMenu();
            if (pendingConnectionStart) cancelPendingConnection();
            setAppMode('SELECT');
            return;
        }

        if ((e.key === 'Delete' || e.key === 'Backspace') && currentSelectedNode && currentSelectedNode !== 'FLUID' && !isTextEntryActive()) {
            e.preventDefault();
            hideContextMenu();
            deleteNode(currentSelectedNode);
        }
    });
    
    scheduleDeferredEngineeringScripts();

    // 7. Initial Data Kickstart
    // Auto calculate initial water properties
    if (globalModel["FLUID"] && globalModel["FLUID"].props.fluidName === 'Water' && typeof updateWaterProperties === 'function') {
        updateWaterProperties();
    }
    
    // Give DOM time to render before drawing initial lines
    setTimeout(() => {
        updateSimulation();
        drawConnections();
    }, 100);
});
