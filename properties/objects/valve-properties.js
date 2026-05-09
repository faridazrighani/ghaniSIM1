const VALVE_LOSS_MODEL_CV = 'Cv';
const VALVE_LOSS_MODEL_K = 'K coefficient';
const VALVE_LOSS_MODEL_EQUIVALENT_LENGTH = 'Equivalent length';
const VALVE_CHAR_LINEAR = 'Linear';
const VALVE_CHAR_EQUAL_PERCENTAGE = 'Equal percentage';
const VALVE_CHAR_QUICK_OPENING = 'Quick opening';
const VALVE_CHAR_MANUAL_EFFECTIVE_CV = 'Manual effective Cv';

const VALVE_SCHEMA = {
    valveType: { label: 'Valve Type', type: 'select', options: ['Globe Valve', 'Ball Valve', 'Gate Valve', 'Butterfly Valve', 'Check Valve'], default: 'Globe Valve' },
    position: { label: 'Position', type: 'select', options: ['Suction', 'Discharge'], default: 'Discharge' },
    lossModel: { label: 'Loss Model', type: 'select', options: [VALVE_LOSS_MODEL_CV, VALVE_LOSS_MODEL_K, VALVE_LOSS_MODEL_EQUIVALENT_LENGTH], default: VALVE_LOSS_MODEL_CV },
    flowCharacteristic: { label: 'Flow Characteristic', type: 'select', options: [VALVE_CHAR_LINEAR, VALVE_CHAR_EQUAL_PERCENTAGE, VALVE_CHAR_QUICK_OPENING, VALVE_CHAR_MANUAL_EFFECTIVE_CV], default: VALVE_CHAR_LINEAR },
    cv: { label: 'Cv Value', unit: '', type: 'number', default: 100 },
    effectiveCv: { label: 'Manual Effective Cv', unit: '', type: 'number', default: 100 },
    kValue: { label: 'K Value', unit: '', type: 'number', default: 10 },
    equivLength: { label: 'Equivalent Length', unit: 'm', type: 'number', default: 10 },
    diameter: { label: 'Hydraulic Diameter', unit: 'm', type: 'number', default: 0.1 },
    opening: { label: '% Opening', unit: '%', type: 'number', default: 100 }
};

const CHECK_VALVE_SCHEMA = {
    crackingPressure: { label: 'Cracking Pressure', unit: 'bar', type: 'number', default: 0.1 },
    lossModel: { label: 'Forward Loss Model', type: 'select', options: [VALVE_LOSS_MODEL_CV, VALVE_LOSS_MODEL_K], default: VALVE_LOSS_MODEL_CV },
    cv: { label: 'Cv Value', unit: '', type: 'number', default: 100 },
    kValue: { label: 'Forward K Value', unit: '', type: 'number', default: 2 },
    diameter: { label: 'Hydraulic Diameter', unit: 'm', type: 'number', default: 0.1 },
    reverseFlow: { label: 'Reverse Flow', type: 'select', options: ['Blocked', 'Allowed for debug'], default: 'Blocked' }
};
