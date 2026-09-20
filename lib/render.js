import { createHash } from "node:crypto";
import config from "../config.js";

const { site } = config;
const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

export const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const jst = (iso) => new Date(new Date(iso).getTime() + 9 * 3600 * 1000);

function formatDate(iso) {
  const d = jst(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}`;
}

/** 2ch風の投稿日時 "2026/09/13(日) 18:02:33.12" */
function formatPostTime(ms) {
  const d = jst(new Date(ms).toISOString());
  const p = (n, l = 2) => String(n).padStart(l, "0");
  return `${formatDate(new Date(ms).toISOString())}(${WEEK[d.getUTCDay()]}) ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}.${p(Math.floor(d.getUTCMilliseconds() / 10))}`;
}

/** 投稿者ラベル → 2ch風ID（記事内で同一人物は同じID） */
function makePosterId(articleId, poster) {
  const b64 = createHash("sha1").update(`${articleId}:${poster}`).digest("base64");
  return b64.replace(/[+/=]/g, "").slice(0, 8);
}

/** 本文を HTML 化。>>n を記事内リンクに、URLっぽいものはそのまま文字で */
function renderBody(body) {
  return esc(body)
    .replace(/&gt;&gt;(\d{1,4})/g, '<a class="anchor" href="#res$1">&gt;&gt;$1</a>')
    .replace(/\n/g, "<br>");
}

const categoryClass = (cat) => `cat-${config.categories.indexOf(cat)}`;

function layout({ title, description, base, body, canonical }) {
  const fullTitle = title ? `${title} | ${site.name}` : site.name;
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description ?? site.description)}">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ""}
<link rel="stylesheet" href="${base}style.css">
<link rel="alternate" type="application/rss+xml" title="${esc(site.name)}" href="${base}feed.xml">
</head>
<body>
<header class="site-header">
  <div class="wrap">
    <a class="logo" href="${base}index.html">${esc(site.name)}</a>
    <p class="tagline">${esc(site.description)}</p>
  </div>
  <nav class="catnav"><div class="wrap">
    <a href="${base}index.html">トップ</a>
    ${config.categories.map((c) => `<a href="${base}category/${encodeURIComponent(c)}.html">${esc(c)}</a>`).join("")}
  </div></nav>
</header>
<div class="wrap columns">
  <main>${body}</main>
  <aside class="sidebar" data-base="${base}">__SIDEBAR__</aside>
</div>
<footer class="site-footer"><div class="wrap">
  <p>当サイトの掲示板スレッドはすべてAI（Claude）が生成した<strong>架空のもの</strong>です。実在の人物の発言ではありません。ニュースの詳細は各配信元の記事をご確認ください。</p>
  <p>&copy; ${esc(site.name)}</p>
</div></footer>
</body>
</html>`;
}

function sidebar(articles, base) {
  const recent = articles.slice(0, 10);
  const counts = Object.fromEntries(config.categories.map((c) => [c, 0]));
  articles.forEach((a) => counts[a.category] !== undefined && counts[a.category]++);
  return `
  <section class="box">
    <h2>最新記事</h2>
    <ul class="side-list">${recent
      .map((a) => `<li><a href="${base}archives/${a.id}.html">${esc(a.matome_title)}</a></li>`)
      .join("")}</ul>
  </section>
  <section class="box">
    <h2>カテゴリ</h2>
    <ul class="side-list">${config.categories
      .map((c) => `<li><a href="${base}category/${encodeURIComponent(c)}.html">${esc(c)} (${counts[c]})</a></li>`)
      .join("")}</ul>
  </section>
  <section class="box about">
    <h2>このサイトについて</h2>
    <p>AIニュースを題材に、AIが「もし掲示板でスレが立ったら」を想像して書いた架空スレをまとめています。</p>
  </section>`;
}

function articleCard(a, base) {
  const first = a.posts[0]?.body.split("\n")[0] ?? "";
  return `<article class="card">
    <div class="card-meta"><span class="cat ${categoryClass(a.category)}">${esc(a.category)}</span><time>${formatDate(a.news.publishedAt)}</time></div>
    <h2 class="card-title"><a href="${base}archives/${a.id}.html">${esc(a.matome_title)}</a></h2>
    <p class="card-excerpt">1: ${esc(first.slice(0, 80))}</p>
    <p class="card-foot">${a.posts.length}レス ・ 元ネタ: ${esc(a.news.source)}</p>
  </article>`;
}

