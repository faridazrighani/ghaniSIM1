function updateWaterProperties() {
    const node = globalModel["FLUID"];
    const props = calculateIapwsWaterProperties(node.props.temp);

    node.props.density = props.density;
    node.props.sg = node.props.density / 999.972;
    node.props.vaporPressure = props.vaporPressure;
    node.props.dynViscosity = props.dynamicViscosity;
    node.props.viscosity = props.kinematicViscosity;
    node.props.specificHeat = props.specificHeat;
    node.props.bulkModulus = props.bulkModulus;
    node.props.thermalConductivity = props.thermalConductivity;
    node.props.dielectricConstant = props.dielectricConstant;
    node.props.propertyMethod = 'IAPWS-based water property correlation (IAPWS SR6-08, 2011)';

    recalcExtendedFluidProps(node);
}

function calculateIapwsWaterProperties(tempC) {
    const T = Math.min(110, Math.max(-20, parseFloat(tempC) || 0)) + 273.15;
    const liquid = calculateIapwsLiquidWaterAt01MPa(T);
    const vaporPressure = calculateIapwsWaterVaporPressureBar(T);
    const dynamicViscosity = liquid.dynamicViscosityPaS * 1000;

    return {
        density: liquid.density,
        vaporPressure,
        dynamicViscosity,
        kinematicViscosity: dynamicViscosity / (liquid.density / 1000),
        specificHeat: liquid.specificHeat,
        bulkModulus: liquid.density * Math.pow(liquid.speedOfSound, 2) / 1e9,
        thermalConductivity: liquid.thermalConductivity,
        dielectricConstant: liquid.dielectricConstant
    };
}

function calculateIapwsLiquidWaterAt01MPa(T) {
    const R = 0.46151805;
    const P0 = 0.1;
    const TR = 10;
    const tau = T / TR;
    const alpha = TR / (593 - T);
    const beta = TR / (T - 232);
    const tStar = T / 300;

    const a = [null, -1.661470539e5, 2.708781640e6, -1.557191544e8, null,
        1.93763157e-2, 6.74458446e3, -2.22521604e5, 1.00231247e8,
        -1.63552118e9, 8.32299658e9, -7.5245878e-6, -1.3767418e-2,
        1.0627293e1, -2.0457795e2, 1.2037414e3];
    const b = [null, -8.237426256e-1, 1.908956353, -2.017597384, 8.546361348e-1,
        5.78545292e-3, -1.53195665e-2, 3.11337859e-2, -4.23546241e-2,
        3.38713507e-2, -1.19946761e-2, -3.1091470e-6, 2.8964919e-5,
        -1.3112763e-4, 3.0410453e-4, -3.9034594e-4, 2.3403117e-4,
        -4.8510101e-5];
    const c = [null, -2.452093414e2, 3.869269598e1, -8.983025854];
    const n = [null, 4, 5, 7, null, null, 4, 5, 7, 8, 9, 1, 3, 5, 6, 7];
    const m = [null, 2, 3, 4, 5, 1, 2, 3, 4, 5, 6, 1, 3, 4, 5, 6, 7, 9];

    const sumRange = (start, end, fn) => {
        let total = 0;
        for (let i = start; i < end; i++) total += fn(i);
        return total;
    };

    const specificVolume = R * TR / P0 / 1000 * (
        a[5]
        + sumRange(6, 11, i => a[i] * Math.pow(alpha, n[i]))
        + sumRange(5, 11, i => b[i] * Math.pow(beta, m[i]))
    );

    const volumePressureDerivative = R * TR / Math.pow(P0, 2) / 1000 * (
        sumRange(11, 16, i => a[i] * Math.pow(alpha, n[i]))
        + sumRange(11, 18, i => b[i] * Math.pow(beta, m[i]))
    );

    const specificHeat = -R * (
        c[3]
        + tau * sumRange(1, 4, i => n[i] * (n[i] + 1) * a[i] * Math.pow(alpha, n[i] + 2))
        + tau * sumRange(1, 5, i => m[i] * (m[i] + 1) * b[i] * Math.pow(beta, m[i] + 2))
    );

    const volumeTemperatureDerivative = R / P0 / 1000 * (
        sumRange(6, 11, i => n[i] * a[i] * Math.pow(alpha, n[i] + 1))
        - sumRange(5, 11, i => m[i] * b[i] * Math.pow(beta, m[i] + 1))
    );

    const speedOfSound = Math.sqrt(
        -Math.pow(specificVolume, 2) * 1e9
        / (volumePressureDerivative * 1e3 + T * Math.pow(volumeTemperatureDerivative, 2) * 1e6 / specificHeat)
    );

    const dynamicViscosityPaS = (
        280.68 * Math.pow(tStar, -1.9)
        + 511.45 * Math.pow(tStar, -7.7)
        + 61.131 * Math.pow(tStar, -19.6)
        + 0.45903 * Math.pow(tStar, -40)
    ) / 1e6;

    const thermalConductivity = (
        1.6630 * Math.pow(tStar, -1.15)
        - 1.7781 * Math.pow(tStar, -3.4)
        + 1.1567 * Math.pow(tStar, -6.0)
        - 0.432115 * Math.pow(tStar, -7.6)
    );

    const dielectricConstant = (
        -43.7527 * Math.pow(tStar, -0.05)
        + 299.504 * Math.pow(tStar, -1.47)
        - 399.364 * Math.pow(tStar, -2.11)
        + 221.327 * Math.pow(tStar, -2.31)
    );

    return {
        density: 1 / specificVolume,
        specificHeat,
        speedOfSound,
        dynamicViscosityPaS,
        thermalConductivity,
        dielectricConstant
    };
}

function calculateIapwsWaterVaporPressureBar(T) {
    const TC = 647.096;
    const PC_MPA = 22.064;
    const theta = 1 - Math.min(Math.max(T, 273.16), TC) / TC;
    const exponent = (TC / T) * (
        -7.85951783 * theta
        + 1.84408259 * Math.pow(theta, 1.5)
        - 11.7866497 * Math.pow(theta, 3)
        + 22.6807411 * Math.pow(theta, 3.5)
        - 15.9618719 * Math.pow(theta, 4)
        + 1.80122502 * Math.pow(theta, 7.5)
    );
    return PC_MPA * Math.exp(exponent) * 10;
}
