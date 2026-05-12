function isSidebarEditActive() {
    const active = document.activeElement;
    return !!(active && active.closest && (
        active.closest('#pipeTaskPropTableBody')
        || active.closest('#taskWindowBody')
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
    const formatted = typeof formatDisplayUnitValueByUnit === 'function'
        ? formatDisplayUnitValueByUnit(value, unit, 3, key, key)
        : null;
    const displayValue = formatted || formatNumericReadout(value) + (unit ? ' ' + unit : '');
    elements.forEach(el => {
        el.textContent = displayValue;
    });
}

function setTankSourceFeedFlowBreakdownReadout(sourceFeedFlows = []) {
    const elements = document.querySelectorAll('[data-key="tank-source-feed-breakdown"]');
    if (!elements.length) return;

    const html = typeof renderTankSourceFeedFlowBreakdown === 'function'
        ? renderTankSourceFeedFlowBreakdown(sourceFeedFlows)
        : (Array.isArray(sourceFeedFlows) && sourceFeedFlows.length
            ? sourceFeedFlows.map(row => `
                <div class="tank-source-feed-row">
                    <span>${escapeHtml(row.sourceId || '-')}</span>
                    <strong>${escapeHtml(formatTraceDisplayValue(row.flow, 'm3/h'))}</strong>
                </div>
            `).join('')
            : '<div class="tank-source-feed-empty">-</div>');

    elements.forEach(el => {
        el.innerHTML = html;
    });
}

function updateTankCalculationTraceReadout(tank) {
    document.querySelectorAll('[data-key="tank-calculation-trace-body"]').forEach(traceBody => {
        const fluidProps = typeof globalModel !== 'undefined' ? (globalModel.FLUID?.props || {}) : {};
        const trace = typeof buildTankCalculationTrace === 'function'
            ? buildTankCalculationTrace(tank, fluidProps, tank?.results || {})
            : tank?.results?.calculationTrace;
        if (typeof renderTankCalculationTraceReport === 'function') {
            traceBody.innerHTML = renderTankCalculationTraceReport(trace);
        }
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
        vaporPressureHead: 'm',
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

function formatInputDisplayValue(value) {
    const number = parseFloat(value);
    if (!Number.isFinite(number)) return value;
    const abs = Math.abs(number);
    if (abs > 0 && abs < 0.000001) return number.toPrecision(8);
    const digits = abs >= 100000 ? 3 : 8;
    return number.toFixed(digits).replace(/\.?0+$/, '');
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

function formatTraceDisplayValue(value, unit = '') {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof formatDisplayUnitValueByUnit === 'function') {
        return formatDisplayUnitValueByUnit(value, unit, 3, '', unit);
    }
    const display = formatReadoutValue(value);
    return `${display}${unit && display !== '-' ? ' ' + unit : ''}`;
}

function renderPipeTraceMetric(label, value, unit = '') {
    return `
        <div class="pipe-trace-metric">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(formatTraceDisplayValue(value, unit))}</strong>
        </div>
    `;
}

function renderPipeTraceStepRows(steps = []) {
    if (!steps.length) {
        return '<tr><td colspan="5" class="pipe-trace-empty">No trace steps available.</td></tr>';
    }
    return steps.map(step => `
        <tr>
            <td data-label="Step">${escapeHtml(step.title || '-')}</td>
            <td data-label="Formula"><code>${escapeHtml(step.formula || '-')}</code></td>
            <td data-label="Substitution">${escapeHtml(step.substitution || '-')}</td>
            <td data-label="Result">${escapeHtml(formatTraceDisplayValue(step.result, step.unit || ''))}</td>
            <td data-label="Reference">${escapeHtml(step.reference || '-')}</td>
        </tr>
    `).join('');
}

function formatPipeMoodySci(value) {
    const number = parseFloat(value);
    if (!Number.isFinite(number) || number <= 0) return '-';
    const exponent = Math.floor(Math.log10(number));
    const mantissa = number / Math.pow(10, exponent);
    return Math.abs(mantissa - 1) < 0.01
        ? `1e${exponent}`
        : `${Number(mantissa.toFixed(1))}e${exponent}`;
}

function formatPipeMoodyNumber(value, digits = 4) {
    const number = parseFloat(value);
    if (!Number.isFinite(number)) return '-';
    if (Math.abs(number) >= 10000 || (Math.abs(number) > 0 && Math.abs(number) < 0.0001)) {
        return number.toExponential(3);
    }
    return Number(number.toFixed(digits)).toString();
}

function renderPipeMoodyChart(moody) {
    if (!moody) return '';

    const markers = moody.markers || [];
    const primaryMarker = markers[0] || null;
    const curveColors = ['#1d4ed8', '#0f766e', '#64748b', '#a16207', '#4d7c0f', '#be123c', '#7c3aed'];
    const markerColors = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0f766e'];
    const width = 680;
    const height = 320;
    const margin = { left: 58, right: 24, top: 22, bottom: 44 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const xMin = moody.xMin || 1000;
    const xMax = moody.xMax || 100000000;
    const yMin = moody.yMin || 0.008;
    const yMax = moody.yMax || 0.12;
    const xMinLog = Math.log10(xMin);
    const xMaxLog = Math.log10(xMax);
    const yMinLog = Math.log10(yMin);
    const yMaxLog = Math.log10(yMax);
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const scaleX = reynolds => margin.left + ((Math.log10(clamp(reynolds, xMin, xMax)) - xMinLog) / (xMaxLog - xMinLog)) * plotWidth;
    const scaleY = friction => margin.top + ((yMaxLog - Math.log10(clamp(friction, yMin, yMax))) / (yMaxLog - yMinLog)) * plotHeight;
    const pathFromPoints = points => (points || [])
        .filter(point => Number.isFinite(point.reynolds) && Number.isFinite(point.frictionFactor))
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${scaleX(point.reynolds).toFixed(2)} ${scaleY(point.frictionFactor).toFixed(2)}`)
        .join(' ');

    const xTicks = [1000, 10000, 100000, 1000000, 10000000, 100000000];
    const yTicks = [0.01, 0.02, 0.03, 0.05, 0.08, 0.1];
    const transitionX = scaleX(moody.laminarLimit || 2300);
    const transitionWidth = scaleX(moody.turbulentLimit || 4000) - transitionX;
    const laminarPath = pathFromPoints(moody.laminarCurve?.points || []);
    const turbulentPaths = (moody.curves || []).map((curve, index) => {
        const path = pathFromPoints(curve.points || []);
        if (!path) return '';
        return `
            <path class="pipe-moody-curve" d="${path}" stroke="${curveColors[index % curveColors.length]}">
                <title>${escapeHtml(curve.label || '-')}</title>
            </path>
        `;
    }).join('');

    const markerGuides = markers.map((marker, index) => {
        const x = scaleX(marker.reynolds);
        const y = scaleY(marker.frictionFactor);
        const color = markerColors[index % markerColors.length];
        return `
            <g class="pipe-moody-guide" style="--guide-color: ${color}">
                <line x1="${x.toFixed(2)}" y1="${y.toFixed(2)}" x2="${x.toFixed(2)}" y2="${(margin.top + plotHeight).toFixed(2)}"></line>
                <line x1="${margin.left}" y1="${y.toFixed(2)}" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}"></line>
            </g>
        `;
    }).join('');

    const markerNodes = markers.map((marker, index) => {
        const x = scaleX(marker.reynolds);
        const y = scaleY(marker.frictionFactor);
        const color = markerColors[index % markerColors.length];
        const calloutX = clamp(x + 14, margin.left + 6, margin.left + plotWidth - 118);
        const calloutY = clamp(y - 25, margin.top + 6, margin.top + plotHeight - 35);
        return `
            <g class="pipe-moody-callout" transform="translate(${calloutX.toFixed(2)} ${calloutY.toFixed(2)})">
                <rect width="112" height="29" rx="6"></rect>
                <text x="8" y="12">${escapeHtml(marker.name || `Segment ${index + 1}`)}</text>
                <text x="8" y="24">f ${escapeHtml(formatPipeMoodyNumber(marker.frictionFactor, 5))} | Re ${escapeHtml(formatPipeMoodySci(marker.reynolds))}</text>
            </g>
            <g class="pipe-moody-marker" transform="translate(${x.toFixed(2)} ${y.toFixed(2)})">
                <circle class="pipe-moody-marker-halo" r="12" fill="${color}"></circle>
                <circle class="pipe-moody-marker-dot" r="6.2" fill="${color}"></circle>
                <text y="3.4">${index + 1}</text>
                <title>${escapeHtml(marker.name)} | Re ${formatPipeMoodyNumber(marker.reynolds, 0)} | Darcy f ${formatPipeMoodyNumber(marker.frictionFactor, 5)} | eps/D ${formatPipeMoodyNumber(marker.relRoughness, 6)}</title>
            </g>
        `;
    }).join('');

    const markerSummary = markers.length
        ? markers.map((marker, index) => `
            <span class="pipe-moody-marker-chip" style="--marker-color: ${markerColors[index % markerColors.length]}">
                <b>${index + 1}</b>
                ${escapeHtml(marker.name)}:
                Re ${escapeHtml(formatPipeMoodyNumber(marker.reynolds, 0))},
                eps/D ${escapeHtml(formatPipeMoodyNumber(marker.relRoughness, 6))},
                f ${escapeHtml(formatPipeMoodyNumber(marker.frictionFactor, 5))},
                ${escapeHtml(marker.flowRegime || '-')}
            </span>
        `).join('')
        : '<span class="pipe-moody-empty">Moody chart needs positive solved pipe flow.</span>';

    const curveLegend = (moody.curves || []).map((curve, index) => `
        <span class="pipe-moody-legend-item">
            <i style="background: ${curveColors[index % curveColors.length]}"></i>${escapeHtml(curve.label || '-')}
        </span>
    `).join('');
    const statusText = primaryMarker ? primaryMarker.flowRegime || '-' : 'Awaiting solved flow';
    const statCards = [
        ['Primary Re', primaryMarker ? formatPipeMoodyNumber(primaryMarker.reynolds, 0) : '-'],
        ['Darcy f', primaryMarker ? formatPipeMoodyNumber(primaryMarker.frictionFactor, 5) : '-'],
        ['eps/D', primaryMarker ? formatPipeMoodyNumber(primaryMarker.relRoughness, 6) : '-'],
        ['Regime', statusText]
    ];

    return `
        <div class="pipe-trace-block pipe-moody-block">
            <h4>Moody Chart / Friction Factor Check</h4>
            <div class="pipe-moody-card">
                <div class="pipe-moody-header">
                    <div class="pipe-moody-title">
                        <span>Friction Factor Audit</span>
                        <strong>Moody Chart</strong>
                    </div>
                    <div class="pipe-moody-stat-grid">
                        ${statCards.map(([label, value]) => `
                            <span class="pipe-moody-stat">
                                <span>${escapeHtml(label)}</span>
                                <strong>${escapeHtml(value)}</strong>
                            </span>
                        `).join('')}
                    </div>
                </div>
                <div class="pipe-moody-chart-wrap">
                    <svg class="pipe-moody-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Moody chart friction factor check">
                        <defs>
                            <linearGradient id="pipeMoodyBg" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stop-color="#fbfdff"></stop>
                                <stop offset="55%" stop-color="#eef6fc"></stop>
                                <stop offset="100%" stop-color="#fff7ed"></stop>
                            </linearGradient>
                            <linearGradient id="pipeMoodyPlot" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="#ffffff"></stop>
                                <stop offset="100%" stop-color="#f8fbfd"></stop>
                            </linearGradient>
                        </defs>
                        <rect class="pipe-moody-bg" x="0" y="0" width="${width}" height="${height}"></rect>
                        <rect class="pipe-moody-plot-bg" x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${plotHeight}"></rect>
                        <rect class="pipe-moody-transition" x="${transitionX.toFixed(2)}" y="${margin.top}" width="${transitionWidth.toFixed(2)}" height="${plotHeight}"></rect>
                        ${xTicks.map(tick => `
                            <line class="pipe-moody-grid" x1="${scaleX(tick).toFixed(2)}" y1="${margin.top}" x2="${scaleX(tick).toFixed(2)}" y2="${margin.top + plotHeight}"></line>
                            <text class="pipe-moody-axis-label pipe-moody-x-label" x="${scaleX(tick).toFixed(2)}" y="${height - 16}">${formatPipeMoodySci(tick)}</text>
                        `).join('')}
                        ${yTicks.map(tick => `
                            <line class="pipe-moody-grid" x1="${margin.left}" y1="${scaleY(tick).toFixed(2)}" x2="${margin.left + plotWidth}" y2="${scaleY(tick).toFixed(2)}"></line>
                            <text class="pipe-moody-axis-label pipe-moody-y-label" x="${margin.left - 8}" y="${scaleY(tick).toFixed(2)}">${formatPipeMoodyNumber(tick, 3)}</text>
                        `).join('')}
                        <path class="pipe-moody-laminar" d="${laminarPath}"></path>
                        ${turbulentPaths}
                        ${markerGuides}
                        <line class="pipe-moody-axis" x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${margin.left + plotWidth}" y2="${margin.top + plotHeight}"></line>
                        <line class="pipe-moody-axis" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}"></line>
                        <text class="pipe-moody-axis-title" x="${margin.left + plotWidth / 2}" y="${height - 2}">Reynolds Number</text>
                        <text class="pipe-moody-axis-title pipe-moody-y-title" x="14" y="${margin.top + plotHeight / 2}">Darcy f</text>
                        <text class="pipe-moody-band-label" x="${transitionX + transitionWidth / 2}" y="${margin.top + 14}">Transition</text>
                        ${markerNodes}
                    </svg>
                </div>
                <div class="pipe-moody-marker-list">
                    ${markerSummary}
                </div>
                <div class="pipe-moody-note">
                    ${escapeHtml(moody.note || 'Darcy friction factor chart.')}
                </div>
                <div class="pipe-moody-legend">
                    <span class="pipe-moody-legend-item"><i class="pipe-moody-laminar-swatch"></i>Laminar f = 64/Re</span>
                    ${curveLegend}
                </div>
            </div>
        </div>
    `;
}

function renderPipeCalculationTraceReport(trace) {
    if (!trace) {
        return '<div class="pipe-trace-empty">Calculation trace is not available for this pipe.</div>';
    }

    const basis = trace.basis || {};
    const totals = trace.totals || {};
    const basisMetrics = [
        ['Flow Rate', basis.flowM3H, 'm3/h'],
        ['Flow Rate', basis.flowM3S, 'm3/s'],
        ['Density', basis.density, 'kg/m3'],
        ['Kin. Viscosity', basis.viscosityCSt, 'cSt'],
        ['Vapor Pressure', basis.vaporPressureBarA, 'bar a'],
        ['Aging Factor', basis.roughnessAgingFactor, 'x'],
        ['Loss Allowance', basis.headLossAllowancePercent, '%'],
        ['Elevation Mode', basis.elevationProfileMode, '']
    ];
    const totalMetrics = [
        ['Major Loss', totals.majorLoss, 'm'],
        ['Minor Loss', totals.minorLoss, 'm'],
        ['Allowance Loss', totals.allowanceLoss, 'm'],
        ['Total Head Loss', totals.totalLoss, 'm'],
        ['Total K', totals.totalK, ''],
        ['Controlling HP Segment', totals.controllingHighPointSegment || '-', ''],
        ['High Point P', totals.highPointPressure, 'bar a'],
        ['High Point Margin', totals.highPointVaporMargin, 'bar']
    ];
    const warnings = trace.warnings || [];

    const segmentBlocks = (trace.segments || []).map(segment => {
        const dataSources = segment.dataSources || {};
        const profile = segment.profile || {};
        const pressureSteps = segment.pressureSteps || [];
        return `
            <section class="pipe-trace-segment">
                <div class="pipe-trace-segment-title">
                    <strong>${escapeHtml(segment.name || `Segment ${(segment.index ?? 0) + 1}`)}</strong>
                    <span>${escapeHtml(segment.flowRegime || '-')}</span>
                </div>
                <div class="pipe-trace-metric-grid pipe-trace-mini-grid">
                    ${renderPipeTraceMetric('Pipe Size Basis', dataSources.size?.status || '-', '')}
                    ${renderPipeTraceMetric('Material Basis', dataSources.material?.status || '-', '')}
                    ${renderPipeTraceMetric('Fitting Basis', dataSources.fitting?.status || '-', '')}
                    ${renderPipeTraceMetric('z in', profile.startElevation, 'm')}
                    ${renderPipeTraceMetric('z out', profile.endElevation, 'm')}
                    ${renderPipeTraceMetric('P in', profile.startPressure, 'bar a')}
                    ${renderPipeTraceMetric('P out', profile.endPressure, 'bar a')}
                    ${renderPipeTraceMetric('HP z', profile.highPointElevation, 'm')}
                    ${renderPipeTraceMetric('HP Margin', profile.highPointVaporMargin, 'bar')}
                </div>
                <div class="pipe-trace-source-note">
                    Pipe ID: ${escapeHtml(dataSources.size?.source || '-')} | Roughness: ${escapeHtml(dataSources.material?.source || '-')} | Fitting K: ${escapeHtml(dataSources.fitting?.source || '-')}
                </div>
                <div class="pipe-trace-table-scroll">
                    <table class="pipe-trace-table">
                        <thead>
                            <tr>
                                <th>Step</th>
                                <th>Formula</th>
                                <th>Substitution</th>
                                <th>Result</th>
                                <th>Reference</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${renderPipeTraceStepRows([...(segment.steps || []), ...pressureSteps])}
                        </tbody>
                    </table>
                </div>
            </section>
        `;
    }).join('');

    return `
        <div class="pipe-trace-status ${trace.isSolved ? 'pipe-trace-status-solved' : 'pipe-trace-status-unsolved'}">
            ${escapeHtml(trace.message || '-')}
        </div>
        <div class="pipe-trace-block">
            <h4>Input Basis</h4>
            <div class="pipe-trace-metric-grid">
                ${basisMetrics.map(([label, value, unit]) => renderPipeTraceMetric(label, value, unit)).join('')}
            </div>
        </div>
        <div class="pipe-trace-block">
            <h4>Total Pipe Summary</h4>
            <div class="pipe-trace-metric-grid">
                ${totalMetrics.map(([label, value, unit]) => renderPipeTraceMetric(label, value, unit)).join('')}
            </div>
        </div>
        <div class="pipe-trace-block">
            <h4>Dependency Chain</h4>
            <ol class="pipe-trace-list pipe-dependency-chain">
                ${((trace.dependencyChain || []).length ? trace.dependencyChain : ['No pipe dependency chain available.']).map(item => `<li>${escapeHtml(item)}</li>`).join('')}
            </ol>
        </div>
        ${renderPipeMoodyChart(trace.moody)}
        <div class="pipe-trace-block">
            <h4>Per Segment Calculation</h4>
            ${segmentBlocks || '<div class="pipe-trace-empty">No segment calculation is available until the pipe has positive solved flow.</div>'}
        </div>
        <div class="pipe-trace-block">
            <h4>Warnings</h4>
            <ul class="pipe-trace-list">
                ${(warnings.length ? warnings : ['OK']).map(item => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
        </div>
        <div class="pipe-trace-block">
            <h4>Data Notes</h4>
            <ul class="pipe-trace-list">
                ${(trace.notes || []).map(item => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
        </div>
        <div class="pipe-trace-block">
            <h4>References</h4>
            <ul class="pipe-trace-list">
                ${(trace.references || []).map(item => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
        </div>
    `;
}

function refreshVisiblePipeCalculationTrace(nodeId) {
    const node = globalModel?.[nodeId];
    if (!node || node.type !== 'pipe') return;
    if (typeof normalizePipeProps === 'function') normalizePipeProps(node.props);

    const updatedFlow = node.results && node.results.pressureCalculated ? parseFloat(node.results.flow) || 0 : 0;
    const updatedDetails = typeof calculatePipeHydraulicSegments === 'function'
        ? new Map(calculatePipeHydraulicSegments(updatedFlow, node.props).map(result => [result.index, result]))
        : new Map();
    const updatedProfiles = new Map((node.results?.segmentProfiles || []).map(profile => [profile.index, profile]));
    const updatedHeadLoss = [...updatedDetails.values()].reduce((sum, result) => sum + result.totalLoss, 0);
    const updatedMajorLoss = [...updatedDetails.values()].reduce((sum, result) => sum + result.majorLoss, 0);
    const updatedFittingLoss = [...updatedDetails.values()].reduce((sum, result) => sum + result.minorLoss, 0);
    const updatedAllowanceLoss = [...updatedDetails.values()].reduce((sum, result) => sum + result.allowanceLoss, 0);
    const updatedTotalK = [...updatedDetails.values()].reduce((sum, result) => sum + result.minorLossK, 0);
    const updatedDataBasis = updatedDetails.size
        ? [...new Set([...updatedDetails.values()].flatMap(result => [result.sizeSource?.status, result.materialSource?.status, result.fittingSource?.status]).filter(Boolean))].join(' / ')
        : '-';
    const updatedFlowRegime = updatedDetails.size
        ? [...new Set([...updatedDetails.values()].map(result => result.flowRegime).filter(Boolean))].join(' / ')
        : '-';
    const updatedWarnings = [...new Set([
        ...((node.results?.warnings || []).filter(Boolean)),
        ...(typeof getPipeValveCompatibilityWarnings === 'function' ? getPipeValveCompatibilityWarnings(nodeId, globalModel, connections) : []),
        ...[...updatedDetails.values()].map(result => result.regimeWarning).filter(Boolean)
    ])];

    setSidebarReadout('pipe-flow', node.results?.flow ?? 0, 'm3/h');
    setSidebarReadout('pipe-pressure', node.results?.pressure, 'bar a');
    setSidebarReadout('pipe-inlet-pressure', node.results?.inletPressure, 'bar a');
    setSidebarReadout('pipe-outlet-pressure', node.results?.outletPressure, 'bar a');
    setSidebarReadout('pipe-head-loss', updatedHeadLoss, 'm');
    setSidebarReadout('pipe-major-loss', updatedMajorLoss, 'm');
    setSidebarReadout('pipe-fitting-loss', updatedFittingLoss, 'm');
    setSidebarReadout('pipe-allowance-loss', updatedAllowanceLoss, 'm');
    setSidebarReadout('pipe-total-k', updatedTotalK, '');
    setSidebarReadout('pipe-flow-regime', updatedFlowRegime, '');
    setSidebarReadout('pipe-high-point-pressure', node.results?.highPointPressure, 'bar a');
    setSidebarReadout('pipe-high-point-margin', node.results?.highPointVaporMargin, 'bar');
    setSidebarReadout('pipe-high-point-segment', node.results?.highPointSegment || '-', '');
    setSidebarReadout('pipe-data-basis', updatedDataBasis, '');
    setSidebarReadout('pipe-warnings', updatedWarnings.join(' | ') || 'OK', '');

    document.querySelectorAll('[data-key="pipe-calculation-trace-body"]').forEach(traceBody => {
        if (typeof buildPipeCalculationTrace === 'function') {
            traceBody.innerHTML = renderPipeCalculationTraceReport(
                buildPipeCalculationTrace(updatedFlow, node.props, node.results)
            );
        }
    });

    document.querySelectorAll('#pipeSegmentTable tbody tr').forEach((row, idx) => {
        const result = updatedDetails.get(idx) || {};
        const profile = updatedProfiles.get(idx) || {};
        const readouts = {
            velocity: formatEngineeringValue(result.velocity, 2),
            reynolds: Number.isFinite(result.reynolds) ? Math.round(result.reynolds).toLocaleString() : '-',
            flowRegime: result.flowRegime || '-',
            frictionFactor: formatEngineeringValue(result.frictionFactor, 4),
            minorLossK: formatEngineeringValue(result.minorLossK, 2),
            majorLoss: formatEngineeringValue(result.majorLoss, 2),
            fittingLoss: formatEngineeringValue(result.minorLoss, 2),
            allowanceLoss: formatEngineeringValue(result.allowanceLoss, 2),
            totalLoss: formatEngineeringValue(result.totalLoss, 2),
            effectiveRoughnessMm: formatEngineeringValue((result.effectiveRoughness || 0) * 1000, 4),
            startPressure: formatEngineeringValue(profile.startPressure, 2),
            endPressure: formatEngineeringValue(profile.endPressure, 2),
            highPointPressure: formatEngineeringValue(profile.highPointPressure, 2),
            highPointVaporMargin: formatEngineeringValue(profile.highPointVaporMargin, 2),
            basis: [
                result.sizeSource?.status || '',
                result.materialSource?.status || '',
                result.fittingSource?.status || ''
            ].filter(Boolean).join('/') || '-'
        };

        Object.entries(readouts).forEach(([key, value]) => {
            const cell = row.querySelector(`[data-segment-result="${key}"]`);
            if (cell) cell.textContent = value;
        });
    });
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
    if (typeof closePipePropertiesTaskWindow === 'function') closePipePropertiesTaskWindow();
    if (typeof closeTankPropertiesTaskWindow === 'function') closeTankPropertiesTaskWindow();
    if (typeof closeObjectPropertiesTaskWindow === 'function') closeObjectPropertiesTaskWindow();
    if (typeof hideTaskWindowLauncher === 'function') hideTaskWindowLauncher();
}

function addPumpPropertiesRow(tbody, label, value, key, options = {}) {
    const {
        readonly = true,
        unit = '',
        inputType = 'number',
        choices = []
    } = options;
    const tr = document.createElement('tr');
    if (tbody?.closest?.('.object-task-prop-table')) {
        tr.className = 'pipe-task-field-row object-task-field-row pump-task-field-row';
    }
    const tdLabel = document.createElement('td');
    tdLabel.className = 'prop-label';
    tdLabel.textContent = label;

    const tdValue = document.createElement('td');
    tdValue.className = 'prop-value';

    if (readonly) {
        if (key) tdValue.dataset.key = key;
        const displayText = typeof formatDisplayUnitValueByUnit === 'function'
            ? formatDisplayUnitValueByUnit(value, unit, 3, key, label)
            : null;
        if (displayText) {
            tdValue.textContent = displayText;
        } else {
            const displayValue = formatReadoutValue(value);
            tdValue.textContent = displayValue + (unit && displayValue !== '-' ? ' ' + unit : '');
        }
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
        const displayText = typeof formatDisplayUnitValueByUnit === 'function'
            ? formatDisplayUnitValueByUnit(card.value, card.unit || '', 3, card.key || '', card.label)
            : null;
        if (displayText) {
            value.textContent = displayText;
        } else {
            const displayValue = formatReadoutValue(card.value);
            value.textContent = displayValue + (card.unit && displayValue !== '-' ? ' ' + card.unit : '');
        }
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
    return formatTraceDisplayValue(value, 'm');
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
    return formatTraceDisplayValue(value, unit);
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
        empty.textContent = 'Calculation trace is available after the pump has a complete upstream tank/SRC boundary, downstream boundary, and solved NPSH evaluation.';
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
    return formatTraceDisplayValue(value, unit);
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

function renderPumpPropertiesSidebar(nodeId, targets = null, options = {}) {
    const header = targets?.header;
    const tbody = targets?.body;
    const node = nodeId ? globalModel[nodeId] : null;

    if (!targets || !header || !tbody) return;

    if (!node || node.type !== 'pump') return;

    if (typeof normalizePumpProps === 'function') normalizePumpProps(node.props);
    if (typeof ensureNodeResults === 'function') ensureNodeResults(node);

    if (!options.append) {
        header.textContent = node.name || nodeId;
        tbody.innerHTML = '';
    }

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

    if (node.type !== 'pipe' && typeof closePipePropertiesTaskWindow === 'function') {
        closePipePropertiesTaskWindow();
    }
    if (node.type !== 'tank' && typeof closeTankPropertiesTaskWindow === 'function') {
        closeTankPropertiesTaskWindow();
    }
    if (['pipe', 'tank', 'fluid'].includes(node.type) && typeof closeObjectPropertiesTaskWindow === 'function') {
        closeObjectPropertiesTaskWindow();
    }

    if (node.type === 'pipe'
        && typeof isPipePropertiesTaskDismissed === 'function'
        && isPipePropertiesTaskDismissed(nodeId)) {
        if (typeof showPipePropertiesTaskNotice === 'function') {
            showPipePropertiesTaskNotice(nodeId);
        }
        return;
    }
    if (node.type === 'tank'
        && typeof isTankPropertiesTaskDismissed === 'function'
        && isTankPropertiesTaskDismissed(nodeId)) {
        if (typeof showTankPropertiesTaskNotice === 'function') {
            showTankPropertiesTaskNotice(nodeId);
        }
        return;
    }
    if (!['pipe', 'tank', 'fluid'].includes(node.type)
        && typeof isObjectPropertiesTaskDismissed === 'function'
        && isObjectPropertiesTaskDismissed(nodeId)) {
        if (typeof showObjectPropertiesTaskNotice === 'function') {
            showObjectPropertiesTaskNotice(nodeId);
        }
        return;
    }

    const pipeTaskOpened = node.type === 'pipe'
        && typeof openPipePropertiesTaskWindow === 'function'
        && openPipePropertiesTaskWindow(nodeId);
    const pipeTaskTargets = pipeTaskOpened && typeof getPipePropertiesTaskTargets === 'function'
        ? getPipePropertiesTaskTargets()
        : null;
    if (pipeTaskOpened && typeof showPipePropertiesTaskNotice === 'function') {
        showPipePropertiesTaskNotice(nodeId);
    }
    const tankTaskOpened = node.type === 'tank'
        && typeof openTankPropertiesTaskWindow === 'function'
        && openTankPropertiesTaskWindow(nodeId);
    const tankTaskTargets = tankTaskOpened && typeof getTankPropertiesTaskTargets === 'function'
        ? getTankPropertiesTaskTargets()
        : null;
    if (tankTaskOpened && typeof showTankPropertiesTaskNotice === 'function') {
        showTankPropertiesTaskNotice(nodeId);
    }
    const objectTaskOpened = !['pipe', 'tank', 'fluid'].includes(node.type)
        && typeof openObjectPropertiesTaskWindow === 'function'
        && openObjectPropertiesTaskWindow(nodeId);
    const objectTaskTargets = objectTaskOpened && typeof getObjectPropertiesTaskTargets === 'function'
        ? getObjectPropertiesTaskTargets()
        : null;
    if (objectTaskOpened && typeof showObjectPropertiesTaskNotice === 'function') {
        showObjectPropertiesTaskNotice(nodeId);
    }
    const taskTargets = pipeTaskTargets || tankTaskTargets || objectTaskTargets;

    const headerEl = taskTargets?.header;
    if (!headerEl) return;
    headerEl.textContent = node.name || nodeId;

    const tbody = taskTargets?.body;
    if (!tbody) return;
    tbody.innerHTML = ''; // clear
    
    // Helper to add rows
    const addRow = (label, value, key, isReadOnly = false, unit = '', inputType = null, options = []) => {
        const tr = document.createElement('tr');
        if (taskTargets) {
            tr.className = node.type === 'tank'
                ? 'pipe-task-field-row tank-task-field-row'
                : (node.type === 'pipe' ? 'pipe-task-field-row' : 'pipe-task-field-row object-task-field-row');
        }
        if (key) tr.dataset.propKey = key;
        
        const tdLabel = document.createElement('td');
        tdLabel.className = 'prop-label';
        tdLabel.textContent = label;
        
        const tdVal = document.createElement('td');
        tdVal.className = 'prop-value';
        const shouldFormatWithUnit = !!unit && typeof getDisplayValueWithUnit === 'function';
        const displayMeta = shouldFormatWithUnit
            ? getDisplayValueWithUnit(value, node.type, key, label, unit)
            : { value, unit };
        const displayUnit = displayMeta.unit || unit;
        const displayValueRaw = displayMeta.value;
        
        if (isReadOnly) {
            if (key) tdVal.dataset.key = key;
            const displayValue = formatReadoutValue(displayValueRaw);
            tdVal.textContent = displayValue + (displayUnit && displayValue !== '-' ? ' ' + displayUnit : '');
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
                inp.type = inputType === 'number' || typeof value === 'number' ? 'number' : 'text';
                inp.className = 'prop-input-field';
                inp.value = Number.isFinite(parseFloat(displayValueRaw)) && inp.type === 'number'
                    ? formatInputDisplayValue(displayValueRaw)
                    : value;
            }
            inp.dataset.key = key;
            inp.dataset.node = nodeId;
            inp.dataset.unit = unit || '';
            inp.dataset.displayUnit = displayUnit || '';
            inp.dataset.quantity = displayMeta.quantity || '';
            inp.addEventListener('blur', () => releaseSidebarEditCapture(inp));
            
            // On input change, update model and resimulate
            inp.addEventListener(inputType === 'select' ? 'change' : 'input', (e) => {
                const k = e.target.dataset.key;
                const n = e.target.dataset.node;
                const rawInputValue = e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
                const v = e.target.type === 'number' && e.target.dataset.quantity && typeof getInternalValueFromDisplay === 'function'
                    ? getInternalValueFromDisplay(rawInputValue, globalModel[n].type, k, label, e.target.dataset.unit || '')
                    : rawInputValue;
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
                    const tankGeometryKeys = ['liquidLevel', 'diameter', 'tankHeight'];
                    const tankValidationKeys = [
                        ...tankGeometryKeys,
                        'hll',
                        'nll',
                        'lll',
                        'tLevelElev',
                        'inletNozzleElevation',
                        'outletNozzleElevation',
                        'elevation'
                    ];
                    const tankVentingKeys = [
                        'pressure',
                        'pressureInputBasis',
                        'tankCodeBasis',
                        'tankDesignPressure',
                        'designVacuum',
                        'pressureVentSet',
                        'vacuumVentSet',
                        'emergencyVentProvided'
                    ];

                    if (k === 'tankCodeBasis' && typeof applyTankCodeBasisReferencePreset === 'function') {
                        applyTankCodeBasisReferencePreset(globalModel[n], v);
                        if (typeof updateTankPressureReadout === 'function') updateTankPressureReadout(n);
                        renderSidebar(n);
                        updateSimulation({ renderSidebarAfter: false });
                        return;
                    }

                    if (tankGeometryKeys.includes(k)) {
                        if (typeof refreshTankInventoryCalculations === 'function') {
                            refreshTankInventoryCalculations(globalModel[n].props);
                        } else if (typeof calculateTankLiquidVolume === 'function') {
                            globalModel[n].props.liquidVolume = calculateTankLiquidVolume(
                                globalModel[n].props.diameter || 0,
                                globalModel[n].props.liquidLevel || 0
                            );
                        }
                        setSidebarReadout('tank-liquid-volume', globalModel[n].props.liquidVolume, 'm3');
                        setSidebarReadout('tank-total-capacity', globalModel[n].props.totalCapacity, 'm3');
                        setSidebarReadout('tank-fill-percent', globalModel[n].props.fillPercent, '%');
                    }

                    if (tankValidationKeys.includes(k) || tankVentingKeys.includes(k)) {
                        if (typeof normalizeTankProps === 'function') normalizeTankProps(globalModel[n]);
                        if (typeof updateTankPressureReadout === 'function') updateTankPressureReadout(n);

                        if (k === 'pressureInputBasis' || k === 'tankCodeBasis' || k === 'emergencyVentProvided') {
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

                if (globalModel[n].type === 'pipe' && (k === 'routeStyle' || k === 'elevationProfileMode')) {
                    if (typeof normalizePipeProps === 'function') normalizePipeProps(globalModel[n].props);
                    drawConnections();
                    updateSimulation({ renderSidebarAfter: false });
                    renderSidebar(n);
                    return;
                }

                if (globalModel[n].type === 'pipe' && [
                    'startElevation',
                    'endElevation',
                    'highPointElevation',
                    'highPointLocationPercent',
                    'roughnessAgingFactor',
                    'headLossAllowancePercent'
                ].includes(k)) {
                    if (typeof normalizePipeProps === 'function') normalizePipeProps(globalModel[n].props);
                    updateSimulation({ renderSidebarAfter: false });
                    refreshVisiblePipeCalculationTrace(n);
                    return;
                }

                if (globalModel[n].type === 'valve' && k === 'valveType' && typeof getValveDefaultK === 'function') {
                    const previousDefaultK = getValveDefaultK(previousValue);
                    const currentK = parseFloat(globalModel[n].props.kValue);
                    const previousProfile = typeof getValveDefaultProfile === 'function' ? getValveDefaultProfile(previousValue) : null;
                    const nextProfile = typeof getValveDefaultProfile === 'function' ? getValveDefaultProfile(v) : null;
                    if (!Number.isFinite(currentK) || Math.abs(currentK - previousDefaultK) < 1e-9) {
                        globalModel[n].props.kValue = getValveDefaultK(v);
                    }
                    if (previousProfile && nextProfile) {
                        ['boreType', 'pressureClass', 'endConnection', 'bodyMaterial', 'reducerExpanderBasis'].forEach(profileKey => {
                            if (!globalModel[n].props[profileKey] || globalModel[n].props[profileKey] === previousProfile[profileKey]) {
                                globalModel[n].props[profileKey] = nextProfile[profileKey];
                            }
                        });
                    }
                    if (v === 'Control Valve' && previousValue !== 'Control Valve') {
                        if (!globalModel[n].props.lossModel) {
                            globalModel[n].props.lossModel = typeof VALVE_LOSS_MODEL_CV !== 'undefined' ? VALVE_LOSS_MODEL_CV : 'Cv';
                        }
                        if (!globalModel[n].props.flowCharacteristic || globalModel[n].props.flowCharacteristic === 'Linear') {
                            globalModel[n].props.flowCharacteristic = typeof VALVE_CHAR_EQUAL_PERCENTAGE !== 'undefined' ? VALVE_CHAR_EQUAL_PERCENTAGE : 'Equal percentage';
                        }
                    }
                    renderSidebar(n);
                    updateSimulation({ renderSidebarAfter: false });
                    return;
                }

                if (['valve', 'checkValve'].includes(globalModel[n].type) && [
                    'boreType',
                    'boreDiameter',
                    'pressureClass',
                    'endConnection',
                    'bodyMaterial',
                    'lossModel',
                    'flowCharacteristic',
                    'cv',
                    'effectiveCv',
                    'kValue',
                    'equivLength',
                    'diameter',
                    'reducerExpanderBasis',
                    'opening',
                    'crackingPressure',
                    'reverseFlow'
                ].includes(k)) {
                    if (typeof normalizeValveAuditProps === 'function') normalizeValveAuditProps(globalModel[n]);
                    if (typeof updateValveCompatibilityResult === 'function') {
                        updateValveCompatibilityResult(n, globalModel, connections, { syncDiameter: false });
                    }
                    updateSimulation({ renderSidebarAfter: false });
                    if (typeof updateValveReadout === 'function') updateValveReadout(n);
                    return;
                }

                if (globalModel[n].type === 'source' && ['sourceType', 'boundaryDataSource', 'pressureEnergyBasis'].includes(k)) {
                    if (typeof reconcileSourceBoundaryConfiguration === 'function') {
                        reconcileSourceBoundaryConfiguration(n, { detachInvalidAttachment: k === 'sourceType' });
                    }
                    if (typeof normalizeSourceProps === 'function') normalizeSourceProps(globalModel[n]);
                    if (typeof drawConnections === 'function') drawConnections();
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

                if (globalModel[n].type === 'source' && (k === 'pressure' || k === 'pressureInputBasis' || k === 'elevation')) {
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
                    if (v === (typeof SOURCE_FLOW_MODE_SOLVE !== 'undefined' ? SOURCE_FLOW_MODE_SOLVE : 'Solve from Network')) {
                        renderSidebar(n);
                        updateSimulation();
                        return;
                    }
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

                if (['separator', 'verticalVessel'].includes(globalModel[n].type) && [
                    'pressure',
                    'pressureInputBasis',
                    'pressureDrop',
                    'residenceTime',
                    'elevation',
                    'liquidLevel',
                    'inletNozzleElevation',
                    'outletNozzleElevation'
                ].includes(k)) {
                    if (typeof updateSeparatorReadout === 'function') updateSeparatorReadout(n);
                    if (k === 'pressureInputBasis') {
                        renderSidebar(n);
                    }
                    updateSimulation({ renderSidebarAfter: false });
                    return;
                }

                if (globalModel[n].type === 'heatExchanger' && ['duty', 'pressureDrop', 'outletTemp'].includes(k)) {
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
            if (displayUnit) {
                const unitSpan = document.createElement('span');
                unitSpan.className = 'prop-unit';
                unitSpan.textContent = displayUnit;
                tdVal.appendChild(unitSpan);
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
        addRow('Suction Nozzle Elev.', node.props.suctionElevation, 'suctionElevation', false, 'm', 'number');
        addRow('Discharge Nozzle Elev.', node.props.dischargeElevation, 'dischargeElevation', false, 'm', 'number');

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
            const pumpFlowUnit = typeof getDisplayUnit === 'function' ? getDisplayUnit('flow') : 'm3/h';
            const pumpHeadUnit = typeof getDisplayUnit === 'function' ? getDisplayUnit('head') : 'm';
            const displayPumpCurveValue = (value, quantity, digits = 3) => {
                const display = typeof convertToDisplay === 'function' ? convertToDisplay(value, quantity) : value;
                return formatEngineeringValue(display, digits);
            };
            const internalPumpCurveValue = (value, quantity) => {
                const parsed = parseFloat(value);
                if (!Number.isFinite(parsed)) return 0;
                return typeof convertFromDisplay === 'function' ? convertFromDisplay(parsed, quantity) : parsed;
            };
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
                                    <th>Flow (${escapeHtml(pumpFlowUnit)})</th>
                                    <th>Head (${escapeHtml(pumpHeadUnit)})</th>
                                    <th>Eff %</th>
                                    <th>NPSHr (${escapeHtml(pumpHeadUnit)})</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
            `;
            
            node.props.curveData.forEach((pt, i) => {
                curveHtml += `
                    <tr>
                        <td><input type="number" class="segment-input" data-idx="${i}" data-field="flow" value="${displayPumpCurveValue(pt.flow, 'flow', 3)}"></td>
                        <td><input type="number" class="segment-input" data-idx="${i}" data-field="head" value="${displayPumpCurveValue(pt.head, 'head', 3)}"></td>
                        <td><input type="number" class="segment-input" data-idx="${i}" data-field="eff" value="${pt.eff}"></td>
                        <td><input type="number" class="segment-input" data-idx="${i}" data-field="npshr" value="${displayPumpCurveValue(pt.npshr, 'head', 3)}"></td>
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
                    const quantity = field === 'flow' ? 'flow' : (field === 'head' || field === 'npshr' ? 'head' : null);
                    node.props.curveData[idx][field] = quantity
                        ? internalPumpCurveValue(e.target.value, quantity)
                        : parseFloat(e.target.value) || 0;
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
        addRow('Pipe Rating/Class', node.props.pressureClass || 'ASME Class 150', 'pressureClass', false, '', 'select', typeof PIPE_PRESSURE_CLASS_OPTIONS !== 'undefined' ? PIPE_PRESSURE_CLASS_OPTIONS : ['ASME Class 150', 'ASME Class 300', 'ASME Class 600', 'PN16', 'User-defined']);
        addRow('End Connection Basis', node.props.endConnection || 'By piping class / compatible', 'endConnection', false, '', 'select', typeof PIPE_END_CONNECTION_OPTIONS !== 'undefined' ? PIPE_END_CONNECTION_OPTIONS : ['By piping class / compatible', 'Flanged RF', 'Butt weld', 'Threaded NPT', 'Socket weld', 'User-defined']);
        addRow('Elevation Profile', node.props.elevationProfileMode || 'End Elevations', 'elevationProfileMode', false, '', 'select', ['Ignore', 'End Elevations', 'High Point Check']);
        if (node.props.elevationProfileMode !== 'Ignore') {
            addRow('Start Elevation Override', node.props.startElevation ?? '', 'startElevation', false, 'm', 'number');
            addRow('End Elevation Override', node.props.endElevation ?? '', 'endElevation', false, 'm', 'number');
        }
        if (node.props.elevationProfileMode === 'High Point Check') {
            addRow('High Point Elevation', node.props.highPointElevation ?? '', 'highPointElevation', false, 'm', 'number');
            addRow('High Point Location', node.props.highPointLocationPercent ?? 50, 'highPointLocationPercent', false, '% length', 'number');
        }
        addRow('Aging Roughness Factor', node.props.roughnessAgingFactor ?? 1, 'roughnessAgingFactor', false, 'x', 'number');
        addRow('Head Loss Allowance', node.props.headLossAllowancePercent ?? 0, 'headLossAllowancePercent', false, '%', 'number');

        const flowForPipe = node.results && node.results.pressureCalculated ? parseFloat(node.results.flow) || 0 : 0;
        const segmentResults = calculatePipeHydraulicSegments(flowForPipe, node.props);
        const segmentResultByIndex = new Map(segmentResults.map(result => [result.index, result]));
        const segmentProfileByIndex = new Map((node.results?.segmentProfiles || []).map(profile => [profile.index, profile]));
        const totalHeadLoss = segmentResults.reduce((sum, result) => sum + result.totalLoss, 0);
        const totalMajorLoss = segmentResults.reduce((sum, result) => sum + result.majorLoss, 0);
        const totalFittingLoss = segmentResults.reduce((sum, result) => sum + result.minorLoss, 0);
        const totalAllowanceLoss = segmentResults.reduce((sum, result) => sum + result.allowanceLoss, 0);
        const totalMinorK = segmentResults.reduce((sum, result) => sum + result.minorLossK, 0);
        const showSegmentElevations = node.props.elevationProfileMode !== 'Ignore';
        const showHighPointColumns = node.props.elevationProfileMode === 'High Point Check';
        const dataBasisText = segmentResults.length
            ? [...new Set(segmentResults.flatMap(result => [result.sizeSource?.status, result.materialSource?.status, result.fittingSource?.status]).filter(Boolean))].join(' / ')
            : '-';
        const pipeFlowRegime = segmentResults.length
            ? [...new Set(segmentResults.map(result => result.flowRegime).filter(Boolean))].join(' / ')
            : '-';
        const pipeWarnings = [...new Set([
            ...((node.results?.warnings || []).filter(Boolean)),
            ...(typeof getPipeValveCompatibilityWarnings === 'function' ? getPipeValveCompatibilityWarnings(nodeId, globalModel, connections) : []),
            ...segmentResults.map(result => result.regimeWarning).filter(Boolean)
        ])];

        const pipeResultsTr = document.createElement('tr');
        pipeResultsTr.innerHTML = `
            <td colspan="2" style="padding: 10px 12px;">
                <div class="pipe-result-grid">
                    <div class="pipe-result-card">
                        <span>Flow Rate</span>
                        <strong data-key="pipe-flow">${escapeHtml(formatTraceDisplayValue(node.results?.flow ?? 0, 'm3/h'))}</strong>
                    </div>
                    <div class="pipe-result-card">
                        <span>Pipe Pressure</span>
                        <strong data-key="pipe-pressure">${escapeHtml(formatTraceDisplayValue(node.results?.pressure, 'bar a'))}</strong>
                    </div>
                    <div class="pipe-result-card">
                        <span>Inlet Pressure</span>
                        <strong data-key="pipe-inlet-pressure">${escapeHtml(formatTraceDisplayValue(node.results?.inletPressure, 'bar a'))}</strong>
                    </div>
                    <div class="pipe-result-card">
                        <span>Outlet Pressure</span>
                        <strong data-key="pipe-outlet-pressure">${escapeHtml(formatTraceDisplayValue(node.results?.outletPressure, 'bar a'))}</strong>
                    </div>
                    <div class="pipe-result-card pipe-result-card-wide">
                        <span>Total Head Loss</span>
                        <strong data-key="pipe-head-loss">${escapeHtml(formatTraceDisplayValue(totalHeadLoss, 'm'))}</strong>
                    </div>
                    <div class="pipe-result-card">
                        <span>Major Loss</span>
                        <strong data-key="pipe-major-loss">${escapeHtml(formatTraceDisplayValue(totalMajorLoss, 'm'))}</strong>
                    </div>
                    <div class="pipe-result-card">
                        <span>Minor Loss</span>
                        <strong data-key="pipe-fitting-loss">${escapeHtml(formatTraceDisplayValue(totalFittingLoss, 'm'))}</strong>
                    </div>
                    <div class="pipe-result-card">
                        <span>Allowance Loss</span>
                        <strong data-key="pipe-allowance-loss">${escapeHtml(formatTraceDisplayValue(totalAllowanceLoss, 'm'))}</strong>
                    </div>
                    <div class="pipe-result-card">
                        <span>Total K</span>
                        <strong data-key="pipe-total-k">${formatReadoutValue(totalMinorK)}</strong>
                    </div>
                    <div class="pipe-result-card">
                        <span>Flow Regime</span>
                        <strong data-key="pipe-flow-regime">${escapeHtml(pipeFlowRegime)}</strong>
                    </div>
                    <div class="pipe-result-card">
                        <span>High Point P</span>
                        <strong data-key="pipe-high-point-pressure">${escapeHtml(formatTraceDisplayValue(node.results?.highPointPressure, 'bar a'))}</strong>
                    </div>
                    <div class="pipe-result-card">
                        <span>High Point Margin</span>
                        <strong data-key="pipe-high-point-margin">${escapeHtml(formatTraceDisplayValue(node.results?.highPointVaporMargin, 'bar'))}</strong>
                    </div>
                    <div class="pipe-result-card">
                        <span>High Point Segment</span>
                        <strong data-key="pipe-high-point-segment">${escapeHtml(node.results?.highPointSegment || '-')}</strong>
                    </div>
                    <div class="pipe-result-card">
                        <span>Data Basis</span>
                        <strong data-key="pipe-data-basis">${escapeHtml(dataBasisText)}</strong>
                    </div>
                    <div class="pipe-result-card pipe-result-card-wide">
                        <span>Warnings</span>
                        <strong data-key="pipe-warnings">${escapeHtml(pipeWarnings.join(' | ') || 'OK')}</strong>
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
        const pipeDiameterUnit = typeof getDisplayUnit === 'function' ? getDisplayUnit('diameter') : 'm';
        const pipeLengthUnit = typeof getDisplayUnit === 'function' ? getDisplayUnit('length') : 'm';
        const pipeRoughnessUnit = typeof getDisplayUnit === 'function' ? getDisplayUnit('roughness') : 'mm';
        const pipeHeadUnit = typeof getDisplayUnit === 'function' ? getDisplayUnit('head') : 'm';
        const pipeSpeedUnit = typeof getDisplayUnit === 'function' ? getDisplayUnit('speed') : 'm/s';
        const segmentElevationHeaders = showSegmentElevations
            ? `<th>z in (${escapeHtml(pipeHeadUnit)})</th><th>z out (${escapeHtml(pipeHeadUnit)})</th><th>P in</th><th>P out</th>`
            : '';
        const highPointHeaders = showHighPointColumns
            ? `<th>HP z (${escapeHtml(pipeHeadUnit)})</th><th>HP %</th><th>HP P</th><th>HP Margin</th>`
            : '';
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
                                <th>ID (${escapeHtml(pipeDiameterUnit)})</th>
                                <th>Len (${escapeHtml(pipeLengthUnit)})</th>
                                <th>Material</th>
                                <th>eps (${escapeHtml(pipeRoughnessUnit)})</th>
                                <th>eps eff</th>
                                <th>Fitting</th>
                                <th>Qty</th>
                                <th>K each</th>
                                <th>Add K</th>
                                <th>Total K</th>
                                ${segmentElevationHeaders}
                                ${highPointHeaders}
                                <th>V (${escapeHtml(pipeSpeedUnit)})</th>
                                <th>Re</th>
                                <th>Regime</th>
                                <th>Darcy f</th>
                                <th>Major hL (${escapeHtml(pipeHeadUnit)})</th>
                                <th>Minor hL (${escapeHtml(pipeHeadUnit)})</th>
                                <th>hL Allow (${escapeHtml(pipeHeadUnit)})</th>
                                <th>Total hL (${escapeHtml(pipeHeadUnit)})</th>
                                <th>Basis</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        const displayPipeValue = (value, quantity, digits = 2) => {
            if (value === '' || value === null || value === undefined) return '';
            const display = typeof convertToDisplay === 'function' ? convertToDisplay(value, quantity) : value;
            return formatEngineeringValue(display, digits);
        };
        const internalPipeValue = (value, quantity) => {
            const parsed = parseFloat(value);
            if (!Number.isFinite(parsed)) return '';
            return typeof convertFromDisplay === 'function' ? convertFromDisplay(parsed, quantity) : parsed;
        };

        node.props.segments.forEach((seg, i) => {
            const result = segmentResultByIndex.get(i) || {};
            const profile = segmentProfileByIndex.get(i) || {};
            const diameterReadonly = seg.pipeSize !== 'Custom diameter' ? 'readonly' : '';
            const fittingKReadonly = seg.fittingType !== PIPE_FITTING_CUSTOM ? 'readonly' : '';
            const segmentElevationCells = showSegmentElevations ? `
                    <td><input type="number" class="segment-input" data-idx="${i}" data-field="startElevation" value="${displayPipeValue(seg.startElevation, 'head', 2)}" step="0.1"></td>
                    <td><input type="number" class="segment-input" data-idx="${i}" data-field="endElevation" value="${displayPipeValue(seg.endElevation, 'head', 2)}" step="0.1"></td>
                    <td class="segment-readout" data-segment-result="startPressure">${escapeHtml(formatTraceDisplayValue(profile.startPressure, 'bar a'))}</td>
                    <td class="segment-readout" data-segment-result="endPressure">${escapeHtml(formatTraceDisplayValue(profile.endPressure, 'bar a'))}</td>
            ` : '';
            const highPointCells = showHighPointColumns ? `
                    <td><input type="number" class="segment-input" data-idx="${i}" data-field="highPointElevation" value="${displayPipeValue(seg.highPointElevation, 'head', 2)}" step="0.1"></td>
                    <td><input type="number" class="segment-input" data-idx="${i}" data-field="highPointLocationPercent" value="${formatEngineeringValue(seg.highPointLocationPercent ?? 50, 1)}" step="1"></td>
                    <td class="segment-readout" data-segment-result="highPointPressure">${escapeHtml(formatTraceDisplayValue(profile.highPointPressure, 'bar a'))}</td>
                    <td class="segment-readout" data-segment-result="highPointVaporMargin">${escapeHtml(formatTraceDisplayValue(profile.highPointVaporMargin, 'bar'))}</td>
            ` : '';
            const basisText = [
                result.sizeSource?.status || '',
                result.materialSource?.status || '',
                result.fittingSource?.status || ''
            ].filter(Boolean).join('/');
            segHtml += `
                <tr>
                    <td><input type="text" class="segment-input" data-idx="${i}" data-field="name" value="${escapeHtml(seg.name)}"></td>
                    <td><select class="segment-input" data-idx="${i}" data-field="pipeSize" data-value="${escapeHtml(seg.pipeSize)}">${pipeSizeOptionsHtml}</select></td>
                    <td><input type="number" class="segment-input" data-idx="${i}" data-field="diameter" value="${displayPipeValue(seg.diameter, 'diameter', pipeDiameterUnit === 'm' ? 5 : 3)}" step="0.001" ${diameterReadonly}></td>
                    <td><input type="number" class="segment-input" data-idx="${i}" data-field="length" value="${displayPipeValue(seg.length, 'length', 2)}" step="0.1"></td>
                    <td><select class="segment-input" data-idx="${i}" data-field="material" data-value="${escapeHtml(seg.material)}">${materialOptionsHtml}</select></td>
                    <td><input type="number" class="segment-input" data-idx="${i}" data-field="roughnessMm" value="${displayPipeValue(seg.roughness || 0, 'roughness', 4)}" step="0.001"></td>
                    <td class="segment-readout" data-segment-result="effectiveRoughnessMm">${displayPipeValue(result.effectiveRoughness || 0, 'roughness', 4)}</td>
                    <td><select class="segment-input" data-idx="${i}" data-field="fittingType" data-value="${escapeHtml(seg.fittingType)}">${fittingOptionsHtml}</select></td>
                    <td><input type="number" class="segment-input" data-idx="${i}" data-field="fittingQuantity" value="${formatEngineeringValue(seg.fittingQuantity || 0, 0)}" step="1"></td>
                    <td><input type="number" class="segment-input" data-idx="${i}" data-field="fittingK" value="${formatEngineeringValue(seg.fittingK || 0, 3)}" step="0.01" ${fittingKReadonly}></td>
                    <td><input type="number" class="segment-input" data-idx="${i}" data-field="minorLoss" value="${formatEngineeringValue(seg.minorLoss || 0, 2)}" step="0.1"></td>
                    <td class="segment-readout" data-segment-result="minorLossK">${formatEngineeringValue(result.minorLossK, 2)}</td>
                    ${segmentElevationCells}
                    ${highPointCells}
                    <td class="segment-readout" data-segment-result="velocity">${displayPipeValue(result.velocity, 'speed', 2)}</td>
                    <td class="segment-readout" data-segment-result="reynolds">${Number.isFinite(result.reynolds) ? Math.round(result.reynolds).toLocaleString() : '-'}</td>
                    <td class="segment-readout" data-segment-result="flowRegime">${escapeHtml(result.flowRegime || '-')}</td>
                    <td class="segment-readout" data-segment-result="frictionFactor">${formatEngineeringValue(result.frictionFactor, 4)}</td>
                    <td class="segment-readout" data-segment-result="majorLoss">${displayPipeValue(result.majorLoss, 'head', 2)}</td>
                    <td class="segment-readout" data-segment-result="fittingLoss">${displayPipeValue(result.minorLoss, 'head', 2)}</td>
                    <td class="segment-readout" data-segment-result="allowanceLoss">${displayPipeValue(result.allowanceLoss, 'head', 2)}</td>
                    <td class="segment-readout" data-segment-result="totalLoss">${displayPipeValue(result.totalLoss, 'head', 2)}</td>
                    <td class="segment-readout" data-segment-result="basis">${escapeHtml(basisText || '-')}</td>
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

        const traceTr = document.createElement('tr');
        const traceTd = document.createElement('td');
        traceTd.colSpan = 2;
        traceTd.className = 'pipe-trace-cell';
        const pipeTrace = typeof buildPipeCalculationTrace === 'function'
            ? buildPipeCalculationTrace(flowForPipe, node.props, node.results)
            : null;
        const traceOpenAttribute = typeof window === 'undefined' || window.innerWidth >= 700 ? 'open' : '';
        traceTd.innerHTML = `
            <details class="pipe-calculation-trace" ${traceOpenAttribute}>
                <summary>Calculation Trace / Step-by-step Report</summary>
                <div class="pipe-calculation-trace-body" data-key="pipe-calculation-trace-body">
                    ${renderPipeCalculationTraceReport(pipeTrace)}
                </div>
            </details>
        `;
        traceTr.appendChild(traceTd);
        tbody.appendChild(traceTr);

        const refreshPipeSegmentReadouts = () => {
            normalizePipeProps(node.props);
            updateSimulation({ renderSidebarAfter: false });
            const updatedFlow = node.results && node.results.pressureCalculated ? parseFloat(node.results.flow) || 0 : 0;
            const updatedDetails = new Map(calculatePipeHydraulicSegments(updatedFlow, node.props).map(result => [result.index, result]));
            const updatedProfiles = new Map((node.results?.segmentProfiles || []).map(profile => [profile.index, profile]));
            const updatedHeadLoss = [...updatedDetails.values()].reduce((sum, result) => sum + result.totalLoss, 0);
            const updatedMajorLoss = [...updatedDetails.values()].reduce((sum, result) => sum + result.majorLoss, 0);
            const updatedFittingLoss = [...updatedDetails.values()].reduce((sum, result) => sum + result.minorLoss, 0);
            const updatedAllowanceLoss = [...updatedDetails.values()].reduce((sum, result) => sum + result.allowanceLoss, 0);
            const updatedTotalK = [...updatedDetails.values()].reduce((sum, result) => sum + result.minorLossK, 0);
            const updatedDataBasis = updatedDetails.size
                ? [...new Set([...updatedDetails.values()].flatMap(result => [result.sizeSource?.status, result.materialSource?.status, result.fittingSource?.status]).filter(Boolean))].join(' / ')
                : '-';
            const updatedFlowRegime = updatedDetails.size
                ? [...new Set([...updatedDetails.values()].map(result => result.flowRegime).filter(Boolean))].join(' / ')
                : '-';
            const updatedWarnings = [...new Set([
                ...((node.results?.warnings || []).filter(Boolean)),
                ...(typeof getPipeValveCompatibilityWarnings === 'function' ? getPipeValveCompatibilityWarnings(nodeId, globalModel, connections) : []),
                ...[...updatedDetails.values()].map(result => result.regimeWarning).filter(Boolean)
            ])];

            setSidebarReadout('pipe-flow', node.results?.flow ?? 0, 'm3/h');
            setSidebarReadout('pipe-pressure', node.results?.pressure, 'bar a');
            setSidebarReadout('pipe-inlet-pressure', node.results?.inletPressure, 'bar a');
            setSidebarReadout('pipe-outlet-pressure', node.results?.outletPressure, 'bar a');
            setSidebarReadout('pipe-head-loss', updatedHeadLoss, 'm');
            setSidebarReadout('pipe-major-loss', updatedMajorLoss, 'm');
            setSidebarReadout('pipe-fitting-loss', updatedFittingLoss, 'm');
            setSidebarReadout('pipe-allowance-loss', updatedAllowanceLoss, 'm');
            setSidebarReadout('pipe-total-k', updatedTotalK, '');
            setSidebarReadout('pipe-flow-regime', updatedFlowRegime, '');
            setSidebarReadout('pipe-high-point-pressure', node.results?.highPointPressure, 'bar a');
            setSidebarReadout('pipe-high-point-margin', node.results?.highPointVaporMargin, 'bar');
            setSidebarReadout('pipe-high-point-segment', node.results?.highPointSegment || '-', '');
            setSidebarReadout('pipe-data-basis', updatedDataBasis, '');
            setSidebarReadout('pipe-warnings', updatedWarnings.join(' | ') || 'OK', '');
            const traceBody = traceTr.querySelector('[data-key="pipe-calculation-trace-body"]');
            if (traceBody && typeof buildPipeCalculationTrace === 'function') {
                traceBody.innerHTML = renderPipeCalculationTraceReport(buildPipeCalculationTrace(updatedFlow, node.props, node.results));
            }

            segTd.querySelectorAll('#pipeSegmentTable tbody tr').forEach((row, idx) => {
                const result = updatedDetails.get(idx) || {};
                const profile = updatedProfiles.get(idx) || {};
                const velocityCell = row.querySelector('[data-segment-result="velocity"]');
                const reynoldsCell = row.querySelector('[data-segment-result="reynolds"]');
                const flowRegimeCell = row.querySelector('[data-segment-result="flowRegime"]');
                const frictionCell = row.querySelector('[data-segment-result="frictionFactor"]');
                const totalKCell = row.querySelector('[data-segment-result="minorLossK"]');
                const majorLossCell = row.querySelector('[data-segment-result="majorLoss"]');
                const fittingLossCell = row.querySelector('[data-segment-result="fittingLoss"]');
                const allowanceLossCell = row.querySelector('[data-segment-result="allowanceLoss"]');
                const totalLossCell = row.querySelector('[data-segment-result="totalLoss"]');
                const effectiveRoughnessCell = row.querySelector('[data-segment-result="effectiveRoughnessMm"]');
                const startPressureCell = row.querySelector('[data-segment-result="startPressure"]');
                const endPressureCell = row.querySelector('[data-segment-result="endPressure"]');
                const highPointPressureCell = row.querySelector('[data-segment-result="highPointPressure"]');
                const highPointMarginCell = row.querySelector('[data-segment-result="highPointVaporMargin"]');
                const basisCell = row.querySelector('[data-segment-result="basis"]');
                if (velocityCell) velocityCell.textContent = displayPipeValue(result.velocity, 'speed', 2);
                if (reynoldsCell) reynoldsCell.textContent = Number.isFinite(result.reynolds) ? Math.round(result.reynolds).toLocaleString() : '-';
                if (flowRegimeCell) flowRegimeCell.textContent = result.flowRegime || '-';
                if (frictionCell) frictionCell.textContent = formatEngineeringValue(result.frictionFactor, 4);
                if (totalKCell) totalKCell.textContent = formatEngineeringValue(result.minorLossK, 2);
                if (majorLossCell) majorLossCell.textContent = displayPipeValue(result.majorLoss, 'head', 2);
                if (fittingLossCell) fittingLossCell.textContent = displayPipeValue(result.minorLoss, 'head', 2);
                if (allowanceLossCell) allowanceLossCell.textContent = displayPipeValue(result.allowanceLoss, 'head', 2);
                if (totalLossCell) totalLossCell.textContent = displayPipeValue(result.totalLoss, 'head', 2);
                if (effectiveRoughnessCell) effectiveRoughnessCell.textContent = displayPipeValue(result.effectiveRoughness || 0, 'roughness', 4);
                if (startPressureCell) startPressureCell.textContent = formatTraceDisplayValue(profile.startPressure, 'bar a');
                if (endPressureCell) endPressureCell.textContent = formatTraceDisplayValue(profile.endPressure, 'bar a');
                if (highPointPressureCell) highPointPressureCell.textContent = formatTraceDisplayValue(profile.highPointPressure, 'bar a');
                if (highPointMarginCell) highPointMarginCell.textContent = formatTraceDisplayValue(profile.highPointVaporMargin, 'bar');
                if (basisCell) basisCell.textContent = [
                    result.sizeSource?.status || '',
                    result.materialSource?.status || '',
                    result.fittingSource?.status || ''
                ].filter(Boolean).join('/') || '-';
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
                        if (diameterInput) diameterInput.value = displayPipeValue(segment.diameter, 'diameter', pipeDiameterUnit === 'm' ? 5 : 3);
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
                        if (roughnessInput) roughnessInput.value = displayPipeValue(segment.roughness, 'roughness', 4);
                    }
                    refreshPipeSegmentReadouts();
                    return;
                }

                if (field === 'roughnessMm') {
                    segment.roughness = Math.max(0, internalPipeValue(e.target.value, 'roughness') || 0);
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
                } else if (['startElevation', 'endElevation', 'highPointElevation'].includes(field)) {
                    const parsed = internalPipeValue(e.target.value, 'head');
                    segment[field] = Number.isFinite(parsed) ? parsed : '';
                } else if (field === 'highPointLocationPercent') {
                    segment[field] = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                } else if (field === 'diameter') {
                    segment[field] = Math.max(0, internalPipeValue(e.target.value, 'diameter') || 0);
                } else if (field === 'length') {
                    segment[field] = Math.max(0, internalPipeValue(e.target.value, 'length') || 0);
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
                    updateSimulation({ renderSidebarAfter: false });
                    renderSidebar(nodeId);
                    return;
                }
                if (segment && field === 'pipeSize') {
                    segment.pipeSize = e.target.value;
                    const sizeOption = getPipeSizeOption(segment.pipeSize);
                    if (sizeOption && sizeOption.diameter) {
                        segment.diameter = sizeOption.diameter;
                        const diameterInput = e.target.closest('tr')?.querySelector('[data-field="diameter"]');
                        if (diameterInput) diameterInput.value = displayPipeValue(segment.diameter, 'diameter', pipeDiameterUnit === 'm' ? 5 : 3);
                    }
                }
                if (segment && field === 'material') {
                    segment.material = e.target.value;
                    const materialOption = getPipeMaterialOption(segment.material);
                    if (materialOption && materialOption.roughness !== null) {
                        segment.roughness = materialOption.roughness;
                        const roughnessInput = e.target.closest('tr')?.querySelector('[data-field="roughnessMm"]');
                        if (roughnessInput) roughnessInput.value = displayPipeValue(segment.roughness, 'roughness', 4);
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
                minorLoss: 0,
                startElevation: '',
                endElevation: '',
                highPointElevation: '',
                highPointLocationPercent: 50
            });
            normalizePipeProps(node.props);
            updateSimulation({ renderSidebarAfter: false });
            renderSidebar(nodeId);
        });
        
        segTd.querySelectorAll('.btn-remove-segment').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                captureState();
                node.props.segments.splice(idx, 1);
                normalizePipeProps(node.props);
                updateSimulation({ renderSidebarAfter: false });
                renderSidebar(nodeId);
            });
        });

    } else {
        if (typeof renderObjectProperties === 'function') {
            renderObjectProperties(node.type, nodeId, node, addRow, tbody);
        } else {
            addRow('Notes', 'No custom properties defined for this object type.', '', true);
        }
        if (node.type === 'pump' && taskTargets) {
            renderPumpPropertiesSidebar(nodeId, taskTargets, { append: true });
        }
    }
}

let chartJsLoadPromise = null;

function loadChartJsOnDemand() {
    if (window.Chart) return Promise.resolve(window.Chart);
    if (chartJsLoadPromise) return chartJsLoadPromise;

    chartJsLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'vendor/chart.umd.min.js';
        script.async = true;
        script.onload = () => {
            if (window.Chart) {
                resolve(window.Chart);
            } else {
                reject(new Error('Chart.js loaded without exposing Chart.'));
            }
        };
        script.onerror = () => reject(new Error('Unable to load Chart.js.'));
        document.head.appendChild(script);
    });

    return chartJsLoadPromise;
}

// Modal Chart Init
async function initializeChart() {
    if (pumpChartInstance) return pumpChartInstance;
    await loadChartJsOnDemand();
    const chartCanvas = document.getElementById('pumpChart');
    if (!chartCanvas) return null;
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

async function ensurePumpChartReady() {
    if (pumpChartInstance) return pumpChartInstance;
    return initializeChart();
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
