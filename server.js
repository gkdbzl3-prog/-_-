import express from 'express';
import dotenv from 'dotenv';
import classifyRouter from './routes/classify.js';
import caloriesRouter from "./routes/calories.js";
import logsRouter from "./routes/logs.js";
import retrospectRouter from "./routes/retrospect.js";
import nutritionRouter from "./routes/nutrition.js";
import { requireAuth } from "./authMiddleware.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});

app.use(express.json());

app.use(express.static('public'));

// 클라이언트 로그인용 공개 설정 (anon 키는 공개돼도 안전)
app.get("/api/config", (req, res) => {
  res.json({
    url: process.env.SUPABASE_URL || "",
    anonKey: process.env.SUPABASE_ANON_KEY || "",
  });
});

// 이하 모든 API 는 로그인 필요
app.use('/api/classify', requireAuth, classifyRouter);
app.use("/api/calories", requireAuth, caloriesRouter);
app.use("/api/logs", requireAuth, logsRouter);
app.use("/api/retrospect", requireAuth, retrospectRouter);
app.use("/api/nutrition", requireAuth, nutritionRouter);