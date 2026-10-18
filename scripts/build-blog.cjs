const fs = require('node:fs');
const path = require('node:path');
const { envValue } = require('./update-spotify.cjs');

const SITE = 'https://callmejustdodo.com';
const ROOT = path.resolve(__dirname, '..');
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ESCAPES[character]);
}

function safeUrl(value) {
  const url = value.trim();
  return /^(https?:\/\/|mailto:|\/(?!\/)|#|\.\.?\/)/i.test(url) && !/[\s<>"']/.test(url) ? url : null;
}

function renderInline(source) {
  let html = '';
  for (let i = 0; i < source.length;) {
    const rest = source.slice(i);
    if (rest[0] === '\\' && rest.length > 1) {
      html += escapeHtml(rest[1]); i += 2; continue;
    }
    if (rest[0] === '`') {
      const end = rest.indexOf('`', 1);
      if (end > 0) { html += `<code>${escapeHtml(rest.slice(1, end))}</code>`; i += end + 1; continue; }
    }
    const image = rest.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (image) {
      const url = safeUrl(image[2]);
      html += url ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(image[1])}" loading="lazy">` : escapeHtml(image[0]);
      i += image[0].length; continue;
    }
    const link = rest.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (link) {
      const url = safeUrl(link[2]);
      html += url ? `<a href="${escapeHtml(url)}">${renderInline(link[1])}</a>` : escapeHtml(link[0]);
      i += link[0].length; continue;
    }
    let formatted = false;
    for (const [mark, tag] of [['**', 'strong'], ['__', 'strong'], ['*', 'em'], ['_', 'em']]) {
      if (!rest.startsWith(mark)) continue;
      const end = rest.indexOf(mark, mark.length);
      if (end <= mark.length) continue;
      html += `<${tag}>${renderInline(rest.slice(mark.length, end))}</${tag}>`;
      i += end + mark.length; formatted = true; break;
    }
    if (formatted) continue;
    html += escapeHtml(rest[0]); i++;
  }
  return html;
}

function headingId(text, used) {
  const base = text.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-') || 'section';
  const count = used.get(base) || 0;
  used.set(base, count + 1);
  return count ? `${base}-${count + 1}` : base;
}

function isBlockStart(line) {
  return /^\s{0,3}(?:#{1,6}\s|>|[-*+]\s|\d+[.)]\s|`{3,}|~{3,}|(?:-{3,}|\*{3,}|_{3,})\s*$)/.test(line);
}

function renderMarkdown(source, used = new Map()) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const fence = line.match(/^\s{0,3}(`{3,}|~{3,})([^`]*)$/);
    if (fence) {
      const marker = fence[1];
      const code = [];
      i++;
      while (i < lines.length && !new RegExp(`^\\s{0,3}${marker[0]}{${marker.length},}\\s*$`).test(lines[i])) code.push(lines[i++]);
      if (i < lines.length) i++;
      const language = fence[2].trim().match(/^[\w-]+$/)?.[0];
      out.push(`<pre><code${language ? ` class="language-${escapeHtml(language)}"` : ''}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level} id="${escapeHtml(headingId(heading[2], used))}">${renderInline(heading[2])}</h${level}>`);
      i++; continue;
    }
    if (/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    if (/^\s{0,3}>/.test(line)) {
      const quote = [];
      while (i < lines.length && /^\s{0,3}>/.test(lines[i])) quote.push(lines[i++].replace(/^\s{0,3}>\s?/, ''));
      out.push(`<blockquote>${renderMarkdown(quote.join('\n'), used)}</blockquote>`);
      continue;
    }
    const list = line.match(/^\s{0,3}([-*+]|\d+[.)])\s+(.+)$/);
    if (list) {
      const ordered = /\d/.test(list[1][0]);
      const tag = ordered ? 'ol' : 'ul';
      const items = [];
      while (i < lines.length) {
        const match = lines[i].match(/^\s{0,3}([-*+]|\d+[.)])\s+(.+)$/);
        if (!match || /\d/.test(match[1][0]) !== ordered) break;
        items.push(`<li>${renderInline(match[2])}</li>`); i++;
      }
      out.push(`<${tag}>${items.join('')}</${tag}>`);
      continue;
    }
    const paragraph = [line.trim()]; i++;
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) paragraph.push(lines[i++].trim());
    out.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
  }
  return out.join('\n');
}

