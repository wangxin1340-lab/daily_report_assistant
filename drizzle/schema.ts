import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  // Notion 集成配置
  notionDatabaseId: varchar("notionDatabaseId", { length: 64 }), // 日报数据库 ID
  notionWeeklyReportDatabaseId: varchar("notionWeeklyReportDatabaseId", { length: 64 }), // 周报数据库 ID
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 对话会话表 - 每次日报生成对应一个会话
 */
export const sessions = mysqlTable("sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }),
  status: mysqlEnum("status", ["active", "completed", "archived"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

/**
 * 消息记录表 - 存储对话中的每条消息
 */
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  // 如果是语音消息，存储语音文件信息
  audioUrl: text("audioUrl"),
  audioKey: varchar("audioKey", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

/**
 * 日报表 - 存储生成的结构化日报
 */
export const dailyReports = mysqlTable("daily_reports", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  sessionId: int("sessionId").notNull(),
  reportDate: timestamp("reportDate").notNull(),
  // 结构化日报内容
  workContent: text("workContent"), // 工作内容
  completionStatus: text("completionStatus"), // 完成情况
  problems: text("problems"), // 遇到的问题
  tomorrowPlan: text("tomorrowPlan"), // 明日计划
  businessInsights: text("businessInsights"), // 业务洞察和思考
  summary: text("summary"), // 总结
  // 原始 Markdown 格式日报
  markdownContent: text("markdownContent"),
  // Notion 同步状态
  notionPageId: varchar("notionPageId", { length: 64 }),
  notionSyncedAt: timestamp("notionSyncedAt"),
  notionSyncStatus: mysqlEnum("notionSyncStatus", ["pending", "synced", "failed"]).default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DailyReport = typeof dailyReports.$inferSelect;
export type InsertDailyReport = typeof dailyReports.$inferInsert;

/**
 * 语音文件表 - 存储上传的语音文件元数据
 */
export const audioFiles = mysqlTable("audio_files", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  sessionId: int("sessionId"),
  messageId: int("messageId"),
  filename: varchar("filename", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 255 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  mimeType: varchar("mimeType", { length: 64 }),
  fileSize: int("fileSize"),
  duration: int("duration"), // 音频时长（秒）
  transcription: text("transcription"), // Whisper 转录结果
  transcribedAt: timestamp("transcribedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AudioFile = typeof audioFiles.$inferSelect;
export type InsertAudioFile = typeof audioFiles.$inferInsert;

/**
 * OKR 周期表 - 存储双月 OKR 周期
 */
export const okrPeriods = mysqlTable("okr_periods", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(), // 例如："2025 Q1-Q2 OKR"
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  status: mysqlEnum("status", ["active", "completed", "archived"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OkrPeriod = typeof okrPeriods.$inferSelect;
export type InsertOkrPeriod = typeof okrPeriods.$inferInsert;

/**
 * Objectives 表 - 存储目标
 */
export const objectives = mysqlTable("objectives", {
  id: int("id").autoincrement().primaryKey(),
  periodId: int("periodId").notNull(),
  userId: int("userId").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  order: int("order").default(0).notNull(), // 排序
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Objective = typeof objectives.$inferSelect;
export type InsertObjective = typeof objectives.$inferInsert;

/**
 * Key Results 表 - 存储关键结果
 */
export const keyResults = mysqlTable("key_results", {
  id: int("id").autoincrement().primaryKey(),
  objectiveId: int("objectiveId").notNull(),
  userId: int("userId").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  targetValue: varchar("targetValue", { length: 255 }), // 目标值（如 "100%"、"50个"）
  currentValue: varchar("currentValue", { length: 255 }), // 当前值
  unit: varchar("unit", { length: 64 }), // 单位
  order: int("order").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type KeyResult = typeof keyResults.$inferSelect;
export type InsertKeyResult = typeof keyResults.$inferInsert;

/**
 * 周报表 - 存储生成的周报
 */
export const weeklyReports = mysqlTable("weekly_reports", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  periodId: int("periodId"), // 关联的 OKR 周期
  weekStartDate: timestamp("weekStartDate").notNull(),
  weekEndDate: timestamp("weekEndDate").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  // 周报内容
  summary: text("summary"), // 本周总结
  okrProgress: json("okrProgress"), // OKR 进展（JSON 格式）
  achievements: text("achievements"), // 主要成果
  problems: text("problems"), // 问题和挑战
  nextWeekPlan: text("nextWeekPlan"), // 下周计划
  markdownContent: text("markdownContent"), // 完整 Markdown 内容
  // 关联的日报 ID 列表
  dailyReportIds: json("dailyReportIds"), // 数组格式：[1, 2, 3]
  // Notion 同步状态
  notionPageId: varchar("notionPageId", { length: 64 }),
  notionSyncedAt: timestamp("notionSyncedAt"),
  notionSyncStatus: mysqlEnum("notionSyncStatus", ["pending", "synced", "failed"]).default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WeeklyReport = typeof weeklyReports.$inferSelect;
export type InsertWeeklyReport = typeof weeklyReports.$inferInsert;
