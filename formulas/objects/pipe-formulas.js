const PIPE_LAMINAR_REYNOLDS_LIMIT = 2300;
const PIPE_TURBULENT_REYNOLDS_LIMIT = 4000;
const PIPE_MOODY_RE_MIN = 1000;
const PIPE_MOODY_RE_MAX = 100000000;
const PIPE_MOODY_F_MIN = 0.008;
const PIPE_MOODY_F_MAX = 0.12;
const PIPE_MOODY_ROUGHNESS_CURVES = [0, 0.00001, 0.00005, 0.0001, 0.0005, 0.001, 0.005];

function getPipeFlowRegime(reynolds) {
    if (!Number.isFinite(reynolds) || reynolds <= 0) return 'Not calculated';
    if (reynolds <= PIPE_LAMINAR_REYNOLDS_LIMIT) return 'Laminar';
    if (reynolds < PIPE_TURBULENT_REYNOLDS_LIMIT) return 'Transitional';
    return 'Turbulent';
}

function getPipeFlowRegimeWarning(reynolds) {
    return getPipeFlowRegime(reynolds) === 'Transitional'
        ? 'Transitional pipe flow; friction factor is approximate between laminar and turbulent regimes.'
        : '';
}

function calculateTurbulentFrictionFactor(reynolds, relRoughness) {
    let friction = 0.25 / Math.pow(Math.log10((relRoughness / 3.7) + (5.74 / Math.pow(reynolds, 0.9))), 2);
    for (let i = 0; i < 20; i++) {
        const next = 1 / Math.pow(-2 * Math.log10((relRoughness / 3.7) + (2.51 / (reynolds * Math.sqrt(friction)))), 2);
        if (Math.abs(next - friction) < 1e-7) return next;
        friction = next;
    }
    return friction;
}

function calculateFrictionFactor(reynolds, roughnessM, diameterM) {
    if (!Number.isFinite(reynolds) || reynolds <= 0 || diameterM <= 0) return 0;
    const laminar = 64 / reynolds;
    if (reynolds <= PIPE_LAMINAR_REYNOLDS_LIMIT) return laminar;

    const relRoughness = Math.max(roughnessM || 0, 0) / diameterM;
    const turbulent = calculateTurbulentFrictionFactor(Math.max(reynolds, PIPE_TURBULENT_REYNOLDS_LIMIT), relRoughness);
    if (reynolds >= PIPE_TURBULENT_REYNOLDS_LIMIT) return turbulent;

    const blend = (reynolds - PIPE_LAMINAR_REYNOLDS_LIMIT) / (PIPE_TURBULENT_REYNOLDS_LIMIT - PIPE_LAMINAR_REYNOLDS_LIMIT);
    return laminar + (turbulent - laminar) * blend;
}

function toPipeCalcNumber(value, fallback = 0) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function getPipeRoughnessAgingFactor(pipeProps) {
    return Math.max(0, toPipeCalcNumber(pipeProps?.roughnessAgingFactor, 1));
}

function getPipeHeadLossAllowanceFraction(pipeProps) {
    return Math.max(0, toPipeCalcNumber(pipeProps?.headLossAllowancePercent, 0)) / 100;
}

