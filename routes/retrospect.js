import "dotenv/config";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";

const router = express.Router();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// 회고는 분류/칼로리보다 무거운 판단이라 Sonnet 을 쓴다. (분류·칼로리는 CLAUDE_MODEL)
const REVIEW_MODEL = process.env.CLAUDE_MODEL_REVIEW || "claude-sonnet-5";

const CAT_LABEL = {
  fast: "패스트푸드",
  normal: "일반식",
  healthy: "건강식",
};

router.post("/", async (req, res) => {
  const { monthLabel, records, prevRatio } = req.body;

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: "no records" });
  }

  const lines = records
    .map((r) => {
      const parts = [
        r.weekday ? `${r.weekday}요일` : null,
        r.name,
        CAT_LABEL[r.category] || r.category,
        r.reason ? `이유:${r.reason}` : null,
        r.source ? `출처:${r.source}` : null,
        r.hunger ? `배고픔:${r.hunger}` : null,
      ].filter(Boolean);
      return `- ${parts.join(" | ")}`;
    })
    .join("\n");

  const prevLine = prevRatio
    ? `\n지난달 분류 비율: 건강식 ${prevRatio.healthy}%, 일반식 ${prevRatio.normal}%, 패스트푸드 ${prevRatio.fast}%`
    : "";

  const prompt = `
아래는 사용자가 ${monthLabel}에 기록한 식사 목록이야. 여기서 눈에 띄는 '패턴'이나 '발견'을 2~4개 찾아줘.

규칙:
- "잘했다 / 망했다" 같은 평가나 훈수, 조언은 하지 마. 담담하게 발견과 사실만.
- 각 항목은 한 문장, 정중한 존댓말(해요체) 톤. 예: "금요일에 패스트푸드가 자주 보여요", "가장 자주 먹은 건 김밥이에요".
- 반드시 아래 데이터에 근거해서만 말해. 데이터에 없는 정보(정확한 시간대, 영양 수치 등)는 추측하거나 지어내지 마.
- 요일별 경향, 분류 비율 변화(지난달과 비교), 먹은 이유, 음식 출처, 자주 먹은 음식 같은 실제로 드러나는 것만 활용해.
- 억지로 개수를 채우지 마. 뚜렷한 발견이 2개뿐이면 2개만.

이번 달 기록:
${lines}${prevLine}
`.trim();

  try {
    const message = await anthropic.messages.create({
      model: REVIEW_MODEL,
      max_tokens: 1024,

      messages: [{ role: "user", content: prompt }],

      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              discoveries: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["discoveries"],
          },
        },
      },
    });

    if (message.stop_reason === "refusal") {
      return res.status(422).json({ error: "retrospect refused" });
    }

    const textBlock = message.content.find((b) => b.type === "text");

    if (!textBlock) {
      throw new Error("Claude 응답에서 text 블록을 찾지 못했어요.");
    }

    const result = JSON.parse(textBlock.text);

    const discoveries = Array.isArray(result.discoveries)
      ? result.discoveries.filter((s) => typeof s === "string" && s.trim())
      : [];

    return res.json({ discoveries });
  } catch (error) {
    console.error("Anthropic retrospect error:", error);

    return res.status(500).json({
      error: "retrospect failed",
      detail: error?.message || String(error),
    });
  }
});

export default router;
