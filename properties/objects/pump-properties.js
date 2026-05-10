const PUMP_OPTIMIZATION_MODE_MANUAL = 'Manual';
const PUMP_OPTIMIZATION_MODE_AUTO = 'Auto';
const PUMP_NPSHR_SOURCE_ESTIMATED = 'Estimated';
const PUMP_NPSHR_SOURCE_MANUAL = 'Manual';
const PUMP_NPSHR_SOURCE_CURVE = 'Manufacturer/Test Curve';
const PUMP_NPSHR_SOURCE_OPTIONS = [PUMP_NPSHR_SOURCE_MANUAL, PUMP_NPSHR_SOURCE_ESTIMATED];

const PUMP_DEFAULT_PROPS = {
    inputMode: 'Basic',
    optimizationMode: PUMP_OPTIMIZATION_MODE_MANUAL,
    npshrSourceMode: PUMP_NPSHR_SOURCE_ESTIMATED,
    elevation: 0,
    suctionElevation: 0,
    dischargeElevation: 0,
    designFlow: 100,
    designHead: 40,
    designEfficiency: 75,
    designNpshr: 3,
    bepFlow: 100,
    porMinPercent: 70,
    porMaxPercent: 120,
    aorMinPercent: 50,
    aorMaxPercent: 130,
    minNpshMarginRatio: 1.1,
    minNpshMargin: 0.5,
    curveData: [
        { flow: 0, head: 55, eff: 0, npshr: 1 },
        { flow: 50, head: 50, eff: 60, npshr: 1.5 },
        { flow: 100, head: 40, eff: 75, npshr: 2 },
        { flow: 150, head: 20, eff: 50, npshr: 4 }
    ]
};
