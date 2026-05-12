const VESSEL_H_STANDARD_EXAMPLE = {
    elevation: 6,
    liquidLevel: 3,
    inletNozzleElevation: 3,
    outletNozzleElevation: 1,
    pressureInputBasis: 'Gauge',
    pressure: 0.1,
    pressureDrop: 0.1,
    residenceTime: 5
};

const VESSEL_V_STANDARD_EXAMPLE = {
    elevation: 4,
    liquidLevel: 5,
    inletNozzleElevation: 8,
    outletNozzleElevation: 4.8,
    pressureInputBasis: 'Gauge',
    pressure: 0.15,
    pressureDrop: 0.08,
    residenceTime: 8,
    orientation: 'Vertical'
};

const SEPARATOR_SCHEMA = {
    visualScale: { label: 'PFD Size', unit: '%', type: 'number', default: 100 },
    elevation: { label: 'Base Elevation', unit: 'm', type: 'number', default: VESSEL_H_STANDARD_EXAMPLE.elevation },
    liquidLevel: { label: 'Liquid Level Elev. Offset', unit: 'm', type: 'number', default: VESSEL_H_STANDARD_EXAMPLE.liquidLevel },
    inletNozzleElevation: { label: 'Inlet Nozzle Elev.', unit: 'm', type: 'number', default: VESSEL_H_STANDARD_EXAMPLE.inletNozzleElevation },
    outletNozzleElevation: { label: 'Outlet Nozzle Elev.', unit: 'm', type: 'number', default: VESSEL_H_STANDARD_EXAMPLE.outletNozzleElevation },
    pressureInputBasis: {
        label: 'Pressure Basis',
        type: 'select',
        default: VESSEL_H_STANDARD_EXAMPLE.pressureInputBasis,
        options: ['Gauge', 'Absolute']
    },
    pressure: { label: 'Vessel Pressure', unit: 'bar g', type: 'number', default: VESSEL_H_STANDARD_EXAMPLE.pressure },
    pressureDrop: { label: 'Pressure Drop', unit: 'bar', type: 'number', default: VESSEL_H_STANDARD_EXAMPLE.pressureDrop },
    residenceTime: { label: 'Residence Time', unit: 'min', type: 'number', default: VESSEL_H_STANDARD_EXAMPLE.residenceTime },
    orientation: { label: 'Orientation', type: 'select', options: ['Horizontal', 'Vertical'], default: 'Horizontal', readonly: true }
};

const VERTICAL_VESSEL_SCHEMA = {
    ...SEPARATOR_SCHEMA,
    elevation: { ...SEPARATOR_SCHEMA.elevation, default: VESSEL_V_STANDARD_EXAMPLE.elevation },
    liquidLevel: { ...SEPARATOR_SCHEMA.liquidLevel, default: VESSEL_V_STANDARD_EXAMPLE.liquidLevel },
    inletNozzleElevation: { ...SEPARATOR_SCHEMA.inletNozzleElevation, default: VESSEL_V_STANDARD_EXAMPLE.inletNozzleElevation },
    outletNozzleElevation: { ...SEPARATOR_SCHEMA.outletNozzleElevation, default: VESSEL_V_STANDARD_EXAMPLE.outletNozzleElevation },
    pressureInputBasis: { ...SEPARATOR_SCHEMA.pressureInputBasis, default: VESSEL_V_STANDARD_EXAMPLE.pressureInputBasis },
    pressure: { ...SEPARATOR_SCHEMA.pressure, default: VESSEL_V_STANDARD_EXAMPLE.pressure },
    pressureDrop: { ...SEPARATOR_SCHEMA.pressureDrop, default: VESSEL_V_STANDARD_EXAMPLE.pressureDrop },
    residenceTime: { ...SEPARATOR_SCHEMA.residenceTime, default: VESSEL_V_STANDARD_EXAMPLE.residenceTime },
    orientation: { label: 'Orientation', type: 'select', options: ['Horizontal', 'Vertical'], default: 'Vertical', readonly: true }
};
