import Parser from "rss-parser";
import config from "../config.js";

const parser = new Parser({ timeout: 20000 });

function clean(text = "") {
  return text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function matchesKeywords(item) {
  const text = `${item.title} ${item.summary}`;
  return config.keywords.some((re) => re.test(text));
}

/** 全フィードからAI関連ニュースを取得し、新しい順に返す */
export async function fetchNews() {
  const results = await Promise.allSettled(
    config.feeds.map(async (feed) => {
      const parsed = await parser.parseURL(feed.url);
      return parsed.items
        .map((it) => ({
          title: clean(it.title),
          url: it.link,
          summary: clean(it.contentSnippet || it.content || it.summary || ""),
          source: feed.name,
          publishedAt: it.isoDate || new Date().toISOString(),
        }))
        .filter((it) => it.url && it.title)
        .filter((it) => !feed.filter || matchesKeywords(it));
    }),
  );

  const items = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") items.push(...r.value);
    else console.warn(`⚠ フィード取得失敗: ${config.feeds[i].name} (${r.reason?.message})`);
  });
  return items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
