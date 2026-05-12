// Central quantity registry and unit conversion helpers.
// Internal calculation units are kept unchanged for backward compatibility.

const UNIT_STANDARD_SI = 'SI / International';
const UNIT_STANDARD_US = 'US Customary';
const UNIT_STANDARD_METRIC = 'Metric / European Engineering';
const DEFAULT_UNIT_STANDARD = UNIT_STANDARD_METRIC;
const UNIT_STANDARD_OPTIONS = [
    UNIT_STANDARD_METRIC,
    UNIT_STANDARD_SI,
    UNIT_STANDARD_US
];

const QUANTITY_REGISTRY = {
    pressure: { baseUnit: 'bar', family: 'pressure' },
    pressureAbs: { baseUnit: 'bar a', family: 'pressure' },
    pressureGauge: { baseUnit: 'bar g', family: 'pressure' },
    pressureDelta: { baseUnit: 'bar', family: 'pressure' },
    temperature: { baseUnit: 'deg C', family: 'temperature' },
    density: { baseUnit: 'kg/m3', family: 'density' },
    dynamicViscosity: { baseUnit: 'cP', family: 'dynamicViscosity' },
    kinematicViscosity: { baseUnit: 'cSt', family: 'kinematicViscosity' },
    specificHeat: { baseUnit: 'kJ/kg.K', family: 'specificHeat' },
    bulkModulus: { baseUnit: 'GPa', family: 'bulkModulus' },
    specificVolume: { baseUnit: 'm3/kg', family: 'specificVolume' },
    specificWeight: { baseUnit: 'N/m3', family: 'specificWeight' },
    speed: { baseUnit: 'm/s', family: 'speed' },
    head: { baseUnit: 'm', family: 'length' },
    length: { baseUnit: 'm', family: 'length' },
    diameter: { baseUnit: 'm', family: 'diameter' },
    roughness: { baseUnit: 'm', family: 'roughness' },
    flow: { baseUnit: 'm3/h', family: 'flow' },
    massFlow: { baseUnit: 'kg/h', family: 'massFlow' },
    power: { baseUnit: 'kW', family: 'power' },
    volume: { baseUnit: 'm3', family: 'volume' },
    percent: { baseUnit: '%', family: 'dimensionless' },
    dimensionless: { baseUnit: '', family: 'dimensionless' }
};

const UNIT_PROFILES = {
    [UNIT_STANDARD_METRIC]: {
        label: UNIT_STANDARD_METRIC,
        pressure: 'bar',
        pressureAbs: 'bar a',
        pressureGauge: 'bar g',
        pressureDelta: 'bar',
        temperature: 'deg C',
        density: 'kg/m3',
        dynamicViscosity: 'cP',
        kinematicViscosity: 'cSt',
        specificHeat: 'kJ/kg.K',
        bulkModulus: 'GPa',
        specificVolume: 'm3/kg',
        specificWeight: 'N/m3',
        speed: 'm/s',
        head: 'm',
        length: 'm',
        diameter: 'mm',
        roughness: 'mm',
        flow: 'm3/h',
        massFlow: 'kg/h',
        power: 'kW',
        volume: 'm3',
        pipeSizeBasis: 'DN/NPS'
    },
    [UNIT_STANDARD_SI]: {
        label: UNIT_STANDARD_SI,
        pressure: 'kPa',
        pressureAbs: 'kPa a',
        pressureGauge: 'kPa g',
        pressureDelta: 'kPa',
        temperature: 'deg C',
        density: 'kg/m3',
        dynamicViscosity: 'cP',
        kinematicViscosity: 'cSt',
        specificHeat: 'J/kg.K',
        bulkModulus: 'MPa',
        specificVolume: 'm3/kg',
        specificWeight: 'N/m3',
        speed: 'm/s',
        head: 'm',
        length: 'm',
        diameter: 'm',
        roughness: 'm',
        flow: 'm3/s',
        massFlow: 'kg/s',
        power: 'kW',
        volume: 'm3',
        pipeSizeBasis: 'DN'
    },
    [UNIT_STANDARD_US]: {
        label: UNIT_STANDARD_US,
        pressure: 'psi',
        pressureAbs: 'psia',
        pressureGauge: 'psig',
        pressureDelta: 'psi',
        temperature: 'deg F',
        density: 'lb/ft3',
        dynamicViscosity: 'cP',
        kinematicViscosity: 'cSt',
        specificHeat: 'Btu/lb.F',
        bulkModulus: 'psi',
        specificVolume: 'ft3/lb',
        specificWeight: 'lbf/ft3',
        speed: 'ft/s',
        head: 'ft',
        length: 'ft',
        diameter: 'in',
        roughness: 'in',
        flow: 'gpm',
        massFlow: 'lb/h',
        power: 'hp',
        volume: 'ft3',
        pipeSizeBasis: 'NPS'
    }
};

