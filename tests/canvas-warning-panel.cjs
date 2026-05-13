const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const elements = {};

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function createMockElement(overrides = {}) {
    return {
        style: {},
        dataset: {},
        offsetLeft: 0,
        offsetTop: 0,
        offsetWidth: 0,
        offsetHeight: 0,
        clientWidth: 0,
        clientHeight: 0,
        scrollLeft: 0,
        scrollTop: 0,
        addEventListener() {},
        setPointerCapture() {},
        releasePointerCapture() {},
        getBoundingClientRect() {
            return {
                left: 0,
                top: 0,
                width: this.clientWidth || this.offsetWidth || 0,
                height: this.clientHeight || this.offsetHeight || 0
            };
        },
        ...overrides
    };
}

const canvas = createMockElement({
    clientWidth: 800,
    clientHeight: 520,
    scrollLeft: 300,
    scrollTop: 180
});
const panel = createMockElement({
    offsetWidth: 292,
    offsetHeight: 64
});
const header = createMockElement();
const legend = createMockElement({
    offsetHeight: 98
});

elements.canvas = canvas;
elements.canvasWarningPanel = panel;
elements.canvasWarningHeader = header;

const context = {
    console,
    Math,
    Number,
    parseFloat,
    requestAnimationFrame(callback) {
        callback();
        return 1;
    },
    window: {
        getComputedStyle(element) {
            return { display: element === legend && legend.hidden ? 'none' : 'block' };
        },
        addEventListener() {}
    },
    document: {
        getElementById(id) {
            return elements[id] || null;
        },
        querySelector(selector) {
            return selector === '.canvas-status-legend' ? legend : null;
        },
        createElement() {
            return createMockElement({
                className: '',
                textContent: '',
                append() {},
                appendChild() {}
            });
        }
    }
};
context.window.window = context.window;
context.window.document = context.document;
context.globalModel = {};

vm.createContext(context);
vm.runInContext(
    fs.readFileSync(path.join(projectRoot, 'ui/canvas-manager.js'), 'utf8'),
    context,
    { filename: 'ui/canvas-manager.js' }
);

const minClamp = vm.runInContext('clampCanvasWarningPanelPosition(10, 10)', context);
assert(minClamp.left === 312, 'Warning panel left clamp should include canvas scrollLeft');
assert(minClamp.top === 192, 'Warning panel top clamp should include canvas scrollTop');

const maxClamp = vm.runInContext('clampCanvasWarningPanelPosition(1200, 1200)', context);
assert(maxClamp.left === 796, 'Warning panel right clamp should use visible canvas viewport');
assert(maxClamp.top === 624, 'Warning panel bottom clamp should use visible canvas viewport');

vm.runInContext('positionCanvasWarningPanelDefault()', context);
assert(panel.style.left === '796px', 'Default warning panel should align to visible right edge');
assert(panel.style.top === '300px', 'Default warning panel should sit below the visible pump-status legend');
assert(panel.dataset.viewportLeft === '496', 'Default warning panel should remember visible viewport left offset');
assert(panel.dataset.viewportTop === '120', 'Default warning panel should remember visible viewport top offset');
const defaultPosition = {
    left: panel.style.left,
    top: panel.style.top
};

panel.dataset.userMoved = 'true';
panel.dataset.viewportLeft = '240';
panel.dataset.viewportTop = '210';
canvas.scrollLeft = 500;
canvas.scrollTop = 420;
vm.runInContext('keepCanvasWarningPanelInViewport()', context);
assert(panel.style.left === '740px', 'User-moved warning panel should preserve viewport X offset after scroll');
assert(panel.style.top === '630px', 'User-moved warning panel should preserve viewport Y offset after scroll');

const styles = fs.readFileSync(path.join(projectRoot, 'style.css'), 'utf8');
const canvasManagerSource = fs.readFileSync(path.join(projectRoot, 'ui/canvas-manager.js'), 'utf8');
assert(styles.includes('width: min(292px, calc(100% - 24px))'), 'Warning panel should use compact responsive width');
assert(styles.includes('min-width: min(220px, calc(100% - 24px))'), 'Warning panel should keep a readable minimum width');
assert(styles.includes('box-sizing: border-box'), 'Warning panel should include border-box sizing');
assert(styles.includes('top: 126px;'), 'CSS should provide the first-paint warning panel position without JavaScript measurement');
assert(!canvasManagerSource.includes('requestAnimationFrame(positionCanvasWarningPanelDefault)'), 'Warning panel startup should not force a layout measurement after DOM hydration');
assert(!canvasManagerSource.includes('initCanvasWarningPanelWindow();\n    positionCanvasWarningPanelDefault();'), 'Warning panel content updates should not force geometry reads during startup');

console.log(JSON.stringify({
    passed: true,
    minClamp,
    maxClamp,
    defaultPosition,
    preservedViewportOffset: {
        left: panel.dataset.viewportLeft,
        top: panel.dataset.viewportTop
    }
}, null, 2));
