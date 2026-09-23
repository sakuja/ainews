import Parser from "rss-parser";
import config from "../config.js";

const parser = new Parser({
  timeout: 20000,
  // UAなしのリクエストを弾く配信元があるため明示する
  headers: {
    "User-Agent": `ai-matome/1.0 (+${config.site.url})`,
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
});

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
  let failed = 0;
  results.forEach((r, i) => {
    const feed = config.feeds[i];
    if (r.status === "fulfilled") {
      items.push(...r.value);
      console.log(`   ${feed.name}: ${r.value.length}件`);
    } else {
      failed++;
      console.warn(`   ⚠ ${feed.name}: 取得失敗 (${r.reason?.message})`);
    }
  });
  // 全滅したときは原因が分かるように失敗させる（自動実行が黙って空振りするのを防ぐ）
  if (failed === config.feeds.length) {
    throw new Error("すべてのRSSフィードの取得に失敗しました");
  }
  return items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
