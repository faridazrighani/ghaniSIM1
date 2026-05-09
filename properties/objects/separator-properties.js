const SEPARATOR_SCHEMA = {
    visualScale: { label: 'PFD Size', unit: '%', type: 'number', default: 100 },
    pressureDrop: { label: 'Pressure Drop', unit: 'bar', type: 'number', default: 0.1 },
    residenceTime: { label: 'Residence Time', unit: 'min', type: 'number', default: 5 },
    orientation: { label: 'Orientation', type: 'select', options: ['Horizontal', 'Vertical'], default: 'Horizontal', readonly: true }
};

const VERTICAL_VESSEL_SCHEMA = {
    ...SEPARATOR_SCHEMA,
    orientation: { label: 'Orientation', type: 'select', options: ['Horizontal', 'Vertical'], default: 'Vertical', readonly: true }
};
