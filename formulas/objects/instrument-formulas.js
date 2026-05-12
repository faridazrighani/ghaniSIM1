function scaleInstrumentPercent(value, rangeMin, rangeMax) {
    const span = (rangeMax || 0) - (rangeMin || 0);
    if (span === 0) return 0;
    return Math.max(0, Math.min(100, (((value || 0) - (rangeMin || 0)) / span) * 100));
}

function toProcessNumber(value) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function getInstrumentMeasurementUnit(type) {
    if (type === 'pressureIndicator') return 'bar a';
    if (type === 'flowIndicator') return 'm3/h';
    if (type === 'temperatureIndicator') return 'deg C';
    if (type === 'lineMonitor') return '';
    if (type === 'levelController') return '%';
    return '';
}

function getInstrumentMeasurementLabel(type) {
    if (type === 'pressureIndicator') return 'Line Pressure';
    if (type === 'flowIndicator') return 'Line Flow';
    if (type === 'temperatureIndicator') return 'Line Temperature';
    if (type === 'lineMonitor') return 'Line Monitor';
    if (type === 'levelController') return 'Level Signal';
    return 'Measured Value';
}

function roundInstrumentValue(value, digits = 3) {
    if (value === null || value === undefined) return null;
    const numeric = parseFloat(value);
    return Number.isFinite(numeric) ? Number(numeric.toFixed(digits)) : null;
}

function findPipeConnection(pipeId, connections) {
    return (connections || []).find(conn => conn.pipeId === pipeId) || null;
}

function getPipePump(pipeId, connections, model) {
    const conn = findPipeConnection(pipeId, connections);
    if (!conn) return null;

    const fromNode = model[conn.from];
    const toNode = model[conn.to];
    if (fromNode && fromNode.type === 'pump') return fromNode;
    if (toNode && toNode.type === 'pump') return toNode;

    const visited = new Set();
    const queue = [conn.from, conn.to];

    while (queue.length > 0) {
        const nodeId = queue.shift();
        if (visited.has(nodeId)) continue;
        visited.add(nodeId);

        const node = model[nodeId];
        if (node && node.type === 'pump') return node;

        (connections || []).forEach(item => {
            if (item.from === nodeId && !visited.has(item.to)) queue.push(item.to);
            if (item.to === nodeId && !visited.has(item.from)) queue.push(item.from);
        });
    }

    return null;
}

function getPipeFlowRate(pipeId, connections, model) {
    const pipe = model[pipeId];
    if (pipe && pipe.results && pipe.results.pressureCalculated && pipe.results.flow !== undefined) {
        return toProcessNumber(pipe.results.flow);
    }

    const pump = getPipePump(pipeId, connections, model);
    if (pump && pump.results) return toProcessNumber(pump.results.flow);
    return 0;
}

function getPipePressureAtLocationBar(pipe, location = 0.5) {
    if (!pipe || !pipe.results || !pipe.results.pressureCalculated) return null;
    const results = pipe.results;
    const startPressure = parseFloat(results.inletPressure);
    const endPressure = parseFloat(results.outletPressure);
    if (Number.isFinite(startPressure) && Number.isFinite(endPressure)) {
        const clampedLocation = Math.max(0, Math.min(1, parseFloat(location)));
        const tapLocation = Number.isFinite(clampedLocation) ? clampedLocation : 0.5;
        return startPressure + (endPressure - startPressure) * tapLocation;
    }
    return results.pressure === null ? null : toProcessNumber(results.pressure);
}

function getNodePressureBar(node, side) {
    if (!node) return null;
    if (node.type === 'pump' && node.results) {
        if (side === 'outlet' && node.results.dischargePressure !== undefined) {
            return toProcessNumber(node.results.dischargePressure);
        }
        if (side === 'inlet' && node.results.suctionPressure !== undefined) {
            return toProcessNumber(node.results.suctionPressure);
        }
    }

    if (node.props && node.props.pressure !== undefined) {
        return toProcessNumber(node.props.pressure);
    }

    return null;
}

