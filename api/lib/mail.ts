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

export async function sendVerificationEmail(to: string, code: string) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: env.smtpFrom || env.smtpUser,
    to,
    subject: "Skyweb verification code",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #0ea5e9;">Skyweb email verification</h2>
        <p>Your verification code is:</p>
        <div style="background: #f0f9ff; border-radius: 8px; padding: 16px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #0369a1;">
          ${code}
        </div>
        <p style="color: #64748b; font-size: 14px; margin-top: 16px;">This code is valid for 10 minutes. Do not share it with anyone.</p>
      </div>
    `,
  });
}
