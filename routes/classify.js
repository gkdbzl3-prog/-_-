import "dotenv/config";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";

const router = express.Router();

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  throw new Error("ANTHROPIC_API_KEY가 .env에 설정되지 않았어.");
}

router.post("/", async (req, res) => {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  });
});

const allowedCategories = new Set([
  "fast",
  "normal",
  "healthy",
]);

router.post("/", async (req, res) => {
  const { name } = req.body;

  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({
      error: "name is required",
    });
  }

  try {
    const message = await anthropic.messages.create({
      // 네 계정에서 사용할 수 있는 모델명으로 넣어야 해.
      model: process.env.CLAUDE_MODEL,
      max_tokens: 10,

      messages: [
        {
          role: "user",
          content: `
다음 음식을 분류해줘.

음식: ${name.trim()}

분류 기준:
- fast: 패스트푸드, 인스턴트, 과자, 튀김류
- normal: 일반적인 한 끼 식사
- healthy: 채소, 과일, 샐러드, 담백하고 균형 잡힌 식사

반드시 fast, normal, healthy 중 하나만 출력해.
          `.trim(),
        },
      ],
    });

    const firstBlock = message.content[0];

    const category =
      firstBlock?.type === "text"
        ? firstBlock.text.trim().toLowerCase()
        : "normal";

    if (!allowedCategories.has(category)) {
      return res.json({ category: "normal" });
    }

    return res.json({ category });
  } catch (error) {
    console.error("Anthropic classification error:", error);

    return res.status(500).json({
      error: "classification failed",
    });
  }
});

export default router;