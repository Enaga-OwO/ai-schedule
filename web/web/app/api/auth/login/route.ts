import { NextRequest, NextResponse } from 'next/server';
import { createToken, verifyPassword, getDataServerUrl, getInternalHeaders } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    
    if (!email || !password) {
      return NextResponse.json({ error: 'メールアドレスとパスワードを入力してください' }, { status: 400 });
    }
    
    // PHPサーバーからユーザー情報取得
    const userRes = await fetch(getDataServerUrl(`/api/user-by-email?email=${encodeURIComponent(email)}`), {
      headers: getInternalHeaders(),
    });
    
    if (!userRes.ok) {
      return NextResponse.json({ error: 'メールアドレスまたはパスワードが違います' }, { status: 401 });
    }
    
    const userData = await userRes.json();
    const isValid = await verifyPassword(password, userData.profile.hashedPassword);
    
    if (!isValid) {
      return NextResponse.json({ error: 'メールアドレスまたはパスワードが違います' }, { status: 401 });
    }
    
    const token = await createToken({
      sub: userData.userId,
      email: userData.profile.email,
      username: userData.profile.username,
    });
    
    return NextResponse.json({
      userId: userData.userId,
      email: userData.profile.email,
      username: userData.profile.username,
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
