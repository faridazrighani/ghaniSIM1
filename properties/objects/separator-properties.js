const SEPARATOR_SCHEMA = {
    visualScale: { label: 'PFD Size', unit: '%', type: 'number', default: 100 },
    elevation: { label: 'Base Elevation', unit: 'm', type: 'number', default: 0 },
    liquidLevel: { label: 'Liquid Level Elev. Offset', unit: 'm', type: 'number', default: 0 },
    inletNozzleElevation: { label: 'Inlet Nozzle Elev.', unit: 'm', type: 'number', default: 0 },
    outletNozzleElevation: { label: 'Outlet Nozzle Elev.', unit: 'm', type: 'number', default: 0 },
    pressureInputBasis: {
        label: 'Pressure Basis',
        type: 'select',
        default: 'Gauge',
        options: ['Gauge', 'Absolute']
    },
    pressure: { label: 'Vessel Pressure', unit: 'bar g', type: 'number', default: 0 },
    pressureDrop: { label: 'Pressure Drop', unit: 'bar', type: 'number', default: 0.1 },
    residenceTime: { label: 'Residence Time', unit: 'min', type: 'number', default: 5 },
    orientation: { label: 'Orientation', type: 'select', options: ['Horizontal', 'Vertical'], default: 'Horizontal', readonly: true }
};

const VERTICAL_VESSEL_SCHEMA = {
    ...SEPARATOR_SCHEMA,
    orientation: { label: 'Orientation', type: 'select', options: ['Horizontal', 'Vertical'], default: 'Vertical', readonly: true }
};
