import { SetMetadata } from '@nestjs/common';
import { isValidFramework } from './frameworks.config';

export const APPLICABLE_FRAMEWORKS_KEY = 'applicableFrameworks';

/**
 * Decorator to annotate routes that handle sensitive PII.
 * Usage:
 *   @ApplicableFrameworks(['GLBA', 'CCPA'])
 *   async placeOrder(@Body() dto: PlaceOrderDto) { ... }
 *
 * Runtime validation: unknown framework names throw at decorator definition time
 * (i.e., during app startup / module load), catching misconfiguration early.
 */
export function ApplicableFrameworks(frameworks: string[]): MethodDecorator & ClassDecorator {
  for (const fw of frameworks) {
    if (!isValidFramework(fw)) {
      throw new Error(
        `Unknown framework: "${fw}". Valid frameworks: GDPR, CCPA, GLBA, HIPAA`,
      );
    }
  }
  return SetMetadata(APPLICABLE_FRAMEWORKS_KEY, frameworks);
}

/**
 * Helper to extract framework metadata from a decorated method.
 * Uses Reflect directly to avoid importing Reflector (which requires a NestJS
 * DI context) in unit-test contexts.
 *
 * Returns empty array if the decorator was not applied.
 */
export function getAppliedFrameworks(
  target: object,
  propertyKey: string | symbol,
): string[] {
  // NestJS SetMetadata stores metadata via Reflect under the key
  // composed as `${APPLICABLE_FRAMEWORKS_KEY}` on the method descriptor.
  const descriptor = Object.getOwnPropertyDescriptor(target, propertyKey);
  if (!descriptor) {
    return [];
  }
  const metadata = Reflect.getMetadata(
    APPLICABLE_FRAMEWORKS_KEY,
    descriptor.value,
  );
  return Array.isArray(metadata) ? metadata : [];
}