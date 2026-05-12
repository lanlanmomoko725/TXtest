import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.163.com",
  port: 465,
  secure: true,
  auth: {
    user: "tianxianzhi@163.com",
    pass: "TIANXIANGZHI123",
  },
});

export async function sendVerificationEmail(to: string, code: string) {
  const mailOptions = {
    from: '"天象志" <tianxianzhi@163.com>',
    to,
    subject: "天象志 - 邮箱验证码",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #0ea5e9;">天象志 邮箱验证</h2>
        <p>您好！</p>
        <p>您的验证码是：</p>
        <div style="background: #f0f9ff; border-radius: 8px; padding: 16px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #0369a1;">
          ${code}
        </div>
        <p style="color: #64748b; font-size: 14px; margin-top: 16px;">验证码 10 分钟内有效，请勿泄露给他人。</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
        <p style="color: #94a3b8; font-size: 12px;">天象志 - 记录天空的每一种奇迹</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}
