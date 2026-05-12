const TANK_API650_PRESSURE_REVIEW_MBAR = 170;
const TANK_LOW_PRESSURE_REVIEW_MBAR = 1034;

function calculateTankLiquidVolume(diameter, liquidLevel) {
    return (Math.PI / 4) * Math.pow(Math.max(0, diameter || 0), 2) * Math.max(0, liquidLevel || 0);
}

function calculateTankTotalCapacity(diameter, tankHeight) {
    return (Math.PI / 4) * Math.pow(Math.max(0, diameter || 0), 2) * Math.max(0, tankHeight || 0);
}

function calculateTankFillPercent(liquidLevel, tankHeight) {
    const height = toTankNumber(tankHeight, 0);
    if (height <= 0) return 0;
    return Math.max(0, (toTankNumber(liquidLevel, 0) / height) * 100);
}

function toTankNumber(value, fallback = 0) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function getTankCodeBasisDefault() {
    return typeof TANK_CODE_BASIS_API_650 !== 'undefined'
        ? TANK_CODE_BASIS_API_650
        : 'API 650 Atmospheric Tank';
}

function getTankEmergencyVentDefault() {
    return typeof TANK_EMERGENCY_VENT_NOT_SPECIFIED !== 'undefined'
        ? TANK_EMERGENCY_VENT_NOT_SPECIFIED
        : 'Not specified';
}

function isTankFieldBlank(value) {
    return value === undefined || value === null || value === '';
}

function getTankCodeBasisReferencePreset(codeBasis, currentProps = {}) {
    const api650 = typeof TANK_CODE_BASIS_API_650 !== 'undefined' ? TANK_CODE_BASIS_API_650 : 'API 650 Atmospheric Tank';
    const api620 = typeof TANK_CODE_BASIS_API_620 !== 'undefined' ? TANK_CODE_BASIS_API_620 : 'API 620 Low-pressure Storage Tank';
    const baseElevation = Number.isFinite(parseFloat(currentProps.elevation))
        ? toTankNumber(currentProps.elevation, 6)
        : 6;
    const commonGeometry = {
        elevation: baseElevation,
        diameter: 5,
        tankHeight: 6,
        liquidLevel: 3,
        hll: 5,
        nll: 3,
        lll: 1.5,
        tLevelElev: baseElevation + 3,
        inletNozzleElevation: baseElevation + 3,
        outletNozzleElevation: baseElevation + 1
    };

    if (codeBasis === api620) {
        return {
            ...commonGeometry,
            tankCodeBasis: api620,
            pressureInputBasis: typeof PRESSURE_INPUT_BASIS_GAUGE !== 'undefined' ? PRESSURE_INPUT_BASIS_GAUGE : 'Gauge',
            pressure: 0.05,
            tankDesignPressure: 500,
            designVacuum: 25,
            pressureVentSet: 450,
            vacuumVentSet: 20,
            emergencyVentProvided: typeof TANK_EMERGENCY_VENT_PROVIDED !== 'undefined' ? TANK_EMERGENCY_VENT_PROVIDED : 'Provided'
        };
    }

    if (codeBasis === api650) {
        return {
            ...commonGeometry,
            tankCodeBasis: api650,
            pressureInputBasis: typeof PRESSURE_INPUT_BASIS_GAUGE !== 'undefined' ? PRESSURE_INPUT_BASIS_GAUGE : 'Gauge',
            pressure: 0,
            tankDesignPressure: 25,
            designVacuum: 5,
            pressureVentSet: 20,
            vacuumVentSet: 3,
            emergencyVentProvided: typeof TANK_EMERGENCY_VENT_PROVIDED !== 'undefined' ? TANK_EMERGENCY_VENT_PROVIDED : 'Provided'
        };
    }

    return null;
}

function applyTankCodeBasisReferencePreset(tankOrProps, codeBasis) {
    const props = tankOrProps?.props || tankOrProps || {};
    const selectedCodeBasis = codeBasis || props.tankCodeBasis || getTankCodeBasisDefault();
    const preset = getTankCodeBasisReferencePreset(selectedCodeBasis, props);
    if (!preset) {
        props.tankCodeBasis = selectedCodeBasis;
        return normalizeTankProps(props);
    }

    Object.assign(props, preset);
    props._tankReferencePresetApplied = selectedCodeBasis;
    return normalizeTankProps(props);
}

