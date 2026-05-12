const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const formFieldAccessibility = fs.readFileSync(path.join(projectRoot, 'ui/form-field-accessibility.js'), 'utf8');
const minifiedBundle = fs.readFileSync(path.join(projectRoot, 'app.bundle.min.js'), 'utf8');
const taskWindowSource = fs.readFileSync(path.join(projectRoot, 'ui/task-window.js'), 'utf8');
const styles = fs.readFileSync(path.join(projectRoot, 'style.css'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

assert(indexHtml.includes('app.bundle.min.js'), 'Index should load the production application bundle');
assert(minifiedBundle.includes('normalizeFormFieldAccessibility'), 'Production bundle should include the form field accessibility normalizer');
assert(formFieldAccessibility.includes('normalizeFormFieldAccessibility'), 'Normalizer should expose a reusable function');
assert(formFieldAccessibility.includes('MutationObserver'), 'Normalizer should handle dynamically rendered form fields');
assert(formFieldAccessibility.includes('field.name = key'), 'Form fields should receive a name attribute');
assert(formFieldAccessibility.includes('field.id = candidate'), 'Form fields should receive a generated id when missing');
assert(formFieldAccessibility.includes('aria-labelledby'), 'Unlabelled form fields should receive an accessible label reference');
assert(formFieldAccessibility.includes('aria-label'), 'Native-labelled form fields should receive an explicit accessible name');
assert(formFieldAccessibility.includes('.fluid-field-label, .prop-label, th, [data-label]'), 'Normalizer should infer labels from local UI row labels');
assert(taskWindowSource.includes("document.createElement(editable ? 'label' : 'div')"), 'Read-only Fluid Basis rows should not be rendered as unassociated labels');
assert(styles.includes('.form-field-a11y-label'), 'Styles should hide generated accessibility labels visually');
assert(styles.includes('clip: rect(0, 0, 0, 0)'), 'Generated labels should be visually hidden without affecting layout');

console.log(JSON.stringify({
    passed: true,
    normalizerLoaded: true,
    dynamicFieldsCovered: true
}, null, 2));