function calculatePipePressureBar(pipeId, connections, model, location = 0.5) {
    const conn = findPipeConnection(pipeId, connections);
    if (!conn) return null;

    const pipe = model[pipeId];
    if (pipe && pipe.results && pipe.results.pressureCalculated && pipe.results.pressure !== null) {
        return getPipePressureAtLocationBar(pipe, location);
    }

    const fromNode = model[conn.from];
    const toNode = model[conn.to];
    const fromPressure = getNodePressureBar(fromNode, 'outlet');
    const toPressure = getNodePressureBar(toNode, 'inlet');
    const knownPressures = [fromPressure, toPressure].filter(value => value !== null);

    if (knownPressures.length === 2) {
        return (knownPressures[0] + knownPressures[1]) / 2;
    }

    const fluid = model.FLUID;
    const density = fluid && fluid.props ? toProcessNumber(fluid.props.density) : 1000;
    const gravity = typeof GRAVITY === 'number' ? GRAVITY : 9.81;
    const flow = getPipeFlowRate(pipeId, connections, model);
    const lossHead = (pipe && pipe.props && typeof calculatePipeHeadLoss === 'function')
        ? calculatePipeHeadLoss(flow, pipe.props)
        : 0;
    const halfLossBar = (lossHead * density * gravity / 100000) / 2;

    if (fromPressure !== null) return fromPressure - halfLossBar;
    if (toPressure !== null) return toPressure + halfLossBar;
    return null;
}

function calculatePipeInstrumentMeasurement(instrument, pipeId, model, connections, location = 0.5) {
    if (!instrument) {
        return { value: null, unit: '', percent: null, values: null, percents: null };
    }

    const type = typeof instrument === 'string' ? instrument : instrument.type;
    const props = typeof instrument === 'string' ? {} : (instrument.props || {});
    let value = null;

    if (type === 'levelController') {
        const setPoint = roundInstrumentValue(toProcessNumber(props.setPoint));
        return {
            value: setPoint,
            unit: '%',
            percent: setPoint
        };
    }

    if (!pipeId || !model[pipeId]) {
        return { value: null, unit: '', percent: null, values: null, percents: null };
    }

    if (type === 'lineMonitor') {
        const pressure = calculatePipePressureBar(pipeId, connections, model, location);
        const flow = getPipeFlowRate(pipeId, connections, model);
        const temperature = model.FLUID && model.FLUID.props ? toProcessNumber(model.FLUID.props.temp) : null;

        return {
            value: null,
            unit: '',
            percent: null,
            values: {
                pressure: roundInstrumentValue(pressure),
                flow: roundInstrumentValue(flow),
                temperature: roundInstrumentValue(temperature)
            },
            units: {
                pressure: 'bar a',
                flow: 'm3/h',
                temperature: 'deg C'
            },
            percents: {
                pressure: pressure === null ? null : Number(scaleInstrumentPercent(pressure, props.pressureRangeMin, props.pressureRangeMax).toFixed(1)),
                flow: flow === null ? null : Number(scaleInstrumentPercent(flow, props.flowRangeMin, props.flowRangeMax).toFixed(1)),
                temperature: temperature === null ? null : Number(scaleInstrumentPercent(temperature, props.tempRangeMin, props.tempRangeMax).toFixed(1))
            }
        };
    }

    if (type === 'pressureIndicator') {
        value = calculatePipePressureBar(pipeId, connections, model, location);
    } else if (type === 'flowIndicator') {
        value = getPipeFlowRate(pipeId, connections, model);
    } else if (type === 'temperatureIndicator') {
        value = model.FLUID && model.FLUID.props ? toProcessNumber(model.FLUID.props.temp) : null;
    }

    const unit = getInstrumentMeasurementUnit(type);
    const percent = value === null ? null : scaleInstrumentPercent(value, props.rangeMin, props.rangeMax);

    return {
        value: roundInstrumentValue(value),
        unit,
        percent: percent === null ? null : Number(percent.toFixed(1))
    };
}

