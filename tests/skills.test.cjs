const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseSkills, syncSkills } = require('../scripts/sync-skills.cjs');
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
  await syncSkills(destination, async () => ({ ok: true, text: async () => markdown }));
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
  assert.match(html, /href="\/skills\/" aria-current="page"/);
  assert.doesNotMatch(html, /href="\/blog\/" aria-current="page"/);
  assert.equal((html.match(/class="skill-entry"/g) || []).length, skills.length);
  for (const skill of skills) {
    assert.ok(html.includes(`https://github.com/callmejustdodo/dodo-skills/tree/main/${skill.slug}`));
    assert.ok(html.includes(`npx skills add callmejustdodo/dodo-skills --skill ${skill.slug}`));
  }
});
