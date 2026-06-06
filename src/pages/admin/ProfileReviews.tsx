import { trpc } from "@/providers/trpc";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, Loader2, UserCheck, X } from "lucide-react";

function typeLabel(type: string) {
  return type === "avatar" ? "头像" : "用户名";
}

export default function AdminProfileReviews() {
  const utils = trpc.useUtils();
  const { data: requests, isLoading } = trpc.admin.profileChanges.pending.useQuery();
  const review = trpc.admin.profileChanges.review.useMutation({
    onSuccess: async () => {
      await utils.admin.profileChanges.pending.invalidate();
      await utils.admin.users.list.invalidate();
    },
  });

  const handleReject = (requestId: number) => {
    const rejectReason = window.prompt("请输入拒绝原因（可选）：") || undefined;
    review.mutate({ requestId, approve: false, rejectReason });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            资料审核
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!requests || requests.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">暂无待审核资料变更</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>申请内容</TableHead>
                  <TableHead>提交时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={request.user?.avatar || undefined} />
                          <AvatarFallback>{(request.user?.name || "用户").slice(0, 1)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-medium">{request.user?.name || "匿名用户"}</div>
                          <div className="text-xs text-muted-foreground">ID {request.user?.publicId || request.userId}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{typeLabel(request.type)}</Badge>
                    </TableCell>
                    <TableCell>
                      {request.type === "avatar" ? (
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={request.value} />
                            <AvatarFallback>头像</AvatarFallback>
                          </Avatar>
                          <span className="max-w-[220px] truncate text-xs text-muted-foreground">{request.value}</span>
                        </div>
                      ) : (
                        <span className="font-medium">{request.value}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(request.createdAt).toLocaleString("zh-CN")}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() => review.mutate({ requestId: request.id, approve: true })}
                          disabled={review.isPending}
                        >
                          <Check className="mr-1 h-4 w-4" />
                          通过
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleReject(request.id)}
                          disabled={review.isPending}
                        >
                          <X className="mr-1 h-4 w-4" />
                          拒绝
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
