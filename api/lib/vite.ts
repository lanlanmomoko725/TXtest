import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";

type App = Hono<{ Bindings: HttpBindings }>;

export function serveStaticFiles(app: App) {
  const distPath = path.resolve(import.meta.dirname, "../dist/public");
  const uploadsDir = path.join(distPath, "uploads");

  console.log(`[serveStatic] distPath=${distPath}`);
  console.log(`[serveStatic] uploadsDir=${uploadsDir}`);
  console.log(`[serveStatic] uploadsDir exists=${fs.existsSync(uploadsDir)}`);
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    console.log(`[serveStatic] uploadsDir files count=${files.length}`);
  }

  // Debug logging for uploads requests
  app.use("/uploads/*", async (c, next) => {
    const filename = decodeURIComponent(c.req.path.replace("/uploads/", ""));
    const filePath = path.join(uploadsDir, filename);
    const exists = fs.existsSync(filePath);
    console.log(`[static] UA=${c.req.header("user-agent")?.slice(0, 60)} path=${c.req.path} file=${filePath} exists=${exists}`);
    await next();
  });

  // Use absolute path for root to avoid cwd issues in Docker/container environments
  app.use("*", serveStatic({ root: distPath }));

  app.notFound((c) => {
    const accept = c.req.header("accept") ?? "";
    if (!accept.includes("text/html")) {
      return c.json({ error: "Not Found", path: c.req.path }, 404);
    }
    const indexPath = path.resolve(distPath, "index.html");
    const content = fs.readFileSync(indexPath, "utf-8");
    return c.html(content);
  });
}