export function renderList({ articles, all, base, heading, page, totalPages, pageHref }) {
  const pager =
    totalPages > 1
      ? `<nav class="pager">${page > 1 ? `<a href="${pageHref(page - 1)}">« 前へ</a>` : ""}<span>${page} / ${totalPages}</span>${
          page < totalPages ? `<a href="${pageHref(page + 1)}">次へ »</a>` : ""
        }</nav>`
      : "";
  const body = `${heading ? `<h1 class="list-heading">${esc(heading)}</h1>` : ""}
    ${articles.length ? articles.map((a) => articleCard(a, base)).join("") : '<p class="empty">まだ記事がありません。<code>npm run generate</code> で生成してください。</p>'}
    ${pager}`;
  return layout({ title: heading, base, body }).replace("__SIDEBAR__", sidebar(all, base));
}

export function renderArticle(a, all) {
  const base = "../";
  // 投稿時刻: ニュース配信の数分後にスレが立ち、レス番号に応じて時間が進む
  const start = new Date(a.news.publishedAt).getTime() + 7 * 60 * 1000;
  const seed = parseInt(createHash("md5").update(a.id).digest("hex").slice(0, 8), 16);
  const posts = a.posts
    .map((p, i) => {
      const jitter = ((seed >> (i % 24)) & 0xff) * 97; // 記事ごとに固定のゆらぎ(ms)
      const time = start + p.no * 41_000 + jitter;
      // ラベルが「名無しさん」等の汎用名だったら1レス1人扱いにする
      const generic = !p.poster || /名無し|anonymous/i.test(p.poster);
      const id = makePosterId(a.id, generic ? `#${p.no}` : p.poster);
      const isOp = p.poster === "OP";
      return `<div class="res hl-${p.highlight}" id="res${p.no}">
        <div class="res-head"><span class="res-no">${p.no}</span>: <span class="res-name">${esc(config.generation.defaultName)}</span> <span class="res-date">${formatPostTime(time)}</span> <span class="res-id${isOp ? " op" : ""}">ID:${id}</span></div>
        <div class="res-body">${renderBody(p.body)}</div>
      </div>`;
    })
    .join("");

  const related = all
    .filter((x) => x.id !== a.id && (x.category === a.category || x.tags?.some((t) => a.tags?.includes(t))))
    .slice(0, 5);

  const body = `<article class="entry">
    <div class="card-meta"><span class="cat ${categoryClass(a.category)}">${esc(a.category)}</span><time>${formatDate(a.news.publishedAt)}</time></div>
    <h1 class="entry-title">${esc(a.matome_title)}</h1>
    <ul class="tags">${(a.tags ?? []).map((t) => `<li>#${esc(t)}</li>`).join("")}</ul>

    <div class="source-box">
      <span class="label">元ネタ</span>
      ${a.news.url.startsWith("http") ? `<a href="${esc(a.news.url)}" target="_blank" rel="noopener">${esc(a.news.title)}</a>` : esc(a.news.title)}
      <span class="source-name">（${esc(a.news.source)}）</span>
    </div>

    <p class="intro">${esc(a.intro)}</p>
    <p class="thread-title">引用元: ${esc(config.generation.boardName)}「${esc(a.thread_title)}」 <span class="ai-badge">※AI生成の架空スレ</span></p>

    <div class="thread">${posts}</div>

    <div class="admin-comment"><span class="label">管理人コメント</span>${esc(a.admin_comment)}</div>

    ${
      related.length
        ? `<section class="related"><h2>関連記事</h2><ul>${related
            .map((r) => `<li><a href="${r.id}.html">${esc(r.matome_title)}</a></li>`)
            .join("")}</ul></section>`
        : ""
    }
  </article>`;

  return layout({
    title: a.matome_title,
    description: a.intro,
    base,
    body,
    canonical: new URL(`archives/${a.id}.html`, site.url).href,
  }).replace("__SIDEBAR__", sidebar(all, base));
}

export function renderFeed(articles) {
  const items = articles
    .slice(0, 30)
    .map((a) => {
      const link = new URL(`archives/${a.id}.html`, site.url).href;
      return `<item><title>${esc(a.matome_title)}</title><link>${esc(link)}</link><guid>${esc(link)}</guid><pubDate>${new Date(a.createdAt).toUTCString()}</pubDate><category>${esc(a.category)}</category><description>${esc(a.intro)}</description></item>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${esc(site.name)}</title><link>${esc(site.url)}</link><description>${esc(site.description)}</description><language>ja</language>
${items}
</channel></rss>`;
}
