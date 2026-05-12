function toPumpNumber(value, fallback = 0) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function clampPumpNumber(value, fallback, min, max) {
    return Math.min(max, Math.max(min, toPumpNumber(value, fallback)));
}

function normalizePumpProps(props = {}) {
    const manualMode = typeof PUMP_OPTIMIZATION_MODE_MANUAL !== 'undefined' ? PUMP_OPTIMIZATION_MODE_MANUAL : 'Manual';
    const autoMode = typeof PUMP_OPTIMIZATION_MODE_AUTO !== 'undefined' ? PUMP_OPTIMIZATION_MODE_AUTO : 'Auto';
    const estimatedNpshr = typeof PUMP_NPSHR_SOURCE_ESTIMATED !== 'undefined' ? PUMP_NPSHR_SOURCE_ESTIMATED : 'Estimated';
    const manualNpshr = typeof PUMP_NPSHR_SOURCE_MANUAL !== 'undefined' ? PUMP_NPSHR_SOURCE_MANUAL : 'Manual';
    const curveNpshr = typeof PUMP_NPSHR_SOURCE_CURVE !== 'undefined' ? PUMP_NPSHR_SOURCE_CURVE : 'Manufacturer/Test Curve';
    if (![manualMode, autoMode].includes(props.optimizationMode)) {
        props.optimizationMode = manualMode;
    }
    if (props.inputMode === 'Advanced') {
        props.npshrSourceMode = curveNpshr;
    } else if (![estimatedNpshr, manualNpshr].includes(props.npshrSourceMode)) {
        props.npshrSourceMode = estimatedNpshr;
    }

    props.elevation = toPumpNumber(props.elevation, 0);
    if (props.suctionElevation === undefined || props.suctionElevation === null || props.suctionElevation === '') {
        props.suctionElevation = props.elevation;
    }
    if (props.dischargeElevation === undefined || props.dischargeElevation === null || props.dischargeElevation === '') {
        props.dischargeElevation = props.elevation;
    }
    props.designFlow = clampPumpNumber(props.designFlow, 100, 0.001, 1000000);
    props.designHead = clampPumpNumber(props.designHead, 40, 0.001, 1000000);
    props.designEfficiency = clampPumpNumber(props.designEfficiency, 75, 1, 95);
    props.designNpshr = clampPumpNumber(props.designNpshr, 3, 0.01, 10000);
    props.bepFlow = clampPumpNumber(props.bepFlow, props.designFlow, 0.001, 1000000);
    props.porMinPercent = clampPumpNumber(props.porMinPercent, 70, 1, 200);
    props.porMaxPercent = clampPumpNumber(props.porMaxPercent, 120, 1, 250);
    props.aorMinPercent = clampPumpNumber(props.aorMinPercent, 50, 1, 200);
    props.aorMaxPercent = clampPumpNumber(props.aorMaxPercent, 130, 1, 300);
    props.minNpshMarginRatio = clampPumpNumber(props.minNpshMarginRatio, 1.1, 1, 10);
    props.minNpshMargin = clampPumpNumber(props.minNpshMargin, 0.5, 0, 1000);

    if (props.porMinPercent > props.porMaxPercent) {
        const tmp = props.porMinPercent;
        props.porMinPercent = props.porMaxPercent;
        props.porMaxPercent = tmp;
    }
    if (props.aorMinPercent > props.aorMaxPercent) {
        const tmp = props.aorMinPercent;
        props.aorMinPercent = props.aorMaxPercent;
        props.aorMaxPercent = tmp;
    }

    props.aorMinPercent = Math.min(props.aorMinPercent, props.porMinPercent);
    props.aorMaxPercent = Math.max(props.aorMaxPercent, props.porMaxPercent);
    return props;
}

function isPumpAutoOptimizationEnabled(pump) {
    return false;
}

function interpolatePumpCurvePoint(curveData, q, key) {
    const data = (curveData || [])
        .filter(point => Number.isFinite(toPumpNumber(point.flow, NaN)))
        .map(point => ({
            flow: toPumpNumber(point.flow),
            head: toPumpNumber(point.head),
            eff: toPumpNumber(point.eff),
            npshr: toPumpNumber(point.npshr)
        }))
        .sort((a, b) => a.flow - b.flow);

    if (data.length === 0) return 0;
    if (q <= data[0].flow) return data[0][key];
    if (q >= data[data.length - 1].flow) return data[data.length - 1][key];

    for (let i = 0; i < data.length - 1; i++) {
        if (q >= data[i].flow && q <= data[i + 1].flow) {
            const span = data[i + 1].flow - data[i].flow;
            const ratio = span === 0 ? 0 : (q - data[i].flow) / span;
            return data[i][key] + (data[i + 1][key] - data[i][key]) * ratio;
        }
    }

    return 0;
}

