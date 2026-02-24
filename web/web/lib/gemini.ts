import { GoogleGenerativeAI } from '@google/generative-ai';

// 複数APIキーのロテーション
const API_KEYS = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '')
  .split(',')
  .map(k => k.trim())
  .filter(Boolean);

let currentKeyIndex = 0;
const keyFailCounts: Record<number, number> = {};

function getNextApiKey(): string {
  // レート制限されたキーをスキップ（3回失敗したら一時的にスキップ）
  let attempts = 0;
  while (attempts < API_KEYS.length) {
    const key = API_KEYS[currentKeyIndex];
    if ((keyFailCounts[currentKeyIndex] || 0) < 3) {
      return key;
    }
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    attempts++;
  }
  // 全キーが制限されていたらカウントリセットして最初のキーを使う
  Object.keys(keyFailCounts).forEach(k => { keyFailCounts[Number(k)] = 0; });
  return API_KEYS[0];
}

function markKeyFailed() {
  keyFailCounts[currentKeyIndex] = (keyFailCounts[currentKeyIndex] || 0) + 1;
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
}

function markKeySuccess() {
  keyFailCounts[currentKeyIndex] = 0;
}

// システムプロンプト
const SYSTEM_PROMPT = `あなたは「ライフコーチAI」です。ユーザーの勉強・生活習慣改善をサポートします。

## あなたの役割
- やる気が出ない時：共感して、小さな一歩を一緒に考える。責めない。
- タスク相談：具体的なスケジュールを提案。時間・優先度・カテゴリを整理する。
- 集中サポート：タイマーを勧め、ポモドーロ技法などを活用する。
- 日常会話：友達みたいに自然に話す。でも最後はさりげなく学習に繋げる。
- 実績確認：頑張りを認めて、具体的に褒める。

## 返答スタイル
- 日本語で、フレンドリーかつ具体的に
- 長すぎず（200文字以内を目安）
- 絵文字を適度に使う（使いすぎない）
- 上から目線にならない

## タスク作成時のJSON出力（タスクを作成すべき時のみ末尾に追加）
タスクを作成・提案する場合は、返答の最後に以下のJSONブロックを追加：
\`\`\`task
{"title":"タスク名","category":"勉強|運動|習慣|その他","estimatedMinutes":数値,"scheduledAt":"ISO日時またはnull","description":"詳細"}
\`\`\`

## タイマー指示時のJSON出力
タイマーを開始すべき時は返答の最後に：
\`\`\`timer
{"minutes":数値,"label":"集中タイム|休憩|その他"}
\`\`\`

今日の日時: {{DATETIME}}
ユーザー統計: {{STATS}}`;

export interface Message {
  role: 'user' | 'model';
  parts: [{ text: string }];
}

export interface ChatResponse {
  text: string;
  taskJson?: Record<string, unknown>;
  timerJson?: Record<string, unknown>;
}

// 会話履歴からGemini形式に変換
function formatHistory(conversations: Array<{ role: string; content: string }>): Message[] {
  return conversations.slice(-20).map(c => ({
    role: c.role === 'assistant' ? 'model' : 'user' as 'user' | 'model',
    parts: [{ text: c.content }],
  }));
}

// JSONブロックを抽出
function extractJsonBlock(text: string, type: string): [string, Record<string, unknown> | undefined] {
  const regex = new RegExp(`\`\`\`${type}\\n([\\s\\S]*?)\`\`\``, 'g');
  const match = regex.exec(text);
  if (match) {
    try {
      const json = JSON.parse(match[1].trim());
      const cleaned = text.replace(match[0], '').trim();
      return [cleaned, json];
    } catch {
      return [text, undefined];
    }
  }
  return [text, undefined];
}

export async function chatWithGemini(
  userMessage: string,
  history: Array<{ role: string; content: string }>,
  stats?: Record<string, unknown>
): Promise<ChatResponse> {
  if (API_KEYS.length === 0) {
    throw new Error('Gemini APIキーが設定されていません');
  }

  const systemPrompt = SYSTEM_PROMPT
    .replace('{{DATETIME}}', new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }))
    .replace('{{STATS}}', JSON.stringify(stats || {}));

  const maxRetries = Math.min(API_KEYS.length, 3);
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const apiKey = getNextApiKey();
    
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction: systemPrompt,
      });

      const chat = model.startChat({
        history: formatHistory(history),
        generationConfig: {
          maxOutputTokens: 500,
          temperature: 0.8,
          topP: 0.9,
        },
      });

      const result = await chat.sendMessage(userMessage);
      const responseText = result.response.text();
      
      markKeySuccess();

      // JSONブロック抽出
      let [cleanText, taskJson] = extractJsonBlock(responseText, 'task');
      let timerJson: Record<string, unknown> | undefined;
      [cleanText, timerJson] = extractJsonBlock(cleanText, 'timer');

      return { text: cleanText, taskJson, timerJson };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('rate')) {
        markKeyFailed();
        console.warn(`Gemini key ${attempt + 1}/${maxRetries} rate limited, trying next...`);
        continue;
      }
      throw error;
    }
  }
  
  throw new Error('全てのGemini APIキーがレート制限されています。少し待ってから試してください。');
}
