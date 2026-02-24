import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getDataServerUrl } from '@/lib/auth';

// オフライン中に蓄積したデータをサーバーに同期
export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  const payload = await verifyToken(token || '');
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const { conversations, tasks } = await req.json();
  
  const results = { conversations: 0, tasks: 0, errors: [] as string[] };
  
  // 未同期の会話を同期
  if (conversations?.length) {
    for (const msg of conversations) {
      try {
        await fetch(getDataServerUrl(`/api/user/${payload.sub}/conversation`), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(msg),
        });
        results.conversations++;
      } catch {
        results.errors.push(`conversation sync failed: ${msg.id}`);
      }
    }
  }
  
  // 未同期のタスクを同期
  if (tasks?.length) {
    for (const task of tasks) {
      try {
        if (task.isNew) {
          await fetch(getDataServerUrl(`/api/user/${payload.sub}/task`), {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(task),
          });
        } else {
          await fetch(getDataServerUrl(`/api/user/${payload.sub}/task/${task.id}`), {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(task),
          });
        }
        results.tasks++;
      } catch {
        results.errors.push(`task sync failed: ${task.id}`);
      }
    }
  }
  
  return NextResponse.json(results);
}
