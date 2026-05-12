function calculateValveOpeningFraction(openingPercent) {
    return Math.max(0, Math.min(1, (openingPercent || 0) / 100));
}

function toValveCalcNumber(value, fallback = 0) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function getValveDefaultK(valveType) {
    const defaults = {
        'Control Valve': 10,
        'Gate Valve': 0.2,
        'Ball Valve': 0.05,
        'Butterfly Valve': 0.4,
        'Globe Valve': 10,
        'Check Valve': 2
    };
    return defaults[valveType] ?? 10;
}

function isControlValveAuditType(valveType) {
    return String(valveType || '').toLowerCase().includes('control valve');
}

function calculateValveOpeningEffect(openingPercent, characteristic) {
    const fraction = calculateValveOpeningFraction(openingPercent);
    if (fraction <= 0) return 0;
    if (fraction >= 1) return 1;

    if (characteristic === VALVE_CHAR_EQUAL_PERCENTAGE) {
        const rangeability = 50;
        return (Math.pow(rangeability, fraction) - 1) / (rangeability - 1);
    }

    if (characteristic === VALVE_CHAR_QUICK_OPENING) {
        return Math.sqrt(fraction);
    }

    return fraction;
}

function getValveEffectiveCv(props = {}) {
    const baseCv = Math.max(toValveCalcNumber(props.cv, 100), 0.001);
    if (props.flowCharacteristic === VALVE_CHAR_MANUAL_EFFECTIVE_CV) {
        return Math.max(toValveCalcNumber(props.effectiveCv, baseCv), 0.001);
    }
    return Math.max(baseCv * calculateValveOpeningEffect(props.opening, props.flowCharacteristic), 0.001);
}

function getValveEffectiveK(props = {}) {
    const baseK = Math.max(toValveCalcNumber(props.kValue, getValveDefaultK(props.valveType)), 0);
    const openingEffect = calculateValveOpeningEffect(props.opening, props.flowCharacteristic);
    if (openingEffect <= 0) return Infinity;
    return baseK / Math.pow(openingEffect, 2);
}

const VALVE_PIPE_DIAMETER_TOLERANCE_FRACTION = 0.02;
const VALVE_COMPATIBILITY_SEVERITY_ORDER = { Critical: 0, Review: 1, Info: 2, OK: 3 };
const VALVE_DEFAULT_PROFILES = {
    'Control Valve': {
        boreType: 'Reduced bore',
        pressureClass: 'ASME Class 150',
        endConnection: 'Flanged RF',
        bodyMaterial: 'Carbon steel',
        reducerExpanderBasis: 'Review only'
    },
    'Gate Valve': {
        boreType: 'Full bore',
        pressureClass: 'ASME Class 150',
        endConnection: 'Flanged RF',
        bodyMaterial: 'Carbon steel',
        reducerExpanderBasis: 'Review only'
    },
    'Ball Valve': {
        boreType: 'Full bore',
        pressureClass: 'ASME Class 150',
        endConnection: 'Flanged RF',
        bodyMaterial: 'Carbon steel',
        reducerExpanderBasis: 'Review only'
    },
    'Globe Valve': {
        boreType: 'Reduced bore',
        pressureClass: 'ASME Class 150',
        endConnection: 'Flanged RF',
        bodyMaterial: 'Carbon steel',
        reducerExpanderBasis: 'Review only'
    },
    'Butterfly Valve': {
        boreType: 'Reduced bore',
        pressureClass: 'ASME Class 150',
        endConnection: 'Wafer',
        bodyMaterial: 'Carbon steel',
        reducerExpanderBasis: 'Review only'
    },
    'Check Valve': {
        boreType: 'Reduced bore',
        pressureClass: 'ASME Class 150',
        endConnection: 'Flanged RF',
        bodyMaterial: 'Carbon steel',
        reducerExpanderBasis: 'Review only'
    }
};

function getValveAuditModel(model) {
    return model || (typeof globalModel !== 'undefined' ? globalModel : {});
}

function getValveAuditConnections(connectionList) {
    if (Array.isArray(connectionList)) return connectionList;
    return (typeof connections !== 'undefined' && Array.isArray(connections)) ? connections : [];
}

function isValveAuditNode(node) {
    return node && ['valve', 'checkValve'].includes(node.type);
}

function getValveAuditType(node) {
    return node?.props?.valveType || (node?.type === 'checkValve' ? 'Check Valve' : 'Globe Valve');
}

function getValveDefaultProfile(valveType) {
    return VALVE_DEFAULT_PROFILES[valveType] || VALVE_DEFAULT_PROFILES['Globe Valve'];
}

function normalizeValveAuditProps(node) {
    if (!isValveAuditNode(node)) return {};
    if (!node.props) node.props = {};
    const props = node.props;
    const valveType = getValveAuditType(node);
    const defaults = getValveDefaultProfile(valveType);

    if (!props.boreType) props.boreType = defaults.boreType;
    if (!props.pressureClass) props.pressureClass = defaults.pressureClass;
    if (!props.endConnection) props.endConnection = defaults.endConnection;
    if (!props.bodyMaterial) props.bodyMaterial = defaults.bodyMaterial;
    if (!props.reducerExpanderBasis) props.reducerExpanderBasis = defaults.reducerExpanderBasis;
    if (props.boreDiameter === undefined || props.boreDiameter === null) props.boreDiameter = '';

    return props;
}

function createValveCompatibilityIssue(severity, message) {
    return { severity, message };
}

function formatValveCompatibilityIssue(issue) {
    if (!issue) return '';
    return issue.severity && issue.severity !== 'OK'
        ? `[${issue.severity}] ${issue.message}`
        : issue.message;
}

function getValveCompatibilitySeverity(issues = []) {
    if (!issues.length) return 'OK';
    return issues
        .map(issue => issue.severity || 'Info')
        .sort((a, b) => (VALVE_COMPATIBILITY_SEVERITY_ORDER[a] ?? 2) - (VALVE_COMPATIBILITY_SEVERITY_ORDER[b] ?? 2))[0] || 'Info';
}

function getValveMaterialFamily(material) {
    const label = String(material || '').toLowerCase();
    if (label.includes('stainless')) return 'Stainless steel';
    if (label.includes('pvc') || label.includes('plastic')) return 'PVC / plastic';
    if (label.includes('cast iron')) return 'Cast iron';
    if (label.includes('ductile')) return 'Ductile iron';
    if (label.includes('bronze')) return 'Bronze';
    if (label.includes('carbon') || label.includes('steel')) return 'Carbon steel';
    if (label.includes('user')) return 'User-defined';
    return material || 'User-defined';
}

function areEndConnectionsCompatible(pipeEndConnection, valveEndConnection) {
    const pipeEnd = String(pipeEndConnection || '').trim();
    const valveEnd = String(valveEndConnection || '').trim();
    if (!pipeEnd || !valveEnd || pipeEnd === 'By piping class / compatible') return true;
    if (pipeEnd === valveEnd) return true;
    if (['Wafer', 'Lug'].includes(valveEnd)) {
        return ['Flanged RF', 'Wafer/Lug compatible', 'By piping class / compatible'].includes(pipeEnd);
    }
    return false;
}

function getValveNominalBoreDiameter(props = {}) {
    const diameter = toValveCalcNumber(props.diameter, NaN);
    if (!Number.isFinite(diameter) || diameter <= 0) return null;
    if (props.boreType === 'User-defined bore') {
        const boreDiameter = toValveCalcNumber(props.boreDiameter, NaN);
        return Number.isFinite(boreDiameter) && boreDiameter > 0 ? boreDiameter : null;
    }
    if (props.boreType === 'Full bore') return diameter;
    return diameter * 0.8;
}

