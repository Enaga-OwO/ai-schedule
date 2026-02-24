import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getDataServerUrl, getInternalHeaders } from '@/lib/auth';

// 連携コードの一時ストア（本番ではRedisなどを使う）
// Vercelはサーバーレスなので、この実装はPHPサーバー側で管理する
export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  const payload = await verifyToken(token || '');
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const { linkCode } = await req.json();
  
  try {
    // PHPサーバーで連携コードを検証してLINE UserIDと紐付け
    const res = await fetch(getDataServerUrl(`/api/line/verify-link-code`), {
      method: 'POST',
      headers: getInternalHeaders(),
      body: JSON.stringify({ code: linkCode, webUserId: payload.sub }),
    });
    
    if (!res.ok) {
      return NextResponse.json({ error: '無効なコードです' }, { status: 400 });
    }
    
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