function getInstrumentTraceLink(instrumentId, instrument, model, connectionList) {
    if (typeof getInstrumentLink === 'function') {
        return getInstrumentLink(instrumentId);
    }
    const attachedTo = instrument?.props?.attachedTo;
    if (attachedTo && model?.[attachedTo]) {
        return { instrumentId, pipeId: attachedTo, location: 0.5 };
    }
    const link = (typeof instrumentLinks !== 'undefined' ? instrumentLinks : [])
        .find(item => item.instrumentId === instrumentId);
    if (link) return link;
    const pipeConnection = (connectionList || [])
        .find(conn => conn && conn.pipeId && (conn.from === instrumentId || conn.to === instrumentId));
    return pipeConnection ? { instrumentId, pipeId: pipeConnection.pipeId, location: 0.5 } : null;
}

function getInstrumentTraceTypeLabel(type) {
    if (type === 'pressureIndicator') return 'Pressure Indicator';
    if (type === 'flowIndicator') return 'Flow Indicator';
    if (type === 'temperatureIndicator') return 'Temperature Indicator';
    if (type === 'lineMonitor') return 'Pressure / Temperature / Flow Monitor';
    if (type === 'levelController') return 'Level Controller';
    return getInstrumentMeasurementLabel(type);
}

function getInstrumentRangeForMeasuredType(type, props = {}) {
    if (type === 'pressureIndicator') return { min: props.rangeMin, max: props.rangeMax, unit: 'bar a', label: 'Pressure' };
    if (type === 'flowIndicator') return { min: props.rangeMin, max: props.rangeMax, unit: 'm3/h', label: 'Flow' };
    if (type === 'temperatureIndicator') return { min: props.rangeMin, max: props.rangeMax, unit: 'deg C', label: 'Temperature' };
    return { min: null, max: null, unit: '', label: 'Signal' };
}

function createInstrumentTraceStep(title, formula, substitution, result, unit = '', reference = '') {
    return {
        title,
        formula,
        substitution,
        result,
        unit,
        reference
    };
}

function formatInstrumentTraceNumber(value, digits = 3) {
    const numeric = parseFloat(value);
    if (!Number.isFinite(numeric)) return '-';
    const abs = Math.abs(numeric);
    if (abs > 0 && abs < 0.001) return numeric.toExponential(6);
    return numeric.toFixed(digits);
}

function addInstrumentSignalStep(steps, readouts, label, value, rangeMin, rangeMax, unit, signalKey, warnings = []) {
    const numericValue = parseFloat(value);
    const min = parseFloat(rangeMin);
    const max = parseFloat(rangeMax);
    const hasValidRange = Number.isFinite(min) && Number.isFinite(max) && max !== min;
    const percent = Number.isFinite(numericValue) && hasValidRange
        ? scaleInstrumentPercent(numericValue, min, max)
        : null;

    if (!hasValidRange) {
        warnings.push(`${label} range is invalid; signal percent cannot be scaled reliably.`);
    }

    readouts.push({
        label: `${label} Signal`,
        key: signalKey,
        value: percent === null ? null : Number(percent.toFixed(1)),
        unit: '%'
    });

    steps.push(createInstrumentTraceStep(
        `${label} signal span`,
        'Signal = clamp((PV - LRV) / (URV - LRV) x 100, 0, 100)',
        `${formatInstrumentTraceNumber(numericValue)} ${unit} within ${formatInstrumentTraceNumber(min)} to ${formatInstrumentTraceNumber(max)} ${unit}`,
        percent === null ? null : Number(percent.toFixed(1)),
        '%',
        'Linear process instrument percent span scaling'
    ));
}

