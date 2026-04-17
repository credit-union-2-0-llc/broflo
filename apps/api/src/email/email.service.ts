import { Injectable } from "@nestjs/common";
import { Resend } from "resend";

@Injectable()
export class EmailService {
  private resend: Resend | null;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  async sendOtpCode(email: string, code: string): Promise<void> {
    if (!this.resend) {
      console.log(`[broflo-email] DEV MODE — OTP for ${email}: ${code}`);
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
}