function calculatePipeHydraulicSegments(flowRateM3H, pipeProps, fluidPropsOverride = null) {
    normalizePipeProps(pipeProps);
    const details = [];
    if (flowRateM3H <= 0 || !pipeProps.segments || pipeProps.segments.length === 0) return details;

    const qM3S = flowRateM3H / 3600;
    const fluid = fluidPropsOverride ? { props: fluidPropsOverride } : globalModel["FLUID"];
    const kinVisc = Math.max(toPipeCalcNumber(fluid?.props?.viscosity, 1), 0.000001) * 1e-6;
    const roughnessAgingFactor = getPipeRoughnessAgingFactor(pipeProps);
    const allowanceFraction = getPipeHeadLossAllowanceFraction(pipeProps);

    pipeProps.segments.forEach((seg, index) => {
        const diameter = toPipeCalcNumber(seg.diameter);
        const length = Math.max(0, toPipeCalcNumber(seg.length));
        if (diameter <= 0) return;

        const area = Math.PI * Math.pow(diameter, 2) / 4;
        const velocity = qM3S / area;
        const reynolds = (velocity * diameter) / kinVisc;
        const roughness = toPipeCalcNumber(seg.roughness, 0.000045);
        const effectiveRoughness = roughness * roughnessAgingFactor;
        const frictionFactor = calculateFrictionFactor(reynolds, effectiveRoughness, diameter);
        const flowRegime = getPipeFlowRegime(reynolds);
        const regimeWarning = getPipeFlowRegimeWarning(reynolds);
        const velocityHead = Math.pow(velocity, 2) / (2 * GRAVITY);
        const majorLoss = frictionFactor * (length / diameter) * velocityHead;
        const fittingK = typeof getPipeFittingK === 'function'
            ? getPipeFittingK(seg)
            : Math.max(0, toPipeCalcNumber(seg.fittingK));
        const fittingQuantity = Math.max(0, toPipeCalcNumber(seg.fittingQuantity));
        const fittingTotalK = typeof getPipeFittingTotalK === 'function'
            ? getPipeFittingTotalK(seg)
            : fittingQuantity * fittingK;
        const additionalK = typeof getPipeAdditionalK === 'function'
            ? getPipeAdditionalK(seg)
            : Math.max(0, toPipeCalcNumber(seg.minorLoss));
        const totalMinorK = fittingTotalK + additionalK;
        const fittingLoss = fittingTotalK * velocityHead;
        const additionalLoss = additionalK * velocityHead;
        const minorLoss = totalMinorK * velocityHead;
        const baseTotalLoss = majorLoss + minorLoss;
        const allowanceLoss = baseTotalLoss * allowanceFraction;
        const sizeSource = typeof getPipeSizeSource === 'function'
            ? getPipeSizeSource(seg)
            : { status: 'User', source: 'User-entered internal diameter' };
        const materialSource = typeof getPipeMaterialSource === 'function'
            ? getPipeMaterialSource(seg)
            : { status: 'Typical', source: 'Typical engineering value' };
        const fittingSource = typeof getPipeFittingSource === 'function'
            ? getPipeFittingSource(seg)
            : { status: 'Typical', source: 'Typical engineering value' };

        details.push({
            index,
            name: seg.name,
            pipeSize: seg.pipeSize,
            material: seg.material,
            length,
            diameter,
            roughness,
            effectiveRoughness,
            roughnessAgingFactor,
            fittingType: seg.fittingType,
            fittingQuantity,
            fittingK,
            fittingTotalK,
            additionalK,
            minorLossK: totalMinorK,
            velocity,
            reynolds,
            flowRegime,
            regimeWarning,
            frictionFactor,
            majorLoss,
            fittingLoss,
            additionalLoss,
            minorLoss,
            baseTotalLoss,
            allowanceFraction,
            allowanceLoss,
            totalLoss: baseTotalLoss + allowanceLoss,
            sizeSource,
            materialSource,
            fittingSource
        });
    });

    return details;
}

function buildPipeMoodyCurve(label, relRoughness, reynoldsStart, reynoldsEnd, pointCount = 64) {
    const points = [];
    const logStart = Math.log10(reynoldsStart);
    const logEnd = Math.log10(reynoldsEnd);
    for (let i = 0; i < pointCount; i++) {
        const fraction = pointCount === 1 ? 0 : i / (pointCount - 1);
        const reynolds = Math.pow(10, logStart + (logEnd - logStart) * fraction);
        const frictionFactor = relRoughness === null
            ? 64 / reynolds
            : calculateTurbulentFrictionFactor(reynolds, relRoughness);
        points.push({
            reynolds: roundPipeTraceNumber(reynolds, 0),
            frictionFactor: roundPipeTraceNumber(frictionFactor, 6)
        });
    }
    return { label, relRoughness, points };
}

