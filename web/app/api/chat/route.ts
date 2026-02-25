import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getDataServerUrl } from '@/lib/auth';
import { chatWithGemini } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    // 認証
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    const { message, history: rawHistory } = await req.json(); // 変数名を rawHistory に変更
    
    if (!message?.trim()) {
      return NextResponse.json({ error: 'メッセージを入力してください' }, { status: 400 });
    }

    // --- 【修正ポイント: 履歴のクレンジング】 ---
    let history = rawHistory || [];
    
    // Gemma 3 (Google AI SDK) の制約: 最初のメッセージは必ず 'user' である必要がある
    // もし履歴の最初が assistant/model だった場合、それを削除する
    while (history.length > 0 && (history[0].role === 'assistant' || history[0].role === 'model')) {
      history.shift();
    }
    // ------------------------------------------
    
    // ユーザー統計取得（任意）
    let stats = {};
    try {
      const statsRes = await fetch(getDataServerUrl(`/api/user/${payload.sub}/stats`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (statsRes.ok) {
        stats = await statsRes.json();
      }
    } catch {
      // 統計取得失敗しても続行
    }
    
    // Gemini APIで返答生成 (修正済みの history を渡す)
    const response = await chatWithGemini(message, history, stats);
    
    // 会話をPHPサーバーに保存
    const saveMessages = [
      { role: 'user', content: message },
      { role: 'assistant', content: response.text },
    ];
    
    try {
      for (const msg of saveMessages) {
        await fetch(getDataServerUrl(`/api/user/${payload.sub}/conversation`), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...msg, source: 'web' }),
        });
      }
    } catch {
      // 保存失敗しても返答は返す
      console.warn('会話の保存失敗');
    }
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Chat error:', error);
    const message = error instanceof Error ? error.message : 'AIとの通信に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
