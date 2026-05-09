function calculateTurbulentFrictionFactor(reynolds, relRoughness) {
    let friction = 0.25 / Math.pow(Math.log10((relRoughness / 3.7) + (5.74 / Math.pow(reynolds, 0.9))), 2);
    for (let i = 0; i < 20; i++) {
        const next = 1 / Math.pow(-2 * Math.log10((relRoughness / 3.7) + (2.51 / (reynolds * Math.sqrt(friction)))), 2);
        if (Math.abs(next - friction) < 1e-7) return next;
        friction = next;
    }
    return friction;
}

function calculateFrictionFactor(reynolds, roughnessM, diameterM) {
    if (!Number.isFinite(reynolds) || reynolds <= 0 || diameterM <= 0) return 0;
    const laminar = 64 / reynolds;
    if (reynolds < 2000) return laminar;

    const relRoughness = Math.max(roughnessM || 0, 0) / diameterM;
    const turbulent = calculateTurbulentFrictionFactor(Math.max(reynolds, 4000), relRoughness);
    if (reynolds >= 4000) return turbulent;

    const blend = (reynolds - 2000) / 2000;
    return laminar + (turbulent - laminar) * blend;
}

function toPipeCalcNumber(value, fallback = 0) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function calculatePipeHydraulicSegments(flowRateM3H, pipeProps) {
    normalizePipeProps(pipeProps);
    const details = [];
    if (flowRateM3H <= 0 || !pipeProps.segments || pipeProps.segments.length === 0) return details;

    const qM3S = flowRateM3H / 3600;
    const fluid = globalModel["FLUID"];
    const kinVisc = Math.max(toPipeCalcNumber(fluid?.props?.viscosity, 1), 0.000001) * 1e-6;

    pipeProps.segments.forEach((seg, index) => {
        const diameter = toPipeCalcNumber(seg.diameter);
        const length = Math.max(0, toPipeCalcNumber(seg.length));
        if (diameter <= 0) return;

        const area = Math.PI * Math.pow(diameter, 2) / 4;
        const velocity = qM3S / area;
        const reynolds = (velocity * diameter) / kinVisc;
        const frictionFactor = calculateFrictionFactor(reynolds, toPipeCalcNumber(seg.roughness, 0.000045), diameter);
        const velocityHead = Math.pow(velocity, 2) / (2 * GRAVITY);
        const majorLoss = frictionFactor * (length / diameter) * velocityHead;
        const fittingK = typeof getPipeFittingK === 'function'
            ? getPipeFittingK(seg)
            : Math.max(0, toPipeCalcNumber(seg.fittingK));
        const fittingQuantity = Math.max(0, toPipeCalcNumber(seg.fittingQuantity));
        const fittingTotalK = typeof getPipeFittingTotalK === 'function'
            ? getPipeFittingTotalK(seg)
            : fittingQuantity * fittingK;
        const additionalK = typeof getPipeAdditionalK === 'function'
            ? getPipeAdditionalK(seg)
            : Math.max(0, toPipeCalcNumber(seg.minorLoss));
        const totalMinorK = fittingTotalK + additionalK;
        const fittingLoss = fittingTotalK * velocityHead;
        const additionalLoss = additionalK * velocityHead;
        const minorLoss = totalMinorK * velocityHead;

        details.push({
            index,
            name: seg.name,
            pipeSize: seg.pipeSize,
            material: seg.material,
            length,
            diameter,
            roughness: toPipeCalcNumber(seg.roughness, 0.000045),
            fittingType: seg.fittingType,
            fittingQuantity,
            fittingK,
            fittingTotalK,
            additionalK,
            minorLossK: totalMinorK,
            velocity,
            reynolds,
            frictionFactor,
            majorLoss,
            fittingLoss,
            additionalLoss,
            minorLoss,
            totalLoss: majorLoss + minorLoss
        });
    });

    return details;
}

function calculatePipeHeadLoss(flowRateM3H, pipeProps) {
    return calculatePipeHydraulicSegments(flowRateM3H, pipeProps)
        .reduce((sum, segment) => sum + segment.totalLoss, 0);
}