function createDefaultSimulationSettings(overrides = {}) {
    return {
        type: 'settings',
        name: 'Simulation Settings',
        props: {
            unitStandard: DEFAULT_UNIT_STANDARD,
            basisConfirmed: false,
            basisDirty: false,
            lastConfirmedFluid: '',
            lastConfirmedTemperature: null,
            lastConfirmedUnitStandard: DEFAULT_UNIT_STANDARD,
            migratedFromLegacy: false,
            ...overrides
        }
    };
}

function ensureSimulationSettings(modelArg) {
    const model = modelArg || (typeof globalModel !== 'undefined' ? globalModel : null);
    if (!model) return createDefaultSimulationSettings();

    if (!model.SETTINGS || model.SETTINGS.type !== 'settings') {
        model.SETTINGS = createDefaultSimulationSettings();
    }
    if (!model.SETTINGS.props) model.SETTINGS.props = {};

    const defaults = createDefaultSimulationSettings().props;
    Object.keys(defaults).forEach(key => {
        if (model.SETTINGS.props[key] === undefined) {
            model.SETTINGS.props[key] = defaults[key];
        }
    });
    if (!UNIT_STANDARD_OPTIONS.includes(model.SETTINGS.props.unitStandard)) {
        model.SETTINGS.props.unitStandard = DEFAULT_UNIT_STANDARD;
    }
    if (!UNIT_STANDARD_OPTIONS.includes(model.SETTINGS.props.lastConfirmedUnitStandard)) {
        model.SETTINGS.props.lastConfirmedUnitStandard = model.SETTINGS.props.unitStandard;
    }
    return model.SETTINGS;
}

function getSimulationSettings() {
    return ensureSimulationSettings()?.props || createDefaultSimulationSettings().props;
}

function getUnitStandard() {
    return getSimulationSettings().unitStandard || DEFAULT_UNIT_STANDARD;
}

function getUnitProfile(standard = getUnitStandard()) {
    return UNIT_PROFILES[standard] || UNIT_PROFILES[DEFAULT_UNIT_STANDARD];
}

function setUnitStandard(standard, options = {}) {
    if (!UNIT_STANDARD_OPTIONS.includes(standard)) return;
    const settings = ensureSimulationSettings();
    settings.props.unitStandard = standard;
    if (options.markDirty !== false && settings.props.basisConfirmed) {
        settings.props.basisDirty = true;
    }
    if (typeof refreshUnitStandardDependentUi === 'function') {
        refreshUnitStandardDependentUi();
    } else if (typeof updateBasisStatusPill === 'function') {
        updateBasisStatusPill();
    }
}

function hasModelEquipment(modelArg) {
    const model = modelArg || (typeof globalModel !== 'undefined' ? globalModel : null);
    if (!model) return false;
    return Object.keys(model).some(key => {
        if (key === 'FLUID' || key === 'SETTINGS') return false;
        const type = model[key]?.type;
        return !!type && type !== 'settings' && type !== 'fluid';
    });
}

function isBasisConfirmed() {
    const settings = getSimulationSettings();
    return !!settings.basisConfirmed && !settings.basisDirty;
}