function getValidPumpCurveData(curveData) {
    return (curveData || [])
        .map(point => ({
            flow: toPumpNumber(point.flow, NaN),
            head: toPumpNumber(point.head, NaN),
            eff: toPumpNumber(point.eff, NaN),
            npshr: toPumpNumber(point.npshr, NaN)
        }))
        .filter(point => (
            Number.isFinite(point.flow)
            && Number.isFinite(point.head)
            && Number.isFinite(point.eff)
            && Number.isFinite(point.npshr)
            && point.flow >= 0
            && point.head >= 0
            && point.eff >= 0
            && point.npshr >= 0
        ))
        .sort((a, b) => a.flow - b.flow);
}

function getAdvancedPumpCurveWarnings(curve, rawCount) {
    const warnings = [];
    if (curve.length !== rawCount) {
        warnings.push('Some pump curve rows are invalid and were ignored.');
    }
    for (let i = 1; i < curve.length; i++) {
        if (curve[i].flow <= curve[i - 1].flow) {
            warnings.push('Pump curve flow points must be strictly increasing for reliable interpolation.');
            break;
        }
    }
    for (let i = 1; i < curve.length; i++) {
        if (curve[i].head > curve[i - 1].head) {
            warnings.push('Pump head curve is not monotonically decreasing; verify manufacturer/test data.');
            break;
        }
    }
    return warnings;
}

function createPumpPerformanceModel(pump) {
    const props = normalizePumpProps(pump.props || {});
    const estimatedNpshr = typeof PUMP_NPSHR_SOURCE_ESTIMATED !== 'undefined' ? PUMP_NPSHR_SOURCE_ESTIMATED : 'Estimated';
    const manualNpshr = typeof PUMP_NPSHR_SOURCE_MANUAL !== 'undefined' ? PUMP_NPSHR_SOURCE_MANUAL : 'Manual';
    const curveNpshr = typeof PUMP_NPSHR_SOURCE_CURVE !== 'undefined' ? PUMP_NPSHR_SOURCE_CURVE : 'Manufacturer/Test Curve';

    if (props.inputMode === 'Advanced' && props.curveData && props.curveData.length > 0) {
        const rawCount = props.curveData.length;
        const curve = getValidPumpCurveData(props.curveData);
        if (curve.length >= 2) {
            const bestPoint = curve.reduce((best, point) => (
                toPumpNumber(point.eff) > toPumpNumber(best.eff) ? point : best
            ), curve[0]);
            props.bepFlow = clampPumpNumber(props.bepFlow, toPumpNumber(bestPoint.flow, props.designFlow), 0.001, 1000000);

            return {
                source: 'Advanced manufacturer/test curve',
                modelBasis: 'User-entered pump performance data',
                warnings: getAdvancedPumpCurveWarnings(curve, rawCount),
                isEstimated: false,
                npshrSourceMode: curveNpshr,
                npshrIsEstimated: false,
                bepFlow: props.bepFlow,
                minFlow: Math.max(0, toPumpNumber(curve[0].flow)),
                maxFlow: Math.max(...curve.map(point => toPumpNumber(point.flow))),
                getHead: q => Math.max(0, interpolatePumpCurvePoint(curve, q, 'head')),
                getEfficiency: q => Math.max(0, interpolatePumpCurvePoint(curve, q, 'eff')),
                getNpshr: q => Math.max(0, interpolatePumpCurvePoint(curve, q, 'npshr'))
            };
        }
    }

    const qBep = props.bepFlow || props.designFlow;
    const hBep = props.designHead;
    const eBep = props.designEfficiency;
    const npshrBep = props.designNpshr;
    const shutoffHead = hBep * 1.25;
    const runoutFlow = qBep * 1.7;
    const headDrop = shutoffHead - hBep;
    const npshrSourceMode = props.npshrSourceMode === manualNpshr ? manualNpshr : estimatedNpshr;
    const npshrWarnings = npshrSourceMode === manualNpshr
        ? ['Manual NPSHr is user supplied; verify it against manufacturer/test data for academic validation.']
        : [
            'Estimated NPSHr is a generic approximation, not manufacturer/test data.',
            'Use Manual NPSHr or Advanced manufacturer/test curve for thesis validation.'
        ];

    return {
        source: 'Basic estimated curve',
        modelBasis: npshrSourceMode === manualNpshr
            ? 'Generic head/efficiency curve with manual NPSHr'
            : 'Generic sizing estimate',
        warnings: [
            'Basic curve is a generic estimate, not an HI/manufacturer certified performance curve.',
            ...npshrWarnings
        ],
        isEstimated: true,
        npshrSourceMode,
        npshrIsEstimated: npshrSourceMode !== manualNpshr,
        bepFlow: qBep,
        minFlow: 0,
        maxFlow: runoutFlow,
        getHead: q => Math.max(0, shutoffHead - headDrop * Math.pow(q / qBep, 2)),
        getEfficiency: q => {
            const ratio = q / qBep;
            const shape = Math.max(0, 1 - 1.75 * Math.pow(ratio - 1, 2));
            return Math.max(0, eBep * shape);
        },
        getNpshr: q => {
            if (npshrSourceMode === manualNpshr) return Math.max(0.01, npshrBep);
            const ratio = Math.max(0, q / qBep);
            return Math.max(0.01, npshrBep * (0.65 + 0.35 * Math.pow(ratio, 2.2)));
        }
    };
}

