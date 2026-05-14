const PIPE_PRESSURE_CLASS_OPTIONS = [
    'ASME Class 150',
    'ASME Class 300',
    'ASME Class 600',
    'PN10',
    'PN16',
    'PN25',
    'PN40',
    'User-defined'
];

const PIPE_END_CONNECTION_OPTIONS = [
    'By piping class / compatible',
    'Flanged RF',
    'Butt weld',
    'Threaded NPT',
    'Socket weld',
    'Wafer/Lug compatible',
    'Grooved',
    'User-defined'
];

const PIPE_SCHEMA = {
    routeStyle: { label: 'Pipe Routing', type: 'select', options: ['Straight', 'Elbow'], default: 'Straight' },
    pressureClass: { label: 'Pipe Rating/Class', type: 'select', options: PIPE_PRESSURE_CLASS_OPTIONS, default: 'ASME Class 150' },
    endConnection: { label: 'End Connection Basis', type: 'select', options: PIPE_END_CONNECTION_OPTIONS, default: 'By piping class / compatible' },
    elevationProfileMode: {
        label: 'Elevation Profile',
        type: 'select',
        options: ['Ignore', 'End Elevations', 'High Point Check'],
        default: 'End Elevations'
    },
    startElevation: { label: 'Start Elevation Override', unit: 'm', type: 'number', default: '' },
    endElevation: { label: 'End Elevation Override', unit: 'm', type: 'number', default: '' },
    highPointElevation: { label: 'High Point Elevation', unit: 'm', type: 'number', default: '' },
    highPointLocationPercent: { label: 'High Point Location', unit: '% length', type: 'number', default: 50 },
    roughnessAgingFactor: { label: 'Aging Roughness Factor', unit: 'x', type: 'number', default: 1 },
    headLossAllowancePercent: { label: 'Head Loss Allowance', unit: '%', type: 'number', default: 0 },
    minorLoss: { label: 'Fittings (K)', unit: '', type: 'number', default: 0 }
};

const PIPE_ASME_SCHEDULE_ORDER = ['5S', '10S', '10', '20', '30', '40S', 'STD', '40', '60', '80S', 'XS', '80', '100', '120', '140', '160', 'XXS'];
const PIPE_DECIMAL_NPS_ALIASES = {
    '1.25': '1 1/4',
    '1.5': '1 1/2',
    '2.5': '2 1/2',
    '3.5': '3 1/2'
};

