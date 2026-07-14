import { useEffect, useRef, useState } from "react";
import type { ComponentProps, FormEvent } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { AliyunCaptchaButton } from "@/components/AliyunCaptchaButton";
import { USERNAME_HINT, USERNAME_MAX_UNITS, USERNAME_PLACEHOLDER } from "@contracts/username";
import { LOGIN_PASSWORD_MAX_LENGTH } from "@contracts/password";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { uploadImage } from "@/lib/upload";
import { ArrowLeft, Camera, Clock3, KeyRound, Loader2, Mail, Phone, Save, ShieldCheck, User } from "lucide-react";

function normalizePhoneInput(value: string) {
  return value.replace(/[^\d]/g, "").slice(0, 11);
}

type StepUpMethod = "password" | "email" | "phone";

function StepUpFields(props: {
  method: StepUpMethod;
  onMethodChange: (value: StepUpMethod) => void;
  proof: string;
  onProofChange: (value: string) => void;
  hasEmail: boolean;
  hasPhone: boolean;
  verified: boolean;
  pending: boolean;
  captchaConfig: ComponentProps<typeof AliyunCaptchaButton>["config"];
  onSendCode: (method: "email" | "phone", captchaVerifyParam: string) => Promise<boolean>;
  onVerify: () => void;
  actionLabel?: string;
}) {
  const codeMethod = props.method === "email" || props.method === "phone";
  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <Label>当前身份验证</Label>
        {props.verified ? <Badge variant="outline" className="border-emerald-300 text-emerald-600">已完成</Badge> : null}
      </div>
      <Select value={props.method} onValueChange={(value) => props.onMethodChange(value as StepUpMethod)} disabled={props.verified}>
        <SelectTrigger aria-label="选择身份验证方式">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="password">当前密码</SelectItem>
          {props.hasEmail ? <SelectItem value="email">旧邮箱验证码</SelectItem> : null}
          {props.hasPhone ? <SelectItem value="phone">旧手机号验证码</SelectItem> : null}
        </SelectContent>
      </Select>
      <div className={codeMethod ? "grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3" : ""}>
        <div>
          <Label>{props.method === "password" ? "当前密码" : "验证码"}</Label>
          <Input
            type={props.method === "password" ? "password" : "text"}
            inputMode={codeMethod ? "numeric" : undefined}
            autoComplete={props.method === "password" ? "current-password" : "one-time-code"}
            value={props.proof}
            onChange={(event) => props.onProofChange(codeMethod ? event.target.value.replace(/\D/g, "").slice(0, 8) : event.target.value)}
            maxLength={props.method === "password" ? LOGIN_PASSWORD_MAX_LENGTH : 8}
            className="mt-1.5"
            disabled={props.verified}
          />
        </div>
        {codeMethod ? (
          <AliyunCaptchaButton
            config={props.captchaConfig}
            disabled={props.pending || props.verified}
            onVerify={(captcha) => props.onSendCode(props.method as "email" | "phone", captcha)}
          >
            {props.pending ? "发送中..." : "发送旧联系方式码"}
          </AliyunCaptchaButton>
        ) : null}
      </div>
      {!props.verified ? (
        <Button type="button" variant="outline" onClick={props.onVerify} disabled={props.pending || !props.proof.trim()}>
          {props.pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
          {props.actionLabel ?? "验证身份"}
        </Button>
      ) : null}
    </div>
  );
}

