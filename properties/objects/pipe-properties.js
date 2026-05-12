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

const PIPE_SIZE_OPTIONS = [
    { label: 'Custom diameter', diameter: null, source: 'User-entered internal diameter', status: 'User' },
    { label: 'DN 25 / NPS 1 - Sch 40', diameter: 0.02664, source: 'DN/NPS schedule ID preset based on ASME B36.10M; verify project piping class', status: 'Standard' },
    { label: 'DN 40 / NPS 1.5 - Sch 40', diameter: 0.04089, source: 'DN/NPS schedule ID preset based on ASME B36.10M; verify project piping class', status: 'Standard' },
    { label: 'DN 50 / NPS 2 - Sch 40', diameter: 0.05250, source: 'DN/NPS schedule ID preset based on ASME B36.10M; verify project piping class', status: 'Standard' },
    { label: 'DN 80 / NPS 3 - Sch 40', diameter: 0.07793, source: 'DN/NPS schedule ID preset based on ASME B36.10M; verify project piping class', status: 'Standard' },
    { label: 'DN 100 / NPS 4 - Sch 40', diameter: 0.10226, source: 'DN/NPS schedule ID preset based on ASME B36.10M; verify project piping class', status: 'Standard' },
    { label: 'DN 150 / NPS 6 - Sch 40', diameter: 0.15405, source: 'DN/NPS schedule ID preset based on ASME B36.10M; verify project piping class', status: 'Standard' },
    { label: 'DN 200 / NPS 8 - Sch 40', diameter: 0.20272, source: 'DN/NPS schedule ID preset based on ASME B36.10M; verify project piping class', status: 'Standard' },
    { label: 'DN 250 / NPS 10 - Sch 40', diameter: 0.25451, source: 'DN/NPS schedule ID preset based on ASME B36.10M; verify project piping class', status: 'Standard' },
    { label: 'DN 300 / NPS 12 - Sch 40', diameter: 0.30323, source: 'DN/NPS schedule ID preset based on ASME B36.10M; verify project piping class', status: 'Standard' },
    { label: 'NPS 1 - Sch 40', diameter: 0.02664, source: 'ASME B36.10M schedule ID preset; verify project piping class', status: 'Standard' },
    { label: 'NPS 1 - Sch 80', diameter: 0.02431, source: 'ASME B36.10M schedule ID preset; verify project piping class', status: 'Standard' },
    { label: 'NPS 1.5 - Sch 40', diameter: 0.04089, source: 'ASME B36.10M schedule ID preset; verify project piping class', status: 'Standard' },
    { label: 'NPS 1.5 - Sch 80', diameter: 0.03810, source: 'ASME B36.10M schedule ID preset; verify project piping class', status: 'Standard' },
    { label: 'NPS 2 - Sch 40', diameter: 0.05250, source: 'ASME B36.10M schedule ID preset; verify project piping class', status: 'Standard' },
    { label: 'NPS 2 - Sch 80', diameter: 0.04925, source: 'ASME B36.10M schedule ID preset; verify project piping class', status: 'Standard' },
    { label: 'NPS 3 - Sch 40', diameter: 0.07793, source: 'ASME B36.10M schedule ID preset; verify project piping class', status: 'Standard' },
    { label: 'NPS 3 - Sch 80', diameter: 0.07366, source: 'ASME B36.10M schedule ID preset; verify project piping class', status: 'Standard' },
    { label: 'NPS 4 - Sch 40', diameter: 0.10226, source: 'ASME B36.10M schedule ID preset; verify project piping class', status: 'Standard' },
    { label: 'NPS 4 - Sch 80', diameter: 0.09718, source: 'ASME B36.10M schedule ID preset; verify project piping class', status: 'Standard' },
    { label: 'NPS 6 - Sch 40', diameter: 0.15405, source: 'ASME B36.10M schedule ID preset; verify project piping class', status: 'Standard' },
    { label: 'NPS 6 - Sch 80', diameter: 0.14633, source: 'ASME B36.10M schedule ID preset; verify project piping class', status: 'Standard' },
    { label: 'NPS 8 - Sch 40', diameter: 0.20272, source: 'ASME B36.10M schedule ID preset; verify project piping class', status: 'Standard' },
    { label: 'NPS 8 - Sch 80', diameter: 0.19368, source: 'ASME B36.10M schedule ID preset; verify project piping class', status: 'Standard' },
    { label: 'NPS 10 - Sch 40', diameter: 0.25451, source: 'ASME B36.10M schedule ID preset; verify project piping class', status: 'Standard' },
    { label: 'NPS 10 - Sch 80', diameter: 0.24765, source: 'ASME B36.10M schedule ID preset; verify project piping class', status: 'Standard' },
    { label: 'NPS 12 - Sch 40', diameter: 0.30323, source: 'ASME B36.10M schedule ID preset; verify project piping class', status: 'Standard' },
    { label: 'NPS 12 - Sch 80', diameter: 0.28885, source: 'ASME B36.10M schedule ID preset; verify project piping class', status: 'Standard' }
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

function getPipeSizeOption(label) {
    return PIPE_SIZE_OPTIONS.find(item => item.label === label) || PIPE_SIZE_OPTIONS[0];
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

function getPipeFittingSource(segment) {
    const option = getPipeFittingOption(segment?.fittingType);
    if (option.label === PIPE_FITTING_CUSTOM) {
        return { status: 'User', source: 'User-entered loss coefficient' };
    }
    return { status: option.status || 'Typical', source: option.source || 'Typical engineering value' };
}

function getPipeFittingK(segment) {
    const option = getPipeFittingOption(segment?.fittingType);
    if (option.label === PIPE_FITTING_CUSTOM) {
        return Math.max(0, parseFloat(segment.fittingK) || 0);
    }
    return Math.max(0, parseFloat(option.k) || 0);
}

function getPipeFittingTotalK(segment) {
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
    normalizePipeProps(pipe.props);
    const segment = (pipe.props.segments || []).find(item => parseFloat(item.diameter) > 0);
    const diameter = parseFloat(segment?.diameter);
    return Number.isFinite(diameter) && diameter > 0 ? diameter : null;
}

function getPipeRepresentativeSizeLabel(pipe) {
    if (!pipe || pipe.type !== 'pipe' || !pipe.props) return '-';
    normalizePipeProps(pipe.props);
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

    normalizePipeProps(pipe.props);
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

function normalizePipeProps(pipeProps) {
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

    const hasSegmentMinorLoss = pipeProps.segments.some(segment => segment.minorLoss !== undefined);
    const legacyMinorLoss = !hasSegmentMinorLoss ? (parseFloat(pipeProps.minorLoss) || 0) : 0;

    pipeProps.segments.forEach((segment, index) => {
        segment.name = segment.name || `Segment ${index + 1}`;
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
    });

    pipeProps.minorLoss = 0;
    return pipeProps;
}
