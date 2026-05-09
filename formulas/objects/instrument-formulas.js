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
    return value === null ? null : Number(value.toFixed(digits));
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
    if (!instrument || !pipeId || !model[pipeId]) {
        return { value: null, unit: '', percent: null, values: null, percents: null };
    }

    const type = typeof instrument === 'string' ? instrument : instrument.type;
    const props = typeof instrument === 'string' ? {} : (instrument.props || {});
    let value = null;

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
