const {
  writeFileSync
} = require('node:fs');
function boolean(value) {
  if (value !== 'true' && value !== 'false') throw new Error('Invalid evaluated Boolean');
  return value === 'true';
}
const policies = {};
for (const id of ['admitted', 'unadmitted']) {
  const get = key => process.env[`GAP_${id.toUpperCase()}_${key}`];
  const max = Number(get('MAX'));
  if (!Number.isInteger(max) || max < 1 || !get('CANONICAL') || !get('TOOL')) throw new Error('Invalid evaluated policy');
  policies[id] = {
    canonicalWord: get('CANONICAL'),
    requireVocabularyAdmission: boolean(get('REQUIRES')),
    allowedTool: get('TOOL'),
    translationMaxLength: max,
    admitted: boolean(get('MEMBER'))
  };
}
writeFileSync('compiled.json', JSON.stringify(policies));
