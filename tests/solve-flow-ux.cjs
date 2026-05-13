const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
const canvasManager = fs.readFileSync(path.join(projectRoot, 'ui/canvas-manager.js'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

const solveButtonStart = indexHtml.indexOf('id="btn-solve"');
const solveButtonEnd = solveButtonStart >= 0 ? indexHtml.indexOf('</button>', solveButtonStart) : -1;
const solveButtonMarkup = solveButtonStart >= 0 && solveButtonEnd > solveButtonStart
    ? indexHtml.slice(solveButtonStart, solveButtonEnd)
    : '';

assert(solveButtonMarkup.includes('type="button"'), 'Solve button should be an explicit non-submit button');
assert(solveButtonMarkup.includes('aria-label="Run hydraulic and NPSH evaluation"'), 'Solve button should expose a clear accessible action label');
assert(appJs.includes('function runUserRequestedSolve()'), 'App should expose a single user-requested solve handler');

const solveHandlerStart = appJs.indexOf('function runUserRequestedSolve()');
const domReadyStart = appJs.indexOf("document.addEventListener('DOMContentLoaded'");
const solveHandlerBody = solveHandlerStart >= 0 && domReadyStart > solveHandlerStart
    ? appJs.slice(solveHandlerStart, domReadyStart)
    : '';

assert(solveHandlerBody.includes('updateSimulation'), 'Solve handler should run the hydraulic/NPSH simulation update');
assert(solveHandlerBody.includes('drawConnections'), 'Solve handler should redraw hydraulic connections after solving');
assert(solveHandlerBody.includes('updateAllObjectOperatingStatusVisuals'), 'Solve handler should refresh pump status badges and warnings');
assert(appJs.includes("btnSolve.addEventListener('click', runUserRequestedSolve)"), 'Solve button should call the solve handler on click');

const addEquipmentStart = canvasManager.indexOf('function addEquipment(type, placement = null, options = {})');
const initObjectsStart = canvasManager.indexOf('function initDraggableObjects()', addEquipmentStart);
const addEquipmentBody = addEquipmentStart >= 0 && initObjectsStart > addEquipmentStart
    ? canvasManager.slice(addEquipmentStart, initObjectsStart)
    : '';

assert(addEquipmentBody.includes('minimizeObjectTaskWindowAfterEquipmentAdd(newId)'), 'New object task window should still auto-minimize');
assert(addEquipmentBody.includes('updateSimulation({ renderSidebarAfter: false })'), 'Adding equipment should refresh simulation and warning status without reopening the task window');

console.log(JSON.stringify({
    passed: true,
    solveButtonActive: true,
    objectCreationRefreshesWarnings: true
}, null, 2));
