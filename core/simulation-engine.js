function updatePumpResultReadouts(pump) {
    const statusClass = typeof getPumpEvaluationStatusClass === 'function'
        ? getPumpEvaluationStatusClass(pump.results.cavitationStatus || pump.results.status)
        : 'neutral';
    setSidebarReadout('result-flow', pump.results.flow, 'm3/h');
    setSidebarReadout('result-head', pump.results.head, 'm');
    setSidebarReadout('result-efficiency', pump.results.efficiency, '%');
    setSidebarReadout('result-power', pump.results.power, 'kW');
    setSidebarReadout('result-suction-pressure', pump.results.suctionPressure, 'bar a');
    setSidebarReadout('result-discharge-pressure', pump.results.dischargePressure, 'bar a');
    setSidebarReadout('result-suction-loss', pump.results.suctionLoss, 'm');
    setSidebarReadout('result-suction-velocity-head', pump.results.suctionVelocityHead, 'm');
    setSidebarReadout('result-vapor-pressure-head', pump.results.vaporPressureHead, 'm');
    setSidebarReadout('result-npsha', pump.results.npsha, 'm');
    setSidebarReadout('result-npshr', pump.results.npshr, 'm');
    setSidebarReadout('result-npshr-source', pump.results.npshrSource || '-', '');
    setSidebarReadout('result-npsh-margin', pump.results.npshMargin, 'm');
    setSidebarReadout('result-npsh-ratio', pump.results.npshRatio, '');
    setSidebarReadout('result-cavitation-status', pump.results.cavitationStatus || '-', '');
    setSidebarReadout('result-dominant-loss', pump.results.dominantSuctionLoss || '-', '');
    setSidebarReadout('result-engineering-notes', (pump.results.engineeringNotes || []).join(' | ') || '-', '');
    document.querySelectorAll('.pump-notes[data-key="result-engineering-notes"]').forEach(wrapper => {
        const notes = (pump.results.engineeringNotes || []).filter(Boolean);
        if (notes.length === 0) {
            wrapper.innerHTML = '<span class="pump-notes-empty">-</span>';
            return;
        }

        const list = document.createElement('ul');
        notes.forEach(note => {
            const item = document.createElement('li');
            item.textContent = note;
            list.appendChild(item);
        });
        wrapper.replaceChildren(list);
    });
    if (typeof updatePumpSuctionLossBreakdownReadout === 'function') {
        updatePumpSuctionLossBreakdownReadout(pump);
    }
    if (typeof updatePumpCalculationTraceReadout === 'function') {
        updatePumpCalculationTraceReadout(pump);
    }
    setSidebarReadout('result-bep-percent', pump.results.bepPercent, '% BEP');
    setSidebarReadout('result-operating-region', pump.results.operatingRegion, '');
    setSidebarReadout('result-status', pump.results.status, '');
    setSidebarReadout('result-warnings', (pump.results.warnings || []).join(' | ') || 'OK', '');
    setSidebarReadout('result-solve-mode', pump.results.solveMode || '-', '');
    setSidebarReadout('result-flow-basis', pump.results.flowBasis || '-', '');
    setSidebarReadout('result-fixed-flow', pump.results.fixedFlow, 'm3/h');
    setSidebarReadout('result-required-system-head', pump.results.requiredSystemHead, 'm');
    setSidebarReadout('result-pump-head-at-flow', pump.results.pumpHeadAtFlow, 'm');
    setSidebarReadout('result-head-residual', pump.results.headResidual, 'm');
    setSidebarReadout('result-pressure-residual', pump.results.pressureResidual, 'bar');
    setSidebarReadout('result-downstream-boundary', pump.results.downstreamBoundary || '-', '');
    setSidebarReadout('result-curve-source', pump.results.curveSource || '-', '');
    setSidebarReadout('result-model-basis', pump.results.modelBasis || '-', '');
    setSidebarReadout('result-model-warnings', (pump.results.modelWarnings || []).join(' | ') || 'None', '');
    document.querySelectorAll('[data-key="result-cavitation-status"]').forEach(el => {
        el.classList.remove(
            'pump-eval-status-safe',
            'pump-eval-status-warning',
            'pump-eval-status-risk',
            'pump-eval-status-incomplete',
            'pump-eval-status-neutral'
        );
        el.classList.add('pump-eval-status', `pump-eval-status-${statusClass}`);
    });
}

function updatePumpChart(pumpId) {
    const pump = globalModel[pumpId];
    if (!pumpChartInstance || !pump || pump.type !== 'pump' || !pump.results) return;

    const flowUnit = typeof getDisplayUnit === 'function' ? getDisplayUnit('flow') : 'm3/h';
    const headUnit = typeof getDisplayUnit === 'function' ? getDisplayUnit('head') : 'm';
    const toFlow = value => typeof convertToDisplay === 'function' ? convertToDisplay(value, 'flow') : value;
    const toHead = value => value === null || value === undefined
        ? value
        : (typeof convertToDisplay === 'function' ? convertToDisplay(value, 'head') : value);

    pumpChartInstance.data.labels = pump.results.sysCurve.map(d => toFlow(d[0]));
    pumpChartInstance.data.datasets[0].data = pump.results.pumpCurve.map(d => toHead(d[1]));
    pumpChartInstance.data.datasets[1].data = pump.results.sysCurve.map(d => toHead(d[1]));
    if (pumpChartInstance.options?.scales?.x?.title) {
        pumpChartInstance.options.scales.x.title.text = `Flow Rate (${flowUnit})`;
    }
    if (pumpChartInstance.options?.scales?.y?.title) {
        pumpChartInstance.options.scales.y.title.text = `Head (${headUnit})`;
    }
    pumpChartInstance.update('none');
}

function resetPumpCalculatedResults(pump, status, warnings = []) {
    pump.results.flow = null;
    pump.results.head = null;
    pump.results.efficiency = null;
    pump.results.power = null;
    pump.results.npsha = null;
    pump.results.npshr = null;
    pump.results.npshMargin = null;
    pump.results.npshRatio = null;
    pump.results.bepPercent = null;
    pump.results.operatingRegion = '-';
    pump.results.status = status;
    pump.results.warnings = warnings;
    pump.results.suctionPressure = null;
    pump.results.dischargePressure = null;
    pump.results.suctionLoss = null;
    pump.results.dischargeLoss = null;
    pump.results.suctionVelocityHead = null;
    pump.results.vaporPressureHead = null;
    pump.results.vaporPressureBasis = null;
    pump.results.vaporPressureLive = null;
    pump.results.npshrSource = '-';
    pump.results.cavitationStatus = status;
    pump.results.dominantSuctionLoss = '-';
    pump.results.engineeringNotes = [];
    pump.results.npshEvaluation = null;
    pump.results.solveMode = '-';
    pump.results.flowBasis = '-';
    pump.results.fixedFlow = null;
    pump.results.requiredSystemHead = null;
    pump.results.pumpHeadAtFlow = null;
    pump.results.headResidual = null;
    pump.results.pressureResidual = null;
    pump.results.downstreamBoundary = '-';
}

function getIncompleteHydraulicNetworkWarnings(hydraulicContext, downstreamLabel = 'active downstream SNK') {
    const warnings = [];
    if (hydraulicContext?.networkWarnings?.length) {
        warnings.push(...hydraulicContext.networkWarnings);
    }
    if (!hydraulicContext?.suctionBoundary && !hydraulicContext?.suctionPath?.isUnsupported) {
        const hasSemanticSourceWarning = warnings.some(warning => String(warning).includes('but no hydraulic path exists'));
        if (!hasSemanticSourceWarning) {
            warnings.push('Connect an upstream SRC to the pump or upstream equipment before solving flow.');
        }
    }
    if (!hydraulicContext?.dischargeBoundary && !hydraulicContext?.dischargePath?.isUnsupported) {
        warnings.push(`Connect an ${downstreamLabel} before solving flow.`);
    }
    return warnings.length ? warnings : ['Hydraulic network is incomplete.'];
}

function updatePumpPerformanceMetadata(pump, performanceModel) {
    if (!pump || !pump.results || !performanceModel) return;
    pump.results.curveSource = performanceModel.source || '-';
    pump.results.modelBasis = performanceModel.modelBasis || '-';
    pump.results.modelWarnings = performanceModel.warnings || [];
}

