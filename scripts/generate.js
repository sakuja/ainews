// ニュースを取得して、未処理のものからスレを生成し data/threads/ に保存する
//   npm run generate                 … RSSから新着を config.generation.perRun 件
//   npm run generate -- --count 1    … 件数指定
//   npm run generate -- --dry-run    … APIを呼ばず候補ニュースだけ表示
//   npm run generate -- --title "..." --summary "..." --url "..."  … 手動でニュース指定
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import Anthropic from "@anthropic-ai/sdk";
import config from "../config.js";
import { fetchNews } from "../lib/news.js";
import { generateThread } from "../lib/generate.js";

const THREADS_DIR = "data/threads";
const SEEN_FILE = "data/seen.json";

const { values: args } = parseArgs({
  options: {
    count: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    title: { type: "string" },
    summary: { type: "string" },
    url: { type: "string" },
  },
});

mkdirSync(THREADS_DIR, { recursive: true });
const seen = new Set(existsSync(SEEN_FILE) ? JSON.parse(readFileSync(SEEN_FILE, "utf8")) : []);

function makeId(news) {
  const d = new Date(news.publishedAt);
  const ymd = d.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }).replaceAll("-", "");
  const hash = createHash("sha1").update(news.url).digest("hex").slice(0, 6);
  return `${ymd}-${hash}`;
}

let queue;
if (args.title) {
  queue = [
    {
      title: args.title,
      summary: args.summary ?? "",
      url: args.url ?? `manual:${args.title}`,
      source: args.url ? new URL(args.url).hostname : "手動入力",
      publishedAt: new Date().toISOString(),
    },
  ];
} else {
  const count = Number(args.count ?? config.generation.perRun);
  console.log("📡 ニュース取得中...");
  const news = await fetchNews();
  queue = news.filter((n) => !seen.has(n.url)).slice(0, count);
  console.log(`   ${news.length}件取得 / 未処理から${queue.length}件を処理します`);
}

if (args["dry-run"]) {
  queue.forEach((n) => console.log(`- [${n.source}] ${n.title}\n  ${n.url}`));
  process.exit(0);
}

let ok = 0;
for (const news of queue) {
  const id = makeId(news);
  console.log(`\n✍  生成中: ${news.title}`);
  try {
    const started = Date.now();
    const { thread, usage, model } = await generateThread(news);
    const article = {
      id,
      createdAt: new Date().toISOString(),
      news,
      ...thread,
      meta: { model, usage },
    };
    writeFileSync(`${THREADS_DIR}/${id}.json`, JSON.stringify(article, null, 2));
    seen.add(news.url);
    writeFileSync(SEEN_FILE, JSON.stringify([...seen], null, 2));
    ok++;
    const sec = ((Date.now() - started) / 1000).toFixed(0);
    console.log(`   ✅ ${thread.matome_title}（${thread.posts.length}レス, ${sec}秒, out ${usage.output_tokens}tok）`);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      console.error("   ❌ APIキーが無効です。ANTHROPIC_API_KEY を確認してください");
      process.exit(1);
    } else if (err instanceof Anthropic.RateLimitError) {
      console.error("   ❌ レート制限に達しました。時間をおいて再実行してください");
      break;
    } else if (err instanceof Anthropic.APIError) {
      console.error(`   ❌ APIエラー ${err.status}: ${err.message}`);
    } else {
      console.error(`   ❌ ${err.message}`);
    }
  }
}

console.log(`\n完了: ${ok}/${queue.length}件生成。npm run build でサイトに反映されます`);
