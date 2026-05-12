const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const taskWindowSource = fs.readFileSync(path.join(projectRoot, 'ui/task-window.js'), 'utf8');
const styles = fs.readFileSync(path.join(projectRoot, 'style.css'), 'utf8');
const stateManager = fs.readFileSync(path.join(projectRoot, 'core/state-manager.js'), 'utf8');
const menuBar = fs.readFileSync(path.join(projectRoot, 'toolbar/menu-bar.js'), 'utf8');
const canvasManager = fs.readFileSync(path.join(projectRoot, 'ui/canvas-manager.js'), 'utf8');
const connectionsRenderer = fs.readFileSync(path.join(projectRoot, 'ui/connections-renderer.js'), 'utf8');
const selectNodeStart = canvasManager.indexOf('function selectNode(nodeId, element)');
const explicitContextOpenStart = canvasManager.indexOf('function requestUserTaskObjectProperties(nodeId)');
const selectNodeBody = selectNodeStart >= 0 && explicitContextOpenStart > selectNodeStart
    ? canvasManager.slice(selectNodeStart, explicitContextOpenStart)
    : '';

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

assert(taskWindowSource.includes('objectTaskMinimizedEntries'), 'Object properties should maintain a minimized dock entry list');
assert(taskWindowSource.includes('function isObjectPropertiesTaskKind(kind)'), 'Dock should be limited to object property task kinds');
assert(taskWindowSource.includes('function getObjectTaskDockLabel(kind, nodeId)'), 'Dock labels should use compact object tags');
assert(taskWindowSource.includes('node?.name || nodeId'), 'Dock label should use the object name/nodeId instead of the long window title');
assert(taskWindowSource.includes('function renderObjectTaskMinimizedDock()'), 'Dock should render minimized object task items');
assert(taskWindowSource.includes('function restoreObjectTaskDockEntry(kind, nodeId)'), 'Dock item click should restore the selected properties window');
assert(taskWindowSource.includes('function closeObjectTaskDockEntry(kind, nodeId)'), 'Dock item close should dismiss the minimized object task');
assert(taskWindowSource.includes("taskWindow.dataset.nodeId = options.nodeId"), 'Task window should preserve active node id for minimize-to-dock');
assert(taskWindowSource.includes('addObjectTaskDockEntry(activeObjectTask)'), 'Minimize should add the active object task to the dock');
assert(taskWindowSource.includes("taskWindow.hidden = true"), 'Minimize-to-dock should hide the active task window');
assert(taskWindowSource.includes("isObjectTaskDocked('tank', nodeId)"), 'Docked tanks should not reopen from background renders');
assert(taskWindowSource.includes("isObjectTaskDocked('pipe', nodeId)"), 'Docked pipes should not reopen from background renders');
assert(taskWindowSource.includes("isObjectTaskDocked('object', nodeId)"), 'Docked equipment should not reopen from background renders');
assert(taskWindowSource.includes('function clearObjectTaskMinimizedDock()'), 'Dock should have a clear helper for new/open project flows');
assert(styles.includes('.object-task-minimized-dock'), 'Dock should have bottom taskbar styling');
assert(styles.includes('.object-task-dock-restore'), 'Dock restore button should be styled');
assert(styles.includes('overflow-x: auto'), 'Dock should scroll horizontally when many minimized items exist');
assert(stateManager.includes('renderObjectTaskMinimizedDock'), 'Deleting an object should prune stale dock items');
assert(menuBar.includes('clearObjectTaskMinimizedDock'), 'Opening or clearing a simulation should clear minimized dock state');
assert(canvasManager.includes('function requestUserTaskObjectProperties(nodeId)'), 'Context menu should have an explicit user task properties opener');
assert(canvasManager.includes("label: 'User Task Object Properties'"), 'Object context menus should expose User Task Object Properties');
assert(canvasManager.includes('function addUserTaskObjectPropertiesMenuItem(items, nodeId)'), 'Object context menus should share the properties menu item helper');
assert(connectionsRenderer.includes('addUserTaskObjectPropertiesMenuItem(items, pipeId)'), 'Pipe context menus should expose User Task Object Properties');
assert(canvasManager.includes('function getRibbonClickCanvasPlacement(type)'), 'Ribbon clicks should use ordered canvas placement');
assert(canvasManager.includes('ribbonClickPlacementState'), 'Ribbon click placement should remember the next rightward object position');
assert(canvasManager.includes("addEquipment(item.type, null, { placementMode: 'ribbon-click' })"), 'Ribbon click adds should use the rightward placement sequence after basis validation');
assert(canvasManager.includes("options.placementMode === 'ribbon-click'"), 'addEquipment should compute ribbon placement only when equipment creation is allowed');
assert(canvasManager.includes('function minimizeObjectTaskWindowAfterEquipmentAdd(nodeId)'), 'New equipment should minimize its object task window immediately after creation');
assert(canvasManager.includes('minimizeObjectTaskWindowAfterEquipmentAdd(newId)'), 'addEquipment should dock the new object properties task window');
assert(selectNodeBody, 'Expected selectNode to appear before explicit context opener');
assert(!selectNodeBody.includes('requestPipePropertiesTaskWindowOpen(nodeId)'), 'Ordinary node selection should not force-reopen docked pipe task windows');
assert(!selectNodeBody.includes('requestTankPropertiesTaskWindowOpen(nodeId)'), 'Ordinary node selection should not force-reopen docked tank task windows');
assert(!selectNodeBody.includes('requestObjectPropertiesTaskWindowOpen(nodeId)'), 'Ordinary node selection should not force-reopen docked equipment task windows');

console.log(JSON.stringify({
    passed: true,
    dockEntries: true,
    compactLabels: true,
    responsiveDock: true,
    contextMenuOpen: true,
    ribbonAutoDock: true,
    ribbonRightwardPlacement: true
}, null, 2));
