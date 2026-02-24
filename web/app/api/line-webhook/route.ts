import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { chatWithGemini } from '@/lib/gemini';
import { getDataServerUrl, getInternalHeaders } from '@/lib/auth';

const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';

function verifyLineSignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac('sha256', LINE_CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  return hash === signature;
}

async function replyToLine(replyToken: string, messages: Array<{ type: string; text: string }>) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('x-line-signature') || '';

  if (!verifyLineSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const { events } = JSON.parse(body);

  for (const event of events) {
    if (event.type !== 'message' || event.message.type !== 'text') continue;

    const lineUserId = event.source.userId;
    const userMessage = event.message.text;
    const replyToken = event.replyToken;

    // 連携コード発行
    if (userMessage.trim() === '連携コード') {
      try {
        const codeRes = await fetch(getDataServerUrl('/api/line/issue-link-code'), {
          method: 'POST',
          headers: getInternalHeaders(),
          body: JSON.stringify({ lineUserId }),
        });

        if (codeRes.ok) {
          const { code } = await codeRes.json();
          await replyToLine(replyToken, [{
            type: 'text',
            text: `連携コードは【 ${code} 】です🔑\n\nWebアプリの設定画面を開いて、10分以内に入力してください！`,
          }]);
        } else {
          await replyToLine(replyToken, [{
            type: 'text',
            text: 'コードの発行に失敗しました😅 もう一度「連携コード」と送ってみて！',
          }]);
        }
      } catch {
        await replyToLine(replyToken, [{
          type: 'text',
          text: 'エラーが発生しました😅 もう一度試してみて！',
        }]);
      }
      continue;
    }

    // 通常のAI会話
    try {
      let history: Array<{ role: string; content: string }> = [];
      let webUserId: string | null = null;

      const userRes = await fetch(getDataServerUrl(`/api/line/user/${lineUserId}`), {
        headers: getInternalHeaders(),
      });

      if (userRes.ok) {
        const userData = await userRes.json();
        webUserId = userData.webUserId;
        history = (userData.data.conversations || [])
          .slice(-20)
          .map((c: { role: string; content: string }) => ({ role: c.role, content: c.content }));
      }

      const response = await chatWithGemini(userMessage, history);

      let fullReply = response.text;
      if (response.taskJson) {
        fullReply += `\n\n📋 タスク「${(response.taskJson as { title: string }).title}」をWebアプリに追加しました！`;
      }
      if (response.timerJson) {
        fullReply += `\n\n⏱ Webアプリでタイマーを${(response.timerJson as { minutes: number }).minutes}分セットしてください！`;
      }

      await replyToLine(replyToken, [{ type: 'text', text: fullReply }]);

      // 会話をPHPサーバーに同期
      if (webUserId) {
        await fetch(getDataServerUrl('/api/line/sync'), {
          method: 'POST',
          headers: getInternalHeaders(),
          body: JSON.stringify({
            userId: webUserId,
            messages: [
              { role: 'user', content: userMessage },
              { role: 'assistant', content: fullReply },
            ],
          }),
        });

        // AIがタスクを提案していれば自動作成
        if (response.taskJson) {
          await fetch(getDataServerUrl(`/api/user/${webUserId}/task`), {
            method: 'POST',
            headers: getInternalHeaders(),
            body: JSON.stringify({ ...response.taskJson, createdBy: 'ai' }),
          });
        }
      }
    } catch (error) {
      console.error('LINE webhook error:', error);
      await replyToLine(replyToken, [{
        type: 'text',
        text: 'ごめん、ちょっと調子が悪いみたい😅 もう一度話しかけてみて！',
      }]);
    }
  }

  return NextResponse.json({ ok: true });
}
