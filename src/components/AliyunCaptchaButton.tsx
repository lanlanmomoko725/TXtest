import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

type CaptchaConfig = {
  enabled: boolean;
  configured: boolean;
  sceneId?: string;
  prefix?: string;
  region: "cn" | "sgp";
};

type AliyunCaptchaButtonProps = {
  config?: CaptchaConfig | null;
  disabled?: boolean;
  children: ReactNode;
  onVerify: (captchaVerifyParam: string) => Promise<boolean>;
};

declare global {
  interface Window {
    AliyunCaptchaConfig?: {
      region: "cn" | "sgp";
      prefix: string;
    };
    initAliyunCaptcha?: (options: Record<string, unknown>) => void;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadAliyunCaptchaScript(config: CaptchaConfig) {
  if (!config.sceneId || !config.prefix) {
    return Promise.reject(new Error("验证码服务未配置。"));
  }

  window.AliyunCaptchaConfig = {
    region: config.region,
    prefix: config.prefix,
  };

  if (window.initAliyunCaptcha) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://o.alicdn.com/captcha-frontend/aliyunCaptcha/AliyunCaptcha.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("人机验证脚本加载失败。"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

function safeDomId(id: string) {
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}

function captchaSlideWidth() {
  return Math.min(360, Math.max(300, window.innerWidth - 48));
}

function captchaRem() {
  return Math.max(14, Math.min(16, (window.innerWidth / 375) * 16));
}

export function AliyunCaptchaButton({ config, disabled, children, onVerify }: AliyunCaptchaButtonProps) {
  const reactId = safeDomId(useId());
  const buttonId = `captcha-button-${reactId}`;
  const elementId = `captcha-element-${reactId}`;
  const hiddenButtonRef = useRef<HTMLButtonElement>(null);
  const verifyRef = useRef(onVerify);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    verifyRef.current = onVerify;
  }, [onVerify]);

  useEffect(() => {
    if (!config?.configured || !config.sceneId || !config.prefix) return;
    let cancelled = false;
    setReady(false);
    setError("");

    loadAliyunCaptchaScript(config)
      .then(() => {
        if (cancelled || !window.initAliyunCaptcha) return;
        window.initAliyunCaptcha({
          SceneId: config.sceneId,
          mode: "popup",
          element: `#${elementId}`,
          button: `#${buttonId}`,
          language: "cn",
          rem: captchaRem(),
          slideStyle: { width: captchaSlideWidth(), height: 40 },
          captchaVerifyCallback: async (captchaVerifyParam: string) => {
            try {
              const ok = await verifyRef.current(captchaVerifyParam);
              return { captchaResult: ok, bizResult: ok };
            } catch {
              return { captchaResult: false, bizResult: false };
            }
          },
          onError: (err: unknown) => {
            setError(err instanceof Error ? err.message : "人机验证初始化失败。");
          },
          onBizResultCallback: () => undefined,
          getInstance: () => undefined,
        });
        setReady(true);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "人机验证初始化失败。"));

    return () => {
      cancelled = true;
    };
  }, [buttonId, config, elementId]);

  const handleClick = async () => {
    setError("");

    if (!config) {
      setError("人机验证配置加载中，请稍后再试。");
      return;
    }

    if (!config.enabled) {
      setError("邮箱验证码注册暂未开放。");
      return;
    }

    if (!config.configured || !config.sceneId || !config.prefix) {
      if (!isDev) {
        setError("验证码服务未配置。");
        return;
      }

      try {
        await verifyRef.current("dev-pass");
      } catch (err) {
        setError(err instanceof Error ? err.message : "人机验证失败。");
      }
      return;
    }

    hiddenButtonRef.current?.click();
  };

  const configError = config && config.enabled && !config.configured && !isDev ? "验证码服务未配置。" : "";
  const disabledByCaptcha =
    !config ||
    !config.enabled ||
    (!!config.configured && !ready) ||
    (!!config.enabled && !config.configured && !isDev);

  return (
    <div className="space-y-2">
      <div id={elementId} className="sr-only" />
      <button ref={hiddenButtonRef} id={buttonId} type="button" className="hidden" aria-hidden="true" />
      <Button type="button" variant="outline" onClick={handleClick} disabled={disabled || disabledByCaptcha}>
        <ShieldCheck className="mr-2 h-4 w-4" />
        {children}
      </Button>
      {configError || error ? <p className="text-xs text-destructive">{error || configError}</p> : null}
    </div>
  );
}
