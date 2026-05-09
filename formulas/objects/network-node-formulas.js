function calculateNodePressureAverage(pressures) {
    pressures = pressures || [];
    const valid = pressures.filter(value => Number.isFinite(value));
    if (valid.length === 0) return 0;
    return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}
