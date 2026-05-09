function calculateMixedScalar(values, weights) {
    values = values || [];
    weights = weights || [];
    const totalWeight = weights.reduce((sum, weight) => sum + (weight || 0), 0);
    if (totalWeight <= 0) return 0;
    return values.reduce((sum, value, idx) => sum + (value || 0) * (weights[idx] || 0), 0) / totalWeight;
}
