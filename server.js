// Express 서버 진입점
import express from 'express';
import dotenv from 'dotenv';
import classifyRouter from './routes/classify.js';

// .env 파일의 환경 변수를 로드
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});

// JSON 요청 본문을 파싱
app.use(express.json());

// public 폴더를 정적 파일로 제공 (빌드된 프론트엔드)
app.use(express.static('public'));

// /api/classify 경로에 분류 라우터 연결
app.use('/api/classify', classifyRouter);

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
