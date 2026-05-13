import vm from 'node:vm';
import { readFileSync, statSync, writeFileSync } from 'node:fs';

const jsSources = [
  'formulas/constants.js',
  'core/unit-system.js',
  'properties/objects/tank-properties.js',
  'properties/objects/pipe-properties.js',
  'properties/objects/pump-properties.js',
  'properties/objects/valve-properties.js',
  'properties/objects/separator-properties.js',
  'properties/objects/heat-exchanger-properties.js',
  'properties/objects/mixer-properties.js',
  'properties/objects/instrument-properties.js',
  'properties/objects/network-node-properties.js',
  'properties/object-properties.js',
  'formulas/fluids/common-fluid-formulas.js',
  'formulas/fluids/water-formulas.js',
  'formulas/fluids/methanol-formulas.js',
  'formulas/fluids/palm-oil-formulas.js',
  'formulas/fluids/crude-oil-formulas.js',
  'formulas/objects/pump-formulas.js',
  'formulas/objects/pipe-formulas.js',
  'formulas/objects/tank-formulas.js',
  'formulas/objects/valve-formulas.js',
  'formulas/objects/check-valve-formulas.js',
  'formulas/objects/separator-formulas.js',
  'formulas/objects/heat-exchanger-formulas.js',
  'formulas/objects/mixer-formulas.js',
  'formulas/objects/hydraulic-network-formulas.js',
  'formulas/objects/instrument-formulas.js',
  'formulas/objects/network-node-formulas.js',
  'toolbar/toolbar-catalog.js',
  'core/default-state.js',
  'toolbar/menu-bar.js',
  'core/state-manager.js',
  'core/simulation-engine.js',
  'ui/sidebar-properties.js',
  'ui/task-window.js',
  'ui/connections-renderer.js',
  'ui/context-menu.js',
  'ui/canvas-manager.js',
  'ui/form-field-accessibility.js',
  'app.js'
];

const identifierPattern = /[A-Za-z0-9_$]/;
const regexPrefixPattern = /[\(\{\[=,:;!&|?+\-*~%^<>]/;
const regexPrefixWords = new Set([
  'return',
  'throw',
  'case',
  'delete',
  'void',
  'typeof',
  'instanceof',
  'new',
  'in',
  'of',
  'yield',
  'await',
  'else',
  'do'
]);

function isIdentifierChar(value) {
  return identifierPattern.test(value || '');
}

function readPreviousWord(output) {
  const match = output.match(/[A-Za-z_$][A-Za-z0-9_$]*$/);
  return match ? match[0] : '';
}

function canStartRegex(output) {
  const trimmed = output.trimEnd();
  if (!trimmed) return true;
  const previousChar = trimmed.at(-1);
  if (regexPrefixPattern.test(previousChar || '')) return true;
  return regexPrefixWords.has(readPreviousWord(trimmed));
}

function needsSpace(previous, next) {
  if (!previous || !next) return false;
  if (isIdentifierChar(previous) && isIdentifierChar(next)) return true;
  if ((previous === '+' && next === '+') || (previous === '-' && next === '-')) return true;
  if (previous === '/' && next === '/') return true;
  return false;
}

function consumeString(source, index, quote) {
  let output = quote;
  for (let cursor = index + 1; cursor < source.length; cursor += 1) {
    const char = source[cursor];
    output += char;
    if (char === '\\') {
      cursor += 1;
      output += source[cursor] || '';
      continue;
    }
    if (char === quote) {
      return { output, index: cursor };
    }
  }
  return { output, index: source.length - 1 };
}

function consumeTemplate(source, index) {
  let output = '`';
  for (let cursor = index + 1; cursor < source.length; cursor += 1) {
    const char = source[cursor];
    output += char;
    if (char === '\\') {
      cursor += 1;
      output += source[cursor] || '';
      continue;
    }
    if (char === '`') {
      return { output, index: cursor };
    }
  }
  return { output, index: source.length - 1 };
}

function consumeRegex(source, index) {
  let output = '/';
  let inClass = false;
  for (let cursor = index + 1; cursor < source.length; cursor += 1) {
    const char = source[cursor];
    output += char;
    if (char === '\\') {
      cursor += 1;
      output += source[cursor] || '';
      continue;
    }
    if (char === '[') inClass = true;
    if (char === ']') inClass = false;
    if (char === '/' && !inClass) {
      let flagCursor = cursor + 1;
      while (/[A-Za-z]/.test(source[flagCursor] || '')) {
        output += source[flagCursor];
        flagCursor += 1;
      }
      return { output, index: flagCursor - 1 };
    }
  }
  return { output, index: source.length - 1 };
}

function minifyJavaScript(source) {
  let output = '';
  let pendingSpace = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (char === '\'' || char === '"') {
      const consumed = consumeString(source, index, char);
      if (pendingSpace && needsSpace(output.at(-1), char)) output += ' ';
      output += consumed.output;
      index = consumed.index;
      pendingSpace = false;
      continue;
    }

    if (char === '`') {
      const consumed = consumeTemplate(source, index);
      if (pendingSpace && needsSpace(output.at(-1), char)) output += ' ';
      output += consumed.output;
      index = consumed.index;
      pendingSpace = false;
      continue;
    }

    if (char === '/' && next === '/') {
      while (index < source.length && !/[\r\n]/.test(source[index])) index += 1;
      pendingSpace = true;
      continue;
    }

    if (char === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index += 1;
      index += 1;
      pendingSpace = true;
      continue;
    }

    if (char === '/' && canStartRegex(output)) {
      const consumed = consumeRegex(source, index);
      if (pendingSpace && needsSpace(output.at(-1), char)) output += ' ';
      output += consumed.output;
      index = consumed.index;
      pendingSpace = false;
      continue;
    }

    if (/\s/.test(char)) {
      pendingSpace = true;
      continue;
    }

    if (pendingSpace && needsSpace(output.at(-1), char)) output += ' ';
    output += char;
    pendingSpace = false;
  }

  return output.trim();
}

function minifyCss(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>~()])\s*/g, '$1')
    .replace(/;}/g, '}')
    .replace(/\s*!important/g, '!important')
    .trim();
}

