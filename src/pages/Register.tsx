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
  const message = "密码至少 8 位，并包含数字、大写字母和小写字母。";
  if (password.length < 8) return message;
  if (!/[0-9]/.test(password)) return message;
  if (!/[a-z]/.test(password)) return message;
  if (!/[A-Z]/.test(password)) return message;
  return "";
}

function normalizePhoneInput(value: string) {
  return value.replace(/[^\d]/g, "").slice(0, 11);
}

export default function Register() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const captchaConfig = trpc.emailAuth.captchaConfig.useQuery();
  const sendSmsCode = trpc.emailAuth.sendSmsCode.useMutation({
    onSuccess: (data) => {
      setMessage(data.message || "短信验证码已发送，请留意手机。");
      setError("");
    },
    onError: (err) => {
      setError(err.message);
      setMessage("");
    },
  });
  const sendEmailCode = trpc.emailAuth.sendEmailCode.useMutation({
    onSuccess: (data) => {
      setMessage(data.message || "邮箱验证码已发送，请查收。");
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

  const normalizedPhone = phone.trim();
  const normalizedEmail = email.trim();
  const currentPasswordError = useMemo(() => (password ? passwordError(password) : ""), [password]);
  const canSubmit =
    normalizedPhone.length === 11 &&
    smsCode.length >= 4 &&
    name.trim() &&
    password &&
    passwordConfirm &&
    !currentPasswordError &&
    password === passwordConfirm &&
    (!normalizedEmail || emailCode.length === 6);

  const handleSendSmsCode = async (captchaVerifyParam: string) => {
    setError("");
    setMessage("");
    if (normalizedPhone.length !== 11) {
      setError("请先输入 11 位手机号。");
      return false;
    }
    await sendSmsCode.mutateAsync({ phone: normalizedPhone, purpose: "register", captchaVerifyParam });
    return true;
  };

  const handleSendEmailCode = () => {
    setError("");
    setMessage("");
    if (!normalizedEmail) {
      setError("请先输入邮箱。");
      return;
    }
    sendEmailCode.mutate({ email: normalizedEmail });
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
      phone: normalizedPhone,
      smsCode,
      email: normalizedEmail || undefined,
      emailCode: normalizedEmail ? emailCode : undefined,
      name: name.trim(),
      password,
      passwordConfirm,
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-sky-50 via-white to-white dark:from-slate-950 dark:via-background dark:to-background px-4 py-8 relative overflow-hidden">
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
          <CardTitle className="text-lg">短信验证码注册</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <Label htmlFor="phone">手机号</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(normalizePhoneInput(e.target.value))}
                placeholder="请输入 11 位手机号"
                className="mt-1.5 bg-background"
                required
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
                  required
                />
              </div>
              <AliyunCaptchaButton
                config={captchaConfig.data}
                disabled={sendSmsCode.isPending || normalizedPhone.length !== 11}
                onVerify={handleSendSmsCode}
              >
                {sendSmsCode.isPending ? "发送中..." : "发送短信码"}
              </AliyunCaptchaButton>
            </div>

            <div>
              <Label htmlFor="name">用户名</Label>
              <Input
                id="name"
                autoComplete="username"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 bg-background"
                required
              />
            </div>

            <div className="rounded-lg border border-border/70 bg-muted/30 p-3 space-y-3">
              <div>
                <Label htmlFor="email">邮箱</Label>
                <p className="mt-1 text-xs text-muted-foreground">可选绑定邮箱，后续可以用邮箱登录。</p>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="mt-1.5 bg-background"
                />
              </div>
              {normalizedEmail ? (
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div>
                    <Label htmlFor="email-code">邮箱验证码</Label>
                    <Input
                      id="email-code"
                      inputMode="numeric"
                      maxLength={6}
                      value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="mt-1.5 bg-background"
                    />
                  </div>
                  <Button type="button" variant="outline" onClick={handleSendEmailCode} disabled={sendEmailCode.isPending}>
                    {sendEmailCode.isPending ? "发送中..." : "发送邮箱码"}
                  </Button>
                </div>
              ) : null}
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