function classifyPumpOperatingRegion(flowRateM3H, props = {}) {
    normalizePumpProps(props);
    const bepFlow = Math.max(toPumpNumber(props.bepFlow, props.designFlow), 0.001);
    const ratio = toPumpNumber(flowRateM3H) / bepFlow;
    const percent = ratio * 100;

    if (percent >= props.porMinPercent && percent <= props.porMaxPercent) {
        return { status: 'POR', ratio, percent, message: 'Within preferred operating region' };
    }
    if (percent >= props.aorMinPercent && percent <= props.aorMaxPercent) {
        return { status: 'AOR', ratio, percent, message: 'Within allowable operating region, outside POR' };
    }
    return { status: 'Outside AOR', ratio, percent, message: 'Outside configured allowable operating region' };
}

function evaluateNpshMargin(npsha, npshr, props = {}) {
    normalizePumpProps(props);
    const available = toPumpNumber(npsha, NaN);
    const required = toPumpNumber(npshr, NaN);
    if (!Number.isFinite(available) || !Number.isFinite(required) || required <= 0) {
        return {
            margin: null,
            ratio: null,
            status: 'Unknown',
            message: 'NPSH margin cannot be evaluated'
        };
    }

    const margin = available - required;
    const ratio = available / required;
    const isCavitationRisk = available <= required;
    const isWithinMargin = margin >= props.minNpshMargin && ratio >= props.minNpshMarginRatio;
    let status = 'Safe';
    let message = 'NPSH margin OK';
    if (isCavitationRisk) {
        status = 'Cavitation Risk';
        message = 'NPSHa is at or below NPSHr; cavitation risk is high.';
    } else if (!isWithinMargin) {
        status = 'Warning';
        message = 'NPSH margin is below the configured minimum.';
    }

    return {
        margin,
        ratio,
        status,
        message
    };
}

function getPumpNpshrSourceLabel(performanceModel) {
    if (!performanceModel) return '-';
    const manualNpshr = typeof PUMP_NPSHR_SOURCE_MANUAL !== 'undefined' ? PUMP_NPSHR_SOURCE_MANUAL : 'Manual';
    const curveNpshr = typeof PUMP_NPSHR_SOURCE_CURVE !== 'undefined' ? PUMP_NPSHR_SOURCE_CURVE : 'Manufacturer/Test Curve';
    if (performanceModel.npshrSourceMode === manualNpshr) return 'Manual input';
    if (performanceModel.npshrSourceMode === curveNpshr) return 'Manufacturer/test curve';
    return 'Estimated basic curve';
}

function getFormattedLossLabel(entry) {
    if (!entry) return '-';
    const value = Number.isFinite(entry.headLoss) ? entry.headLoss.toFixed(2) : '-';
    return `${entry.label || entry.id || 'Component'} (${value} m)`;
}

function roundPumpTraceNumber(value, digits = 3) {
    const number = toPumpNumber(value, NaN);
    return Number.isFinite(number) ? Number(number.toFixed(digits)) : null;
}

function formatPumpTraceNumber(value, digits = 3) {
    const number = toPumpNumber(value, NaN);
    return Number.isFinite(number) ? number.toFixed(digits) : '-';
}

function getPumpNpshTracePathSequence(context) {
    const sequence = [];
    const add = (item) => {
        if (!item || sequence[sequence.length - 1] === item) return;
        sequence.push(item);
    };

    add(context?.suctionPath?.boundaryId);
    (context?.suctionPath?.steps || []).forEach(step => {
        add(step.from);
        add(step.pipeId);
        add(step.to);
    });
    add(context?.pumpId);

    return sequence;
}

function sumPumpTraceLoss(entries, key) {
    return (entries || []).reduce((sum, entry) => {
        const value = toPumpNumber(entry?.[key], NaN);
        return Number.isFinite(value) ? sum + value : sum;
    }, 0);
}

