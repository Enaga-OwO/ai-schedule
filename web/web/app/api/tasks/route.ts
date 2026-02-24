import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getDataServerUrl } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  const payload = await verifyToken(token || '');
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const res = await fetch(getDataServerUrl(`/api/user/${payload.sub}`), {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  
  if (!res.ok) return NextResponse.json({ tasks: [] });
  
  const data = await res.json();
  return NextResponse.json({ tasks: data.tasks || [] });
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  const payload = await verifyToken(token || '');
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const body = await req.json();
  
  const res = await fetch(getDataServerUrl(`/api/user/${payload.sub}/task`), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  
  const task = await res.json();
  return NextResponse.json(task);
}

export async function PUT(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  const payload = await verifyToken(token || '');
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const body = await req.json();
  const { taskId, ...updates } = body;
  
  const res = await fetch(getDataServerUrl(`/api/user/${payload.sub}/task/${taskId}`), {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });
  
  return NextResponse.json(await res.json());
}
