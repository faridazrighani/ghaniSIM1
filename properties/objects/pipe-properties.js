const PIPE_SCHEMA = {
    routeStyle: { label: 'Pipe Routing', type: 'select', options: ['Straight', 'Elbow'], default: 'Straight' },
    minorLoss: { label: 'Fittings (K)', unit: '', type: 'number', default: 0 }
};

const PIPE_SIZE_OPTIONS = [
    { label: 'Custom diameter', diameter: null },
    { label: 'NPS 1 - Sch 40', diameter: 0.02664 },
    { label: 'NPS 1 - Sch 80', diameter: 0.02431 },
    { label: 'NPS 1.5 - Sch 40', diameter: 0.04089 },
    { label: 'NPS 1.5 - Sch 80', diameter: 0.03810 },
    { label: 'NPS 2 - Sch 40', diameter: 0.05250 },
    { label: 'NPS 2 - Sch 80', diameter: 0.04925 },
    { label: 'NPS 3 - Sch 40', diameter: 0.07793 },
    { label: 'NPS 3 - Sch 80', diameter: 0.07366 },
    { label: 'NPS 4 - Sch 40', diameter: 0.10226 },
    { label: 'NPS 4 - Sch 80', diameter: 0.09718 },
    { label: 'NPS 6 - Sch 40', diameter: 0.15405 },
    { label: 'NPS 6 - Sch 80', diameter: 0.14633 },
    { label: 'NPS 8 - Sch 40', diameter: 0.20272 },
    { label: 'NPS 8 - Sch 80', diameter: 0.19368 },
    { label: 'NPS 10 - Sch 40', diameter: 0.25451 },
    { label: 'NPS 10 - Sch 80', diameter: 0.24765 },
    { label: 'NPS 12 - Sch 40', diameter: 0.30323 },
    { label: 'NPS 12 - Sch 80', diameter: 0.28885 }
];

const PIPE_MATERIAL_OPTIONS = [
    { label: 'Commercial steel', roughness: 0.000045 },
    { label: 'Drawn tubing', roughness: 0.0000015 },
    { label: 'Stainless steel', roughness: 0.000015 },
    { label: 'PVC / smooth plastic', roughness: 0.0000015 },
    { label: 'Cast iron', roughness: 0.00026 },
    { label: 'Concrete', roughness: 0.0015 },
    { label: 'Custom roughness', roughness: null }
];

const PIPE_FITTING_CUSTOM = 'Custom K';
const PIPE_FITTING_NONE = 'None';
const PIPE_FITTING_ROUTE_ELBOW = '90 smooth bend - flanged';

const PIPE_FITTING_OPTIONS = [
    { label: PIPE_FITTING_NONE, k: 0 },
    { label: 'Sharp-edged entrance', k: 0.5 },
    { label: 'Reentrant entrance', k: 0.8 },
    { label: 'Well-rounded entrance', k: 0.03 },
    { label: 'Submerged exit', k: 1.0 },
    { label: PIPE_FITTING_ROUTE_ELBOW, k: 0.3 },
    { label: '90 elbow - threaded', k: 0.9 },
    { label: '90 miter bend - no vanes', k: 1.1 },
    { label: '90 miter bend - with vanes', k: 0.2 },
    { label: '45 elbow - threaded', k: 0.4 },
    { label: '180 return bend - flanged', k: 0.2 },
    { label: 'Tee - line flow flanged', k: 0.2 },
    { label: 'Tee - branch flow flanged', k: 1.0 },
    { label: 'Threaded union', k: 0.08 },
    { label: 'Gate valve - fully open', k: 0.2 },
    { label: 'Globe valve - fully open', k: 10.0 },
    { label: 'Angle valve - fully open', k: 5.0 },
    { label: 'Ball valve - fully open', k: 0.05 },
    { label: 'Swing check valve', k: 2.0 },
    { label: PIPE_FITTING_CUSTOM, k: null }
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
        minorLoss: 0
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

function normalizePipeProps(pipeProps) {
    if (!pipeProps) return { segments: [] };
    pipeProps.routeStyle = pipeProps.routeStyle || 'Straight';
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