function markBasisDirty(reason = '') {
    const settings = ensureSimulationSettings();
    if (!settings?.props) return;
    if (settings.props.basisConfirmed) {
        settings.props.basisDirty = true;
        settings.props.dirtyReason = reason || 'Fluid basis or unit standard changed after confirmation.';
    }
    if (typeof updateBasisStatusPill === 'function') updateBasisStatusPill();
}

function confirmBasisSetup() {
    const settings = ensureSimulationSettings();
    const fluid = typeof globalModel !== 'undefined' ? globalModel.FLUID?.props : null;
    settings.props.basisConfirmed = true;
    settings.props.basisDirty = false;
    settings.props.dirtyReason = '';
    settings.props.lastConfirmedFluid = fluid?.fluidName || '';
    settings.props.lastConfirmedTemperature = Number.isFinite(parseFloat(fluid?.temp)) ? parseFloat(fluid.temp) : null;
    settings.props.lastConfirmedUnitStandard = settings.props.unitStandard || DEFAULT_UNIT_STANDARD;
    if (typeof updateBasisStatusPill === 'function') updateBasisStatusPill();
}

function getDisplayUnit(quantity, options = {}) {
    if (!quantity) return options.unit || '';
    const profile = getUnitProfile(options.unitStandard);
    if (quantity === 'pressure') {
        if (options.pressureBasis === 'absolute') return profile.pressureAbs;
        if (options.pressureBasis === 'gauge') return profile.pressureGauge;
        if (options.pressureBasis === 'delta') return profile.pressureDelta;
    }
    return profile[quantity] || options.unit || QUANTITY_REGISTRY[quantity]?.baseUnit || '';
}

function convertPressureToDisplay(value, quantity, profile) {
    if (!Number.isFinite(value)) return value;
    const target = quantity === 'pressureAbs'
        ? profile.pressureAbs
        : quantity === 'pressureGauge'
            ? profile.pressureGauge
            : quantity === 'pressureDelta'
                ? profile.pressureDelta
                : profile.pressure;
    if (target.includes('kPa')) return value * 100;
    if (target.includes('psi')) return value * 14.503773773;
    return value;
}

function convertPressureFromDisplay(value, quantity, profile) {
    if (!Number.isFinite(value)) return value;
    const target = quantity === 'pressureAbs'
        ? profile.pressureAbs
        : quantity === 'pressureGauge'
            ? profile.pressureGauge
            : quantity === 'pressureDelta'
                ? profile.pressureDelta
                : profile.pressure;
    if (target.includes('kPa')) return value / 100;
    if (target.includes('psi')) return value / 14.503773773;
    return value;
}

function convertToDisplay(value, quantity, options = {}) {
    const numeric = parseFloat(value);
    if (!Number.isFinite(numeric) || !quantity) return value;
    const profile = getUnitProfile(options.unitStandard);
    switch (quantity) {
        case 'pressure':
        case 'pressureAbs':
        case 'pressureGauge':
        case 'pressureDelta':
            return convertPressureToDisplay(numeric, quantity, profile);
        case 'temperature':
            return profile.temperature === 'deg F' ? (numeric * 9 / 5) + 32 : numeric;
        case 'density':
            return profile.density === 'lb/ft3' ? numeric * 0.0624279606 : numeric;
        case 'specificHeat':
            if (profile.specificHeat === 'J/kg.K') return numeric * 1000;
            if (profile.specificHeat === 'Btu/lb.F') return numeric * 0.2388458966;
            return numeric;
        case 'bulkModulus':
            if (profile.bulkModulus === 'MPa') return numeric * 1000;
            if (profile.bulkModulus === 'psi') return numeric * 145037.7377;
            return numeric;
        case 'specificVolume':
            return profile.specificVolume === 'ft3/lb' ? numeric * 16.01846337 : numeric;
        case 'specificWeight':
            return profile.specificWeight === 'lbf/ft3' ? numeric * 0.00636588015 : numeric;
        case 'speed':
            return profile.speed === 'ft/s' ? numeric * 3.280839895 : numeric;
        case 'head':
        case 'length':
            return profile[quantity] === 'ft' ? numeric * 3.280839895 : numeric;
        case 'diameter':
            if (profile.diameter === 'mm') return numeric * 1000;
            if (profile.diameter === 'in') return numeric * 39.37007874;
            return numeric;
        case 'roughness':
            if (profile.roughness === 'mm') return numeric * 1000;
            if (profile.roughness === 'in') return numeric * 39.37007874;
            return numeric;
        case 'flow':
            if (profile.flow === 'm3/s') return numeric / 3600;
            if (profile.flow === 'gpm') return numeric * 4.402867539;
            return numeric;
        case 'massFlow':
            if (profile.massFlow === 'kg/s') return numeric / 3600;
            if (profile.massFlow === 'lb/h') return numeric * 2.204622622;
            return numeric;
        case 'power':
            return profile.power === 'hp' ? numeric * 1.34102209 : numeric;
        case 'volume':
            return profile.volume === 'ft3' ? numeric * 35.31466672 : numeric;
        default:
            return numeric;
    }
}

