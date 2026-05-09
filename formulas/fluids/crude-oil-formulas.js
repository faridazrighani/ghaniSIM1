const CRUDE_REFERENCE_TEMP_C = 15.5555556; // 60 deg F
const CRUDE_RVP_REFERENCE_TEMP_C = 37.8; // ASTM Reid vapor pressure reference temperature
const CRUDE_WATER_DENSITY_60F = 999.016;
const CRUDE_API_MPMS_K0 = 613.9723;
const CRUDE_DEFAULT_API_GRAVITY = 35;
const CRUDE_DEFAULT_VISCOSITY_40C = 7;
const CRUDE_DEFAULT_VISCOSITY_100C = 2.2;
const CRUDE_DEFAULT_RVP_BAR = 0.34;

function updateCrudeOilProperties() {
    const node = globalModel["FLUID"];
    normalizeCrudeOilProps(node.props);
    const props = calculateCrudeOilProperties(node.props.temp, node.props);

    node.props.density = props.density;
    node.props.sg = node.props.density / 999.972;
    node.props.vaporPressure = props.vaporPressure;
    node.props.dynViscosity = props.dynamicViscosity;
    node.props.viscosity = props.kinematicViscosity;
    node.props.specificHeat = props.specificHeat;
    node.props.bulkModulus = props.bulkModulus;
    node.props.propertyMethod = 'API MPMS 11.1 / ASTM D341 estimated crude';

    recalcExtendedFluidProps(node);
}

function normalizeCrudeOilProps(props) {
    props.crudeApiGravity = validCrudeNumber(props.crudeApiGravity, CRUDE_DEFAULT_API_GRAVITY, 5, 70);
    props.crudeViscosity40C = validCrudeNumber(props.crudeViscosity40C, CRUDE_DEFAULT_VISCOSITY_40C, 0.31, 100000);
    props.crudeViscosity100C = validCrudeNumber(props.crudeViscosity100C, CRUDE_DEFAULT_VISCOSITY_100C, 0.31, 100000);
    props.crudeRvp = validCrudeNumber(props.crudeRvp, CRUDE_DEFAULT_RVP_BAR, 0.0001, 20);
    return props;
}

function calculateCrudeOilProperties(tempC, assayProps = {}) {
    const temp = validCrudeNumber(tempC, 25, -50, 200);
    const apiGravity = validCrudeNumber(assayProps.crudeApiGravity, CRUDE_DEFAULT_API_GRAVITY, 5, 70);
    const viscosity40C = validCrudeNumber(assayProps.crudeViscosity40C, CRUDE_DEFAULT_VISCOSITY_40C, 0.31, 100000);
    const viscosity100C = validCrudeNumber(assayProps.crudeViscosity100C, CRUDE_DEFAULT_VISCOSITY_100C, 0.31, 100000);
    const rvp = validCrudeNumber(assayProps.crudeRvp, CRUDE_DEFAULT_RVP_BAR, 0.0001, 20);

    const density60 = calculateCrudeDensityAt60F(apiGravity);
    const density = calculateCrudeObservedDensity(density60, temp);
    const kinematicViscosity = calculateAstmD341Viscosity(temp, viscosity40C, viscosity100C);
    const dynamicViscosity = kinematicViscosity * density / 1000;
    const vaporPressure = calculateCrudeVaporPressureBar(temp, rvp);
    const specificHeat = calculateCrudeSpecificHeat(apiGravity, temp);
    const speedOfSound = calculateCrudeSpeedOfSound(apiGravity, temp);
    const bulkModulus = density * Math.pow(speedOfSound, 2) / 1e9;

    return {
        density,
        vaporPressure,
        dynamicViscosity,
        kinematicViscosity,
        specificHeat,
        bulkModulus,
        speedOfSound
    };
}

function calculateCrudeDensityAt60F(apiGravity) {
    const specificGravity60 = 141.5 / (apiGravity + 131.5);
    return specificGravity60 * CRUDE_WATER_DENSITY_60F;
}

function calculateCrudeObservedDensity(density60, tempC) {
    // API MPMS 11.1-style CTL approximation for generalized crude oils.
    const alpha = CRUDE_API_MPMS_K0 / Math.pow(density60, 2);
    const deltaT = tempC - CRUDE_REFERENCE_TEMP_C;
    const ctl = Math.exp(-alpha * deltaT * (1 + 0.8 * alpha * deltaT));
    return density60 * ctl;
}

function calculateAstmD341Viscosity(tempC, viscosity40C, viscosity100C) {
    const x1 = Math.log10(40 + 273.15);
    const x2 = Math.log10(100 + 273.15);
    const y1 = astmD341Y(viscosity40C);
    const y2 = astmD341Y(viscosity100C);
    const slope = (y1 - y2) / (x2 - x1);
    const intercept = y1 + slope * x1;
    const y = intercept - slope * Math.log10(tempC + 273.15);
    return Math.max(0.01, Math.pow(10, Math.pow(10, y)) - 0.7);
}

function astmD341Y(kinematicViscosityCst) {
    return Math.log10(Math.log10(Math.max(0.31, kinematicViscosityCst) + 0.7));
}

function calculateCrudeVaporPressureBar(tempC, rvpBar) {
    const tRef = CRUDE_RVP_REFERENCE_TEMP_C + 273.15;
    const tActual = tempC + 273.15;
    const effectiveHvapOverR = 4000;
    return rvpBar * Math.exp(effectiveHvapOverR * (1 / tRef - 1 / tActual));
}

function calculateCrudeSpecificHeat(apiGravity, tempC) {
    const tempF = tempC * 9 / 5 + 32;
    const cpBtuPerLbF = (-1.39e-6 * tempF + 1.847e-3) * apiGravity + 6.32e-4 * tempF + 0.352;
    return cpBtuPerLbF * 4.1868;
}

function calculateCrudeSpeedOfSound(apiGravity, tempC) {
    return Math.min(1600, Math.max(950, 1360 - 2.2 * (tempC - CRUDE_REFERENCE_TEMP_C) - 1.5 * (apiGravity - 35)));
}

function validCrudeNumber(value, fallback, min, max) {
    const number = parseFloat(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
}
