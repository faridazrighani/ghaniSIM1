const SOURCE_SCHEMA = {
    sourceType: {
        label: 'Source Type',
        type: 'select',
        default: 'Open Tank / Reservoir',
        options: [
            'Open Tank / Reservoir',
            'Pressurized Vessel',
            'External Header / Pipe Tie-in',
            'Fixed Flow Source',
            'Standalone Boundary Source'
        ]
    },
    boundaryDataSource: {
        label: 'Boundary Data Source',
        type: 'select',
        default: 'Manual',
        options: ['Manual', 'Inherit from Attached Equipment']
    },
    pressureInputBasis: {
        label: 'Pressure Basis',
        type: 'select',
        default: 'Gauge',
        options: ['Gauge', 'Absolute']
    },
    pressure: { label: 'Boundary Pressure', unit: 'bar g', type: 'number', default: 0 },
    pressureEnergyBasis: {
        label: 'Pressure Energy Basis',
        type: 'select',
        default: 'Static Pressure',
        options: ['Static Pressure', 'Total / Stagnation Pressure']
    },
    elevation: { label: 'Source Elevation', unit: 'm', type: 'number', default: 0 },
    temperatureMode: {
        label: 'Temperature Mode',
        type: 'select',
        default: 'Use Fluid Basis',
        options: ['Use Fluid Basis', 'Custom']
    },
    temp: { label: 'Temperature', unit: 'deg C', type: 'number', default: 25 },
    flowInputMode: {
        label: 'Flow Input Mode',
        type: 'select',
        default: 'Mass Flow',
        options: ['Volumetric Flow', 'Mass Flow', 'Solve from Network']
    },
    flow: { label: 'Volumetric Flow', unit: 'm3/h', type: 'number', default: 9.5 },
    massFlow: { label: 'Mass Flow', unit: 'kg/h', type: 'number', default: 9500 }
};

const SINK_SCHEMA = {
    active: {
        label: 'Active',
        type: 'select',
        default: 'Active',
        options: ['Active', 'Inactive']
    },
    boundaryMode: {
        label: 'Boundary Mode',
        type: 'select',
        default: 'Outlet Pressure',
        options: ['Outlet Pressure', 'Flow Demand']
    },
    pressureInputBasis: {
        label: 'Pressure Basis',
        type: 'select',
        default: 'Gauge',
        options: ['Gauge', 'Absolute']
    },
    pressure: { label: 'Outlet Pressure', unit: 'bar g', type: 'number', default: 0 },
    pressureBasis: {
        label: 'Pipe Pressure Type',
        type: 'select',
        default: 'Static',
        options: ['Static', 'Stagnation']
    },
    elevation: { label: 'Elevation', unit: 'm', type: 'number', default: 0 },
    demandFlow: { label: 'Flow Demand', unit: 'm3/h', type: 'number', default: 0 }
};

const JUNCTION_SCHEMA = {
    pressure: { label: 'Node Pressure', unit: 'bar a', type: 'number', default: 1.01325, readonly: true }
};