function buildPumpNpshCalculationTrace(pump, hydraulicContext, hydraulicSnapshot, flowRateM3H, pumpHead, performanceModel, npshr, npshEvaluation) {
    const fluid = typeof globalModel !== 'undefined' ? globalModel.FLUID : null;
    const boundary = hydraulicContext?.suctionBoundary || null;
    const sourceBoundary = boundary?.type === 'source' && typeof resolveSourceBoundaryData === 'function'
        ? resolveSourceBoundaryData(boundary, globalModel)
        : null;
    const pressureSourceNode = sourceBoundary?.isInherited && sourceBoundary.attachedEquipment
        ? sourceBoundary.attachedEquipment
        : boundary;
    const density = Math.max(toPumpNumber(hydraulicContext?.density, fluid?.props?.density || 1000), 1);
    const gravity = typeof GRAVITY === 'number' ? GRAVITY : 9.81;
    const vaporPressureBarA = toPumpNumber(hydraulicContext?.vaporPressurePa, 0) / 100000;
    const pressureInputBasis = typeof getNodePressureInputBasis === 'function'
        ? getNodePressureInputBasis(pressureSourceNode)
        : (pressureSourceNode?.props?.pressureInputBasis || 'Absolute');
    const pressureInputUnit = typeof getPressureInputUnit === 'function'
        ? getPressureInputUnit(pressureInputBasis)
        : (pressureInputBasis === 'Gauge' ? 'bar g' : 'bar a');
    const boundaryPressureInput = toPumpNumber(pressureSourceNode?.props?.pressure, 0);
    const boundaryPressureAbs = sourceBoundary
        ? sourceBoundary.pressureAbsBar
        : (typeof getNodeAbsolutePressureBar === 'function'
            ? getNodeAbsolutePressureBar(boundary)
            : boundaryPressureInput);
    const pressureHead = typeof pressureBarToHead === 'function'
        ? pressureBarToHead(boundaryPressureAbs, density)
        : boundaryPressureAbs * 100000 / (density * gravity);
    const boundaryElevation = sourceBoundary
        ? sourceBoundary.elevation
        : (typeof getNodeHydraulicElevation === 'function'
            ? getNodeHydraulicElevation(boundary)
            : toPumpNumber(boundary?.props?.elevation, 0));
    const pumpElevation = toPumpNumber(hydraulicSnapshot?.pumpElevation, toPumpNumber(pump?.props?.elevation, 0));
    const lossEntries = hydraulicSnapshot?.suctionLossBreakdown?.entries || [];
    const majorLoss = sumPumpTraceLoss(lossEntries, 'majorLoss');
    const minorLoss = sumPumpTraceLoss(lossEntries, 'minorLoss');
    const totalLoss = toPumpNumber(hydraulicSnapshot?.suctionLoss, majorLoss + minorLoss);
    const vaporPressureHead = toPumpNumber(hydraulicSnapshot?.vaporPressureHead, NaN);
    const sourceVelocityHead = toPumpNumber(hydraulicSnapshot?.sourceVelocityHead, 0);
    const npsha = toPumpNumber(hydraulicSnapshot?.npsha, NaN);
    const margin = npshEvaluation?.margin ?? (Number.isFinite(npsha) && Number.isFinite(npshr) ? npsha - npshr : null);
    const ratio = npshEvaluation?.ratio ?? (Number.isFinite(npsha) && Number.isFinite(npshr) && npshr > 0 ? npsha / npshr : null);
    const npshrSource = getPumpNpshrSourceLabel(performanceModel);
    const pathSequence = getPumpNpshTracePathSequence(hydraulicContext);
    const atm = typeof ATM_PRESSURE_BAR === 'number' ? ATM_PRESSURE_BAR : 1.01325;
    const pressureFormula = pressureInputBasis === 'Gauge'
        ? 'Pabs = Pgauge + Patm'
        : 'Pabs = Pabs input';
    const pressureSubstitution = pressureInputBasis === 'Gauge'
        ? `${formatPumpTraceNumber(boundaryPressureInput)} + ${formatPumpTraceNumber(atm)} = ${formatPumpTraceNumber(boundaryPressureAbs)} bar a`
        : `${formatPumpTraceNumber(boundaryPressureInput)} = ${formatPumpTraceNumber(boundaryPressureAbs)} bar a`;
    const sourceType = sourceBoundary?.sourceType || boundary?.props?.sourceType || boundary?.type || '-';
    const pressureEnergyBasis = sourceBoundary?.pressureEnergyBasis || boundary?.props?.pressureEnergyBasis || '-';
    const usesStaticTieInVelocity = sourceType === 'External Header / Pipe Tie-in'
        && pressureEnergyBasis === 'Static Pressure'
        && Math.abs(sourceVelocityHead) > 1e-9;
    const velocityHeadReference = usesStaticTieInVelocity
        ? 'External header static pressure basis adds inlet velocity head once to form total hydraulic head'
        : 'Reservoir surface velocity is neglected, or total/stagnation pressure already includes velocity head';
    const velocityHeadFormula = usesStaticTieInVelocity ? 'Hvel = v^2 / (2g)' : 'Hvel = 0';
    const velocityHeadSubstitution = usesStaticTieInVelocity
        ? `Inlet pipe velocity head = ${formatPumpTraceNumber(sourceVelocityHead)} m`
        : `${formatPumpTraceNumber(sourceVelocityHead)} m`;

    const limitations = [
        'Hydraulic trace follows one supported series suction path per pump; branched networks require a nodal solver.'
    ];
    if (performanceModel?.npshrIsEstimated) {
        limitations.unshift('Estimated NPSHr is for preliminary screening; manufacturer/test curve data is preferred for thesis validation.');
    } else if (performanceModel?.npshrSourceMode === (typeof PUMP_NPSHR_SOURCE_MANUAL !== 'undefined' ? PUMP_NPSHR_SOURCE_MANUAL : 'Manual')) {
        limitations.unshift('Manual NPSHr should be verified against manufacturer/test data.');
    } else {
        limitations.unshift('NPSHr is read from the pump curve data at the evaluated flow.');
    }

    return {
        basis: {
            fluidName: fluid?.props?.fluidName || fluid?.name || '-',
            temperature: roundPumpTraceNumber(hydraulicContext?.fluidProps?.temp ?? boundary?.props?.temp ?? fluid?.props?.temp, 3),
            density: roundPumpTraceNumber(density, 3),
            viscosity: roundPumpTraceNumber(hydraulicContext?.fluidProps?.viscosity ?? fluid?.props?.viscosity, 3),
            vaporPressureBarA: roundPumpTraceNumber(vaporPressureBarA, 6),
            gravity: roundPumpTraceNumber(gravity, 3)
        },
        boundary: {
            id: hydraulicContext?.suctionPath?.boundaryId || '-',
            name: boundary?.name || hydraulicContext?.suctionPath?.boundaryId || '-',
            type: boundary?.type || '-',
            pressureInput: roundPumpTraceNumber(boundaryPressureInput, 3),
            pressureInputBasis,
            pressureInputUnit,
            absolutePressureBar: roundPumpTraceNumber(boundaryPressureAbs, 3),
            pressureHead: roundPumpTraceNumber(pressureHead, 3),
            velocityHead: roundPumpTraceNumber(sourceVelocityHead, 3),
            totalHead: roundPumpTraceNumber(pressureHead + boundaryElevation + sourceVelocityHead, 3),
            elevation: roundPumpTraceNumber(boundaryElevation, 3),
            boundaryDataSource: sourceBoundary?.boundaryDataSource || 'Manual',
            attachedEquipment: sourceBoundary?.attachedEquipmentId || '-',
            flow: roundPumpTraceNumber(flowRateM3H, 3)
        },
        pump: {
            id: hydraulicContext?.pumpId || pump?.name || '-',
            name: pump?.name || hydraulicContext?.pumpId || '-',
            elevation: roundPumpTraceNumber(pumpElevation, 3),
            flow: roundPumpTraceNumber(flowRateM3H, 3),
            head: roundPumpTraceNumber(pumpHead, 3),
            npshrSource
        },
        path: {
            sequence: pathSequence,
            text: pathSequence.join(' -> '),
            dominantLoss: hydraulicSnapshot?.suctionLossBreakdown?.dominant
                ? getFormattedLossLabel(hydraulicSnapshot.suctionLossBreakdown.dominant)
                : '-'
        },
        losses: {
            major: roundPumpTraceNumber(majorLoss, 3),
            minor: roundPumpTraceNumber(minorLoss, 3),
            total: roundPumpTraceNumber(totalLoss, 3),
            entries: lossEntries
        },
        steps: [
            {
                title: 'Source Absolute Pressure',
                reference: 'Pressure basis conversion',
                formula: pressureFormula,
                substitution: pressureSubstitution,
                result: roundPumpTraceNumber(boundaryPressureAbs, 3),
                unit: 'bar a'
            },
            {
                title: 'Pressure Head',
                reference: 'Pressure head term in Bernoulli energy balance',
                formula: 'Hp = Pabs x 100000 / (rho x g)',
                substitution: `${formatPumpTraceNumber(boundaryPressureAbs)} x 100000 / (${formatPumpTraceNumber(density)} x ${formatPumpTraceNumber(gravity)}) = ${formatPumpTraceNumber(pressureHead)} m`,
                result: roundPumpTraceNumber(pressureHead, 3),
                unit: 'm'
            },
            {
                title: 'Elevation Head',
                reference: 'Static elevation term',
                formula: 'Hz = z_source - z_pump',
                substitution: `${formatPumpTraceNumber(boundaryElevation)} - ${formatPumpTraceNumber(pumpElevation)} = ${formatPumpTraceNumber(boundaryElevation - pumpElevation)} m`,
                result: roundPumpTraceNumber(boundaryElevation - pumpElevation, 3),
                unit: 'm'
            },
            {
                title: 'Source Velocity Head',
                reference: velocityHeadReference,
                formula: velocityHeadFormula,
                substitution: velocityHeadSubstitution,
                result: roundPumpTraceNumber(sourceVelocityHead, 3),
                unit: 'm'
            },
            {
                title: 'Suction Loss',
                reference: 'Darcy-Weisbach major loss plus minor loss coefficient K',
                formula: 'HL = pipe major + fitting/valve minor',
                substitution: `${formatPumpTraceNumber(majorLoss)} + ${formatPumpTraceNumber(minorLoss)} = ${formatPumpTraceNumber(totalLoss)} m`,
                result: roundPumpTraceNumber(totalLoss, 3),
                unit: 'm'
            },
            {
                title: 'Vapor Pressure Head',
                reference: 'Fluid vapor pressure term in NPSH available',
                formula: 'Hv = Pv x 100000 / (rho x g)',
                substitution: `${formatPumpTraceNumber(vaporPressureBarA, 6)} x 100000 / (${formatPumpTraceNumber(density)} x ${formatPumpTraceNumber(gravity)}) = ${formatPumpTraceNumber(vaporPressureHead)} m`,
                result: roundPumpTraceNumber(vaporPressureHead, 3),
                unit: 'm'
            },
            {
                title: 'NPSHa',
                reference: 'NPSH available definition from suction energy balance',
                formula: 'NPSHa = Hp + z_source + Hvel - z_pump - HL - Hv',
                substitution: `${formatPumpTraceNumber(pressureHead)} + ${formatPumpTraceNumber(boundaryElevation)} + ${formatPumpTraceNumber(sourceVelocityHead)} - ${formatPumpTraceNumber(pumpElevation)} - ${formatPumpTraceNumber(totalLoss)} - ${formatPumpTraceNumber(vaporPressureHead)} = ${formatPumpTraceNumber(npsha)} m`,
                result: roundPumpTraceNumber(npsha, 3),
                unit: 'm'
            },
            {
                title: 'NPSHr',
                reference: npshrSource,
                formula: 'NPSHr = pump required NPSH at operating flow',
                substitution: `${formatPumpTraceNumber(flowRateM3H)} m3/h -> ${formatPumpTraceNumber(npshr)} m`,
                result: roundPumpTraceNumber(npshr, 3),
                unit: 'm'
            },
            {
                title: 'Margin and Ratio',
                reference: 'Pump cavitation screening criteria',
                formula: 'Margin = NPSHa - NPSHr; Ratio = NPSHa / NPSHr',
                substitution: `${formatPumpTraceNumber(npsha)} - ${formatPumpTraceNumber(npshr)} = ${formatPumpTraceNumber(margin)} m; ${formatPumpTraceNumber(npsha)} / ${formatPumpTraceNumber(npshr)} = ${formatPumpTraceNumber(ratio)}`,
                result: roundPumpTraceNumber(margin, 3),
                unit: 'm'
            }
        ],
        interpretation: {
            status: npshEvaluation?.status || 'Unknown',
            margin: roundPumpTraceNumber(margin, 3),
            ratio: roundPumpTraceNumber(ratio, 3),
            message: npshEvaluation?.message || '-'
        },
        references: [
            'Bernoulli energy balance',
            'Darcy-Weisbach pipe friction',
            'Minor loss coefficient K for fittings and valves',
            'NPSH available versus required NPSH'
        ],
        limitations
    };
}

