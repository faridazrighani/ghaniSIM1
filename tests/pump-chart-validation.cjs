const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const context = { console, Math, Number, parseFloat, JSON };
context.window = context;
vm.createContext(context);

vm.runInContext(`
var globalModel = {
    'P-100': {
        type: 'pump',
        results: {
            pumpCurve: [[0, 18], [50, 16], [100, 12]],
            sysCurve: [[0, 4], [50, null], [100, 108]]
        }
    }
};
var pumpChartInstance = {
    data: {
        labels: ['stale'],
        datasets: [
            { data: [] },
            { data: [] }
        ]
    },
    options: {
        scales: {
            x: { title: { text: '' } },
            y: { title: { text: '' } }
        }
    },
    updateMode: null,
    update(mode) {
        this.updateMode = mode;
    }
};
function getDisplayUnit(quantity) {
    return quantity === 'flow' ? 'm3/h' : 'm';
}
function convertToDisplay(value) {
    return value;
}
`, context, { filename: 'pump-chart-prelude.js' });

vm.runInContext(
    fs.readFileSync(path.join(projectRoot, 'core/simulation-engine.js'), 'utf8'),
    context,
    { filename: 'core/simulation-engine.js' }
);

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

vm.runInContext(`updatePumpChart('P-100')`, context);

const chart = vm.runInContext(`pumpChartInstance`, context);
assert(Array.isArray(chart.data.labels) && chart.data.labels.length === 0, 'Chart labels should not use category axis labels');
assert(chart.data.datasets[0].data[0].x === 0 && chart.data.datasets[0].data[0].y === 18, 'Pump chart should use numeric x/y points');
assert(chart.data.datasets[1].data.length === 2, 'System curve should omit null head points from scaling');
assert(chart.options.scales.x.type === 'linear', 'Flow axis should be linear');
assert(chart.options.scales.x.min === 0, 'Flow axis should start at zero');
assert(chart.options.scales.x.max > 100, 'Flow axis should pad above the largest flow');
assert(chart.options.scales.y.min === 0, 'Head axis should start at zero for positive data');
assert(chart.options.scales.y.max > 108, 'Head axis should pad above the largest head');
assert(chart.updateMode === 'none', 'Chart update should remain non-animated for live edits');

const bounds = vm.runInContext(`calculatePumpChartAxisBounds([[{ x: 3, y: -2 }, { x: 6, y: 4 }]])`, context);
assert(bounds.x.min === 0 && bounds.x.max > 6, 'Axis bounds should pad sparse flow data');
assert(bounds.y.min < 0 && bounds.y.max > 4, 'Axis bounds should include negative head values if present');

console.log(JSON.stringify({
    passed: true,
    pumpPoints: chart.data.datasets[0].data.length,
    systemPoints: chart.data.datasets[1].data.length,
    xMax: Number(chart.options.scales.x.max.toFixed(3)),
    yMax: Number(chart.options.scales.y.max.toFixed(3))
}, null, 2));
