import { useState } from "react";
import { Check, KeyRound, Loader2, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function statusLabel(status: string) {
  return status === "initial_approved" ? "等待终审" : "等待初审";
}

export default function AdminRecoveryReviews() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [error, setError] = useState("");
  const requests = trpc.admin.accountRecovery.pending.useQuery();
  const refresh = () => utils.admin.accountRecovery.pending.invalidate();
  const initial = trpc.admin.accountRecovery.initialReview.useMutation({
    onSuccess: async () => {
      setError("");
      await refresh();
    },
    onError: (err) => setError(err.message),
  });
  const final = trpc.admin.accountRecovery.finalReview.useMutation({
    onSuccess: async () => {
      setError("");
      await refresh();
    },
    onError: (err) => setError(err.message),
  });

  const review = (stage: "initial" | "final", requestId: number, approve: boolean) => {
    const reason = approve ? undefined : window.prompt("请输入拒绝原因：")?.trim();
    if (!approve && !reason) return;
    if (stage === "initial") initial.mutate({ requestId, approve, reason });
    else final.mutate({ requestId, approve, reason });
  };

  if (requests.isLoading) {
    return <div className="flex min-h-[400px] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const rows = requests.data ?? [];
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" />账号恢复审核</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
          {rows.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">暂无待审核恢复申请</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>账号</TableHead>
                  <TableHead>新联系方式</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>冷静期结束</TableHead>
                  <TableHead>弱证据</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((request) => {
                  const cooled = new Date(request.availableAt).getTime() <= Date.now();
                  const initialReviewer = request.reviews.find((item) => item.stage === "initial" && item.decision === "approve")?.reviewerId;
                  const canFinal = user?.role === "super_admin" && cooled && initialReviewer !== user.id;
                  return (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div className="font-medium">{request.user?.name || "未知用户"}</div>
                        <div className="text-xs text-muted-foreground">ID {request.user?.publicId ?? request.userId}</div>
                      </TableCell>
                      <TableCell>
                        <div>{request.newContactMasked}</div>
                        <div className="text-xs text-muted-foreground">{request.contactType === "email" ? "邮箱" : "手机号"}</div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{statusLabel(request.status)}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(request.availableAt).toLocaleString("zh-CN")}</TableCell>
                      <TableCell className="max-w-[260px] text-xs text-muted-foreground">
                        注册 {request.user?.createdAt ? new Date(request.user.createdAt).toLocaleDateString("zh-CN") : "-"}<br />
                        最近登录 {request.user?.lastSignInAt ? new Date(request.user.lastSignInAt).toLocaleString("zh-CN") : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {request.status === "pending" ? (
                            <>
                              <Button size="sm" onClick={() => review("initial", request.id, true)} disabled={initial.isPending}>
                                <Check className="mr-1 h-4 w-4" />初审通过
                              </Button>
                              <Button size="sm" variant="outline" className="text-destructive" onClick={() => review("initial", request.id, false)} disabled={initial.isPending}>
                                <X className="mr-1 h-4 w-4" />拒绝
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" onClick={() => review("final", request.id, true)} disabled={!canFinal || final.isPending} title={!cooled ? "冷静期尚未结束" : initialReviewer === user?.id ? "终审必须由不同账号完成" : undefined}>
                                <Check className="mr-1 h-4 w-4" />终审通过
                              </Button>
                              <Button size="sm" variant="outline" className="text-destructive" onClick={() => review("final", request.id, false)} disabled={!canFinal || final.isPending}>
                                <X className="mr-1 h-4 w-4" />拒绝
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
