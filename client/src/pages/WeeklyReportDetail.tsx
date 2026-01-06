import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Save, Trash2, Copy, Cloud, ArrowLeft, Edit2, X, CheckCircle, Loader2 } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Streamdown } from "streamdown";

export default function WeeklyReportDetail() {
  const params = useParams();
  const reportId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [editedSummary, setEditedSummary] = useState("");
  const [editedAchievements, setEditedAchievements] = useState("");
  const [editedProblems, setEditedProblems] = useState("");
  const [editedNextWeekPlan, setEditedNextWeekPlan] = useState("");

  const { data: report, isLoading, refetch } = trpc.weeklyReport.get.useQuery({ id: reportId });

  const updateMutation = trpc.weeklyReport.update.useMutation({
    onSuccess: () => {
      toast.success("周报已更新");
      setIsEditing(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`更新失败：${error.message}`);
    },
  });

  const deleteMutation = trpc.weeklyReport.delete.useMutation({
    onSuccess: () => {
      toast.success("周报已删除");
      setLocation("/weekly-report-history");
    },
    onError: (error) => {
      toast.error(`删除失败：${error.message}`);
    },
  });

  const syncMutation = trpc.weeklyReport.syncToNotion.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      toast.error(`同步失败：${error.message}`);
    },
  });

  const handleEdit = () => {
    if (report) {
      setEditedSummary(report.summary || "");
      setEditedAchievements(report.achievements || "");
      setEditedProblems(report.problems || "");
      setEditedNextWeekPlan(report.nextWeekPlan || "");
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    updateMutation.mutate({
      id: reportId,
      summary: editedSummary,
      achievements: editedAchievements,
      problems: editedProblems,
      nextWeekPlan: editedNextWeekPlan,
    });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleDelete = () => {
    deleteMutation.mutate({ id: reportId });
  };

  const handleSync = () => {
    syncMutation.mutate({ id: reportId });
  };

  const handleCopy = () => {
    if (report?.markdownContent) {
      navigator.clipboard.writeText(report.markdownContent);
      toast.success("已复制到剪贴板");
    }
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">周报不存在</p>
            <Button onClick={() => setLocation("/weekly-report-history")} className="mt-4">
              返回列表
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/weekly-report-history")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回列表
        </Button>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={handleEdit}>
                <Edit2 className="h-4 w-4 mr-2" />
                编辑
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="h-4 w-4 mr-2" />
                复制
              </Button>
              {/* Notion 同步状态 */}
              {report.notionSyncStatus === "synced" ? (
                <Badge variant="secondary" className="gap-1 h-8 px-3">
                  <CheckCircle className="h-3 w-3" />
                  已同步到 Notion
                </Badge>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={syncMutation.isPending}
                  className="gap-2"
                >
                  {syncMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Cloud className="h-4 w-4" />
                  )}
                  同步到 Notion
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认删除</AlertDialogTitle>
                    <AlertDialogDescription>
                      确定要删除这份周报吗？此操作无法撤销。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      删除
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                <X className="h-4 w-4 mr-2" />
                取消
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {updateMutation.isPending ? "保存中..." : "保存"}
              </Button>
            </>
          )}
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl">{report.title}</CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {new Date(report.weekStartDate).toLocaleDateString()} - {new Date(report.weekEndDate).toLocaleDateString()}
          </div>
        </CardHeader>
      </Card>

      {isEditing ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>本周总结</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={editedSummary}
                onChange={(e) => setEditedSummary(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>主要成果</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={editedAchievements}
                onChange={(e) => setEditedAchievements(e.target.value)}
                rows={6}
                className="resize-none"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>问题和挑战</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={editedProblems}
                onChange={(e) => setEditedProblems(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>下周计划</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={editedNextWeekPlan}
                onChange={(e) => setEditedNextWeekPlan(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>本周总结</CardTitle>
            </CardHeader>
            <CardContent>
              <Streamdown>{report.summary || "无"}</Streamdown>
            </CardContent>
          </Card>

          {report.okrProgress && Array.isArray(report.okrProgress) && report.okrProgress.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>OKR 进展</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {report.okrProgress.map((item: any, index: number) => (
                  <div key={index} className="border-l-4 border-primary pl-4">
                    <h4 className="font-semibold mb-2">{item.objectiveTitle}</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>进展：</strong> {item.progress}
                    </p>
                    <div className="text-sm">
                      <strong>相关工作：</strong>
                      <Streamdown>{String(item.relatedWork || '')}</Streamdown>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>主要成果</CardTitle>
            </CardHeader>
            <CardContent>
              <Streamdown>{report.achievements || "无"}</Streamdown>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>问题和挑战</CardTitle>
            </CardHeader>
            <CardContent>
              <Streamdown>{report.problems || "无"}</Streamdown>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>下周计划</CardTitle>
            </CardHeader>
            <CardContent>
              <Streamdown>{report.nextWeekPlan || "无"}</Streamdown>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