function convertFromDisplay(value, quantity, options = {}) {
    const numeric = parseFloat(value);
    if (!Number.isFinite(numeric) || !quantity) return value;
    const profile = getUnitProfile(options.unitStandard);
    switch (quantity) {
        case 'pressure':
        case 'pressureAbs':
        case 'pressureGauge':
        case 'pressureDelta':
            return convertPressureFromDisplay(numeric, quantity, profile);
        case 'temperature':
            return profile.temperature === 'deg F' ? (numeric - 32) * 5 / 9 : numeric;
        case 'density':
            return profile.density === 'lb/ft3' ? numeric / 0.0624279606 : numeric;
        case 'specificHeat':
            if (profile.specificHeat === 'J/kg.K') return numeric / 1000;
            if (profile.specificHeat === 'Btu/lb.F') return numeric / 0.2388458966;
            return numeric;
        case 'bulkModulus':
            if (profile.bulkModulus === 'MPa') return numeric / 1000;
            if (profile.bulkModulus === 'psi') return numeric / 145037.7377;
            return numeric;
        case 'specificVolume':
            return profile.specificVolume === 'ft3/lb' ? numeric / 16.01846337 : numeric;
        case 'specificWeight':
            return profile.specificWeight === 'lbf/ft3' ? numeric / 0.00636588015 : numeric;
        case 'speed':
            return profile.speed === 'ft/s' ? numeric / 3.280839895 : numeric;
        case 'head':
        case 'length':
            return profile[quantity] === 'ft' ? numeric / 3.280839895 : numeric;
        case 'diameter':
            if (profile.diameter === 'mm') return numeric / 1000;
            if (profile.diameter === 'in') return numeric / 39.37007874;
            return numeric;
        case 'roughness':
            if (profile.roughness === 'mm') return numeric / 1000;
            if (profile.roughness === 'in') return numeric / 39.37007874;
            return numeric;
        case 'flow':
            if (profile.flow === 'm3/s') return numeric * 3600;
            if (profile.flow === 'gpm') return numeric / 4.402867539;
            return numeric;
        case 'massFlow':
            if (profile.massFlow === 'kg/s') return numeric * 3600;
            if (profile.massFlow === 'lb/h') return numeric / 2.204622622;
            return numeric;
        case 'power':
            return profile.power === 'hp' ? numeric / 1.34102209 : numeric;
        case 'volume':
            return profile.volume === 'ft3' ? numeric / 35.31466672 : numeric;
        default:
            return numeric;
    }
}

function inferPressureQuantity(key = '', label = '', unit = '') {
    const joined = `${key} ${label} ${unit}`.toLowerCase();
    if (joined.includes('bar g') || joined.includes('gauge') || joined.includes('psig')) return 'pressureGauge';
    if (joined.includes('bar a') || joined.includes('absolute') || joined.includes('psia')) return 'pressureAbs';
    if (
        joined.includes('drop')
        || joined.includes('loss')
        || joined.includes('residual')
        || joined.includes('margin')
        || joined.includes('differential')
    ) return 'pressureDelta';
    return 'pressure';
}

