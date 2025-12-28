import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  sessions, InsertSession, Session,
  messages, InsertMessage, Message,
  dailyReports, InsertDailyReport, DailyReport,
  audioFiles, InsertAudioFile, AudioFile
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ User Functions ============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserNotionConfig(userId: number, notionDatabaseId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users).set({ notionDatabaseId }).where(eq(users.id, userId));
}

// ============ Session Functions ============

export async function createSession(data: InsertSession): Promise<Session> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(sessions).values(data);
  const insertId = result[0].insertId;
  const [session] = await db.select().from(sessions).where(eq(sessions.id, insertId));
  return session;
}

export async function getSessionById(id: number): Promise<Session | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
  return session;
}

export async function getUserSessions(userId: number): Promise<Session[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.createdAt));
}

export async function updateSessionStatus(id: number, status: "active" | "completed" | "archived") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(sessions).set({ status }).where(eq(sessions.id, id));
}

export async function updateSessionTitle(id: number, title: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(sessions).set({ title }).where(eq(sessions.id, id));
}

// ============ Message Functions ============

export async function createMessage(data: InsertMessage): Promise<Message> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(messages).values(data);
  const insertId = result[0].insertId;
  const [message] = await db.select().from(messages).where(eq(messages.id, insertId));
  return message;
}

export async function getSessionMessages(sessionId: number): Promise<Message[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(messages.createdAt);
}

// ============ Daily Report Functions ============

export async function createDailyReport(data: InsertDailyReport): Promise<DailyReport> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(dailyReports).values(data);
  const insertId = result[0].insertId;
  const [report] = await db.select().from(dailyReports).where(eq(dailyReports.id, insertId));
  return report;
}

export async function getDailyReportById(id: number): Promise<DailyReport | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [report] = await db.select().from(dailyReports).where(eq(dailyReports.id, id));
  return report;
}

export async function getUserDailyReports(userId: number): Promise<DailyReport[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(dailyReports)
    .where(eq(dailyReports.userId, userId))
    .orderBy(desc(dailyReports.reportDate));
}

export async function updateDailyReport(id: number, data: Partial<InsertDailyReport>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(dailyReports).set(data).where(eq(dailyReports.id, id));
}

export async function updateDailyReportNotionSync(
  id: number, 
  notionPageId: string, 
  status: "pending" | "synced" | "failed"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(dailyReports).set({
    notionPageId,
    notionSyncStatus: status,
    notionSyncedAt: status === "synced" ? new Date() : undefined,
  }).where(eq(dailyReports.id, id));
}

// ============ Audio File Functions ============

export async function createAudioFile(data: InsertAudioFile): Promise<AudioFile> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(audioFiles).values(data);
  const insertId = result[0].insertId;
  const [file] = await db.select().from(audioFiles).where(eq(audioFiles.id, insertId));
  return file;
}

export async function updateAudioTranscription(id: number, transcription: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(audioFiles).set({
    transcription,
    transcribedAt: new Date(),
  }).where(eq(audioFiles.id, id));
}

export async function getAudioFileById(id: number): Promise<AudioFile | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [file] = await db.select().from(audioFiles).where(eq(audioFiles.id, id));
  return file;
}
