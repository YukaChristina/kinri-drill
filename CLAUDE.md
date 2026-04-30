# 金利ドリル

## プロジェクト概要
金利の変動が経済・市場・資産に与える影響を学ぶWebドリルアプリ。
100問（米国金利50問・日本金利50問）からランダムに10問出題し、選択式＋理由記述をAIが採点する。

## 技術スタック
- **フロントエンド**: Vanilla HTML/CSS/JS（`public/index.html` に全て収録）
- **バックエンド**: Node.js + Express（`server.js`）
- **AI採点**: OpenAI GPT-4o-mini（`/api/score` エンドポイント）
- **デプロイ**: Render.com（`render.yaml` で設定済み）
- **本番URL**: https://kinri-drill.yuka-studio.net

## ファイル構成
```
kinri-drill/
├── server.js          # Expressサーバー（APIエンドポイント・セキュリティ設定）
├── public/
│   ├── index.html     # フロントエンド全体（問題データ含む）
│   ├── manifest.json  # PWAマニフェスト
│   └── icons/icon.svg # ホーム画面アイコン
├── package.json
├── render.yaml        # Renderデプロイ設定
├── .env               # APIキー（Gitに含めない）
└── .env.example       # 環境変数のサンプル
```

## ローカル起動
```bash
cp .env.example .env
# .env の OPENAI_API_KEY に実際のキーを入力
npm install
npm run dev
# http://localhost:3000 でアクセス
```

## 環境変数
| 変数名 | 説明 |
|--------|------|
| `OPENAI_API_KEY` | OpenAI APIキー（必須） |
| `PORT` | ポート番号（デフォルト: 3000） |
| `ALLOWED_ORIGINS` | 許可するオリジン（カンマ区切り、未設定で全許可） |

## API
### POST /api/score
理由記述をAIで採点する。

**リクエスト**
```json
{
  "question": "問題文",
  "correctChoice": "A",
  "selectedChoice": "B",
  "isCorrect": false,
  "reason": "ユーザーの理由記述"
}
```

**レスポンス**
```json
{
  "score": 0,
  "comment": "AIのコメント"
}
```

## スコアリング
- 選択肢正解: 1点
- 理由記述（AI採点）: 1点
- 合計: 1問あたり最大2点、10問で最大20点

## セキュリティ対策
- レート制限（全体: 15分200件、AI採点: 1分15件）
- 入力バリデーション（型・長さ・選択肢の値）
- セキュリティヘッダー（X-Frame-Options等）
- Renderのリバースプロキシ対応（trust proxy設定済み）
