import { Resend } from 'resend';
import { env } from '../config/env.js';

let resend: Resend | null = null;
if (env.RESEND_API_KEY) {
  resend = new Resend(env.RESEND_API_KEY);
}

export const sendResetPasswordEmail = async (email: string, token: string): Promise<void> => {
  const resetLink = `${env.CLIENT_URL}/reset-password?token=${token}`;

  // If Resend API key is missing, fall back to console logging in development
  if (!resend) {
    console.log('\n==================================================');
    console.log('📬  PASSWORD RESET EMAIL (DEVELOPMENT MOCK)');
    console.log(`To:      ${email}`);
    console.log(`Subject: Reset Your Fitmode Password`);
    console.log(`Link:    ${resetLink}`);
    console.log('==================================================\n');
    return;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `Fitmode <${env.EMAIL_FROM || 'onboarding@resend.dev'}>`,
      to: [email],
      subject: 'Reset Your Fitmode Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; borderRadius: 8px;">
          <h2 style="color: #18181b;">Reset Your Password</h2>
          <p style="color: #3f3f46; font-size: 16px; line-height: 1.5;">
            You requested to reset your password for your Fitmode account. Click the button below to set a new password:
          </p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${resetLink}" style="background-color: #06b6d4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #71717a; font-size: 14px;">
            This link will expire in 1 hour. If you did not request this password reset, please ignore this email.
          </p>
          <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 20px 0;" />
          <p style="color: #a1a1aa; font-size: 12px;">
            If the button above does not work, copy and paste this URL into your browser: <br />
            <a href="${resetLink}" style="color: #06b6d4;">${resetLink}</a>
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend API Error:', error);
      throw new Error('Failed to send reset password email');
    }
  } catch (err) {
    console.error('Failed to send email:', err);
    throw err;
  }
};