const PIPE_ASME_DIMENSION_ROWS = [
    { nps: '1/8', dn: 6, odMm: 10.3, walls: { '10S': 1.24, '10': 1.24, '30': 1.45, '40S': 1.73, STD: 1.73, '40': 1.73, '80S': 2.41, XS: 2.41, '80': 2.41 } },
    { nps: '1/4', dn: 8, odMm: 13.7, walls: { '10S': 1.65, '10': 1.65, '30': 1.85, '40S': 2.24, STD: 2.24, '40': 2.24, '80S': 3.02, XS: 3.02, '80': 3.02 } },
    { nps: '3/8', dn: 10, odMm: 17.1, walls: { '10S': 1.65, '10': 1.65, '30': 1.85, '40S': 2.31, STD: 2.31, '40': 2.31, '80S': 3.20, XS: 3.20, '80': 3.20 } },
    { nps: '1/2', dn: 15, odMm: 21.3, walls: { '5S': 1.65, '10S': 2.11, '10': 2.11, '40S': 2.77, STD: 2.77, '40': 2.77, '80S': 3.73, XS: 3.73, '80': 3.73, '160': 4.78, XXS: 7.47 } },
    { nps: '3/4', dn: 20, odMm: 26.7, walls: { '5S': 1.65, '10S': 2.11, '10': 2.11, '40S': 2.87, STD: 2.87, '40': 2.87, '80S': 3.91, XS: 3.91, '80': 3.91, '160': 5.56, XXS: 7.82 } },
    { nps: '1', dn: 25, odMm: 33.4, walls: { '5S': 1.65, '10S': 2.77, '10': 2.77, '40S': 3.38, STD: 3.38, '40': 3.38, '80S': 4.55, XS: 4.55, '80': 4.55, '160': 6.35, XXS: 9.09 } },
    { nps: '1 1/4', dn: 32, odMm: 42.2, walls: { '5S': 1.65, '10S': 2.77, '10': 2.77, '40S': 3.56, STD: 3.56, '40': 3.56, '80S': 4.85, XS: 4.85, '80': 4.85, '160': 6.35, XXS: 9.70 } },
    { nps: '1 1/2', dn: 40, odMm: 48.3, walls: { '5S': 1.65, '10S': 2.77, '10': 2.77, '40S': 3.68, STD: 3.68, '40': 3.68, '80S': 5.08, XS: 5.08, '80': 5.08, '160': 7.14, XXS: 10.15 } },
    { nps: '2', dn: 50, odMm: 60.3, walls: { '5S': 1.65, '10S': 2.77, '10': 2.77, '40S': 3.91, STD: 3.91, '40': 3.91, '80S': 5.54, XS: 5.54, '80': 5.54, '160': 8.74, XXS: 11.07 } },
    { nps: '2 1/2', dn: 65, odMm: 73.0, walls: { '5S': 2.11, '10S': 3.05, '10': 3.05, '40S': 5.16, STD: 5.16, '40': 5.16, '80S': 7.01, XS: 7.01, '80': 7.01, '160': 9.53, XXS: 14.02 } },
    { nps: '3', dn: 80, odMm: 88.9, walls: { '5S': 2.11, '10S': 3.05, '10': 3.05, '40S': 5.49, STD: 5.49, '40': 5.49, '80S': 7.62, XS: 7.62, '80': 7.62, '160': 11.13, XXS: 15.24 } },
    { nps: '3 1/2', dn: 90, odMm: 101.6, walls: { '5S': 2.11, '10S': 3.05, '10': 3.05, '40S': 5.74, STD: 5.74, '40': 5.74, '80S': 8.08, XS: 8.08, '80': 8.08 } },
    { nps: '4', dn: 100, odMm: 114.3, walls: { '5S': 2.11, '10S': 3.05, '10': 3.05, '40S': 6.02, STD: 6.02, '40': 6.02, '80S': 8.56, XS: 8.56, '80': 8.56, '120': 11.13, '160': 13.49, XXS: 17.12 } },
    { nps: '5', dn: 125, odMm: 141.3, walls: { '5S': 2.77, '10S': 3.40, '10': 3.40, '40S': 6.55, STD: 6.55, '40': 6.55, '80S': 9.53, XS: 9.53, '80': 9.53, '120': 12.70, '160': 15.88, XXS: 19.05 } },
    { nps: '6', dn: 150, odMm: 168.3, walls: { '5S': 2.77, '10S': 3.40, '10': 3.40, '40S': 7.11, STD: 7.11, '40': 7.11, '80S': 10.97, XS: 10.97, '80': 10.97, '120': 14.27, '160': 18.26, XXS: 21.95 } },
    { nps: '8', dn: 200, odMm: 219.1, walls: { '5S': 2.77, '10S': 3.76, '10': 3.76, '20': 6.35, '30': 7.04, '40S': 8.18, STD: 8.18, '40': 8.18, '60': 10.31, '80S': 12.70, XS: 12.70, '80': 12.70, '100': 15.09, '120': 18.26, '140': 20.62, '160': 23.01, XXS: 22.23 } },
    { nps: '10', dn: 250, odMm: 273.1, walls: { '5S': 3.40, '10S': 4.19, '10': 4.19, '20': 6.35, '30': 7.80, '40S': 9.27, STD: 9.27, '40': 9.27, '60': 12.70, '80S': 12.70, XS: 12.70, '80': 15.09, '100': 18.26, '120': 21.44, '140': 25.40, '160': 28.58, XXS: 25.40 } },
    { nps: '12', dn: 300, odMm: 323.9, walls: { '5S': 3.96, '10S': 4.57, '10': 4.57, '20': 6.35, '30': 8.38, '40S': 9.53, STD: 9.53, '40': 10.31, '60': 14.27, '80S': 12.70, XS: 12.70, '80': 17.48, '100': 21.44, '120': 25.40, '140': 28.58, '160': 33.32, XXS: 25.40 } },
    { nps: '14', dn: 350, odMm: 355.6, walls: { '5S': 3.96, '10S': 4.78, '10': 6.35, '20': 7.92, '30': 9.53, '40S': 9.53, STD: 9.53, '40': 11.13, '60': 15.09, '80S': 12.70, XS: 12.70, '80': 19.05, '100': 23.83, '120': 27.79, '140': 31.75, '160': 35.71 } },
    { nps: '16', dn: 400, odMm: 406.4, walls: { '5S': 4.19, '10S': 4.78, '10': 6.35, '20': 7.92, '30': 9.53, '40S': 9.53, STD: 9.53, '40': 12.70, '60': 16.66, '80S': 12.70, XS: 12.70, '80': 21.44, '100': 26.19, '120': 30.96, '140': 36.53, '160': 40.49 } },
    { nps: '18', dn: 450, odMm: 457.2, walls: { '5S': 4.19, '10S': 4.78, '10': 6.35, '20': 7.92, '30': 11.13, '40S': 9.53, STD: 9.53, '40': 14.27, '60': 19.05, '80S': 12.70, XS: 12.70, '80': 23.83, '100': 29.36, '120': 34.93, '140': 39.67, '160': 45.24 } },
    { nps: '20', dn: 500, odMm: 508.0, walls: { '5S': 4.78, '10S': 5.54, '10': 6.35, '20': 9.53, '30': 12.70, '40S': 9.53, STD: 9.53, '40': 15.09, '60': 20.62, '80S': 12.70, XS: 12.70, '80': 26.19, '100': 32.54, '120': 38.10, '140': 44.45, '160': 50.01 } },
    { nps: '22', dn: 550, odMm: 559.0, walls: { '5S': 4.78, '10S': 5.54, '10': 6.35, '20': 9.53, '30': 12.70, '40S': 9.53, STD: 9.53, '60': 22.23, '80S': 12.70, XS: 12.70, '80': 28.58, '100': 34.93, '120': 41.28, '140': 47.63, '160': 53.98 } },
    { nps: '24', dn: 600, odMm: 610.0, walls: { '5S': 5.54, '10S': 6.35, '10': 6.35, '20': 9.53, '30': 14.27, '40S': 9.53, STD: 9.53, '40': 17.48, '60': 24.61, '80S': 12.70, XS: 12.70, '80': 30.96, '100': 38.89, '120': 46.02, '140': 52.37, '160': 59.54 } }
];

