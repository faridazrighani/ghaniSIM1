function isCheckValveOpen(upstreamPressureBar, downstreamPressureBar, crackingPressureBar) {
    return ((upstreamPressureBar || 0) - (downstreamPressureBar || 0)) >= (crackingPressureBar || 0);
}
