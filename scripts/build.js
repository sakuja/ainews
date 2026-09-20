// data/threads/*.json から静的サイトを docs/ に生成する
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import config from "../config.js";
import { renderArticle, renderFeed, renderList, renderRobots, renderSitemap } from "../lib/render.js";

const OUT = "docs";
const THREADS_DIR = "data/threads";

const articles = existsSync(THREADS_DIR)
  ? readdirSync(THREADS_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(readFileSync(`${THREADS_DIR}/${f}`, "utf8")))
      .sort((a, b) => b.news.publishedAt.localeCompare(a.news.publishedAt))
  : [];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/archives`, { recursive: true });
mkdirSync(`${OUT}/category`, { recursive: true });

const sitemapPages = [];
const newest = articles[0]?.news.publishedAt;

function writePaged(list, { base, heading, fileFor }) {
  const per = config.site.postsPerPage;
  const totalPages = Math.max(1, Math.ceil(list.length / per));
  for (let page = 1; page <= totalPages; page++) {
    const path = fileFor(page);
    const html = renderList({
      articles: list.slice((page - 1) * per, page * per),
      all: articles,
      base,
      heading,
      page,
      totalPages,
      pageHref: (p) => fileFor(p).split("/").pop(),
      path,
    });
    writeFileSync(`${OUT}/${path}`, html);
    sitemapPages.push({ path, lastmod: list[0]?.news.publishedAt ?? newest, priority: page === 1 ? "0.8" : "0.4" });
  }
}

writePaged(articles, { base: "", heading: null, fileFor: (p) => (p === 1 ? "index.html" : `page${p}.html`) });

for (const cat of config.categories) {
  const list = articles.filter((a) => a.category === cat);
  writePaged(list, {
    base: "../",
    heading: `カテゴリ: ${cat}`,
    fileFor: (p) => `category/${cat}${p === 1 ? "" : `-${p}`}.html`,
  });
}

for (const a of articles) {
  writeFileSync(`${OUT}/archives/${a.id}.html`, renderArticle(a, articles));
  sitemapPages.push({ path: `archives/${a.id}.html`, lastmod: a.news.publishedAt, priority: "1.0" });
}

writeFileSync(`${OUT}/feed.xml`, renderFeed(articles));
writeFileSync(`${OUT}/sitemap.xml`, renderSitemap(sitemapPages));
writeFileSync(`${OUT}/robots.txt`, renderRobots());
copyFileSync("static/style.css", `${OUT}/style.css`);
writeFileSync(`${OUT}/.nojekyll`, "");

console.log(`🏗  ${articles.length}記事をビルドしました → ${OUT}/index.html`);