function inferQuantityFromProperty(nodeType = '', key = '', label = '', unit = '') {
    const k = String(key || '').toLowerCase();
    const text = `${key} ${label} ${unit}`.toLowerCase();
    const normalizedUnit = String(unit || '').toLowerCase().replace(/\s+/g, '');

    if (!text.trim()) return null;
    if (normalizedUnit === '%' || text.includes('percent') || k.includes('percent') || k.includes('efficiency')) return 'percent';
    if (
        text.includes('pressure head')
        || text.includes('pressure drop head')
        || k.includes('pressurehead')
        || (text.includes('head') && (normalizedUnit === 'm' || normalizedUnit === 'ft'))
    ) return 'head';
    if (text.includes('pressure') || normalizedUnit.includes('bar') || normalizedUnit.includes('psi') || normalizedUnit.includes('kpa')) return inferPressureQuantity(key, label, unit);
    if (text.includes('temperature') || text.includes('temp') || normalizedUnit.includes('degc') || normalizedUnit.includes('degf')) return 'temperature';
    if (text.includes('density') || normalizedUnit === 'kg/m3' || normalizedUnit === 'lb/ft3') return 'density';
    if (text.includes('dynamic viscosity') || normalizedUnit === 'cp') return 'dynamicViscosity';
    if (text.includes('kinematic') || k === 'viscosity' || normalizedUnit === 'cst') return 'kinematicViscosity';
    if (text.includes('specific heat') || normalizedUnit.includes('kj/kg') || normalizedUnit.includes('j/kg') || normalizedUnit.includes('btu/lb')) return 'specificHeat';
    if (text.includes('bulk modulus') || k.includes('bulkmodulus')) return 'bulkModulus';
    if (text.includes('specific volume') || k.includes('specvolume')) return 'specificVolume';
    if (text.includes('specific weight') || k.includes('specweight')) return 'specificWeight';
    if (text.includes('speed of sound') || k.includes('speedofsound') || normalizedUnit === 'm/s' || normalizedUnit === 'ft/s') return 'speed';
    if (text.includes('flow') || normalizedUnit === 'm3/h' || normalizedUnit === 'm3/s' || normalizedUnit === 'gpm') {
        return text.includes('mass') || k.includes('massflow') || normalizedUnit.includes('kg/h') || normalizedUnit.includes('lb/h') ? 'massFlow' : 'flow';
    }
    if (text.includes('mass flow') || normalizedUnit === 'kg/h' || normalizedUnit === 'kg/s' || normalizedUnit === 'lb/h') return 'massFlow';
    if (text.includes('power') || normalizedUnit === 'kw' || normalizedUnit === 'hp') return 'power';
    if (text.includes('diameter') || k === 'diameter') return 'diameter';
    if (text.includes('roughness') || k === 'roughness') return 'roughness';
    if (text.includes('volume') || normalizedUnit === 'm3' || normalizedUnit === 'ft3') return 'volume';
    if (
        text.includes('head')
        || text.includes('elevation')
        || text.includes('level')
        || text.includes('height')
        || k.includes('npsh')
        || normalizedUnit === 'm'
        || normalizedUnit === 'ft'
    ) return 'head';
    if (text.includes('length') || k === 'length') return 'length';
    return null;
}

function getDisplayFieldMeta(nodeType, key, label, unit) {
    const quantity = inferQuantityFromProperty(nodeType, key, label, unit);
    if (!quantity || quantity === 'percent' || quantity === 'dimensionless') {
        return { quantity, unit: unit || '', pressureBasis: '' };
    }
    const pressureBasis = quantity === 'pressureAbs'
        ? 'absolute'
        : quantity === 'pressureGauge'
            ? 'gauge'
            : quantity === 'pressureDelta'
                ? 'delta'
                : '';
    return {
        quantity,
        unit: getDisplayUnit(quantity, { pressureBasis }),
        pressureBasis
    };
}

