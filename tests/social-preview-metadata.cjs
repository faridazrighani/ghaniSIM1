const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const previewImagePath = path.join(
    projectRoot,
    'png',
    'NPSH-Based-Cavitation-Analysis-for-Centrifugal-Pump-Systems.png'
);
const previewImageUrl = 'https://faridazrighani.github.io/ghaniSIM1/png/NPSH-Based-Cavitation-Analysis-for-Centrifugal-Pump-Systems.png';
const pageUrl = 'https://faridazrighani.github.io/ghaniSIM1/';

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function includesTag(fragment, message) {
    assert(html.includes(fragment), message);
}

assert(fs.existsSync(previewImagePath), 'Social preview image file should exist in png/');
includesTag(`<link rel="canonical" href="${pageUrl}">`, 'Page should expose a canonical public GitHub Pages URL');
includesTag('<meta property="og:type" content="website">', 'Open Graph type should be set');
includesTag('<meta property="og:site_name" content="GhaniSIM1">', 'Open Graph site name should be set');
includesTag('<meta property="og:title" content="NPSH-Based Cavitation Analysis for Centrifugal Pump Systems">', 'Open Graph title should be set');
includesTag(`<meta property="og:url" content="${pageUrl}">`, 'Open Graph URL should use the public page URL');
includesTag(`<meta property="og:image" content="${previewImageUrl}">`, 'Open Graph image should use an absolute public image URL');
includesTag(`<meta property="og:image:secure_url" content="${previewImageUrl}">`, 'Open Graph secure image URL should be available for social crawlers');
includesTag('<meta property="og:image:type" content="image/png">', 'Open Graph image MIME type should be declared');
includesTag('<meta property="og:image:alt" content="NPSH-based cavitation analysis preview for centrifugal pump systems">', 'Open Graph image alt text should be set');
includesTag('<meta name="twitter:card" content="summary">', 'Twitter card should match the compact supplied preview image');
includesTag(`<meta name="twitter:image" content="${previewImageUrl}">`, 'Twitter image should use the same public image URL');

console.log(JSON.stringify({
    passed: true,
    canonicalUrl: pageUrl,
    socialPreviewImage: previewImageUrl
}, null, 2));
