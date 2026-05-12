import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { writeFile, readdir, stat, readFile, unlink } from "fs/promises";
import { mkdir } from "fs/promises";
import { join } from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { tmpdir } from "os";
const execFileAsync = promisify(execFile);

async function tryHeifConvertCli(heicBuffer: Buffer): Promise<Buffer | null> {
  const tmpIn = join(tmpdir(), `heic-${Math.random().toString(36).slice(2)}.heic`);
  const tmpOut = join(tmpdir(), `heic-${Math.random().toString(36).slice(2)}.jpg`);
  try {
    await writeFile(tmpIn, heicBuffer);
    await execFileAsync("heif-convert", ["-q", "85", tmpIn, tmpOut], { timeout: 15000 });
    const jpeg = await readFile(tmpOut);
    console.log(`[upload] heif-convert CLI succeeded (${heicBuffer.length} -> ${jpeg.length} bytes)`);
    return jpeg;
  } catch (e: any) {
    console.error(`[upload] heif-convert CLI failed: ${e?.message ?? String(e)}`);
    return null;
  } finally {
    await unlink(tmpIn).catch(() => {});
    await unlink(tmpOut).catch(() => {});
  }
}

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));

// File upload endpoint
app.post("/api/upload", async (c) => {
  try {
    const body = await c.req.parseBody({ all: false });
    const file = body.file as File | undefined;
    if (!file) {
      return c.json({ error: "No file uploaded" }, 400);
    }

    const ua = c.req.header("user-agent") ?? "";
    console.log(`[upload] UA=${ua.slice(0, 60)} name=${file.name} type=${file.type} size=${file.size}`);

    // Read file bytes for format detection
    const buffer = Buffer.from(await file.arrayBuffer());

    // Quick format detection by magic bytes
    const isJpg = buffer[0] === 0xFF && buffer[1] === 0xD8;
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    const isWebp = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46
                && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
    const isGif = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38;

    // -- HEIC/HEIF detection by magic bytes --
    // Only check if NOT already identified as a standard format (JPG/PNG/WebP/GIF)
    // ISO BMFF container: bytes 4-7 = "ftyp", bytes 8-11 = brand
    const isHeif = !isJpg && !isPng && !isWebp && !isGif
      && buffer.length >= 12
      && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70  // "ftyp"
      && (     (buffer[8] === 0x68 && buffer[9] === 0x65)  // "he" (heic / heix / hevc / hevx)
            || (buffer[8] === 0x6D && buffer[9] === 0x69)  // "mi" (mif1)
            || (buffer[8] === 0x6D && buffer[9] === 0x73)  // "ms" (msf1)
         );

    // Debug: log first 16 bytes as hex when HEIC-like file is seen
    if (buffer.length >= 12 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
      const hex = [...buffer.slice(0, 16)].map(b => b.toString(16).padStart(2, '0')).join(' ');
      console.log(`[upload] ISO BMFF detected, header hex: ${hex}, isHeif=${isHeif}, isJpg=${isJpg}, isPng=${isPng}`);
    }

    // Determine final extension and let variable hold the write buffer
    let writeBuffer = buffer;
    let finalExt: string | undefined;
    if (isHeif) {
      console.log(`[upload] HEIC/HEIF detected, converting to JPEG (${buffer.length} bytes)...`);
      try {
        const sharp = (await import("sharp")).default;
        writeBuffer = await sharp(buffer).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
        finalExt = "jpg";
        console.log(`[upload] HEIC converted to JPEG (${writeBuffer.length} bytes)`);
      } catch (convErr: any) {
        const msg = convErr?.message ?? String(convErr);
        console.error(`[upload] HEIC conversion failed: ${msg}`);

        // Handle truncated HEIC files: pad to container's expected size
        const seekMatch = msg.match(/bad seek to (\d+)/);
        let paddedBuffer: Buffer | null = null;
        if (seekMatch) {
          const expectedSize = parseInt(seekMatch[1], 10);
          if (buffer.length < expectedSize && expectedSize < buffer.length + 65536) {
            paddedBuffer = Buffer.alloc(expectedSize);
            buffer.copy(paddedBuffer);
            console.log(`[upload] Padded truncated HEIC: ${buffer.length} -> ${expectedSize}`);
          }
        }

        // Retry sharp with padded buffer (if we have one) or original buffer
        const toConvert = paddedBuffer ?? buffer;
        if (toConvert !== buffer || !seekMatch) {
          try {
            const sharp = (await import("sharp")).default;
            writeBuffer = await sharp(toConvert).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
            finalExt = "jpg";
            console.log(`[upload] HEIC converted after retry (${writeBuffer.length} bytes)`);
          } catch (retryErr: any) {
            console.error(`[upload] Sharp retry also failed: ${retryErr?.message ?? String(retryErr)}`);
          }
        }

        // If sharp still failed, try system heif-convert CLI
        if (!finalExt) {
          const cliInput = paddedBuffer ?? buffer;
          writeBuffer = await tryHeifConvertCli(cliInput);
          if (writeBuffer) {
            finalExt = "jpg";
          }
        }

        // Last resort
        if (!finalExt) {
          writeBuffer = buffer;
          finalExt = "heic";
          console.log(`[upload] All conversion methods failed, saving original HEIC`);
        }
      }
    }

    // MIME type validation (skip MIME check for HEIC files since we already converted)
    if (!isHeif) {
      const lowerType = file.type.toLowerCase();
      if (!lowerType.startsWith("image/") || lowerType.includes("heic") || lowerType.includes("heif")) {
        return c.json({
          error: "仅支持 JPG、PNG、GIF、WebP 格式的图片。\n\nOnly JPG, PNG, GIF, WebP images are supported.",
        }, 400);
      }
    }

    // Validate file size (10MB max, after conversion for HEIC)
    if (writeBuffer.length > 10 * 1024 * 1024) {
      return c.json({ error: "文件大小超过 10MB 限制" }, 400);
    }

    // Generate unique filename (normalize extension to lowercase)
    let safeExt: string;
    if (finalExt) {
      safeExt = finalExt.toLowerCase();
    } else {
      const rawExt = file.name.split(".").pop() ?? "jpg";
      const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      safeExt = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext) ? ext : "jpg";
    }
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    const filename = `${timestamp}-${random}.${safeExt}`;

    // Determine upload directory
    const uploadDir = env.isProduction
      ? join(process.cwd(), "dist/public/uploads")
      : join(process.cwd(), "public/uploads");

    await mkdir(uploadDir, { recursive: true });

    const filePath = join(uploadDir, filename);
    await writeFile(filePath, writeBuffer);

    // Verify file was saved
    const fileStats = await import("fs/promises").then((m) => m.stat(filePath));
    if (fileStats.size === 0 || fileStats.size !== writeBuffer.length) {
      console.error(`[upload] File size mismatch: expected ${writeBuffer.length}, got ${fileStats.size}`);
      return c.json({ error: "文件保存失败，请重试" }, 500);
    }
    console.log(`[upload] Saved ${filename} (${fileStats.size} bytes)`);

    const url = `/uploads/${filename}`;
    return c.json({ success: true, url });
  } catch (err) {
    console.error("Upload error:", err);
    return c.json({ error: "上传失败，请重试" }, 500);
  }
});

// Debug endpoint: list uploaded files
app.get("/api/debug/uploads", async (c) => {
  try {
    const uploadDir = env.isProduction
      ? join(process.cwd(), "dist/public/uploads")
      : join(process.cwd(), "public/uploads");
    const files = await readdir(uploadDir);
    const fileList = await Promise.all(
      files.map(async (name) => {
        const s = await stat(join(uploadDir, name));
        return { name, size: s.size, mtime: s.mtime };
      })
    );
    return c.json({
      uploadDir,
      isProduction: env.isProduction,
      count: fileList.length,
      files: fileList,
    });
  } catch (err) {
    return c.json({ error: String(err), uploadDir: env.isProduction ? "dist/public/uploads" : "public/uploads" }, 500);
  }
});

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
