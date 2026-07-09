import "dotenv/config";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";

const router = express.Router();

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

router.post("/", async (req, res) => {
    const { name } = req.body;

    if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
            error: "name is required",
        });
    }

    try {
        const message = await anthropic.messages.create({
            model: process.env.CLAUDE_MODEL,
            max_tokens: 250,

            messages: [
                {
                    role: "user",
                    content: `
                    다음 음식의 칼로리를 대략 추정해줘.

                    음식: ${name.trim()}

                    기준:
                   - confidence는 사용자가 현실적으로 알 수 있는 정보만 기준으로 판단한다.
                   - 제품명이나 메뉴명과 먹은 개수·조각·잔·그릇 등의 양이 있으면 high로 판단한다.
                   - 음식명은 명확하지만 양이 없거나 "조금", "많이"처럼 대략적인 양만 있으면 medium으로 판단한다.
                   - "피자", "간식", "한 끼", "뷔페"처럼 음식 종류나 양이 매우 모호할 때만 low로 판단한다.
                   - 레시피의 기름, 치즈, 소스, 재료의 정확한 그램 수처럼 사용자가 알기 어려운 정보가 없다는 이유로 confidence를 낮추지 않는다.
                   - 불확실성이 있으면 confidence를 지나치게 낮추지 말고 min과 max 범위를 넓혀 표현한다.
                   - note에는 사용자가 추가로 알기 어려운 재료량을 요구하지 않는다.
                   - 추정에 가장 큰 영향을 주는 요소가 있을 때만 짧게 한 문장으로 적는다.
                   - 메뉴명과 섭취량이 충분히 구체적이면 note는 "일반적인 제품 기준 추정치입니다."라고 적는다.
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
                            calories: {
                                type: "object",
                                additionalProperties: false,

                                properties: {
                                    min: {
                                        type: "integer",
                                    },

                                    max: {
                                        type: "integer",
                                    },

                                    estimate: {
                                        type: "integer",
                                    },
                                },

                                required: ["min", "max", "estimate"],
                            },

                            serving: {
                                type: "string",
                            },

                            confidence: {
                                type: "string",
                                enum: ["low", "medium", "high"],
                            },

                            note: {
                                type: "string",
                            },
                        },

                        required: [
                            "calories",
                            "serving",
                            "confidence",
                            "note",
                        ],

                },
            },
        },
    });

    if (message.stop_reason === "refusal") {
        return res.status(422).json({
            error: "calorie estimation was refused",
        });
    }

    const textBlock = message.content.find(
        (block) => block.type === "text",
    );

    if (!textBlock) {
        throw new Error("Claude 응답에서 text 블록을 찾지 못했어요.");
    }

    const result = JSON.parse(textBlock.text);

    const { min, max, estimate } = result.calories;

    const isValidCalories =
    Number.isInteger(min) &&
    Number.isInteger(max) &&
    Number.isInteger(estimate) &&
    min >= 0 &&
    min <= estimate &&
    estimate <= max;

    if (!isValidCalories) {
        throw new Error("칼로리 추정값의 범위가 올바르지 않아요.");
    }

    return res.json(result);
} catch (error) {
    console.error("Anthropic calorie error:", error);

    return res.status(500).json({
        error: "calorie estimation failed",
        detail: error?.message || String(error),
        status: error?.status,
    });
}
});


export default router;