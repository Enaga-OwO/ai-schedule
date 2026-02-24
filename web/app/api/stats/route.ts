import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getDataServerUrl } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  const payload = await verifyToken(token || '');
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  try {
    const res = await fetch(getDataServerUrl(`/api/user/${payload.sub}/stats`), {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (!res.ok) {
      return NextResponse.json({
        stats: { totalStudyMinutes: 0, streak: 0, lastActiveDate: null },
        byCategory: {},
        dailyData: {},
        totalCompleted: 0,
        totalTasks: 0,
      });
    }
    
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
