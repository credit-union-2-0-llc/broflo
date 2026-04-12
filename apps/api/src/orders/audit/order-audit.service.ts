import { Injectable, Logger } from '@nestjs/common';

export interface OrderAuditEntry {
  orderId: string;
  userId: string;
  action:
    | 'preview'
    | 'place'
    | 'place_failed'
    | 'cancel'
    | 'cancel_failed'
    | 'refund'
    | 'refund_failed';
  details: Record<string, unknown>;
}

@Injectable()
export class OrderAuditService {
  private readonly log = new Logger(OrderAuditService.name);
  private readonly opsUrl: string | null;
  private readonly opsApiKey: string | null;

  constructor() {
    this.opsUrl = process.env.OPS_PLATFORM_URL || null;
    this.opsApiKey = process.env.OPS_PLATFORM_API_KEY || null;
  }

  async record(entry: OrderAuditEntry): Promise<void> {
    const payload = {
      serviceId: 'broflo-api',
      userId: entry.userId,
      action: entry.action,
      resource: `order/${entry.orderId}`,
      metadata: {
        orderId: entry.orderId,
        ...entry.details,
      },
    };

    // Always log locally for immediate observability
    this.log.log(
      JSON.stringify({
        audit: 'order',
        ...payload,
        timestamp: new Date().toISOString(),
      }),
    );

    // POST to OPS-Platform (required by cu2-standards)
    if (this.opsUrl && this.opsApiKey) {
      try {
        await fetch(`${this.opsUrl}/api/audit/log`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.opsApiKey,
          },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        // OPS-Platform POST failed — log warning but do not block the order flow
        this.log.warn(`OPS-Platform audit POST failed: ${err}`);
      }
    } else {
      this.log.warn(
        'OPS_PLATFORM_URL or OPS_PLATFORM_API_KEY not set — audit event logged locally only',
      );
    }
  }
}
