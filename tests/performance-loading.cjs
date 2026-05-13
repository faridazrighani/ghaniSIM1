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
const sourceMapPath = path.join(projectRoot, 'app.bundle.min.js.map');
const minifiedStyles = fs.readFileSync(minifiedStylesPath, 'utf8');
const minifiedBundle = fs.readFileSync(minifiedBundlePath, 'utf8');
const sourceMap = JSON.parse(fs.readFileSync(sourceMapPath, 'utf8'));

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
assert(indexHtml.includes('<style>') && indexHtml.includes('.main-workspace{display:flex;flex:1'), 'Critical above-the-fold layout CSS should be inlined to stabilize first paint');
assert(indexHtml.includes('.full-editor-modal{display:none}'), 'Critical CSS should hide the pump chart modal before the async stylesheet loads');
assert(indexHtml.includes('<link rel="preload" href="style.min.css" as="style">'), 'Production page should preload the full stylesheet without making it render-blocking');
assert(indexHtml.includes('<link rel="stylesheet" href="style.min.css" media="print" onload="this.media=\'all\'">'), 'Production page should load the full stylesheet asynchronously');
assert(indexHtml.includes('<noscript><link rel="stylesheet" href="style.min.css"></noscript>'), 'Production page should keep a no-JavaScript stylesheet fallback');
assert(!indexHtml.includes('<link rel="stylesheet" href="style.css">'), 'Production page should not load the unminified CSS source');
assert(indexHtml.includes('<div class="toolbar-palette" id="toolbarPalette">'), 'Toolbar palette should have static first-paint content to avoid hydration CLS');
assert(indexHtml.includes('aria-label="Add Pump"') && indexHtml.includes('aria-label="Add LIC"'), 'Static toolbar shell should cover the visible toolbar buttons');
assert(indexHtml.includes('<script defer src="app.bundle.min.js"></script>'), 'Production page should load the deferred minified application bundle');
assert(!indexHtml.includes('<script src='), 'Application scripts should use defer so they do not block initial rendering');
assert((indexHtml.match(/<script defer src=/g) || []).length === 1, 'Production page should load one deferred application bundle');
assert(!indexHtml.includes('<script defer src="formulas/'), 'Production page should not load source JavaScript files directly');
assert(minifiedStyles.length < styles.length, 'Minified CSS should be smaller than the source stylesheet');
assert(minifiedBundle.length > 0, 'Minified application bundle should exist');
assert(minifiedBundle.includes('openFluidBasisTaskWindow'), 'Minified bundle should preserve global application entry points');
assert(minifiedBundle.includes('//# sourceMappingURL=app.bundle.min.js.map'), 'Minified bundle should reference its source map');
assert(sourceMap.version === 3, 'Application bundle source map should use source map version 3');
assert(sourceMap.file === 'app.bundle.min.js', 'Application bundle source map should identify the generated file');
assert(Array.isArray(sourceMap.sources) && sourceMap.sources.length >= 30, 'Application bundle source map should include original source files');
assert(Array.isArray(sourceMap.sourcesContent) && sourceMap.sourcesContent.length === sourceMap.sources.length, 'Application bundle source map should include source contents for production debugging');
assert(typeof sourceMap.mappings === 'string' && sourceMap.mappings.length > 0, 'Application bundle source map should include generated mappings');
assert(appJs.includes('basisConfirmedAtStartup'), 'Startup should decide initial Fluid Basis visibility before non-critical work');
assert(appJs.includes('requestAnimationFrame(() => window.setTimeout(() => {'), 'Non-critical startup work should be deferred until after first paint');

console.log(JSON.stringify({
    passed: true,
    chartJsLazyLoaded: true,
    clsReservedToolbarHeight: true,
    initialLcpNoticeStatic: true,
    staticToolbarShell: true,
    cleanInitialCanvas: true,
    asyncStylesheet: true,
    deferredApplicationScripts: true,
    minifiedProductionAssets: true,
    applicationBundleSourceMap: true
}, null, 2));