function buildPumpNpshDiagnosis(pump, hydraulicContext, hydraulicSnapshot, npshEvaluation, performanceModel, requiredNpsh = NaN) {
    const notes = [];
    const dominantEntry = hydraulicSnapshot?.suctionLossBreakdown?.dominant || null;
    const status = npshEvaluation?.status || 'Unknown';
    const suctionLoss = toPumpNumber(hydraulicSnapshot?.suctionLoss, NaN);
    const vaporHead = toPumpNumber(hydraulicSnapshot?.vaporPressureHead, NaN);
    const npsha = toPumpNumber(hydraulicSnapshot?.npsha, NaN);
    const npshr = toPumpNumber(requiredNpsh, NaN);

    if (status === 'Cavitation Risk') {
        notes.push('NPSHa is not greater than NPSHr.');
    } else if (status === 'Warning') {
        notes.push('NPSH is positive but below the configured margin.');
    } else if (status === 'Safe') {
        notes.push('NPSH margin satisfies the configured limits.');
    }

    if (dominantEntry && dominantEntry.headLoss > 0) {
        notes.push(`Dominant suction loss: ${getFormattedLossLabel(dominantEntry)}.`);
    }
    if (Number.isFinite(suctionLoss) && suctionLoss > Math.max(0.5, Math.abs(npsha) * 0.2)) {
        notes.push('Review suction pipe, valve, and fitting losses.');
    }
    if (Number.isFinite(vaporHead) && Number.isFinite(npsha) && vaporHead > Math.max(0.5, Math.abs(npsha) * 0.25)) {
        notes.push('Fluid vapor pressure has a significant effect on available NPSH.');
    }
    if (performanceModel?.npshrIsEstimated) {
        notes.push('NPSHr is estimated; use manufacturer/test curve data for thesis validation.');
    } else if (performanceModel?.npshrSourceMode === (typeof PUMP_NPSHR_SOURCE_MANUAL !== 'undefined' ? PUMP_NPSHR_SOURCE_MANUAL : 'Manual')) {
        notes.push('NPSHr uses manual user input; verify it against manufacturer/test data.');
    }
    if (hydraulicContext?.networkWarnings?.length) {
        notes.push(...hydraulicContext.networkWarnings);
    }
    if (Number.isFinite(npsha) && Number.isFinite(npshr) && npsha > npshr) {
        notes.push('Maintain margin above NPSHr according to the selected reliability basis.');
    }

    return {
        status,
        dominantLoss: dominantEntry ? getFormattedLossLabel(dominantEntry) : '-',
        notes
    };
}

