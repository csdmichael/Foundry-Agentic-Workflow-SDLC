/**
 * OTP email delivery. Prefers Azure Communication Services (ACS) Email when
 * configured; otherwise falls back to logging the code to the server console
 * and a dev log file (DEV/DEMO ONLY). ACS packages are optional dependencies.
 */
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';

export async function sendOtpEmail(email: string, code: string): Promise<boolean> {
  const ext = config.api.auth.external;
  const subject = ext.emailSubject;
  const body = `Your ${ext.emailFromName} verification code is ${code}. It expires in ${Math.floor(
    ext.otpTtlSeconds / 60,
  )} minutes.`;

  const conn = config.secrets.acsConnectionString;
  const sender = config.secrets.acsSenderAddress || ext.emailFrom;
  if (conn && sender) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { EmailClient } = require('@azure/communication-email');
      const client = new EmailClient(conn);
      const poller = await client.beginSend({
        senderAddress: sender,
        content: { subject, plainText: body },
        recipients: { to: [{ address: email }] },
      });
      await poller.pollUntilDone();
      return true;
    } catch (err) {
      // Fall through to dev fallback on transport failure.
      // eslint-disable-next-line no-console
      console.error('ACS email send failed, using dev fallback:', err);
    }
  }

  // DEV/DEMO fallback: never use in production.
  logDevOtp(email, code);
  return false;
}

function logDevOtp(email: string, code: string): void {
  // eslint-disable-next-line no-console
  console.warn(`[DEV OTP] ${email} -> ${code} (SMTP/ACS not configured)`);
  try {
    const dir = path.resolve(process.cwd(), config.persistence.file.dataRoot);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'otp-log.json');
    const entries: unknown[] = fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, 'utf-8'))
      : [];
    entries.unshift({
      email,
      code,
      issuedAt: new Date().toISOString(),
      note: 'DEV/DEMO ONLY. ACS not configured.',
    });
    fs.writeFileSync(file, JSON.stringify(entries.slice(0, 200), null, 2), 'utf-8');
  } catch {
    // Non-fatal.
  }
}
