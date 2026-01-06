import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  sessions, InsertSession, Session,
  messages, InsertMessage, Message,
  dailyReports, InsertDailyReport, DailyReport,
  audioFiles, InsertAudioFile, AudioFile,
  okrPeriods, InsertOkrPeriod, OkrPeriod,
  objectives, InsertObjective, Objective,
  keyResults, InsertKeyResult, KeyResult,
  weeklyReports, InsertWeeklyReport, WeeklyReport
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

export async function updateUserWeeklyReportNotionConfig(userId: number, notionWeeklyReportDatabaseId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users).set({ notionWeeklyReportDatabaseId }).where(eq(users.id, userId));
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

export async function deleteDailyReport(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 确保只能删除自己的日报
  const result = await db.delete(dailyReports)
    .where(and(eq(dailyReports.id, id), eq(dailyReports.userId, userId)));
  
  return result[0].affectedRows > 0;
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

// ============ OKR Period Functions ============

export async function createOkrPeriod(period: InsertOkrPeriod): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(okrPeriods).values(period);
  return Number(result[0].insertId);
}

export async function getOkrPeriodsByUser(userId: number): Promise<OkrPeriod[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(okrPeriods)
    .where(eq(okrPeriods.userId, userId))
    .orderBy(desc(okrPeriods.startDate));
}

export async function getActiveOkrPeriod(userId: number): Promise<OkrPeriod | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(okrPeriods)
    .where(and(
      eq(okrPeriods.userId, userId),
      eq(okrPeriods.status, "active")
    ))
    .orderBy(desc(okrPeriods.startDate))
    .limit(1);
  
  return result[0];
}

export async function updateOkrPeriod(id: number, userId: number, updates: Partial<InsertOkrPeriod>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(okrPeriods)
    .set(updates)
    .where(and(eq(okrPeriods.id, id), eq(okrPeriods.userId, userId)));
}

// ============ Objective Functions ============

export async function createObjective(objective: InsertObjective): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(objectives).values(objective);
  return Number(result[0].insertId);
}

export async function getObjectivesByPeriod(periodId: number, userId: number): Promise<Objective[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(objectives)
    .where(and(
      eq(objectives.periodId, periodId),
      eq(objectives.userId, userId)
    ))
    .orderBy(objectives.order);
}

export async function updateObjective(id: number, userId: number, updates: Partial<InsertObjective>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(objectives)
    .set(updates)
    .where(and(eq(objectives.id, id), eq(objectives.userId, userId)));
}

export async function deleteObjective(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 先删除关联的 Key Results
  await db.delete(keyResults)
    .where(and(eq(keyResults.objectiveId, id), eq(keyResults.userId, userId)));
  
  // 再删除 Objective
  await db.delete(objectives)
    .where(and(eq(objectives.id, id), eq(objectives.userId, userId)));
}

// ============ Key Result Functions ============

export async function createKeyResult(keyResult: InsertKeyResult): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(keyResults).values(keyResult);
  return Number(result[0].insertId);
}

export async function getKeyResultsByObjective(objectiveId: number, userId: number): Promise<KeyResult[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(keyResults)
    .where(and(
      eq(keyResults.objectiveId, objectiveId),
      eq(keyResults.userId, userId)
    ))
    .orderBy(keyResults.order);
}

export async function updateKeyResult(id: number, userId: number, updates: Partial<InsertKeyResult>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(keyResults)
    .set(updates)
    .where(and(eq(keyResults.id, id), eq(keyResults.userId, userId)));
}

export async function deleteKeyResult(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(keyResults)
    .where(and(eq(keyResults.id, id), eq(keyResults.userId, userId)));
}

// ============ Weekly Report Functions ============

export async function createWeeklyReport(report: InsertWeeklyReport): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(weeklyReports).values(report);
  return Number(result[0].insertId);
}

export async function getWeeklyReportsByUser(userId: number): Promise<WeeklyReport[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(weeklyReports)
    .where(eq(weeklyReports.userId, userId))
    .orderBy(desc(weeklyReports.weekStartDate));
}

export async function getWeeklyReportById(id: number, userId: number): Promise<WeeklyReport | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(weeklyReports)
    .where(and(eq(weeklyReports.id, id), eq(weeklyReports.userId, userId)))
    .limit(1);
  
  return result[0];
}

export async function updateWeeklyReport(id: number, userId: number, updates: Partial<InsertWeeklyReport>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(weeklyReports)
    .set(updates)
    .where(and(eq(weeklyReports.id, id), eq(weeklyReports.userId, userId)));
}

export async function deleteWeeklyReport(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(weeklyReports)
    .where(and(eq(weeklyReports.id, id), eq(weeklyReports.userId, userId)));
}
