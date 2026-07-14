import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowLeft, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { AliyunCaptchaButton } from "@/components/AliyunCaptchaButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PASSWORD_MAX_LENGTH, validatePasswordPolicy } from "@contracts/password";

function normalizePhoneInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

export default function AccountRecovery() {
  const [params] = useSearchParams();
  const cancelToken = params.get("cancel") || "";
  const completionToken = params.get("complete") || "";
  const [identifier, setIdentifier] = useState("");
  const [contactType, setContactType] = useState<"email" | "phone">("email");
  const [newContact, setNewContact] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"code" | "manual">("code");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const enabled = trpc.recovery.enabled.useQuery();
  const captchaConfig = trpc.emailAuth.captchaConfig.useQuery();
  const sendCode = trpc.recovery.sendCode.useMutation({
    onSuccess: (data) => {
      setMessage(data.message);
      setError("");
    },
    onError: (err) => {
      setError(err.message);
      setMessage("");
    },
  });
  const submit = trpc.recovery.submit.useMutation({
    onSuccess: (data) => {
      setMessage(data.message);
      setError("");
    },
    onError: (err) => {
      setError(err.message);
      setMessage("");
    },
  });
  const cancel = trpc.recovery.cancelByToken.useMutation({
    onSuccess: () => {
      setMessage("恢复申请已取消。");
      setError("");
    },
    onError: (err) => setError(err.message),
  });
  const complete = trpc.recovery.complete.useMutation({
    onSuccess: () => {
      setMessage("账号恢复已完成，请返回登录。");
      setError("");
    },
    onError: (err) => setError(err.message),
  });

  const handleSendCode = async (captchaVerifyParam: string) => {
    if (!identifier.trim() || !newContact.trim()) {
      setError("请先填写账号和新的联系方式。");
      return false;
    }
    await sendCode.mutateAsync({
      identifier: identifier.trim(),
      contactType,
      newContact: newContact.trim(),
      captchaVerifyParam,
    });
    return true;
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (mode === "code" && newPassword !== passwordConfirm) {
      setError("两次输入的密码不一致。");
      return;
    }
    if (mode === "code") {
      const passwordPolicyError = validatePasswordPolicy(newPassword);
      if (passwordPolicyError) {
        setError(passwordPolicyError);
        return;
      }
    }
    submit.mutate({
      identifier: identifier.trim(),
      contactType,
      newContact: newContact.trim(),
      code,
      recoveryCode: mode === "code" ? recoveryCode.trim() : undefined,
      newPassword: mode === "code" ? newPassword : undefined,
    });
  };

  const handleComplete = (event: FormEvent) => {
    event.preventDefault();
    if (newPassword !== passwordConfirm) {
      setError("两次输入的密码不一致。");
      return;
    }
    const passwordPolicyError = validatePasswordPolicy(newPassword);
    if (passwordPolicyError) {
      setError(passwordPolicyError);
      return;
    }
    complete.mutate({ token: completionToken, newPassword });
  };

  const unavailable = enabled.data && !enabled.data.enabled;

  return (
    <div className="min-h-screen bg-muted/20 px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-5">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/login"><ArrowLeft className="mr-1 h-4 w-4" />返回登录</Link>
        </Button>
        <div className="flex items-center gap-2 text-xl font-bold">
          <img src="/logo.png" alt="天象志" className="h-9 w-9 rounded-full object-contain" />
          天象志
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="h-5 w-5 text-primary" />账号恢复
            </CardTitle>
          </CardHeader>
          <CardContent>
            {unavailable ? <p className="text-sm text-muted-foreground">账号恢复功能暂未开放，请联系管理员。</p> : null}

            {cancelToken ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">确认取消该账号的恢复申请。</p>
                <Button variant="destructive" onClick={() => cancel.mutate({ token: cancelToken })} disabled={cancel.isPending || unavailable}>
                  {cancel.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}取消恢复申请
                </Button>
              </div>
            ) : completionToken ? (
              <form onSubmit={handleComplete} className="space-y-4">
                <div>
                  <Label htmlFor="recovery-complete-password">新密码</Label>
                  <Input id="recovery-complete-password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} maxLength={PASSWORD_MAX_LENGTH} className="mt-1.5" required />
                </div>
                <div>
                  <Label htmlFor="recovery-complete-confirm">确认新密码</Label>
                  <Input id="recovery-complete-confirm" type="password" autoComplete="new-password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} maxLength={PASSWORD_MAX_LENGTH} className="mt-1.5" required />
                </div>
                <Button type="submit" className="w-full" disabled={complete.isPending || unavailable}>
                  {complete.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}完成恢复
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="recovery-identifier">账号</Label>
                  <Input id="recovery-identifier" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="用户名、邮箱或手机号" className="mt-1.5" required />
                </div>
                <div>
                  <Label>新的联系方式</Label>
                  <Select value={contactType} onValueChange={(value) => {
                    setContactType(value as "email" | "phone");
                    setNewContact("");
                  }}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">邮箱</SelectItem>
                      <SelectItem value="phone">手机号</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type={contactType === "email" ? "email" : "tel"}
                    inputMode={contactType === "email" ? "email" : "tel"}
                    value={newContact}
                    onChange={(event) => setNewContact(contactType === "phone" ? normalizePhoneInput(event.target.value) : event.target.value)}
                    className="mt-2"
                    required
                  />
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                  <div>
                    <Label htmlFor="recovery-code">新联系方式验证码</Label>
                    <Input id="recovery-code" inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))} className="mt-1.5" required />
                  </div>
                  <AliyunCaptchaButton config={captchaConfig.data} onVerify={handleSendCode} disabled={sendCode.isPending || unavailable}>
                    {sendCode.isPending ? "发送中..." : "发送验证码"}
                  </AliyunCaptchaButton>
                </div>
                <Tabs value={mode} onValueChange={(value) => setMode(value as "code" | "manual")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="code">使用恢复码</TabsTrigger>
                    <TabsTrigger value="manual">人工恢复</TabsTrigger>
                  </TabsList>
                </Tabs>
                {mode === "code" ? (
                  <>
                    <div>
                      <Label htmlFor="recovery-backup-code">恢复码</Label>
                      <Input id="recovery-backup-code" value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} className="mt-1.5 font-mono" required />
                    </div>
                    <div>
                      <Label htmlFor="recovery-password">新密码</Label>
                      <Input id="recovery-password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} maxLength={PASSWORD_MAX_LENGTH} className="mt-1.5" required />
                    </div>
                    <div>
                      <Label htmlFor="recovery-password-confirm">确认新密码</Label>
                      <Input id="recovery-password-confirm" type="password" autoComplete="new-password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} maxLength={PASSWORD_MAX_LENGTH} className="mt-1.5" required />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">人工恢复包含 72 小时冷静期，并由不同管理员完成初审和终审。</p>
                )}
                <Button type="submit" className="w-full" disabled={submit.isPending || code.length < 4 || unavailable}>
                  {submit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {mode === "code" ? "立即恢复" : "提交人工恢复"}
                </Button>
              </form>
            )}
            {message ? <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
            {error ? <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
