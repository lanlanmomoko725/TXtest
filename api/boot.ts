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
import { detectImageFormat, extensionForFormat, MAX_UPLOAD_BYTES } from "./lib/upload-validation";

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
    const user = await authenticateRequest(c.req.raw.headers, authHeaders);
    if (!user) {
      return attachHeaders(c.json({ error: "Authentication required" }, 401), authHeaders);
    }

    const body = await c.req.parseBody({ all: false });
    const file = body.file as File | undefined;
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

    let writeBuffer: Buffer<ArrayBufferLike> = buffer;
    let safeExt = extensionForFormat(format);

    if (format === "heif") {
      try {
        const sharp = (await import("sharp")).default;
        writeBuffer = await sharp(buffer, { limitInputPixels: 80_000_000 }).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
        safeExt = "jpg";
        console.log(`[upload] HEIF converted with sharp (${buffer.length} -> ${writeBuffer.length} bytes)`);
      } catch (sharpErr: unknown) {
        const message = sharpErr instanceof Error ? sharpErr.message : String(sharpErr);
        console.error(`[upload] sharp HEIF conversion failed: ${message}`);
        const cliBuffer = await tryHeifConvertCli(buffer);
        if (!cliBuffer) {
          return attachHeaders(c.json({ error: "HEIF conversion failed. Please upload JPG, PNG, GIF, or WebP." }, 400), authHeaders);
        }
        writeBuffer = cliBuffer;
        safeExt = "jpg";
      }
    }

    if (writeBuffer.length > MAX_UPLOAD_BYTES) {
      return attachHeaders(c.json({ error: "Converted file exceeds the 10MB limit" }, 400), authHeaders);
    }

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    const filename = `${timestamp}-${random}.${safeExt}`;

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
