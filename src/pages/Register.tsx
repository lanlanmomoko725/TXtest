import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { AliyunCaptchaButton } from "@/components/AliyunCaptchaButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Cloud, Loader2, UserPlus } from "lucide-react";

function passwordError(password: string) {
  if (password.length < 8) return "密码至少 8 位，并包含数字、大写字母和小写字母。";
  if (!/[0-9]/.test(password)) return "密码至少 8 位，并包含数字、大写字母和小写字母。";
  if (!/[a-z]/.test(password)) return "密码至少 8 位，并包含数字、大写字母和小写字母。";
  if (!/[A-Z]/.test(password)) return "密码至少 8 位，并包含数字、大写字母和小写字母。";
  return "";
}

export default function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const captchaConfig = trpc.emailAuth.captchaConfig.useQuery();
  const sendCode = trpc.emailAuth.sendCode.useMutation({
    onSuccess: (data) => {
      setMessage(data.message || "验证码已发送，请查收邮箱。");
      setError("");
    },
    onError: (err) => {
      setError(err.message);
      setMessage("");
    },
  });
  const register = trpc.emailAuth.register.useMutation({
    onSuccess: () => {
      navigate("/login");
    },
    onError: (err) => {
      setError(err.message);
      setMessage("");
    },
  });

  const normalizedEmail = email.trim();
  const currentPasswordError = useMemo(() => (password ? passwordError(password) : ""), [password]);
  const canSubmit =
    normalizedEmail &&
    name.trim() &&
    code.length === 6 &&
    password &&
    passwordConfirm &&
    !currentPasswordError &&
    password === passwordConfirm;

  const handleSendCode = async (captchaVerifyParam: string) => {
    setError("");
    setMessage("");
    if (!normalizedEmail) {
      setError("请先输入邮箱。");
      return false;
    }
    await sendCode.mutateAsync({ email: normalizedEmail, captchaVerifyParam });
    return true;
  };

  const handleRegister = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (currentPasswordError) {
      setError(currentPasswordError);
      return;
    }
    if (password !== passwordConfirm) {
      setError("两次输入的密码不一致。");
      return;
    }
    register.mutate({
      email: normalizedEmail,
      name: name.trim(),
      code,
      password,
      passwordConfirm,
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

      <Card className="w-full max-w-md shadow-elevated border-border/60 z-10">
        <CardHeader className="text-center pb-3">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserPlus className="h-5 w-5" />
          </div>
          <CardTitle className="text-lg">邮箱验证码注册</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 bg-background"
                required
              />
            </div>
            <div>
              <Label htmlFor="name">昵称</Label>
              <Input
                id="name"
                autoComplete="nickname"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 bg-background"
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <Label htmlFor="code">邮箱验证码</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="mt-1.5 bg-background"
                  required
                />
              </div>
              <AliyunCaptchaButton
                config={captchaConfig.data}
                disabled={sendCode.isPending || !normalizedEmail}
                onVerify={handleSendCode}
              >
                {sendCode.isPending ? "发送中..." : "发送验证码"}
              </AliyunCaptchaButton>
            </div>
            <div>
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 bg-background"
                required
              />
              {currentPasswordError ? <p className="mt-1 text-xs text-muted-foreground">{currentPasswordError}</p> : null}
            </div>
            <div>
              <Label htmlFor="passwordConfirm">确认密码</Label>
              <Input
                id="passwordConfirm"
                type="password"
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className="mt-1.5 bg-background"
                required
              />
            </div>
            {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
            {error ? <p className="text-sm text-destructive animate-shake">{error}</p> : null}
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-soft" disabled={register.isPending || !canSubmit}>
              {register.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              完成注册
            </Button>
          </form>
          <div className="mt-5 text-center text-sm text-muted-foreground">
            已有账号？{" "}
            <Link to="/login" className="text-primary hover:underline">
              返回登录
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
