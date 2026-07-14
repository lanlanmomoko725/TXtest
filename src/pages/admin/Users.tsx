import { useState } from "react";
import type { FormEvent } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Shield, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

function roleLabel(role: string) {
  if (role === "super_admin") return "超级管理员";
  if (role === "admin") return "管理员";
  return "普通用户";
}

function roleVariant(role: string) {
  if (role === "super_admin") return "destructive";
  if (role === "admin") return "default";
  return "secondary";
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const utils = trpc.useUtils();
  const [page, setPage] = useState(0);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminEmailError, setAdminEmailError] = useState("");
  const pageSize = 50;
  const isSuperAdmin = currentUser?.role === "super_admin";

  const { data, isLoading } = trpc.admin.users.list.useQuery({ offset: page * pageSize, limit: pageSize });
  const { data: allowlist, isLoading: allowlistLoading } = trpc.admin.users.listAdminEmails.useQuery(undefined, {
    enabled: isSuperAdmin,
  });

  const updateRole = trpc.admin.users.updateRole.useMutation({
    onSuccess: () => utils.admin.users.list.invalidate(),
  });
  const deleteUser = trpc.admin.users.delete.useMutation({
    onSuccess: () => utils.admin.users.list.invalidate(),
  });
  const addAdminEmail = trpc.admin.users.addAdminEmail.useMutation({
    onSuccess: async () => {
      await utils.admin.users.listAdminEmails.invalidate();
      setAdminEmail("");
      setAdminEmailError("");
    },
    onError: (err) => setAdminEmailError(err.message),
  });
  const removeAdminEmail = trpc.admin.users.removeAdminEmail.useMutation({
    onSuccess: () => utils.admin.users.listAdminEmails.invalidate(),
  });

  const handleAddAdminEmail = (e: FormEvent) => {
    e.preventDefault();
    setAdminEmailError("");
    addAdminEmail.mutate({ email: adminEmail.trim() });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const superAdminId = data?.superAdminId;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>用户管理</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户 ID</TableHead>
                <TableHead>昵称</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>手机号</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>等级</TableHead>
                <TableHead>状态</TableHead>
                {isSuperAdmin ? <TableHead>操作</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-mono text-xs">{u.publicId ?? u.id}</TableCell>
                  <TableCell>{u.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email || "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.phoneMasked || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Badge variant={roleVariant(u.role)}>
                        {roleLabel(u.role)}
                      </Badge>
                      {u.id === superAdminId ? (
                        <Badge variant="outline" className="text-xs border-amber-400 text-amber-600">初始</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">L{u.level}</TableCell>
                  <TableCell>
                    {u.lockedUntil && new Date(u.lockedUntil).getTime() > Date.now() ? (
                      <Badge variant="outline" className="border-red-300 text-red-600">已锁定</Badge>
                    ) : (
                      <Badge variant="outline" className="border-emerald-300 text-emerald-600">正常</Badge>
                    )}
                  </TableCell>
                  {isSuperAdmin ? (
                    <TableCell>
                      {currentUser?.id === u.id || u.role === "super_admin" ? (
                        <span className="text-xs text-muted-foreground">受保护</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Select
                            value={u.role === "admin" ? "admin" : "user"}
                            onValueChange={(role: "user" | "admin") =>
                              updateRole.mutate({ userId: u.id, role })
                            }
                          >
                            <SelectTrigger className="w-28 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">
                                <span className="flex items-center gap-1">
                                  <ShieldOff className="h-3 w-3" /> 用户
                                </span>
                              </SelectItem>
                              <SelectItem value="admin">
                                <span className="flex items-center gap-1">
                                  <Shield className="h-3 w-3" /> 管理员
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-700"
                            onClick={() => {
                              if (confirm(`确定注销用户 ${u.name || u.email} 吗？账号将无法登录，历史内容会以匿名身份保留。`)) {
                                const reason = window.prompt("请输入注销原因（可选）：")?.trim() || undefined;
                                deleteUser.mutate({ userId: u.id, reason });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">共 {total} 人</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  上一页
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                  下一页
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {isSuperAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              管理员邮箱预授权
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <form onSubmit={handleAddAdminEmail} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <Label htmlFor="admin-email">管理员邮箱</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                />
              </div>
              <Button type="submit" disabled={addAdminEmail.isPending || !adminEmail.trim()}>
                {addAdminEmail.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                添加邮箱
              </Button>
            </form>
            {adminEmailError ? <p className="text-sm text-destructive">{adminEmailError}</p> : null}

            {allowlistLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>邮箱</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>添加时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(allowlist ?? []).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.email}</TableCell>
                      <TableCell>
                        {item.usedAt ? (
                          <Badge variant="secondary">已注册</Badge>
                        ) : (
                          <Badge variant="outline" className="border-emerald-300 text-emerald-600">待注册</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString("zh-CN")}
                      </TableCell>
                      <TableCell>
                        {!item.usedAt ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => removeAdminEmail.mutate({ id: item.id })}
                            disabled={removeAdminEmail.isPending}
                          >
                            移除
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">不可移除</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
