function recalcExtendedFluidProps(fluidNode) {
    const rho = fluidNode.props.density;
    if (rho > 0) {
        fluidNode.props.specVolume = 1 / rho;
        fluidNode.props.specWeight = rho * GRAVITY;
        const K_Pa = (fluidNode.props.bulkModulus || 2.2) * 1e9;
        fluidNode.props.speedOfSound = Math.sqrt(K_Pa / rho);
    }
}

const FLUID_TRACE_WATER_REF_DENSITY = 999.972;

function toFluidTraceNumber(value, fallback = NaN) {
    const number = parseFloat(value);
    return Number.isFinite(number) ? number : fallback;
}

function roundFluidTraceNumber(value, digits = 3) {
    const number = toFluidTraceNumber(value, NaN);
    return Number.isFinite(number) ? Number(number.toFixed(digits)) : null;
}

function formatFluidTraceNumber(value, digits = 3) {
    const number = toFluidTraceNumber(value, NaN);
    return Number.isFinite(number) ? number.toFixed(digits) : '-';
}

function getFluidTraceGravity() {
    return typeof GRAVITY === 'number' ? GRAVITY : 9.81;
}

function getFluidTraceMethod(fluidName, props) {
    if (props?.propertyMethod) return props.propertyMethod;
    if (fluidName === 'Water') return 'IAPWS-style water correlation';
    if (fluidName === 'Methanol') return 'NIST liquid table / Antoine vapor pressure';
    if (fluidName === 'Palm Oil') return 'Palm oil liquid table interpolation';
    if (fluidName === 'Crude Oil') return 'API/ASTM empirical estimate';
    return 'User input / SI derived properties';
}

function getFluidTraceSourceProfile(fluidName, inputMode) {
    if (fluidName === 'Water') {
        return {
            primary: 'Correlation',
            density: 'IAPWS-style liquid density correlation',
            dynamicViscosity: 'IAPWS-style viscosity correlation',
            kinematicViscosity: 'Derived from dynamic viscosity and density',
            vaporPressure: 'IAPWS vapor pressure correlation',
            thermal: 'Correlation',
            note: 'Water properties are correlation based at the selected bulk temperature.'
        };
    }
    if (fluidName === 'Methanol') {
        return {
            primary: 'Table interpolation / correlation',
            density: 'NIST liquid table interpolation',
            dynamicViscosity: 'NIST liquid table interpolation',
            kinematicViscosity: 'Derived from dynamic viscosity and density',
            vaporPressure: 'Antoine vapor pressure correlation',
            thermal: 'NIST liquid table interpolation',
            note: 'Methanol liquid properties are limited to the liquid table range and near-boiling vapor pressure correlation.'
        };
    }
    if (fluidName === 'Palm Oil') {
        return {
            primary: 'Table interpolation / estimate',
            density: 'Palm oil liquid table interpolation',
            dynamicViscosity: 'Palm oil liquid table interpolation',
            kinematicViscosity: 'Palm oil liquid table interpolation',
            vaporPressure: 'Reference default estimate',
            thermal: 'Palm oil liquid table interpolation',
            note: 'Palm oil properties are composition dependent; validate final thesis cases against lab or literature data.'
        };
    }
    if (fluidName === 'Crude Oil') {
        return {
            primary: 'Empirical estimate',
            density: 'API MPMS 11.1-style density estimate',
            dynamicViscosity: 'ASTM D341 viscosity-temperature estimate',
            kinematicViscosity: 'ASTM D341 viscosity-temperature estimate',
            vaporPressure: 'RVP-based empirical vapor pressure estimate',
            thermal: 'Crude oil empirical estimate',
            note: 'Crude oil properties depend on assay/composition; use measured data when available.'
        };
    }

    const source = inputMode === 'Advanced' ? 'User Input / Derived' : 'User Input';
    return {
        primary: source,
        density: 'User input',
        dynamicViscosity: inputMode === 'Advanced' ? 'User input' : 'Not directly used in Basic mode',
        kinematicViscosity: inputMode === 'Advanced' ? 'Derived from dynamic viscosity and density' : 'User input',
        vaporPressure: 'User input',
        thermal: inputMode === 'Advanced' ? 'User input' : 'Not configured in Basic mode',
        note: 'Custom fluid data quality depends on user input and should be validated.'
    };
}

function getFluidTraceTemperatureRange(fluidName) {
    if (fluidName === 'Water') return { min: -20, max: 110, label: 'Water liquid correlation clamp' };
    if (fluidName === 'Methanol') return { min: -90, max: 64.482, label: 'Methanol liquid table range' };
    if (fluidName === 'Palm Oil') return { min: 25, max: 300, label: 'Palm oil table range' };
    if (fluidName === 'Crude Oil') return { min: -50, max: 200, label: 'Crude empirical estimate guardrail' };
    return null;
}

function addFluidTraceWarning(warnings, condition, message) {
    if (condition) warnings.push(message);
}