function pipeMmToM(value) {
    return Number((value / 1000).toFixed(6));
}

function getPipeScheduleStandard(schedule) {
    return String(schedule || '').endsWith('S') ? 'ASME B36.19M' : 'ASME B36.10M';
}

function createPipeSizeOption(row, schedule) {
    const wallMm = row.walls[schedule];
    const insideDiameterMm = Math.max(0, row.odMm - (2 * wallMm));
    const standard = getPipeScheduleStandard(schedule);
    return {
        label: `NPS ${row.nps} - Sch ${schedule}`,
        nps: row.nps,
        dn: row.dn,
        schedule,
        standard,
        outsideDiameter: pipeMmToM(row.odMm),
        outsideDiameterMm: row.odMm,
        wallThickness: pipeMmToM(wallMm),
        wallThicknessMm: wallMm,
        diameter: pipeMmToM(insideDiameterMm),
        insideDiameterMm: Number(insideDiameterMm.toFixed(3)),
        source: `${standard} schedule dimension preset; ID = OD - 2 x wall thickness; verify project piping class and material specification.`,
        status: 'Standard'
    };
}

const PIPE_SIZE_OPTIONS = [
    { label: 'Custom diameter', diameter: null, source: 'User-entered internal diameter', status: 'User' },
    ...PIPE_ASME_DIMENSION_ROWS.flatMap(row => PIPE_ASME_SCHEDULE_ORDER
        .filter(schedule => row.walls[schedule] !== undefined)
        .map(schedule => createPipeSizeOption(row, schedule)))
];