function buildPumpNpshEvaluationResult(pump, hydraulicContext, hydraulicSnapshot, flowRateM3H, pumpHead, performanceModel) {
    if (!pump || !hydraulicContext || !hydraulicSnapshot || !performanceModel) {
        return {
            ok: false,
            status: 'Incomplete',
            warnings: ['NPSH evaluation could not be built from the current hydraulic result.']
        };
    }

    const npshr = performanceModel.getNpshr(flowRateM3H);
    const npshEvaluation = evaluateNpshMargin(hydraulicSnapshot.npsha, npshr, pump.props);
    const diagnosis = buildPumpNpshDiagnosis(pump, hydraulicContext, hydraulicSnapshot, npshEvaluation, performanceModel, npshr);
    const notes = [...diagnosis.notes];
    const calculationTrace = buildPumpNpshCalculationTrace(
        pump,
        hydraulicContext,
        hydraulicSnapshot,
        flowRateM3H,
        pumpHead,
        performanceModel,
        npshr,
        npshEvaluation
    );

    return {
        ok: npshEvaluation.status === 'Safe',
        status: npshEvaluation.status,
        flow: Number(toPumpNumber(flowRateM3H).toFixed(3)),
        pumpHead: Number(toPumpNumber(pumpHead).toFixed(3)),
        npsha: Number(toPumpNumber(hydraulicSnapshot.npsha).toFixed(3)),
        npshr: Number(toPumpNumber(npshr).toFixed(3)),
        npshMargin: npshEvaluation.margin === null ? null : Number(npshEvaluation.margin.toFixed(3)),
        npshRatio: npshEvaluation.ratio === null ? null : Number(npshEvaluation.ratio.toFixed(3)),
        npshrSource: getPumpNpshrSourceLabel(performanceModel),
        suctionPressureAbs: Number(toPumpNumber(hydraulicSnapshot.suctionPressureBar).toFixed(3)),
        suctionLoss: Number(toPumpNumber(hydraulicSnapshot.suctionLoss).toFixed(3)),
        vaporPressureHead: Number(toPumpNumber(hydraulicSnapshot.vaporPressureHead).toFixed(3)),
        suctionVelocityHead: Number(toPumpNumber(hydraulicSnapshot.suctionVelocityHead).toFixed(3)),
        dominantLoss: diagnosis.dominantLoss,
        warnings: npshEvaluation.status === 'Safe' ? [] : [npshEvaluation.message],
        notes,
        suctionLossBreakdown: hydraulicSnapshot.suctionLossBreakdown?.entries || [],
        calculationTrace
    };
}

