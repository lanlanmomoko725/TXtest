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

type AliyunCaptchaInstance = {
  destroy?: () => void;
  refresh?: () => void;
  reset?: () => void;
};

type AliyunCaptchaOptions = {
  SceneId: string;
  mode: "popup";
  element: string;
  button: string;
  language: "cn";
  rem: number;
  slideStyle: { width: number; height: number };
  success: (captchaVerifyParam: string) => void;
  fail: (result: unknown) => void;
  onError: (err: unknown) => void;
  getInstance: (instance: AliyunCaptchaInstance) => void;
};

declare global {
  interface Window {
    AliyunCaptchaConfig?: {
      region: "cn" | "sgp";
      prefix: string;
    };
    initAliyunCaptcha?: (options: AliyunCaptchaOptions) => void;
  }
}

let scriptPromise: Promise<void> | null = null;

function readableError(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return fallback;
}

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
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("人机验证脚本加载失败。"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

function safeDomId(id: string) {
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}

export function getAliyunCaptchaSlideStyle(viewportWidth = 360) {
  const availableWidth = Math.max(240, viewportWidth - 32);
  return {
    width: Math.round(Math.min(360, availableWidth)),
    height: 40,
  };
}

export function getAliyunCaptchaRem() {
  return 1;
}

export function AliyunCaptchaButton({ config, disabled, children, onVerify }: AliyunCaptchaButtonProps) {
  const reactId = safeDomId(useId());
  const buttonId = `captcha-button-${reactId}`;
  const elementId = `captcha-element-${reactId}`;
  const hiddenButtonRef = useRef<HTMLButtonElement>(null);
  const captchaInstanceRef = useRef<AliyunCaptchaInstance | null>(null);
  const verifyRef = useRef(onVerify);
  const [ready, setReady] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    verifyRef.current = onVerify;
  }, [onVerify]);

  useEffect(() => {
    if (!config?.configured || !config.sceneId || !config.prefix) return;
    const sceneId = config.sceneId;
    let cancelled = false;
    setReady(false);
    setError("");

    loadAliyunCaptchaScript(config)
      .then(() => {
        if (cancelled || !window.initAliyunCaptcha) return;
        window.initAliyunCaptcha({
          SceneId: sceneId,
          mode: "popup",
          element: `#${elementId}`,
          button: `#${buttonId}`,
          language: "cn",
          rem: getAliyunCaptchaRem(),
          slideStyle: getAliyunCaptchaSlideStyle(window.innerWidth),
          success: (captchaVerifyParam: string) => {
            void (async () => {
              if (cancelled) return;
              setVerifying(true);
              setError("");
              try {
                const ok = await verifyRef.current(captchaVerifyParam);
                if (!ok && !cancelled) {
                  setError("人机验证未通过，请重新验证。");
                  captchaInstanceRef.current?.refresh?.();
                }
              } catch (err) {
                if (!cancelled) {
                  setError(readableError(err, "人机验证失败，请稍后重试。"));
                  captchaInstanceRef.current?.refresh?.();
                }
              } finally {
                if (!cancelled) setVerifying(false);
              }
            })();
          },
          fail: () => {
            if (!cancelled) {
              setError("人机验证未通过，请重新滑动。");
            }
          },
          onError: (err: unknown) => {
            if (!cancelled) {
              setError(readableError(err, "人机验证初始化失败。"));
            }
          },
          getInstance: (instance: AliyunCaptchaInstance) => {
            if (cancelled) {
              instance.destroy?.();
              return;
            }
            captchaInstanceRef.current = instance;
          },
        });
        setReady(true);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(readableError(err, "人机验证初始化失败。"));
        }
      });

    return () => {
      cancelled = true;
      captchaInstanceRef.current?.destroy?.();
      captchaInstanceRef.current = null;
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

      setVerifying(true);
      try {
        await verifyRef.current("dev-pass");
      } catch (err) {
        setError(readableError(err, "人机验证失败。"));
      } finally {
        setVerifying(false);
      }
      return;
    }

    hiddenButtonRef.current?.click();
  };

  const configError = config && config.enabled && !config.configured && !isDev ? "验证码服务未配置。" : "";
  const disabledByCaptcha =
    !config ||
    !config.enabled ||
    verifying ||
    (!!config.configured && !ready) ||
    (!!config.enabled && !config.configured && !isDev);

  return (
    <div className="space-y-2">
      <div
        id={elementId}
        className="relative h-0 w-full max-w-full overflow-visible"
        style={{ maxWidth: "min(360px, calc(100vw - 2rem))" }}
      />
      <button
        ref={hiddenButtonRef}
        id={buttonId}
        type="button"
        className="absolute h-px w-px overflow-hidden opacity-0"
        aria-hidden="true"
        tabIndex={-1}
      />
      <Button type="button" variant="outline" onClick={handleClick} disabled={disabled || disabledByCaptcha}>
        <ShieldCheck className="mr-2 h-4 w-4" />
        {children}
      </Button>
      {configError || error ? <p className="text-xs text-destructive">{error || configError}</p> : null}
    </div>
  );
}
