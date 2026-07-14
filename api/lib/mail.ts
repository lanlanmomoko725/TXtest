import nodemailer from "nodemailer";
import { env } from "./env";

function createTransporter() {
  if (!env.smtpHost || !env.smtpUser || !env.smtpPass) {
    throw new Error("Email service is not configured");
  }

  const port = Number(env.smtpPort || 465);
  return nodemailer.createTransport({
    host: env.smtpHost,
    port,
    secure: port === 465,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });
}

export async function sendVerificationEmail(to: string, code: string, options?: { subject?: string; label?: string }) {
  const transporter = createTransporter();
  const label = options?.label || "验证邮箱";
  await transporter.sendMail({
    from: env.smtpFrom || env.smtpUser,
    to,
    subject: options?.subject || "天象志邮箱验证码",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #0ea5e9;">天象志邮箱验证码</h2>
        <p>你正在进行：${label}</p>
        <p>验证码为：</p>
        <div style="background: #f0f9ff; border-radius: 8px; padding: 16px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #0369a1;">
          ${code}
        </div>
        <p style="color: #64748b; font-size: 14px; margin-top: 16px;">验证码 10 分钟内有效，请勿转发给他人。</p>
      </div>
    `,
  });
}

export async function sendSecurityEmail(to: string, subject: string, text: string) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: env.smtpFrom || env.smtpUser,
    to,
    subject,
    text,
  });
}
