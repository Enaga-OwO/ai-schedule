import { NextRequest, NextResponse } from 'next/server';
import { createToken, hashPassword, generateUserId, getDataServerUrl, getInternalHeaders } from '@/lib/auth';

// シンプルなユーザーストア（本番ではDBを使う）
// Vercelはサーバーレスなのでメモリ永続化は不可。PHPサーバーにユーザー情報も保存する。

export async function POST(req: NextRequest) {
  try {
    const { email, password, username } = await req.json();
    
    if (!email || !password || !username) {
      return NextResponse.json({ error: '全ての項目を入力してください' }, { status: 400 });
    }
    
    if (password.length < 8) {
      return NextResponse.json({ error: 'パスワードは8文字以上にしてください' }, { status: 400 });
    }
    
    const userId = generateUserId();
    const hashedPassword = await hashPassword(password);
    
    // PHPサーバーにユーザー登録
    const userData = {
      userId,
      profile: { email, username, hashedPassword },
      conversations: [],
      tasks: [],
      achievements: [],
      stats: { totalStudyMinutes: 0, streak: 0, lastActiveDate: null },
      settings: { lineUserId: null, notificationsEnabled: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // ユーザー情報を保存（初回はトークンなしで内部シークレットで）
    const saveRes = await fetch(getDataServerUrl(`/api/register`), {
      method: 'POST',
      headers: getInternalHeaders(),
      body: JSON.stringify(userData),
    });
    
    if (!saveRes.ok) {
      // PHPサーバーが使えない場合でも一時的にトークン発行
      console.warn('PHPサーバーへの保存失敗、ローカルのみで継続');
    }
    
    const token = await createToken({ sub: userId, email, username });
    
    return NextResponse.json({ userId, email, username, token });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