function refreshTankInventoryCalculations(props = {}) {
    const diameter = toTankNumber(props.diameter, 0);
    const liquidLevel = toTankNumber(props.liquidLevel, 0);
    const tankHeight = toTankNumber(props.tankHeight, 0);
    const liquidVolume = calculateTankLiquidVolume(diameter, liquidLevel);
    const totalCapacity = calculateTankTotalCapacity(diameter, tankHeight);
    const fillPercent = calculateTankFillPercent(liquidLevel, tankHeight);

    props.liquidVolume = Number(liquidVolume.toFixed(3));
    props.totalCapacity = Number(totalCapacity.toFixed(3));
    props.fillPercent = Number(fillPercent.toFixed(3));
    props.volume = props.liquidVolume;

    return props;
}

function normalizeTankProps(tankOrProps) {
    const props = tankOrProps?.props || tankOrProps || {};

    if (!props.tankCodeBasis) props.tankCodeBasis = getTankCodeBasisDefault();
    if (!props.pressureInputBasis) {
        props.pressureInputBasis = typeof PRESSURE_INPUT_BASIS_GAUGE !== 'undefined'
            ? PRESSURE_INPUT_BASIS_GAUGE
            : 'Gauge';
    }

    if (isTankFieldBlank(props.pressure)) props.pressure = 0;
    if (isTankFieldBlank(props.diameter)) props.diameter = 5;
    if (isTankFieldBlank(props.tankHeight)) {
        const fallbackHeight = Math.max(
            toTankNumber(props.hll, 0),
            toTankNumber(props.liquidLevel, 0),
            6
        );
        props.tankHeight = fallbackHeight;
    }
    if (isTankFieldBlank(props.liquidLevel)) props.liquidLevel = 0;
    if (isTankFieldBlank(props.hll)) props.hll = Math.max(toTankNumber(props.tankHeight, 0) * 0.83, 0);
    if (isTankFieldBlank(props.nll)) props.nll = Math.max(toTankNumber(props.tankHeight, 0) * 0.5, 0);
    if (isTankFieldBlank(props.lll)) props.lll = Math.max(toTankNumber(props.tankHeight, 0) * 0.25, 0);
    if (isTankFieldBlank(props.tLevelElev)) props.tLevelElev = toTankNumber(props.elevation, 0) + toTankNumber(props.nll, 0);
    if (isTankFieldBlank(props.elevation)) props.elevation = 0;
    if (isTankFieldBlank(props.inletNozzleElevation)) props.inletNozzleElevation = toTankNumber(props.elevation, 0) + toTankNumber(props.nll, 0);
    if (isTankFieldBlank(props.outletNozzleElevation)) props.outletNozzleElevation = toTankNumber(props.elevation, 0);

    const baseElevation = toTankNumber(props.elevation, 0);
    const tankHeight = toTankNumber(props.tankHeight, 0);
    ['inletNozzleElevation', 'outletNozzleElevation', 'tLevelElev'].forEach(key => {
        const value = toTankNumber(props[key], NaN);
        if (baseElevation > 0 && tankHeight > 0 && Number.isFinite(value) && value >= 0 && value <= tankHeight && value < baseElevation) {
            props[key] = Number((baseElevation + value).toFixed(3));
            props._legacyTankElevationFieldMigrated = true;
        }
    });

    if (isTankFieldBlank(props.tankDesignPressure)) {
        if (!isTankFieldBlank(props.designPressure)) {
            props.tankDesignPressure = Number((toTankNumber(props.designPressure, 0) * 1000).toFixed(3));
            props._legacyTankPressureFieldMigrated = true;
        } else {
            props.tankDesignPressure = 0;
        }
    }

    if (isTankFieldBlank(props.pressureVentSet)) {
        if (!isTankFieldBlank(props.psvSet)) {
            props.pressureVentSet = Number((toTankNumber(props.psvSet, 0) * 1000).toFixed(3));
            props._legacyTankPressureFieldMigrated = true;
        } else {
            props.pressureVentSet = 0;
        }
    }

    if (!isTankFieldBlank(props.volume) && isTankFieldBlank(props.liquidVolume)) {
        props._legacyTankVolumeFieldMigrated = true;
    }

    if (isTankFieldBlank(props.designVacuum)) props.designVacuum = 0;
    if (isTankFieldBlank(props.vacuumVentSet)) props.vacuumVentSet = 0;
    if (!props.emergencyVentProvided) props.emergencyVentProvided = getTankEmergencyVentDefault();
    if (isTankFieldBlank(props.vaporPressure)) props.vaporPressure = 0;

    refreshTankInventoryCalculations(props);

    return props;
}

function formatTankPressureStatusValue(value, unit = 'mbar g') {
    const number = toTankNumber(value, NaN);
    if (!Number.isFinite(number) || number <= 0) return 'Not specified';
    return `${formatReadoutValue(Number(number.toFixed(3)))} ${unit}`;
}

