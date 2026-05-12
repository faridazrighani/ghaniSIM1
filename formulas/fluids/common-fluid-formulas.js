function recalcExtendedFluidProps(fluidNode) {
    const rho = fluidNode.props.density;
    const vaporPressureBarA = toFluidTraceNumber(fluidNode.props.vaporPressure, NaN);
    const gravity = getFluidTraceGravity();
    if (rho > 0) {
        fluidNode.props.specVolume = 1 / rho;
        fluidNode.props.specWeight = rho * gravity;
        fluidNode.props.vaporPressureHead = Number.isFinite(vaporPressureBarA) && vaporPressureBarA >= 0
            ? vaporPressureBarA * 100000 / (rho * gravity)
            : null;
        const K_Pa = (fluidNode.props.bulkModulus || 2.2) * 1e9;
        fluidNode.props.speedOfSound = Math.sqrt(K_Pa / rho);
    } else {
        fluidNode.props.specVolume = null;
        fluidNode.props.specWeight = null;
        fluidNode.props.vaporPressureHead = null;
        fluidNode.props.speedOfSound = null;
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
    if (fluidName === 'Water') return 'IAPWS-based water property correlation';
    if (fluidName === 'Methanol') return 'NIST liquid table / Antoine vapor pressure';
    if (fluidName === 'Palm Oil') return 'Palm oil liquid table interpolation';
    if (fluidName === 'Crude Oil') return 'API/ASTM empirical estimate';
    return 'User input / SI derived properties';
}

function getFluidTraceSourceProfile(fluidName, inputMode) {
    if (fluidName === 'Water') {
        return {
            primary: 'Correlation',
            density: 'IAPWS-based liquid density correlation',
            dynamicViscosity: 'IAPWS-based liquid viscosity correlation',
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
            primary: 'Literature table interpolation / engineering estimate',
            density: 'Palm oil liquid table interpolation',
            dynamicViscosity: 'Palm oil liquid table interpolation',
            kinematicViscosity: 'Derived from dynamic viscosity and density',
            vaporPressure: 'Engineering default estimate pending validation',
            thermal: 'Palm oil liquid table interpolation',
            note: 'Palm oil properties are composition dependent; validate final academic engineering cases against laboratory or literature data.'
        };
    }
    if (fluidName === 'Crude Oil') {
        return {
            primary: 'API/ASTM-based empirical estimate',
            density: 'API MPMS 11.1-style density estimate',
            dynamicViscosity: 'ASTM D341 viscosity-temperature estimate',
            kinematicViscosity: 'ASTM D341 viscosity-temperature estimate',
            vaporPressure: 'RVP-based empirical vapor pressure estimate',
            thermal: 'Crude oil empirical engineering estimate',
            note: 'Crude oil properties depend on assay/composition; use measured data when available.'
        };
    }

    const source = inputMode === 'Advanced' ? 'User Input / Derived' : 'User Input';
    return {
        primary: source,
        density: 'User input',
        dynamicViscosity: inputMode === 'Advanced' ? 'User input' : 'Derived from kinematic viscosity and density',
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

function getFluidAuditProfile(fluidName, inputMode) {
    const derivedReference = 'Derived formula audit: pdf_ref/ref1-fluid-mechanics-fundaments-and-applications.pdf; pressure/head and NPSHA audit: pdf_ref/ref4-standar_ANSI-9-6-2024_rotodynamic_pump_guidline_for_NPSH_margin-hydraulic-institute.pdf';
    const nistReference = 'NIST Chemistry WebBook SRD 69 fluid data, checked at 298.15 K and 0.101325 MPa';

    if (fluidName === 'Water') {
        return {
            primaryReference: `${nistReference}; IAPWS water formulations referenced by NIST`,
            primaryStatus: 'Verified',
            vaporReference: `${nistReference}; vapor pressure relation cross-checked with HI Appendix A water vapor pressure equation`,
            vaporStatus: 'Verified',
            thermalReference: nistReference,
            thermalStatus: 'Verified',
            bulkReference: 'Derived from density and speed of sound; NIST Chemistry WebBook SRD 69 speed of sound checked at 298.15 K',
            bulkStatus: 'Formula verified',
            derivedReference
        };
    }

    if (fluidName === 'Methanol') {
        return {
            primaryReference: `${nistReference}; local methanol table matches NIST liquid values at 298.15 K`,
            primaryStatus: 'Verified',
            vaporReference: 'Antoine vapor pressure correlation; NIST saturation trend checked around 298.15 K',
            vaporStatus: 'Reference-based estimate',
            thermalReference: nistReference,
            thermalStatus: 'Verified',
            bulkReference: 'Derived from NIST liquid density and speed of sound table values',
            bulkStatus: 'Formula verified',
            derivedReference
        };
    }

    if (fluidName === 'Palm Oil') {
        return {
            primaryReference: 'No palm oil source document was found in pdf_ref; table values remain application engineering data',
            primaryStatus: 'Needs verification',
            vaporReference: 'Default low vapor pressure estimate; no palm oil vapor pressure reference found in pdf_ref',
            vaporStatus: 'Needs verification',
            thermalReference: 'No palm oil source document was found in pdf_ref',
            thermalStatus: 'Needs verification',
            bulkReference: 'Default bulk modulus estimate; no palm oil bulk modulus reference found in pdf_ref',
            bulkStatus: 'Needs verification',
            derivedReference
        };
    }

    if (fluidName === 'Crude Oil') {
        return {
            primaryReference: 'API MPMS 11.1 / ASTM D341 method labels are used in code, but the standards were not present in pdf_ref',
            primaryStatus: 'Needs verification',
            vaporReference: 'RVP-based empirical estimate; source standard not present in pdf_ref',
            vaporStatus: 'Engineering estimate',
            thermalReference: 'Empirical crude oil estimate; source standard not present in pdf_ref',
            thermalStatus: 'Engineering estimate',
            bulkReference: 'Derived from empirical speed of sound estimate and density',
            bulkStatus: 'Engineering estimate',
            derivedReference
        };
    }

    const customStatus = inputMode === 'Advanced' ? 'User input' : 'User input / basic basis';
    return {
        primaryReference: 'User-entered fluid property; verify against lab data, vendor data, NIST, or literature for final cases',
        primaryStatus: 'Needs verification',
        vaporReference: 'User-entered vapor pressure; verify absolute pressure basis before NPSH use',
        vaporStatus: 'Needs verification',
        thermalReference: customStatus,
        thermalStatus: 'Needs verification',
        bulkReference: 'User-entered bulk modulus if supplied',
        bulkStatus: 'Needs verification',
        derivedReference
    };
}

function addFluidTraceWarning(warnings, condition, message) {
    if (condition) warnings.push(message);
}

function buildFluidPropertySourceMap(props, sourceProfile, values, auditProfile) {
    return [
        {
            property: 'Density',
            value: values.density,
            unit: 'kg/m3',
            source: sourceProfile.density,
            method: sourceProfile.density,
            formula: 'Primary input or fluid correlation',
            reference: auditProfile.primaryReference,
            status: auditProfile.primaryStatus
        },
        {
            property: 'Dynamic viscosity',
            value: values.dynamicViscosity,
            unit: 'cP',
            source: sourceProfile.dynamicViscosity,
            method: sourceProfile.dynamicViscosity,
            formula: 'Primary input, fluid correlation, or mu = nu x rho / 1000',
            reference: auditProfile.primaryReference,
            status: auditProfile.primaryStatus
        },
        {
            property: 'Kinematic viscosity',
            value: values.kinematicViscosity,
            unit: 'cSt',
            source: sourceProfile.kinematicViscosity,
            method: sourceProfile.kinematicViscosity,
            formula: 'nu(cSt) = mu(cP) / (rho / 1000)',
            reference: auditProfile.derivedReference,
            status: 'Formula verified'
        },
        {
            property: 'Vapor pressure',
            value: values.vaporPressure,
            unit: 'bar a',
            source: sourceProfile.vaporPressure,
            method: sourceProfile.vaporPressure,
            formula: 'Absolute saturation or estimated vapor pressure at fluid temperature',
            reference: auditProfile.vaporReference,
            status: auditProfile.vaporStatus
        },
        {
            property: 'Specific gravity',
            value: values.specificGravity,
            unit: '-',
            source: 'Derived from density',
            method: 'rho / rho_ref',
            formula: `SG = rho / ${FLUID_TRACE_WATER_REF_DENSITY} kg/m3`,
            reference: auditProfile.derivedReference,
            status: 'Formula verified'
        },
        {
            property: 'Specific volume',
            value: values.specificVolume,
            unit: 'm3/kg',
            source: 'Derived from density',
            method: '1 / rho',
            formula: 'v = 1 / rho',
            reference: auditProfile.derivedReference,
            status: 'Formula verified'
        },
        {
            property: 'Specific weight',
            value: values.specificWeight,
            unit: 'N/m3',
            source: 'Derived from density and gravity',
            method: 'rho x g',
            formula: `gamma = rho x ${formatFluidTraceNumber(getFluidTraceGravity())} m/s2`,
            reference: auditProfile.derivedReference,
            status: 'Formula verified'
        },
        {
            property: 'Vapor pressure head',
            value: values.vaporPressureHead,
            unit: 'm',
            source: 'Derived for NPSH screening',
            method: 'Pv / (rho x g)',
            formula: 'Hv = Pv(bar a) x 100000 / (rho x g)',
            reference: auditProfile.derivedReference,
            status: 'Formula verified'
        },
        {
            property: 'Specific heat',
            value: values.specificHeat,
            unit: 'kJ/kg.K',
            source: sourceProfile.thermal,
            method: sourceProfile.thermal,
            formula: 'Primary input, table, or fluid correlation',
            reference: auditProfile.thermalReference,
            status: auditProfile.thermalStatus
        },
        {
            property: 'Bulk modulus',
            value: values.bulkModulus,
            unit: 'GPa',
            source: props?.bulkModulus ? 'Fluid correlation, estimate, or user input' : sourceProfile.thermal,
            method: 'K = rho x a^2 where speed of sound is available',
            formula: 'K(GPa) = rho x a^2 / 1e9',
            reference: auditProfile.bulkReference,
            status: auditProfile.bulkStatus
        },
        {
            property: 'Speed of sound',
            value: values.speedOfSound,
            unit: 'm/s',
            source: props?.bulkModulus ? 'Derived from bulk modulus and density' : sourceProfile.thermal,
            method: 'sqrt(K / rho)',
            formula: 'a = sqrt(K(Pa) / rho)',
            reference: auditProfile.bulkReference,
            status: auditProfile.bulkStatus === 'Needs verification' ? 'Needs verification' : 'Formula verified'
        }
    ];
}

function buildFluidCalculationTrace(fluidNode) {
    const props = fluidNode?.props || {};
    const fluidName = props.fluidName || 'Custom';
    const inputMode = props.inputMode || 'Basic';
    const tempC = toFluidTraceNumber(props.temp, 25);
    const tempK = tempC + 273.15;
    const density = toFluidTraceNumber(props.density, NaN);
    const dynamicViscosityInput = toFluidTraceNumber(props.dynViscosity, NaN);
    const kinematicViscosityInput = toFluidTraceNumber(props.viscosity, NaN);
    const vaporPressureBarA = toFluidTraceNumber(props.vaporPressure, NaN);
    const specificHeat = toFluidTraceNumber(props.specificHeat, NaN);
    const bulkModulusGpa = toFluidTraceNumber(props.bulkModulus, NaN);
    const gravity = getFluidTraceGravity();
    const densityRef = FLUID_TRACE_WATER_REF_DENSITY;
    const sourceProfile = getFluidTraceSourceProfile(fluidName, inputMode);
    const auditProfile = getFluidAuditProfile(fluidName, inputMode);
    const method = getFluidTraceMethod(fluidName, props);
    const specificGravity = Number.isFinite(density) ? density / densityRef : NaN;
    const dynamicFromKinematic = Number.isFinite(kinematicViscosityInput) && Number.isFinite(density) && density > 0
        ? kinematicViscosityInput * (density / 1000)
        : NaN;
    const isCustomBasic = fluidName === 'Custom' && inputMode === 'Basic';
    const dynamicViscosity = isCustomBasic && Number.isFinite(dynamicFromKinematic)
        ? dynamicFromKinematic
        : dynamicViscosityInput;
    const kinematicFromDynamic = Number.isFinite(dynamicViscosity) && Number.isFinite(density) && density > 0
        ? dynamicViscosity / (density / 1000)
        : NaN;
    const kinematicViscosity = isCustomBasic
        ? kinematicViscosityInput
        : (Number.isFinite(kinematicFromDynamic) ? kinematicFromDynamic : kinematicViscosityInput);
    const specificVolume = Number.isFinite(density) && density > 0 ? 1 / density : NaN;
    const specificWeight = Number.isFinite(density) ? density * gravity : NaN;
    const vaporPressureHead = Number.isFinite(vaporPressureBarA) && Number.isFinite(density) && density > 0
        ? vaporPressureBarA * 100000 / (density * gravity)
        : NaN;
    const speedOfSound = Number.isFinite(bulkModulusGpa) && Number.isFinite(density) && density > 0
        ? Math.sqrt(bulkModulusGpa * 1e9 / density)
        : toFluidTraceNumber(props.speedOfSound, NaN);
    if (fluidNode?.props) {
        fluidNode.props.sg = Number.isFinite(specificGravity) ? specificGravity : fluidNode.props.sg;
        fluidNode.props.dynViscosity = Number.isFinite(dynamicViscosity) ? dynamicViscosity : fluidNode.props.dynViscosity;
        fluidNode.props.viscosity = Number.isFinite(kinematicViscosity) ? kinematicViscosity : fluidNode.props.viscosity;
        fluidNode.props.specVolume = Number.isFinite(specificVolume) ? specificVolume : fluidNode.props.specVolume;
        fluidNode.props.specWeight = Number.isFinite(specificWeight) ? specificWeight : fluidNode.props.specWeight;
        fluidNode.props.vaporPressureHead = Number.isFinite(vaporPressureHead) ? vaporPressureHead : null;
        fluidNode.props.speedOfSound = Number.isFinite(speedOfSound) ? speedOfSound : fluidNode.props.speedOfSound;
    }
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
        specificHeat: roundFluidTraceNumber(specificHeat, 3),
        bulkModulus: roundFluidTraceNumber(bulkModulusGpa, 6),
        speedOfSound: roundFluidTraceNumber(speedOfSound, 3)
    };

    const steps = [
        {
            title: 'Temperature Basis',
            source: 'Input basis',
            formula: 'T(K) = T(deg C) + 273.15 when a correlation requires absolute temperature',
            substitution: `${formatFluidTraceNumber(tempC)} + 273.15 = ${formatFluidTraceNumber(tempK)} K`,
            result: tempC,
            unit: 'deg C',
            digits: 3,
            reference: 'Formula verified: temperature conversion for SI thermophysical correlations'
        },
        {
            title: 'Density',
            source: sourceProfile.density,
            formula: 'rho = fluid correlation, table interpolation, or user input at the selected temperature',
            substitution: `${sourceProfile.density}; T = ${formatFluidTraceNumber(tempC)} deg C`,
            result: density,
            unit: 'kg/m3',
            digits: 3,
            reference: auditProfile.primaryReference
        },
        {
            title: 'Dynamic Viscosity',
            source: sourceProfile.dynamicViscosity,
            formula: isCustomBasic ? 'mu(cP) = nu(cSt) x (rho / 1000)' : 'mu = fluid correlation, table interpolation, or user input',
            substitution: isCustomBasic && Number.isFinite(dynamicFromKinematic)
                ? `${formatFluidTraceNumber(kinematicViscosityInput, 6)} x (${formatFluidTraceNumber(density)} / 1000) = ${formatFluidTraceNumber(dynamicViscosity, 6)} cP`
                : `${sourceProfile.dynamicViscosity}; T = ${formatFluidTraceNumber(tempC)} deg C`,
            result: dynamicViscosity,
            unit: 'cP',
            digits: 3,
            reference: isCustomBasic ? auditProfile.derivedReference : auditProfile.primaryReference
        },
        {
            title: 'Vapor Pressure',
            source: sourceProfile.vaporPressure,
            formula: 'Pv = absolute vapor pressure from fluid correlation, estimate, or user input',
            substitution: `${sourceProfile.vaporPressure}; T = ${formatFluidTraceNumber(tempC)} deg C`,
            result: vaporPressureBarA,
            unit: 'bar a',
            digits: 6,
            reference: auditProfile.vaporReference
        },
        {
            title: 'Specific Heat',
            source: sourceProfile.thermal,
            formula: 'cp = fluid correlation, table interpolation, estimate, or user input',
            substitution: `${sourceProfile.thermal}; T = ${formatFluidTraceNumber(tempC)} deg C`,
            result: specificHeat,
            unit: 'kJ/kg.K',
            digits: 3,
            reference: auditProfile.thermalReference
        },
        {
            title: 'Bulk Modulus',
            source: 'Fluid basis property',
            formula: 'K(Pa) = K(GPa) x 1e9 for hydraulic reference calculations',
            substitution: `${formatFluidTraceNumber(bulkModulusGpa, 6)} GPa x 1e9 = ${formatFluidTraceNumber(bulkModulusGpa * 1e9, 3)} Pa`,
            result: bulkModulusGpa,
            unit: 'GPa',
            digits: 3,
            reference: auditProfile.bulkReference
        },
        {
            title: 'Specific Gravity',
            source: 'Derived',
            formula: 'SG = rho / rho_ref',
            substitution: `${formatFluidTraceNumber(density)} / ${formatFluidTraceNumber(densityRef)} = ${formatFluidTraceNumber(specificGravity, 6)}`,
            result: specificGravity,
            unit: '',
            digits: 5,
            reference: `Formula verified: SG = rho / rho_ref, rho_ref = ${formatFluidTraceNumber(densityRef, 3)} kg/m3`
        },
        {
            title: 'Kinematic Viscosity',
            source: sourceProfile.kinematicViscosity,
            formula: 'nu(cSt) = mu(cP) / (rho / 1000)',
            substitution: !isCustomBasic && Number.isFinite(kinematicFromDynamic)
                ? `${formatFluidTraceNumber(dynamicViscosity, 6)} / (${formatFluidTraceNumber(density)} / 1000) = ${formatFluidTraceNumber(kinematicFromDynamic, 6)} cSt`
                : `Reported value = ${formatFluidTraceNumber(kinematicViscosity, 6)} cSt`,
            result: kinematicViscosity,
            unit: 'cSt',
            digits: 3,
            reference: 'Formula verified: pdf_ref/ref1-fluid-mechanics-fundaments-and-applications.pdf defines kinematic viscosity as mu / rho'
        },
        {
            title: 'Specific Weight',
            source: 'Derived',
            formula: 'gamma = rho x g',
            substitution: `${formatFluidTraceNumber(density)} x ${formatFluidTraceNumber(gravity)} = ${formatFluidTraceNumber(specificWeight)} N/m3`,
            result: specificWeight,
            unit: 'N/m3',
            digits: 3,
            reference: 'Formula verified: pdf_ref/ref1-fluid-mechanics-fundaments-and-applications.pdf defines gamma = rho x g; app uses g = 9.81 m/s2'
        },
        {
            title: 'Specific Volume',
            source: 'Derived',
            formula: 'v = 1 / rho',
            substitution: `1 / ${formatFluidTraceNumber(density)} = ${formatFluidTraceNumber(specificVolume, 9)} m3/kg`,
            result: specificVolume,
            unit: 'm3/kg',
            digits: 8,
            reference: 'Formula verified: pdf_ref/ref1-fluid-mechanics-fundaments-and-applications.pdf defines specific volume as 1 / rho'
        },
        {
            title: 'Vapor Pressure Head',
            source: 'NPSH relevance',
            formula: 'Hv = Pv_abs(Pa) / gamma = Pv_bar(a) x 100000 / (rho x g)',
            substitution: `${formatFluidTraceNumber(vaporPressureBarA, 6)} x 100000 / (${formatFluidTraceNumber(density)} x ${formatFluidTraceNumber(gravity)}) = ${formatFluidTraceNumber(vaporPressureHead)} m`,
            result: vaporPressureHead,
            unit: 'm',
            digits: 3,
            reference: 'Formula verified: pdf_ref/ref4-standar_ANSI-9-6-2024_rotodynamic_pump_guidline_for_NPSH_margin-hydraulic-institute.pdf Appendix A pressure-head conversion'
        },
        {
            title: 'Speed of Sound',
            source: 'Derived',
            formula: 'a = sqrt(K / rho)',
            substitution: Number.isFinite(bulkModulusGpa)
                ? `sqrt(${formatFluidTraceNumber(bulkModulusGpa)}e9 / ${formatFluidTraceNumber(density)}) = ${formatFluidTraceNumber(speedOfSound)} m/s`
                : `Reported value = ${formatFluidTraceNumber(speedOfSound)} m/s`,
            result: speedOfSound,
            unit: 'm/s',
            digits: 3,
            reference: auditProfile.bulkReference
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
        propertySourceMap: buildFluidPropertySourceMap(props, sourceProfile, values, auditProfile),
        dependencyChain: [
            'Temperature -> density, viscosity, vapor pressure for automatic fluids',
            'Density -> specific gravity, specific volume, specific weight',
            'Dynamic viscosity + density -> kinematic viscosity',
            'Vapor pressure + density -> vapor pressure head for NPSHa',
            'Bulk modulus + density -> speed of sound'
        ],
        steps,
        npshRelevance: [
            'Density is used in pressure-to-head conversion and affects Reynolds number in suction-line calculations.',
            'Specific weight is derived as gamma = rho x g and is the denominator in pressure/head conversion.',
            'Vapor pressure is converted to vapor pressure head and subtracts from NPSHa; higher vapor pressure reduces NPSH margin.',
            'Viscosity affects Reynolds number, friction factor, pipe loss, and therefore suction losses.',
            'Temperature drives automatic density, viscosity, and vapor pressure correlations for supported fluids.',
            'Bulk modulus and speed of sound are not primary steady-state NPSH terms, but remain useful compressibility/transient references.'
        ],
        references: [
            method,
            auditProfile.primaryReference,
            auditProfile.derivedReference,
            'pdf_ref/ref1-fluid-mechanics-fundaments-and-applications.pdf: density, specific volume, viscosity, specific weight, vapor pressure, cavitation context',
            'pdf_ref/ref4-standar_ANSI-9-6-2024_rotodynamic_pump_guidline_for_NPSH_margin-hydraulic-institute.pdf: NPSHA definition and pressure-head conversion'
        ],
        assumptions: [
            'Fluid properties are evaluated at the selected bulk fluid temperature.',
            'Hydraulic calculations treat the liquid as single-phase and incompressible for screening.',
            'Vapor pressure is treated as absolute pressure in bar a before conversion to Pa.',
            `The application uses g = ${formatFluidTraceNumber(gravity)} m/s2 for hydraulic head conversions.`
        ],
        academicNotes: [
            sourceProfile.note,
            `${fluidName} source status: ${auditProfile.primaryStatus}. ${auditProfile.primaryReference}`,
            'Engineering note: final academic or design-study cases should be validated against laboratory, vendor, NIST, or peer-reviewed literature data whenever the audit status is not Verified or Formula verified.'
        ],
        auditProfile,
        warnings
    };
}
