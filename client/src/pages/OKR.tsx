import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Target, TrendingUp, Edit, Trash2, Calendar } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

export default function OKR() {
  const [showPeriodDialog, setShowPeriodDialog] = useState(false);
  const [showObjectiveDialog, setShowObjectiveDialog] = useState(false);
  const [showKRDialog, setShowKRDialog] = useState(false);
  const [selectedObjective, setSelectedObjective] = useState<number | null>(null);

  // 查询数据
  const { data: periods, refetch: refetchPeriods } = trpc.okr.listPeriods.useQuery();
  const { data: activePeriod } = trpc.okr.getActivePeriod.useQuery();
  const { data: fullOkr, refetch: refetchOkr } = trpc.okr.getFullOkr.useQuery(
    { periodId: activePeriod?.id || 0 },
    { enabled: !!activePeriod }
  );

  // Mutations
  const createPeriod = trpc.okr.createPeriod.useMutation({
    onSuccess: () => {
      toast.success("OKR 周期创建成功");
      refetchPeriods();
      setShowPeriodDialog(false);
    },
  });

  const createObjective = trpc.okr.createObjective.useMutation({
    onSuccess: () => {
      toast.success("Objective 创建成功");
      refetchOkr();
      setShowObjectiveDialog(false);
    },
  });

  const createKR = trpc.okr.createKeyResult.useMutation({
    onSuccess: () => {
      toast.success("Key Result 创建成功");
      refetchOkr();
      setShowKRDialog(false);
      setSelectedObjective(null);
    },
  });

  const deleteObjective = trpc.okr.deleteObjective.useMutation({
    onSuccess: () => {
      toast.success("Objective 已删除");
      refetchOkr();
    },
  });

  const deleteKR = trpc.okr.deleteKeyResult.useMutation({
    onSuccess: () => {
      toast.success("Key Result 已删除");
      refetchOkr();
    },
  });

  const updateKR = trpc.okr.updateKeyResult.useMutation({
    onSuccess: () => {
      toast.success("进度已更新");
      refetchOkr();
    },
  });

  // 创建 OKR 周期
  const handleCreatePeriod = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    const startDate = new Date(formData.get("startDate") as string);
    const endDate = new Date(formData.get("endDate") as string);

    createPeriod.mutate({ title, startDate, endDate });
  };

  // 创建 Objective
  const handleCreateObjective = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activePeriod) return;

    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;

    createObjective.mutate({
      periodId: activePeriod.id,
      title,
      description: description || undefined,
    });
  };

  // 创建 Key Result
  const handleCreateKR = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedObjective) return;

    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    const targetValue = formData.get("targetValue") as string;
    const unit = formData.get("unit") as string;

    createKR.mutate({
      objectiveId: selectedObjective,
      title,
      targetValue: targetValue || undefined,
      unit: unit || undefined,
      currentValue: "0",
    });
  };

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">OKR 管理</h1>
          <p className="text-muted-foreground mt-2">
            管理您的 Objectives 和 Key Results
          </p>
        </div>
        <Dialog open={showPeriodDialog} onOpenChange={setShowPeriodDialog}>
          <DialogTrigger asChild>
            <Button>
              <Calendar className="mr-2 h-4 w-4" />
              创建 OKR 周期
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建 OKR 周期</DialogTitle>
              <DialogDescription>
                创建一个新的 OKR 周期（通常为双月）
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreatePeriod} className="space-y-4">
              <div>
                <Label htmlFor="title">周期名称</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="例如：2025 Q1-Q2 OKR"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">开始日期</Label>
                  <Input
                    id="startDate"
                    name="startDate"
                    type="date"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">结束日期</Label>
                  <Input
                    id="endDate"
                    name="endDate"
                    type="date"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowPeriodDialog(false)}>
                  取消
                </Button>
                <Button type="submit">创建</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* 当前活跃周期 */}
      {activePeriod && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {activePeriod.title}
            </CardTitle>
            <CardDescription>
              {format(new Date(activePeriod.startDate), "yyyy年MM月dd日", { locale: zhCN })} -{" "}
              {format(new Date(activePeriod.endDate), "yyyy年MM月dd日", { locale: zhCN })}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* OKR 列表 */}
      {activePeriod ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Objectives & Key Results</h2>
            <Dialog open={showObjectiveDialog} onOpenChange={setShowObjectiveDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  添加 Objective
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>添加 Objective</DialogTitle>
                  <DialogDescription>
                    创建一个新的目标
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateObjective} className="space-y-4">
                  <div>
                    <Label htmlFor="obj-title">目标标题</Label>
                    <Input
                      id="obj-title"
                      name="title"
                      placeholder="例如：提升产品用户体验"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="obj-description">描述（可选）</Label>
                    <Textarea
                      id="obj-description"
                      name="description"
                      placeholder="详细描述这个目标..."
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setShowObjectiveDialog(false)}>
                      取消
                    </Button>
                    <Button type="submit">创建</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {fullOkr && fullOkr.length > 0 ? (
            <div className="space-y-6">
              {fullOkr.map((objective, index) => (
                <Card key={objective.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          <Target className="h-5 w-5 text-primary" />
                          O{index + 1}: {objective.title}
                        </CardTitle>
                        {objective.description && (
                          <CardDescription className="mt-2">
                            {objective.description}
                          </CardDescription>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("确定要删除这个 Objective 吗？")) {
                            deleteObjective.mutate({ id: objective.id });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {objective.keyResults && objective.keyResults.length > 0 ? (
                        <div className="space-y-3">
                          {objective.keyResults.map((kr, krIndex) => (
                            <div
                              key={kr.id}
                              className="flex items-center gap-4 p-3 rounded-lg border bg-card"
                            >
                              <div className="flex-1">
                                <div className="font-medium">
                                  KR{krIndex + 1}: {kr.title}
                                </div>
                                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                  <div>
                                    目标: {kr.targetValue || "未设置"} {kr.unit || ""}
                                  </div>
                                  <div>
                                    当前: {kr.currentValue || "0"} {kr.unit || ""}
                                  </div>
                                  {kr.targetValue && kr.currentValue && (
                                    <div className="flex items-center gap-1 text-primary">
                                      <TrendingUp className="h-3 w-3" />
                                      {Math.round(
                                        (parseFloat(kr.currentValue) / parseFloat(kr.targetValue)) * 100
                                      )}%
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="text"
                                  placeholder="更新进度"
                                  className="w-24"
                                  onBlur={(e) => {
                                    if (e.target.value) {
                                      updateKR.mutate({
                                        id: kr.id,
                                        currentValue: e.target.value,
                                      });
                                      e.target.value = "";
                                    }
                                  }}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    if (confirm("确定要删除这个 Key Result 吗？")) {
                                      deleteKR.mutate({ id: kr.id });
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          暂无 Key Results
                        </p>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedObjective(objective.id);
                          setShowKRDialog(true);
                        }}
                      >
                        <Plus className="mr-2 h-3 w-3" />
                        添加 Key Result
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  还没有 Objectives，点击上方按钮创建第一个目标
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              还没有活跃的 OKR 周期
            </p>
            <Button onClick={() => setShowPeriodDialog(true)}>
              创建第一个 OKR 周期
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 创建 Key Result Dialog */}
      <Dialog open={showKRDialog} onOpenChange={setShowKRDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加 Key Result</DialogTitle>
            <DialogDescription>
              为 Objective 创建一个可衡量的关键结果
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateKR} className="space-y-4">
            <div>
              <Label htmlFor="kr-title">Key Result 标题</Label>
              <Input
                id="kr-title"
                name="title"
                placeholder="例如：用户满意度达到 90%"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="kr-target">目标值</Label>
                <Input
                  id="kr-target"
                  name="targetValue"
                  placeholder="例如：90"
                />
              </div>
              <div>
                <Label htmlFor="kr-unit">单位</Label>
                <Input
                  id="kr-unit"
                  name="unit"
                  placeholder="例如：%"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowKRDialog(false);
                  setSelectedObjective(null);
                }}
              >
                取消
              </Button>
              <Button type="submit">创建</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
