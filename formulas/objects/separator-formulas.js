function calculateSeparatorHoldupVolume(flowRateM3H, residenceTimeMin) {
    return (flowRateM3H || 0) * ((residenceTimeMin || 0) / 60);
}
