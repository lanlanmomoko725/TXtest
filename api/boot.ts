import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { authenticateRequest, createContext } from "./context";
import { env } from "./lib/env";
import { writeFile, readdir, stat, readFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { detectImageFormat, extensionForFormat, MAX_UPLOAD_BYTES } from "./lib/upload-validation";
import type { ImageFormat } from "./lib/upload-validation";
import { consumeRateLimit, rateLimitKey } from "./lib/rate-limit";
import { requestIp } from "./lib/request-info";

const execFileAsync = promisify(execFile);
const BODY_LIMIT_BYTES = 15 * 1024 * 1024;

async function tryHeifConvertCli(heicBuffer: Buffer<ArrayBufferLike>): Promise<Buffer<ArrayBufferLike> | null> {
  const tmpIn = join(tmpdir(), `heic-${Math.random().toString(36).slice(2)}.heic`);
  const tmpOut = join(tmpdir(), `heic-${Math.random().toString(36).slice(2)}.jpg`);
  try {
    await writeFile(tmpIn, heicBuffer);
    await execFileAsync("heif-convert", ["-q", "85", tmpIn, tmpOut], { timeout: 15000 });
    const jpeg = await readFile(tmpOut);
    console.log(`[upload] heif-convert CLI succeeded (${heicBuffer.length} -> ${jpeg.length} bytes)`);
    return jpeg;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[upload] heif-convert CLI failed: ${message}`);
    return null;
  } finally {
    await unlink(tmpIn).catch(() => {});
    await unlink(tmpOut).catch(() => {});
  }
}

function attachHeaders(response: Response, headers: Headers): Response {
  headers.forEach((value, key) => response.headers.append(key, value));
  return response;
}

function isAllowedRequestOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    const host = headers.get("host");
    if (host && originUrl.host === host) return true;

    const allowedOrigins = env.allowedOrigins
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    return allowedOrigins.includes(originUrl.origin);
  } catch {
    return false;
  }
}

function uploadDir(): string {
  return env.isProduction ? join(process.cwd(), "dist/public/uploads") : join(process.cwd(), "public/uploads");
}

async function normalizeUploadedImage(
  buffer: Buffer<ArrayBufferLike>,
  format: ImageFormat,
): Promise<{ buffer: Buffer<ArrayBufferLike>; ext: string }> {
  if (format === "heif") {
    try {
      const sharp = (await import("sharp")).default;
      const converted = await sharp(buffer, { limitInputPixels: 80_000_000 })
        .rotate()
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
      console.log(`[upload] HEIF converted with sharp (${buffer.length} -> ${converted.length} bytes)`);
      return { buffer: converted, ext: "jpg" };
    } catch (sharpErr: unknown) {
      const message = sharpErr instanceof Error ? sharpErr.message : String(sharpErr);
      console.error(`[upload] sharp HEIF conversion failed: ${message}`);
      const cliBuffer = await tryHeifConvertCli(buffer);
      if (!cliBuffer) {
        throw new Error("HEIF conversion failed. Please upload JPG, PNG, GIF, or WebP.");
      }
      return { buffer: cliBuffer, ext: "jpg" };
    }
  }

  const sharp = (await import("sharp")).default;
  const image = sharp(buffer, { limitInputPixels: 80_000_000 }).rotate();
  if (format === "jpg") {
    return { buffer: await image.jpeg({ quality: 85, mozjpeg: true }).toBuffer(), ext: "jpg" };
  }
  if (format === "png") {
    return { buffer: await image.png({ compressionLevel: 9 }).toBuffer(), ext: "png" };
  }
  if (format === "webp") {
    return { buffer: await image.webp({ quality: 85 }).toBuffer(), ext: "webp" };
  }

  // Store GIF uploads as a static first-frame PNG to avoid animation bombs and scriptable container quirks.
  return { buffer: await image.png({ compressionLevel: 9 }).toBuffer(), ext: "png" };
}

const app = new Hono<{ Bindings: HttpBindings }>();

app.use("/api/*", async (c, next) => {
  const method = c.req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    await next();
    return;
  }

  if (!isAllowedRequestOrigin(c.req.raw.headers)) {
    return c.json({ error: "Invalid request origin" }, 403);
  }

  await next();
});

app.use(bodyLimit({ maxSize: BODY_LIMIT_BYTES }));

app.post("/api/upload", async (c) => {
  const authHeaders = new Headers();
  try {
    const ip = requestIp(c.req.raw.headers);
    const user = await authenticateRequest(c.req.raw.headers, authHeaders);
    if (!user) {
      return attachHeaders(c.json({ error: "Authentication required" }, 401), authHeaders);
    }

    const body = await c.req.parseBody({ all: false });
    const file = body.file as File | undefined;
    const purpose = body.purpose === "avatar" ? "avatar" : "content";
    if (user.level < 99 && purpose !== "avatar") {
      return attachHeaders(c.json({ error: "Administrator permission required" }, 403), authHeaders);
    }
    await consumeRateLimit({
      key: rateLimitKey("upload", purpose, "user", user.id),
      limit: purpose === "avatar" ? 10 : 30,
      windowMs: 60 * 60 * 1000,
      event: "upload_user_rate_limited",
      userId: user.id,
      ip,
    });
    await consumeRateLimit({
      key: rateLimitKey("upload", purpose, "ip", ip),
      limit: purpose === "avatar" ? 30 : 60,
      windowMs: 60 * 60 * 1000,
      event: "upload_ip_rate_limited",
      userId: user.id,
      ip,
    });
    if (!file) {
      return attachHeaders(c.json({ error: "No file uploaded" }, 400), authHeaders);
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return attachHeaders(c.json({ error: "File size exceeds the 10MB limit" }, 400), authHeaders);
    }

    console.log(`[upload] user=${user.id} name=${file.name} type=${file.type} size=${file.size}`);

    const buffer: Buffer<ArrayBufferLike> = Buffer.from(await file.arrayBuffer());
    const format = detectImageFormat(buffer);
    if (!format) {
      return attachHeaders(c.json({ error: "Only JPG, PNG, GIF, WebP, and HEIF images are supported" }, 400), authHeaders);
    }

    let normalized: { buffer: Buffer<ArrayBufferLike>; ext: string };
    try {
      normalized = await normalizeUploadedImage(buffer, format);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Image conversion failed.";
      return attachHeaders(c.json({ error: message }, 400), authHeaders);
    }
    const writeBuffer = normalized.buffer;
    const safeExt = normalized.ext || extensionForFormat(format);

    if (writeBuffer.length > MAX_UPLOAD_BYTES) {
      return attachHeaders(c.json({ error: "Converted file exceeds the 10MB limit" }, 400), authHeaders);
    }

    const filename = `${randomUUID()}.${safeExt}`;

    const dir = uploadDir();
    await mkdir(dir, { recursive: true });

    const filePath = join(dir, filename);
    await writeFile(filePath, writeBuffer);

    const fileStats = await stat(filePath);
    if (fileStats.size === 0 || fileStats.size !== writeBuffer.length) {
      console.error(`[upload] File size mismatch: expected ${writeBuffer.length}, got ${fileStats.size}`);
      return attachHeaders(c.json({ error: "File save failed. Please try again." }, 500), authHeaders);
    }

    return attachHeaders(c.json({ success: true, url: `/uploads/${filename}` }), authHeaders);
  } catch (err) {
    console.error("Upload error:", err);
    return attachHeaders(c.json({ error: "Upload failed. Please try again." }, 500), authHeaders);
  }
});

if (!env.isProduction) {
  app.get("/api/debug/uploads", async (c) => {
    try {
      const dir = uploadDir();
      const files = await readdir(dir);
      const fileList = await Promise.all(
        files.map(async (name) => {
          const fileStat = await stat(join(dir, name));
          return { name, size: fileStat.size, mtime: fileStat.mtime };
        }),
      );
      return c.json({
        uploadDir: dir,
        isProduction: env.isProduction,
        count: fileList.length,
        files: fileList,
      });
    } catch (err) {
      return c.json({ error: String(err), uploadDir: uploadDir() }, 500);
    }
  });
}

app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});

app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