function runPumpNpshEvaluation(pumpId, model = globalModel, connectionList = connections) {
    const pump = model[pumpId];
    const fluid = model.FLUID;
    if (!pump || pump.type !== 'pump' || !fluid?.props) {
        return { ok: false, status: 'Invalid pump', warnings: ['Select a pump before running NPSH evaluation.'] };
    }

    normalizePumpProps(pump.props);
    const density = Math.max(toPumpNumber(fluid.props.density, 1000), 1);
    const vaporPressurePa = toPumpNumber(fluid.props.vaporPressure, 0) * 100000;
    const context = createPumpHydraulicContext(pumpId, model, connectionList, density, vaporPressurePa);

    if (!context.isComplete) {
        return {
            ok: false,
            status: 'Incomplete',
            warnings: typeof getIncompleteHydraulicNetworkWarnings === 'function'
                ? getIncompleteHydraulicNetworkWarnings(context)
                : ['Connect upstream SRC and downstream SNK before running NPSH evaluation.']
        };
    }

    const performanceModel = createPumpPerformanceModel(pump);
    const flowRequest = typeof getPumpFixedFlowRequest === 'function' ? getPumpFixedFlowRequest(context) : null;
    const solvedFlow = toPumpNumber(pump.results?.flow, NaN);
    const targetFlow = Number.isFinite(flowRequest?.flow) && flowRequest.flow > 0
        ? flowRequest.flow
        : (Number.isFinite(solvedFlow) && solvedFlow > 0
            ? solvedFlow
            : toPumpNumber(pump.props.designFlow, 100));
    if (!Number.isFinite(targetFlow) || targetFlow <= 0) {
        return {
            ok: false,
            status: 'Incomplete',
            warnings: ['Flow must be greater than zero before NPSH can be evaluated.']
        };
    }

    const pumpHead = performanceModel.getHead(targetFlow);
    const snapshot = flowRequest?.source === 'sink-flow-demand'
        ? calculatePumpFlowDemandSnapshot(context, targetFlow, pumpHead)
        : calculatePumpHydraulicSnapshot(context, targetFlow, pumpHead);
    if (!snapshot) {
        return {
            ok: false,
            status: 'Incomplete',
            warnings: ['Unable to calculate suction hydraulic snapshot for NPSH evaluation.']
        };
    }

    return buildPumpNpshEvaluationResult(pump, context, snapshot, targetFlow, pumpHead, performanceModel);
}