function buildPipeMoodyChartData(segmentDetails = []) {
    const markers = (segmentDetails || [])
        .filter(detail => Number.isFinite(detail?.reynolds) && detail.reynolds > 0 && Number.isFinite(detail?.frictionFactor) && detail.frictionFactor > 0)
        .map(detail => {
            const relRoughness = detail.diameter > 0 ? detail.effectiveRoughness / detail.diameter : 0;
            return {
                index: detail.index,
                name: detail.name || `Segment ${detail.index + 1}`,
                reynolds: roundPipeTraceNumber(detail.reynolds, 0),
                frictionFactor: roundPipeTraceNumber(detail.frictionFactor, 6),
                relRoughness: roundPipeTraceNumber(relRoughness, 8),
                flowRegime: detail.flowRegime || getPipeFlowRegime(detail.reynolds),
                diameter: roundPipeTraceNumber(detail.diameter, 6),
                effectiveRoughness: roundPipeTraceNumber(detail.effectiveRoughness, 10)
            };
        });

    return {
        xMin: PIPE_MOODY_RE_MIN,
        xMax: PIPE_MOODY_RE_MAX,
        yMin: PIPE_MOODY_F_MIN,
        yMax: PIPE_MOODY_F_MAX,
        laminarLimit: PIPE_LAMINAR_REYNOLDS_LIMIT,
        turbulentLimit: PIPE_TURBULENT_REYNOLDS_LIMIT,
        laminarCurve: buildPipeMoodyCurve('Laminar f = 64/Re', null, PIPE_MOODY_RE_MIN, PIPE_LAMINAR_REYNOLDS_LIMIT, 28),
        curves: PIPE_MOODY_ROUGHNESS_CURVES.map(relRoughness => buildPipeMoodyCurve(
            relRoughness === 0 ? 'smooth pipe' : `eps/D ${formatPipeTraceNumber(relRoughness, 6)}`,
            relRoughness,
            PIPE_TURBULENT_REYNOLDS_LIMIT,
            PIPE_MOODY_RE_MAX
        )),
        markers,
        isSolved: markers.length > 0,
        note: 'Darcy friction factor chart. Fanning friction factor equals Darcy f / 4.'
    };
}

function calculatePipeHeadLoss(flowRateM3H, pipeProps, fluidPropsOverride = null) {
    return calculatePipeHydraulicSegments(flowRateM3H, pipeProps, fluidPropsOverride)
        .reduce((sum, segment) => sum + segment.totalLoss, 0);
}

function roundPipeTraceNumber(value, digits = 4) {
    const number = parseFloat(value);
    return Number.isFinite(number) ? Number(number.toFixed(digits)) : null;
}

function formatPipeTraceNumber(value, digits = 4) {
    const number = parseFloat(value);
    if (!Number.isFinite(number)) return '-';
    if (Math.abs(number) >= 10000 || (Math.abs(number) > 0 && Math.abs(number) < 0.0001)) {
        return number.toExponential(4);
    }
    return Number(number.toFixed(digits)).toString();
}

function createPipeTraceStep(title, formula, substitution, result, unit = '', reference = '') {
    return {
        title,
        formula,
        substitution,
        result: roundPipeTraceNumber(result, 6),
        unit,
        reference
    };
}

function getPipeTraceFluidProps(fluidPropsOverride = null) {
    const fluid = fluidPropsOverride ? { props: fluidPropsOverride } : globalModel["FLUID"];
    const props = fluid?.props || {};
    return {
        density: toPipeCalcNumber(props.density, 1000),
        viscosityCSt: Math.max(toPipeCalcNumber(props.viscosity, 1), 0.000001),
        vaporPressureBarA: Math.max(toPipeCalcNumber(props.vaporPressure, 0), 0)
    };
}

