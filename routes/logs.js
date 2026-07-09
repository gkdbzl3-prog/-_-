import express from "express";
import { supabase } from "../supabase.js";

const router = express.Router();

router.post("/", async (req, res) => {
    const {
        logDate,
        name,
        category,
        calorieInfo,
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
        note: calorieInfo?.note ?? null,
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

export default router;