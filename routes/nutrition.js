import "dotenv/config";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";

const router = express.Router();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const LEVELS = ["low", "medium", "high"];

router.post("/", async (req, res) => {
  const { name } = req.body;

  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "name is required" });
  }

  try {
    const message = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL,
      max_tokens: 300,

      messages: [
        {
          role: "user",
          content: `
다음 음식의 대략적인 영양 구성을 추정해줘.

음식: ${name.trim()}

기준:
- 일반적인 1인분을 기준으로, 각 영양소가 이 끼니에서 차지하는 비중을 low / medium / high 로 판단한다.
- 음식명과 (있다면) 개수·양을 근거로 대략 추정한다. 정확한 그램 수를 요구하거나 지어내지 않는다.
- protein(단백질), veggie(채소·식이섬유), carb(탄수화물), fat(지방), sugar(당류), sodium(나트륨) 6가지를 모두 판단한다.
- tip 은 이 식사를 '평가'하지 말고 '보완' 중심으로 한 문장만 쓴다. 부족한 영양소를 다음 끼니에 더하는 제안 위주. 예: "단백질이 적어 보이니 달걀이나 두부를 곁들이면 균형이 맞아요."
- 훈수나 잔소리 톤을 피하고 담백한 존댓말(해요체)로 쓴다.
- 특별히 보완할 게 없거나 이미 균형 잡혀 있으면 tip 은 빈 문자열("")로 둔다.
          `.trim(),
        },
      ],

      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              protein: { type: "string", enum: LEVELS },
              veggie: { type: "string", enum: LEVELS },
              carb: { type: "string", enum: LEVELS },
              fat: { type: "string", enum: LEVELS },
              sugar: { type: "string", enum: LEVELS },
              sodium: { type: "string", enum: LEVELS },
              tip: { type: "string" },
            },
            required: [
              "protein",
              "veggie",
              "carb",
              "fat",
              "sugar",
              "sodium",
              "tip",
            ],
          },
        },
      },
    });

    if (message.stop_reason === "refusal") {
      return res.status(422).json({ error: "nutrition estimation refused" });
    }

    const textBlock = message.content.find((b) => b.type === "text");

    if (!textBlock) {
      throw new Error("Claude 응답에서 text 블록을 찾지 못했어요.");
    }

    const result = JSON.parse(textBlock.text);

    // 6축이 모두 유효한 레벨인지 검증
    const axes = ["protein", "veggie", "carb", "fat", "sugar", "sodium"];
    const valid = axes.every((k) => LEVELS.includes(result[k]));

    if (!valid) {
      throw new Error("영양 레벨 값이 올바르지 않아요.");
    }

    return res.json(result);
  } catch (error) {
    console.error("Anthropic nutrition error:", error);

    return res.status(500).json({
      error: "nutrition estimation failed",
      detail: error?.message || String(error),
    });
  }
});

export default router;
