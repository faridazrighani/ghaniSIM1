/**
 * Modern Process Simulator - Main Entry Point (Bootstrap)
 */

function runUserRequestedSolve() {
    if (typeof updateSimulation === 'function') updateSimulation();
    if (typeof drawConnections === 'function') drawConnections();
    if (typeof updateAllObjectOperatingStatusVisuals === 'function') {
        updateAllObjectOperatingStatusVisuals();
    }
    if (typeof activeChartPumpId !== 'undefined' && activeChartPumpId && typeof updatePumpChart === 'function') {
        updatePumpChart(activeChartPumpId);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize core components
    initMenuBar();
    if (typeof initTaskWindow === 'function') initTaskWindow();
    if (typeof initCanvasWarningPanelWindow === 'function') initCanvasWarningPanelWindow();

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
    if (typeof ensureSimulationSettings === 'function') ensureSimulationSettings();
    if (typeof updateBasisStatusPill === 'function') updateBasisStatusPill();

    // 4. Setup Global Mode Button Listeners
    const btnSelect = document.getElementById('btn-mode-select');
    const btnConnect = document.getElementById('btn-mode-connect');
    const btnFluidBasis = document.getElementById('btn-fluid-basis');
    const btnSolve = document.getElementById('btn-solve');
    
    if (btnSelect) {
        btnSelect.addEventListener('click', () => setAppMode('SELECT'));
    }
    
    if (btnConnect) {
        btnConnect.addEventListener('click', () => activateConnectTool('Straight'));
    }

    if (btnFluidBasis) {
        btnFluidBasis.addEventListener('click', () => openFluidBasis());
    }
    const basisStatusPill = document.getElementById('basisStatusPill');
    if (basisStatusPill) {
        basisStatusPill.addEventListener('click', () => openFluidBasis());
    }

    if (btnSolve) {
        btnSolve.addEventListener('click', runUserRequestedSolve);
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
            if (typeof positionCanvasWarningPanelDefault === 'function') positionCanvasWarningPanelDefault();
            if (activeChartPumpId) updatePumpChart(activeChartPumpId);
            if (pumpChartInstance) pumpChartInstance.resize();
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
    
    // 7. Initial Data Kickstart
    // Auto calculate initial water properties
    if (globalModel["FLUID"] && globalModel["FLUID"].props.fluidName === 'Water') {
        updateWaterProperties();
    }

    const basisConfirmedAtStartup = typeof isBasisConfirmed === 'function' && isBasisConfirmed();
    if (!basisConfirmedAtStartup && typeof openFluidBasisTaskWindow === 'function') {
        openFluidBasisTaskWindow({
            setupRequired: true,
            reason: 'Set Fluid Basis and Unit Standard before adding equipment.'
        });
    }

    // Defer non-critical startup work so the initial Fluid Basis notice can paint first.
    requestAnimationFrame(() => window.setTimeout(() => {
        updateSimulation();
        drawConnections();
        if (basisConfirmedAtStartup && typeof openAboutDialog === 'function') {
            openAboutDialog();
        }
    }, 0));
});
