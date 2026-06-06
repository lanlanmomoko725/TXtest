const DEFAULT_UPLOAD_TIMEOUT_MS = 30000;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

type UploadResponse = {
  success?: boolean;
  url?: string;
  error?: string;
};

export async function uploadImage(
  file: File,
  purpose: "content" | "avatar" = "content",
  timeoutMs = DEFAULT_UPLOAD_TIMEOUT_MS,
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("请选择图片文件。");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("图片大小不能超过 10MB。");
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const formData = new FormData();
  formData.append("file", file);
  formData.append("purpose", purpose);

  try {
    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
      credentials: "include",
      signal: controller.signal,
    });

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `服务器返回了非预期响应 (${res.status})`);
    }

    const data = (await res.json()) as UploadResponse;
    if (!res.ok || !data.success || !data.url) {
      throw new Error(data.error || `上传失败 (${res.status})`);
    }

    return data.url;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("上传超时，请重试。");
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
