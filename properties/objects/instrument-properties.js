const PRESSURE_INDICATOR_SCHEMA = {
    rangeMin: { label: 'Range Min', unit: 'bar a', type: 'number', default: 0 },
    rangeMax: { label: 'Range Max', unit: 'bar a', type: 'number', default: 10 }
};

const FLOW_INDICATOR_SCHEMA = {
    rangeMin: { label: 'Range Min', unit: 'm3/h', type: 'number', default: 0 },
    rangeMax: { label: 'Range Max', unit: 'm3/h', type: 'number', default: 200 }
};

const TEMPERATURE_INDICATOR_SCHEMA = {
    rangeMin: { label: 'Range Min', unit: 'deg C', type: 'number', default: 0 },
    rangeMax: { label: 'Range Max', unit: 'deg C', type: 'number', default: 150 }
};

const LINE_MONITOR_SCHEMA = {
    pressureRangeMin: { label: 'Pressure Range Min', unit: 'bar a', type: 'number', default: 0 },
    pressureRangeMax: { label: 'Pressure Range Max', unit: 'bar a', type: 'number', default: 10 },
    tempRangeMin: { label: 'Temp Range Min', unit: 'deg C', type: 'number', default: 0 },
    tempRangeMax: { label: 'Temp Range Max', unit: 'deg C', type: 'number', default: 150 },
    flowRangeMin: { label: 'Flow Range Min', unit: 'm3/h', type: 'number', default: 0 },
    flowRangeMax: { label: 'Flow Range Max', unit: 'm3/h', type: 'number', default: 200 }
};

const LEVEL_CONTROLLER_SCHEMA = {
    setPoint: { label: 'Set Point', unit: '%', type: 'number', default: 50 },
    outputMode: { label: 'Output Mode', type: 'select', options: ['Manual', 'Auto'], default: 'Auto' }
};
