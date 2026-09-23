import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import config from "../config.js";

// ワークスペースに紐づいていないAPIキーを使う場合は ANTHROPIC_WORKSPACE_ID を指定する
const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
const client = new Anthropic(
  workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : {},
);

const ThreadSchema = z.object({
  thread_title: z.string().describe("元スレのスレタイ。例: 【速報】〇〇、△△を発表"),
  matome_title: z
    .string()
    .describe("まとめ記事のタイトル。【朗報】【悲報】などを付けた、思わずクリックしたくなる一文"),
  category: z.enum(config.categories),
  tags: z.array(z.string()).describe("関連キーワード 2〜4個"),
  intro: z.string().describe("記事冒頭の管理人の一言（1〜2文）"),
  posts: z
    .array(
      z.object({
        no: z.number().int().describe("レス番号。1から始まり昇順。まとめなので途中が飛んでよい"),
        poster: z
          .string()
          .describe(
            "投稿者ID生成用のラベル。住人ごとに A, B, C… のような一意の記号を振り、同じ人が再登場したら同じ記号を使う。スレ主は必ず 'OP'",
          ),
        body: z.string().describe("本文。改行は\\n。安価は >>12 の形式"),
        highlight: z
          .enum(["none", "red", "blue", "big"])
          .describe("まとめ管理人による強調。面白い・重要なレスだけに付ける"),
      }),
    )
    .describe("まとめに掲載するレス 35〜60個"),
  admin_comment: z.string().describe("記事末尾の管理人コメント（1〜2文）"),
});

const SYSTEM_PROMPT = `あなたは2ch/5ch風まとめブログの「中の人」です。
与えられた実在のAIニュースを元に、それに反応する「架空の匿名掲示板スレッド」を書き、まとめ記事の形に編集してください。

スレッドの雰囲気:
- ${config.generation.boardName}に立ったスレ。>>1 はニュースの要点を短く貼って一言添える
- 住人は多様にする: 詳しい技術者、懐疑派、AIに仕事を奪われると嘆く人、ボケる人、それにツッコむ人、的外れな人、冷静にまとめる人
- 2ch的な口調（ワイ、ンゴ、草、〜で草、ガチで、それな、ソース出せ、など）を自然に。安価(>>n)で会話を成立させる
- 短いレスを中心に、たまに長文や短いAAを混ぜてテンポよく。レス番号は後半ほど大きく飛ばしてスレの勢いを出す
- 最後はオチのつくレスや綺麗な流れで締める

守ること:
- ニュース本文にない事実を「事実」として断定しない。推測・ネタとして書くのはOK
- 実在の人物・企業への中傷、差別的表現、実在の個人情報は書かない（公的な行動への批評・ツッコミはOK）
- 出力はすべて日本語`;

function buildUserPrompt(news) {
  return `以下のニュースでスレを立ててまとめてください。

タイトル: ${news.title}
配信元: ${news.source}
配信日時: ${news.publishedAt}
概要: ${news.summary || "（概要なし。タイトルから分かる範囲で）"}`;
}

/** ニュース1件からスレ（まとめ記事データ）を生成する */
export async function generateThread(news) {
  const response = await client.beta.messages.parse({
    model: config.generation.model,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: config.generation.effort,
      format: betaZodOutputFormat(ThreadSchema),
    },
    // 安全分類器で拒否された場合は Anthropic 推奨モデルでサーバー側リトライ
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(news) }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error(`生成を拒否されました (${response.stop_details?.category ?? "unknown"})`);
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("出力が max_tokens に達して途中で切れました");
  }
  const thread = response.parsed_output;
  if (!thread) throw new Error("JSONのパースに失敗しました");

  thread.posts.sort((a, b) => a.no - b.no);
  return { thread, usage: response.usage, model: response.model };
}