function roundTankTraceNumber(value, digits = 3) {
    const number = toTankNumber(value, NaN);
    return Number.isFinite(number) ? Number(number.toFixed(digits)) : null;
}

function formatTankTraceNumber(value, digits = 3) {
    const number = toTankNumber(value, NaN);
    return Number.isFinite(number) ? number.toFixed(digits) : '-';
}

function getTankTraceUniqueItems(items = []) {
    return [...new Set((items || []).filter(Boolean))];
}

function getTankTraceSourceFeedTotal(sourceFeedFlows = []) {
    return (sourceFeedFlows || []).reduce((sum, row) => {
        const flow = toTankNumber(row?.flow, NaN);
        return Number.isFinite(flow) ? sum + flow : sum;
    }, 0);
}

function getTankTopElevation(props = {}) {
    return toTankNumber(props.elevation, 0) + toTankNumber(props.tankHeight, 0);
}

function evaluateTankGeometrySafety(props = {}) {
    normalizeTankProps(props);
    const warnings = [];
    const diameter = toTankNumber(props.diameter, 0);
    const tankHeight = toTankNumber(props.tankHeight, 0);
    const liquidLevel = toTankNumber(props.liquidLevel, 0);
    const hll = toTankNumber(props.hll, NaN);
    const nll = toTankNumber(props.nll, NaN);
    const lll = toTankNumber(props.lll, NaN);
    const baseElevation = toTankNumber(props.elevation, 0);
    const topElevation = getTankTopElevation(props);
    const liquidSurfaceElevation = baseElevation + liquidLevel;
    const inletNozzleElevation = toTankNumber(props.inletNozzleElevation, NaN);
    const outletNozzleElevation = toTankNumber(props.outletNozzleElevation, NaN);
    const transmitterElevation = toTankNumber(props.tLevelElev, NaN);

    if (diameter <= 0) warnings.push('Tank diameter must be greater than zero.');
    if (tankHeight <= 0) warnings.push('Tank height must be greater than zero.');
    if (liquidLevel < 0) warnings.push('Current liquid level cannot be negative.');

    if (Number.isFinite(hll) && Number.isFinite(nll) && Number.isFinite(lll) && !(hll > nll && nll > lll)) {
        warnings.push('Tank level limits should follow HLL > NLL > LLL.');
    }
    if (Number.isFinite(hll) && liquidLevel > hll) {
        warnings.push('Current liquid level is above HLL.');
    }
    if (Number.isFinite(lll) && liquidLevel < lll) {
        warnings.push('Current liquid level is below LLL.');
    }
    if (tankHeight > 0 && liquidLevel > tankHeight) {
        warnings.push('Current liquid level is above tank height.');
    }
    if (tankHeight > 0 && Number.isFinite(hll) && hll > tankHeight) {
        warnings.push('HLL is above tank height.');
    }
    if (tankHeight > 0 && Number.isFinite(nll) && nll > tankHeight) {
        warnings.push('NLL is above tank height.');
    }
    if (tankHeight > 0 && Number.isFinite(lll) && lll > tankHeight) {
        warnings.push('LLL is above tank height.');
    }

    [
        { label: 'Inlet nozzle elevation', value: inletNozzleElevation },
        { label: 'Outlet nozzle elevation', value: outletNozzleElevation },
        { label: 'Transmitter elevation', value: transmitterElevation }
    ].forEach(item => {
        if (!Number.isFinite(item.value)) return;
        if (tankHeight > 0 && (item.value < baseElevation || item.value > topElevation)) {
            warnings.push(`${item.label} is outside the tank base-to-top elevation range.`);
        }
    });

    if (
        tankHeight > 0
        && Number.isFinite(outletNozzleElevation)
        && Number.isFinite(liquidSurfaceElevation)
        && outletNozzleElevation > liquidSurfaceElevation
    ) {
        warnings.push('Outlet nozzle elevation is above current liquid level; pump suction may draw vapor/gas and NPSH is not valid.');
    }

    return {
        status: warnings.length ? 'Review' : 'OK',
        warnings,
        liquidVolume: props.liquidVolume,
        totalCapacity: props.totalCapacity,
        fillPercent: props.fillPercent
    };
}