function parsePost(filename, source) {
  const match = source.replace(/\r\n?/g, '\n').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`${filename}: expected frontmatter between --- lines`);
  const meta = {};
  for (const line of match[1].split('\n')) {
    const field = line.match(/^([a-z]+):\s*(.*?)\s*$/i);
    if (!field) throw new Error(`${filename}: invalid frontmatter line: ${line}`);
    meta[field[1].toLowerCase()] = field[2].replace(/^(["'])(.*)\1$/, '$2');
  }
  for (const key of ['title', 'date', 'description']) if (!meta[key]) throw new Error(`${filename}: missing ${key}`);
  const parsedDate = new Date(`${meta.date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== meta.date) {
    throw new Error(`${filename}: date must be YYYY-MM-DD`);
  }
  const slug = path.basename(filename, '.md');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`${filename}: use a lowercase hyphenated filename`);
  return { ...meta, slug, body: match[2], draft: meta.draft === 'true' };
}

function jsonForHtml(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function layout({ title, description, canonical, content, type = 'website', schema }) {
  const fullTitle = `${title} — Call Me Just Dodo`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="author" content="Dohyeon Dodo Park">
    <meta name="theme-color" content="#eeece8">
    <link rel="canonical" href="${escapeHtml(canonical)}">
    <meta property="og:type" content="${type}">
    <meta property="og:site_name" content="Call Me Just Dodo">
    <meta property="og:title" content="${escapeHtml(fullTitle)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${escapeHtml(canonical)}">
    <meta property="og:image" content="${SITE}/og-image.png?v=20261005-sky">
    <meta name="twitter:card" content="summary_large_image">
    <title>${escapeHtml(fullTitle)}</title>
    <link rel="preload" href="/fonts/radley.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/fonts/dm-sans.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="icon" href="/favicon.ico?v=20261005-sky" sizes="16x16 32x32">
    <link rel="icon" href="/favicon.svg?v=20261005-sky" type="image/svg+xml" sizes="any">
    <link rel="stylesheet" href="/styles.css">
    <link rel="stylesheet" href="/blog.css">
    <script type="application/ld+json">${jsonForHtml(schema)}</script>
  </head>
  <body class="blog-page">
    <a class="skip-link" href="#main">Skip to content</a>
    <div class="atmosphere" aria-hidden="true"></div><div class="grain" aria-hidden="true"></div>
    <header class="site-header shell">
      <a class="wordmark" href="/" aria-label="Dodo — home">call me just dodo</a>
      <nav aria-label="Main navigation"><a href="/">Home</a><a href="/blog/" aria-current="page">Blog</a><a href="/#contact">Say hello</a></nav>
    </header>
    <main class="shell blog-main" id="main">${content}</main>
    <footer class="shell" id="contact"><p class="eyebrow">GET IN TOUCH</p><h2>Coffee first.<br>Maybe a company next.</h2><a class="contact-link" href="mailto:dodo41142727@gmail.com">Say hello <span aria-hidden="true">↗</span></a><div class="footer-bottom"><span>Dohyeon Dodo Park <span aria-hidden="true">·</span> Seoul</span><div class="social-links"><a href="https://github.com/just-dodo" target="_blank" rel="noreferrer">GitHub ↗</a><a href="https://www.linkedin.com/in/callmejustdodo/" target="_blank" rel="noreferrer">LinkedIn ↗</a></div><span>© ${new Date().getFullYear()}</span></div></footer>
    <script src="/time-of-day.js"></script><script src="/blog-time.js"></script>
  </body>
</html>
`;
}

function build(root = ROOT, output = path.join(root, 'dist')) {
  const postDir = path.join(root, 'blog', 'posts');
  const posts = fs.readdirSync(postDir).filter(name => name.endsWith('.md'))
    .map(name => parsePost(name, fs.readFileSync(path.join(postDir, name), 'utf8')))
    .filter(post => !post.draft)
    .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });
  for (const file of ['index.html', 'callback.html', 'spotify-callback.css', 'spotify-callback.js', 'spotify-top.js', 'spotify-logo-black.svg', 'spotify-logo-white.svg', 'chess-rating.js', 'styles.css', 'blog.css', 'blog-time.js', 'script.js', 'time-of-day.js', 'sky-palette.js', 'sky-study.js', 'sky-study.css', 'sky-paper.js', 'sky-natural.js', 'favicon.ico', 'favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'og-image.png', 'og-image.svg', 'profile-with-cat.jpg']) {
    fs.copyFileSync(path.join(root, file), path.join(output, file));
  }
  const envPath = path.join(root, '.env');
  const clientId = process.env.SPOTIFY_CLIENT_ID || (fs.existsSync(envPath) ? envValue(fs.readFileSync(envPath, 'utf8'), 'SPOTIFY_CLIENT_ID') : '');
  if (clientId && !/^[A-Za-z0-9_-]+$/.test(clientId)) throw new Error('SPOTIFY_CLIENT_ID contains invalid characters.');
  const callbackPath = path.join(output, 'callback.html');
  const callbackHtml = fs.readFileSync(callbackPath, 'utf8');
  const clientIdMarker = '<meta name="spotify-client-id" content="" />';
  if (!callbackHtml.includes(clientIdMarker)) throw new Error('Spotify callback Client ID marker is missing.');
  fs.writeFileSync(callbackPath, callbackHtml.replace(clientIdMarker, `<meta name="spotify-client-id" content="${escapeHtml(clientId)}" />`));
  const spotifyTracks = path.join(root, 'spotify-tracks.json');
  if (fs.existsSync(spotifyTracks)) fs.copyFileSync(spotifyTracks, path.join(output, 'spotify-tracks.json'));
  for (const directory of ['fonts', 'vendor']) fs.cpSync(path.join(root, directory), path.join(output, directory), { recursive: true });
  const images = path.join(root, 'blog', 'images');
  if (fs.existsSync(images)) {
    fs.mkdirSync(path.join(output, 'blog'), { recursive: true });
    fs.cpSync(images, path.join(output, 'blog', 'images'), { recursive: true });
  }

  const entries = posts.map(post => `<a class="blog-entry" href="/blog/${post.slug}/"><time datetime="${post.date}">${post.date}</time><span><strong>${escapeHtml(post.title)}</strong><small>${escapeHtml(post.description)}</small></span><span class="blog-entry-arrow" aria-hidden="true">↗</span></a>`).join('\n');
  const index = layout({ title: 'Blog', description: 'Writing and notes by Dohyeon Dodo Park.', canonical: `${SITE}/blog/`, content: `<div class="blog-intro"><p class="eyebrow">WRITING / DOHYEON DODO PARK</p><h1>Notes from <em>Dodo.</em></h1><p>Thoughts, experiments, and things worth keeping.</p></div><section class="blog-list" aria-labelledby="blog-list-title"><div class="section-heading"><h2 id="blog-list-title">All posts</h2><span class="section-aside">Newest first</span></div>${entries || '<p class="blog-empty">New writing will appear here soon.</p>'}</section>`, schema: { '@context': 'https://schema.org', '@type': 'Blog', name: 'Call Me Just Dodo — Blog', url: `${SITE}/blog/`, author: { '@type': 'Person', name: 'Dohyeon Dodo Park' } } });
  fs.mkdirSync(path.join(output, 'blog'), { recursive: true });
  fs.writeFileSync(path.join(output, 'blog', 'index.html'), index);

  for (const post of posts) {
    const canonical = `${SITE}/blog/${post.slug}/`;
    const content = `<a class="blog-back" href="/blog/">← All posts</a><article class="blog-article"><header class="blog-article-header"><p class="eyebrow">WRITING / <time datetime="${post.date}">${post.date}</time></p><h1>${escapeHtml(post.title)}</h1><p>${escapeHtml(post.description)}</p></header><div class="markdown-body">${renderMarkdown(post.body)}</div></article><a class="blog-back blog-back-bottom" href="/blog/">← Back to all posts</a>`;
    const html = layout({ title: post.title, description: post.description, canonical, content, type: 'article', schema: { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title, description: post.description, datePublished: post.date, author: { '@type': 'Person', name: 'Dohyeon Dodo Park' }, mainEntityOfPage: canonical } });
    const destination = path.join(output, 'blog', post.slug);
    fs.mkdirSync(destination, { recursive: true });
    fs.writeFileSync(path.join(destination, 'index.html'), html);
  }
  return posts.length;
}

if (require.main === module) console.log(`Built blog with ${build()} post(s) in dist/.`);
module.exports = { build, escapeHtml, parsePost, renderMarkdown, safeUrl };
