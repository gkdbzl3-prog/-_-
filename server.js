import express from 'express';
import dotenv from 'dotenv';
import classifyRouter from './routes/classify.js';
import caloriesRouter from "./routes/calories.js";
import logsRouter from "./routes/logs.js";
import retrospectRouter from "./routes/retrospect.js";
import nutritionRouter from "./routes/nutrition.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});

app.use(express.json());

app.use(express.static('public'));

app.use('/api/classify', classifyRouter);
app.use("/api/calories", caloriesRouter);
app.use("/api/logs", logsRouter);
app.use("/api/retrospect", retrospectRouter);
app.use("/api/nutrition", nutritionRouter);