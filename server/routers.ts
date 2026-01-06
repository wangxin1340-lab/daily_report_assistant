import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { transcribeAudio } from "./_core/voiceTranscription";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import {
  createSession, getSessionById, getUserSessions, updateSessionStatus, updateSessionTitle,
  createMessage, getSessionMessages,
  createDailyReport, getDailyReportById, getUserDailyReports, updateDailyReport, updateDailyReportNotionSync, deleteDailyReport,
  createAudioFile, updateAudioTranscription,
  updateUserNotionConfig, updateUserWeeklyReportNotionConfig,
  createOkrPeriod, getOkrPeriodsByUser, getActiveOkrPeriod, updateOkrPeriod,
  createObjective, getObjectivesByPeriod, updateObjective, deleteObjective,
  createKeyResult, getKeyResultsByObjective, updateKeyResult, deleteKeyResult,
  createWeeklyReport, getWeeklyReportsByUser, getWeeklyReportById, updateWeeklyReport, deleteWeeklyReport,
} from "./db";
import { prepareNotionSyncData, generateNotionMCPParams, generateSyncInstructions } from "./notion";
import { syncReportToNotion, syncWeeklyReportToNotion, fetchNotionDatabaseInfo } from "./notionSync";

// 日报生成的系统提示词
const DAILY_REPORT_SYSTEM_PROMPT = `# Role
你是一位兼职做"敏捷项目经理"的"王牌脱口秀演员"。你的工作是通过幽默、犠利、略带调侃（Roast）的访谈形式，引导用户回顾一天的工作。在对话风格上多学习罗永浩、付航、李诞这些人的脱口秀表演。

# Objectives
1. **引导回顾**：通过对话，获取用户今日的[完成工作]、[未完成工作]、[遇到的困难]、[明日计划]、[思考与感悟]。
2. **深度挖掘**：当用户回答笼统时（如"开了个会"），你要用段子手的方式追问细节（如"是那种'这本来可以是一封邮件'的会，还是'天塔了'的会？具体讨论了啥结论？"）。
3. **业务洞察**：引导用户思考工作背后的业务价值，但要用幽默的方式（如"这个需求背后，用户真正想要的是什么？还是说产品经理自己也不知道？"）。
4. **最终产出**：当用户说"汇报结束"、"生成日报"、"完成"或类似表达时，在回复中包含 [READY_TO_GENERATE] 标记。

# Tone & Style (访谈阶段)
- **幽默犠利**：参考脱口秀风格，多用比喻、反讽、夸张。比如用户说"今天写了一天代码"，你可以说"写了一天？那你现在应该已经进入'代码写我'的状态了吧？具体写了啥功能？"
- **拒绝官话**：不要说"请问您今天的进度如何"，要说"今天是被工作玩了，还是你玩了工作？"
- **共情打工人**：站在用户这边吐槽甲方、吐槽Bug、吐槽无意义的流程，但目的是为了套出实话。
- **节奏感**：像聊天一样，不要一次问太多问题，一个一个来。每次只问1个问题。
- **适度调侃**：可以小小地挑逗用户，但不要过分，保持友善。

# Interaction Workflow
1. **开场**：用一个关于工作的段子或调侃开场，询问今天干了啥。
2. **追问**：根据用户的回答，进行幽默的互动并挖掘具体数据、结果和阻碍。
3. **业务洞察**：在合适的时机，用幽默的方式引导用户思考业务价值。
4. **明日计划**：询问明天的工作计划。
5. **结案**：用户确认结束后，输出 [READY_TO_GENERATE] 标记。

# 示例对话
- 用户："今天开了个会"
  你："开会？是那种'这本来可以是一封邮件'的会，还是'天塔了大家快来救火'的会？具体讨论了啥？"

- 用户："修了一个Bug"
  你："修 Bug？这个 Bug 是你自己写的还是前人留下的历史遗产？修了多久，有没有那种'修了一个出来三个'的惊喜？"

- 用户："和产品经理对需求"
  你："哦豁，这是一场和平的需求对齐，还是一场惊心动魄的灵魂拷问？最后谁赢了？"

记住：你的目标是让用户在轻松愉快的氛围中把一天的工作细节吐露出来，让"写日报"变成一种解压方式。`;

