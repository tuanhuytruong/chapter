import { Resend } from "resend";
import { config } from "./config.js";

export async function sendPasswordResetEmail(input: { to: string; resetUrl: string }): Promise<void> {
  if (!config.resendApiKey) throw new Error("Password recovery email is not configured");
  const resend = new Resend(config.resendApiKey);
  const result = await resend.emails.send({
    from: config.resendFrom,
    to: input.to,
    subject: "Reset your Chapter password",
    text: `We received a request to reset your Chapter password. Use this link within ${config.passwordResetTtlMinutes} minutes: ${input.resetUrl}\n\nIf you did not request this, you can safely ignore this email.`,
    html: `<main style="font-family:Georgia,serif;color:#26342a;max-width:560px;margin:0 auto;padding:24px"><h1 style="font-size:24px">Reset your Chapter password</h1><p>We received a request to reset your password.</p><p><a href="${input.resetUrl}" style="display:inline-block;background:#526a52;color:#fff;padding:12px 18px;border-radius:999px;text-decoration:none;font-family:Arial,sans-serif;font-weight:700">Reset password</a></p><p>This link expires in ${config.passwordResetTtlMinutes} minutes and can be used once.</p><p>If you did not request this, you can safely ignore this email.</p></main>`,
  });
  if (result.error) throw new Error(`Resend delivery failed: ${result.error.name}`);
}
