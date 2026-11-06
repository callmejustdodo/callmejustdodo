const fs = require('node:fs');
const path = require('node:path');

const REPOSITORY = 'https://github.com/callmejustdodo/skills';
const RAW = 'https://raw.githubusercontent.com/callmejustdodo/skills';
const TREE = 'https://api.github.com/repos/callmejustdodo/skills/git/trees/main?recursive=1';

function parseSkills(markdown) {
  const section = markdown.match(/^## Skills\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m)?.[1] || '';
  const skills = [...section.matchAll(/^\|\s*\[`([^`]+)`\]\(\.\/([a-z0-9-]+)\)\s*\|\s*(.+?)\s*\|\s*$/gm)]
    .map(([, name, slug, description]) => ({ name, slug, description: description.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') }));
  if (!skills.length || new Set(skills.map(skill => skill.slug)).size !== skills.length) {
    throw new Error('The repository Skills table is empty or contains duplicate entries.');
  }
  return skills;
}

function skillDescription(markdown) {
  const frontmatter = markdown.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---(?:\n|$)/)?.[1];
  const match = frontmatter?.match(/^description:[ \t]*(.*)((?:\n[ \t]+[^\n]*)*)/m);
  if (!match) throw new Error('SKILL.md is missing its description.');
  let value = [match[1], match[2]].join(' ').trim();
  if (/^[>|][-+]?/.test(value)) value = value.replace(/^[>|][-+]?/, '').trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    value = JSON.parse(value.replace(/\n\s*/g, ' '));
  } else if (value.startsWith("'") && value.endsWith("'")) {
    value = value.slice(1, -1).replace(/''/g, "'");
  }
  value = value.replace(/\s+/g, ' ').trim();
  if (!value) throw new Error('SKILL.md has an empty description.');
  return value;
}

async function fetchCatalog(fetchImpl = fetch) {
  async function get(url) {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'callmejustdodo-skills-site' } });
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    return response;
  }
  const tree = await (await get(TREE)).json();
  if (tree.truncated || !Array.isArray(tree.tree) || !/^[a-f0-9]{40}$/.test(tree.sha)) throw new Error('Incomplete GitHub skill tree.');
  const slugs = tree.tree.filter(item => item.type === 'blob' && /^[a-z0-9-]+\/SKILL\.md$/.test(item.path))
    .map(item => item.path.split('/')[0]).sort();
  let descriptions = [];
  // README summaries are optional; a new SKILL.md is sufficient for discovery.
  try { descriptions = parseSkills(await (await get(`${RAW}/${tree.sha}/README.md`)).text()); } catch {}
  return Promise.all(slugs.map(async slug => ({
    name: slug, slug,
    description: descriptions.find(skill => skill.slug === slug)?.description ||
      skillDescription(await (await get(`${RAW}/${tree.sha}/${slug}/SKILL.md`)).text()),
  })));
}

async function syncSkills(destination = path.join(__dirname, '..', 'skills.json'), fetchImpl = fetch) {
  try {
    const skills = await fetchCatalog(fetchImpl);
    const temporary = `${destination}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(skills, null, 2)}\n`);
    fs.renameSync(temporary, destination);
    console.log(`Synced ${skills.length} skills from callmejustdodo/skills.`);
    return skills;
  } catch (error) {
    if (!fs.existsSync(destination)) throw error;
    console.warn(`Skills sync unavailable; using the saved catalog. ${error.message}`);
    return JSON.parse(fs.readFileSync(destination, 'utf8'));
  }
}

if (require.main === module) syncSkills().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { REPOSITORY, parseSkills, skillDescription, fetchCatalog, syncSkills };