function createSourceMapFallback(sourceFiles) {
  return JSON.stringify({
    version: 3,
    file: 'app.bundle.min.js',
    sources: jsSources,
    sourcesContent: jsSources.map((sourcePath) => sourceFiles[sourcePath]),
    names: [],
    mappings: ''
  });
}

async function minifyJavaScriptWithTerser(sourceFiles) {
  const sourceMapResponse = await fetch('https://cdn.jsdelivr.net/npm/source-map@0.7.4/dist/source-map.js');
  if (!sourceMapResponse.ok) {
    throw new Error(`Unable to fetch source-map: HTTP ${sourceMapResponse.status}`);
  }

  const terserResponse = await fetch('https://cdn.jsdelivr.net/npm/terser@5.37.0/dist/bundle.min.js');
  if (!terserResponse.ok) {
    throw new Error(`Unable to fetch Terser: HTTP ${terserResponse.status}`);
  }

  const sandbox = { globalThis: {}, self: {}, window: {} };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.window = sandbox;
  vm.runInNewContext(await sourceMapResponse.text(), sandbox);
  vm.runInNewContext(await terserResponse.text(), sandbox);
  if (!sandbox.Terser?.minify) {
    throw new Error('Terser browser bundle did not expose a minify function');
  }

  const result = await sandbox.Terser.minify(sourceFiles, {
    compress: {
      passes: 2
    },
    mangle: true,
    format: {
      comments: false,
      ascii_only: true
    },
    sourceMap: {
      filename: 'app.bundle.min.js',
      url: 'app.bundle.min.js.map',
      includeSources: true
    }
  });
  if (result.error) throw result.error;
  return {
    code: result.code,
    map: result.map
  };
}

const cssSourceBytes = statSync('style.css').size;
const cssMinified = minifyCss(readFileSync('style.css', 'utf8'));
writeFileSync('style.min.css', `${cssMinified}\n`);

const jsSourceFiles = Object.fromEntries(
  jsSources.map((sourcePath) => [sourcePath, readFileSync(sourcePath, 'utf8')])
);
const jsSource = jsSources.map((sourcePath) => jsSourceFiles[sourcePath]).join('\n;\n');
const jsSourceBytes = jsSources.reduce((total, sourcePath) => total + statSync(sourcePath).size, 0);
let jsMinified;
let jsSourceMap;
let minifier = 'terser';
try {
  const result = await minifyJavaScriptWithTerser(jsSourceFiles);
  jsMinified = result.code;
  jsSourceMap = result.map;
} catch (error) {
  minifier = 'conservative';
  console.warn(`Terser unavailable; using conservative minifier. ${error.message}`);
  jsMinified = `${minifyJavaScript(jsSource)}\n//# sourceMappingURL=app.bundle.min.js.map`;
  jsSourceMap = createSourceMapFallback(jsSourceFiles);
}
writeFileSync('app.bundle.min.js', `${jsMinified}\n`);
writeFileSync('app.bundle.min.js.map', `${jsSourceMap}\n`);

console.log(JSON.stringify({
  built: true,
  css: {
    file: 'style.min.css',
    sourceBytes: cssSourceBytes,
    minifiedBytes: statSync('style.min.css').size
  },
  js: {
    file: 'app.bundle.min.js',
    sourceMap: 'app.bundle.min.js.map',
    minifier,
    sourceBytes: jsSourceBytes,
    minifiedBytes: statSync('app.bundle.min.js').size,
    sourceMapBytes: statSync('app.bundle.min.js.map').size,
    sources: jsSources.length
  }
}, null, 2));
