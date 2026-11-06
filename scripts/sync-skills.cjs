const fs = require('node:fs');
const path = require('node:path');

const REPOSITORY = 'https://github.com/callmejustdodo/dodo-skills';
const SOURCE = 'https://raw.githubusercontent.com/callmejustdodo/dodo-skills/main/README.md';

function parseSkills(markdown) {
  const section = markdown.match(/^## Skills\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m)?.[1] || '';
  const skills = [...section.matchAll(/^\|\s*\[`([^`]+)`\]\(\.\/([a-z0-9-]+)\)\s*\|\s*(.+?)\s*\|\s*$/gm)]
    .map(([, name, slug, description]) => ({ name, slug, description: description.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') }));
  if (!skills.length || new Set(skills.map(skill => skill.slug)).size !== skills.length) {
    throw new Error('The repository Skills table is empty or contains duplicate entries.');
  }
  return skills;
}

async function syncSkills(destination = path.join(__dirname, '..', 'skills.json'), fetchImpl = fetch) {
  try {
    const response = await fetchImpl(SOURCE, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    const skills = parseSkills(await response.text());
    fs.writeFileSync(destination, `${JSON.stringify(skills, null, 2)}\n`);
    console.log(`Synced ${skills.length} skills from dodo-skills.`);
    return skills;
  } catch (error) {
    if (!fs.existsSync(destination)) throw error;
    console.warn(`Skills sync unavailable; using the saved catalog. ${error.message}`);
    return JSON.parse(fs.readFileSync(destination, 'utf8'));
  }
}

if (require.main === module) syncSkills().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { REPOSITORY, parseSkills, syncSkills };