function evaluateTankPressureSafety(props = {}, fluidProps = {}) {
    normalizeTankProps(props);
    const operatingPressure = typeof pressureInputToAbsoluteBar === 'function'
        ? pressureInputToAbsoluteBar(props.pressure, props.pressureInputBasis)
        : toTankNumber(props.pressure);
    const operatingGaugePressure = typeof pressureInputToGaugeBar === 'function'
        ? pressureInputToGaugeBar(props.pressure, props.pressureInputBasis)
        : toTankNumber(props.pressure);
    const operatingGaugePressureMbar = operatingGaugePressure * 1000;
    const operatingVacuumMbar = Number.isFinite(operatingGaugePressureMbar) && operatingGaugePressureMbar < 0
        ? Math.abs(operatingGaugePressureMbar)
        : 0;
    const tankDesignPressure = toTankNumber(props.tankDesignPressure);
    const designVacuum = toTankNumber(props.designVacuum);
    const pressureVentSet = toTankNumber(props.pressureVentSet);
    const vacuumVentSet = toTankNumber(props.vacuumVentSet);
    const vaporPressure = toTankNumber(fluidProps.vaporPressure ?? props.vaporPressure);
    const codeBasis = props.tankCodeBasis || getTankCodeBasisDefault();
    const emergencyVent = props.emergencyVentProvided || getTankEmergencyVentDefault();
    const geometrySafety = evaluateTankGeometrySafety(props);
    const warnings = [...geometrySafety.warnings];

    if (
        typeof PRESSURE_INPUT_BASIS_ABSOLUTE !== 'undefined'
        && props.pressureInputBasis === PRESSURE_INPUT_BASIS_ABSOLUTE
        && operatingPressure <= 0
    ) {
        warnings.push('Operating vapor space pressure is 0 bar a/vacuum absolute; use 0 bar g for atmospheric tanks.');
    } else if (vaporPressure > 0 && operatingPressure <= vaporPressure) {
        warnings.push('Operating pressure is at or below fluid vapor pressure; vaporizing risk at tank conditions.');
    }

    if (tankDesignPressure <= 0) {
        warnings.push('Tank design pressure is not specified; review API 650/API 620 design basis.');
    }
    if (designVacuum <= 0) {
        warnings.push('Design vacuum is not specified; review vacuum collapse/inbreathing basis.');
    }
    if (pressureVentSet <= 0) {
        warnings.push('Pressure vent set is not specified.');
    } else {
        if (tankDesignPressure > 0 && pressureVentSet > tankDesignPressure) {
            warnings.push('Pressure vent set is above tank design pressure.');
        }
        if (Number.isFinite(operatingGaugePressureMbar) && operatingGaugePressureMbar > 0 && pressureVentSet <= operatingGaugePressureMbar) {
            warnings.push('Pressure vent set should be above normal operating vapor space pressure.');
        }
    }
    if (vacuumVentSet <= 0) {
        warnings.push('Vacuum vent set is not specified.');
    } else {
        if (designVacuum > 0 && vacuumVentSet > designVacuum) {
            warnings.push('Vacuum vent set is above design vacuum magnitude.');
        }
        if (operatingVacuumMbar > 0 && vacuumVentSet <= operatingVacuumMbar) {
            warnings.push('Vacuum vent set should be above normal operating vacuum magnitude.');
        }
    }

    if (tankDesignPressure > 0 && Number.isFinite(operatingGaugePressureMbar) && operatingGaugePressureMbar > tankDesignPressure) {
        warnings.push('Operating vapor space pressure is above tank design pressure.');
    }
    if (designVacuum > 0 && operatingVacuumMbar > designVacuum) {
        warnings.push('Operating vapor space vacuum is above design vacuum magnitude.');
    }

    if (codeBasis === (typeof TANK_CODE_BASIS_API_650 !== 'undefined' ? TANK_CODE_BASIS_API_650 : 'API 650 Atmospheric Tank')
        && tankDesignPressure > TANK_API650_PRESSURE_REVIEW_MBAR) {
        warnings.push('Tank design pressure may be outside common API 650 atmospheric/very-low-pressure practice; review code basis.');
    }
    if (codeBasis === (typeof TANK_CODE_BASIS_API_620 !== 'undefined' ? TANK_CODE_BASIS_API_620 : 'API 620 Low-pressure Storage Tank')
        && tankDesignPressure > TANK_LOW_PRESSURE_REVIEW_MBAR) {
        warnings.push('Tank design pressure may exceed low-pressure storage tank practice; review whether a pressure vessel object/code is required.');
    }

    if (emergencyVent === getTankEmergencyVentDefault()) {
        warnings.push('Emergency vent basis is not specified; API 2000 sizing is not evaluated in this model.');
    } else if (emergencyVent === (typeof TANK_EMERGENCY_VENT_NOT_PROVIDED !== 'undefined' ? TANK_EMERGENCY_VENT_NOT_PROVIDED : 'Not provided')) {
        warnings.push('Emergency vent is marked not provided; review fire/emergency venting basis.');
    }

    if (props._legacyTankPressureFieldMigrated) {
        warnings.push('Legacy MAWP/PSV fields were migrated to tank design pressure/pressure vent set; review storage tank basis.');
    }
    if (props._legacyTankVolumeFieldMigrated) {
        warnings.push('Legacy Total Volume field is now treated as calculated liquid volume; review tank height/capacity.');
    }
    if (props._legacyTankElevationFieldMigrated) {
        warnings.push('Legacy tank nozzle/transmitter elevations were converted from tank-relative offsets to absolute elevations; review elevation basis.');
    }
    return {
        status: warnings.length ? 'Review' : 'OK',
        warnings,
        tankDesignPressure,
        designVacuum,
        pressureVentSet,
        vacuumVentSet,
        operatingGaugePressureMbar: Number.isFinite(operatingGaugePressureMbar) ? operatingGaugePressureMbar : null,
        ventingBasis: 'Storage tank venting basis; API 2000 sizing not evaluated',
        geometryStatus: geometrySafety.status,
        liquidVolume: geometrySafety.liquidVolume,
        totalCapacity: geometrySafety.totalCapacity,
        fillPercent: geometrySafety.fillPercent,
        suggestedPressure: null,
        suggestedBasis: 'Not applicable for storage tank venting'
    };
}