export default function AccountInfo() {
  const { user, isLoading, refresh } = useAuth({ redirectOnUnauthenticated: true });
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [emailGrantToken, setEmailGrantToken] = useState("");
  const [phoneGrantToken, setPhoneGrantToken] = useState("");
  const [emailStepMethod, setEmailStepMethod] = useState<"password" | "email" | "phone">("password");
  const [phoneStepMethod, setPhoneStepMethod] = useState<"password" | "email" | "phone">("password");
  const [emailStepProof, setEmailStepProof] = useState("");
  const [phoneStepProof, setPhoneStepProof] = useState("");
  const [recoveryStepMethod, setRecoveryStepMethod] = useState<"password" | "email" | "phone">("password");
  const [recoveryStepProof, setRecoveryStepProof] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  const isDirectProfileSave = (user?.level ?? 0) >= 99;
  const profileChangeStatus = trpc.auth.profileChangeStatus.useQuery(undefined, {
    enabled: Boolean(user && !isDirectProfileSave),
  });
  const captchaConfig = trpc.emailAuth.captchaConfig.useQuery();
  const recoveryRequests = trpc.recovery.mine.useQuery(undefined, {
    enabled: Boolean(user && user.role === "user" && user.level < 99),
  });
  const cancelRecovery = trpc.recovery.cancel.useMutation({
    onSuccess: async () => {
      await recoveryRequests.refetch();
      setMessage("恢复申请已取消。");
      setError("");
    },
    onError: (err) => setError(err.message),
  });

  useEffect(() => {
    if (!user) return;
    setName(user.name || "");
    setAvatar(user.avatar || "");
  }, [user]);

  useEffect(() => {
    setEmailGrantToken("");
  }, [newEmail]);

  useEffect(() => {
    setPhoneGrantToken("");
  }, [phone]);

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: async (data) => {
      await refresh();
      await utils.auth.profileChangeStatus.invalidate();
      await utils.post.list.invalidate();
      setMessage(data.reviewRequired ? "资料变更已提交审核，通过后才会公开。" : "个人资料已更新。");
      setError("");
    },
    onError: (err) => {
      setError(err.message);
      setMessage("");
    },
  });

  const sendBindEmailCode = trpc.auth.sendBindEmailCode.useMutation({
    onSuccess: (data) => {
      setMessage(data.message || "邮箱验证码已发送。");
      setError("");
    },
    onError: (err) => {
      setError(err.message);
      setMessage("");
    },
  });

  const bindEmail = trpc.auth.bindEmail.useMutation({
    onSuccess: async () => {
      await refresh();
      setNewEmail("");
      setEmailCode("");
      setMessage("邮箱已绑定。");
      setError("");
    },
    onError: (err) => {
      setError(err.message);
      setMessage("");
    },
  });

  const sendBindPhoneCode = trpc.auth.sendBindPhoneCode.useMutation({
    onSuccess: (data) => {
      setMessage(data.message || "短信验证码已发送。");
      setError("");
    },
    onError: (err) => {
      setError(err.message);
      setMessage("");
    },
  });

  const bindPhone = trpc.auth.bindPhone.useMutation({
    onSuccess: async () => {
      await refresh();
      setPhone("");
      setSmsCode("");
      setMessage("手机号已绑定。");
      setError("");
    },
    onError: (err) => {
      setError(err.message);
      setMessage("");
    },
  });

  const sendStepUpCode = trpc.auth.sendStepUpCode.useMutation({
    onSuccess: (data) => {
      setMessage(data.message);
      setError("");
    },
    onError: (err) => {
      setError(err.message);
      setMessage("");
    },
  });

  const createStepUpGrant = trpc.auth.createStepUpGrant.useMutation();
  const generateRecoveryCodes = trpc.auth.generateRecoveryCodes.useMutation({
    onSuccess: (data) => {
      setRecoveryCodes(data.codes);
      setRecoveryStepProof("");
      setMessage("新的恢复码已生成，旧恢复码已经失效。请立即妥善保存。");
      setError("");
    },
    onError: (err) => {
      setError(err.message);
      setMessage("");
    },
  });

  const handleSendStepUpCode = async (method: "email" | "phone", captchaVerifyParam: string) => {
    await sendStepUpCode.mutateAsync({ method, captchaVerifyParam });
    return true;
  };

  const verifyContactChange = async (type: "email" | "phone") => {
    const method = type === "email" ? emailStepMethod : phoneStepMethod;
    const proof = type === "email" ? emailStepProof : phoneStepProof;
    const target = type === "email" ? newEmail.trim() : phone.trim();
    if (!target) {
      setError(type === "email" ? "请先输入新邮箱。" : "请先输入新手机号。");
      return;
    }
    if (!proof.trim()) {
      setError(method === "password" ? "请输入当前密码。" : "请输入旧联系方式收到的验证码。");
      return;
    }
    try {
      const grant = await createStepUpGrant.mutateAsync({
        action: type === "email" ? "bind_email" : "bind_phone",
        target,
        method,
        proof: proof.trim(),
      });
      if (type === "email") setEmailGrantToken(grant.grantToken);
      else setPhoneGrantToken(grant.grantToken);
      setMessage("身份验证完成，请在 10 分钟内验证新的联系方式。");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "身份验证失败。");
      setMessage("");
    }
  };

  const handleGenerateRecoveryCodes = async () => {
    if (!recoveryStepProof.trim()) {
      setError(recoveryStepMethod === "password" ? "请输入当前密码。" : "请输入验证码。");
      return;
    }
    try {
      const grant = await createStepUpGrant.mutateAsync({
        action: "recovery_codes",
        target: "",
        method: recoveryStepMethod,
        proof: recoveryStepProof.trim(),
      });
      await generateRecoveryCodes.mutateAsync({ grantToken: grant.grantToken });
    } catch (err) {
      setError(err instanceof Error ? err.message : "恢复码生成失败。");
      setMessage("");
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setError("头像文件不能超过 1MB。");
      setMessage("");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    const isAllowedAvatar = ["image/jpeg", "image/png"].includes(file.type) || /\.(jpe?g|png)$/i.test(file.name);
    if (!isAllowedAvatar) {
      setError("头像仅支持 JPG 或 PNG。");
      setMessage("");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setUploading(true);
    setError("");
    setMessage("");
    try {
      setAvatar(await uploadImage(file, "avatar"));
      setMessage(isDirectProfileSave ? "头像已上传，保存后生效。" : "头像已上传，提交审核后才会公开。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "头像上传失败。");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSaveProfile = (e: FormEvent) => {
    e.preventDefault();
    updateProfile.mutate({
      name: name.trim(),
      avatar: avatar || undefined,
    });
  };

  const handleBindEmail = (e: FormEvent) => {
    e.preventDefault();
    bindEmail.mutate({ email: newEmail.trim(), code: emailCode, grantToken: emailGrantToken });
  };

  const handleSendPhoneCode = async (captchaVerifyParam: string) => {
    setError("");
    setMessage("");
    if (phone.trim().length !== 11) {
      setError("请先输入 11 位手机号。");
      return false;
    }
    if (!phoneGrantToken) {
      setError("请先完成身份验证。");
      return false;
    }
    await sendBindPhoneCode.mutateAsync({ phone: phone.trim(), grantToken: phoneGrantToken, captchaVerifyParam });
    return true;
  };

  const handleSendEmailCode = async (captchaVerifyParam: string) => {
    setError("");
    setMessage("");
    if (!newEmail.trim()) {
      setError("请先输入邮箱。");
      return false;
    }
    if (!emailGrantToken) {
      setError("请先完成身份验证。");
      return false;
    }
    await sendBindEmailCode.mutateAsync({ email: newEmail.trim(), grantToken: emailGrantToken, captchaVerifyParam });
    return true;
  };

  const handleBindPhone = (e: FormEvent) => {
    e.preventDefault();
    bindPhone.mutate({ phone: phone.trim(), smsCode, grantToken: phoneGrantToken });
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const status = profileChangeStatus.data;
  const pendingName = status?.name.pending ?? null;
  const pendingAvatar = status?.avatar.pending ?? null;
  const nameLocked = !isDirectProfileSave && (Boolean(pendingName) || Boolean(status?.name.usedThisYear));
  const avatarLocked = !isDirectProfileSave && (Boolean(pendingAvatar) || Boolean(status?.avatar.usedThisYear));
  const nameQuotaText = isDirectProfileSave
    ? "管理员资料会直接保存。"
    : pendingName
      ? "用户名审核中，本年次数暂未消耗。"
      : status?.name.usedThisYear
        ? `${status.year} 年用户名更换次数已用完。`
        : `${status?.year ?? new Date().getFullYear()} 年用户名还可提交 1 次。`;
  const avatarQuotaText = isDirectProfileSave
    ? "管理员头像会直接保存。"
    : pendingAvatar
      ? "头像审核中，本年次数暂未消耗。"
      : status?.avatar.usedThisYear
        ? `${status.year} 年头像更换次数已用完。`
        : `${status?.year ?? new Date().getFullYear()} 年头像还可提交 1 次。`;
  const profileSubmitDisabled =
    updateProfile.isPending ||
    uploading ||
    !name.trim() ||
    (!isDirectProfileSave && nameLocked && avatarLocked);

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to={`/profile/${user.id}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回个人主页
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-bold text-foreground">个人信息</h1>
          <p className="mt-1 text-sm text-muted-foreground">管理头像、用户名、邮箱和手机号。</p>
        </div>

        {message ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-primary" />
              基础资料
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {!isDirectProfileSave ? (
                <div className="rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  L0 用户头像和用户名需提交审核，通过后才会在个人主页公开；每项每个自然年可审核通过一次。
                </div>
              ) : null}
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={avatar || undefined} className="object-cover" />
                  <AvatarFallback className="bg-primary/10 text-primary text-xl">
                    {(name || "用户").slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <label
                    className={`relative inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors ${
                      avatarLocked || uploading
                        ? "cursor-not-allowed opacity-60"
                        : "cursor-pointer hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    {uploading ? "上传中..." : "更换头像"}
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                      className="absolute inset-0 cursor-pointer opacity-0"
                      onChange={handleUpload}
                      disabled={uploading || avatarLocked}
                    />
                  </label>
                  <p className="text-xs text-muted-foreground">支持 JPG、PNG，文件不超过 1MB。</p>
                  <p className="text-xs text-muted-foreground">{avatarQuotaText}</p>
                  {pendingAvatar ? (
                    <div className="flex items-center gap-2 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      待审头像：<img src={pendingAvatar.value} alt="待审头像" className="h-6 w-6 rounded-full object-cover" />
                    </div>
                  ) : null}
                </div>
              </div>
              <div>
                <Label htmlFor="account-name">用户名</Label>
                <Input
                  id="account-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={USERNAME_PLACEHOLDER}
                  className="mt-1.5"
                  maxLength={USERNAME_MAX_UNITS}
                  disabled={nameLocked}
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">{USERNAME_HINT}</p>
                <p className="mt-1 text-xs text-muted-foreground">{nameQuotaText}</p>
                {pendingName ? (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock3 className="h-3.5 w-3.5" />
                    待审用户名：<span className="font-medium text-foreground">{pendingName.value}</span>
                  </p>
                ) : null}
              </div>
              <Button type="submit" disabled={profileSubmitDisabled}>
                {updateProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                {isDirectProfileSave ? "保存基础资料" : "提交审核"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="h-5 w-5 text-primary" />
              邮箱绑定
              {user.emailVerified ? <Badge variant="outline" className="border-emerald-300 text-emerald-600">已验证</Badge> : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              当前邮箱：{user.email || "未绑定"}
            </p>
            <form onSubmit={handleBindEmail} className="space-y-4">
              <div>
                <Label htmlFor="bind-email">新邮箱</Label>
                <Input
                  id="bind-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="mt-1.5"
                  placeholder="name@example.com"
                  required
                />
              </div>
              <StepUpFields
                method={emailStepMethod}
                onMethodChange={(value) => {
                  setEmailStepMethod(value);
                  setEmailStepProof("");
                  setEmailGrantToken("");
                }}
                proof={emailStepProof}
                onProofChange={setEmailStepProof}
                hasEmail={Boolean(user.emailVerified && user.email)}
                hasPhone={Boolean(user.phoneVerified && user.phoneMasked)}
                verified={Boolean(emailGrantToken)}
                pending={sendStepUpCode.isPending || createStepUpGrant.isPending}
                captchaConfig={captchaConfig.data}
                onSendCode={handleSendStepUpCode}
                onVerify={() => void verifyContactChange("email")}
              />
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                <div>
                  <Label htmlFor="bind-email-code">邮箱验证码</Label>
                  <Input
                    id="bind-email-code"
                    inputMode="numeric"
                    maxLength={6}
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="mt-1.5"
                    required
                  />
                </div>
                <AliyunCaptchaButton
                  config={captchaConfig.data}
                  disabled={sendBindEmailCode.isPending || !newEmail.trim() || !emailGrantToken}
                  onVerify={handleSendEmailCode}
                >
                  {sendBindEmailCode.isPending ? "发送中..." : "发送邮箱码"}
                </AliyunCaptchaButton>
              </div>
              <Button type="submit" disabled={bindEmail.isPending || !emailGrantToken || !newEmail.trim() || emailCode.length !== 6}>
                {bindEmail.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                绑定或换绑邮箱
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Phone className="h-5 w-5 text-primary" />
              手机号绑定
              {user.phoneVerified ? <Badge variant="outline" className="border-emerald-300 text-emerald-600">已验证</Badge> : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              当前手机号：{user.phoneMasked || "未绑定"}
            </p>
            <form onSubmit={handleBindPhone} className="space-y-4">
              <div>
                <Label htmlFor="bind-phone">新手机号</Label>
                <Input
                  id="bind-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(normalizePhoneInput(e.target.value))}
                  className="mt-1.5"
                  placeholder="请输入 11 位手机号"
                  required
                />
              </div>
              <StepUpFields
                method={phoneStepMethod}
                onMethodChange={(value) => {
                  setPhoneStepMethod(value);
                  setPhoneStepProof("");
                  setPhoneGrantToken("");
                }}
                proof={phoneStepProof}
                onProofChange={setPhoneStepProof}
                hasEmail={Boolean(user.emailVerified && user.email)}
                hasPhone={Boolean(user.phoneVerified && user.phoneMasked)}
                verified={Boolean(phoneGrantToken)}
                pending={sendStepUpCode.isPending || createStepUpGrant.isPending}
                captchaConfig={captchaConfig.data}
                onSendCode={handleSendStepUpCode}
                onVerify={() => void verifyContactChange("phone")}
              />
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                <div>
                  <Label htmlFor="bind-phone-code">短信验证码</Label>
                  <Input
                    id="bind-phone-code"
                    inputMode="numeric"
                    maxLength={8}
                    value={smsCode}
                    onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    className="mt-1.5"
                    required
                  />
                </div>
                <AliyunCaptchaButton
                  config={captchaConfig.data}
                  disabled={sendBindPhoneCode.isPending || phone.trim().length !== 11 || !phoneGrantToken}
                  onVerify={handleSendPhoneCode}
                >
                  {sendBindPhoneCode.isPending ? "发送中..." : "发送短信码"}
                </AliyunCaptchaButton>
              </div>
              <Button type="submit" disabled={bindPhone.isPending || !phoneGrantToken || phone.trim().length !== 11 || smsCode.length < 4}>
                {bindPhone.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                绑定或换绑手机号
              </Button>
            </form>
          </CardContent>
        </Card>

        {user.role === "user" && user.level < 99 ? <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="h-5 w-5 text-primary" />
              账号恢复码
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              当密码和旧联系方式都不可用时，可使用任意一个恢复码验证账号。每个恢复码只能使用一次。
            </p>
            <StepUpFields
              method={recoveryStepMethod}
              onMethodChange={(value) => {
                setRecoveryStepMethod(value);
                setRecoveryStepProof("");
              }}
              proof={recoveryStepProof}
              onProofChange={setRecoveryStepProof}
              hasEmail={Boolean(user.emailVerified && user.email)}
              hasPhone={Boolean(user.phoneVerified && user.phoneMasked)}
              verified={false}
              pending={sendStepUpCode.isPending || createStepUpGrant.isPending || generateRecoveryCodes.isPending}
              captchaConfig={captchaConfig.data}
              onSendCode={handleSendStepUpCode}
              onVerify={() => void handleGenerateRecoveryCodes()}
              actionLabel="验证并生成恢复码"
            />
            {(recoveryRequests.data ?? []).filter((request) => ["pending", "initial_approved", "final_approved"].includes(request.status)).map((request) => (
              <div key={request.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">进行中的人工恢复申请</div>
                  <div className="text-xs text-muted-foreground">冷静期结束：{new Date(request.availableAt).toLocaleString("zh-CN")}</div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => cancelRecovery.mutate({ requestId: request.id })} disabled={cancelRecovery.isPending}>
                  取消申请
                </Button>
              </div>
            ))}
            {recoveryCodes.length ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950">
                <p className="mb-3 text-sm font-medium">这些恢复码只显示一次，请离线保存：</p>
                <div className="grid grid-cols-1 gap-2 font-mono text-sm sm:grid-cols-2">
                  {recoveryCodes.map((code) => <code key={code}>{code}</code>)}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card> : null}
      </div>
    </div>
  );
}
