const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
const sidebarProperties = fs.readFileSync(path.join(projectRoot, 'ui/sidebar-properties.js'), 'utf8');
const canvasManager = fs.readFileSync(path.join(projectRoot, 'ui/canvas-manager.js'), 'utf8');
const styles = fs.readFileSync(path.join(projectRoot, 'style.css'), 'utf8');
const minifiedStylesPath = path.join(projectRoot, 'style.min.css');
const minifiedBundlePath = path.join(projectRoot, 'app.bundle.min.js');
const minifiedStyles = fs.readFileSync(minifiedStylesPath, 'utf8');
const minifiedBundle = fs.readFileSync(minifiedBundlePath, 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

assert(!indexHtml.includes('<script src="vendor/chart.umd.min.js"></script>'), 'Chart.js should not load during initial page parsing');
assert(!appJs.includes('initializeChart(); // Pump performance chart modal'), 'Pump chart should not initialize on DOMContentLoaded');
assert(sidebarProperties.includes('function loadChartJsOnDemand()'), 'Expected on-demand Chart.js loader');
assert(sidebarProperties.includes("script.src = 'vendor/chart.umd.min.js'"), 'Expected Chart.js to load from the local vendor file on demand');
assert(sidebarProperties.includes('async function ensurePumpChartReady()'), 'Expected async chart readiness helper');
assert(canvasManager.includes('await ensurePumpChartReady()'), 'Pump chart opening should await the lazy Chart.js loader');
assert(styles.includes('min-height: 74px;'), 'Desktop ribbon should reserve final toolbar height to reduce CLS');
assert(styles.includes('min-height: 59px;'), 'Toolbar palette should reserve icon-group height before JavaScript hydration');
assert(indexHtml.includes('class="academic-logo" src="png/untirta-75.webp" width="56" height="56"'), 'Academic logo should reserve image dimensions');
assert(indexHtml.includes('class="solve-mobile-logo" src="png/untirta-75.webp" width="28" height="28"'), 'Mobile Solve logo should reserve image dimensions');
assert(indexHtml.includes('class="task-window task-window-fluid-active"'), 'Initial Fluid Basis window should be available in static HTML for faster LCP');
assert(indexHtml.includes('Set Fluid Basis and Unit Standard before adding equipment.'), 'LCP Fluid Basis setup notice should not wait for JavaScript rendering');
assert(indexHtml.includes('<link rel="stylesheet" href="style.min.css">'), 'Production page should load minified CSS');
assert(!indexHtml.includes('<link rel="stylesheet" href="style.css">'), 'Production page should not load the unminified CSS source');
assert(indexHtml.includes('<script defer src="app.bundle.min.js"></script>'), 'Production page should load the deferred minified application bundle');
assert(!indexHtml.includes('<script src='), 'Application scripts should use defer so they do not block initial rendering');
assert((indexHtml.match(/<script defer src=/g) || []).length === 1, 'Production page should load one deferred application bundle');
assert(!indexHtml.includes('<script defer src="formulas/'), 'Production page should not load source JavaScript files directly');
assert(minifiedStyles.length < styles.length, 'Minified CSS should be smaller than the source stylesheet');
assert(minifiedBundle.length > 0, 'Minified application bundle should exist');
assert(minifiedBundle.includes('openFluidBasisTaskWindow'), 'Minified bundle should preserve global application entry points');
assert(appJs.includes('basisConfirmedAtStartup'), 'Startup should decide initial Fluid Basis visibility before non-critical work');
assert(appJs.includes('requestAnimationFrame(() => window.setTimeout(() => {'), 'Non-critical startup work should be deferred until after first paint');

console.log(JSON.stringify({
    passed: true,
    chartJsLazyLoaded: true,
    clsReservedToolbarHeight: true,
    initialLcpNoticeStatic: true,
    deferredApplicationScripts: true,
    minifiedProductionAssets: true
}, null, 2));
