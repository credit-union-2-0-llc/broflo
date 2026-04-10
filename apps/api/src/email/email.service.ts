import { Injectable } from "@nestjs/common";
import { Resend } from "resend";

@Injectable()
export class EmailService {
  private resend: Resend | null;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  async sendPasswordReset(email: string, resetToken: string): Promise<void> {
    const resetUrl = `${process.env.WEB_URL || "http://localhost:3000"}/reset-password?token=${resetToken}`;

    if (!this.resend) {
      console.log(`[broflo-email] DEV MODE — reset link for ${email}: ${resetUrl}`);
      return;
    }

    await this.resend.emails.send({
      from: process.env.EMAIL_FROM || "Broflo <noreply@broflo.com>",
      to: email,
      subject: "Reset your Broflo password",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #18181b;">Reset your password</h2>
          <p>Someone requested a password reset for your Broflo account. If that was you, click the link below. If not, ignore this email.</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #18181b; color: #fafafa; text-decoration: none; border-radius: 6px; margin: 16px 0;">Reset Password</a>
          <p style="color: #71717a; font-size: 14px;">This link expires in 1 hour.</p>
          <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
          <p style="color: #a1a1aa; font-size: 12px;">broflo. — You're busy. We remembered.</p>
        </div>
      `,
      text: `Reset your Broflo password: ${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, ignore this email.`,
    });
  }
}
