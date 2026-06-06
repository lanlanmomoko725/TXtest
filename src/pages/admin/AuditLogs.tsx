import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";

const actionLabels: Record<string, string> = {
  delete_post: "删除帖子",
  feature_post: "设为精选",
  unfeature_post: "取消精选",
  reorder_sky_gallery: "天象图鉴排序",
  update_user_role: "修改用户角色",
  delete_comment_reply: "删除回复",
  delete_comment_thread: "删除评论串",
  add_admin_email: "添加管理员邮箱",
  remove_admin_email: "移除管理员邮箱",
  approve_profile_change: "通过资料审核",
  reject_profile_change: "拒绝资料审核",
};

const eventLabels: Record<string, string> = {
  captcha_rate_limited: "验证码限流",
  verification_email_rate_limited: "邮箱验证码限流",
  verification_ip_rate_limited: "IP 验证码限流",
  login_ip_rate_limited: "登录 IP 限流",
  register_ip_rate_limited: "注册 IP 限流",
  comment_user_rate_limited: "评论用户限流",
  comment_ip_rate_limited: "评论 IP 限流",
  comment_blocked: "评论过滤拦截",
  upload_user_rate_limited: "上传用户限流",
  upload_ip_rate_limited: "上传 IP 限流",
  search_ip_rate_limited: "搜索 IP 限流",
  view_count_rate_limited: "浏览计数限流",
};

const actionVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  delete_post: "destructive",
  delete_comment_reply: "destructive",
  delete_comment_thread: "destructive",
  feature_post: "default",
  unfeature_post: "secondary",
  reorder_sky_gallery: "outline",
  update_user_role: "default",
  approve_profile_change: "default",
  reject_profile_change: "destructive",
};

export default function AdminAuditLogs() {
  const [page, setPage] = useState(0);
  const [securityPage, setSecurityPage] = useState(0);
  const pageSize = 50;

  const auditQuery = trpc.admin.audit.logs.useQuery({ offset: page * pageSize, limit: pageSize });
  const securityQuery = trpc.admin.audit.securityEvents.useQuery({
    offset: securityPage * pageSize,
    limit: pageSize,
  });

  if (auditQuery.isLoading || securityQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const logs = auditQuery.data?.logs ?? [];
  const events = securityQuery.data?.events ?? [];

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle>审计日志</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="audit">
            <TabsList>
              <TabsTrigger value="audit">操作审计</TabsTrigger>
              <TabsTrigger value="security">安全事件</TabsTrigger>
            </TabsList>

            <TabsContent value="audit" className="mt-4">
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
                        <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate">
                          {log.details ? JSON.stringify(log.details) : "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {logs.length >= pageSize && (
                <Pager page={page} onPageChange={setPage} />
              )}
            </TabsContent>

            <TabsContent value="security" className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>事件</TableHead>
                    <TableHead>用户</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>对象</TableHead>
                    <TableHead>详情</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        暂无安全事件
                      </TableCell>
                    </TableRow>
                  ) : (
                    events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {new Date(event.createdAt).toLocaleString("zh-CN")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{eventLabels[event.event] ?? event.event}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {event.userId ? `#${event.userId}` : "-"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{event.ip ?? "-"}</TableCell>
                        <TableCell className="text-sm max-w-[180px] truncate">{event.subject ?? "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate">
                          {event.details ? JSON.stringify(event.details) : "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {events.length >= pageSize && (
                <Pager page={securityPage} onPageChange={setSecurityPage} />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function Pager({
  page,
  onPageChange,
}: {
  page: number;
  onPageChange: (updater: (page: number) => number) => void;
}) {
  return (
    <div className="flex justify-between mt-4">
      <Button
        variant="outline"
        size="sm"
        disabled={page === 0}
        onClick={() => onPageChange((p) => Math.max(0, p - 1))}
      >
        上一页
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange((p) => p + 1)}
      >
        下一页
      </Button>
    </div>
  );
}