// 日报格式化的系统提示词
const REPORT_FORMAT_PROMPT = `你现在是一位资深商务秘书，需要根据以下对话内容，生成一份结构化的工作日报。

# Tone & Style (日报生成阶段)
- **极度专业**：结构化清晰，用词精准
- **客观冷静**：去除所有情绪化词汇和之前的玩笑
- **语言转化**：将口语化表达转为专业表述（如：将"跟那个傻 X 吵了一架"转化为"与相关方进行了深入的需求对齐，并最终达成共识"）

输出格式要求（JSON）：
{
  "workContent": "今日工作内容的详细描述，使用 Markdown 格式，每项工作用列表形式展示，语言专业严谨",
  "completionStatus": "各项工作的完成情况说明，客观陈述",
  "problems": "遇到的问题和困难，以及解决方案或计划（如果没有则写“无”）",
  "tomorrowPlan": "明日工作计划，条理清晰",
  "businessInsights": "业务洞察与思考：提炼用户在对话中提到的对业务场景、用户需求、产品优化、流程改进等方面的思考和发现。如果用户没有提及，则写“无”",
  "summary": "一句话专业总结今日工作，突出最有价值的成果或洞察"
}

重要提示：
- 对话中的幽默、吐槽、玩笑话都要去除，只保留实质内容
- 将口语化表达转为专业严谨的书面语言
- businessInsights 字段非常重要，要仔细提炼用户对业务的思考和洞察
- 请确保输出是有效的 JSON 格式`;

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // 会话管理
  session: router({
    // 创建新会话
    create: protectedProcedure.mutation(async ({ ctx }) => {
      const session = await createSession({
        userId: ctx.user.id,
        title: `日报 - ${new Date().toLocaleDateString('zh-CN')}`,
        status: "active",
      });
      
      // 创建系统欢迎消息（脱口秀风格）
      await createMessage({
        sessionId: session.id,
        role: "assistant",
        content: "你好！我是你的日报助手。请告诉我你今天主要完成了哪些工作？",
      });
      
      return session;
    }),

    // 获取用户所有会话
    list: protectedProcedure.query(async ({ ctx }) => {
      return getUserSessions(ctx.user.id);
    }),

    // 获取单个会话详情
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getSessionById(input.id);
      }),

    // 获取会话消息
    messages: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        return getSessionMessages(input.sessionId);
      }),

    // 更新会话状态
    updateStatus: protectedProcedure
      .input(z.object({ 
        id: z.number(), 
        status: z.enum(["active", "completed", "archived"]) 
      }))
      .mutation(async ({ input }) => {
        await updateSessionStatus(input.id, input.status);
        return { success: true };
      }),
  }),

  // 聊天功能
  chat: router({
    // 发送消息并获取 AI 回复
    send: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        content: z.string(),
        audioUrl: z.string().optional(),
        audioKey: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // 保存用户消息
        const userMessage = await createMessage({
          sessionId: input.sessionId,
          role: "user",
          content: input.content,
          audioUrl: input.audioUrl,
          audioKey: input.audioKey,
        });

        // 获取会话历史
        const history = await getSessionMessages(input.sessionId);
        
        // 构建 LLM 消息
        const llmMessages = [
          { role: "system" as const, content: DAILY_REPORT_SYSTEM_PROMPT },
          ...history.map(msg => ({
            role: msg.role as "user" | "assistant" | "system",
            content: msg.content,
          })),
        ];

        // 调用 LLM
        const response = await invokeLLM({ messages: llmMessages });
        const rawContent = response.choices[0]?.message?.content;
        const assistantContent = typeof rawContent === 'string' ? rawContent : "抱歉，我暂时无法回复。";

        // 保存助手回复
        const assistantMessage = await createMessage({
          sessionId: input.sessionId,
          role: "assistant",
          content: assistantContent,
        });

        // 检查是否准备好生成日报
        const readyToGenerate = assistantContent.includes("[READY_TO_GENERATE]");

        return {
          userMessage,
          assistantMessage: {
            ...assistantMessage,
            content: assistantContent.replace("[READY_TO_GENERATE]", "").trim(),
          },
          readyToGenerate,
        };
      }),

    // 语音转文字
    transcribe: protectedProcedure
      .input(z.object({
        audioUrl: z.string(),
        sessionId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await transcribeAudio({
          audioUrl: input.audioUrl,
          language: "zh",
          prompt: "这是一段工作汇报的语音",
        });

        // 检查是否是错误响应
        if ('error' in result) {
          throw new Error(result.error);
        }

        return {
          text: result.text,
          language: result.language,
        };
      }),
  }),

  // 日报管理
  report: router({
    // 生成日报
    generate: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // 获取会话消息
        const messages = await getSessionMessages(input.sessionId);
        
        // 构建对话内容摘要
        const conversationSummary = messages
          .filter(m => m.role !== "system")
          .map(m => `${m.role === "user" ? "用户" : "助手"}: ${m.content}`)
          .join("\n");

        // 调用 LLM 生成结构化日报
        const response = await invokeLLM({
          messages: [
            { role: "system", content: REPORT_FORMAT_PROMPT },
            { role: "user", content: `对话内容：\n${conversationSummary}` },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "daily_report",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  workContent: { type: "string", description: "工作内容" },
                  completionStatus: { type: "string", description: "完成情况" },
                  problems: { type: "string", description: "遇到的问题" },
                  tomorrowPlan: { type: "string", description: "明日计划" },
                  businessInsights: { type: "string", description: "业务洞察与思考" },
                  summary: { type: "string", description: "总结" },
                },
                required: ["workContent", "completionStatus", "problems", "tomorrowPlan", "businessInsights", "summary"],
                additionalProperties: false,
              },
            },
          },
        });

        const rawReportContent = response.choices[0]?.message?.content;
        const reportContent = JSON.parse(typeof rawReportContent === 'string' ? rawReportContent : "{}");

        // 生成 Markdown 格式日报
        const markdownContent = `# 工作日报 - ${new Date().toLocaleDateString('zh-CN')}

## 📋 工作内容
${reportContent.workContent}

## ✅ 完成情况
${reportContent.completionStatus}

## ⚠️ 遇到的问题
${reportContent.problems}

## 💡 业务洞察与思考
${reportContent.businessInsights}

## 📅 明日计划
${reportContent.tomorrowPlan}

## 📝 总结
${reportContent.summary}
`;

        // 保存日报
        const report = await createDailyReport({
          userId: ctx.user.id,
          sessionId: input.sessionId,
          reportDate: new Date(),
          workContent: reportContent.workContent,
          completionStatus: reportContent.completionStatus,
          problems: reportContent.problems,
          tomorrowPlan: reportContent.tomorrowPlan,
          businessInsights: reportContent.businessInsights,
          summary: reportContent.summary,
          markdownContent,
          notionSyncStatus: "pending",
        });

        // 更新会话状态
        await updateSessionStatus(input.sessionId, "completed");
        await updateSessionTitle(input.sessionId, `日报 - ${reportContent.summary.slice(0, 20)}...`);

        return report;
      }),

    // 获取用户所有日报
    list: protectedProcedure.query(async ({ ctx }) => {
      return getUserDailyReports(ctx.user.id);
    }),

    // 获取单个日报详情
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getDailyReportById(input.id);
      }),

    // 更新日报
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        workContent: z.string().optional(),
        completionStatus: z.string().optional(),
        problems: z.string().optional(),
        tomorrowPlan: z.string().optional(),
        businessInsights: z.string().optional(),
        summary: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        
        // 重新生成 Markdown
        const report = await getDailyReportById(id);
        if (!report) throw new Error("Report not found");

        const updatedReport = { ...report, ...data };
        const markdownContent = `# 工作日报 - ${new Date(report.reportDate).toLocaleDateString('zh-CN')}

## 📋 工作内容
${updatedReport.workContent}

## ✅ 完成情况
${updatedReport.completionStatus}

## ⚠️ 遇到的问题
${updatedReport.problems}

## 💡 业务洞察与思考
${updatedReport.businessInsights || '无'}

## 📅 明日计划
${updatedReport.tomorrowPlan}

## 📝 总结
${updatedReport.summary}
`;

        await updateDailyReport(id, { ...data, markdownContent });
        return { success: true };
      }),

    // 同步到 Notion - 实际执行同步
    syncToNotion: protectedProcedure
      .input(z.object({ reportId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const report = await getDailyReportById(input.reportId);
        if (!report) throw new Error("日报不存在");

        const notionDatabaseId = ctx.user.notionDatabaseId;
        if (!notionDatabaseId) {
          throw new Error("请先在设置页面配置 Notion 数据库 ID");
        }

        // 获取 data_source_id（如果用户提供的是 database_id）
        const dbInfo = await fetchNotionDatabaseInfo(notionDatabaseId);
        if (!dbInfo.success) {
          throw new Error(dbInfo.error || "获取 Notion 数据库信息失败");
        }

        const dataSourceId = dbInfo.dataSourceId || notionDatabaseId;

        // 执行同步
        const syncResult = await syncReportToNotion(report, dataSourceId);
        
        if (!syncResult.success) {
          // 更新同步状态为失败
          await updateDailyReportNotionSync(input.reportId, "", "failed");
          throw new Error(syncResult.error || "同步到 Notion 失败");
        }

        // 更新同步状态为成功
        await updateDailyReportNotionSync(
          input.reportId, 
          syncResult.pageId || "", 
          "synced"
        );

        return {
          success: true,
          pageId: syncResult.pageId,
          pageUrl: syncResult.pageUrl,
        };
      }),

    // 更新 Notion 同步状态
    updateNotionSync: protectedProcedure
      .input(z.object({
        reportId: z.number(),
        notionPageId: z.string(),
        status: z.enum(["pending", "synced", "failed"]),
      }))
      .mutation(async ({ input }) => {
        await updateDailyReportNotionSync(input.reportId, input.notionPageId, input.status);
        return { success: true };
      }),

    // 删除日报
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const deleted = await deleteDailyReport(input.id, ctx.user.id);
        if (!deleted) {
          throw new Error("日报不存在或无权删除");
        }
        return { success: true };
      }),
  }),

  // 音频文件管理
  audio: router({
    // 上传音频文件
    upload: protectedProcedure
      .input(z.object({
        filename: z.string(),
        mimeType: z.string(),
        base64Data: z.string(),
        sessionId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const fileKey = `audio/${ctx.user.id}/${nanoid()}-${input.filename}`;
        const buffer = Buffer.from(input.base64Data, "base64");
        
        const { url } = await storagePut(fileKey, buffer, input.mimeType);

        const audioFile = await createAudioFile({
          userId: ctx.user.id,
          sessionId: input.sessionId,
          filename: input.filename,
          fileKey,
          fileUrl: url,
          mimeType: input.mimeType,
          fileSize: buffer.length,
        });

        return audioFile;
      }),

    // 转录音频
    transcribe: protectedProcedure
      .input(z.object({ audioId: z.number() }))
      .mutation(async ({ input }) => {
        const audioFile = await import("./db").then(m => m.getAudioFileById(input.audioId));
        if (!audioFile) throw new Error("Audio file not found");

        const result = await transcribeAudio({
          audioUrl: audioFile.fileUrl,
          language: "zh",
        });

        // 检查是否是错误响应
        if ('error' in result) {
          throw new Error(result.error);
        }

        await updateAudioTranscription(input.audioId, result.text);

        return {
          text: result.text,
          language: result.language,
        };
      }),
  }),

  // 用户设置
  settings: router({
    // 更新 Notion 配置
    updateNotionConfig: protectedProcedure
      .input(z.object({
        notionDatabaseId: z.string().optional(),
        notionWeeklyReportDatabaseId: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (input.notionDatabaseId) {
          await updateUserNotionConfig(ctx.user.id, input.notionDatabaseId);
        }
        if (input.notionWeeklyReportDatabaseId) {
          await updateUserWeeklyReportNotionConfig(ctx.user.id, input.notionWeeklyReportDatabaseId);
        }
        return { success: true };
      }),
  }),

  // OKR 管理
  okr: router({
    // 创建 OKR 周期
    createPeriod: protectedProcedure
      .input(z.object({
        title: z.string(),
        startDate: z.date(),
        endDate: z.date(),
      }))
      .mutation(async ({ input, ctx }) => {
        const periodId = await createOkrPeriod({
          userId: ctx.user.id,
          ...input,
        });
        return { periodId };
      }),

    // 获取用户的所有 OKR 周期
    listPeriods: protectedProcedure
      .query(async ({ ctx }) => {
        return getOkrPeriodsByUser(ctx.user.id);
      }),

    // 获取当前活跃的 OKR 周期
    getActivePeriod: protectedProcedure
      .query(async ({ ctx }) => {
        return getActiveOkrPeriod(ctx.user.id);
      }),

    // 更新 OKR 周期
    updatePeriod: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        status: z.enum(["active", "completed", "archived"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...updates } = input;
        await updateOkrPeriod(id, ctx.user.id, updates);
        return { success: true };
      }),

    // 创建 Objective
    createObjective: protectedProcedure
      .input(z.object({
        periodId: z.number(),
        title: z.string(),
        description: z.string().optional(),
        order: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const objectiveId = await createObjective({
          userId: ctx.user.id,
          ...input,
        });
        return { objectiveId };
      }),

    // 获取某个周期的所有 Objectives
    listObjectives: protectedProcedure
      .input(z.object({ periodId: z.number() }))
      .query(async ({ input, ctx }) => {
        return getObjectivesByPeriod(input.periodId, ctx.user.id);
      }),

    // 更新 Objective
    updateObjective: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        order: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...updates } = input;
        await updateObjective(id, ctx.user.id, updates);
        return { success: true };
      }),

    // 删除 Objective
    deleteObjective: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deleteObjective(input.id, ctx.user.id);
        return { success: true };
      }),

    // 创建 Key Result
    createKeyResult: protectedProcedure
      .input(z.object({
        objectiveId: z.number(),
        title: z.string(),
        description: z.string().optional(),
        targetValue: z.string().optional(),
        currentValue: z.string().optional(),
        unit: z.string().optional(),
        order: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const keyResultId = await createKeyResult({
          userId: ctx.user.id,
          ...input,
        });
        return { keyResultId };
      }),

    // 获取某个 Objective 的所有 Key Results
    listKeyResults: protectedProcedure
      .input(z.object({ objectiveId: z.number() }))
      .query(async ({ input, ctx }) => {
        return getKeyResultsByObjective(input.objectiveId, ctx.user.id);
      }),

    // 更新 Key Result
    updateKeyResult: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        targetValue: z.string().optional(),
        currentValue: z.string().optional(),
        unit: z.string().optional(),
        order: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...updates } = input;
        await updateKeyResult(id, ctx.user.id, updates);
        return { success: true };
      }),

    // 删除 Key Result
    deleteKeyResult: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deleteKeyResult(input.id, ctx.user.id);
        return { success: true };
      }),

    // 获取完整的 OKR 结构（包含 Objectives 和 Key Results）
    getFullOkr: protectedProcedure
      .input(z.object({ periodId: z.number() }))
      .query(async ({ input, ctx }) => {
        const objectives = await getObjectivesByPeriod(input.periodId, ctx.user.id);
        const fullOkr = await Promise.all(
          objectives.map(async (obj) => {
            const keyResults = await getKeyResultsByObjective(obj.id, ctx.user.id);
            return { ...obj, keyResults };
          })
        );
        return fullOkr;
      }),
  }),

  // 周报管理
  weeklyReport: router({
    // 生成周报
    generate: protectedProcedure
      .input(z.object({
        weekStartDate: z.date(),
        weekEndDate: z.date(),
        periodId: z.number().optional(),
        dailyReportIds: z.array(z.number()),
      }))
      .mutation(async ({ input, ctx }) => {
        // 获取选中的日报
        const dailyReportsData = await Promise.all(
          input.dailyReportIds.map(id => getDailyReportById(id))
        );
        const dailyReports = dailyReportsData.filter(r => r !== undefined);

        // 获取 OKR 数据
        let okrData = null;
        if (input.periodId) {
          const objectives = await getObjectivesByPeriod(input.periodId, ctx.user.id);
          okrData = await Promise.all(
            objectives.map(async (obj) => {
              const keyResults = await getKeyResultsByObjective(obj.id, ctx.user.id);
              return { ...obj, keyResults };
            })
          );
        }

        // 使用 LLM 生成周报
        const prompt = `你是一个专业的工作周报生成助手。根据用户提供的日报和 OKR 信息，生成一份结构化的周报。

日报内容：
${dailyReports.map((r, i) => `
### 日报 ${i + 1} (${new Date(r.reportDate).toLocaleDateString()})
**工作内容：**
${r.workContent || '无'}

**业务洞察：**
${r.businessInsights || '无'}

**遇到的问题：**
${r.problems || '无'}
`).join('\n')}

${okrData ? `OKR 信息：
${okrData.map((obj, i) => `
### Objective ${i + 1}: ${obj.title}
${obj.description ? `描述：${obj.description}` : ''}

**Key Results:**
${obj.keyResults.map((kr, j) => `${j + 1}. ${kr.title}
   - 目标：${kr.targetValue || '未设置'} ${kr.unit || ''}
   - 当前：${kr.currentValue || '未更新'} ${kr.unit || ''}
   ${kr.description ? `- 描述：${kr.description}` : ''}`).join('\n')}
`).join('\n')}` : '未关联 OKR'}

请生成一份周报，包含以下内容：
1. **本周总结**：简要概括本周工作
2. **OKR 进展**：分析日报中的工作与哪些 OKR 相关，并说明进展
3. **主要成果**：列举本周完成的重要工作
4. **问题和挑战**：总结遇到的问题
5. **下周计划**：基于 OKR 和当前进展规划下周工作

请用 JSON 格式返回，包含以下字段：
- summary: 本周总结
- okrProgress: OKR 进展分析（数组，每个元素包含 objectiveId, objectiveTitle, progress, relatedWork）
- achievements: 主要成果（列表）
- problems: 问题和挑战
- nextWeekPlan: 下周计划
`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "你是一个专业的工作周报生成助手。" },
            { role: "user", content: prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "weekly_report",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  okrProgress: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        objectiveId: { type: "number" },
                        objectiveTitle: { type: "string" },
                        progress: { type: "string" },
                        relatedWork: { type: "string" },
                      },
                      required: ["objectiveId", "objectiveTitle", "progress", "relatedWork"],
                      additionalProperties: false,
                    },
                  },
                  achievements: {
                    type: "array",
                    items: { type: "string" },
                  },
                  problems: { type: "string" },
                  nextWeekPlan: { type: "string" },
                },
                required: ["summary", "okrProgress", "achievements", "problems", "nextWeekPlan"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices[0]?.message?.content;
        if (!content || typeof content !== 'string') {
          throw new Error("生成周报失败");
        }

        const reportData = JSON.parse(content);

        // 生成 Markdown 内容
        const markdownContent = `# 工作周报

**周期：** ${new Date(input.weekStartDate).toLocaleDateString()} - ${new Date(input.weekEndDate).toLocaleDateString()}

## 本周总结

${reportData.summary}

## OKR 进展

${reportData.okrProgress.map((item: any) => `### ${item.objectiveTitle}

**进展：** ${item.progress}

**相关工作：**
${item.relatedWork}
`).join('\n')}

## 主要成果

${reportData.achievements.map((item: string, i: number) => `${i + 1}. ${item}`).join('\n')}

## 问题和挑战

${reportData.problems}

## 下周计划

${reportData.nextWeekPlan}
`;

        // 保存周报
        const title = `工作周报 ${new Date(input.weekStartDate).toLocaleDateString()} - ${new Date(input.weekEndDate).toLocaleDateString()}`;
        const reportId = await createWeeklyReport({
          userId: ctx.user.id,
          periodId: input.periodId,
          weekStartDate: input.weekStartDate,
          weekEndDate: input.weekEndDate,
          title,
          summary: reportData.summary,
          okrProgress: reportData.okrProgress,
          achievements: reportData.achievements.join('\n'),
          problems: reportData.problems,
          nextWeekPlan: reportData.nextWeekPlan,
          markdownContent,
          dailyReportIds: input.dailyReportIds,
        });

        return { reportId, ...reportData, markdownContent };
      }),

    // 获取周报列表
    list: protectedProcedure
      .query(async ({ ctx }) => {
        return getWeeklyReportsByUser(ctx.user.id);
      }),

    // 获取周报详情
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        return getWeeklyReportById(input.id, ctx.user.id);
      }),

    // 更新周报
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        summary: z.string().optional(),
        achievements: z.string().optional(),
        problems: z.string().optional(),
        nextWeekPlan: z.string().optional(),
        markdownContent: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...updates } = input;
        await updateWeeklyReport(id, ctx.user.id, updates);
        return { success: true };
      }),

    // 删除周报
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deleteWeeklyReport(input.id, ctx.user.id);
        return { success: true };
      }),

    // 同步周报到 Notion
    syncToNotion: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        console.log("[WeeklyReport Sync] Starting sync for report ID:", input.id);
        console.log("[WeeklyReport Sync] User ID:", ctx.user.id);
        console.log("[WeeklyReport Sync] User notionWeeklyReportDatabaseId:", ctx.user.notionWeeklyReportDatabaseId);
        
        const report = await getWeeklyReportById(input.id, ctx.user.id);
        if (!report) {
          console.error("[WeeklyReport Sync] Report not found:", input.id);
          throw new Error("周报不存在");
        }
        console.log("[WeeklyReport Sync] Report found:", report.title);

        if (!ctx.user.notionWeeklyReportDatabaseId) {
          console.error("[WeeklyReport Sync] No Notion database ID configured for user:", ctx.user.id);
          throw new Error("请先在设置中配置周报 Notion 数据库 ID");
        }

        console.log("[WeeklyReport Sync] Calling syncWeeklyReportToNotion with database ID:", ctx.user.notionWeeklyReportDatabaseId);
        
        // 使用专门的周报同步函数
        const syncResult = await syncWeeklyReportToNotion(
          report,
          ctx.user.notionWeeklyReportDatabaseId!
        );

        console.log("[WeeklyReport Sync] Sync result:", JSON.stringify(syncResult, null, 2));

        // 检查同步是否成功
        if (!syncResult.success) {
          console.error("[WeeklyReport Sync] Sync failed:", syncResult.error);
          
          // 更新同步状态为失败
          await updateWeeklyReport(input.id, ctx.user.id, {
            notionSyncStatus: "failed",
          });
          
          throw new Error(syncResult.error || "同步到 Notion 失败");
        }

        // 检查 pageId 是否存在
        if (!syncResult.pageId) {
          console.error("[WeeklyReport Sync] No pageId returned from sync");
          throw new Error("同步成功但未返回页面 ID");
        }

        await updateWeeklyReport(input.id, ctx.user.id, {
          notionPageId: syncResult.pageId,
          notionSyncedAt: new Date(),
          notionSyncStatus: "synced",
        });

        console.log("[WeeklyReport Sync] Successfully synced report to Notion, pageId:", syncResult.pageId);

        return {
          success: true,
          pageId: syncResult.pageId,
          pageUrl: syncResult.pageUrl,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
