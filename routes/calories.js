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
                    - 사용자가 양을 적었다면 그 양을 기준으로 계산한다.
                    - 양이 없다면 일반적인 1회 섭취량을 가정한다.
                    - 정확한 영양 분석이 아니라 현실적인 범위를 추정한다.
                    - min은 낮은 추정치, max는 높은 추정치다.
                    - estimate는 min과 max 사이의 대표값이다.
                    - serving에는 어떤 양을 가정했는지 한국어로 적는다.
                    - confidence는 양과 음식 구성이 명확하면 high,
                    어느 정도 추정 가능하면 medium,
                    매우 모호하면 low로 정한다.
                    - note에는 추정치가 달라질 수 있는 이유를 한 문장으로 적는다.
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