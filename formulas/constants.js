const GRAVITY = 9.81;
const ATM_PRESSURE_BAR = 1.01325;
const PRESSURE_INPUT_BASIS_GAUGE = 'Gauge';
const PRESSURE_INPUT_BASIS_ABSOLUTE = 'Absolute';
const PRESSURE_INPUT_BASIS_OPTIONS = [PRESSURE_INPUT_BASIS_GAUGE, PRESSURE_INPUT_BASIS_ABSOLUTE];

function toFiniteNumber(value, fallback = 0) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function pressureInputToAbsoluteBar(pressure, basis = PRESSURE_INPUT_BASIS_ABSOLUTE) {
    const numericPressure = toFiniteNumber(pressure, 0);
    return basis === PRESSURE_INPUT_BASIS_GAUGE
        ? numericPressure + ATM_PRESSURE_BAR
        : numericPressure;
}

function pressureInputToGaugeBar(pressure, basis = PRESSURE_INPUT_BASIS_ABSOLUTE) {
    const numericPressure = toFiniteNumber(pressure, 0);
    return basis === PRESSURE_INPUT_BASIS_GAUGE
        ? numericPressure
        : numericPressure - ATM_PRESSURE_BAR;
}

function getPressureInputUnit(basis = PRESSURE_INPUT_BASIS_ABSOLUTE) {
    return basis === PRESSURE_INPUT_BASIS_GAUGE ? 'bar g' : 'bar a';
}

function getDefaultPressureInputBasis(node) {
    if (node?.type === 'tank') return PRESSURE_INPUT_BASIS_GAUGE;
    return PRESSURE_INPUT_BASIS_ABSOLUTE;
}

function getNodePressureInputBasis(node) {
    return node?.props?.pressureInputBasis || getDefaultPressureInputBasis(node);
}

function getNodeAbsolutePressureBar(node, key = 'pressure') {
    if (!node || !node.props) return null;
    return pressureInputToAbsoluteBar(node.props[key], getNodePressureInputBasis(node));
}

function getNodeGaugePressureBar(node, key = 'pressure') {
    if (!node || !node.props) return null;
    return pressureInputToGaugeBar(node.props[key], getNodePressureInputBasis(node));
}
