import express from "express";
import { supabase } from "../supabase.js";

const router = express.Router();

router.post("/", async (req, res) => {
    const {
        logDate,
        name,
        category,
        calorieInfo,
        nutrition,
        reason,
        hunger,
        source,
        mealType,
    } = req.body;

    if (
        typeof logDate !== "string" ||
        typeof name !== "string" ||
        !name.trim() ||
        !["fast", "normal", "healthy"].includes(category)
    ) {
        return res.status(400).json({
            error: "invalid food log",
        });
    }

    const row = {
        log_date: logDate,
        name: name.trim(),
        category,

        calories_min: calorieInfo?.calories?.min ?? null,
        calories_max: calorieInfo?.calories?.max ?? null,
        calories_estimate:
        calorieInfo?.calories?.estimate ?? null,

        serving: calorieInfo?.serving ?? null,
        confidence: calorieInfo?.confidence ?? null,
        accuracy: calorieInfo?.accuracy ?? null,
        note: calorieInfo?.note ?? null,

        nutrition:
        nutrition && typeof nutrition === "object" ? nutrition : null,

        reason: typeof reason === "string" && reason.trim() ? reason.trim() : null,
        hunger: typeof hunger === "string" && hunger.trim() ? hunger.trim() : null,
        source: typeof source === "string" && source.trim() ? source.trim() : null,
        meal_type:
        typeof mealType === "string" && mealType.trim() ? mealType.trim() : null,
    };

    const { data, error } = await supabase
    .from("food_logs")
    .insert(row)
    .select()
    .single();

    if (error) {
        console.error("Supabase insert error:", error);

        return res.status(500).json({
            error: "failed to save food log",
            detail: error.message,
            code: error.code,
            hint: error.hint,
            details: error.details,
        });
    }

    return res.status(201).json(data);
});

router.get("/", async (req, res) => {
    const { data, error } = await supabase
    .from("food_logs")
    .select("*")
    .order("log_date", { ascending: true })
    .order("created_at", { ascending: true });

    if (error) {
        console.error("Supabase select error:", error);

        return res.status(500).json({
            error: "failed to load food logs",
        });
    }

    return res.json(data);
});

router.patch("/:id", async (req, res) => {
    const { id } = req.params;
    const { reason, hunger, source, meal_type } = req.body;

    // 전달된 필드만 갱신한다. 명시적으로 null 을 보내면 태그 해제(선택 취소)로 처리.
    const patch = {};

    if ("reason" in req.body) {
        patch.reason =
            typeof reason === "string" && reason.trim() ? reason.trim() : null;
    }
    if ("hunger" in req.body) {
        patch.hunger =
            typeof hunger === "string" && hunger.trim() ? hunger.trim() : null;
    }
    if ("source" in req.body) {
        patch.source =
            typeof source === "string" && source.trim() ? source.trim() : null;
    }
    if ("meal_type" in req.body) {
        patch.meal_type =
            typeof meal_type === "string" && meal_type.trim()
                ? meal_type.trim()
                : null;
    }

    if (Object.keys(patch).length === 0) {
        return res.status(400).json({ error: "no updatable fields" });
    }

    const { data, error } = await supabase
        .from("food_logs")
        .update(patch)
        .eq("id", id)
        .select()
        .single();

    if (error) {
        console.error("Supabase update error:", error);

        return res.status(500).json({
            error: "failed to update food log",
            detail: error.message,
        });
    }

    return res.json(data);
});

router.delete("/:id", async (req, res) => {
    const { id } = req.params;

    const { error } = await supabase
        .from("food_logs")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Supabase delete error:", error);

        return res.status(500).json({
            error: "failed to delete food log",
            detail: error.message,
        });
    }

    return res.status(204).send();
});

export default router;