function refreshPumpUiReadouts(pumpId, pump) {
    if (currentSelectedNode === pumpId || activeChartPumpId === pumpId) {
        updatePumpChart(pumpId);
    }

    if (currentSelectedNode === pumpId) {
        updatePumpResultReadouts(pump);
    }
}

function applyPumpOperatingPointResults(pump, hydraulicContext, hydraulicSnapshot, opFlow, opHead, density, performanceModel, additionalWarnings = [], solveInfo = {}) {
    updatePumpPerformanceMetadata(pump, performanceModel);
    const eff = performanceModel.getEfficiency(opFlow);
    const hydraulicPower = (opFlow * opHead * density * GRAVITY) / 3.6e6;
    const power = eff > 0 ? hydraulicPower / (eff / 100) : null;
    const npshr = performanceModel.getNpshr(opFlow);
    const npshEvaluation = evaluateNpshMargin(hydraulicSnapshot.npsha, npshr, pump.props);
    const detailedNpshEvaluation = typeof buildPumpNpshEvaluationResult === 'function'
        ? buildPumpNpshEvaluationResult(pump, hydraulicContext, hydraulicSnapshot, opFlow, opHead, performanceModel)
        : null;
    const operatingRegion = classifyPumpOperatingRegion(opFlow, pump.props);
    const warnings = [...new Set([
        ...additionalWarnings,
        ...((hydraulicContext?.networkWarnings || []).filter(Boolean))
    ])];

    if (operatingRegion.status === 'AOR') {
        warnings.push('Operating point is outside POR; review reliability/efficiency.');
    } else if (operatingRegion.status === 'Outside AOR') {
        warnings.push('Operating point is outside configured AOR.');
    }

    if (npshEvaluation.status !== 'Safe') {
        warnings.push(npshEvaluation.message);
    }

    if (eff <= 0) {
        warnings.push('Pump efficiency is zero or invalid at operating point.');
    }

    applyHydraulicPathResults(hydraulicContext, hydraulicSnapshot, opFlow);
    [...(hydraulicContext.suctionPath?.steps || []), ...(hydraulicContext.dischargePath?.steps || [])].forEach(step => {
        const pipeWarnings = globalModel[step.pipeId]?.results?.warnings || [];
        pipeWarnings.forEach(warning => {
            if (warning && !warnings.includes(warning)) warnings.push(warning);
        });
    });
    pump.results.flow = opFlow.toFixed(2);
    pump.results.head = opHead.toFixed(2);
    pump.results.power = power === null ? null : power.toFixed(2);
    pump.results.npsha = hydraulicSnapshot.npsha.toFixed(2);
    pump.results.npshr = npshr.toFixed(2);
    pump.results.npshrSource = typeof getPumpNpshrSourceLabel === 'function'
        ? getPumpNpshrSourceLabel(performanceModel)
        : performanceModel.source || '-';
    pump.results.npshMargin = npshEvaluation.margin === null ? null : npshEvaluation.margin.toFixed(2);
    pump.results.npshRatio = npshEvaluation.ratio === null ? null : npshEvaluation.ratio.toFixed(2);
    pump.results.cavitationStatus = npshEvaluation.status;
    pump.results.bepPercent = operatingRegion.percent.toFixed(1);
    pump.results.operatingRegion = operatingRegion.status;
    pump.results.status = warnings.length ? 'Warning' : (solveInfo.statusWhenOk || 'OK');
    pump.results.warnings = warnings;
    pump.results.efficiency = eff.toFixed(2);
    pump.results.suctionPressure = hydraulicSnapshot.suctionPressureBar.toFixed(3);
    pump.results.dischargePressure = hydraulicSnapshot.dischargePressureBar.toFixed(3);
    pump.results.suctionLoss = hydraulicSnapshot.suctionLoss.toFixed(2);
    pump.results.dischargeLoss = hydraulicSnapshot.dischargeLoss.toFixed(2);
    pump.results.suctionVelocityHead = hydraulicSnapshot.suctionVelocityHead?.toFixed(3) ?? null;
    pump.results.vaporPressureHead = hydraulicSnapshot.vaporPressureHead?.toFixed(3) ?? null;
    const basisVaporPressure = parseFloat(globalModel.FLUID?.props?.vaporPressure);
    const liveVaporPressure = parseFloat(detailedNpshEvaluation?.calculationTrace?.basis?.vaporPressureBarA);
    pump.results.vaporPressureBasis = Number.isFinite(basisVaporPressure)
        ? basisVaporPressure.toFixed(6)
        : null;
    pump.results.vaporPressureLive = Number.isFinite(liveVaporPressure)
        ? liveVaporPressure.toFixed(6)
        : (Number.isFinite(hydraulicContext.vaporPressurePa)
            ? (hydraulicContext.vaporPressurePa / 100000).toFixed(6)
            : null);
    pump.results.dominantSuctionLoss = detailedNpshEvaluation?.dominantLoss || '-';
    pump.results.engineeringNotes = detailedNpshEvaluation?.notes || [];
    pump.results.npshEvaluation = detailedNpshEvaluation;
    pump.results.solveMode = solveInfo.solveMode || 'Pump/system intersection';
    pump.results.flowBasis = solveInfo.flowBasis || 'Pump/system intersection';
    pump.results.fixedFlow = solveInfo.fixedFlow === undefined || solveInfo.fixedFlow === null
        ? null
        : Number(solveInfo.fixedFlow.toFixed(3));
    const requiredHead = solveInfo.requiredSystemHead ?? hydraulicSnapshot.systemHead;
    pump.results.requiredSystemHead = Number.isFinite(requiredHead) ? requiredHead.toFixed(2) : null;
    pump.results.pumpHeadAtFlow = Number.isFinite(opHead) ? opHead.toFixed(2) : null;
    const headResidual = solveInfo.headResidual ?? (Number.isFinite(requiredHead) ? opHead - requiredHead : null);
    pump.results.headResidual = Number.isFinite(headResidual) ? headResidual.toFixed(2) : null;
    const pressureResidual = solveInfo.pressureResidual ?? (Number.isFinite(headResidual) ? pressureHeadToBar(headResidual, density) : null);
    pump.results.pressureResidual = Number.isFinite(pressureResidual) ? pressureResidual.toFixed(3) : null;
    pump.results.downstreamBoundary = solveInfo.downstreamBoundary || hydraulicContext.dischargePath?.boundaryId || '-';
}

function getInstrumentLink(instrumentId) {
    const instrument = globalModel[instrumentId];
    const attachedTo = instrument && instrument.props ? instrument.props.attachedTo : null;
    return instrumentLinks.find(link => link.instrumentId === instrumentId)
        || (attachedTo ? { instrumentId, pipeId: attachedTo, location: 0.5 } : null);
}

function formatCanvasReadoutValue(value, digits = 2) {
    if (value === null || value === undefined || value === '') return '-';
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    return number.toFixed(digits);
}

function updateLineMonitorCanvasReadout(instrumentId) {
    const instrument = globalModel[instrumentId];
    if (!instrument || instrument.type !== 'lineMonitor' || typeof getObjectElement !== 'function') return;

    const objectEl = getObjectElement(instrumentId);
    if (!objectEl) return;

    const quantityByKey = {
        pressure: 'pressureAbs',
        temperature: 'temperature',
        flow: 'flow'
    };
    const unitByKey = {
        pressure: 'bar a',
        temperature: 'deg C',
        flow: 'm3/h'
    };
    const getDigits = (key, unit) => {
        if (key === 'temperature') return 1;
        if (key === 'flow' && unit === 'm3/s') return 4;
        return 2;
    };

    const setValue = (key, value) => {
        const quantity = quantityByKey[key];
        const displayValue = quantity && typeof convertToDisplay === 'function'
            ? convertToDisplay(value, quantity)
            : value;
        const displayUnit = quantity && typeof getDisplayUnit === 'function'
            ? getDisplayUnit(quantity)
            : unitByKey[key];
        const cell = objectEl.querySelector(`[data-readout-key="${key}"]`);
        if (cell) cell.textContent = formatCanvasReadoutValue(displayValue, getDigits(key, displayUnit));
        const unitCell = objectEl.querySelector(`[data-readout-unit="${key}"]`);
        if (unitCell) unitCell.textContent = displayUnit || '';
    };

    const props = instrument.props || {};
    setValue('pressure', props.measuredPressure);
    setValue('temperature', props.measuredTemperature);
    setValue('flow', props.measuredFlow);
    objectEl.classList.toggle('is-attached', !!props.attachedTo);
}

