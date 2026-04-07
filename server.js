const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Security headers (without helmet to keep inline scripts working)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [];

app.use(cors({
  origin: (origin, cb) => {
    // Allow same-origin (no origin header) and configured origins
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return cb(null, true);
    }
    cb(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST'],
}));

// Body parsing with size limit
app.use(express.json({ limit: '16kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiter for all requests (prevents scraping / flooding)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'リクエストが多すぎます。しばらくしてからお試しください。' },
});
app.use(globalLimiter);

// Stricter limiter for AI scoring (costs money per call)
const scoreLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AIの採点リクエストが多すぎます。少し待ってからお試しください。' },
});

// Health check (for uptime monitors / deployment platforms)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/score', scoreLimiter, async (req, res) => {
  const { question, correctChoice, selectedChoice, isCorrect, reason } = req.body;

  // Input validation
  if (
    typeof question !== 'string' || !question.trim() ||
    typeof correctChoice !== 'string' ||
    typeof selectedChoice !== 'string' ||
    typeof isCorrect !== 'boolean' ||
    typeof reason !== 'string' || !reason.trim()
  ) {
    return res.status(400).json({ error: '入力データが不正です' });
  }

  // Length limits to prevent prompt injection / abuse
  if (question.length > 600 || reason.length > 1200) {
    return res.status(400).json({ error: '入力が長すぎます' });
  }

  // Validate choice values
  const validChoices = ['A', 'B', 'C', 'D'];
  if (!validChoices.includes(correctChoice) || !validChoices.includes(selectedChoice)) {
    return res.status(400).json({ error: '選択肢の値が不正です' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes('ここに')) {
    return res.status(503).json({ error: 'AI採点サービスは現在利用できません' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 150,
        messages: [
          {
            role: 'system',
            content: 'あなたは経済・金融の教師です。学習者の回答を採点し、必ずJSON形式のみで返答してください。理由記述が経済的な因果関係を正しく説明できていれば1点、不十分または空欄なら0点を付与してください。',
          },
          {
            role: 'user',
            content: `【問題】${question} / 【正解選択肢】${correctChoice} / 【学習者の選択】${selectedChoice}（${isCorrect ? '正解' : '不正解'}）/ 【理由記述】${reason} → JSON: {"score": 0か1, "comment": "日本語100字以内の採点コメント"}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      console.error('OpenAI error:', response.status, body);
      return res.status(502).json({ error: 'AI採点サービスへの接続に失敗しました' });
    }

    const data = await response.json();
    const text = data.choices[0].message.content.trim();

    try {
      const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || text;
      const parsed = JSON.parse(jsonStr);
      res.json({
        score: Math.min(1, Math.max(0, parseInt(parsed.score) || 0)),
        comment: String(parsed.comment || '').slice(0, 300),
      });
    } catch {
      res.json({ score: 0, comment: '採点結果の解析に失敗しました。' });
    }
  } catch (error) {
    console.error('Score API error:', error.message);
    res.status(500).json({ error: '採点サービスに接続できませんでした' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ 金利ドリル起動中: http://localhost:${PORT}`);
});
