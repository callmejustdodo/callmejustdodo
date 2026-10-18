const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { build, parsePost, renderMarkdown, safeUrl } = require('../scripts/build-blog.cjs');

test('Markdown renders common writing blocks and escapes raw HTML', () => {
  const html = renderMarkdown('# Heading\n\nHello **world** and [Dodo](https://example.com).\n\n- One\n- Two\n\n> A quote\n\n```js\nconst x = "<tag>";\n```\n\n<script>alert(1)</script>');
  for (const fragment of ['<h1 id="heading">Heading</h1>', '<strong>world</strong>', '<a href="https://example.com">Dodo</a>', '<ul><li>One</li><li>Two</li></ul>', '<blockquote><p>A quote</p></blockquote>', '<pre><code class="language-js">', '&lt;script&gt;']) {
    assert.ok(html.includes(fragment), fragment);
  }
  assert.doesNotMatch(html, /<script>/);
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.match(renderMarkdown('[bad](javascript:alert) ![bad](data:evil)'), /\[bad\]/);
});

test('post frontmatter requires metadata and a safe slug', () => {
  const source = '---\ntitle: A post\ndate: 2026-10-19\ndescription: Summary\n---\n\nText';
  assert.equal(parsePost('a-post.md', source).slug, 'a-post');
  assert.throws(() => parsePost('Bad_Name.md', source), /lowercase hyphenated/);
  assert.throws(() => parsePost('a-post.md', source.replace('description: Summary\n', '')), /missing description/);
  assert.throws(() => parsePost('a-post.md', source.replace('2026-10-19', '2026-02-31')), /date must/);
});

test('build creates ordered, linked, static pages and skips drafts', t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dodo-blog-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const source = path.join(__dirname, '..');
  for (const name of ['index.html', 'callback.html', 'spotify-callback.css', 'spotify-callback.js', 'spotify-top.js', 'spotify-logo-black.svg', 'spotify-logo-white.svg', 'chess-rating.js', 'styles.css', 'blog.css', 'blog-time.js', 'script.js', 'time-of-day.js', 'sky-palette.js', 'sky-study.js', 'sky-study.css', 'sky-paper.js', 'sky-natural.js', 'favicon.ico', 'favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'og-image.png', 'og-image.svg', 'profile-with-cat.jpg']) fs.copyFileSync(path.join(source, name), path.join(temp, name));
  for (const name of ['fonts', 'vendor']) fs.cpSync(path.join(source, name), path.join(temp, name), { recursive: true });
  fs.mkdirSync(path.join(temp, 'blog', 'posts'), { recursive: true });
  fs.mkdirSync(path.join(temp, 'blog', 'images'));
  fs.writeFileSync(path.join(temp, 'blog', 'images', 'sample.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  const frontmatter = (title, date, extra = '') => `---\ntitle: ${title}\ndate: ${date}\ndescription: ${title} summary\n${extra}---\n\n# Hello\n\nPost body.`;
  fs.writeFileSync(path.join(temp, 'blog', 'posts', 'older.md'), frontmatter('Older', '2026-01-01'));
  fs.writeFileSync(path.join(temp, 'blog', 'posts', 'newer.md'), frontmatter('Newer', '2026-10-19'));
  fs.writeFileSync(path.join(temp, 'blog', 'posts', 'unpublished.md'), frontmatter('Unpublished', '2026-10-20', 'draft: true\n'));
  fs.writeFileSync(path.join(temp, '.env'), 'SPOTIFY_CLIENT_ID=public-test-id\nSPOTIFY_CLIENT_SECRET=private-test-secret\nSPOTIFY_REFRESH_TOKEN=private-test-token\n');
  assert.equal(build(temp), 2);
  const callback = fs.readFileSync(path.join(temp, 'dist', 'callback.html'), 'utf8');
  assert.match(callback, /<meta name="spotify-client-id" content="public-test-id" \/>/);
  assert.doesNotMatch(callback, /private-test-secret|private-test-token|<input[^>]+id="spotify-client-id"/);
  const index = fs.readFileSync(path.join(temp, 'dist', 'blog', 'index.html'), 'utf8');
  const article = fs.readFileSync(path.join(temp, 'dist', 'blog', 'newer', 'index.html'), 'utf8');
  assert.ok(index.indexOf('Newer') < index.indexOf('Older'));
  assert.match(index, /href="\/blog\/newer\/"/);
  assert.match(article, /<h1>Newer<\/h1>/);
  assert.match(article, /<h1 id="hello">Hello<\/h1>/);
  assert.match(article, /https:\/\/callmejustdodo\.com\/blog\/newer\//);
  assert.ok(fs.existsSync(path.join(temp, 'dist', 'styles.css')));
  assert.ok(fs.existsSync(path.join(temp, 'dist', 'blog', 'images', 'sample.svg')));
  assert.equal(fs.existsSync(path.join(temp, 'dist', 'blog', 'unpublished')), false);
});
