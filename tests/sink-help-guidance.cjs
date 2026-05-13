const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const taskWindowSource = fs.readFileSync(path.join(projectRoot, 'ui/task-window.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

assert(indexHtml.includes('id="menu-snk-help"'), 'Help menu should expose SNK Boundary Guidance');
assert(taskWindowSource.includes('function createSnkHelpContent()'), 'SNK help content builder should exist');
assert(taskWindowSource.includes('Realtime Canvas Readout Interpretation'), 'SNK help should explain realtime canvas readout');
assert(taskWindowSource.includes('Equation / Dependency Map for Realtime Results'), 'SNK help should expose realtime formula dependency map');
assert(taskWindowSource.includes('Discussion Summary for Thesis Defense'), 'SNK help should include thesis defense discussion notes');
assert(taskWindowSource.includes('P-Pv = Pout,abs - Pv'), 'SNK help should explain outlet pressure margin formula');
assert(taskWindowSource.includes('NPSHm = NPSHA - NPSHR'), 'SNK help should explain pump NPSH margin formula');
assert(taskWindowSource.includes('SNK is not a restriction by itself'), 'SNK help should clarify downstream boundary role');
assert(taskWindowSource.includes('Qdem'), 'SNK help should explain flow demand live readout');
assert(taskWindowSource.includes('Preq'), 'SNK help should explain required pressure live readout');
assert(taskWindowSource.includes('hLd'), 'SNK help should explain discharge loss live readout');
assert(taskWindowSource.includes('not be interpreted as pump NPSHA'), 'SNK help should prevent confusing P-Pv with NPSHA');
assert(!taskWindowSource.includes('createSrcHelpList('), 'SNK help should use the existing fluid help list renderer');

class FakeNode {}

class FakeElement extends FakeNode {
    constructor(tagName) {
        super();
        this.tagName = tagName;
        this.children = [];
        this.className = '';
        this.dataset = {};
        this.style = {};
        this.textContent = '';
        this.open = false;
    }

    append(...nodes) {
        this.children.push(...nodes);
    }

    appendChild(node) {
        this.children.push(node);
        return node;
    }
}

const fakeDocument = {
    createElement(tagName) {
        return new FakeElement(tagName);
    }
};

const rendered = vm.runInNewContext(`${taskWindowSource}\ncreateSnkHelpContent();`, {
    console,
    document: fakeDocument,
    Node: FakeNode,
    window: {
        addEventListener() {},
        setTimeout() {},
        innerWidth: 1280,
        innerHeight: 720
    }
});

assert(rendered instanceof FakeElement, 'SNK help content should render without runtime errors');
assert(rendered.className.includes('snk-help-layout'), 'SNK help content should render the SNK help layout');

console.log(JSON.stringify({
    passed: true,
    snkHelpMenu: true,
    realtimeCanvasGuidance: true,
    equationDependencyMap: true,
    thesisDefenseNotes: true
}, null, 2));
