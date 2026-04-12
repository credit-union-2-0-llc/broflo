import { createHmac, timingSafeEqual } from 'crypto';

export function verifyWebhookSignature(
  payload: Buffer,
  signature: string,
  secret: string,
): boolean {
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
