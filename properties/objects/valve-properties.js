const VALVE_LOSS_MODEL_CV = 'Cv';
const VALVE_LOSS_MODEL_K = 'K coefficient';
const VALVE_LOSS_MODEL_EQUIVALENT_LENGTH = 'Equivalent length';
const VALVE_TYPE_CONTROL = 'Control Valve';
const VALVE_CHAR_LINEAR = 'Linear';
const VALVE_CHAR_EQUAL_PERCENTAGE = 'Equal percentage';
const VALVE_CHAR_QUICK_OPENING = 'Quick opening';
const VALVE_CHAR_MANUAL_EFFECTIVE_CV = 'Manual effective Cv';

const VALVE_BORE_TYPE_OPTIONS = ['Full bore', 'Reduced bore', 'User-defined bore'];
const VALVE_PRESSURE_CLASS_OPTIONS = typeof PIPE_PRESSURE_CLASS_OPTIONS !== 'undefined'
    ? PIPE_PRESSURE_CLASS_OPTIONS
    : ['ASME Class 150', 'ASME Class 300', 'ASME Class 600', 'PN10', 'PN16', 'PN25', 'PN40', 'User-defined'];
const VALVE_END_CONNECTION_OPTIONS = [
    'Flanged RF',
    'Butt weld',
    'Threaded NPT',
    'Socket weld',
    'Wafer',
    'Lug',
    'Grooved',
    'User-defined'
];
const VALVE_BODY_MATERIAL_OPTIONS = [
    'Carbon steel',
    'Stainless steel',
    'PVC / plastic',
    'Cast iron',
    'Ductile iron',
    'Bronze',
    'User-defined'
];
const VALVE_REDUCER_EXPANDER_BASIS_OPTIONS = [
    'Review only',
    'User modeled separately',
    'Estimate reducer/expander K'
];

const VALVE_SCHEMA = {
    valveType: { label: 'Valve Type', type: 'select', options: [VALVE_TYPE_CONTROL, 'Globe Valve', 'Ball Valve', 'Gate Valve', 'Butterfly Valve', 'Check Valve'], default: 'Globe Valve' },
    position: { label: 'Position', type: 'select', options: ['Suction', 'Discharge'], default: 'Discharge' },
    boreType: { label: 'Bore Type', type: 'select', options: VALVE_BORE_TYPE_OPTIONS, default: 'Reduced bore' },
    boreDiameter: { label: 'User Bore Diameter', unit: 'm', type: 'number', default: '' },
    pressureClass: { label: 'Valve Rating/Class', type: 'select', options: VALVE_PRESSURE_CLASS_OPTIONS, default: 'ASME Class 150' },
    endConnection: { label: 'End Connection', type: 'select', options: VALVE_END_CONNECTION_OPTIONS, default: 'Flanged RF' },
    bodyMaterial: { label: 'Body Material', type: 'select', options: VALVE_BODY_MATERIAL_OPTIONS, default: 'Carbon steel' },
    lossModel: { label: 'Loss Model', type: 'select', options: [VALVE_LOSS_MODEL_CV, VALVE_LOSS_MODEL_K, VALVE_LOSS_MODEL_EQUIVALENT_LENGTH], default: VALVE_LOSS_MODEL_CV },
    flowCharacteristic: { label: 'Flow Characteristic', type: 'select', options: [VALVE_CHAR_LINEAR, VALVE_CHAR_EQUAL_PERCENTAGE, VALVE_CHAR_QUICK_OPENING, VALVE_CHAR_MANUAL_EFFECTIVE_CV], default: VALVE_CHAR_LINEAR },
    cv: { label: 'Cv Value', unit: '', type: 'number', default: 100 },
    effectiveCv: { label: 'Manual Effective Cv', unit: '', type: 'number', default: 100 },
    kValue: { label: 'K Value', unit: '', type: 'number', default: 10 },
    equivLength: { label: 'Equivalent Length', unit: 'm', type: 'number', default: 10 },
    diameter: { label: 'Hydraulic Diameter', unit: 'm', type: 'number', default: 0.1 },
    reducerExpanderBasis: { label: 'Reducer/Expander Basis', type: 'select', options: VALVE_REDUCER_EXPANDER_BASIS_OPTIONS, default: 'Review only' },
    opening: { label: '% Opening', unit: '%', type: 'number', default: 100 }
};

const CHECK_VALVE_SCHEMA = {
    crackingPressure: { label: 'Cracking Pressure', unit: 'bar', type: 'number', default: 0.1 },
    boreType: { label: 'Bore Type', type: 'select', options: VALVE_BORE_TYPE_OPTIONS, default: 'Reduced bore' },
    boreDiameter: { label: 'User Bore Diameter', unit: 'm', type: 'number', default: '' },
    pressureClass: { label: 'Valve Rating/Class', type: 'select', options: VALVE_PRESSURE_CLASS_OPTIONS, default: 'ASME Class 150' },
    endConnection: { label: 'End Connection', type: 'select', options: VALVE_END_CONNECTION_OPTIONS, default: 'Flanged RF' },
    bodyMaterial: { label: 'Body Material', type: 'select', options: VALVE_BODY_MATERIAL_OPTIONS, default: 'Carbon steel' },
    lossModel: { label: 'Forward Loss Model', type: 'select', options: [VALVE_LOSS_MODEL_CV, VALVE_LOSS_MODEL_K], default: VALVE_LOSS_MODEL_CV },
    cv: { label: 'Cv Value', unit: '', type: 'number', default: 100 },
    kValue: { label: 'Forward K Value', unit: '', type: 'number', default: 2 },
    diameter: { label: 'Hydraulic Diameter', unit: 'm', type: 'number', default: 0.1 },
    reducerExpanderBasis: { label: 'Reducer/Expander Basis', type: 'select', options: VALVE_REDUCER_EXPANDER_BASIS_OPTIONS, default: 'Review only' },
    reverseFlow: { label: 'Reverse Flow', type: 'select', options: ['Blocked', 'Allowed for debug'], default: 'Blocked' }
};
