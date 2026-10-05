const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('biography stays expanded without a disclosure control', () => {
  assert.match(html, /<div class="about-panel">\s*<p class="about-label">A little more about me<\/p>/);
  assert.doesNotMatch(html, /<details[^>]*class="about-panel"/);
});

test('Custom sky is fixed without the temporary renderer picker', () => {
  assert.doesNotMatch(html, /data-sky-choice/);
  assert.match(html, /id="sky-status"/);
  assert.match(html, /id="sky-motion"/);
  assert.match(html, /src="sky-study\.js\?v=[^"]+"/);
});

test('existing external destinations remain available', () => {
  for (const href of [
    'mailto:dodo41142727@gmail.com', 'https://www.instagram.com/send2analyze/',
    'https://send2analyze.com/', 'https://ablur.studio/',
    'https://turtlesoupai.page.link/qjER', 'https://github.com/dodo4114/issue-to-notion',
    'https://receipt-project.com/', 'https://justdodo.medium.com/',
    'https://github.com/just-dodo', 'https://www.linkedin.com/in/callmejustdodo/',
  ]) assert.ok(html.includes(`href="${href}"`), `Missing destination: ${href}`);
});

test('user-added portrait and original biographical content are preserved', () => {
  for (const text of ['profile-with-cat.jpg', 'Dohyeon Dodo Park holding an orange-and-white cat',
    'Chief morale officer, orange tabby', 'Carpenstreet', 'LoadComplete',
    'Seoul National University', 'Korea Science Academy of KAIST', 'MeltingPot',
    'Santa Test', 'My First Startup']) assert.ok(html.includes(text), `Missing: ${text}`);
  assert.ok(fs.existsSync(path.join(root, 'profile-with-cat.jpg')));
});

test('local anchors and IDs are valid and unique', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(id), `Missing anchor ${id}`);
});

test('English document and original SEO identity remain intact', () => {
  assert.match(html, /<html[^>]*lang="en"/);
  assert.match(html, /rel="canonical" href="https:\/\/callmejustdodo.com\/"/);
  const schema = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.equal(JSON.parse(schema[1]).name, 'Dohyeon Dodo Park');
});
