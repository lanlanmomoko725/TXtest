import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { AliyunCaptchaButton } from "@/components/AliyunCaptchaButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Cloud, Loader2, ArrowLeft } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");

  const captchaConfig = trpc.emailAuth.captchaConfig.useQuery();

  const loginMutation = trpc.emailAuth.login.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      navigate("/");
    },
    onError: (err) => {
      setLoginError(err.message || "登录失败");
    },
  });

  const sendResetCode = trpc.emailAuth.sendResetCode.useMutation({
    onSuccess: (data) => {
      setResetMessage(data.message || "如果邮箱存在，验证码将发送到该邮箱。");
      setResetError("");
    },
    onError: (err) => {
      setResetError(err.message);
      setResetMessage("");
    },
  });

  const resetPasswordMutation = trpc.emailAuth.resetPassword.useMutation({
    onSuccess: () => {
      setResetMessage("密码已重置，请使用新密码登录。");
      setResetError("");
      setResetCode("");
      setResetPassword("");
      setResetPasswordConfirm("");
    },
    onError: (err) => {
      setResetError(err.message);
      setResetMessage("");
    },
  });

  const handleEmailLogin = (e: FormEvent) => {
    e.preventDefault();
    setLoginError("");
    if (!email.trim() || !password.trim()) return;
    loginMutation.mutate({ email: email.trim(), password });
  };

  const handleSendResetCode = async (captchaVerifyParam: string) => {
    setResetError("");
    setResetMessage("");
    if (!resetEmail.trim()) {
      setResetError("请先输入邮箱。");
      return false;
    }
    await sendResetCode.mutateAsync({ email: resetEmail.trim(), captchaVerifyParam });
    return true;
  };

  const handleResetPassword = (e: FormEvent) => {
    e.preventDefault();
    setResetError("");
    setResetMessage("");
    resetPasswordMutation.mutate({
      email: resetEmail.trim(),
      code: resetCode,
      password: resetPassword,
      passwordConfirm: resetPasswordConfirm,
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-sky-50 via-white to-white dark:from-slate-950 dark:via-background dark:to-background px-4 relative overflow-hidden">
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
          <CardTitle className="text-lg">欢迎回来</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="请输入邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 bg-background"
                spellCheck={false}
              />
            </div>
            <div>
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 bg-background"
              />
            </div>
            {loginError ? <p className="text-sm text-destructive animate-shake">{loginError}</p> : null}
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-soft transition-all duration-200 hover:shadow-card-hover active:scale-[0.98]"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              登录
            </Button>
          </form>
          <div className="mt-5 flex items-center justify-between text-sm">
            <Link to="/register" className="text-primary hover:underline">
              注册账号
            </Link>
            <button type="button" className="text-muted-foreground hover:text-primary" onClick={() => setResetOpen(true)}>
              忘记密码？
            </button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>找回密码</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <Label htmlFor="reset-email">邮箱</Label>
              <Input id="reset-email" type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required />
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <Label htmlFor="reset-code">验证码</Label>
                <Input
                  id="reset-code"
                  inputMode="numeric"
                  maxLength={6}
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                />
              </div>
              <AliyunCaptchaButton
                config={captchaConfig.data}
                disabled={sendResetCode.isPending || !resetEmail.trim()}
                onVerify={handleSendResetCode}
              >
                {sendResetCode.isPending ? "发送中..." : "发送验证码"}
              </AliyunCaptchaButton>
            </div>
            <div>
              <Label htmlFor="reset-password">新密码</Label>
              <Input id="reset-password" type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="reset-password-confirm">确认新密码</Label>
              <Input id="reset-password-confirm" type="password" value={resetPasswordConfirm} onChange={(e) => setResetPasswordConfirm(e.target.value)} required />
            </div>
            {resetMessage ? <p className="text-sm text-emerald-600">{resetMessage}</p> : null}
            {resetError ? <p className="text-sm text-destructive">{resetError}</p> : null}
            <Button type="submit" className="w-full" disabled={resetPasswordMutation.isPending}>
              {resetPasswordMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              重置密码
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
