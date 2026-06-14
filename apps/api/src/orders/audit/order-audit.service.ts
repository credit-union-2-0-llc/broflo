import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { isValidFramework } from '../../compliance/frameworks.config';

@Injectable()
export class OrderAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    orderId: string,
    action: string,
    changedBy: string,
    meta?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.orderAuditEntry.create({
      data: {
        orderId,
        action,
        changedBy,
        meta: meta ?? null,
      },
    });
  }

  /**
   * Framework-aware audit record variant.
   * Records which regulatory frameworks governed the PII transaction.
   * Validates all framework names before writing to the DB to ensure
   * immutable, well-formed audit entries.
   *
   * @param orderId    - The order being audited
   * @param action     - The action taken (e.g., 'created', 'status_changed')
   * @param changedBy  - Actor identifier ('system' or 'user-{id}')
   * @param frameworks - Array of applicable framework names (GDPR, CCPA, GLBA, HIPAA)
   * @param meta       - Optional additional metadata
   */
  async recordWithFrameworks(
    orderId: string,
    action: string,
    changedBy: string,
    frameworks: string[],
    meta?: Record<string, unknown>,
  ): Promise<void> {
    // Validate at record time — final safety check before DB write
    for (const fw of frameworks) {
      if (!isValidFramework(fw)) {
        throw new Error(
          `Invalid framework in audit record: "${fw}". Valid frameworks: GDPR, CCPA, GLBA, HIPAA`,
        );
      }
    }

    await this.prisma.orderAuditEntry.create({
      data: {
        orderId,
        action,
        changedBy,
        frameworkTags: frameworks,
        meta: meta ?? null,
      },
    });
  }
}