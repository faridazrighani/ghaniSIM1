// Palm oil liquid properties interpolated from tabulated engineering reference data.
// Columns: tempC, dynamic viscosity cP, Cp kJ/kg.K, thermal conductivity W/m.K,
// density kg/m3, kinematic viscosity cSt.
const PALM_OIL_PROPERTY_TABLE = [
    [25, 77.19, 1.861, 0.1721, 887.5, 86.97],
    [30, 57.85, 1.875, 0.1717, 885.0, 65.37],
    [35, 44.68, 1.888, 0.1712, 882.5, 50.63],
    [40, 35.41, 1.902, 0.1708, 880.0, 40.24],
    [45, 28.68, 1.916, 0.1704, 877.5, 32.68],
    [50, 23.68, 1.930, 0.1699, 875.1, 27.06],
    [55, 19.88, 1.944, 0.1695, 872.6, 22.78],
    [60, 16.93, 1.959, 0.1691, 870.2, 19.46],
    [65, 14.61, 1.973, 0.1687, 867.8, 16.84],
    [70, 12.75, 1.988, 0.1683, 865.4, 14.73],
    [75, 11.23, 2.003, 0.1679, 863.1, 13.01],
    [80, 9.99, 2.018, 0.1675, 860.7, 11.61],
    [85, 8.955, 2.034, 0.1671, 858.4, 10.43],
    [90, 8.087, 2.049, 0.1668, 856.1, 9.45],
    [95, 7.351, 2.065, 0.1664, 853.8, 8.61],
    [100, 6.721, 2.081, 0.1660, 851.6, 7.89],
    [105, 6.179, 2.097, 0.1657, 849.3, 7.28],
    [110, 5.709, 2.113, 0.1653, 847.1, 6.74],
    [115, 5.298, 2.129, 0.1650, 844.9, 6.27],
    [120, 4.937, 2.146, 0.1646, 842.7, 5.86],
    [125, 4.618, 2.163, 0.1643, 840.5, 5.49],
    [130, 4.335, 2.179, 0.1640, 838.4, 5.17],
    [135, 4.083, 2.197, 0.1636, 836.3, 4.88],
    [140, 3.857, 2.214, 0.1633, 834.2, 4.62],
    [145, 3.653, 2.231, 0.1630, 832.1, 4.39],
    [150, 3.469, 2.249, 0.1627, 830.0, 4.18],
    [155, 3.302, 2.267, 0.1624, 828.0, 3.99],
    [160, 3.151, 2.284, 0.1621, 825.9, 3.82],
    [165, 3.012, 2.303, 0.1618, 823.9, 3.66],
    [170, 2.885, 2.321, 0.1615, 821.9, 3.51],
    [175, 2.769, 2.339, 0.1613, 819.9, 3.38],
    [180, 2.662, 2.358, 0.1310, 818.0, 3.25],
    [185, 2.563, 2.377, 0.1607, 816.1, 3.14],
    [190, 2.471, 2.396, 0.1605, 814.1, 3.04],
    [195, 2.387, 2.415, 0.1602, 812.2, 2.94],
    [200, 2.308, 2.434, 0.1600, 810.4, 2.85],
    [205, 2.234, 2.454, 0.1597, 808.5, 2.76],
    [210, 2.166, 2.473, 0.1595, 806.7, 2.69],
    [215, 2.102, 2.493, 0.1593, 804.9, 2.61],
    [220, 2.042, 2.513, 0.1591, 803.1, 2.54],
    [225, 1.986, 2.533, 0.1589, 801.3, 2.48],
    [230, 1.933, 2.554, 0.1586, 799.5, 2.42],
    [235, 1.883, 2.574, 0.1584, 797.8, 2.36],
    [240, 1.836, 2.595, 0.1582, 796.1, 2.31],
    [245, 1.792, 2.616, 0.1581, 794.4, 2.26],
    [250, 1.751, 2.637, 0.1579, 792.7, 2.21],
    [255, 1.711, 2.658, 0.1577, 791.0, 2.16],
    [260, 1.674, 2.680, 0.1575, 789.4, 2.12],
    [265, 1.638, 2.701, 0.1574, 787.8, 2.08],
    [275, 1.572, 2.745, 0.1570, 784.6, 2.00],
    [280, 1.542, 2.767, 0.1569, 783.0, 1.97],
    [285, 1.513, 2.789, 0.1568, 781.5, 1.94],
    [290, 1.485, 2.812, 0.1566, 779.9, 1.90],
    [295, 1.459, 2.834, 0.1565, 778.4, 1.87],
    [300, 1.434, 2.857, 0.1564, 776.9, 1.85]
];

function updatePalmOilProperties() {
    const node = globalModel["FLUID"];
    const props = calculatePalmOilProperties(node.props.temp);

    node.props.density = props.density;
    node.props.sg = node.props.density / 999.972;
    node.props.vaporPressure = props.vaporPressure;
    node.props.dynViscosity = props.dynamicViscosity;
    node.props.viscosity = props.kinematicViscosity;
    node.props.specificHeat = props.specificHeat;
    node.props.thermalConductivity = props.thermalConductivity;
    node.props.bulkModulus = props.bulkModulus;
    node.props.propertyMethod = 'Palm oil liquid table interpolation';

    recalcExtendedFluidProps(node);
}

function calculatePalmOilProperties(tempC) {
    const temp = clampPalmOilTemperature(parseFloat(tempC));
    const tableProps = interpolatePalmOilTable(temp);

    return {
        density: tableProps.density,
        vaporPressure: 0.001,
        dynamicViscosity: tableProps.dynamicViscosity,
        kinematicViscosity: tableProps.dynamicViscosity / (tableProps.density / 1000),
        specificHeat: tableProps.specificHeat,
        thermalConductivity: tableProps.thermalConductivity,
        bulkModulus: 1.8
    };
}

function clampPalmOilTemperature(tempC) {
    const T = Number.isFinite(tempC) ? tempC : 35;
    const minT = PALM_OIL_PROPERTY_TABLE[0][0];
    const maxT = PALM_OIL_PROPERTY_TABLE[PALM_OIL_PROPERTY_TABLE.length - 1][0];
    return Math.min(maxT, Math.max(minT, T));
}

function interpolatePalmOilTable(tempC) {
    const table = PALM_OIL_PROPERTY_TABLE;
    if (tempC <= table[0][0]) return rowToPalmOilProps(table[0]);
    if (tempC >= table[table.length - 1][0]) return rowToPalmOilProps(table[table.length - 1]);

    for (let i = 0; i < table.length - 1; i++) {
        const low = table[i];
        const high = table[i + 1];
        if (tempC >= low[0] && tempC <= high[0]) {
            const ratio = (tempC - low[0]) / (high[0] - low[0]);
            return rowToPalmOilProps(low.map((value, index) => {
                if (index === 0) return tempC;
                return value + (high[index] - value) * ratio;
            }));
        }
    }

    return rowToPalmOilProps(table[table.length - 1]);
}

function rowToPalmOilProps(row) {
    return {
        tempC: row[0],
        dynamicViscosity: row[1],
        specificHeat: row[2],
        thermalConductivity: row[3],
        density: row[4],
        kinematicViscosity: row[5]
    };
}