const PIPE_MATERIAL_OPTIONS = [
    { label: 'Commercial steel', roughness: 0.000045, source: 'Moody/Fox typical value', status: 'Typical' },
    { label: 'Drawn tubing', roughness: 0.0000015, source: 'Moody/Fox typical smooth tube value', status: 'Typical' },
    { label: 'Stainless steel', roughness: 0.000015, source: 'Engineering estimate; verify vendor data', status: 'Estimate' },
    { label: 'PVC / smooth plastic', roughness: 0.0000015, source: 'Hydraulically smooth plastic typical value', status: 'Typical' },
    { label: 'Cast iron', roughness: 0.00026, source: 'Moody/Fox typical cast iron value', status: 'Typical' },
    { label: 'Concrete', roughness: 0.0015, source: 'Engineering estimate; roughness varies widely', status: 'Estimate' },
    { label: 'Custom roughness', roughness: null, source: 'User-entered roughness', status: 'User' }
];

const PIPE_FITTING_CUSTOM = 'Custom K';
const PIPE_FITTING_NONE = 'None';
const PIPE_FITTING_ROUTE_ELBOW = '90 smooth bend - flanged';

const PIPE_FITTING_OPTIONS = [
    { label: PIPE_FITTING_NONE, k: 0, source: 'No local fitting loss', status: 'Exact' },
    { label: 'Sharp-edged entrance', k: 0.5, source: 'Textbook typical minor loss coefficient', status: 'Typical' },
    { label: 'Reentrant entrance', k: 0.8, source: 'Textbook typical minor loss coefficient', status: 'Typical' },
    { label: 'Well-rounded entrance', k: 0.03, source: 'Textbook typical minor loss coefficient', status: 'Typical' },
    { label: 'Submerged exit', k: 1.0, source: 'Textbook exit loss coefficient', status: 'Typical' },
    { label: PIPE_FITTING_ROUTE_ELBOW, k: 0.3, source: 'Textbook/Crane-style typical bend K', status: 'Typical' },
    { label: '90 elbow - threaded', k: 0.9, source: 'Textbook/Crane-style typical fitting K', status: 'Typical' },
    { label: '90 miter bend - no vanes', k: 1.1, source: 'Textbook/Crane-style typical fitting K', status: 'Typical' },
    { label: '90 miter bend - with vanes', k: 0.2, source: 'Textbook/Crane-style typical fitting K', status: 'Typical' },
    { label: '45 elbow - threaded', k: 0.4, source: 'Textbook/Crane-style typical fitting K', status: 'Typical' },
    { label: '180 return bend - flanged', k: 0.2, source: 'Textbook/Crane-style typical fitting K', status: 'Typical' },
    { label: 'Tee - line flow flanged', k: 0.2, source: 'Textbook/Crane-style typical fitting K', status: 'Typical' },
    { label: 'Tee - branch flow flanged', k: 1.0, source: 'Textbook/Crane-style typical fitting K', status: 'Typical' },
    { label: 'Threaded union', k: 0.08, source: 'Textbook/Crane-style typical fitting K', status: 'Typical' },
    { label: '90 elbow - long radius flanged', k: 0.2, source: 'Textbook/Crane-style typical long-radius elbow K', status: 'Typical' },
    { label: '90 elbow - short radius flanged', k: 0.5, source: 'Textbook/Crane-style typical short-radius elbow K', status: 'Typical' },
    { label: '45 elbow - flanged', k: 0.2, source: 'Textbook/Crane-style typical fitting K', status: 'Typical' },
    { label: 'Concentric reducer - gradual', k: 0.15, source: 'Engineering screening value; verify geometry/vendor data', status: 'Estimate' },
    { label: 'Sudden contraction', k: 0.5, source: 'Engineering screening value; depends on area ratio', status: 'Estimate' },
    { label: 'Sudden expansion', k: 1.0, source: 'Engineering screening value; depends on area ratio', status: 'Estimate' },
    { label: 'Y-strainer - clean', k: 2.0, source: 'Typical clean strainer screening value; verify vendor data', status: 'Estimate' },
    { label: 'Basket strainer - clean', k: 1.5, source: 'Typical clean strainer screening value; verify vendor data', status: 'Estimate' },
    { label: 'Gate valve - fully open', k: 0.2, source: 'Textbook/Crane-style typical valve K', status: 'Typical' },
    { label: 'Globe valve - fully open', k: 10.0, source: 'Textbook/Crane-style typical valve K', status: 'Typical' },
    { label: 'Angle valve - fully open', k: 5.0, source: 'Textbook/Crane-style typical valve K', status: 'Typical' },
    { label: 'Ball valve - fully open', k: 0.05, source: 'Textbook/Crane-style typical valve K', status: 'Typical' },
    { label: 'Butterfly valve - fully open', k: 0.4, source: 'Textbook/Crane-style typical valve K', status: 'Typical' },
    { label: 'Plug valve - fully open', k: 0.4, source: 'Textbook/Crane-style typical valve K', status: 'Typical' },
    { label: 'Control valve - generic open', k: 10.0, source: 'Screening value only; use vendor Cv for control valves', status: 'Estimate' },
    { label: 'Swing check valve', k: 2.0, source: 'Textbook/Crane-style typical valve K', status: 'Typical' },
    { label: PIPE_FITTING_CUSTOM, k: null, source: 'User-entered loss coefficient', status: 'User' }
];