function getValveLossSource(nodeOrProps = {}) {
    const node = nodeOrProps.props ? nodeOrProps : null;
    const props = node ? node.props : nodeOrProps;
    const nodeType = node?.type || 'valve';
    const lossModel = props.lossModel || VALVE_LOSS_MODEL_CV;
    const valveType = props.valveType || (nodeType === 'checkValve' ? 'Check Valve' : 'Globe Valve');

    if (lossModel === VALVE_LOSS_MODEL_K) {
        const defaultK = getValveDefaultK(valveType);
        const inputK = toValveCalcNumber(props.kValue, defaultK);
        const isDefault = Math.abs(inputK - defaultK) < 1e-9;
        return {
            status: isDefault ? 'Typical' : 'User',
            source: isDefault
                ? `Textbook/Crane-style default K for ${valveType}`
                : `User-entered K for ${valveType}`
        };
    }

    if (lossModel === VALVE_LOSS_MODEL_EQUIVALENT_LENGTH) {
        return {
            status: 'User',
            source: 'User-entered equivalent length; converted with Darcy-Weisbach friction'
        };
    }

    return {
        status: 'User',
        source: props.flowCharacteristic === VALVE_CHAR_MANUAL_EFFECTIVE_CV
            ? 'User-entered manual effective Cv'
            : 'User/manufacturer Cv input with opening characteristic'
    };
}

function getValveConnectedPipeReferences(valveId, model = null, connectionList = null) {
    const resolvedModel = getValveAuditModel(model);
    const resolvedConnections = getValveAuditConnections(connectionList);
    return resolvedConnections
        .filter(conn => conn && conn.connectionType !== 'semantic' && (conn.from === valveId || conn.to === valveId))
        .map(conn => {
            const pipe = resolvedModel[conn.pipeId];
            if (!pipe || pipe.type !== 'pipe' || !pipe.props) return null;
            if (typeof normalizePipeProps === 'function') normalizePipeProps(pipe.props);
            const segments = Array.isArray(pipe.props.segments) ? pipe.props.segments : [];
            const endpointSegment = conn.from === valveId ? segments[0] : segments[segments.length - 1];
            const fallbackSegment = segments.find(segment => parseFloat(segment.diameter) > 0);
            const segment = endpointSegment || fallbackSegment || {};
            const diameter = toValveCalcNumber(segment.diameter, NaN);
            return {
                pipeId: conn.pipeId,
                connection: conn,
                side: conn.from === valveId ? 'pipe inlet' : 'pipe outlet',
                diameter,
                sizeLabel: segment.pipeSize || 'Custom diameter',
                pressureClass: typeof getPipePressureClass === 'function'
                    ? getPipePressureClass(pipe)
                    : (pipe.props?.pressureClass || 'ASME Class 150'),
                endConnection: typeof getPipeEndConnection === 'function'
                    ? getPipeEndConnection(pipe)
                    : (pipe.props?.endConnection || 'By piping class / compatible'),
                materialFamily: typeof getPipeMaterialFamily === 'function'
                    ? getPipeMaterialFamily(segment.material)
                    : getValveMaterialFamily(segment.material),
                source: typeof getPipeSizeSource === 'function'
                    ? getPipeSizeSource(segment)
                    : { status: 'User', source: 'User-entered internal diameter' }
            };
        })
        .filter(Boolean);
}

function getValveDiameterInheritanceResult(valveId, model = null, connectionList = null) {
    const refs = getValveConnectedPipeReferences(valveId, model, connectionList);
    const validRefs = refs.filter(ref => Number.isFinite(ref.diameter) && ref.diameter > 0);
    if (!validRefs.length) {
        return {
            refs,
            canInherit: false,
            ambiguous: false,
            diameter: null,
            basis: refs.length ? 'Connected pipe diameter is missing' : 'No connected pipe'
        };
    }

    const first = validRefs[0];
    const allSame = validRefs.every(ref => (
        Math.abs(ref.diameter - first.diameter) / first.diameter <= VALVE_PIPE_DIAMETER_TOLERANCE_FRACTION
    ));
    return {
        refs,
        canInherit: allSame,
        ambiguous: !allSame,
        diameter: allSame ? first.diameter : null,
        basis: allSame
            ? `Inherited from ${first.pipeId} ${first.sizeLabel} (${first.diameter.toFixed(5)} m ID)`
            : `Ambiguous pipe IDs: ${validRefs.map(ref => `${ref.pipeId} ${ref.diameter.toFixed(5)} m`).join(', ')}`
    };
}

function syncValveDiameterFromConnectedPipes(valveId, model = null, connectionList = null) {
    const resolvedModel = getValveAuditModel(model);
    const node = resolvedModel[valveId];
    if (!isValveAuditNode(node)) return null;
    normalizeValveAuditProps(node);

    const inheritance = getValveDiameterInheritanceResult(valveId, resolvedModel, connectionList);
    if (inheritance.canInherit && Number.isFinite(inheritance.diameter) && inheritance.diameter > 0) {
        node.props.diameter = inheritance.diameter;
    }
    return inheritance;
}

function getValveSizeMatchStatus(inheritance, valveDiameter) {
    if (!inheritance?.refs?.length) return 'Missing Data';
    const validRefs = inheritance.refs.filter(ref => Number.isFinite(ref.diameter) && ref.diameter > 0);
    if (!validRefs.length || !Number.isFinite(valveDiameter) || valveDiameter <= 0) return 'Missing Data';
    if (inheritance.ambiguous) return 'Ambiguous';
    const targetDiameter = inheritance.diameter;
    if (!Number.isFinite(targetDiameter) || targetDiameter <= 0) return 'Missing Data';
    const mismatch = Math.abs(valveDiameter - targetDiameter) / targetDiameter;
    return mismatch > VALVE_PIPE_DIAMETER_TOLERANCE_FRACTION ? 'Reducer/Expander Needed' : 'Match';
}

function calculateValveEquivalentKFromCv(props = {}, model = null) {
    const diameter = toValveCalcNumber(props.diameter, NaN);
    if (!Number.isFinite(diameter) || diameter <= 0) return null;
    const effectiveCv = typeof getValveEffectiveCv === 'function'
        ? getValveEffectiveCv(props)
        : Math.max(toValveCalcNumber(props.cv, 100), 0.001);
    if (!Number.isFinite(effectiveCv) || effectiveCv <= 0) return null;

    const resolvedModel = getValveAuditModel(model);
    const density = Math.max(toValveCalcNumber(resolvedModel.FLUID?.props?.density, 1000), 1);
    const specificGravity = typeof getFluidSpecificGravity === 'function'
        ? getFluidSpecificGravity(resolvedModel)
        : Math.max(density / 999.972, 0.001);
    if (typeof calculateCvPressureDropBar !== 'function' || typeof calculateVelocityHeadForDiameter !== 'function') return null;

    const flowM3H = 1;
    const dpBar = calculateCvPressureDropBar(flowM3H, effectiveCv, specificGravity);
    const headLoss = typeof pressureBarToHead === 'function'
        ? pressureBarToHead(dpBar, density)
        : dpBar * 100000 / (density * 9.81);
    const velocityHead = calculateVelocityHeadForDiameter(flowM3H, diameter);
    return velocityHead > 0 ? headLoss / velocityHead : null;
}