function buildInstrumentCalculationTrace(
    instrumentId,
    model = (typeof globalModel !== 'undefined' ? globalModel : {}),
    connectionList = (typeof connections !== 'undefined' ? connections : [])
) {
    const instrument = model?.[instrumentId];
    if (!instrument) {
        return {
            status: 'Instrument not found',
            inputBasis: {},
            readouts: [],
            steps: [],
            warnings: ['Instrument object is not available in the active model.'],
            assumptions: [],
            references: []
        };
    }

    const props = instrument.props || {};
    const type = instrument.type;
    const warnings = [];
    const assumptions = [
        'Instrument objects are reporting/control layers and do not add hydraulic pressure drop.',
        'Live readouts use the active simulation snapshot; they do not create a hydraulic flow path.'
    ];
    const references = [
        'Application hydraulic snapshot: pipe pressure, flow, and active Fluid Basis temperature.',
        'Linear process instrument span scaling: (PV - LRV) / (URV - LRV) x 100.'
    ];
    const steps = [];
    const readouts = [];
    const link = getInstrumentTraceLink(instrumentId, instrument, model, connectionList);
    const pipeId = link?.pipeId || props.attachedTo || '';
    const location = Number.isFinite(parseFloat(link?.location))
        ? Math.max(0, Math.min(1, parseFloat(link.location)))
        : 0.5;
    const pipe = pipeId ? model?.[pipeId] : null;
    const unitStandard = typeof getUnitStandard === 'function' ? getUnitStandard() : 'Internal metric engineering units';

    const inputBasis = {
        instrumentId,
        instrumentType: getInstrumentTraceTypeLabel(type),
        attachedPipe: pipeId || '-',
        tapLocationPercent: Number((location * 100).toFixed(1)),
        unitStandard,
        outputMode: props.outputMode || '',
        setPoint: props.setPoint
    };

    if (type === 'levelController') {
        const setPoint = roundInstrumentValue(toProcessNumber(props.setPoint));
        readouts.push({ label: 'Controller Set Point', key: 'instrument-measured', value: setPoint, unit: '%' });
        readouts.push({ label: 'Controller Signal', key: 'instrument-signal', value: setPoint, unit: '%' });
        steps.push(createInstrumentTraceStep(
            'Controller signal',
            'Signal = set point',
            `${formatInstrumentTraceNumber(setPoint)} %`,
            setPoint,
            '%',
            'Controller set-point readout'
        ));
        steps.push(createInstrumentTraceStep(
            'Output mode',
            'Mode = configured controller mode',
            props.outputMode || 'Auto',
            props.outputMode || 'Auto',
            '',
            'Object property'
        ));

        return {
            status: 'OK - controller trace only',
            inputBasis,
            readouts,
            steps,
            warnings,
            assumptions,
            references
        };
    }

    if (!pipeId || !pipe) {
        warnings.push('Instrument is not attached to a pipe; connect it to a hydraulic pipe to calculate live pressure, flow, or temperature readout.');
        return {
            status: 'Waiting for pipe attachment',
            inputBasis,
            readouts,
            steps: [
                createInstrumentTraceStep(
                    'Attachment check',
                    'Instrument tap -> hydraulic pipe',
                    pipeId || 'No attached pipe',
                    'No live hydraulic readout',
                    '',
                    'Instrument attachment validation'
                )
            ],
            warnings,
            assumptions,
            references
        };
    }

    const readout = calculatePipeInstrumentMeasurement(instrument, pipeId, model, connectionList, location);
    steps.push(createInstrumentTraceStep(
        'Pipe tap selection',
        'Instrument tap = attached pipe at tap location',
        `${pipeId} at ${formatInstrumentTraceNumber(location * 100, 1)} % length`,
        pipeId,
        '',
        'Instrument attachment metadata'
    ));

    if (type === 'lineMonitor') {
        const pressure = calculatePipePressureBar(pipeId, connectionList, model, location);
        const flow = getPipeFlowRate(pipeId, connectionList, model);
        const temperature = model?.FLUID?.props ? toProcessNumber(model.FLUID.props.temp) : null;
        const startPressure = parseFloat(pipe?.results?.inletPressure);
        const endPressure = parseFloat(pipe?.results?.outletPressure);

        readouts.push({ label: 'Pressure', key: 'instrument-pressure', value: readout.values?.pressure ?? pressure, unit: 'bar a' });
        readouts.push({ label: 'Flow', key: 'instrument-flow', value: readout.values?.flow ?? flow, unit: 'm3/h' });
        readouts.push({ label: 'Temperature', key: 'instrument-temperature', value: readout.values?.temperature ?? temperature, unit: 'deg C' });

        if (Number.isFinite(startPressure) && Number.isFinite(endPressure)) {
            steps.push(createInstrumentTraceStep(
                'Tap pressure',
                'P_tap = P_in + (P_out - P_in) x tapLocation',
                `${formatInstrumentTraceNumber(startPressure)} + (${formatInstrumentTraceNumber(endPressure)} - ${formatInstrumentTraceNumber(startPressure)}) x ${formatInstrumentTraceNumber(location)} = ${formatInstrumentTraceNumber(pressure)} bar a`,
                pressure,
                'bar a',
                'Linear interpolation between pipe endpoint pressures'
            ));
        } else {
            steps.push(createInstrumentTraceStep(
                'Tap pressure',
                'P_tap = available pipe/static pressure snapshot',
                `${pipeId} pressure snapshot = ${formatInstrumentTraceNumber(pressure)} bar a`,
                pressure,
                'bar a',
                'Pipe pressure readout fallback'
            ));
        }

        steps.push(createInstrumentTraceStep(
            'Flow readout',
            'Q = hydraulic pipe calculated flow',
            `${pipeId} flow snapshot = ${formatInstrumentTraceNumber(flow)} m3/h`,
            flow,
            'm3/h',
            'Pipe or connected pump flow result'
        ));
        steps.push(createInstrumentTraceStep(
            'Temperature readout',
            'T = active Fluid Basis temperature',
            `${formatInstrumentTraceNumber(temperature)} deg C from FLUID basis`,
            temperature,
            'deg C',
            'Active Fluid Basis'
        ));
        addInstrumentSignalStep(steps, readouts, 'Pressure', pressure, props.pressureRangeMin, props.pressureRangeMax, 'bar a', 'instrument-pressure-signal', warnings);
        addInstrumentSignalStep(steps, readouts, 'Flow', flow, props.flowRangeMin, props.flowRangeMax, 'm3/h', 'instrument-flow-signal', warnings);
        addInstrumentSignalStep(steps, readouts, 'Temperature', temperature, props.tempRangeMin, props.tempRangeMax, 'deg C', 'instrument-temperature-signal', warnings);
    } else {
        const measurement = calculatePipeInstrumentMeasurement(instrument, pipeId, model, connectionList, location);
        const range = getInstrumentRangeForMeasuredType(type, props);
        readouts.push({
            label: getInstrumentMeasurementLabel(type),
            key: 'instrument-measured',
            value: measurement.value,
            unit: measurement.unit
        });
        readouts.push({
            label: 'Signal',
            key: 'instrument-signal',
            value: measurement.percent,
            unit: '%'
        });

        steps.push(createInstrumentTraceStep(
            `${range.label} measurement`,
            type === 'pressureIndicator'
                ? 'P = pipe static pressure at tap'
                : type === 'flowIndicator'
                    ? 'Q = hydraulic pipe calculated flow'
                    : 'T = active Fluid Basis temperature',
            `${pipeId} ${range.label.toLowerCase()} snapshot = ${formatInstrumentTraceNumber(measurement.value)} ${measurement.unit}`,
            measurement.value,
            measurement.unit,
            type === 'temperatureIndicator' ? 'Active Fluid Basis' : 'Pipe hydraulic result'
        ));
        addInstrumentSignalStep(steps, readouts, range.label, measurement.value, range.min, range.max, range.unit, 'instrument-signal', warnings);
    }

    return {
        status: warnings.length ? 'Review' : 'OK',
        inputBasis,
        readouts,
        steps,
        warnings,
        assumptions,
        references
    };
}