const PIPE_DEFAULT_SEGMENTS = [
    {
        name: "Segment 1",
        pipeSize: "Custom diameter",
        material: "Commercial steel",
        diameter: 0.1,
        length: 10,
        roughness: 0.000045,
        fittingType: PIPE_FITTING_NONE,
        fittingQuantity: 0,
        fittingK: 0,
        minorLoss: 0,
        startElevation: '',
        endElevation: '',
        highPointElevation: '',
        highPointLocationPercent: 50
    }
];

const PIPE_SEGMENT_AUTO_NAME_PATTERN = /^PIPE-\d+-Seg-\d+$/i;
const PIPE_SEGMENT_LEGACY_NAME_PATTERN = /^Segment\s+\d+$/i;

function getPipeSegmentAutoName(pipeId, index) {
    const normalizedPipeId = String(pipeId || '').trim();
    const segmentNumber = Math.max(1, index + 1);
    return /^PIPE-\d+$/i.test(normalizedPipeId)
        ? `${normalizedPipeId}-Seg-${segmentNumber}`
        : `Segment ${segmentNumber}`;
}

function isPipeAutoManagedSegmentName(value) {
    const name = String(value || '').trim();
    return !name
        || name.toLowerCase() === 'new seg'
        || PIPE_SEGMENT_LEGACY_NAME_PATTERN.test(name)
        || PIPE_SEGMENT_AUTO_NAME_PATTERN.test(name);
}

function normalizePipeSegmentName(segment, index, pipeId = '') {
    if (!segment) return;
    const existingName = String(segment.name || '').trim();
    if (segment.nameUserEdited === true && existingName) return;

    if (!existingName || (pipeId && isPipeAutoManagedSegmentName(existingName))) {
        segment.name = getPipeSegmentAutoName(pipeId, index);
        segment.nameUserEdited = false;
    }
}

function normalizePipeSegmentNames(pipeProps, pipeId = '') {
    if (!pipeProps || !Array.isArray(pipeProps.segments)) return pipeProps;
    pipeProps.segments.forEach((segment, index) => normalizePipeSegmentName(segment, index, pipeId));
    return pipeProps;
}

function normalizePipeNpsToken(value) {
    const token = String(value || '').trim().replace(/\s+/g, ' ');
    return PIPE_DECIMAL_NPS_ALIASES[token] || token;
}

function normalizePipeScheduleToken(value) {
    return String(value || '').trim().replace(/^Sch\s+/i, '').toUpperCase();
}

function normalizePipeSizeLabel(label) {
    const text = String(label || '').trim();
    if (!text || text === 'Custom diameter') return text || 'Custom diameter';

    const dnNpsMatch = text.match(/^DN\s+\d+\s*\/\s*NPS\s+(.+?)\s*-\s*Sch\s+(.+)$/i);
    if (dnNpsMatch) {
        return `NPS ${normalizePipeNpsToken(dnNpsMatch[1])} - Sch ${normalizePipeScheduleToken(dnNpsMatch[2])}`;
    }

    const npsMatch = text.match(/^NPS\s+(.+?)\s*-\s*Sch\s+(.+)$/i);
    if (npsMatch) {
        return `NPS ${normalizePipeNpsToken(npsMatch[1])} - Sch ${normalizePipeScheduleToken(npsMatch[2])}`;
    }

    return text;
}