function updateInstrumentReadout(instrumentId) {
    const instrument = globalModel[instrumentId];
    if (!instrument || !isInstrumentType(instrument.type)) return;

    if (!instrument.props) instrument.props = {};
    const link = getInstrumentLink(instrumentId);
    const pipeId = link ? link.pipeId : '';
    const readout = calculatePipeInstrumentMeasurement(instrument, pipeId, globalModel, connections, link ? link.location : 0.5);

    instrument.props.attachedTo = pipeId;
    if (instrument.type === 'lineMonitor') {
        const values = readout.values || {};
        const percents = readout.percents || {};
        instrument.props.measuredPressure = values.pressure ?? null;
        instrument.props.measuredFlow = values.flow ?? null;
        instrument.props.measuredTemperature = values.temperature ?? null;
        instrument.props.pressureSignal = percents.pressure ?? null;
        instrument.props.flowSignal = percents.flow ?? null;
        instrument.props.temperatureSignal = percents.temperature ?? null;
    } else {
        instrument.props.measuredValue = readout.value;
        instrument.props.measuredUnit = readout.unit;
        instrument.props.measuredPercent = readout.percent;
    }

    if (typeof buildInstrumentCalculationTrace === 'function') {
        if (!instrument.results) instrument.results = {};
        instrument.results.calculationTrace = buildInstrumentCalculationTrace(instrumentId, globalModel, connections);
    }

    updateLineMonitorCanvasReadout(instrumentId);

    if (currentSelectedNode === instrumentId) {
        setSidebarReadout('instrument-attached-to', pipeId || '-');
        if (instrument.type === 'lineMonitor') {
            setSidebarReadout('instrument-pressure', instrument.props.measuredPressure, 'bar a');
            setSidebarReadout('instrument-flow', instrument.props.measuredFlow, 'm3/h');
            setSidebarReadout('instrument-temperature', instrument.props.measuredTemperature, 'deg C');
        } else {
            setSidebarReadout('instrument-measured', readout.value, readout.unit);
            setSidebarReadout('instrument-signal', readout.percent, readout.percent === null ? '' : '%');
        }
    }

    if (typeof updateInstrumentCalculationTraceReadout === 'function') {
        updateInstrumentCalculationTraceReadout(instrumentId);
    }
}

function updateAllInstrumentReadouts() {
    Object.keys(globalModel).forEach(nodeId => {
        if (isInstrumentType(globalModel[nodeId].type)) {
            updateInstrumentReadout(nodeId);
        }
    });
}

function getOrientedHydraulicConnection(conn) {
    return typeof orientHydraulicConnection === 'function'
        ? orientHydraulicConnection(conn, globalModel)
        : conn;
}

function getSinkPipeConnection(sinkId) {
    return (connections || [])
        .map(getOrientedHydraulicConnection)
        .find(conn => conn.to === sinkId || conn.from === sinkId) || null;
}

function getSinkPipeConnections(sinkId) {
    return (connections || [])
        .map(getOrientedHydraulicConnection)
        .filter(conn => conn.to === sinkId || conn.from === sinkId);
}

function getPipePressureForNodeSide(pipe, conn, nodeId) {
    if (!pipe || !pipe.results || !pipe.results.pressureCalculated) return null;
    if (conn.to === nodeId && pipe.results.outletPressure !== null && pipe.results.outletPressure !== undefined) {
        return parseFloat(pipe.results.outletPressure);
    }
    if (conn.from === nodeId && pipe.results.inletPressure !== null && pipe.results.inletPressure !== undefined) {
        return parseFloat(pipe.results.inletPressure);
    }
    return pipe.results.pressure === null || pipe.results.pressure === undefined ? null : parseFloat(pipe.results.pressure);
}

function getPipeStagnationPressureForNodeSide(pipe, conn, nodeId) {
    if (!pipe || !pipe.results || !pipe.results.pressureCalculated) return null;
    if (conn.to === nodeId && pipe.results.outletStagnationPressure !== null && pipe.results.outletStagnationPressure !== undefined) {
        return parseFloat(pipe.results.outletStagnationPressure);
    }
    if (conn.from === nodeId && pipe.results.inletStagnationPressure !== null && pipe.results.inletStagnationPressure !== undefined) {
        return parseFloat(pipe.results.inletStagnationPressure);
    }
    return null;
}

function getPipeHydraulicHeadForNodeSide(pipe, conn, nodeId) {
    if (!pipe || !pipe.results || !pipe.results.pressureCalculated) return null;
    if (conn.to === nodeId && pipe.results.outletHydraulicHead !== null && pipe.results.outletHydraulicHead !== undefined) {
        return parseFloat(pipe.results.outletHydraulicHead);
    }
    if (conn.from === nodeId && pipe.results.inletHydraulicHead !== null && pipe.results.inletHydraulicHead !== undefined) {
        return parseFloat(pipe.results.inletHydraulicHead);
    }
    return pipe.results.hydraulicHead === null || pipe.results.hydraulicHead === undefined ? null : parseFloat(pipe.results.hydraulicHead);
}

function getSolvedPipeFlow(pipe) {
    if (!pipe || !pipe.results || !pipe.results.pressureCalculated) return null;
    const flow = parseFloat(pipe.results.flow);
    return Number.isFinite(flow) ? flow : null;
}

function getTankPipeConnections(tankId) {
    return (connections || [])
        .map(getOrientedHydraulicConnection)
        .filter(conn => conn.to === tankId || conn.from === tankId);
}

function getTankSourceFeedLinks(tankId) {
    if (typeof sourceLinks === 'undefined' || !Array.isArray(sourceLinks)) return [];
    return sourceLinks.filter(link => link.targetId === tankId && globalModel[link.sourceId]?.type === 'source');
}

function getTankSourceFeedFlowBreakdown(tankId) {
    return getTankSourceFeedLinks(tankId).reduce((sum, link) => {
        const source = globalModel[link.sourceId];
        const flow = parseFloat(source?.props?.flow);
        sum.push({
            sourceId: link.sourceId,
            sourceType: source?.props?.sourceType || '-',
            flow: Number.isFinite(flow) ? Number(flow.toFixed(3)) : null
        });
        return sum;
    }, []);
}

function getTankSourceFeedFlowTotal(sourceFeedFlows) {
    return (sourceFeedFlows || []).reduce((sum, row) => (
        sum + (Number.isFinite(row?.flow) ? row.flow : 0)
    ), 0);
}

