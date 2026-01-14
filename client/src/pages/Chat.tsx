import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  Send,
  User,
  Sparkles,
  Mic,
  MicOff,
  Square,
  FileText,
  CheckCircle,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";

type Message = {
  id?: number;
  role: "user" | "assistant" | "system";
  content: string;
  audioUrl?: string | null;
  createdAt?: Date;
};

export default function Chat() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ id?: string }>();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(
    params.id ? parseInt(params.id, 10) : null
  );
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [readyToGenerate, setReadyToGenerate] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // tRPC mutations
  const createSessionMutation = trpc.session.create.useMutation();
  const sendMessageMutation = trpc.chat.send.useMutation();
  const transcribeMutation = trpc.chat.transcribe.useMutation();
  const generateReportMutation = trpc.report.generate.useMutation();
  const uploadAudioMutation = trpc.audio.upload.useMutation();

  // 创建新会话
  const startNewSession = useCallback(async () => {
    try {
      const session = await createSessionMutation.mutateAsync();
      setSessionId(session.id);
      setMessages([
        {
          role: "assistant",
          content: "你好！我是你的日报助手。请告诉我你今天主要完成了哪些工作？",
        },
      ]);
      setReadyToGenerate(false);
    } catch (error) {
      toast.error("创建会话失败，请重试");
    }
  }, [createSessionMutation]);

  // 加载现有会话的消息
  const messagesQuery = trpc.session.messages.useQuery(
    { sessionId: sessionId! },
    { enabled: !!sessionId && !!params.id }
  );

  // 当从 URL 加载会话时，设置消息
  useEffect(() => {
    if (messagesQuery.data && params.id) {
      setMessages(messagesQuery.data.map((m: { id: number; role: string; content: string; audioUrl?: string | null; createdAt?: Date | null }) => ({
        id: m.id,
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
        audioUrl: m.audioUrl,
        createdAt: m.createdAt ? new Date(m.createdAt) : undefined,
      })));
    }
  }, [messagesQuery.data, params.id]);

  // 初始化会话（仅当没有 URL 参数时创建新会话）
  useEffect(() => {
    if (user && !sessionId && !params.id) {
      startNewSession();
    }
  }, [user, sessionId, params.id, startNewSession]);

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    const viewport = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLDivElement;
    if (viewport) {
      requestAnimationFrame(() => {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: "smooth",
        });
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 发送文字消息
  const handleSendMessage = async (content: string, audioUrl?: string, audioKey?: string) => {
    if (!sessionId || !content.trim()) return;

    const userMessage: Message = {
      role: "user",
      content: content.trim(),
      audioUrl,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    try {
      const result = await sendMessageMutation.mutateAsync({
        sessionId,
        content: content.trim(),
        audioUrl,
        audioKey,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: result.assistantMessage.id,
          role: "assistant",
          content: result.assistantMessage.content,
          createdAt: result.assistantMessage.createdAt,
        },
      ]);

      if (result.readyToGenerate) {
        setReadyToGenerate(true);
      }
    } catch (error) {
      toast.error("发送消息失败，请重试");
    }
  };

  // 开始录音
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());

        // 上传音频并转录
        await handleAudioUpload(audioBlob);
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      toast.error("无法访问麦克风，请检查权限设置");
    }
  };

  // 停止录音
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  // 上传音频并转录
  const handleAudioUpload = async (audioBlob: Blob) => {
    try {
      toast.info("正在处理语音...");

      // 转换为 base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);

      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(",")[1];

        // 上传音频
        const audioFile = await uploadAudioMutation.mutateAsync({
          filename: `recording-${Date.now()}.webm`,
          mimeType: "audio/webm",
          base64Data,
          sessionId: sessionId || undefined,
        });

        // 转录
        const transcription = await transcribeMutation.mutateAsync({
          audioUrl: audioFile.fileUrl,
          sessionId: sessionId || undefined,
        });

        if (transcription.text) {
          // 将转录文本作为消息发送
          await handleSendMessage(transcription.text, audioFile.fileUrl, audioFile.fileKey);
          toast.success("语音转录成功");
        } else {
          toast.error("语音转录失败，请重试");
        }
      };
    } catch (error) {
      toast.error("语音处理失败，请重试");
    }
  };

  // 生成日报
  const handleGenerateReport = async () => {
    if (!sessionId) return;

    try {
      toast.info("正在生成日报...");
      const report = await generateReportMutation.mutateAsync({ sessionId });
      toast.success("日报生成成功！");
      setLocation(`/report/${report.id}`);
    } catch (error) {
      toast.error("生成日报失败，请重试");
    }
  };

  // 格式化录音时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(input);
    }
  };

  const isLoading =
    sendMessageMutation.isPending ||
    transcribeMutation.isPending ||
    uploadAudioMutation.isPending;

  const displayMessages = messages.filter((msg) => msg.role !== "system");

  return (
    <div className="flex flex-col h-full">
      {/* 聊天区域 */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="border-b py-3 px-4 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            日报访谈助手
          </CardTitle>
          {readyToGenerate && (
            <Button
              onClick={handleGenerateReport}
              disabled={generateReportMutation.isPending}
              size="sm"
              className="gap-2"
            >
              {generateReportMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              生成日报
            </Button>
          )}
        </CardHeader>

        <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
          {/* 消息列表 */}
          <ScrollArea ref={scrollAreaRef} className="flex-1">
            <div className="flex flex-col space-y-4 p-4">
              {displayMessages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex gap-3",
                    message.role === "user"
                      ? "justify-end items-start"
                      : "justify-start items-start"
                  )}
                >
                  {message.role === "assistant" && (
                    <div className="size-8 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center">
                      <Sparkles className="size-4 text-primary" />
                    </div>
                  )}

                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-4 py-2.5",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {message.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <Streamdown>{message.content}</Streamdown>
                      </div>
                    ) : (
                      <div>
                        {message.audioUrl && (
                          <div className="flex items-center gap-2 mb-2 text-xs opacity-80">
                            <Mic className="h-3 w-3" />
                            <span>语音消息</span>
                          </div>
                        )}
                        <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                      </div>
                    )}
                  </div>

                  {message.role === "user" && (
                    <div className="size-8 shrink-0 mt-1 rounded-full bg-secondary flex items-center justify-center">
                      <User className="size-4 text-secondary-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex items-start gap-3">
                  <div className="size-8 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="size-4 text-primary" />
                  </div>
                  <div className="rounded-lg bg-muted px-4 py-2.5">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* 输入区域 */}
          <div className="border-t p-4 bg-background/50">
            {/* 录音状态 */}
            {isRecording && (
              <div className="flex items-center justify-center gap-3 mb-3 py-2 px-4 bg-destructive/10 rounded-lg">
                <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
                <span className="text-sm font-medium text-destructive">
                  正在录音 {formatTime(recordingTime)}
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={stopRecording}
                  className="gap-1"
                >
                  <Square className="h-3 w-3" />
                  停止
                </Button>
              </div>
            )}

            <div className="flex gap-2 items-end">
              {/* 语音按钮 */}
              <Button
                type="button"
                variant={isRecording ? "destructive" : "outline"}
                size="icon"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading}
                className="shrink-0 h-[38px] w-[38px]"
              >
                {isRecording ? (
                  <MicOff className="size-4" />
                ) : (
                  <Mic className="size-4" />
                )}
              </Button>

              {/* 文字输入 */}
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入工作内容，或点击麦克风语音输入..."
                className="flex-1 max-h-32 resize-none min-h-9"
                rows={1}
                disabled={isLoading || isRecording}
              />

              {/* 发送按钮 */}
              <Button
                type="button"
                size="icon"
                onClick={() => handleSendMessage(input)}
                disabled={!input.trim() || isLoading || isRecording}
                className="shrink-0 h-[38px] w-[38px]"
              >
                {isLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </div>

            {/* 提示 */}
            {readyToGenerate && (
              <div className="flex items-center gap-2 mt-3 text-sm text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                <span>信息收集完成，可以点击上方"生成日报"按钮生成日报</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
