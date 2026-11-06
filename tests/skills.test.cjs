const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseSkills, skillDescription, fetchCatalog, syncSkills } = require('../scripts/sync-skills.cjs');
const { build } = require('../scripts/build-blog.cjs');

const markdown = '## Skills\n\n| Skill | Description |\n| [`example`](./example) | Use [a service](https://example.com). |\n\n## Other\n| [`unrelated`](./unrelated) | Not a skill. |';
test('catalog reads only the public Skills table and rejects broken data', () => {
  assert.deepEqual(parseSkills(markdown), [{ name: 'example', slug: 'example', description: 'Use a service.' }]);
  assert.throws(() => parseSkills('## Skills\nNo table'), /empty/);
  assert.throws(() => parseSkills('## Skills\n| [`bad`](../bad) | Unsafe path |'), /empty/);
});
test('sync refreshes the catalog and preserves it during GitHub failure', async t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dodo-skills-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const destination = path.join(temp, 'skills.json');
  await syncSkills(destination, async url => url.includes('api.github.com')
    ? { ok: true, json: async () => ({ sha: 'a'.repeat(40), tree: [{ type: 'blob', path: 'example/SKILL.md' }] }) }
    : { ok: true, text: async () => markdown });
  const saved = fs.readFileSync(destination, 'utf8');
  for (const fetchImpl of [async () => ({ ok: false, status: 503 }), async () => ({ ok: true, text: async () => 'invalid' })]) {
    assert.deepEqual(await syncSkills(destination, fetchImpl), JSON.parse(saved));
    assert.equal(fs.readFileSync(destination, 'utf8'), saved);
  }
  await assert.rejects(syncSkills(path.join(temp, 'missing.json'), async () => { throw new Error('offline'); }), /offline/);
});
test('skills build provides static catalog, installation commands, and active navigation', t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dodo-skills-page-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  build(path.join(__dirname, '..'), path.join(temp, 'dist'));
  const html = fs.readFileSync(path.join(temp, 'dist/skills/index.html'), 'utf8');
  const skills = require('../skills.json');
  assert.match(html, /Dodo’s <em>Skills\.<\/em>/);
  assert.doesNotMatch(html, /callmejustdodo\/dodo-skills/);
  assert.match(html, /href="\/skills\/" aria-current="page"/);
  assert.doesNotMatch(html, /href="\/blog\/" aria-current="page"/);
  assert.equal((html.match(/class="skill-entry"/g) || []).length, skills.length);
  for (const skill of skills) {
    assert.ok(html.includes(`https://github.com/callmejustdodo/skills/tree/main/${skill.slug}`));
    assert.ok(html.includes(`npx skills add callmejustdodo/skills --skill ${skill.slug}`));
  }
});

test('new SKILL.md is discovered without a README edit and deleted entries disappear', async () => {
  const requested = [];
  const skills = await fetchCatalog(async url => {
    requested.push(url);
    if (url.includes('api.github.com')) return { ok: true, json: async () => ({ sha: 'b'.repeat(40), tree: [
      { type: 'blob', path: 'new-skill/SKILL.md' },
      { type: 'blob', path: 'scripts/README.md' },
      { type: 'blob', path: '../unsafe/SKILL.md' },
    ] }) };
    return { ok: true, text: async () => url.endsWith('README.md') ? markdown : '---\nname: new-skill\ndescription: >-\n  A useful new skill.\n  With multiple lines.\n---\n# Guide' };
  });
  assert.deepEqual(skills, [{ name: 'new-skill', slug: 'new-skill', description: 'A useful new skill. With multiple lines.' }]);
  assert.ok(requested.slice(1).every(url => url.includes('b'.repeat(40))));
});
test('skill descriptions support quoted text and reject missing metadata', () => {
  assert.equal(skillDescription('---\ndescription: "A useful skill."\n---'), 'A useful skill.');
  assert.equal(skillDescription("---\ndescription: 'Dodo''s skill.'\n---"), "Dodo's skill.");
  assert.throws(() => skillDescription('# Missing metadata'), /missing/);
});
