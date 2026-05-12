(function () {
    const FORM_FIELD_SELECTOR = [
        'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"])',
        'select',
        'textarea'
    ].join(',');
    let generatedFieldId = 0;
    let pendingNormalizeFrame = null;

    function normalizeToken(value, fallback = 'field') {
        const normalized = String(value || '')
            .trim()
            .replace(/([a-z])([A-Z])/g, '$1-$2')
            .replace(/[^a-zA-Z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase();
        return normalized || fallback;
    }

    function humanizeToken(value, fallback = 'Form field') {
        const text = String(value || '')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/[-_]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!text) return fallback;
        return text.replace(/\b\w/g, char => char.toUpperCase());
    }

    function textFromElement(element) {
        return String(element?.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function getFieldKey(field) {
        const data = field.dataset || {};
        return data.key
            || data.fluidControl
            || data.field
            || data.quantity
            || data.node
            || field.getAttribute('data-key')
            || field.getAttribute('data-fluid-control')
            || field.getAttribute('data-field')
            || field.getAttribute('name')
            || field.getAttribute('id')
            || field.getAttribute('type')
            || field.tagName.toLowerCase();
    }

    function getTableColumnLabel(field) {
        const cell = field.closest?.('td, th');
        const table = field.closest?.('table');
        if (!cell || !table || !cell.parentElement) return '';

        const columnIndex = Array.prototype.indexOf.call(cell.parentElement.children, cell);
        if (columnIndex < 0) return '';
        const header = table.querySelector(`thead tr th:nth-child(${columnIndex + 1})`);
        return textFromElement(header);
    }

    function getNearbyLabelText(field) {
        const row = field.closest?.('label, tr, .fluid-field-row, .pipe-task-field-row, .tank-task-field-row, .prop-row');
        const scopedLabel = row?.querySelector?.('.fluid-field-label, .prop-label, th, [data-label]');
        const scopedText = textFromElement(scopedLabel);
        if (scopedText) return scopedText;

        const tableLabel = getTableColumnLabel(field);
        if (tableLabel) return tableLabel;

        const label = field.closest?.('label');
        const labelText = textFromElement(label);
        if (labelText) return labelText;

        const previousText = textFromElement(field.previousElementSibling);
        if (previousText) return previousText;

        const title = field.getAttribute('title') || field.getAttribute('placeholder');
        if (title) return title;

        return humanizeToken(getFieldKey(field));
    }

    function ensureFieldIdentity(field) {
        const key = normalizeToken(getFieldKey(field));
        if (!field.name) {
            field.name = key;
        }

        if (field.id) return;
        const base = `form-field-${key}`;
        let candidate = base;
        while (document.getElementById(candidate)) {
            generatedFieldId += 1;
            candidate = `${base}-${generatedFieldId}`;
        }
        field.id = candidate;
    }

    function hasNativeLabel(field) {
        return !!(field.labels && field.labels.length > 0);
    }

    function ensureFieldLabel(field) {
        if (field.hasAttribute('aria-label') || field.hasAttribute('aria-labelledby')) return;

        const labelText = getNearbyLabelText(field);
        if (hasNativeLabel(field)) {
            field.setAttribute('aria-label', labelText);
            return;
        }

        const labelId = `${field.id}-a11y-label`;
        let label = document.getElementById(labelId);
        if (!label) {
            label = document.createElement('label');
            label.id = labelId;
            label.className = 'form-field-a11y-label';
            label.htmlFor = field.id;
            label.textContent = labelText;
            field.parentElement?.insertBefore(label, field);
        }
        field.setAttribute('aria-labelledby', labelId);
    }

    function normalizeFormField(field) {
        if (!field || !field.matches?.(FORM_FIELD_SELECTOR)) return;
        ensureFieldIdentity(field);
        ensureFieldLabel(field);
    }

    function normalizeFormFieldAccessibility(root = document) {
        if (!root) return;
        if (root.matches?.(FORM_FIELD_SELECTOR)) normalizeFormField(root);
        root.querySelectorAll?.(FORM_FIELD_SELECTOR).forEach(normalizeFormField);
    }

    function scheduleNormalize() {
        if (pendingNormalizeFrame !== null) return;
        pendingNormalizeFrame = requestAnimationFrame(() => {
            pendingNormalizeFrame = null;
            normalizeFormFieldAccessibility(document);
        });
    }

    function initFormFieldAccessibility() {
        normalizeFormFieldAccessibility(document);
        if (typeof MutationObserver !== 'function' || !document.body) return;
        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        scheduleNormalize();
                        return;
                    }
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        document.addEventListener('focusin', event => normalizeFormField(event.target), true);
    }

    window.normalizeFormFieldAccessibility = normalizeFormFieldAccessibility;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFormFieldAccessibility, { once: true });
    } else {
        initFormFieldAccessibility();
    }
})();
