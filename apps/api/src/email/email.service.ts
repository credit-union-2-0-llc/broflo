import { Injectable, Logger } from "@nestjs/common";
import { Resend } from "resend";

@Injectable()
export class EmailService {
  private readonly log = new Logger(EmailService.name);
  private resend: Resend | null;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  async sendOtpCode(email: string, code: string): Promise<void> {
    if (!this.resend) {
      this.log.debug(`DEV MODE — OTP for ${email}: ${code}`);
      return;
    }

    await this.resend.emails.send({
      from: process.env.EMAIL_FROM || "Broflo <noreply@broflo.ai>",
      to: email,
      subject: `${code} is your Broflo code`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #18181b;">Your sign-in code</h2>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #18181b; margin: 24px 0;">${code}</p>
          <p>Enter this code to sign in to Broflo. It expires in 5 minutes.</p>
          <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
          <p style="color: #a1a1aa; font-size: 12px;">If you didn't request this code, you can safely ignore this email.</p>
          <p style="color: #a1a1aa; font-size: 12px;">broflo. — You're busy. We remembered.</p>
        </div>
      `,
      text: `Your Broflo sign-in code is: ${code}\n\nThis code expires in 5 minutes.\n\nIf you didn't request this, ignore this email.`,
    });
  }

  async sendPaymentFailedEmail(email: string): Promise<void> {
    if (!this.resend) {
      this.log.debug(`DEV MODE — payment-failed email for ${email}`);
      return;
    }

    await this.resend.emails.send({
      from: process.env.EMAIL_FROM || "Broflo <noreply@broflo.ai>",
      to: email,
      subject: "Your Broflo payment didn't go through",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #18181b;">Your payment didn't go through</h2>
          <p>We've paused your Pro perks until it's sorted — no rush, your data and dossiers are all still there.</p>
          <p><a href="${process.env.WEB_URL || "https://broflo.ai"}/billing" style="color: #e8a422; font-weight: bold;">Update your payment method</a> to pick back up where you left off.</p>
          <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
          <p style="color: #a1a1aa; font-size: 12px;">broflo. — You're busy. We remembered.</p>
        </div>
      `,
      text: `Your Broflo payment didn't go through. We've paused your Pro perks until it's sorted — your data and dossiers are all still there. Update your payment method at ${process.env.WEB_URL || "https://broflo.ai"}/billing to pick back up.`,
    });
  }
}