function getPumpOptimizationSourceFlow(context) {
    const flowMode = context?.suctionBoundary?.props?.flowInputMode || 'Mass Flow';
    if (flowMode === 'Solve from Network') return null;
    const sourceFlow = toPumpNumber(context?.suctionBoundary?.props?.flow, NaN);
    return Number.isFinite(sourceFlow) && sourceFlow > 0 ? sourceFlow : null;
}

function getPumpOptimizationTargetFlow(pump, context) {
    if (isSinkFlowDemandBoundary(context?.dischargeBoundary)) {
        const demandFlow = toPumpNumber(context.dischargeBoundary.props.demandFlow, NaN);
        if (Number.isFinite(demandFlow) && demandFlow > 0) return demandFlow;
    }

    const sourceFlow = getPumpOptimizationSourceFlow(context);
    if (sourceFlow !== null) return sourceFlow;

    const currentFlow = toPumpNumber(pump?.results?.flow, NaN);
    if (Number.isFinite(currentFlow) && currentFlow > 0) return currentFlow;

    return Math.max(toPumpNumber(pump?.props?.designFlow, 100), 0.001);
}

function calculatePressureBoundaryHeadForOptimization(node, density, flowRateM3H, path, model) {
    if (!node || !node.props) return null;
    const sourceBoundary = node.type === 'source' && typeof resolveSourceBoundaryData === 'function'
        ? resolveSourceBoundaryData(node, model)
        : null;
    const pressure = sourceBoundary
        ? sourceBoundary.pressureAbsBar
        : (typeof getNodeAbsolutePressureBar === 'function'
            ? getNodeAbsolutePressureBar(node)
            : toPumpNumber(node.props.pressure, 1.01325));
    const pressureHead = pressureBarToHead(Number.isFinite(pressure) ? pressure : 1.01325, density);
    let boundaryHead = pressureHead + (sourceBoundary ? sourceBoundary.elevation : getNodeHydraulicElevation(node));

    if (node.type === 'sink' && node.props.pressureBasis === 'Static') {
        boundaryHead += getBoundaryPipeVelocityHead(node, flowRateM3H, path, model);
    }

    return boundaryHead;
}

function calculatePumpRequiredHeadAtFlow(context, flowRateM3H, model = globalModel) {
    if (!context || !context.isComplete) return null;

    const suctionBoundaryHead = getBoundaryHydraulicHead(
        context.suctionBoundary,
        context.density,
        flowRateM3H,
        context.suctionPath,
        model
    );
    const dischargeBoundaryHead = isSinkFlowDemandBoundary(context.dischargeBoundary)
        ? calculatePressureBoundaryHeadForOptimization(context.dischargeBoundary, context.density, flowRateM3H, context.dischargePath, model)
        : getBoundaryHydraulicHead(context.dischargeBoundary, context.density, flowRateM3H, context.dischargePath, model);
    const suctionLoss = calculateHydraulicPathLossHead(
        context.suctionPath,
        flowRateM3H,
        model,
        context.density,
        context.pumpId
    );
    const dischargeLoss = calculateHydraulicPathLossHead(
        context.dischargePath,
        flowRateM3H,
        model,
        context.density,
        context.dischargePath.boundaryId
    );

    if ([suctionBoundaryHead, dischargeBoundaryHead, suctionLoss, dischargeLoss].some(value => value === null)) {
        return null;
    }

    const requiredHead = Math.max(0.001, (dischargeBoundaryHead - suctionBoundaryHead) + suctionLoss + dischargeLoss);
    return {
        requiredHead,
        suctionBoundaryHead,
        dischargeBoundaryHead,
        suctionLoss,
        dischargeLoss
    };
}

function getPumpOptimizationAllowedNpshr(npsha, props) {
    const available = toPumpNumber(npsha, NaN);
    if (!Number.isFinite(available)) return null;
    const ratioLimit = available / Math.max(toPumpNumber(props.minNpshMarginRatio, 1.1), 1);
    const marginLimit = available - Math.max(toPumpNumber(props.minNpshMargin, 0.5), 0);
    return Math.min(ratioLimit, marginLimit);
}

function optimizePumpBasicParameters(pumpId, model = globalModel, connectionList = connections) {
    const result = runPumpNpshEvaluation(pumpId, model, connectionList);
    return {
        ...result,
        warnings: [
            ...(result.warnings || []),
            'Pump parameters were not changed. Use NPSH evaluation results as engineering guidance before editing pump data.'
        ]
    };
}
