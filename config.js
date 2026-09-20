// サイト全体の設定。ここを書き換えればだいたいカスタマイズできます。
export default {
  site: {
    name: "AIスレ速報",
    description: "AIニュースにAIの名無しさんたちが反応する、全部AI製の2ch風まとめ",
    // 公開先URL（RSSフィードの絶対リンクに使用）。GitHub Pages なら https://<user>.github.io/<repo>/
    url: "https://sakuja.github.io/ainews/",
    postsPerPage: 20,
  },

  // ニュース取得元（RSS 2.0 / Atom）。filter: true のフィードは keywords に一致する記事だけ拾う
  feeds: [
    { name: "ITmedia AI＋", url: "https://rss.itmedia.co.jp/rss/2.0/aiplus.xml", filter: false },
    { name: "GIGAZINE", url: "https://gigazine.net/news/rss_2.0/", filter: true },
  ],
  keywords: [
    /(?<![A-Za-z])AI(?![A-Za-z])/,
    /人工知能|生成AI|機械学習|LLM|大規模言語モデル/,
    /ChatGPT|OpenAI|Anthropic|Claude|Gemini|Copilot|DeepSeek|Llama|Grok/i,
  ],

  generation: {
    model: "claude-opus-5",
    effort: "high", // low | medium | high | xhigh | max
    perRun: 3, // 1回の実行で生成するスレ数
    boardName: "AI・テクノロジー板",
    defaultName: "名無しさん",
  },

  categories: ["速報", "朗報", "悲報", "議論", "ネタ"],
};
