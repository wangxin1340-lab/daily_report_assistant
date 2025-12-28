import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  Loader2,
  Search,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";

export default function History() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: reports, isLoading } = trpc.report.list.useQuery();

  // 过滤日报
  const filteredReports = useMemo(() => {
    if (!reports) return [];
    if (!searchQuery.trim()) return reports;

    const query = searchQuery.toLowerCase();
    return reports.filter(
      (report) =>
        report.summary?.toLowerCase().includes(query) ||
        report.workContent?.toLowerCase().includes(query) ||
        report.problems?.toLowerCase().includes(query)
    );
  }, [reports, searchQuery]);

  // 按日期分组
  const groupedReports = useMemo(() => {
    const groups: Record<string, typeof filteredReports> = {};

    filteredReports.forEach((report) => {
      const date = new Date(report.reportDate);
      const monthKey = `${date.getFullYear()}年${date.getMonth() + 1}月`;

      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(report);
    });

    return groups;
  }, [filteredReports]);

  const getSyncStatusBadge = (status: string | null) => {
    switch (status) {
      case "synced":
        return (
          <Badge variant="secondary" className="gap-1 text-green-600">
            <CheckCircle className="h-3 w-3" />
            已同步
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            同步失败
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            待同步
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">历史日报</h1>
          <p className="text-muted-foreground mt-1">
            共 {reports?.length || 0} 份日报
          </p>
        </div>
      </div>

      {/* 搜索 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索日报内容..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* 日报列表 */}
      {filteredReports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? "没有找到匹配的日报" : "暂无日报记录"}
            </p>
            {!searchQuery && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setLocation("/")}
              >
                开始写日报
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedReports).map(([month, monthReports]) => (
            <div key={month}>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                {month}
              </h2>
              <div className="space-y-3">
                {monthReports.map((report) => {
                  const date = new Date(report.reportDate);
                  return (
                    <Card
                      key={report.id}
                      className="cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => setLocation(`/report/${report.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="font-medium">
                                {date.toLocaleDateString("zh-CN", {
                                  month: "long",
                                  day: "numeric",
                                  weekday: "short",
                                })}
                              </span>
                              {getSyncStatusBadge(report.notionSyncStatus)}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {report.summary || "暂无总结"}
                            </p>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