function calculateValveEquivalentCvFromK(props = {}, model = null) {
    const effectiveK = typeof getValveEffectiveK === 'function'
        ? getValveEffectiveK(props)
        : Math.max(toValveCalcNumber(props.kValue, getValveDefaultK(props.valveType)), 0);
    if (!Number.isFinite(effectiveK) || effectiveK <= 0) return null;
    const unitCvK = calculateValveEquivalentKFromCv({ ...props, cv: 1, effectiveCv: 1, flowCharacteristic: VALVE_CHAR_LINEAR, opening: 100 }, model);
    return Number.isFinite(unitCvK) && unitCvK > 0 ? Math.sqrt(unitCvK / effectiveK) : null;
}

function getValveEquivalentLossText(node, model = null) {
    const props = node?.props || {};
    const lossModel = props.lossModel || VALVE_LOSS_MODEL_CV;
    if (lossModel === VALVE_LOSS_MODEL_CV) {
        const equivalentK = calculateValveEquivalentKFromCv(props, model);
        return Number.isFinite(equivalentK) ? `Equivalent K ${equivalentK.toFixed(3)}` : '-';
    }
    if (lossModel === VALVE_LOSS_MODEL_K) {
        const equivalentCv = calculateValveEquivalentCvFromK(props, model);
        return Number.isFinite(equivalentCv) ? `Equivalent Cv ${equivalentCv.toFixed(1)}` : '-';
    }
    return 'Equivalent length model';
}

