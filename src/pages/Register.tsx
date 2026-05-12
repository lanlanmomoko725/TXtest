import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Cloud, Loader2, ArrowLeft, Mail, CheckCircle } from "lucide-react";

export default function Register() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  function calcDisplayLength(name: string): number {
    let len = 0;
    for (const char of name) {
      len += char.charCodeAt(0) > 127 ? 2 : 1;
    }
    return len;
  }
  const [countdown, setCountdown] = useState(0);

  const sendCode = trpc.emailAuth.sendCode.useMutation({
    onSuccess: (data) => {
      setStep(2);
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      if (data.devCode) {
        setCode(data.devCode);
      }
    },
    onError: (err) => {
      setError(err.message || "发送失败");
    },
  });

  const register = trpc.emailAuth.register.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      navigate("/");
    },
    onError: (err) => {
      setError(err.message || "注册失败");
    },
  });

  const handleSendCode = () => {
    setError("");
    if (!email.trim() || !email.includes("@")) {
      setError("请输入有效的邮箱地址");
      return;
    }
    sendCode.mutate({ email: email.trim() });
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!code.trim() || code.length !== 6) {
      setError("请输入6位验证码");
      return;
    }
    if (!name.trim()) {
      setError("请输入昵称");
      return;
    }
    if (calcDisplayLength(name) > 20) {
      setError("昵称过长：最多10个汉字或20个英文字母");
      return;
    }
    if (password.length < 6) {
      setError("密码至少6位");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次密码不一致");
      return;
    }
    setStep(3);
    register.mutate({
      email: email.trim(),
      code: code.trim(),
      name: name.trim(),
      password,
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-white px-4">
      <Link to="/" className="absolute top-6 left-6 flex items-center gap-1 text-sm text-slate-500 hover:text-sky-600">
        <ArrowLeft className="h-4 w-4" />
        返回首页
      </Link>

      <div className="flex items-center gap-2 mb-8 text-2xl font-bold text-slate-900">
        <Cloud className="h-7 w-7 text-sky-600" />
        <span>天象志</span>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-lg">注册账号</CardTitle>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="reg-email">邮箱</Label>
                <Input
                  id="reg-email"
                  type="email"
                  placeholder="请输入邮箱地址"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button
                className="w-full bg-sky-600 hover:bg-sky-700"
                onClick={handleSendCode}
                disabled={sendCode.isPending}
              >
                {sendCode.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                获取验证码
              </Button>
              <Separator />
              <p className="text-center text-sm text-slate-500">
                已有账号？{" "}
                <Link to="/login" className="text-sky-600 hover:underline">
                  立即登录
                </Link>
              </p>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <Label>邮箱</Label>
                <div className="flex items-center gap-2 mt-1 p-2 bg-slate-50 rounded-md text-sm text-slate-700">
                  <Mail className="h-4 w-4 text-slate-400" />
                  {email}
                </div>
              </div>
              <div>
                <Label htmlFor="code">验证码</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="code"
                    placeholder="6位数字"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={countdown > 0 || sendCode.isPending}
                    onClick={handleSendCode}
                  >
                    {countdown > 0 ? `${countdown}秒` : "重新发送"}
                  </Button>
                </div>
                {sendCode.data?.devCode && (
                  <p className="text-xs text-amber-600 mt-1">
                    开发环境验证码：{sendCode.data.devCode}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="name">昵称</Label>
                <Input
                  id="name"
                  placeholder="给自己起个名字"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1"
                  maxLength={20}
                />
                <p className="text-xs text-slate-400 mt-1">最多10个汉字或20个英文字母</p>
              </div>
              <div>
                <Label htmlFor="reg-password">密码</Label>
                <Input
                  id="reg-password"
                  type="password"
                  placeholder="至少6位"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="confirm">确认密码</Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="再次输入密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button
                type="submit"
                className="w-full bg-sky-600 hover:bg-sky-700"
              >
                完成注册
              </Button>
            </form>
          )}

          {step === 3 && (
            <div className="text-center py-6 space-y-4">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <p className="text-slate-600">注册成功，正在跳转...</p>
              {register.isPending && (
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-sky-600" />
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