function getPipeSizeOption(label) {
    const normalizedLabel = normalizePipeSizeLabel(label);
    return PIPE_SIZE_OPTIONS.find(item => item.label === normalizedLabel)
        || PIPE_SIZE_OPTIONS.find(item => item.label === label)
        || PIPE_SIZE_OPTIONS[0];
}

function getPipeMaterialOption(label) {
    return PIPE_MATERIAL_OPTIONS.find(item => item.label === label) || PIPE_MATERIAL_OPTIONS[0];
}

function getPipeFittingOption(label) {
    return PIPE_FITTING_OPTIONS.find(item => item.label === label) || PIPE_FITTING_OPTIONS[0];
}

function normalizePipePressureClass(value) {
    return PIPE_PRESSURE_CLASS_OPTIONS.includes(value) ? value : 'ASME Class 150';
}

function normalizePipeEndConnection(value) {
    return PIPE_END_CONNECTION_OPTIONS.includes(value) ? value : 'By piping class / compatible';
}

function getPipePressureClass(pipe) {
    return normalizePipePressureClass(pipe?.props?.pressureClass);
}

function getPipeEndConnection(pipe) {
    return normalizePipeEndConnection(pipe?.props?.endConnection);
}

function getPipeMaterialFamily(material) {
    const label = String(material || '').toLowerCase();
    if (label.includes('stainless')) return 'Stainless steel';
    if (label.includes('pvc') || label.includes('plastic')) return 'PVC / plastic';
    if (label.includes('cast iron')) return 'Cast iron';
    if (label.includes('concrete')) return 'Concrete';
    if (label.includes('custom')) return 'User-defined';
    if (label.includes('commercial') || label.includes('steel') || label.includes('drawn tubing')) return 'Carbon steel';
    return material || 'User-defined';
}

function getPipeSizeSource(segment) {
    const option = getPipeSizeOption(segment?.pipeSize);
    if (option.label === 'Custom diameter') {
        return { status: 'User', source: 'User-entered internal diameter' };
    }
    return { status: option.status || 'Standard', source: option.source || 'NPS/Schedule internal diameter preset' };
}

function getPipeMaterialSource(segment) {
    const option = getPipeMaterialOption(segment?.material);
    if (option.label === 'Custom roughness') {
        return { status: 'User', source: 'User-entered roughness' };
    }
    return { status: option.status || 'Typical', source: option.source || 'Typical engineering value' };
}

function hasPipeAdditionalK(segment) {
    return Math.max(0, parseFloat(segment?.minorLoss) || 0) > 0;
}

function getPipeFittingSource(segment) {
    if (hasPipeAdditionalK(segment)) {
        return { status: 'User', source: 'User-entered Add K overrides K each for this segment' };
    }
    const option = getPipeFittingOption(segment?.fittingType);
    if (option.label === PIPE_FITTING_CUSTOM) {
        return { status: 'User', source: 'User-entered loss coefficient' };
    }
    return { status: option.status || 'Typical', source: option.source || 'Typical engineering value' };
}

function getPipeFittingK(segment) {
    if (hasPipeAdditionalK(segment)) return 0;
    const option = getPipeFittingOption(segment?.fittingType);
    if (option.label === PIPE_FITTING_CUSTOM) {
        return Math.max(0, parseFloat(segment.fittingK) || 0);
    }
    return Math.max(0, parseFloat(option.k) || 0);
}

function getPipeFittingTotalK(segment) {
    if (hasPipeAdditionalK(segment)) return 0;
    const quantity = Math.max(0, parseFloat(segment?.fittingQuantity) || 0);
    return quantity * getPipeFittingK(segment);
}

function getPipeAdditionalK(segment) {
    return Math.max(0, parseFloat(segment?.minorLoss) || 0);
}

function getPipeSegmentTotalK(segment) {
    return getPipeFittingTotalK(segment) + getPipeAdditionalK(segment);
}

function isPipeValveLikeFitting(fittingType) {
    const label = String(fittingType || '').toLowerCase();
    return label.includes('valve') || label.includes('check');
}

function getPipeRepresentativeDiameter(pipe) {
    if (!pipe || pipe.type !== 'pipe' || !pipe.props) return null;
    normalizePipeProps(pipe.props, pipe.name || '');
    const segment = (pipe.props.segments || []).find(item => parseFloat(item.diameter) > 0);
    const diameter = parseFloat(segment?.diameter);
    return Number.isFinite(diameter) && diameter > 0 ? diameter : null;
}