function getValveCompatibilityIssues(valveId, model = null, connectionList = null) {
    const resolvedModel = getValveAuditModel(model);
    const node = resolvedModel[valveId];
    if (!isValveAuditNode(node)) return [];

    const props = normalizeValveAuditProps(node);
    const inheritance = getValveDiameterInheritanceResult(valveId, resolvedModel, connectionList);
    const issues = [];
    const lossModel = props.lossModel || VALVE_LOSS_MODEL_CV;
    const valveDiameter = toValveCalcNumber(props.diameter, NaN);
    const sizeMatchStatus = getValveSizeMatchStatus(inheritance, valveDiameter);
    const valvePressureClass = props.pressureClass || getValveDefaultProfile(getValveAuditType(node)).pressureClass;
    const valveEndConnection = props.endConnection || getValveDefaultProfile(getValveAuditType(node)).endConnection;
    const valveMaterialFamily = getValveMaterialFamily(props.bodyMaterial);

    if (inheritance.refs.length && !inheritance.refs.some(ref => Number.isFinite(ref.diameter) && ref.diameter > 0)) {
        issues.push(createValveCompatibilityIssue('Review', `${valveId} is connected to pipe(s), but pipe internal diameter is missing.`));
    }

    if (inheritance.ambiguous) {
        const reducerBasis = props.reducerExpanderBasis || 'Review only';
        issues.push(createValveCompatibilityIssue('Review', `${valveId} is connected to pipes with different IDs; select an explicit valve size or add reducer/expander basis.`));
        if (reducerBasis === 'Review only') {
            issues.push(createValveCompatibilityIssue('Review', `${valveId} reducer/expander loss is not explicitly modeled; choose User modeled separately or Estimate reducer/expander K if applicable.`));
        } else if (reducerBasis === 'Estimate reducer/expander K') {
            issues.push(createValveCompatibilityIssue('Info', `${valveId} reducer/expander K estimate is a screening basis; verify geometry before design use.`));
        }
    } else if (inheritance.canInherit && Number.isFinite(valveDiameter) && valveDiameter > 0) {
        const mismatch = Math.abs(valveDiameter - inheritance.diameter) / inheritance.diameter;
        if (mismatch > VALVE_PIPE_DIAMETER_TOLERANCE_FRACTION) {
            issues.push(createValveCompatibilityIssue('Review', `${valveId} hydraulic diameter does not match connected pipe ID; it will be inherited when the network recalculates.`));
        }
    }

    if (sizeMatchStatus === 'Reducer/Expander Needed') {
        issues.push(createValveCompatibilityIssue('Review', `${valveId} size match status is Reducer/Expander Needed.`));
    }

    inheritance.refs.forEach(ref => {
        if (ref.pressureClass && valvePressureClass && ref.pressureClass !== valvePressureClass && ref.pressureClass !== 'User-defined' && valvePressureClass !== 'User-defined') {
            issues.push(createValveCompatibilityIssue('Review', `${valveId} rating ${valvePressureClass} differs from ${ref.pipeId} rating ${ref.pressureClass}.`));
        }
        if (!areEndConnectionsCompatible(ref.endConnection, valveEndConnection)) {
            issues.push(createValveCompatibilityIssue('Review', `${valveId} end connection ${valveEndConnection} needs compatibility review with ${ref.pipeId} ${ref.endConnection}.`));
        }
        if (ref.materialFamily && valveMaterialFamily && ref.materialFamily !== valveMaterialFamily && ref.materialFamily !== 'User-defined' && valveMaterialFamily !== 'User-defined') {
            issues.push(createValveCompatibilityIssue('Review', `${valveId} body material ${valveMaterialFamily} differs from ${ref.pipeId} material ${ref.materialFamily}; verify metallurgy/gasket compatibility.`));
        }
        if (node.type === 'checkValve') {
            const conn = ref.connection;
            if ((conn.to === valveId && String(conn.toPort || '').includes('.outlet'))
                || (conn.from === valveId && String(conn.fromPort || '').includes('.inlet'))) {
                issues.push(createValveCompatibilityIssue('Critical', `${valveId} check valve orientation is reversed for the connected pipe; flow must enter inlet and leave outlet.`));
            }
        }
    });

    if (props.boreType === 'User-defined bore' && !Number.isFinite(getValveNominalBoreDiameter(props))) {
        issues.push(createValveCompatibilityIssue('Review', `${valveId} user-defined bore requires a positive bore diameter.`));
    }

    if (node.type === 'valve') {
        const opening = toValveCalcNumber(props.opening, 100);
        if (opening <= 0) {
            issues.push(createValveCompatibilityIssue('Critical', `${valveId} opening is 0%; hydraulic loss is treated as closed/infinite.`));
        }
    }

    if (lossModel === VALVE_LOSS_MODEL_CV && toValveCalcNumber(props.cv, 0) <= 0) {
        issues.push(createValveCompatibilityIssue('Critical', `${valveId} Cv must be greater than zero.`));
    }
    if (lossModel === VALVE_LOSS_MODEL_K && toValveCalcNumber(props.kValue, 0) < 0) {
        issues.push(createValveCompatibilityIssue('Critical', `${valveId} K value cannot be negative.`));
    }
    if (lossModel === VALVE_LOSS_MODEL_EQUIVALENT_LENGTH && toValveCalcNumber(props.equivLength, 0) <= 0) {
        issues.push(createValveCompatibilityIssue('Review', `${valveId} equivalent length should be greater than zero.`));
    }
    if ([VALVE_LOSS_MODEL_K, VALVE_LOSS_MODEL_EQUIVALENT_LENGTH].includes(lossModel)
        && (!Number.isFinite(valveDiameter) || valveDiameter <= 0)) {
        issues.push(createValveCompatibilityIssue('Critical', `${valveId} hydraulic diameter is required for ${lossModel} loss calculation.`));
    }

    const seen = new Set();
    return issues.filter(issue => {
        const key = `${issue.severity}:${issue.message}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function getValveCompatibilityWarnings(valveId, model = null, connectionList = null) {
    return getValveCompatibilityIssues(valveId, model, connectionList)
        .map(formatValveCompatibilityIssue)
        .filter(Boolean);
}

function updateValveCompatibilityResult(valveId, model = null, connectionList = null, options = {}) {
    const resolvedModel = getValveAuditModel(model);
    const node = resolvedModel[valveId];
    if (!isValveAuditNode(node)) return null;
    normalizeValveAuditProps(node);
    if (!node.results) node.results = {};

    const inheritance = options.syncDiameter === false
        ? getValveDiameterInheritanceResult(valveId, resolvedModel, connectionList)
        : syncValveDiameterFromConnectedPipes(valveId, resolvedModel, connectionList);
    const issues = getValveCompatibilityIssues(valveId, resolvedModel, connectionList);
    const warnings = issues.map(formatValveCompatibilityIssue).filter(Boolean);
    const lossSource = getValveLossSource(node);
    const connectedRefs = inheritance?.refs || [];
    const valveDiameter = toValveCalcNumber(node.props?.diameter, NaN);
    const sizeMatchStatus = getValveSizeMatchStatus(inheritance, valveDiameter);
    const severity = getValveCompatibilitySeverity(issues);
    const defaultProfile = getValveDefaultProfile(getValveAuditType(node));
    const specBasis = [
        `Valve ${node.props.pressureClass || defaultProfile.pressureClass}`,
        node.props.endConnection || defaultProfile.endConnection,
        node.props.bodyMaterial || defaultProfile.bodyMaterial
    ].join(' | ');

    const audit = {
        connectedPipes: connectedRefs.map(ref => ref.pipeId),
        connectedPipeText: connectedRefs.length
            ? connectedRefs.map(ref => `${ref.pipeId} ${Number.isFinite(ref.diameter) ? ref.diameter.toFixed(5) : '-'} m`).join(', ')
            : '-',
        sizeMatchStatus,
        diameterBasis: inheritance?.basis || '-',
        inheritedDiameter: inheritance?.canInherit ? inheritance.diameter : null,
        boreBasis: `${node.props.boreType || defaultProfile.boreType}${Number.isFinite(getValveNominalBoreDiameter(node.props)) ? ` (${getValveNominalBoreDiameter(node.props).toFixed(5)} m bore)` : ''}`,
        specBasis,
        reducerExpanderBasis: node.props.reducerExpanderBasis || defaultProfile.reducerExpanderBasis,
        equivalentLossText: getValveEquivalentLossText(node, resolvedModel),
        lossSource,
        lossSourceText: `${lossSource.status}: ${lossSource.source}`,
        severity,
        issues,
        warnings
    };

    node.results.pipeCompatibility = audit;
    node.results.status = severity === 'OK' ? 'OK' : severity;
    node.results.warnings = warnings;
    return audit;
}

function updateAllValveCompatibilityResults(model = null, connectionList = null, options = {}) {
    const resolvedModel = getValveAuditModel(model);
    const audits = {};
    Object.keys(resolvedModel || {}).forEach(nodeId => {
        if (isValveAuditNode(resolvedModel[nodeId])) {
            audits[nodeId] = updateValveCompatibilityResult(nodeId, resolvedModel, connectionList, options);
        }
    });
    return audits;
}

function roundValveTraceNumber(value, digits = 3) {
    const numeric = parseFloat(value);
    if (!Number.isFinite(numeric)) return null;
    return Number(numeric.toFixed(digits));
}

function formatValveTraceNumber(value, digits = 3) {
    const numeric = parseFloat(value);
    if (!Number.isFinite(numeric)) return '-';
    return numeric.toFixed(digits);
}

function getValveTraceGravity() {
    return typeof getHydraulicGravity === 'function'
        ? getHydraulicGravity()
        : (typeof GRAVITY === 'number' ? GRAVITY : 9.81);
}

function valveTracePressureBarToHead(pressureBar, density) {
    const rho = Math.max(toValveCalcNumber(density, 1000), 1);
    if (typeof pressureBarToHead === 'function') return pressureBarToHead(pressureBar, rho);
    return toValveCalcNumber(pressureBar, 0) * 100000 / (rho * getValveTraceGravity());
}

function valveTracePressureHeadToBar(head, density) {
    const rho = Math.max(toValveCalcNumber(density, 1000), 1);
    if (typeof pressureHeadToBar === 'function') return pressureHeadToBar(head, rho);
    return toValveCalcNumber(head, 0) * rho * getValveTraceGravity() / 100000;
}

function createValveTraceStep(title, formula, substitution, result, unit = '', reference = '', digits = 3) {
    return {
        title,
        formula,
        substitution,
        result,
        unit,
        reference,
        digits
    };
}

function getValveTraceFluidProps(model = null) {
    const resolvedModel = getValveAuditModel(model);
    const props = resolvedModel.FLUID?.props || {};
    const density = Math.max(toValveCalcNumber(props.density, 1000), 1);
    const specificGravity = typeof getFluidSpecificGravity === 'function'
        ? getFluidSpecificGravity(resolvedModel)
        : Math.max(density / 999.972, 0.001);

    return {
        fluidName: props.fluidName || 'Fluid Basis',
        density,
        specificGravity,
        viscosityCSt: Math.max(toValveCalcNumber(props.viscosity, 1), 0.000001),
        vaporPressureBarA: Math.max(toValveCalcNumber(props.vaporPressure, 0), 0)
    };
}

function calculateValveTraceVelocityHead(flowRateM3H, diameterM) {
    if (typeof calculateVelocityHeadForDiameter === 'function') {
        return calculateVelocityHeadForDiameter(flowRateM3H, diameterM);
    }
    const flow = Math.max(toValveCalcNumber(flowRateM3H, 0), 0);
    const diameter = Math.max(toValveCalcNumber(diameterM, 0.1), 0.0001);
    if (flow <= 0) return 0;
    const area = Math.PI * Math.pow(diameter, 2) / 4;
    const velocity = (flow / 3600) / area;
    return Math.pow(velocity, 2) / (2 * getValveTraceGravity());
}

function calculateValveTraceCvPressureDropBar(flowRateM3H, cv, specificGravity) {
    if (typeof calculateCvPressureDropBar === 'function') {
        return calculateCvPressureDropBar(flowRateM3H, cv, specificGravity);
    }
    const flow = Math.max(toValveCalcNumber(flowRateM3H, 0), 0);
    const effectiveCv = Math.max(toValveCalcNumber(cv, 0), 0.001);
    if (flow <= 0) return 0;
    const flowGpm = flow * 4.402867;
    const dpPsi = Math.max(toValveCalcNumber(specificGravity, 1), 0.001) * Math.pow(flowGpm / effectiveCv, 2);
    return dpPsi * 0.0689476;
}

function getValveTraceConnections(nodeId, model = null, connectionList = null) {
    const resolvedModel = getValveAuditModel(model);
    const resolvedConnections = getValveAuditConnections(connectionList);
    if (!nodeId) return [];

    return resolvedConnections
        .filter(conn => conn && conn.pipeId && conn.connectionType !== 'semantic' && (conn.from === nodeId || conn.to === nodeId))
        .map(conn => (typeof getOrientedHydraulicConnection === 'function'
            ? getOrientedHydraulicConnection(conn)
            : conn))
        .filter(Boolean)
        .map(conn => {
            const pipe = resolvedModel[conn.pipeId];
            const flow = toValveCalcNumber(pipe?.results?.flow, NaN);
            const solved = !!(pipe?.results?.pressureCalculated && Number.isFinite(flow));
            const role = conn.to === nodeId ? 'Inlet' : (conn.from === nodeId ? 'Outlet' : 'Connected');
            const otherId = conn.to === nodeId ? conn.from : conn.to;
            return {
                pipeId: conn.pipeId,
                role,
                otherId,
                flow: solved ? flow : null,
                solved,
                text: `${conn.pipeId} ${role.toLowerCase()} ${otherId || '-'}`
            };
        });
}

function getValveTraceFlowBasis(connectionRows = []) {
    const solvedRows = connectionRows.filter(row => Number.isFinite(row.flow) && row.flow >= 0);
    if (!solvedRows.length) return { flow: null, basis: 'No solved connected hydraulic pipe flow' };

    const inletRows = solvedRows.filter(row => row.role === 'Inlet');
    const outletRows = solvedRows.filter(row => row.role === 'Outlet');
    const selected = inletRows[0] || outletRows[0] || solvedRows[0];
    const directionText = selected.role === 'Inlet'
        ? 'solved inlet pipe flow'
        : (selected.role === 'Outlet' ? 'solved outlet pipe flow' : 'solved connected pipe flow');

    return {
        flow: selected.flow,
        basis: `${selected.pipeId} ${directionText}`
    };
}

function valveTracePathContainsNode(path, nodeId, terminalNodeId, model) {
    if (!path || !nodeId || !Array.isArray(path.steps)) return false;
    const entryNodeId = typeof getHydraulicPathEntryEquipmentNodeId === 'function'
        ? getHydraulicPathEntryEquipmentNodeId(path, terminalNodeId, model)
        : null;
    if (entryNodeId === nodeId) return true;
    return path.steps.some(step => step.from === nodeId || step.to === nodeId);
}

function getValveNpshPathInfo(nodeId, model = null, connectionList = null, density = 1000, vaporPressureBar = 0) {
    const resolvedModel = getValveAuditModel(model);
    const resolvedConnections = getValveAuditConnections(connectionList);
    const pumpIds = Object.keys(resolvedModel || {}).filter(id => resolvedModel[id]?.type === 'pump');
    const rows = [];

    pumpIds.forEach(pumpId => {
        let suctionPath = null;
        let dischargePath = null;
        if (typeof createPumpHydraulicContext === 'function') {
            const context = createPumpHydraulicContext(
                pumpId,
                resolvedModel,
                resolvedConnections,
                density,
                Math.max(toValveCalcNumber(vaporPressureBar, 0), 0) * 100000
            );
            suctionPath = context?.suctionPath || null;
            dischargePath = context?.dischargePath || null;
        } else if (typeof window !== 'undefined' && window.hydraulicNetworkState?.pumps?.[pumpId]) {
            suctionPath = window.hydraulicNetworkState.pumps[pumpId].suctionPath || null;
            dischargePath = window.hydraulicNetworkState.pumps[pumpId].dischargePath || null;
        }

        if (valveTracePathContainsNode(suctionPath, nodeId, pumpId, resolvedModel)) {
            rows.push({ pumpId, role: 'Suction path', npshEffect: 'Subtracts from NPSHA as suction loss' });
        } else if (valveTracePathContainsNode(dischargePath, nodeId, dischargePath?.boundaryId, resolvedModel)) {
            rows.push({ pumpId, role: 'Discharge path', npshEffect: 'Affects system head but does not subtract from pump suction NPSHA' });
        }
    });

    return rows;
}

function buildValveCalculationTrace(nodeIdOrNode, model = null, connectionList = null) {
    const resolvedModel = getValveAuditModel(model);
    const resolvedConnections = getValveAuditConnections(connectionList);
    const nodeId = typeof nodeIdOrNode === 'string' ? nodeIdOrNode : (nodeIdOrNode?.id || nodeIdOrNode?.name || '');
    const node = typeof nodeIdOrNode === 'string' ? resolvedModel[nodeId] : nodeIdOrNode;
    if (!isValveAuditNode(node)) return null;

    const props = normalizeValveAuditProps(node);
    const compatibility = typeof updateValveCompatibilityResult === 'function' && nodeId
        ? updateValveCompatibilityResult(nodeId, resolvedModel, resolvedConnections, { syncDiameter: true })
        : node.results?.pipeCompatibility;
    const fluid = getValveTraceFluidProps(resolvedModel);
    const connectionRows = getValveTraceConnections(nodeId, resolvedModel, resolvedConnections);
    const flowBasis = getValveTraceFlowBasis(connectionRows);
    const flowM3H = Number.isFinite(flowBasis.flow) ? flowBasis.flow : 0;
    const hasSolvedFlow = Number.isFinite(flowBasis.flow);
    const isCheckValve = node.type === 'checkValve';
    const valveType = getValveAuditType(node);
    const isControlValve = !isCheckValve && isControlValveAuditType(valveType);
    const objectTypeLabel = isControlValve ? 'Control Valve' : (isCheckValve ? 'Check Valve' : 'Valve');
    const modelBasis = isControlValve
        ? 'Control valve hydraulic pass-through; Cv/opening characteristic defines pressure drop, and suction-side loss reduces NPSHA.'
        : 'Hydraulic pass-through equipment; solid hydraulic connection required for flow and pressure-loss calculation.';
    const lossModel = props.lossModel || VALVE_LOSS_MODEL_CV;
    const openingPercent = isCheckValve ? 100 : Math.max(0, Math.min(100, toValveCalcNumber(props.opening, 100)));
    const openingEffect = isCheckValve ? 1 : calculateValveOpeningEffect(openingPercent, props.flowCharacteristic);
    const diameter = Math.max(toValveCalcNumber(props.diameter, 0.1), 0.0001);
    const boreDiameter = getValveNominalBoreDiameter(props);
    const velocityHead = calculateValveTraceVelocityHead(flowM3H, diameter);
    const flowGpm = flowM3H * 4.402867;
    const pathInfo = getValveNpshPathInfo(nodeId, resolvedModel, resolvedConnections, fluid.density, fluid.vaporPressureBarA);
    const suctionPathRows = pathInfo.filter(row => row.role === 'Suction path');
    const warnings = [];
    const steps = [
        createValveTraceStep(
            'Hydraulic Flow Basis',
            'Q = solved connected hydraulic pipe flow',
            hasSolvedFlow
                ? `${flowBasis.basis} = ${formatValveTraceNumber(flowM3H)} m3/h`
                : 'No solved connected hydraulic pipe flow',
            hasSolvedFlow ? roundValveTraceNumber(flowM3H, 3) : null,
            'm3/h',
            flowBasis.basis,
            3
        )
    ];

    let effectiveCv = null;
    let effectiveK = null;
    let equivalentK = null;
    let pressureDropBar = 0;
    let headLoss = 0;
    let crackingPressureBar = 0;
    let crackingHead = 0;
    let forwardLossHead = 0;
    let lossModelBasis = lossModel;
    let status = 'OK';
    if (isControlValve && lossModel === VALVE_LOSS_MODEL_CV) {
        lossModelBasis = `${lossModel} control-valve sizing basis`;
    }

    if (!connectionRows.length) {
        warnings.push('Valve is not connected by a solid hydraulic pipe path.');
    } else if (!hasSolvedFlow) {
        warnings.push('Connected pipe flow is not solved; valve head loss trace is using zero flow until the network solves.');
    }

    if (!isCheckValve && openingEffect <= 0) {
        headLoss = 1000000;
        pressureDropBar = valveTracePressureHeadToBar(headLoss, fluid.density);
        status = 'Critical';
        warnings.push('Valve opening is 0%; hydraulic loss is treated as closed/infinite for network solving.');
    } else if (isCheckValve) {
        crackingPressureBar = Math.max(toValveCalcNumber(props.crackingPressure, 0), 0);
        crackingHead = valveTracePressureBarToHead(crackingPressureBar, fluid.density);
        steps.push(createValveTraceStep(
            'Cracking Pressure Head',
            'h_crack = dP_crack x 100000 / (rho x g)',
            `${formatValveTraceNumber(crackingPressureBar)} x 100000 / (${formatValveTraceNumber(fluid.density)} x ${formatValveTraceNumber(getValveTraceGravity())}) = ${formatValveTraceNumber(crackingHead)} m`,
            roundValveTraceNumber(crackingHead, 3),
            'm',
            'Check valve cracking pressure is an added forward-opening pressure drop.',
            3
        ));

        if (flowM3H <= 0) {
            node.props.checkStatus = 'Closed';
            status = 'Review';
            warnings.push('Check valve has no positive solved forward flow; trace reports closed/no forward-flow loss.');
        } else {
            node.props.checkStatus = 'Open';
            if (lossModel === VALVE_LOSS_MODEL_K) {
                effectiveK = Math.max(toValveCalcNumber(props.kValue, getValveDefaultK('Check Valve')), 0);
                forwardLossHead = effectiveK * velocityHead;
                steps.push(createValveTraceStep(
                    'Forward K Loss',
                    'hK = K x V^2 / (2g)',
                    `${formatValveTraceNumber(effectiveK)} x ${formatValveTraceNumber(velocityHead)} = ${formatValveTraceNumber(forwardLossHead)} m`,
                    roundValveTraceNumber(forwardLossHead, 3),
                    'm',
                    'K-based local loss coefficient for forward check-valve flow.',
                    3
                ));
            } else {
                effectiveCv = Math.max(toValveCalcNumber(props.cv, 100), 0.001);
                const cvDropBar = calculateValveTraceCvPressureDropBar(flowM3H, effectiveCv, fluid.specificGravity);
                forwardLossHead = valveTracePressureBarToHead(cvDropBar, fluid.density);
                pressureDropBar += cvDropBar;
                steps.push(createValveTraceStep(
                    'Forward Cv Pressure Drop',
                    'dP(psi) = SG x (Q_gpm / Cv)^2; dP(bar) = dP(psi) x 0.0689476',
                    `${formatValveTraceNumber(fluid.specificGravity, 5)} x (${formatValveTraceNumber(flowGpm)} / ${formatValveTraceNumber(effectiveCv)})^2 x 0.0689476 = ${formatValveTraceNumber(cvDropBar, 6)} bar`,
                    roundValveTraceNumber(cvDropBar, 6),
                    'bar',
                    'Liquid Cv convention; Cv should come from vendor/user data for design.',
                    6
                ));
                steps.push(createValveTraceStep(
                    'Forward Cv Head Loss',
                    'hCv = dP x 100000 / (rho x g)',
                    `${formatValveTraceNumber(cvDropBar, 6)} x 100000 / (${formatValveTraceNumber(fluid.density)} x ${formatValveTraceNumber(getValveTraceGravity())}) = ${formatValveTraceNumber(forwardLossHead)} m`,
                    roundValveTraceNumber(forwardLossHead, 3),
                    'm',
                    'Pressure-drop head conversion from hydraulic energy balance.',
                    3
                ));
            }
            headLoss = crackingHead + forwardLossHead;
            pressureDropBar = valveTracePressureHeadToBar(headLoss, fluid.density);
        }
    } else if (lossModel === VALVE_LOSS_MODEL_K) {
        effectiveK = getValveEffectiveK(props);
        headLoss = Number.isFinite(effectiveK) ? effectiveK * velocityHead : 1000000;
        pressureDropBar = valveTracePressureHeadToBar(headLoss, fluid.density);
        steps.push(createValveTraceStep(
            'Opening Effect',
            'opening factor = characteristic(opening)',
            `${props.flowCharacteristic || VALVE_CHAR_LINEAR} @ ${formatValveTraceNumber(openingPercent)}% = ${formatValveTraceNumber(openingEffect, 6)}`,
            roundValveTraceNumber(openingEffect, 6),
            '',
            'Opening characteristic scales effective K by 1/openingFactor^2.',
            6
        ));
        steps.push(createValveTraceStep(
            'Effective K',
            'K_eff = K_base / openingFactor^2',
            `${formatValveTraceNumber(toValveCalcNumber(props.kValue, getValveDefaultK(valveType)))} / ${formatValveTraceNumber(openingEffect, 6)}^2 = ${formatValveTraceNumber(effectiveK, 6)}`,
            roundValveTraceNumber(effectiveK, 6),
            '',
            'Local loss coefficient adjusted for valve opening.',
            6
        ));
        steps.push(createValveTraceStep(
            'Velocity Head',
            'hv = V^2 / (2g)',
            `Q = ${formatValveTraceNumber(flowM3H)} m3/h, D = ${formatValveTraceNumber(diameter, 5)} m -> hv = ${formatValveTraceNumber(velocityHead)} m`,
            roundValveTraceNumber(velocityHead, 3),
            'm',
            'Velocity head through the valve hydraulic diameter.',
            3
        ));
        steps.push(createValveTraceStep(
            'Valve K Head Loss',
            'hL = K_eff x hv',
            `${formatValveTraceNumber(effectiveK, 6)} x ${formatValveTraceNumber(velocityHead)} = ${formatValveTraceNumber(headLoss)} m`,
            roundValveTraceNumber(headLoss, 3),
            'm',
            'K-based local loss relation for fittings/valves.',
            3
        ));
    } else if (lossModel === VALVE_LOSS_MODEL_EQUIVALENT_LENGTH) {
        const equivLength = Math.max(toValveCalcNumber(props.equivLength, 0), 0);
        headLoss = typeof calculateEquivalentLengthHeadLoss === 'function'
            ? calculateEquivalentLengthHeadLoss(flowM3H, props)
            : 0;
        pressureDropBar = valveTracePressureHeadToBar(headLoss, fluid.density);
        const nuM2S = fluid.viscosityCSt * 1e-6;
        const area = Math.PI * Math.pow(diameter, 2) / 4;
        const velocity = area > 0 ? (flowM3H / 3600) / area : 0;
        const reynolds = nuM2S > 0 ? velocity * diameter / nuM2S : null;
        const frictionFactor = typeof calculateFrictionFactor === 'function'
            ? calculateFrictionFactor(reynolds, 0.000045, diameter)
            : null;
        steps.push(createValveTraceStep(
            'Equivalent Length Loss',
            'hL = f x (L_eq / D) x V^2/(2g) / openingFactor^2',
            `${formatValveTraceNumber(frictionFactor, 6)} x (${formatValveTraceNumber(equivLength)} / ${formatValveTraceNumber(diameter, 5)}) x ${formatValveTraceNumber(velocityHead)} / ${formatValveTraceNumber(openingEffect, 6)}^2 = ${formatValveTraceNumber(headLoss)} m`,
            roundValveTraceNumber(headLoss, 3),
            'm',
            'Equivalent-length model converted with Darcy-Weisbach friction.',
            3
        ));
        lossModelBasis = `${lossModel} (Re ${Number.isFinite(reynolds) ? Math.round(reynolds).toLocaleString() : '-'})`;
    } else {
        effectiveCv = getValveEffectiveCv(props);
        pressureDropBar = calculateValveTraceCvPressureDropBar(flowM3H, effectiveCv, fluid.specificGravity);
        headLoss = valveTracePressureBarToHead(pressureDropBar, fluid.density);
        equivalentK = typeof calculateValveEquivalentKFromCv === 'function'
            ? calculateValveEquivalentKFromCv(props, resolvedModel)
            : null;
        steps.push(createValveTraceStep(
            'Opening Effect',
            'opening factor = characteristic(opening)',
            `${props.flowCharacteristic || VALVE_CHAR_LINEAR} @ ${formatValveTraceNumber(openingPercent)}% = ${formatValveTraceNumber(openingEffect, 6)}`,
            roundValveTraceNumber(openingEffect, 6),
            '',
            'Opening characteristic scales effective Cv unless Manual effective Cv is selected.',
            6
        ));
        steps.push(createValveTraceStep(
            'Effective Cv',
            'Cv_eff = Cv_base x openingFactor',
            props.flowCharacteristic === VALVE_CHAR_MANUAL_EFFECTIVE_CV
                ? `Manual effective Cv = ${formatValveTraceNumber(effectiveCv)}`
                : `${formatValveTraceNumber(toValveCalcNumber(props.cv, 100))} x ${formatValveTraceNumber(openingEffect, 6)} = ${formatValveTraceNumber(effectiveCv)} Cv`,
            roundValveTraceNumber(effectiveCv, 3),
            '',
            'Liquid Cv input should be manufacturer/user data; opening characteristic is a simplified control relation.',
            3
        ));
        steps.push(createValveTraceStep(
            'Cv Pressure Drop',
            'dP(psi) = SG x (Q_gpm / Cv_eff)^2; dP(bar) = dP(psi) x 0.0689476',
            `${formatValveTraceNumber(fluid.specificGravity, 5)} x (${formatValveTraceNumber(flowGpm)} / ${formatValveTraceNumber(effectiveCv)})^2 x 0.0689476 = ${formatValveTraceNumber(pressureDropBar, 6)} bar`,
            roundValveTraceNumber(pressureDropBar, 6),
            'bar',
            'Liquid Cv convention; verify against valve manufacturer/ISA sizing basis for final design.',
            6
        ));
        steps.push(createValveTraceStep(
            'Cv Pressure Drop Head',
            'hL = dP x 100000 / (rho x g)',
            `${formatValveTraceNumber(pressureDropBar, 6)} x 100000 / (${formatValveTraceNumber(fluid.density)} x ${formatValveTraceNumber(getValveTraceGravity())}) = ${formatValveTraceNumber(headLoss)} m`,
            roundValveTraceNumber(headLoss, 3),
            'm',
            'Pressure-drop head conversion from hydraulic energy balance.',
            3
        ));
        if (Number.isFinite(equivalentK)) {
            steps.push(createValveTraceStep(
                'Equivalent K Check',
                'K_eq = hL / hv',
                `${formatValveTraceNumber(headLoss)} / ${formatValveTraceNumber(velocityHead)} = ${formatValveTraceNumber(equivalentK, 6)}`,
                roundValveTraceNumber(equivalentK, 6),
                '',
                'Cross-check only; solver uses the selected Cv loss model.',
                6
            ));
        }
    }

    if (!isCheckValve || flowM3H > 0) {
        if (!steps.some(step => step.title === 'Valve Pressure Drop')) {
            steps.push(createValveTraceStep(
                'Valve Pressure Drop',
                'dP = hL x rho x g / 100000',
                `${formatValveTraceNumber(headLoss)} x ${formatValveTraceNumber(fluid.density)} x ${formatValveTraceNumber(getValveTraceGravity())} / 100000 = ${formatValveTraceNumber(pressureDropBar, 6)} bar`,
                roundValveTraceNumber(pressureDropBar, 6),
                'bar',
                'Head-to-pressure conversion for hydraulic readout.',
                6
            ));
        }
    }

    const npshLossContribution = suctionPathRows.length ? headLoss : 0;
    steps.push(createValveTraceStep(
        'NPSH Loss Contribution',
        'NPSHA effect = -hL_valve if valve is on pump suction path',
        suctionPathRows.length
            ? `${formatValveTraceNumber(headLoss)} m is included in suction path loss before pump suction`
            : 'Not in a detected pump suction path = 0 m direct NPSHA loss contribution',
        roundValveTraceNumber(npshLossContribution, 3),
        'm',
        'NPSHA subtracts suction path losses before vapor pressure head comparison.',
        3
    ));

    if (compatibility?.warnings?.length) {
        compatibility.warnings.forEach(warning => {
            if (warning && !warnings.includes(warning)) warnings.push(warning);
        });
    }
    if (isControlValve && lossModel !== VALVE_LOSS_MODEL_CV) {
        warnings.push('Control Valve normally uses Cv/manufacturer sizing data; K or equivalent length is screening-only for final design.');
    }
    if (isControlValve && suctionPathRows.length) {
        warnings.push('Control Valve is detected on pump suction path; its pressure drop consumes NPSHA and suction throttling should be verified carefully.');
    }
    if (isControlValve) {
        warnings.push('Control Valve trace does not calculate IEC/ISA liquid choking, cavitation, recovery factor FL, piping geometry factor FP, or installed gain; use vendor/IEC sizing for final design.');
    }
    if (lossModel === VALVE_LOSS_MODEL_CV) {
        warnings.push('Cv is treated as user/manufacturer input; verify the valve Cv and opening characteristic for final design.');
    }
    if (lossModel === VALVE_LOSS_MODEL_EQUIVALENT_LENGTH) {
        warnings.push('Equivalent length is a simplified screening method; verify equivalent length against project/vendor data.');
    }

    let readouts = [
        { label: 'Valve Type', value: valveType, unit: '', key: 'valve-type', kind: 'text' },
        { label: 'Object Type', value: objectTypeLabel, unit: '', key: 'valve-object-type', kind: 'text' },
        { label: 'Loss Model', value: lossModelBasis, unit: '', key: 'valve-loss-model', kind: 'text' },
        { label: 'Solved Flow', value: hasSolvedFlow ? flowM3H : null, unit: 'm3/h', key: 'valve-flow' },
        { label: 'Density Used', value: fluid.density, unit: 'kg/m3', key: 'valve-density' },
        { label: 'Specific Gravity Used', value: fluid.specificGravity, unit: '', key: 'valve-specific-gravity', digits: 5 },
        { label: 'Hydraulic Diameter', value: diameter, unit: 'm', key: 'valve-diameter', digits: 5 },
        { label: 'Nominal Bore', value: boreDiameter, unit: 'm', key: 'valve-bore-diameter', digits: 5 },
        { label: 'Opening', value: openingPercent, unit: '%', key: 'valve-opening' },
        { label: 'Opening Effect', value: openingEffect, unit: '', key: 'valve-opening-effect', digits: 6 },
        { label: 'Effective Cv', value: effectiveCv, unit: '', key: 'valve-effective-cv' },
        { label: 'Effective K', value: effectiveK, unit: '', key: 'valve-effective-k', digits: 6 },
        { label: 'Velocity Head', value: velocityHead, unit: 'm', key: 'valve-velocity-head' },
        { label: 'Forward Loss Head', value: forwardLossHead || (!isCheckValve ? headLoss : 0), unit: 'm', key: 'valve-forward-loss-head' },
        { label: 'Cracking Head', value: isCheckValve ? crackingHead : null, unit: 'm', key: 'valve-cracking-head' },
        { label: 'Valve Head Loss', value: headLoss, unit: 'm', key: 'valve-head-loss' },
        { label: 'Valve Pressure Drop', value: pressureDropBar, unit: 'bar', key: 'valve-pressure-drop', digits: 6 },
        { label: 'NPSH Loss Contribution', value: npshLossContribution, unit: 'm', key: 'valve-npsh-loss-contribution' }
    ];
    if (!isCheckValve) {
        readouts = readouts.filter(item => item.key !== 'valve-cracking-head');
    }
    if (isControlValve) {
        readouts.splice(3, 0,
            { label: 'Flow Characteristic', value: props.flowCharacteristic || VALVE_CHAR_LINEAR, unit: '', key: 'control-valve-characteristic', kind: 'text' },
            { label: 'Cv Input', value: toValveCalcNumber(props.cv, 100), unit: '', key: 'control-valve-cv-input' }
        );
    }

    const dependencyChain = [
        'Active Fluid Basis density -> pressure/head conversion for valve pressure drop and NPSH loss.',
        'Active Fluid Basis specific gravity -> liquid Cv pressure-drop equation when Cv model is selected.',
        'Solved connected hydraulic pipe flow -> valve flow basis; dashed/semantic SRC attachments are excluded.',
        'Valve hydraulic diameter -> area/velocity head for K and equivalent-length calculations.',
        'Valve opening + flow characteristic -> effective Cv or effective K for throttled valve behavior.',
        'K coefficient or Cv or equivalent length -> valve head loss.',
        'Check valve cracking pressure -> additional forward-opening head loss.',
        'If valve/check valve is in pump suction path, valve head loss subtracts from NPSHA.',
        'If valve/check valve is on discharge path, it affects system head but not direct pump suction NPSHA.'
    ];
    if (isControlValve) {
        dependencyChain.splice(5, 0,
            'Control Valve Cv input + opening characteristic -> effective Cv used for liquid pressure drop.',
            'Effective Cv + solved flow + active Fluid Basis SG -> control-valve pressure drop.',
            'Control-valve pressure drop on suction path -> subtracts from available NPSH before pump suction.'
        );
    }
    const controlValve = isControlValve ? {
        cvInput: roundValveTraceNumber(toValveCalcNumber(props.cv, 100), 3),
        effectiveCv: Number.isFinite(effectiveCv) ? roundValveTraceNumber(effectiveCv, 6) : null,
        openingPercent: roundValveTraceNumber(openingPercent, 3),
        flowCharacteristic: props.flowCharacteristic || VALVE_CHAR_LINEAR,
        pressureDropBar: roundValveTraceNumber(pressureDropBar, 6),
        headLoss: roundValveTraceNumber(headLoss, 6),
        npshLossContribution: roundValveTraceNumber(npshLossContribution, 6),
        sizingBasis: lossModel === VALVE_LOSS_MODEL_CV
            ? 'Cv liquid pressure-drop screening from user/manufacturer Cv input.'
            : 'Non-Cv screening mode; final control-valve design should use manufacturer/IEC sizing data.',
        limitations: [
            'No liquid choking/cavitation recovery-factor calculation in this app trace.',
            'No installed characteristic/gain or actuator sizing calculation in this app trace.',
            'Cv/opening characteristic must be supplied or verified from vendor data.'
        ]
    } : null;

    return {
        status: warnings.some(warning => warning.includes('[Critical]') || status === 'Critical') ? 'Critical' : (warnings.length ? 'Review' : 'OK'),
        inputBasis: {
            valveId: nodeId || node.name || '-',
            objectType: objectTypeLabel,
            modelBasis,
            unitStandard: typeof getUnitStandard === 'function' ? getUnitStandard() : 'Internal metric engineering units',
            activeFluid: fluid.fluidName,
            flowBasis: flowBasis.basis,
            connectedPipes: connectionRows.map(row => row.text),
            npshPathRole: pathInfo.length
                ? pathInfo.map(row => `${row.pumpId}: ${row.role}`).join(' | ')
                : 'No detected pump suction/discharge path role'
        },
        hydraulic: {
            flow: hasSolvedFlow ? roundValveTraceNumber(flowM3H, 3) : null,
            density: roundValveTraceNumber(fluid.density, 3),
            specificGravity: roundValveTraceNumber(fluid.specificGravity, 5),
            diameter: roundValveTraceNumber(diameter, 6),
            velocityHead: roundValveTraceNumber(velocityHead, 6),
            headLoss: roundValveTraceNumber(headLoss, 6),
            pressureDropBar: roundValveTraceNumber(pressureDropBar, 6),
            npshLossContribution: roundValveTraceNumber(npshLossContribution, 6),
            crackingPressureBar: roundValveTraceNumber(crackingPressureBar, 6),
            crackingHead: roundValveTraceNumber(crackingHead, 6),
            effectiveCv: Number.isFinite(effectiveCv) ? roundValveTraceNumber(effectiveCv, 6) : null,
            effectiveK: Number.isFinite(effectiveK) ? roundValveTraceNumber(effectiveK, 6) : null,
            equivalentK: Number.isFinite(equivalentK) ? roundValveTraceNumber(equivalentK, 6) : null
        },
        fluid,
        compatibility,
        controlValve,
        npshPathInfo: pathInfo,
        readouts,
        dependencyChain,
        steps,
        warnings: [...new Set(warnings)],
        assumptions: [
            'Valve object is a hydraulic pass-through item; it is included only on solid hydraulic paths.',
            'Cv values are user/manufacturer data. The application converts liquid Cv pressure drop to head with the active Fluid Basis density.',
            'K and fitting losses use hL = K x V^2/(2g).',
            'Equivalent length is converted with Darcy-Weisbach friction using active Fluid Basis kinematic viscosity.',
            'For NPSH, only valve losses located upstream of the pump suction are subtracted from NPSHA.'
        ],
        references: [
            'pdf_ref/ref1-fluid-mechanics-fundaments-and-applications.pdf: local losses, valve/fitting K loss, Reynolds number, and Darcy-Weisbach basis.',
            'pdf_ref/ref2-introduction-fluid-mechanics.pdf: steady-flow energy equation and head-loss accounting.',
            'pdf_ref/ref4-standar_ANSI-9-6-2024_rotodynamic_pump_guidline_for_NPSH_margin-hydraulic-institute.pdf: suction losses and NPSHA margin context.',
            'IEC 60534-2-1:2011: industrial-process control valve flow-capacity sizing equations for incompressible and compressible fluids under installed conditions.',
            'IEC 60534-2-3:2015: flow-capacity test procedures for control valve coefficients and liquid recovery/piping factors.',
            'NASA Glenn Bernoulli equation: pressure, velocity, and head-energy interpretation.',
            'NIST SI Guide: pascal as SI pressure unit and pressure/head unit-conversion consistency.',
            'Liquid Cv relation dP(psi)=SG(Q_gpm/Cv)^2 is treated as industry/vendor sizing convention; verify against manufacturer/ISA basis for final valve sizing.'
        ]
    };
}