function buildPipeCalculationTrace(flowRateM3H, pipeProps, pipeResults = {}, fluidPropsOverride = null) {
    normalizePipeProps(pipeProps);
    const flow = Math.max(0, toPipeCalcNumber(flowRateM3H, 0));
    const qM3S = flow / 3600;
    const fluid = getPipeTraceFluidProps(fluidPropsOverride);
    const nuM2S = fluid.viscosityCSt * 1e-6;
    const roughnessAgingFactor = getPipeRoughnessAgingFactor(pipeProps);
    const allowancePercent = Math.max(0, toPipeCalcNumber(pipeProps.headLossAllowancePercent, 0));
    const allowanceFraction = allowancePercent / 100;
    const segmentDetails = calculatePipeHydraulicSegments(flow, pipeProps, fluidPropsOverride);
    const segmentProfiles = new Map((pipeResults?.segmentProfiles || []).map(profile => [profile.index, profile]));

    const totals = segmentDetails.reduce((sum, detail) => {
        sum.majorLoss += detail.majorLoss || 0;
        sum.minorLoss += detail.minorLoss || 0;
        sum.allowanceLoss += detail.allowanceLoss || 0;
        sum.totalLoss += detail.totalLoss || 0;
        sum.totalK += detail.minorLossK || 0;
        return sum;
    }, { majorLoss: 0, minorLoss: 0, allowanceLoss: 0, totalLoss: 0, totalK: 0 });

    const segments = segmentDetails.map(detail => {
        const profile = segmentProfiles.get(detail.index) || {};
        const area = Math.PI * Math.pow(detail.diameter, 2) / 4;
        const relRoughness = detail.diameter > 0 ? detail.effectiveRoughness / detail.diameter : 0;
        const velocityHead = Math.pow(detail.velocity, 2) / (2 * GRAVITY);
        const steps = [
            createPipeTraceStep(
                'Area',
                'A = pi x D^2 / 4',
                `pi x ${formatPipeTraceNumber(detail.diameter)}^2 / 4 = ${formatPipeTraceNumber(area)} m2`,
                area,
                'm2',
                'Circular pipe cross-sectional area'
            ),
            createPipeTraceStep(
                'Velocity',
                'V = Q / A',
                `${formatPipeTraceNumber(qM3S, 6)} / ${formatPipeTraceNumber(area, 6)} = ${formatPipeTraceNumber(detail.velocity)} m/s`,
                detail.velocity,
                'm/s',
                'Average pipe velocity'
            ),
            createPipeTraceStep(
                'Reynolds Number',
                'Re = V x D / nu',
                `${formatPipeTraceNumber(detail.velocity)} x ${formatPipeTraceNumber(detail.diameter)} / ${formatPipeTraceNumber(nuM2S, 8)} = ${formatPipeTraceNumber(detail.reynolds, 0)}`,
                detail.reynolds,
                '',
                'Pipe flow regime basis'
            ),
            createPipeTraceStep(
                'Effective Roughness',
                'eps_eff = eps x aging factor',
                `${formatPipeTraceNumber(detail.roughness, 8)} x ${formatPipeTraceNumber(roughnessAgingFactor)} = ${formatPipeTraceNumber(detail.effectiveRoughness, 8)} m`,
                detail.effectiveRoughness,
                'm',
                'Aging/degradation screening'
            ),
            createPipeTraceStep(
                'Relative Roughness',
                'eps_eff / D',
                `${formatPipeTraceNumber(detail.effectiveRoughness, 8)} / ${formatPipeTraceNumber(detail.diameter)} = ${formatPipeTraceNumber(relRoughness, 6)}`,
                relRoughness,
                '',
                'Moody/Colebrook roughness input'
            ),
            createPipeTraceStep(
                'Velocity Head',
                'hv = V^2 / (2g)',
                `${formatPipeTraceNumber(detail.velocity)}^2 / (2 x ${formatPipeTraceNumber(GRAVITY)}) = ${formatPipeTraceNumber(velocityHead)} m`,
                velocityHead,
                'm',
                'Dynamic head term'
            ),
            createPipeTraceStep(
                'Major Loss',
                'h_major = f x (L / D) x hv',
                `${formatPipeTraceNumber(detail.frictionFactor, 6)} x (${formatPipeTraceNumber(detail.length)} / ${formatPipeTraceNumber(detail.diameter)}) x ${formatPipeTraceNumber(velocityHead)} = ${formatPipeTraceNumber(detail.majorLoss)} m`,
                detail.majorLoss,
                'm',
                'Darcy-Weisbach pipe friction'
            ),
            createPipeTraceStep(
                'Minor Loss',
                'h_minor = K_total x hv',
                `${formatPipeTraceNumber(detail.minorLossK)} x ${formatPipeTraceNumber(velocityHead)} = ${formatPipeTraceNumber(detail.minorLoss)} m`,
                detail.minorLoss,
                'm',
                'Fitting and additional K loss'
            ),
            createPipeTraceStep(
                'Allowance Loss',
                'h_allow = (h_major + h_minor) x allowance',
                `(${formatPipeTraceNumber(detail.majorLoss)} + ${formatPipeTraceNumber(detail.minorLoss)}) x ${formatPipeTraceNumber(allowanceFraction, 4)} = ${formatPipeTraceNumber(detail.allowanceLoss)} m`,
                detail.allowanceLoss,
                'm',
                'Fouling/design allowance'
            ),
            createPipeTraceStep(
                'Segment Total Loss',
                'h_total = h_major + h_minor + h_allow',
                `${formatPipeTraceNumber(detail.majorLoss)} + ${formatPipeTraceNumber(detail.minorLoss)} + ${formatPipeTraceNumber(detail.allowanceLoss)} = ${formatPipeTraceNumber(detail.totalLoss)} m`,
                detail.totalLoss,
                'm',
                'Segment loss contribution'
            )
        ];

        const pressureSteps = [];
        if (Number.isFinite(profile.startPressure)) {
            pressureSteps.push(createPipeTraceStep(
                'Segment Inlet Pressure',
                'P_in = rho x g x (H_in - z_in - hv) / 100000',
                `${formatPipeTraceNumber(profile.startPressure)} bar a`,
                profile.startPressure,
                'bar a',
                'Static pressure from hydraulic head'
            ));
        }
        if (Number.isFinite(profile.endPressure)) {
            pressureSteps.push(createPipeTraceStep(
                'Segment Outlet Pressure',
                'P_out = rho x g x (H_out - z_out - hv) / 100000',
                `${formatPipeTraceNumber(profile.endPressure)} bar a`,
                profile.endPressure,
                'bar a',
                'Static pressure after segment loss'
            ));
        }
        if (Number.isFinite(profile.highPointPressure)) {
            pressureSteps.push(createPipeTraceStep(
                'High Point Vapor Margin',
                'Margin = P_high_point - P_vapor',
                `${formatPipeTraceNumber(profile.highPointPressure)} - ${formatPipeTraceNumber(fluid.vaporPressureBarA)} = ${formatPipeTraceNumber(profile.highPointVaporMargin)} bar`,
                profile.highPointVaporMargin,
                'bar',
                'High point cavitation screening'
            ));
        }

        return {
            index: detail.index,
            name: detail.name || `Segment ${detail.index + 1}`,
            flowRegime: detail.flowRegime,
            warning: detail.regimeWarning,
            dataSources: {
                size: detail.sizeSource,
                material: detail.materialSource,
                fitting: detail.fittingSource
            },
            profile,
            steps,
            pressureSteps
        };
    });

    const warnings = [
        ...(pipeResults?.warnings || []),
        ...segments.map(segment => segment.warning).filter(Boolean)
    ];
    const dependencyChain = [
        'Solved hydraulic flow from the connected solid pipe path -> Q in m3/s for each pipe segment.',
        'Pipe internal diameter -> cross-sectional area -> velocity -> velocity head.',
        'Active Fluid Basis kinematic viscosity -> Reynolds number -> laminar/transitional/turbulent regime -> Darcy friction factor.',
        'Pipe material roughness x aging factor -> effective roughness -> relative roughness -> Moody/Colebrook turbulent friction factor.',
        'Segment length + diameter + Darcy friction factor + velocity head -> major pipe friction loss.',
        'Fitting selection + quantity + additional K -> total minor-loss coefficient -> fitting/minor head loss.',
        'Head loss allowance percent -> extra design/fouling loss added to major + minor loss.',
        'Segment totals -> total pipe head loss used by the hydraulic network solver.',
        'Elevation profile/high point + Fluid Basis vapor pressure -> high point vapor-pressure margin warning.',
        'When this pipe is in the pump suction path, total pipe/fitting loss subtracts directly from NPSHA.'
    ];

    return {
        isSolved: flow > 0 && segmentDetails.length > 0,
        message: flow > 0 && segmentDetails.length > 0
            ? 'Pipe calculation trace is based on the current solved hydraulic flow.'
            : 'Pipe calculation trace needs solved pipe flow. Connect the pipe in a hydraulic path and run the simulation.',
        basis: {
            flowM3H: roundPipeTraceNumber(flow, 6),
            flowM3S: roundPipeTraceNumber(qM3S, 8),
            density: roundPipeTraceNumber(fluid.density, 4),
            viscosityCSt: roundPipeTraceNumber(fluid.viscosityCSt, 6),
            kinematicViscosityM2S: roundPipeTraceNumber(nuM2S, 10),
            vaporPressureBarA: roundPipeTraceNumber(fluid.vaporPressureBarA, 6),
            roughnessAgingFactor: roundPipeTraceNumber(roughnessAgingFactor, 4),
            headLossAllowancePercent: roundPipeTraceNumber(allowancePercent, 4),
            elevationProfileMode: pipeProps.elevationProfileMode || 'End Elevations'
        },
        totals: {
            majorLoss: roundPipeTraceNumber(totals.majorLoss, 6),
            minorLoss: roundPipeTraceNumber(totals.minorLoss, 6),
            allowanceLoss: roundPipeTraceNumber(totals.allowanceLoss, 6),
            totalLoss: roundPipeTraceNumber(totals.totalLoss, 6),
            totalK: roundPipeTraceNumber(totals.totalK, 6),
            controllingHighPointSegment: pipeResults?.highPointSegment || '',
            highPointPressure: pipeResults?.highPointPressure ?? null,
            highPointVaporMargin: pipeResults?.highPointVaporMargin ?? null
        },
        moody: buildPipeMoodyChartData(segmentDetails),
        segments,
        dependencyChain,
        warnings: [...new Set(warnings)],
        references: [
            'pdf_ref/ref1-fluid-mechanics-fundaments-and-applications.pdf: internal pipe flow, Reynolds number, Darcy-Weisbach loss, Moody/Colebrook friction, and minor-loss coefficients.',
            'pdf_ref/ref2-introduction-fluid-mechanics.pdf: steady-flow energy equation, pipe friction, and head-loss terms.',
            'pdf_ref/ref4-standar_ANSI-9-6-2024_rotodynamic_pump_guidline_for_NPSH_margin-hydraulic-institute.pdf: suction line losses and NPSHA margin context.',
            'NASA Glenn Bernoulli equation: static pressure plus dynamic pressure/head interpretation for steady inviscid reference.',
            'NIST SI Guide: pressure unit pascal and coherent SI unit conversions used for pressure/head checks.'
        ],
        notes: [
            'Friction factor shown is Darcy f, not Fanning f.',
            'Fluid viscosity basis is kinematic viscosity in cSt.',
            'Pipe size, roughness, and fitting K defaults are reference/typical engineering values unless marked User or Estimate.'
        ]
    };
}