function getPipeRepresentativeSizeLabel(pipe) {
    if (!pipe || pipe.type !== 'pipe' || !pipe.props) return '-';
    normalizePipeProps(pipe.props, pipe.name || '');
    const segment = (pipe.props.segments || []).find(item => parseFloat(item.diameter) > 0);
    return segment?.pipeSize || 'Custom diameter';
}

function getPipeConnectedValveReferences(pipeId, model = globalModel, connectionList = connections) {
    if (!pipeId || !model || !Array.isArray(connectionList)) return [];
    return connectionList
        .filter(conn => conn?.pipeId === pipeId && conn.connectionType !== 'semantic')
        .flatMap(conn => [conn.from, conn.to]
            .filter(nodeId => model[nodeId] && ['valve', 'checkValve'].includes(model[nodeId].type))
            .map(nodeId => ({ nodeId, node: model[nodeId], connection: conn })));
}

function getPipeValveCompatibilityWarnings(pipeId, model = globalModel, connectionList = connections) {
    const pipe = model?.[pipeId];
    if (!pipe || pipe.type !== 'pipe' || !pipe.props) return [];

    normalizePipeProps(pipe.props, pipeId);
    const warnings = [];
    const connectedValves = getPipeConnectedValveReferences(pipeId, model, connectionList);
    const hasPhysicalValveObject = connectedValves.length > 0;
    const valveLikeSegments = (pipe.props.segments || []).filter(segment => (
        isPipeValveLikeFitting(segment.fittingType)
        && Math.max(0, parseFloat(segment.fittingQuantity) || 0) > 0
    ));

    if (hasPhysicalValveObject && valveLikeSegments.length) {
        const fittingNames = [...new Set(valveLikeSegments.map(segment => segment.fittingType).filter(Boolean))].join(', ');
        const valveIds = [...new Set(connectedValves.map(ref => ref.nodeId))].join(', ');
        warnings.push(`${pipeId} has valve-like fitting K (${fittingNames}) and is connected to valve object(s) ${valveIds}; confirm this is not double-counting valve loss.`);
    }

    const pipeDiameter = getPipeRepresentativeDiameter(pipe);
    connectedValves.forEach(ref => {
        const valveDiameter = parseFloat(ref.node?.props?.diameter);
        if (!Number.isFinite(pipeDiameter) || pipeDiameter <= 0 || !Number.isFinite(valveDiameter) || valveDiameter <= 0) return;
        const mismatchFraction = Math.abs(valveDiameter - pipeDiameter) / pipeDiameter;
        if (mismatchFraction > 0.02) {
            warnings.push(`${ref.nodeId} hydraulic diameter (${valveDiameter.toFixed(5)} m) differs from ${pipeId} representative ID (${pipeDiameter.toFixed(5)} m); verify reducer/expander or valve size.`);
        }
    });

    if (typeof getValveCompatibilityWarnings === 'function') {
        connectedValves.forEach(ref => {
            getValveCompatibilityWarnings(ref.nodeId, model, connectionList).forEach(warning => {
                if (warning) warnings.push(warning);
            });
        });
    }

    return [...new Set(warnings)];
}

function normalizeOptionalPipeNumber(value) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : '';
}