function buildTankCalculationTrace(tankOrProps = {}, fluidProps = {}, resultsOverride = null) {
    const node = tankOrProps?.props ? tankOrProps : null;
    const props = { ...(node?.props || tankOrProps || {}) };
    normalizeTankProps(props);

    const results = resultsOverride || node?.results || {};
    const safety = evaluateTankPressureSafety({ ...props }, fluidProps || {});
    const pressureBasis = props.pressureInputBasis || getTankCodeBasisDefault();
    const atm = typeof ATM_PRESSURE_BAR === 'number' ? ATM_PRESSURE_BAR : 1.01325;
    const operatingPressureAbsolute = typeof pressureInputToAbsoluteBar === 'function'
        ? pressureInputToAbsoluteBar(props.pressure, props.pressureInputBasis)
        : (pressureBasis === 'Gauge' ? toTankNumber(props.pressure, 0) + atm : toTankNumber(props.pressure, 0));
    const operatingPressureGauge = typeof pressureInputToGaugeBar === 'function'
        ? pressureInputToGaugeBar(props.pressure, props.pressureInputBasis)
        : (pressureBasis === 'Gauge' ? toTankNumber(props.pressure, 0) : toTankNumber(props.pressure, 0) - atm);
    const operatingGaugePressureMbar = operatingPressureGauge * 1000;
    const operatingVacuumMbar = operatingGaugePressureMbar < 0 ? Math.abs(operatingGaugePressureMbar) : 0;

    const diameter = toTankNumber(props.diameter, 0);
    const tankHeight = toTankNumber(props.tankHeight, 0);
    const liquidLevel = toTankNumber(props.liquidLevel, 0);
    const baseElevation = toTankNumber(props.elevation, 0);
    const tankArea = (Math.PI / 4) * Math.pow(Math.max(0, diameter), 2);
    const totalCapacity = calculateTankTotalCapacity(diameter, tankHeight);
    const liquidVolume = calculateTankLiquidVolume(diameter, liquidLevel);
    const fillPercent = calculateTankFillPercent(liquidLevel, tankHeight);
    const topElevation = baseElevation + tankHeight;
    const liquidSurfaceElevation = baseElevation + liquidLevel;
    const outletNozzleElevation = toTankNumber(props.outletNozzleElevation, NaN);
    const inletNozzleElevation = toTankNumber(props.inletNozzleElevation, NaN);
    const transmitterElevation = toTankNumber(props.tLevelElev, NaN);
    const outletSubmergence = Number.isFinite(outletNozzleElevation)
        ? liquidSurfaceElevation - outletNozzleElevation
        : null;

    const sourceFeedFlows = Array.isArray(results.sourceFeedFlows) ? results.sourceFeedFlows : [];
    const sourceFeedTotalFromRows = getTankTraceSourceFeedTotal(sourceFeedFlows);
    const resultSourceFeedFlow = toTankNumber(results.sourceFeedFlow, NaN);
    const sourceFeedFlow = Number.isFinite(resultSourceFeedFlow) ? resultSourceFeedFlow : sourceFeedTotalFromRows;
    const resultInletFlow = toTankNumber(results.inletFlow, NaN);
    const resultOutletFlow = toTankNumber(results.outletFlow, NaN);
    const pipeInletFlow = Number.isFinite(resultInletFlow)
        ? Math.max(resultInletFlow - sourceFeedFlow, 0)
        : 0;
    const inletFlow = Number.isFinite(resultInletFlow)
        ? resultInletFlow
        : pipeInletFlow + sourceFeedFlow;
    const outletFlow = Number.isFinite(resultOutletFlow) ? resultOutletFlow : 0;
    const resultNetFlow = toTankNumber(results.netFlow, NaN);
    const netFlow = Number.isFinite(resultNetFlow) ? resultNetFlow : inletFlow - outletFlow;
    const flowTolerance = Math.max(0.01, Math.max(Math.abs(inletFlow), Math.abs(outletFlow)) * 0.02);
    const levelTrend = results.levelTrend || (Math.abs(netFlow) <= flowTolerance ? 'Balanced' : (netFlow > 0 ? 'Rising' : 'Falling'));

    const tankDesignPressure = toTankNumber(props.tankDesignPressure, 0);
    const designVacuum = toTankNumber(props.designVacuum, 0);
    const pressureVentSet = toTankNumber(props.pressureVentSet, 0);
    const vacuumVentSet = toTankNumber(props.vacuumVentSet, 0);
    const pressureVentMargin = pressureVentSet - Math.max(operatingGaugePressureMbar, 0);
    const vacuumVentMargin = vacuumVentSet - operatingVacuumMbar;
    const vaporPressure = toTankNumber(fluidProps?.vaporPressure ?? props.vaporPressure, NaN);

    const pressureFormula = props.pressureInputBasis === (typeof PRESSURE_INPUT_BASIS_GAUGE !== 'undefined' ? PRESSURE_INPUT_BASIS_GAUGE : 'Gauge')
        ? 'Pabs = Pgauge + Patm'
        : 'Pabs = Pabs input';
    const pressureSubstitution = props.pressureInputBasis === (typeof PRESSURE_INPUT_BASIS_GAUGE !== 'undefined' ? PRESSURE_INPUT_BASIS_GAUGE : 'Gauge')
        ? `${formatTankTraceNumber(props.pressure)} + ${formatTankTraceNumber(atm)} = ${formatTankTraceNumber(operatingPressureAbsolute)} bar a`
        : `${formatTankTraceNumber(props.pressure)} = ${formatTankTraceNumber(operatingPressureAbsolute)} bar a`;

    const steps = [
        {
            title: 'Tank Cross-sectional Area',
            reference: 'Vertical cylindrical tank geometry',
            formula: 'A = pi / 4 x D^2',
            substitution: `pi / 4 x ${formatTankTraceNumber(diameter)}^2 = ${formatTankTraceNumber(tankArea)} m2`,
            result: roundTankTraceNumber(tankArea, 3),
            unit: 'm2'
        },
        {
            title: 'Total Capacity',
            reference: 'Vertical cylindrical tank geometry',
            formula: 'Vtotal = A x H',
            substitution: `${formatTankTraceNumber(tankArea)} x ${formatTankTraceNumber(tankHeight)} = ${formatTankTraceNumber(totalCapacity)} m3`,
            result: roundTankTraceNumber(totalCapacity, 3),
            unit: 'm3'
        },
        {
            title: 'Liquid Volume',
            reference: 'Inventory volume at current liquid level',
            formula: 'Vliquid = A x L',
            substitution: `${formatTankTraceNumber(tankArea)} x ${formatTankTraceNumber(liquidLevel)} = ${formatTankTraceNumber(liquidVolume)} m3`,
            result: roundTankTraceNumber(liquidVolume, 3),
            unit: 'm3'
        },
        {
            title: 'Fill Percentage',
            reference: 'Inventory fraction of shell height',
            formula: 'Fill % = L / H x 100',
            substitution: `${formatTankTraceNumber(liquidLevel)} / ${formatTankTraceNumber(tankHeight)} x 100 = ${formatTankTraceNumber(fillPercent)} %`,
            result: roundTankTraceNumber(fillPercent, 3),
            unit: '%'
        },
        {
            title: 'Liquid Surface Elevation',
            reference: 'Hydraulic boundary elevation for tank/reservoir suction',
            formula: 'z_liquid = z_base + L',
            substitution: `${formatTankTraceNumber(baseElevation)} + ${formatTankTraceNumber(liquidLevel)} = ${formatTankTraceNumber(liquidSurfaceElevation)} m`,
            result: roundTankTraceNumber(liquidSurfaceElevation, 3),
            unit: 'm'
        },
        {
            title: 'Outlet Nozzle Submergence',
            reference: 'Outlet nozzle must be below current liquid surface for liquid suction',
            formula: 'Submergence = z_liquid - z_outlet_nozzle',
            substitution: `${formatTankTraceNumber(liquidSurfaceElevation)} - ${formatTankTraceNumber(outletNozzleElevation)} = ${formatTankTraceNumber(outletSubmergence)} m`,
            result: roundTankTraceNumber(outletSubmergence, 3),
            unit: 'm'
        },
        {
            title: 'Total SRC Feed Flow',
            reference: 'Sum of dashed SRC feed attachments to this tank',
            formula: 'Qsrc,total = sum(Qsrc,i)',
            substitution: (sourceFeedFlows.length
                ? sourceFeedFlows.map(row => `${row.sourceId || 'SRC'} ${formatTankTraceNumber(row.flow)} m3/h`).join(' + ')
                : 'No attached SRC feed flows') + ` = ${formatTankTraceNumber(sourceFeedFlow)} m3/h`,
            result: roundTankTraceNumber(sourceFeedFlow, 3),
            unit: 'm3/h'
        },
        {
            title: 'Tank Inlet Flow',
            reference: 'Steady inventory balance readout',
            formula: 'Qin = Qpipe,in + Qsrc,total',
            substitution: `${formatTankTraceNumber(pipeInletFlow)} + ${formatTankTraceNumber(sourceFeedFlow)} = ${formatTankTraceNumber(inletFlow)} m3/h`,
            result: roundTankTraceNumber(inletFlow, 3),
            unit: 'm3/h'
        },
        {
            title: 'Tank Net Flow',
            reference: 'Steady inventory balance readout',
            formula: 'Qnet = Qin - Qout',
            substitution: `${formatTankTraceNumber(inletFlow)} - ${formatTankTraceNumber(outletFlow)} = ${formatTankTraceNumber(netFlow)} m3/h`,
            result: roundTankTraceNumber(netFlow, 3),
            unit: 'm3/h'
        },
        {
            title: 'Operating Absolute Pressure',
            reference: 'Pressure basis conversion for tank vapor space',
            formula: pressureFormula,
            substitution: pressureSubstitution,
            result: roundTankTraceNumber(operatingPressureAbsolute, 3),
            unit: 'bar a'
        },
        {
            title: 'Operating Gauge Pressure',
            reference: 'Storage tank pressure review basis',
            formula: 'Pgauge,mbar = Pgauge,bar x 1000',
            substitution: `${formatTankTraceNumber(operatingPressureGauge)} x 1000 = ${formatTankTraceNumber(operatingGaugePressureMbar)} mbar g`,
            result: roundTankTraceNumber(operatingGaugePressureMbar, 3),
            unit: 'mbar g'
        },
        {
            title: 'Operating Vacuum Magnitude',
            reference: 'Vacuum collapse / inbreathing review basis',
            formula: 'Pvaccum = abs(min(Pgauge,mbar, 0))',
            substitution: `abs(min(${formatTankTraceNumber(operatingGaugePressureMbar)}, 0)) = ${formatTankTraceNumber(operatingVacuumMbar)} mbar vacuum`,
            result: roundTankTraceNumber(operatingVacuumMbar, 3),
            unit: 'mbar vacuum'
        },
        {
            title: 'Pressure Vent Margin',
            reference: 'Normal pressure vent should open below tank design pressure and above normal operating pressure',
            formula: 'Margin = Pvent,set - max(Pgauge,mbar, 0)',
            substitution: `${formatTankTraceNumber(pressureVentSet)} - ${formatTankTraceNumber(Math.max(operatingGaugePressureMbar, 0))} = ${formatTankTraceNumber(pressureVentMargin)} mbar`,
            result: roundTankTraceNumber(pressureVentMargin, 3),
            unit: 'mbar'
        },
        {
            title: 'Vacuum Vent Margin',
            reference: 'Vacuum vent should open before exceeding design vacuum magnitude',
            formula: 'Margin = Pvaccum,set - Pvaccum,operating',
            substitution: `${formatTankTraceNumber(vacuumVentSet)} - ${formatTankTraceNumber(operatingVacuumMbar)} = ${formatTankTraceNumber(vacuumVentMargin)} mbar`,
            result: roundTankTraceNumber(vacuumVentMargin, 3),
            unit: 'mbar'
        }
    ];

    const warnings = getTankTraceUniqueItems([
        ...(safety.warnings || []),
        ...((results.warnings || []).filter(Boolean))
    ]);
    const traceStatus = (safety.warnings || []).length
        ? 'Needs Review'
        : (results.status && results.status !== '-' ? results.status : 'OK');

    return {
        status: traceStatus,
        inputBasis: {
            tankId: node?.id || node?.name || '-',
            codeBasis: props.tankCodeBasis || getTankCodeBasisDefault(),
            pressureInputBasis: props.pressureInputBasis || 'Gauge',
            pressureInput: roundTankTraceNumber(props.pressure, 3),
            pressureInputUnit: props.pressureInputBasis === 'Absolute' ? 'bar a' : 'bar g',
            emergencyVent: props.emergencyVentProvided || getTankEmergencyVentDefault(),
            modelBasis: 'Storage tank hydraulic/inventory boundary; not an ASME pressure vessel model'
        },
        geometry: {
            diameter: roundTankTraceNumber(diameter, 3),
            tankHeight: roundTankTraceNumber(tankHeight, 3),
            crossSectionArea: roundTankTraceNumber(tankArea, 3),
            baseElevation: roundTankTraceNumber(baseElevation, 3),
            topElevation: roundTankTraceNumber(topElevation, 3),
            liquidLevel: roundTankTraceNumber(liquidLevel, 3),
            liquidSurfaceElevation: roundTankTraceNumber(liquidSurfaceElevation, 3),
            inletNozzleElevation: roundTankTraceNumber(inletNozzleElevation, 3),
            outletNozzleElevation: roundTankTraceNumber(outletNozzleElevation, 3),
            outletSubmergence: roundTankTraceNumber(outletSubmergence, 3),
            transmitterElevation: roundTankTraceNumber(transmitterElevation, 3)
        },
        inventory: {
            liquidVolume: roundTankTraceNumber(liquidVolume, 3),
            totalCapacity: roundTankTraceNumber(totalCapacity, 3),
            fillPercent: roundTankTraceNumber(fillPercent, 3)
        },
        flowBalance: {
            connectedPipes: results.connectedPipes || [],
            connectedSources: results.connectedSources || [],
            sourceFeedFlows,
            sourceFeedFlow: roundTankTraceNumber(sourceFeedFlow, 3),
            pipeInletFlow: roundTankTraceNumber(pipeInletFlow, 3),
            inletFlow: roundTankTraceNumber(inletFlow, 3),
            outletFlow: roundTankTraceNumber(outletFlow, 3),
            netFlow: roundTankTraceNumber(netFlow, 3),
            levelTrend
        },
        pressureVenting: {
            operatingPressureAbsolute: roundTankTraceNumber(operatingPressureAbsolute, 3),
            operatingPressureGauge: roundTankTraceNumber(operatingPressureGauge, 3),
            operatingGaugePressureMbar: roundTankTraceNumber(operatingGaugePressureMbar, 3),
            operatingVacuumMbar: roundTankTraceNumber(operatingVacuumMbar, 3),
            vaporPressure: roundTankTraceNumber(vaporPressure, 6),
            tankDesignPressure: roundTankTraceNumber(tankDesignPressure, 3),
            designVacuum: roundTankTraceNumber(designVacuum, 3),
            pressureVentSet: roundTankTraceNumber(pressureVentSet, 3),
            vacuumVentSet: roundTankTraceNumber(vacuumVentSet, 3),
            pressureVentMargin: roundTankTraceNumber(pressureVentMargin, 3),
            vacuumVentMargin: roundTankTraceNumber(vacuumVentMargin, 3),
            ventingBasis: safety.ventingBasis
        },
        steps,
        warnings,
        assumptions: [
            'Tank geometry is simplified as a vertical cylindrical shell with flat-bottom volume; strapping tables, roof volume, bottom slope, and dead stock are not modeled.',
            'Liquid level, HLL, NLL, and LLL are heights above tank base; nozzle and transmitter elevations are absolute datum elevations.',
            'Net flow and level trend are steady readouts. The model does not integrate liquid level dynamically over time.',
            'Tank pressure and vent fields are storage tank review parameters, not pressure vessel MAWP/PSV sizing parameters.',
            'API 2000 venting capacity sizing is not calculated; this trace only reviews pressure/vacuum set point consistency.'
        ],
        references: [
            'API 650 - Welded Tanks for Oil Storage; atmospheric/very-low-pressure storage tank basis.',
            'API 620 - Design and Construction of Large, Welded, Low-pressure Storage Tanks.',
            'API 2000 - Venting Atmospheric and Low-pressure Storage Tanks; normal/emergency venting basis.',
            'Vertical cylindrical tank volume: V = pi/4 x D^2 x liquid height.',
            'Steady inventory balance: Qnet = Qin - Qout.'
        ]
    };
}
