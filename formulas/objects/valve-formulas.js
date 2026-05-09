function calculateValveOpeningFraction(openingPercent) {
    return Math.max(0, Math.min(1, (openingPercent || 0) / 100));
}

function toValveCalcNumber(value, fallback = 0) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function getValveDefaultK(valveType) {
    const defaults = {
        'Gate Valve': 0.2,
        'Ball Valve': 0.05,
        'Butterfly Valve': 0.4,
        'Globe Valve': 10,
        'Check Valve': 2
    };
    return defaults[valveType] ?? 10;
}

function calculateValveOpeningEffect(openingPercent, characteristic) {
    const fraction = calculateValveOpeningFraction(openingPercent);
    if (fraction <= 0) return 0;
    if (fraction >= 1) return 1;

    if (characteristic === VALVE_CHAR_EQUAL_PERCENTAGE) {
        const rangeability = 50;
        return (Math.pow(rangeability, fraction) - 1) / (rangeability - 1);
    }

    if (characteristic === VALVE_CHAR_QUICK_OPENING) {
        return Math.sqrt(fraction);
    }

    return fraction;
}

function getValveEffectiveCv(props = {}) {
    const baseCv = Math.max(toValveCalcNumber(props.cv, 100), 0.001);
    if (props.flowCharacteristic === VALVE_CHAR_MANUAL_EFFECTIVE_CV) {
        return Math.max(toValveCalcNumber(props.effectiveCv, baseCv), 0.001);
    }
    return Math.max(baseCv * calculateValveOpeningEffect(props.opening, props.flowCharacteristic), 0.001);
}

function getValveEffectiveK(props = {}) {
    const baseK = Math.max(toValveCalcNumber(props.kValue, getValveDefaultK(props.valveType)), 0);
    const openingEffect = calculateValveOpeningEffect(props.opening, props.flowCharacteristic);
    if (openingEffect <= 0) return Infinity;
    return baseK / Math.pow(openingEffect, 2);
}
