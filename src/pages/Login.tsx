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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft } from "lucide-react";
import { LOGIN_PASSWORD_MAX_LENGTH, PASSWORD_MAX_LENGTH, validatePasswordPolicy } from "@contracts/password";

function normalizePhoneInput(value: string) {
  return value.replace(/[^\d]/g, "").slice(0, 11);
}

export default function Login() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [smsPhone, setSmsPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [passwordCaptchaRequired, setPasswordCaptchaRequired] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");

  const captchaConfig = trpc.emailAuth.captchaConfig.useQuery();

  const onLoginSuccess = async () => {
    await utils.invalidate();
    navigate("/");
  };

  const passwordLogin = trpc.emailAuth.login.useMutation({
    onSuccess: async () => {
      setPasswordCaptchaRequired(false);
      await onLoginSuccess();
    },
    onError: (err) => {
      if (err.data?.code === "PRECONDITION_FAILED") setPasswordCaptchaRequired(true);
      setLoginError(err.message || "登录失败");
      setLoginMessage("");
    },
  });

  const smsLogin = trpc.emailAuth.loginWithSms.useMutation({
    onSuccess: onLoginSuccess,
    onError: (err) => {
      setLoginError(err.message || "登录失败");
      setLoginMessage("");
    },
  });

  const sendSmsCode = trpc.emailAuth.sendSmsCode.useMutation({
    onSuccess: (data) => {
      setLoginMessage(data.message || "短信验证码已发送。");
      setLoginError("");
    },
    onError: (err) => {
      setLoginError(err.message);
      setLoginMessage("");
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

  const handlePasswordLogin = (e: FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginMessage("");
    if (!identifier.trim() || !password.trim()) return;
    if (passwordCaptchaRequired) {
      setLoginError("请完成人机验证后继续登录。");
      return;
    }
    passwordLogin.mutate({ identifier: identifier.trim(), password });
  };

  const handleCaptchaPasswordLogin = async (captchaVerifyParam: string) => {
    setLoginError("");
    setLoginMessage("");
    if (!identifier.trim() || !password) return false;
    await passwordLogin.mutateAsync({ identifier: identifier.trim(), password, captchaVerifyParam });
    return true;
  };

  const handleSendSmsCode = async (captchaVerifyParam: string) => {
    setLoginError("");
    setLoginMessage("");
    if (smsPhone.trim().length !== 11) {
      setLoginError("请先输入 11 位手机号。");
      return false;
    }
    await sendSmsCode.mutateAsync({ phone: smsPhone.trim(), purpose: "login", captchaVerifyParam });
    return true;
  };

  const handleSmsLogin = (e: FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginMessage("");
    smsLogin.mutate({ phone: smsPhone.trim(), smsCode });
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
    const passwordPolicyError = validatePasswordPolicy(resetPassword);
    if (passwordPolicyError) {
      setResetError(passwordPolicyError);
      return;
    }
    if (resetPassword !== resetPasswordConfirm) {
      setResetError("两次输入的密码不一致。");
      return;
    }
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
        <img src="/logo.png" alt="天象志" width={36} height={36} className="h-9 w-9 rounded-full object-contain" />
        <span>天象志</span>
      </div>

      <Card className="w-full max-w-sm shadow-elevated border-border/60 z-10">
        <CardHeader className="text-center pb-3">
          <CardTitle className="text-lg">欢迎回来</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="sms" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="sms">短信登录</TabsTrigger>
              <TabsTrigger value="password">密码登录</TabsTrigger>
            </TabsList>

            <TabsContent value="sms">
              <form onSubmit={handleSmsLogin} className="space-y-4">
                <div>
                  <Label htmlFor="sms-phone">手机号</Label>
                  <Input
                    id="sms-phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="请输入手机号"
                    value={smsPhone}
                    onChange={(e) => setSmsPhone(normalizePhoneInput(e.target.value))}
                    className="mt-1.5 bg-background"
                    spellCheck={false}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div>
                    <Label htmlFor="sms-code">短信验证码</Label>
                    <Input
                      id="sms-code"
                      inputMode="numeric"
                      maxLength={8}
                      value={smsCode}
                      onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                      className="mt-1.5 bg-background"
                    />
                  </div>
                  <AliyunCaptchaButton
                    config={captchaConfig.data}
                    disabled={sendSmsCode.isPending || smsPhone.trim().length !== 11}
                    onVerify={handleSendSmsCode}
                  >
                    {sendSmsCode.isPending ? "发送中..." : "发送短信码"}
                  </AliyunCaptchaButton>
                </div>
                {loginMessage ? <p className="text-sm text-emerald-600">{loginMessage}</p> : null}
                {loginError ? <p className="text-sm text-destructive animate-shake">{loginError}</p> : null}
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-soft" disabled={smsLogin.isPending || smsPhone.trim().length !== 11 || smsCode.length < 4}>
                  {smsLogin.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  短信登录
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="password">
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div>
                  <Label htmlFor="identifier">邮箱或用户名</Label>
                  <Input
                    id="identifier"
                    autoComplete="username"
                    placeholder="请输入邮箱或用户名"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      setPasswordCaptchaRequired(false);
                    }}
                    className="mt-1.5 bg-background"
                    maxLength={320}
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
                    maxLength={LOGIN_PASSWORD_MAX_LENGTH}
                    className="mt-1.5 bg-background"
                  />
                </div>
                {loginError ? <p className="text-sm text-destructive animate-shake">{loginError}</p> : null}
                {passwordCaptchaRequired ? (
                  <AliyunCaptchaButton
                    config={captchaConfig.data}
                    disabled={passwordLogin.isPending || !identifier.trim() || !password}
                    onVerify={handleCaptchaPasswordLogin}
                  >
                    {passwordLogin.isPending ? "登录中..." : "验证并登录"}
                  </AliyunCaptchaButton>
                ) : (
                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-soft transition-all duration-200 hover:shadow-card-hover active:scale-[0.98]"
                    disabled={passwordLogin.isPending}
                  >
                    {passwordLogin.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    密码登录
                  </Button>
                )}
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-5 flex items-center justify-between text-sm">
            <Link to="/register" className="text-primary hover:underline">
              注册账号
            </Link>
            <button type="button" className="text-muted-foreground hover:text-primary" onClick={() => setResetOpen(true)}>
              忘记密码？
            </button>
          </div>
          <div className="mt-3 text-center text-xs text-muted-foreground">
            旧联系方式和密码均不可用？<Link to="/account-recovery" className="ml-1 text-primary hover:underline">账号恢复</Link>
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
              <Label htmlFor="reset-email">已绑定邮箱</Label>
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
                {sendResetCode.isPending ? "发送中..." : "发送邮箱码"}
              </AliyunCaptchaButton>
            </div>
            <div>
              <Label htmlFor="reset-password">新密码</Label>
              <Input id="reset-password" type="password" autoComplete="new-password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} maxLength={PASSWORD_MAX_LENGTH} required />
            </div>
            <div>
              <Label htmlFor="reset-password-confirm">确认新密码</Label>
              <Input id="reset-password-confirm" type="password" autoComplete="new-password" value={resetPasswordConfirm} onChange={(e) => setResetPasswordConfirm(e.target.value)} maxLength={PASSWORD_MAX_LENGTH} required />
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
