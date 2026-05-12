const TANK_CODE_BASIS_API_650 = 'API 650 Atmospheric Tank';
const TANK_CODE_BASIS_API_620 = 'API 620 Low-pressure Storage Tank';
const TANK_CODE_BASIS_USER_DEFINED = 'User-defined';
const TANK_CODE_BASIS_OPTIONS = [
    TANK_CODE_BASIS_API_650,
    TANK_CODE_BASIS_API_620,
    TANK_CODE_BASIS_USER_DEFINED
];
const TANK_EMERGENCY_VENT_NOT_SPECIFIED = 'Not specified';
const TANK_EMERGENCY_VENT_PROVIDED = 'Provided';
const TANK_EMERGENCY_VENT_NOT_PROVIDED = 'Not provided';
const TANK_EMERGENCY_VENT_OPTIONS = [
    TANK_EMERGENCY_VENT_NOT_SPECIFIED,
    TANK_EMERGENCY_VENT_PROVIDED,
    TANK_EMERGENCY_VENT_NOT_PROVIDED
];

const TANK_SCHEMA = {
    visualScale: { label: 'PFD Size', unit: '%', type: 'number', default: 100 },
    tankCodeBasis: {
        label: 'Tank Code Basis',
        type: 'select',
        default: TANK_CODE_BASIS_API_650,
        options: TANK_CODE_BASIS_OPTIONS
    },
    elevation: { label: 'Base Elevation', unit: 'm', type: 'number', default: 6 },
    diameter: { label: 'Tank Diameter', unit: 'm', type: 'number', default: 5 },
    tankHeight: { label: 'Tank Height / Shell Height', unit: 'm', type: 'number', default: 6 },
    liquidVolume: { label: 'Liquid Volume', unit: 'm3', type: 'number', default: 58.905, readonly: true },
    totalCapacity: { label: 'Total Capacity', unit: 'm3', type: 'number', default: 117.81, readonly: true },
    fillPercent: { label: 'Fill Percentage', unit: '%', type: 'number', default: 50, readonly: true },
    liquidLevel: { label: 'Current Level above Base', unit: 'm', type: 'number', default: 3 },
    inletNozzleElevation: { label: 'Inlet Nozzle Elev. from Datum', unit: 'm', type: 'number', default: 9 },
    outletNozzleElevation: { label: 'Outlet Nozzle Elev. from Datum', unit: 'm', type: 'number', default: 7 },
    hll: { label: 'HLL above Base', unit: 'm', type: 'number', default: 5 },
    nll: { label: 'NLL above Base', unit: 'm', type: 'number', default: 3 },
    lll: { label: 'LLL above Base', unit: 'm', type: 'number', default: 1.5 },
    tLevelElev: { label: 'Transmitter Elev. from Datum', unit: 'm', type: 'number', default: 9 },
    pressureInputBasis: {
        label: 'Pressure Basis',
        type: 'select',
        default: 'Gauge',
        options: ['Gauge', 'Absolute']
    },
    pressure: { label: 'Operating Vapor Space Pressure', unit: 'bar g', type: 'number', default: 0 },
    tankDesignPressure: { label: 'Tank Design Pressure', unit: 'mbar g', type: 'number', default: 25 },
    designVacuum: { label: 'Design Vacuum', unit: 'mbar vacuum', type: 'number', default: 5 },
    pressureVentSet: { label: 'Pressure Vent Set', unit: 'mbar g', type: 'number', default: 20 },
    vacuumVentSet: { label: 'Vacuum Vent Set', unit: 'mbar vacuum', type: 'number', default: 3 },
    emergencyVentProvided: {
        label: 'Emergency Vent',
        type: 'select',
        default: TANK_EMERGENCY_VENT_PROVIDED,
        options: TANK_EMERGENCY_VENT_OPTIONS
    },
    vaporPressure: { label: 'Vapor Pressure', unit: 'bar a', type: 'number', default: 0, readonly: true }
};