function getDisplayValueWithUnit(value, nodeType, key, label, unit) {
    const meta = getDisplayFieldMeta(nodeType, key, label, unit);
    const displayValue = meta.quantity ? convertToDisplay(value, meta.quantity) : value;
    return { ...meta, value: displayValue };
}

function getInternalValueFromDisplay(value, nodeType, key, label, unit) {
    const meta = getDisplayFieldMeta(nodeType, key, label, unit);
    return meta.quantity ? convertFromDisplay(value, meta.quantity) : value;
}

function formatDisplayNumber(value, digits = 3) {
    const numeric = parseFloat(value);
    if (!Number.isFinite(numeric)) return value === null || value === undefined || value === '' ? '-' : String(value);
    const abs = Math.abs(numeric);
    if (abs > 0 && abs < 0.000001) return numeric.toExponential(4);
    if (abs > 0 && abs < 0.001) return numeric.toExponential(6);
    return numeric.toFixed(digits);
}

function formatDisplayUnitValue(value, nodeType, key, label, unit, digits = 3) {
    const display = getDisplayValueWithUnit(value, nodeType, key, label, unit);
    const formatted = formatDisplayNumber(display.value, digits);
    return formatted === '-' || !display.unit ? formatted : `${formatted} ${display.unit}`;
}

function formatDisplayUnitValueByUnit(value, unit = '', digits = 3, key = '', label = '') {
    return formatDisplayUnitValue(value, '', key, label, unit, digits);
}

function updateBasisStatusPill() {
    if (typeof document === 'undefined') return;
    const settings = getSimulationSettings();
    const fluid = typeof globalModel !== 'undefined' ? globalModel.FLUID?.props : null;
    const pill = document.getElementById('basisStatusPill');
    const fluidEl = document.getElementById('basisStatusFluid');
    const unitEl = document.getElementById('basisStatusUnits');
    if (!pill) return;

    const tempText = fluid && Number.isFinite(parseFloat(fluid.temp))
        ? `${formatDisplayUnitValue(fluid.temp, 'fluid', 'temp', 'Temperature', 'deg C', 1)}`
        : '-';
    if (fluidEl) fluidEl.textContent = `${fluid?.fluidName || 'Fluid'} @ ${tempText}`;
    if (unitEl) unitEl.textContent = settings.unitStandard || DEFAULT_UNIT_STANDARD;

    pill.classList.toggle('basis-status-unconfirmed', !settings.basisConfirmed);
    pill.classList.toggle('basis-status-dirty', !!settings.basisDirty);
    pill.classList.toggle('basis-status-confirmed-clean', !!settings.basisConfirmed && !settings.basisDirty);
    pill.title = settings.basisDirty
        ? 'Fluid Basis or Unit Standard changed. Reconfirm before continuing.'
        : 'Open Fluid Basis and Unit Standard setup';
}

function refreshUnitStandardDependentUi() {
    if (typeof updateBasisStatusPill === 'function') updateBasisStatusPill();
    if (typeof updateAllInstrumentReadouts === 'function') updateAllInstrumentReadouts();
    if (typeof updateAllValveReadouts === 'function') updateAllValveReadouts();
    if (typeof updateAllValveCalculationTraceReadouts === 'function') updateAllValveCalculationTraceReadouts();
    if (typeof updateAllHeatExchangerReadouts === 'function') updateAllHeatExchangerReadouts();
    if (typeof updateAllHeatExchangerCalculationTraceReadouts === 'function') updateAllHeatExchangerCalculationTraceReadouts();
    if (typeof updateAllSeparatorReadouts === 'function') updateAllSeparatorReadouts();
    if (typeof updateAllSeparatorCalculationTraceReadouts === 'function') updateAllSeparatorCalculationTraceReadouts();
    if (typeof activeChartPumpId !== 'undefined' && activeChartPumpId && typeof updatePumpChart === 'function') {
        updatePumpChart(activeChartPumpId);
    }
    if (typeof currentSelectedNode !== 'undefined' && currentSelectedNode && typeof renderSidebar === 'function') {
        renderSidebar(currentSelectedNode);
    }
}
