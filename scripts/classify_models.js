const fs = require('fs');
const path = require('path');

const projectRoot = '/Users/admin/Downloads/billu by brewwlabs/pos-backend-multitenant-issues-resolved-updatd-code-21-march-2026';
const modelsDir = path.join(projectRoot, 'models');
const cpModelsDir = path.join(projectRoot, 'control_plane_models');

function getModels(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => f.endsWith('.js') && f !== 'index.js' && f !== 'associations.js')
        .map(f => f.replace('Model.js', '').replace('model.js', '').replace('.js', ''))
        .map(s => s.charAt(0).toUpperCase() + s.slice(1));
}

const tenantCandidates = getModels(modelsDir);
const controlCandidates = getModels(cpModelsDir);

console.log('--- Classification Proposal ---');
console.log('TENANT_CANDIDATES:', JSON.stringify(tenantCandidates, null, 2));
console.log('CONTROL_CANDIDATES:', JSON.stringify(controlCandidates, null, 2));

// Identify overlaps
const overlaps = tenantCandidates.filter(m => controlCandidates.includes(m));
console.log('OVERLAPS:', JSON.stringify(overlaps, null, 2));

// Build definitive list for constants.js
const definitiveControl = [
    ...controlCandidates,
    'User', // User is currently in models/ but should be control plane
    'Auth', // Special case
].sort();

console.log('\n--- Definitive CONTROL_MODELS ---');
console.log(JSON.stringify([...new Set(definitiveControl)], null, 2));