function buildFluidPropertySourceMap(props, sourceProfile, values) {
    return [
        { property: 'Density', value: values.density, unit: 'kg/m3', source: sourceProfile.density },
        { property: 'Dynamic viscosity', value: values.dynamicViscosity, unit: 'cP', source: sourceProfile.dynamicViscosity },
        { property: 'Kinematic viscosity', value: values.kinematicViscosity, unit: 'cSt', source: sourceProfile.kinematicViscosity },
        { property: 'Vapor pressure', value: values.vaporPressure, unit: 'bar a', source: sourceProfile.vaporPressure },
        { property: 'Specific gravity', value: values.specificGravity, unit: '', source: 'Derived from density' },
        { property: 'Specific volume', value: values.specificVolume, unit: 'm3/kg', source: 'Derived from density' },
        { property: 'Specific weight', value: values.specificWeight, unit: 'N/m3', source: 'Derived from density and gravity' },
        { property: 'Vapor pressure head', value: values.vaporPressureHead, unit: 'm', source: 'Derived for NPSH screening' },
        { property: 'Speed of sound', value: values.speedOfSound, unit: 'm/s', source: props?.bulkModulus ? 'Derived from bulk modulus and density' : sourceProfile.thermal }
    ];
}

function buildFluidCalculationTrace(fluidNode) {
    const props = fluidNode?.props || {};
    const fluidName = props.fluidName || 'Custom';
    const inputMode = props.inputMode || 'Basic';
    const tempC = toFluidTraceNumber(props.temp, 25);
    const density = toFluidTraceNumber(props.density, NaN);
    const dynamicViscosity = toFluidTraceNumber(props.dynViscosity, NaN);
    const kinematicViscosity = toFluidTraceNumber(props.viscosity, NaN);
    const vaporPressureBarA = toFluidTraceNumber(props.vaporPressure, NaN);
    const bulkModulusGpa = toFluidTraceNumber(props.bulkModulus, NaN);
    const gravity = getFluidTraceGravity();
    const densityRef = FLUID_TRACE_WATER_REF_DENSITY;
    const sourceProfile = getFluidTraceSourceProfile(fluidName, inputMode);
    const method = getFluidTraceMethod(fluidName, props);
    const specificGravity = Number.isFinite(density) ? density / densityRef : NaN;
    const kinematicFromDynamic = Number.isFinite(dynamicViscosity) && Number.isFinite(density) && density > 0
        ? dynamicViscosity / (density / 1000)
        : NaN;
    const specificVolume = Number.isFinite(density) && density > 0 ? 1 / density : NaN;
    const specificWeight = Number.isFinite(density) ? density * gravity : NaN;
    const vaporPressureHead = Number.isFinite(vaporPressureBarA) && Number.isFinite(density) && density > 0
        ? vaporPressureBarA * 100000 / (density * gravity)
        : NaN;
    const speedOfSound = Number.isFinite(bulkModulusGpa) && Number.isFinite(density) && density > 0
        ? Math.sqrt(bulkModulusGpa * 1e9 / density)
        : toFluidTraceNumber(props.speedOfSound, NaN);
    const warnings = [];
    const tempRange = getFluidTraceTemperatureRange(fluidName);

    addFluidTraceWarning(warnings, !Number.isFinite(density) || density <= 0, 'Density must be greater than zero.');
    addFluidTraceWarning(warnings, !Number.isFinite(kinematicViscosity) || kinematicViscosity <= 0, 'Kinematic viscosity must be greater than zero.');
    addFluidTraceWarning(warnings, Number.isFinite(dynamicViscosity) && dynamicViscosity <= 0, 'Dynamic viscosity must be greater than zero when provided.');
    addFluidTraceWarning(warnings, !Number.isFinite(vaporPressureBarA) || vaporPressureBarA < 0, 'Vapor pressure must be zero or positive.');
    if (tempRange) {
        addFluidTraceWarning(
            warnings,
            tempC < tempRange.min || tempC > tempRange.max,
            `${fluidName} temperature is outside the ${tempRange.label} (${tempRange.min} to ${tempRange.max} deg C); verify extrapolated properties.`
        );
    }
    addFluidTraceWarning(warnings, fluidName === 'Palm Oil', 'Palm oil properties vary by composition and processing route; validate against the selected sample/literature.');
    addFluidTraceWarning(warnings, fluidName === 'Crude Oil', 'Crude oil properties are empirical estimates from API/viscosity/RVP inputs; assay data is preferred.');
    addFluidTraceWarning(warnings, fluidName === 'Custom' && inputMode === 'Basic', 'Custom Basic mode relies on user-entered density, kinematic viscosity, and vapor pressure.');
    addFluidTraceWarning(warnings, fluidName === 'Custom' && inputMode === 'Advanced', 'Custom Advanced mode relies on user-entered primary properties; verify all input units.');

    const values = {
        density: roundFluidTraceNumber(density, 3),
        dynamicViscosity: roundFluidTraceNumber(dynamicViscosity, 6),
        kinematicViscosity: roundFluidTraceNumber(kinematicViscosity, 6),
        vaporPressure: roundFluidTraceNumber(vaporPressureBarA, 6),
        specificGravity: roundFluidTraceNumber(specificGravity, 6),
        specificVolume: roundFluidTraceNumber(specificVolume, 9),
        specificWeight: roundFluidTraceNumber(specificWeight, 3),
        vaporPressureHead: roundFluidTraceNumber(vaporPressureHead, 3),
        speedOfSound: roundFluidTraceNumber(speedOfSound, 3)
    };

    const steps = [
        {
            title: 'Specific Gravity',
            source: 'Derived',
            formula: 'SG = rho / rho_ref',
            substitution: `${formatFluidTraceNumber(density)} / ${formatFluidTraceNumber(densityRef)} = ${formatFluidTraceNumber(specificGravity, 6)}`,
            result: values.specificGravity,
            unit: '',
            reference: 'Derived from SI density relationship'
        },
        {
            title: 'Kinematic Viscosity',
            source: sourceProfile.kinematicViscosity,
            formula: 'nu(cSt) = mu(cP) / (rho / 1000)',
            substitution: Number.isFinite(kinematicFromDynamic)
                ? `${formatFluidTraceNumber(dynamicViscosity, 6)} / (${formatFluidTraceNumber(density)} / 1000) = ${formatFluidTraceNumber(kinematicFromDynamic, 6)} cSt`
                : `Reported value = ${formatFluidTraceNumber(kinematicViscosity, 6)} cSt`,
            result: roundFluidTraceNumber(Number.isFinite(kinematicFromDynamic) ? kinematicFromDynamic : kinematicViscosity, 6),
            unit: 'cSt',
            reference: 'Dynamic-to-kinematic viscosity conversion'
        },
        {
            title: 'Specific Weight',
            source: 'Derived',
            formula: 'gamma = rho x g',
            substitution: `${formatFluidTraceNumber(density)} x ${formatFluidTraceNumber(gravity)} = ${formatFluidTraceNumber(specificWeight)} N/m3`,
            result: values.specificWeight,
            unit: 'N/m3',
            reference: 'Specific weight definition'
        },
        {
            title: 'Specific Volume',
            source: 'Derived',
            formula: 'v = 1 / rho',
            substitution: `1 / ${formatFluidTraceNumber(density)} = ${formatFluidTraceNumber(specificVolume, 9)} m3/kg`,
            result: values.specificVolume,
            unit: 'm3/kg',
            reference: 'Specific volume definition'
        },
        {
            title: 'Vapor Pressure Head',
            source: 'NPSH relevance',
            formula: 'Hv = Pv x 100000 / (rho x g)',
            substitution: `${formatFluidTraceNumber(vaporPressureBarA, 6)} x 100000 / (${formatFluidTraceNumber(density)} x ${formatFluidTraceNumber(gravity)}) = ${formatFluidTraceNumber(vaporPressureHead)} m`,
            result: values.vaporPressureHead,
            unit: 'm',
            reference: 'NPSH available vapor pressure term'
        },
        {
            title: 'Speed of Sound',
            source: 'Derived',
            formula: 'a = sqrt(K / rho)',
            substitution: Number.isFinite(bulkModulusGpa)
                ? `sqrt(${formatFluidTraceNumber(bulkModulusGpa)}e9 / ${formatFluidTraceNumber(density)}) = ${formatFluidTraceNumber(speedOfSound)} m/s`
                : `Reported value = ${formatFluidTraceNumber(speedOfSound)} m/s`,
            result: values.speedOfSound,
            unit: 'm/s',
            reference: 'Bulk modulus relation'
        }
    ];

    return {
        status: warnings.length ? 'Needs Review' : 'OK',
        inputBasis: {
            fluidName,
            inputMode,
            temperature: roundFluidTraceNumber(tempC, 3),
            propertyMethod: method
        },
        propertySourceMap: buildFluidPropertySourceMap(props, sourceProfile, values),
        dependencyChain: [
            'Temperature -> density, viscosity, vapor pressure for automatic fluids',
            'Density -> specific gravity, specific volume, specific weight',
            'Dynamic viscosity + density -> kinematic viscosity',
            'Vapor pressure + density -> vapor pressure head for NPSHa',
            'Bulk modulus + density -> speed of sound'
        ],
        steps,
        npshRelevance: [
            'Density converts pressure into pressure head and affects Reynolds number.',
            'Vapor pressure is subtracted in NPSHa through Hv = Pv / (rho x g).',
            'Viscosity affects Reynolds number, friction factor, pipe loss, and therefore suction losses.',
            'Bulk fluid temperature is the basis for the current property set.'
        ],
        references: [
            method,
            'Derived from SI unit relationships',
            'Bernoulli/NPSH pressure-head conversion',
            'Darcy-Weisbach Reynolds/friction dependency through viscosity'
        ],
        assumptions: [
            'Fluid properties are evaluated at the selected bulk fluid temperature.',
            'Hydraulic calculations treat the liquid as single-phase and incompressible for screening.',
            'Vapor pressure is used for NPSH screening; detailed flashing/two-phase behavior is not modeled.'
        ],
        academicNotes: [
            sourceProfile.note,
            'For thesis validation, compare final fluid properties with literature, lab, or manufacturer data where available.'
        ],
        warnings
    };
}
