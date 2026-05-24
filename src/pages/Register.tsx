import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Cloud, UserPlus } from "lucide-react";

export default function Register() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-sky-50 via-white to-white dark:from-slate-950 dark:via-background dark:to-background px-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/4 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/4 w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-3xl" />
      </div>

      <Link to="/" className="absolute top-6 left-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors z-10">
        <ArrowLeft className="h-4 w-4" />
        返回首页
      </Link>

      <div className="flex items-center gap-2 mb-8 text-2xl font-bold text-foreground z-10">
        <Cloud className="h-7 w-7 text-primary" />
        <span>天象志</span>
      </div>

      <Card className="w-full max-w-sm shadow-elevated border-border/60 z-10">
        <CardHeader className="text-center pb-3">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserPlus className="h-5 w-5" />
          </div>
          <CardTitle className="text-lg">注册暂未开放</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm leading-6 text-muted-foreground">
            当前仅支持管理员创建内部账号。请联系管理员添加账号后，再使用邮箱和初始密码登录。
          </p>
          <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-soft">
            <Link to="/login">返回登录</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
