import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM || 'Yorumi <noreply@yorumi.club>';
const appBaseUrl = process.env.APP_BASE_URL || 'https://yorumi-two.vercel.app';

const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function sendVerificationEmail(toEmail: string, username: string, token: string): Promise<boolean> {
  const verifyUrl = `${appBaseUrl}/verify-email?token=${token}&email=${encodeURIComponent(toEmail)}`;
  
  if (!resend) {
    console.warn(`[Email MOCK] Verification email for ${toEmail}: ${verifyUrl}`);
    return true; // Return true in dev/unconfigured mode so registration isn't blocked
  }

  try {
    await resend.emails.send({
      from: emailFrom,
      to: toEmail,
      subject: 'Verify your Yorumi Account',
      html: `
        <div style="font-family: sans-serif; background: #0d0b14; color: #fff; padding: 30px; border-radius: 12px;">
          <h2 style="color: #c084fc;">Welcome to Yorumi, ${username}!</h2>
          <p style="color: #a1a1aa;">Please verify your email address to secure your account and access all features.</p>
          <div style="margin: 25px 0;">
            <a href="${verifyUrl}" style="background: linear-gradient(to right, #a855f7, #6366f1); color: white; padding: 12px 24px; text-decoration: none; border-radius: 30px; font-weight: bold; display: inline-block;">Verify Email Address</a>
          </div>
          <p style="color: #71717a; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error('Failed to send verification email via Resend:', err);
    return false;
  }
}

export async function sendPasswordResetEmail(toEmail: string, token: string): Promise<boolean> {
  const resetUrl = `${appBaseUrl}/reset-password?token=${token}&email=${encodeURIComponent(toEmail)}`;

  if (!resend) {
    console.warn(`[Email MOCK] Password reset email for ${toEmail}: ${resetUrl}`);
    return true;
  }

  try {
    await resend.emails.send({
      from: emailFrom,
      to: toEmail,
      subject: 'Reset your Yorumi Password',
      html: `
        <div style="font-family: sans-serif; background: #0d0b14; color: #fff; padding: 30px; border-radius: 12px;">
          <h2 style="color: #c084fc;">Password Reset Request</h2>
          <p style="color: #a1a1aa;">We received a request to reset your Yorumi password. Click the button below to choose a new password.</p>
          <div style="margin: 25px 0;">
            <a href="${resetUrl}" style="background: linear-gradient(to right, #a855f7, #6366f1); color: white; padding: 12px 24px; text-decoration: none; border-radius: 30px; font-weight: bold; display: inline-block;">Reset Password</a>
          </div>
          <p style="color: #71717a; font-size: 12px;">This link will expire in 1 hour. If you didn't request this, please ignore this email.</p>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error('Failed to send password reset email via Resend:', err);
    return false;
  }
}