function normalizePipeProps(pipeProps, pipeId = '') {
    if (!pipeProps) return { segments: [] };
    pipeProps.routeStyle = pipeProps.routeStyle || 'Straight';
    pipeProps.pressureClass = normalizePipePressureClass(pipeProps.pressureClass);
    pipeProps.endConnection = normalizePipeEndConnection(pipeProps.endConnection);
    pipeProps.elevationProfileMode = pipeProps.elevationProfileMode || 'End Elevations';
    pipeProps.roughnessAgingFactor = Math.max(0, parseFloat(pipeProps.roughnessAgingFactor) || 1);
    pipeProps.headLossAllowancePercent = Math.max(0, parseFloat(pipeProps.headLossAllowancePercent) || 0);
    pipeProps.highPointLocationPercent = Math.max(0, Math.min(100, parseFloat(pipeProps.highPointLocationPercent) || 50));
    if (!Array.isArray(pipeProps.segments) || pipeProps.segments.length === 0) {
        pipeProps.segments = PIPE_DEFAULT_SEGMENTS.map(segment => ({ ...segment }));
    }
    normalizePipeSegmentNames(pipeProps, pipeId);

    const hasSegmentMinorLoss = pipeProps.segments.some(segment => segment.minorLoss !== undefined);
    const legacyMinorLoss = !hasSegmentMinorLoss ? (parseFloat(pipeProps.minorLoss) || 0) : 0;

    pipeProps.segments.forEach((segment, index) => {
        normalizePipeSegmentName(segment, index, pipeId);
        segment.pipeSize = segment.pipeSize || 'Custom diameter';
        segment.material = segment.material || 'Commercial steel';
        segment.length = Math.max(0, parseFloat(segment.length) || 0);

        const sizeOption = getPipeSizeOption(segment.pipeSize);
        if (sizeOption && sizeOption.diameter) {
            segment.diameter = sizeOption.diameter;
        } else {
            segment.pipeSize = 'Custom diameter';
            segment.diameter = Math.max(0, parseFloat(segment.diameter) || 0);
        }

        const materialOption = getPipeMaterialOption(segment.material);
        if (segment.roughness === undefined || segment.roughness === null || segment.roughness === '') {
            segment.roughness = materialOption.roughness || 0.000045;
        } else {
            segment.roughness = Math.max(0, parseFloat(segment.roughness) || 0);
        }

        if (segment.minorLoss === undefined) {
            segment.minorLoss = index === 0 ? legacyMinorLoss : 0;
        } else {
            segment.minorLoss = Math.max(0, parseFloat(segment.minorLoss) || 0);
        }

        segment.startElevation = normalizeOptionalPipeNumber(segment.startElevation);
        segment.endElevation = normalizeOptionalPipeNumber(segment.endElevation);
        segment.highPointElevation = normalizeOptionalPipeNumber(segment.highPointElevation);
        segment.highPointLocationPercent = Math.max(0, Math.min(100, parseFloat(segment.highPointLocationPercent) || 50));

        if (pipeProps.routeStyle !== 'Elbow' && segment.routeFittingAuto) {
            segment.fittingType = PIPE_FITTING_NONE;
            segment.fittingQuantity = 0;
            segment.fittingK = 0;
            segment.routeFittingAuto = false;
        }

        const currentFittingType = segment.fittingType || PIPE_FITTING_NONE;
        const currentFittingQuantity = parseFloat(segment.fittingQuantity) || 0;
        const currentFittingK = parseFloat(segment.fittingK) || 0;
        const hasActiveFitting = currentFittingType !== PIPE_FITTING_NONE
            || currentFittingQuantity > 0
            || currentFittingK > 0;
        const shouldAutoElbow = pipeProps.routeStyle === 'Elbow'
            && index === 0
            && segment.routeFittingAuto !== false
            && !hasActiveFitting
            && segment.minorLoss === 0;

        if (shouldAutoElbow) {
            segment.fittingType = PIPE_FITTING_ROUTE_ELBOW;
            segment.fittingQuantity = 1;
            segment.fittingK = getPipeFittingOption(PIPE_FITTING_ROUTE_ELBOW).k;
            segment.routeFittingAuto = true;
        } else {
            segment.fittingType = segment.fittingType || PIPE_FITTING_NONE;
            const fittingOption = getPipeFittingOption(segment.fittingType);
            if (fittingOption.label !== PIPE_FITTING_CUSTOM) {
                segment.fittingType = fittingOption.label;
                segment.fittingK = fittingOption.k || 0;
            } else {
                segment.fittingK = Math.max(0, parseFloat(segment.fittingK) || 0);
            }
            if (segment.fittingQuantity === undefined || segment.fittingQuantity === null || segment.fittingQuantity === '') {
                segment.fittingQuantity = segment.fittingType === PIPE_FITTING_NONE ? 0 : 1;
            } else {
                segment.fittingQuantity = Math.max(0, parseFloat(segment.fittingQuantity) || 0);
            }
        }

        if (hasPipeAdditionalK(segment)) {
            segment.fittingK = 0;
        }
    });

    pipeProps.minorLoss = 0;
    return pipeProps;
}
