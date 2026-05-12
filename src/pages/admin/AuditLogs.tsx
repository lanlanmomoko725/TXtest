import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";

const actionLabels: Record<string, string> = {
  delete_post: "删除帖子",
  feature_post: "设为精选",
  unfeature_post: "取消精选",
  reorder_sky_gallery: "天象画廊排序",
  update_user_role: "修改用户角色",
};

const actionVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  delete_post: "destructive",
  feature_post: "default",
  unfeature_post: "secondary",
  reorder_sky_gallery: "outline",
  update_user_role: "default",
};

export default function AdminAuditLogs() {
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const { data, isLoading } = trpc.admin.audit.logs.useQuery({ offset: page * pageSize, limit: pageSize });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const logs = data?.logs ?? [];

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>审计日志</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>操作用户</TableHead>
                <TableHead>操作</TableHead>
                <TableHead>目标</TableHead>
                <TableHead>详情</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    暂无审计日志
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("zh-CN")}
                    </TableCell>
                    <TableCell className="font-mono text-xs">#{log.userId}</TableCell>
                    <TableCell>
                      <Badge variant={actionVariants[log.action] ?? "outline"}>
                        {actionLabels[log.action] ?? log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.targetType}{log.targetId ? ` #${log.targetId}` : ""}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {log.details ? JSON.stringify(log.details) : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {logs.length >= pageSize && (
            <div className="flex justify-between mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
