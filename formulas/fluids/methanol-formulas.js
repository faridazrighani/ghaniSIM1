const METHANOL_NORMAL_BOILING_POINT_C = 64.482;

// NIST Chemistry WebBook SRD 69, Methanol isobaric liquid properties at 0.101325 MPa.
// Columns: tempC, density kg/m3, dynamic viscosity cP, Cp kJ/kg.K, speed of sound m/s,
// thermal conductivity W/m.K.
const METHANOL_NIST_LIQUID_TABLE = [
    [-90, 897.19591, 9.0157953, 2.2111037, 1567.9356, 0.21989319],
    [-85, 892.19987, 7.1957447, 2.2123517, 1535.6073, 0.21937861],
    [-80, 887.18988, 5.8381232, 2.2123882, 1506.7654, 0.21878162],
    [-75, 882.18709, 4.8204196, 2.2133035, 1480.6091, 0.21812219],
    [-70, 877.20189, 4.0451850, 2.2159178, 1456.4684, 0.21741268],
    [-65, 872.23868, 3.4428170, 2.2203945, 1433.8054, 0.21666113],
    [-60, 867.29884, 2.9652696, 2.2266105, 1412.2055, 0.21587332],
    [-55, 862.38246, 2.5795499, 2.2343583, 1391.3624, 0.21505388],
    [-50, 857.48923, 2.2628172, 2.2434456, 1371.0595, 0.21420697],
    [-45, 852.61881, 1.9990216, 2.2537352, 1351.1520, 0.21333645],
    [-40, 847.77093, 1.7766740, 2.2651534, 1331.5501, 0.21244600],
    [-35, 842.94534, 1.5873812, 2.2776833, 1312.2041, 0.21153910],
    [-30, 838.14175, 1.4248807, 2.2913514, 1293.0927, 0.21061898],
    [-25, 833.35968, 1.2844023, 2.3062133, 1274.2130, 0.20968855],
    [-20, 828.59833, 1.1622400, 2.3223411, 1255.5729, 0.20875034],
    [-15, 823.85655, 1.0554623, 2.3398119, 1237.1854, 0.20780654],
    [-10, 819.13271, 0.96171301, 2.3587000, 1219.0642, 0.20686011],
    [-5, 814.42470, 0.87907175, 2.3790711, 1201.2209, 0.20591153],
    [0, 809.72990, 0.80595506, 2.4009793, 1183.6627, 0.20496171],
    [5, 805.04516, 0.74104432, 2.4244648, 1166.3917, 0.20401136],
    [10, 800.36684, 0.68323251, 2.4495543, 1149.4042, 0.20306087],
    [15, 795.69080, 0.63158396, 2.4762616, 1132.6906, 0.20211037],
    [20, 791.01243, 0.58530342, 2.5045896, 1116.2359, 0.20115976],
    [25, 786.32668, 0.54371173, 2.5345316, 1100.0200, 0.20020880],
    [30, 781.62808, 0.50622659, 2.5660743, 1084.0184, 0.19925708],
    [35, 776.91078, 0.47234694, 2.5991999, 1068.2029, 0.19830413],
    [40, 772.16856, 0.44164030, 2.6338883, 1052.5420, 0.19734939],
    [45, 767.39483, 0.41373231, 2.6701194, 1037.0019, 0.19639231],
    [50, 762.58266, 0.38829804, 2.7078752, 1021.5467, 0.19543232],
    [55, 757.72475, 0.36505479, 2.7471419, 1006.1387, 0.19446889],
    [60, 752.81348, 0.34375597, 2.7879115, 990.73947, 0.19350154],
    [64.482, 748.35905, 0.32613894, 2.8257344, 976.91040, 0.19263074]
];

function updateMethanolProperties() {
    const node = globalModel["FLUID"];
    const props = calculateMethanolProperties(node.props.temp);

    node.props.density = props.density;
    node.props.sg = node.props.density / 999.972;
    node.props.vaporPressure = props.vaporPressure;
    node.props.dynViscosity = props.dynamicViscosity;
    node.props.viscosity = props.kinematicViscosity;
    node.props.specificHeat = props.specificHeat;
    node.props.bulkModulus = props.bulkModulus;
    node.props.thermalConductivity = props.thermalConductivity;
    node.props.propertyMethod = 'NIST SRD 69 / Antoine';

    recalcExtendedFluidProps(node);
}

function calculateMethanolProperties(tempC) {
    const T = clampMethanolLiquidTemperature(parseFloat(tempC));
    const liquid = interpolateMethanolLiquidTable(T);
    const vaporPressure = calculateMethanolVaporPressureBar(T);
    const bulkModulus = liquid.density * Math.pow(liquid.speedOfSound, 2) / 1e9;

    return {
        density: liquid.density,
        vaporPressure,
        dynamicViscosity: liquid.dynamicViscosity,
        kinematicViscosity: liquid.dynamicViscosity / (liquid.density / 1000),
        specificHeat: liquid.specificHeat,
        bulkModulus,
        thermalConductivity: liquid.thermalConductivity,
        speedOfSound: liquid.speedOfSound
    };
}

function clampMethanolLiquidTemperature(tempC) {
    const T = Number.isFinite(tempC) ? tempC : 25;
    const minT = METHANOL_NIST_LIQUID_TABLE[0][0];
    const maxT = METHANOL_NORMAL_BOILING_POINT_C;
    return Math.min(maxT, Math.max(minT, T));
}

function interpolateMethanolLiquidTable(tempC) {
    const table = METHANOL_NIST_LIQUID_TABLE;
    if (tempC <= table[0][0]) return rowToMethanolProps(table[0]);
    if (tempC >= table[table.length - 1][0]) return rowToMethanolProps(table[table.length - 1]);

    for (let i = 0; i < table.length - 1; i++) {
        const low = table[i];
        const high = table[i + 1];
        if (tempC >= low[0] && tempC <= high[0]) {
            const ratio = (tempC - low[0]) / (high[0] - low[0]);
            return rowToMethanolProps(low.map((value, index) => {
                if (index === 0) return tempC;
                return value + (high[index] - value) * ratio;
            }));
        }
    }

    return rowToMethanolProps(table[table.length - 1]);
}

function rowToMethanolProps(row) {
    return {
        tempC: row[0],
        density: row[1],
        dynamicViscosity: row[2],
        specificHeat: row[3],
        speedOfSound: row[4],
        thermalConductivity: row[5]
    };
}

function calculateMethanolVaporPressureBar(tempC) {
    const T = tempC + 273.15;
    const coeff = T >= 353.5
        ? { A: 5.15853, B: 1569.613, C: -34.846 }
        : { A: 5.20409, B: 1581.341, C: -33.50 };

    return Math.pow(10, coeff.A - coeff.B / (T + coeff.C));
}