function averageFiniteValues(values) {
    const valid = (values || []).filter(value => Number.isFinite(value));
    if (valid.length === 0) return null;
    return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function getTankLevelTrend(netFlow, hasFlow, flowTolerance) {
    if (!hasFlow || !Number.isFinite(netFlow)) return 'No flow';
    if (Math.abs(netFlow) <= flowTolerance) return 'Balanced';
    return netFlow > 0 ? 'Rising' : 'Falling';
}

function formatSignedTankFlow(flow) {
    if (!Number.isFinite(flow)) return '-';
    const sign = flow > 0 ? '+' : '';
    return `${sign}${flow.toFixed(3)}`;
}

function getTankInventoryAdvisory(netFlow, levelTrend) {
    if (!Number.isFinite(netFlow) || !['Rising', 'Falling'].includes(levelTrend)) return '';
    const direction = levelTrend === 'Rising' ? 'rise' : 'fall';
    return `Tank inventory advisory: Net Flow = ${formatSignedTankFlow(netFlow)} m3/h; level will ${direction}. Pump/NPSH calculations use the current liquid level until a dynamic level model is solved.`;
}

function updateTankPressureReadout(tankId) {
    const tank = globalModel[tankId];
    if (!tank || tank.type !== 'tank') return;
    if (typeof normalizeTankProps === 'function') normalizeTankProps(tank);
    ensureNodeResults(tank);

    const fluid = globalModel.FLUID;
    const vaporPressure = parseFloat(fluid?.props?.vaporPressure);
    if (Number.isFinite(vaporPressure)) {
        tank.props.vaporPressure = vaporPressure;
    }

    const tankConnections = getTankPipeConnections(tankId);
    const sourceFeedLinks = getTankSourceFeedLinks(tankId);
    const sidePressures = [];
    const sideStagnationPressures = [];
    let inletPressure = null;
    let outletPressure = null;
    let pipeInletFlow = 0;
    let pipeOutletFlow = 0;
    let solvedPipeCount = 0;

    tankConnections.forEach(conn => {
        const pipe = globalModel[conn.pipeId];
        const staticPressure = getPipePressureForNodeSide(pipe, conn, tankId);
        const stagnationPressure = getPipeStagnationPressureForNodeSide(pipe, conn, tankId);
        const pipeFlow = getSolvedPipeFlow(pipe);

        if (Number.isFinite(staticPressure)) {
            sidePressures.push(staticPressure);
            if (conn.to === tankId && inletPressure === null) inletPressure = staticPressure;
            if (conn.from === tankId && outletPressure === null) outletPressure = staticPressure;
        }
        if (Number.isFinite(stagnationPressure)) {
            sideStagnationPressures.push(stagnationPressure);
        }
        if (Number.isFinite(pipeFlow)) {
            solvedPipeCount += 1;
            if (conn.to === tankId) pipeInletFlow += pipeFlow;
            if (conn.from === tankId) pipeOutletFlow += pipeFlow;
        }
    });

    const sourceFeedFlows = getTankSourceFeedFlowBreakdown(tankId);
    const sourceFeedFlow = getTankSourceFeedFlowTotal(sourceFeedFlows);
    const inletFlow = pipeInletFlow + sourceFeedFlow;
    const outletFlow = pipeOutletFlow;
    const hasFlow = inletFlow > 0 || outletFlow > 0;
    const netFlow = hasFlow ? inletFlow - outletFlow : null;
    const flowTolerance = Math.max(0.01, Math.max(inletFlow, outletFlow) * 0.02);
    const levelTrend = getTankLevelTrend(netFlow, hasFlow, flowTolerance);

    let hydraulicStatus = 'No hydraulic connection';
    if (tankConnections.length === 0 && sourceFeedLinks.length > 0) {
        hydraulicStatus = 'Source attached, no pipe solved';
    } else if (tankConnections.length > 0 && solvedPipeCount === 0) {
        hydraulicStatus = 'Network incomplete';
    } else if (solvedPipeCount > 0) {
        hydraulicStatus = 'Pass-through solved';
    }

    const safety = typeof evaluateTankPressureSafety === 'function'
        ? evaluateTankPressureSafety(tank.props, fluid?.props || {})
        : { status: '-', warnings: [], suggestedPressure: 0, suggestedBasis: 'Not available' };
    const warnings = [...safety.warnings];
    const advisories = [];
    const operatingPressureAbsolute = typeof getNodeAbsolutePressureBar === 'function'
        ? getNodeAbsolutePressureBar(tank)
        : parseFloat(tank.props.pressure);
    const operatingPressureGauge = typeof getNodeGaugePressureBar === 'function'
        ? getNodeGaugePressureBar(tank)
        : parseFloat(tank.props.pressure);

    if (tankConnections.length > 0 && sidePressures.length === 0) {
        warnings.push('Connected pipe pressure is not solved; connect upstream SRC and downstream SNK to calculate flow.');
    }
    const inventoryAdvisory = getTankInventoryAdvisory(netFlow, levelTrend);
    if (inventoryAdvisory) {
        advisories.push(inventoryAdvisory);
    }

    tank.results.connectedPipes = tankConnections.map(conn => conn.pipeId);
    tank.results.connectedSources = sourceFeedLinks.map(link => link.sourceId);
    tank.results.sourceFeedFlows = sourceFeedFlows;
    tank.results.calculatedPressure = averageFiniteValues(sidePressures);
    tank.results.inletPressure = inletPressure;
    tank.results.outletPressure = outletPressure;
    tank.results.stagnationPressure = averageFiniteValues(sideStagnationPressures);
    tank.results.inletFlow = hasFlow ? Number(inletFlow.toFixed(3)) : null;
    tank.results.outletFlow = hasFlow ? Number(outletFlow.toFixed(3)) : null;
    tank.results.netFlow = Number.isFinite(netFlow) ? Number(netFlow.toFixed(3)) : null;
    tank.results.levelTrend = levelTrend;
    tank.results.sourceFeedFlow = sourceFeedLinks.length > 0 ? Number(sourceFeedFlow.toFixed(3)) : null;
    tank.results.operatingPressureAbsolute = Number.isFinite(operatingPressureAbsolute) ? Number(operatingPressureAbsolute.toFixed(3)) : null;
    tank.results.operatingPressureGauge = Number.isFinite(operatingPressureGauge) ? Number(operatingPressureGauge.toFixed(3)) : null;
    tank.results.operatingPressureGaugeMbar = Number.isFinite(operatingPressureGauge) ? Number((operatingPressureGauge * 1000).toFixed(3)) : null;
    tank.results.hydraulicStatus = hydraulicStatus;
    tank.results.pressureBasis = sidePressures.length > 0
        ? 'Calculated from solved connected pipe pressure'
        : 'Operating Pressure input is informational in pass-through mode';
    tank.results.vaporPressure = Number.isFinite(vaporPressure) ? Number(vaporPressure.toFixed(4)) : null;
    tank.results.liquidVolume = Number.isFinite(parseFloat(tank.props.liquidVolume)) ? Number(parseFloat(tank.props.liquidVolume).toFixed(3)) : safety.liquidVolume;
    tank.results.totalCapacity = Number.isFinite(parseFloat(tank.props.totalCapacity)) ? Number(parseFloat(tank.props.totalCapacity).toFixed(3)) : safety.totalCapacity;
    tank.results.fillPercent = Number.isFinite(parseFloat(tank.props.fillPercent)) ? Number(parseFloat(tank.props.fillPercent).toFixed(3)) : safety.fillPercent;
    tank.results.tankDesignPressure = safety.tankDesignPressure;
    tank.results.designVacuum = safety.designVacuum;
    tank.results.pressureVentSet = safety.pressureVentSet;
    tank.results.vacuumVentSet = safety.vacuumVentSet;
    tank.results.ventingBasis = safety.ventingBasis;
    tank.results.ventingStatus = safety.status;
    tank.results.geometryStatus = safety.geometryStatus;
    tank.results.emergencyVentProvided = tank.props.emergencyVentProvided;
    tank.results.status = warnings.length ? 'Review' : (advisories.length ? 'Advisory' : hydraulicStatus);
    tank.results.warnings = [...warnings, ...advisories];
    tank.results.calculationTrace = typeof buildTankCalculationTrace === 'function'
        ? buildTankCalculationTrace(tank, fluid?.props || {}, tank.results)
        : null;

    if (currentSelectedNode === tankId) {
        setSidebarReadout('tank-connected-pipes', tank.results.connectedPipes.join(', ') || '-', '');
        setSidebarReadout('tank-connected-sources', tank.results.connectedSources.join(', ') || '-', '');
        setSidebarReadout('tank-pressure-basis', tank.results.pressureBasis, '');
        setSidebarReadout('tank-calculated-pressure', tank.results.calculatedPressure === null ? null : Number(tank.results.calculatedPressure.toFixed(3)), 'bar a');
        setSidebarReadout('tank-inlet-pressure', tank.results.inletPressure === null ? null : Number(tank.results.inletPressure.toFixed(3)), 'bar a');
        setSidebarReadout('tank-outlet-pressure', tank.results.outletPressure === null ? null : Number(tank.results.outletPressure.toFixed(3)), 'bar a');
        setSidebarReadout('tank-stagnation-pressure', tank.results.stagnationPressure === null ? null : Number(tank.results.stagnationPressure.toFixed(3)), 'bar a');
        setSidebarReadout('tank-inlet-flow', tank.results.inletFlow, 'm3/h');
        setSidebarReadout('tank-outlet-flow', tank.results.outletFlow, 'm3/h');
        setSidebarReadout('tank-net-flow', tank.results.netFlow, 'm3/h');
        setSidebarReadout('tank-level-trend', tank.results.levelTrend, '');
        setSidebarReadout('tank-source-feed-flow', tank.results.sourceFeedFlow, 'm3/h');
        if (typeof setTankSourceFeedFlowBreakdownReadout === 'function') {
            setTankSourceFeedFlowBreakdownReadout(tank.results.sourceFeedFlows);
        }
        setSidebarReadout('tank-operating-abs-pressure', tank.results.operatingPressureAbsolute, 'bar a');
        setSidebarReadout('tank-hydraulic-status', tank.results.hydraulicStatus, '');
        setSidebarReadout('tank-vapor-pressure', tank.results.vaporPressure, 'bar a');
        setSidebarReadout('tank-liquid-volume', tank.results.liquidVolume, 'm3');
        setSidebarReadout('tank-total-capacity', tank.results.totalCapacity, 'm3');
        setSidebarReadout('tank-fill-percent', tank.results.fillPercent, '%');
        setSidebarReadout('tank-design-pressure', tank.results.tankDesignPressure, 'mbar g');
        setSidebarReadout('tank-design-vacuum', tank.results.designVacuum, 'mbar vacuum');
        setSidebarReadout('tank-pressure-vent-set', tank.results.pressureVentSet, 'mbar g');
        setSidebarReadout('tank-vacuum-vent-set', tank.results.vacuumVentSet, 'mbar vacuum');
        setSidebarReadout('tank-venting-basis', tank.results.ventingBasis, '');
        setSidebarReadout('tank-venting-status', tank.results.ventingStatus, '');
        setSidebarReadout('tank-geometry-status', tank.results.geometryStatus, '');
        setSidebarReadout('tank-status', tank.results.status, '');
        setSidebarReadout('tank-warnings', tank.results.warnings.join(' | ') || 'OK', '');
    }
    if (typeof updateTankCalculationTraceReadout === 'function') {
        updateTankCalculationTraceReadout(tank);
    }
}

function updateAllTankReadouts() {
    Object.keys(globalModel).forEach(nodeId => {
        if (globalModel[nodeId]?.type === 'tank') {
            updateTankPressureReadout(nodeId);
        }
    });
}

function updateHeatExchangerReadout(exchangerId) {
    const exchanger = globalModel[exchangerId];
    if (!exchanger || exchanger.type !== 'heatExchanger') return;
    ensureNodeResults(exchanger);

    const trace = typeof buildHeatExchangerCalculationTrace === 'function'
        ? buildHeatExchangerCalculationTrace(exchangerId, globalModel, connections)
        : null;
    exchanger.results.calculationTrace = trace;
    if (trace?.hydraulic) {
        exchanger.results.pressureDrop = trace.hydraulic.pressureDropBar;
        exchanger.results.pressureDropHead = trace.hydraulic.pressureDropHead;
        exchanger.results.flow = trace.hydraulic.flow;
        exchanger.results.massFlow = trace.hydraulic.massFlowKgH;
        exchanger.results.npshLossContribution = trace.hydraulic.npshLossContribution;
    }
    if (trace?.thermal) {
        exchanger.results.duty = trace.thermal.dutyInput;
        exchanger.results.inletTemp = trace.thermal.inletTemp;
        exchanger.results.outletTemp = trace.thermal.outletTemp;
        exchanger.results.deltaTemp = trace.thermal.deltaTemp;
        exchanger.results.specificHeat = trace.thermal.specificHeat;
        exchanger.results.calculatedDuty = trace.thermal.calculatedDuty;
        exchanger.results.dutyResidual = trace.thermal.dutyResidual;
    }
    if (trace?.fluid) {
        exchanger.results.density = trace.fluid.density;
        exchanger.results.vaporPressure = trace.fluid.vaporPressure;
    }
    exchanger.results.status = trace?.status || '-';
    exchanger.results.warnings = trace?.warnings || [];

    if (currentSelectedNode === exchangerId) {
        setSidebarReadout('hx-duty-input', exchanger.results.duty, 'kW');
        setSidebarReadout('hx-pressure-drop', exchanger.results.pressureDrop, 'bar');
        setSidebarReadout('hx-pressure-drop-head', exchanger.results.pressureDropHead, 'm');
        setSidebarReadout('hx-inlet-temp', exchanger.results.inletTemp, 'deg C');
        setSidebarReadout('hx-outlet-temp', exchanger.results.outletTemp, 'deg C');
        setSidebarReadout('hx-delta-temp', exchanger.results.deltaTemp, 'deg C');
        setSidebarReadout('hx-flow', exchanger.results.flow, 'm3/h');
        setSidebarReadout('hx-mass-flow', exchanger.results.massFlow, 'kg/h');
        setSidebarReadout('hx-calculated-duty', exchanger.results.calculatedDuty, 'kW');
        setSidebarReadout('hx-duty-residual', exchanger.results.dutyResidual, 'kW');
        setSidebarReadout('hx-density', exchanger.results.density, 'kg/m3');
        setSidebarReadout('hx-specific-heat', exchanger.results.specificHeat, 'kJ/kg.K');
        setSidebarReadout('hx-vapor-pressure', exchanger.results.vaporPressure, 'bar a');
        setSidebarReadout('hx-npsh-loss-contribution', exchanger.results.npshLossContribution, 'm');
    }

    if (typeof updateHeatExchangerCalculationTraceReadout === 'function') {
        updateHeatExchangerCalculationTraceReadout(exchangerId);
    }
}

function updateAllHeatExchangerReadouts() {
    Object.keys(globalModel).forEach(nodeId => {
        if (globalModel[nodeId]?.type === 'heatExchanger') {
            updateHeatExchangerReadout(nodeId);
        }
    });
}

function updateValveReadout(valveId) {
    const valve = globalModel[valveId];
    if (!valve || !['valve', 'checkValve'].includes(valve.type)) return;
    ensureNodeResults(valve);

    const trace = typeof buildValveCalculationTrace === 'function'
        ? buildValveCalculationTrace(valveId, globalModel, connections)
        : null;
    valve.results.calculationTrace = trace;
    if (trace?.hydraulic) {
        valve.results.flow = trace.hydraulic.flow;
        valve.results.density = trace.hydraulic.density;
        valve.results.specificGravity = trace.hydraulic.specificGravity;
        valve.results.diameter = trace.hydraulic.diameter;
        valve.results.velocityHead = trace.hydraulic.velocityHead;
        valve.results.headLoss = trace.hydraulic.headLoss;
        valve.results.pressureDrop = trace.hydraulic.pressureDropBar;
        valve.results.npshLossContribution = trace.hydraulic.npshLossContribution;
        valve.results.effectiveCv = trace.hydraulic.effectiveCv;
        valve.results.effectiveK = trace.hydraulic.effectiveK;
        valve.results.crackingHead = valve.type === 'checkValve' ? trace.hydraulic.crackingHead : null;
    }
    valve.results.status = trace?.status || valve.results.status || '-';
    valve.results.warnings = trace?.warnings || valve.results.warnings || [];

    if (currentSelectedNode === valveId) {
        setSidebarReadout('valve-flow', valve.results.flow, 'm3/h');
        setSidebarReadout('valve-density', valve.results.density, 'kg/m3');
        setSidebarReadout('valve-specific-gravity', valve.results.specificGravity, '');
        setSidebarReadout('valve-diameter', valve.results.diameter, 'm');
        setSidebarReadout('valve-velocity-head', valve.results.velocityHead, 'm');
        setSidebarReadout('valve-head-loss', valve.results.headLoss, 'm');
        setSidebarReadout('valve-pressure-drop', valve.results.pressureDrop, 'bar');
        setSidebarReadout('valve-npsh-loss-contribution', valve.results.npshLossContribution, 'm');
        setSidebarReadout('valve-effective-cv', valve.results.effectiveCv, '');
        setSidebarReadout('valve-effective-k', valve.results.effectiveK, '');
        setSidebarReadout('valve-cracking-head', valve.results.crackingHead, valve.type === 'checkValve' ? 'm' : '');
    }

    if (typeof updateValveCalculationTraceReadout === 'function') {
        updateValveCalculationTraceReadout(valveId);
    }
}

function updateAllValveReadouts() {
    Object.keys(globalModel).forEach(nodeId => {
        if (['valve', 'checkValve'].includes(globalModel[nodeId]?.type)) {
            updateValveReadout(nodeId);
        }
    });
}

function updateSeparatorReadout(vesselId) {
    const vessel = globalModel[vesselId];
    if (!vessel || !['separator', 'verticalVessel'].includes(vessel.type)) return;
    ensureNodeResults(vessel);

    const trace = typeof buildSeparatorCalculationTrace === 'function'
        ? buildSeparatorCalculationTrace(vesselId, globalModel, connections)
        : null;
    vessel.results.calculationTrace = trace;
    if (trace?.boundary) {
        vessel.results.operatingPressureAbsolute = trace.boundary.pressureAbsBar;
        vessel.results.pressureDrop = trace.boundary.pressureDropBar;
        vessel.results.pressureDropHead = trace.boundary.pressureDropHead;
        vessel.results.baseElevation = trace.boundary.baseElevation;
        vessel.results.liquidSurfaceElevation = trace.boundary.liquidSurfaceElevation;
        vessel.results.inletNozzleElevation = trace.boundary.inletNozzleElevation;
        vessel.results.outletNozzleElevation = trace.boundary.outletNozzleElevation;
        vessel.results.outletSubmergence = trace.boundary.outletSubmergence;
        vessel.results.flow = trace.boundary.flow;
        vessel.results.holdupFlow = trace.boundary.holdupFlow;
        vessel.results.holdupVolume = trace.boundary.holdupVolume;
    }
    if (trace?.flowBalance) {
        vessel.results.connectedPipes = trace.flowBalance.connectedPipes || [];
        vessel.results.connectedSources = trace.flowBalance.connectedSources || [];
        vessel.results.sourceFeedFlows = trace.flowBalance.sourceFeedFlows || [];
        vessel.results.hydraulicInletFlow = trace.flowBalance.hydraulicInletFlow;
        vessel.results.hydraulicOutletFlow = trace.flowBalance.hydraulicOutletFlow;
        vessel.results.sourceFeedFlow = trace.flowBalance.sourceFeedFlow;
        vessel.results.inletFlow = trace.flowBalance.inletFlow;
        vessel.results.outletFlow = trace.flowBalance.outletFlow;
        vessel.results.netFlow = trace.flowBalance.netFlow;
        vessel.results.levelTrend = trace.flowBalance.levelTrend;
    }
    vessel.results.status = trace?.status || '-';
    vessel.results.warnings = trace?.warnings || [];

    if (currentSelectedNode === vesselId) {
        setSidebarReadout('vessel-absolute-pressure', vessel.results.operatingPressureAbsolute, 'bar a');
        setSidebarReadout('vessel-pressure-drop', vessel.results.pressureDrop, 'bar');
        setSidebarReadout('vessel-pressure-drop-head', vessel.results.pressureDropHead, 'm');
        setSidebarReadout('vessel-base-elevation', vessel.results.baseElevation, 'm');
        setSidebarReadout('vessel-liquid-surface-elevation', vessel.results.liquidSurfaceElevation, 'm');
        setSidebarReadout('vessel-inlet-nozzle-elevation', vessel.results.inletNozzleElevation, 'm');
        setSidebarReadout('vessel-outlet-nozzle-elevation', vessel.results.outletNozzleElevation, 'm');
        setSidebarReadout('vessel-outlet-submergence', vessel.results.outletSubmergence, 'm');
        setSidebarReadout('vessel-flow', vessel.results.flow, 'm3/h');
        setSidebarReadout('vessel-hydraulic-inlet-flow', vessel.results.hydraulicInletFlow, 'm3/h');
        setSidebarReadout('vessel-hydraulic-outlet-flow', vessel.results.hydraulicOutletFlow, 'm3/h');
        setSidebarReadout('vessel-source-feed-flow', vessel.results.sourceFeedFlow, 'm3/h');
        setSidebarReadout('vessel-inlet-flow', vessel.results.inletFlow, 'm3/h');
        setSidebarReadout('vessel-outlet-flow', vessel.results.outletFlow, 'm3/h');
        setSidebarReadout('vessel-net-flow', vessel.results.netFlow, 'm3/h');
        setSidebarReadout('vessel-level-trend', vessel.results.levelTrend, '');
        setSidebarReadout('vessel-holdup-volume', vessel.results.holdupVolume, 'm3');
    }
    if (typeof updateSeparatorCalculationTraceReadout === 'function') {
        updateSeparatorCalculationTraceReadout(vesselId);
    }
}

function updateAllSeparatorReadouts() {
    Object.keys(globalModel).forEach(nodeId => {
        if (['separator', 'verticalVessel'].includes(globalModel[nodeId]?.type)) {
            updateSeparatorReadout(nodeId);
        }
    });
}

function updateSinkReadout(sinkId) {
    const sink = globalModel[sinkId];
    if (!sink || sink.type !== 'sink') return;
    if (typeof normalizeSinkProps === 'function') normalizeSinkProps(sink);
    ensureNodeResults(sink);

    const fluid = globalModel.FLUID;
    const density = Math.max(parseFloat(fluid?.props?.density) || 1000, 1);
    const temperature = parseFloat(fluid?.props?.temp);
    const vaporPressure = parseFloat(fluid?.props?.vaporPressure);
    const sinkConnections = getSinkPipeConnections(sinkId);
    const conn = sinkConnections[0] || null;
    const pipe = conn ? globalModel[conn.pipeId] : null;
    const flow = pipe && pipe.results && pipe.results.pressureCalculated ? parseFloat(pipe.results.flow) : null;
    const staticPressure = getPipePressureForNodeSide(pipe, conn || {}, sinkId);
    const stagnationPressure = getPipeStagnationPressureForNodeSide(pipe, conn || {}, sinkId);
    const calculatedPressure = sink.props.pressureBasis === 'Stagnation'
        ? stagnationPressure
        : staticPressure;
    const boundaryPressureInput = parseFloat(sink.props.pressure);
    const boundaryPressure = typeof getNodeAbsolutePressureBar === 'function'
        ? getNodeAbsolutePressureBar(sink)
        : boundaryPressureInput;
    const selectedPressure = Number.isFinite(calculatedPressure) ? calculatedPressure : boundaryPressure;
    const elevation = parseFloat(sink.props.elevation) || 0;
    const hydraulicHead = getPipeHydraulicHeadForNodeSide(pipe, conn || {}, sinkId)
        ?? (Number.isFinite(selectedPressure) ? pressureBarToHead(selectedPressure, density) + elevation : null);
    const pressureResidual = sink.props.boundaryMode === SINK_BOUNDARY_MODE_PRESSURE
        && Number.isFinite(calculatedPressure)
        && Number.isFinite(boundaryPressure)
            ? calculatedPressure - boundaryPressure
            : null;
    const warnings = [];

    if (sink.props.active === SINK_INACTIVE) {
        warnings.push('Sink is inactive and is not used as a hydraulic boundary.');
    }
    if (sinkConnections.length === 0) {
        warnings.push('Sink is not connected to a pipeline.');
    }
    if (conn && (!pipe || !pipe.results || !pipe.results.pressureCalculated)) {
        warnings.push('Connected pipe has no solved hydraulic result.');
    }
    if (sink.props.pressureBasis === 'Static' && sinkConnections.length > 1) {
        warnings.push('Static pressure boundary should connect to one pipe only; use Stagnation for reservoir/header style boundaries.');
    }
    if (sink.props.boundaryMode === SINK_BOUNDARY_MODE_FLOW && (parseFloat(sink.props.demandFlow) || 0) <= 0) {
        warnings.push('Flow Demand must be greater than zero.');
    }
    if (sink.props.boundaryMode === SINK_BOUNDARY_MODE_PRESSURE && Number.isFinite(pressureResidual) && Math.abs(pressureResidual) > 0.02) {
        warnings.push('Boundary pressure residual exceeds 0.02 bar; check convergence or boundary basis.');
    }
    if (
        sink.props.boundaryMode === SINK_BOUNDARY_MODE_PRESSURE
        && sink.props.pressureInputBasis === PRESSURE_INPUT_BASIS_ABSOLUTE
        && Number.isFinite(boundaryPressure)
        && boundaryPressure <= 0
    ) {
        warnings.push('Outlet Pressure is 0 bar a/vacuum absolute; use 0 bar g or 1.01325 bar a for atmospheric discharge.');
    }
    if (Number.isFinite(selectedPressure) && Number.isFinite(vaporPressure) && selectedPressure <= vaporPressure) {
        warnings.push('Calculated outlet pressure is at or below fluid vapor pressure.');
    }

    sink.results.attachedPipe = conn ? conn.pipeId : '';
    sink.results.boundaryPressureInput = Number.isFinite(boundaryPressureInput) ? Number(boundaryPressureInput.toFixed(3)) : null;
    sink.results.boundaryPressure = Number.isFinite(boundaryPressure) ? Number(boundaryPressure.toFixed(3)) : null;
    sink.results.calculatedPressure = Number.isFinite(calculatedPressure) ? Number(calculatedPressure.toFixed(3)) : null;
    sink.results.staticPressure = Number.isFinite(staticPressure) ? Number(staticPressure.toFixed(3)) : null;
    sink.results.stagnationPressure = Number.isFinite(stagnationPressure) ? Number(stagnationPressure.toFixed(3)) : null;
    sink.results.pressureResidual = Number.isFinite(pressureResidual) ? Number(pressureResidual.toFixed(4)) : null;
    sink.results.flow = Number.isFinite(flow) ? Number(flow.toFixed(3)) : null;
    sink.results.massFlow = Number.isFinite(flow) ? Number((flow * density).toFixed(3)) : null;
    sink.results.temperature = Number.isFinite(temperature) ? Number(temperature.toFixed(3)) : null;
    sink.results.hydraulicHead = Number.isFinite(hydraulicHead) ? Number(hydraulicHead.toFixed(3)) : null;
    sink.results.pressureBasis = sink.props.pressureBasis;
    sink.results.pressureInputBasis = sink.props.pressureInputBasis;
    sink.results.boundaryMode = sink.props.boundaryMode;
    sink.results.status = warnings.length ? 'Warning' : 'OK';
    sink.results.warnings = warnings;

    if (currentSelectedNode === sinkId) {
        setSidebarReadout('sink-attached-pipe', sink.results.attachedPipe || '-');
        setSidebarReadout('sink-boundary-pressure', sink.results.boundaryPressure, 'bar a');
        setSidebarReadout('sink-absolute-pressure', sink.results.boundaryPressure, 'bar a');
        setSidebarReadout('sink-calculated-pressure', sink.results.calculatedPressure, 'bar a');
        setSidebarReadout('sink-static-pressure', sink.results.staticPressure, 'bar a');
        setSidebarReadout('sink-stagnation-pressure', sink.results.stagnationPressure, 'bar a');
        setSidebarReadout('sink-pressure-residual', sink.results.pressureResidual, 'bar');
        setSidebarReadout('sink-flow', sink.results.flow, 'm3/h');
        setSidebarReadout('sink-mass-flow', sink.results.massFlow, 'kg/h');
        setSidebarReadout('sink-temperature', sink.results.temperature, 'deg C');
        setSidebarReadout('sink-hydraulic-head', sink.results.hydraulicHead, 'm');
        setSidebarReadout('sink-status', sink.results.status, '');
        setSidebarReadout('sink-warnings', warnings.join(' | ') || 'OK', '');
    }
}

function updateAllSinkReadouts() {
    Object.keys(globalModel).forEach(nodeId => {
        if (globalModel[nodeId]?.type === 'sink') {
            updateSinkReadout(nodeId);
        }
    });
}

function getPumpFixedFlowRequest(hydraulicContext) {
    if (isSinkFlowDemandBoundary(hydraulicContext.dischargeBoundary)) {
        const demandFlow = Math.max(0, parseFloat(hydraulicContext.dischargeBoundary.props.demandFlow) || 0);
        return { flow: demandFlow, source: 'sink-flow-demand' };
    }

    const sourceFlow = typeof getPumpOptimizationSourceFlow === 'function'
        ? getPumpOptimizationSourceFlow(hydraulicContext)
        : null;
    if (sourceFlow !== null) {
        return { flow: sourceFlow, source: 'source-flow', sourceId: hydraulicContext.suctionPath.boundaryId };
    }

    return null;
}

function getFixedFlowHeadMismatchWarnings(flowRequest, pumpHead, systemHead) {
    if (!flowRequest || flowRequest.source !== 'source-flow') return [];
    if (!Number.isFinite(pumpHead) || !Number.isFinite(systemHead)) {
        return ['Unable to compare pump head against system head at SRC flow.'];
    }

    const residual = pumpHead - systemHead;
    const tolerance = Math.max(0.2, Math.abs(systemHead) * 0.05);
    if (Math.abs(residual) <= tolerance) return [];

    const formattedResidual = Math.abs(residual).toFixed(2);
    if (residual < 0) {
        return [`Pump head is ${formattedResidual} m below required system head at SRC flow; downstream pressure boundary will not be met.`];
    }

    return [`Pump head is ${formattedResidual} m above required system head at SRC flow; downstream pressure boundary will be over-pressured.`];
}

function getOverSpecifiedFlowPressureWarnings(flowRequest, hydraulicContext) {
    if (!flowRequest || flowRequest.source !== 'source-flow') return [];
    if (!isSinkPressureBoundary(hydraulicContext?.dischargeBoundary)) return [];
    return ['Flow, downstream pressure, and pump curve are all fixed. Calculation will report residual head.'];
}

function updateSimulation(options = {}) {
    const { renderSidebarAfter = true } = options;
    const fluid = globalModel['FLUID'];
    if (!fluid) return;

    if (typeof syncAllSourceTemperaturesFromFluidBasis === 'function') {
        syncAllSourceTemperaturesFromFluidBasis();
    }
    const sourceBoundaryChanged = typeof reconcileAllSourceBoundaryConfigurations === 'function'
        ? reconcileAllSourceBoundaryConfigurations({ detachInvalidAttachment: true })
        : false;
    if (typeof normalizeAllSinkProps === 'function') {
        normalizeAllSinkProps();
    }

    const density = fluid.props.density; 
    const vaporPressure = fluid.props.vaporPressure * 100000; // bar to Pa
    
    // Sync vapor pressure to all tanks
    const tanks = Object.keys(globalModel).filter(k => globalModel[k].type === 'tank');
    tanks.forEach(tankId => {
        if (typeof normalizeTankProps === 'function') normalizeTankProps(globalModel[tankId]);
        globalModel[tankId].props.vaporPressure = fluid.props.vaporPressure;
    });

    if (typeof updateAllValveCompatibilityResults === 'function') {
        updateAllValveCompatibilityResults(globalModel, connections, { syncDiameter: true });
    }

    resetHydraulicPipeResults(globalModel);
    
    const pumps = Object.keys(globalModel).filter(k => globalModel[k].type === 'pump');
    
    pumps.forEach(pumpId => {
        const pump = globalModel[pumpId];
        ensureNodeResults(pump);

        const hydraulicContext = createPumpHydraulicContext(pumpId, globalModel, connections, density, vaporPressure);
        
        pump.results.sysCurve = [];
        pump.results.pumpCurve = [];

        const performanceModel = createPumpPerformanceModel(pump);
        updatePumpPerformanceMetadata(pump, performanceModel);
        const getPumpHead = performanceModel.getHead;
        
        const calcSysHead = (q) => {
            const systemHead = calculatePumpSystemHead(hydraulicContext, q);
            return systemHead === null ? null : systemHead;
        };
        
        const STEP = 5;
        const flowRequest = getPumpFixedFlowRequest(hydraulicContext);
        const fixedFlow = flowRequest ? flowRequest.flow : null;
        const MAX_FLOW = Math.ceil(Math.max(STEP, performanceModel.maxFlow, fixedFlow || 0) / STEP) * STEP;

        if (flowRequest !== null) {
            const fixedHead = getPumpHead(fixedFlow);
            const systemHeadAtFixedFlow = calcSysHead(fixedFlow);
            for (let q = 0; q <= MAX_FLOW; q += STEP) {
                pump.results.pumpCurve.push([q, getPumpHead(q)]);
                pump.results.sysCurve.push([
                    q,
                    flowRequest.source === 'sink-flow-demand'
                        ? (Math.abs(q - fixedFlow) <= STEP / 2 ? fixedHead : null)
                        : calcSysHead(q)
                ]);
            }

            if (!hydraulicContext.isComplete) {
                const downstreamLabel = flowRequest.source === 'sink-flow-demand'
                    ? 'active downstream flow-demand SNK'
                    : 'active downstream SNK';
                resetPumpCalculatedResults(pump, 'Incomplete network', getIncompleteHydraulicNetworkWarnings(hydraulicContext, downstreamLabel));
                refreshPumpUiReadouts(pumpId, pump);
                return;
            }

            if (fixedFlow <= 0) {
                const message = flowRequest.source === 'sink-flow-demand'
                    ? 'Flow Demand must be greater than zero.'
                    : 'SRC flow input must be greater than zero.';
                resetPumpCalculatedResults(pump, 'Invalid flow demand', [message]);
                refreshPumpUiReadouts(pumpId, pump);
                return;
            }

            if (fixedFlow < performanceModel.minFlow || fixedFlow > performanceModel.maxFlow) {
                const message = flowRequest.source === 'sink-flow-demand'
                    ? 'Flow Demand is outside the pump curve range; required pressure is not reliable.'
                    : 'SRC flow is outside the pump curve range; solved pressure is not reliable.';
                resetPumpCalculatedResults(pump, 'Outside curve', [message]);
                refreshPumpUiReadouts(pumpId, pump);
                return;
            }

            const hydraulicSnapshot = flowRequest.source === 'sink-flow-demand'
                ? calculatePumpFlowDemandSnapshot(hydraulicContext, fixedFlow, fixedHead)
                : calculatePumpHydraulicSnapshot(hydraulicContext, fixedFlow, fixedHead);
            if (!hydraulicSnapshot) {
                resetPumpCalculatedResults(pump, 'Incomplete calculation', ['Unable to calculate fixed-flow hydraulic snapshot.']);
                refreshPumpUiReadouts(pumpId, pump);
                return;
            }

            const demandWarnings = [];
            if (flowRequest.source === 'sink-flow-demand') {
                const selectedPressure = hydraulicContext.dischargeBoundary.props.pressureBasis === 'Stagnation'
                    ? hydraulicSnapshot.sinkStagnationPressureBar
                    : hydraulicSnapshot.sinkStaticPressureBar;
                if (selectedPressure <= 0) {
                    demandWarnings.push('Calculated outlet pressure is at or below 0 bar a for this flow demand.');
                }
            } else {
                demandWarnings.push(...getOverSpecifiedFlowPressureWarnings(flowRequest, hydraulicContext));
                demandWarnings.push(...getFixedFlowHeadMismatchWarnings(flowRequest, fixedHead, systemHeadAtFixedFlow));
            }

            const requiredHeadForReadout = flowRequest.source === 'sink-flow-demand'
                ? fixedHead
                : systemHeadAtFixedFlow;
            const headResidual = flowRequest.source === 'sink-flow-demand'
                ? 0
                : (Number.isFinite(systemHeadAtFixedFlow) ? fixedHead - systemHeadAtFixedFlow : null);
            const solveInfo = {
                solveMode: flowRequest.source === 'sink-flow-demand' ? 'Solved at SNK flow demand' : 'Solved at SRC flow',
                flowBasis: flowRequest.source === 'sink-flow-demand'
                    ? `${hydraulicContext.dischargePath.boundaryId} flow demand`
                    : `${flowRequest.sourceId || hydraulicContext.suctionPath.boundaryId} flow input`,
                fixedFlow,
                requiredSystemHead: requiredHeadForReadout,
                headResidual,
                pressureResidual: Number.isFinite(headResidual) ? pressureHeadToBar(headResidual, density) : null,
                downstreamBoundary: hydraulicContext.dischargePath.boundaryId,
                statusWhenOk: flowRequest.source === 'sink-flow-demand' ? 'Solved at SNK flow demand' : 'Solved at SRC flow'
            };

            applyPumpOperatingPointResults(pump, hydraulicContext, hydraulicSnapshot, fixedFlow, fixedHead, hydraulicContext.density, performanceModel, demandWarnings, solveInfo);
            refreshPumpUiReadouts(pumpId, pump);
            return;
        }

        let opFlow = null, opHead = null;
        let previousPoint = null;
        let firstDiff = null;
        let lastDiff = null;
        
        for (let q = 0; q <= MAX_FLOW; q += STEP) {
            const pHead = getPumpHead(q);
            const sHead = calcSysHead(q);
            
            pump.results.sysCurve.push([q, sHead]);
            pump.results.pumpCurve.push([q, pHead]);
            
            if (opFlow === null && sHead !== null) {
                const diff = pHead - sHead;
                if (firstDiff === null) firstDiff = diff;
                lastDiff = diff;

                if (Math.abs(diff) < 1e-9) {
                    opFlow = q;
                    opHead = pHead;
                } else if (previousPoint && previousPoint.diff >= 0 && diff <= 0) {
                    const denominator = previousPoint.diff - diff;
                    const ratio = denominator === 0 ? 0 : previousPoint.diff / denominator;
                    opFlow = previousPoint.q + (q - previousPoint.q) * ratio;
                    opHead = getPumpHead(opFlow);
                }

                previousPoint = { q, pHead, sHead, diff };
            }
        }

        if (opFlow !== null && hydraulicContext.isComplete) {
            const hydraulicSnapshot = calculatePumpHydraulicSnapshot(hydraulicContext, opFlow, opHead);
            if (!hydraulicSnapshot) {
                resetPumpCalculatedResults(pump, 'Incomplete calculation', ['Unable to calculate hydraulic snapshot at operating point.']);
                return;
            }
            applyPumpOperatingPointResults(pump, hydraulicContext, hydraulicSnapshot, opFlow, opHead, hydraulicContext.density, performanceModel, [], {
                solveMode: 'Solved at pump/system intersection',
                flowBasis: 'Pump/system intersection',
                downstreamBoundary: hydraulicContext.dischargePath.boundaryId
            });
        } else {
            const warnings = [];
            if (!hydraulicContext.isComplete) {
                resetPumpCalculatedResults(pump, 'Incomplete network', getIncompleteHydraulicNetworkWarnings(hydraulicContext));
            } else if (firstDiff !== null && firstDiff < 0) {
                warnings.push('Pump shutoff head is below system static head; no operating point.');
                resetPumpCalculatedResults(pump, 'No intersection', warnings);
            } else if (lastDiff !== null && lastDiff > 0) {
                warnings.push('No pump/system intersection within pump curve range; likely runout/outside curve.');
                resetPumpCalculatedResults(pump, 'Outside curve', warnings);
            } else {
                warnings.push('No stable pump/system operating point found.');
                resetPumpCalculatedResults(pump, 'No operating point', warnings);
            }
        }
        
        refreshPumpUiReadouts(pumpId, pump);
    });

    if (typeof updateAllObjectOperatingStatusVisuals === 'function') {
        updateAllObjectOperatingStatusVisuals();
    }

    updateAllInstrumentReadouts();
    updateAllTankReadouts();
    updateAllValveReadouts();
    updateAllHeatExchangerReadouts();
    updateAllSeparatorReadouts();
    updateAllSinkReadouts();
    if (typeof updateAllSourceCalculationTraceReadouts === 'function') {
        updateAllSourceCalculationTraceReadouts();
    }
    if (typeof updateCanvasWarningPanel === 'function') {
        updateCanvasWarningPanel();
    }
    if (sourceBoundaryChanged && typeof drawConnections === 'function') {
        drawConnections();
    }

    if (renderSidebarAfter && currentSelectedNode && !isSidebarEditActive()) {
        renderSidebar(currentSelectedNode);
    }
}
