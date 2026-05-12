window.DEFAULT_SIMULATION_STATE = {
    model: {
        SETTINGS: {
            type: 'settings',
            name: 'Simulation Settings',
            props: {
                unitStandard: 'Metric / European Engineering',
                basisConfirmed: false,
                basisDirty: false,
                lastConfirmedFluid: '',
                lastConfirmedTemperature: null,
                lastConfirmedUnitStandard: 'Metric / European Engineering',
                migratedFromLegacy: false
            }
        },
        FLUID: {
            type: 'fluid',
            name: 'Fluid Basis',
            props: {
                inputMode: 'Basic',
                fluidName: 'Water',
                temp: 25,
                density: 997.0470133997646,
                sg: 0.9970749314978467,
                viscosity: 0.8926327060988247,
                dynViscosity: 0.889996773678783,
                vaporPressure: 0.03169824486313973,
                specificHeat: 4.181446178557689,
                bulkModulus: 2.233493550571319,
                specVolume: 0.001002961732556789,
                specWeight: 9781.031201451691,
                vaporPressureHead: 0.32407876235416877,
                speedOfSound: 1496.6992220000063
            }
        }
    },
    connections: [],
    instrumentLinks: [],
    sourceLinks: [],
    visuals: {}
};
