import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface HabitDB extends DBSchema {
  conversations: {
    key: string;
    value: {
      id: string;
      role: 'user' | 'assistant';
      content: string;
      source: 'web' | 'line';
      timestamp: string;
      synced: boolean;
    };
    indexes: { 'by-timestamp': string };
  };
  tasks: {
    key: string;
    value: {
      id: string;
      title: string;
      description: string;
      category: string;
      estimatedMinutes: number;
      scheduledAt: string | null;
      createdBy: 'manual' | 'ai';
      status: 'pending' | 'in_progress' | 'done' | 'skipped';
      actualMinutes: number | null;
      completedAt: string | null;
      createdAt: string;
      synced: boolean;
    };
    indexes: { 'by-status': string; 'by-category': string };
  };
  pendingMessages: {
    key: string;
    value: {
      id: string;
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;
    };
  };
}

let db: IDBPDatabase<HabitDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<HabitDB>> {
  if (db) return db;
  
  db = await openDB<HabitDB>('habit-ai-db', 1, {
    upgrade(db) {
      // 会話テーブル
      const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
      convStore.createIndex('by-timestamp', 'timestamp');
      
      // タスクテーブル
      const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
      taskStore.createIndex('by-status', 'status');
      taskStore.createIndex('by-category', 'category');
      
      // オフライン時の未送信メッセージ
      db.createObjectStore('pendingMessages', { keyPath: 'id' });
    },
  });
  
  return db;
}

// 会話をローカルに保存
export async function saveConversationLocal(message: HabitDB['conversations']['value']) {
  const database = await getDB();
  await database.put('conversations', message);
}

// 会話履歴をローカルから取得
export async function getConversationsLocal(limit = 50): Promise<HabitDB['conversations']['value'][]> {
  const database = await getDB();
  const all = await database.getAllFromIndex('conversations', 'by-timestamp');
  return all.slice(-limit);
}

// タスクをローカルに保存
export async function saveTaskLocal(task: HabitDB['tasks']['value']) {
  const database = await getDB();
  await database.put('tasks', task);
}

// タスク一覧取得
export async function getTasksLocal(status?: string): Promise<HabitDB['tasks']['value'][]> {
  const database = await getDB();
  if (status) {
    return database.getAllFromIndex('tasks', 'by-status', status);
  }
  return database.getAll('tasks');
}

// タスク更新
export async function updateTaskLocal(id: string, updates: Partial<HabitDB['tasks']['value']>) {
  const database = await getDB();
  const task = await database.get('tasks', id);
  if (task) {
    await database.put('tasks', { ...task, ...updates, synced: false });
  }
}

// 未送信メッセージを保存（オフライン時）
export async function savePendingMessage(message: HabitDB['pendingMessages']['value']) {
  const database = await getDB();
  await database.put('pendingMessages', message);
}

// 未送信メッセージを取得してクリア
export async function getAndClearPendingMessages(): Promise<HabitDB['pendingMessages']['value'][]> {
  const database = await getDB();
  const messages = await database.getAll('pendingMessages');
  const tx = database.transaction('pendingMessages', 'readwrite');
  await tx.store.clear();
  await tx.done;
  return messages;
}

// 同期済みとしてマーク
export async function markConversationsSynced(ids: string[]) {
  const database = await getDB();
  const tx = database.transaction('conversations', 'readwrite');
  for (const id of ids) {
    const item = await tx.store.get(id);
    if (item) {
      await tx.store.put({ ...item, synced: true });
    }
  }
  await tx.done;
}
