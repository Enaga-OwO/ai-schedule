import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getDataServerUrl } from '@/lib/auth';
import { chatWithGemini } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    // 1. 認証チェック
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    const { message, history: rawHistory } = await req.json();
    
    if (!message?.trim()) {
      return NextResponse.json({ error: 'メッセージを入力してください' }, { status: 400 });
    }
    
    // --- 【重要】Gemma 3 エラー対策: 履歴の先頭を 'user' に強制する ---
    let history = rawHistory || [];
    // 最初のメッセージが assistant/model だった場合、それを取り除く
    while (history.length > 0 && (history[0].role === 'assistant' || history[0].role === 'model')) {
      history.shift();
    }
    // -----------------------------------------------------------
    
    // 2. ユーザー統計取得（保存先サーバーとの疎通確認も兼ねる）
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
    } catch (e) {
      console.warn('統計取得に失敗しましたが続行します');
    }
    
    // 3. AIとの対話実行
    const response = await chatWithGemini(message, history, stats);
    
    // 4. 会話の保存処理 (data.kt69.f5.si への保存)
    // エンドポイントが正しいか、auth.tsの getDataServerUrl を再確認してください
    const saveMessages = [
      { role: 'user', content: message },
      { role: 'assistant', content: response.text },
    ];
    
    try {
      for (const msg of saveMessages) {
        const saveRes = await fetch(getDataServerUrl(`/api/user/${payload.sub}/conversation`), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            content: msg.content,
            role: msg.role,
            source: 'web' 
          }),
        });
        
        if (!saveRes.ok) {
          console.error(`保存失敗: ${saveRes.status}`);
        }
      }
    } catch (err) {
      console.warn('PHPサーバーへの保存中に通信エラーが発生しました');
    }
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Chat error:', error);
    const errorMessage = error instanceof Error ? error.message : 'AIとの通信に失敗しました';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
