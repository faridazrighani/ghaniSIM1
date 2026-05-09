function calculateHeatDutyKW(massFlowKgS, specificHeatKJkgK, deltaTempK) {
    return (massFlowKgS || 0) * (specificHeatKJkgK || 0) * (deltaTempK || 0);
}
