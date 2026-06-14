/**
 * Regulatory Framework Registry
 *
 * Single source of truth for compliance framework definitions and PII field mappings.
 * This file MUST NOT import from auth/, orders/, or persons/ modules to prevent
 * circular dependencies.
 *
 * Frameworks covered:
 *  - GDPR  (General Data Protection Regulation — EU)
 *  - CCPA  (California Consumer Privacy Act)
 *  - GLBA  (Gramm-Leach-Bliley Act — financial PII)
 *  - HIPAA (Health Insurance Portability and Accountability Act)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Discriminated union representing each known regulatory framework and the
 * PII field(s) it governs. Adding a new framework requires extending this union,
 * FRAMEWORKS_REGISTRY, and PII_FIELD_FRAMEWORKS — keeping all three in sync.
 */
export type RegulatoryFrameworkName = 'GDPR' | 'CCPA' | 'GLBA' | 'HIPAA';

export type RegulatoryFramework =
  | { name: 'GDPR';  applicableTo: 'email' }
  | { name: 'CCPA';  applicableTo: 'email' | 'ssn' }
  | { name: 'GLBA';  applicableTo: 'ssn' }
  | { name: 'HIPAA'; applicableTo: 'email' | 'ssn' };

// ---------------------------------------------------------------------------
// Registry — immutable at runtime via Object.freeze
// ---------------------------------------------------------------------------

/**
 * Canonical registry of all supported regulatory frameworks.
 * Keys are the framework name string; values are the typed definition.
 *
 * Use isValidFramework() to perform type-safe lookups against this object.
 */
export const FRAMEWORKS_REGISTRY: Readonly<Record<RegulatoryFrameworkName, RegulatoryFramework>> =
  Object.freeze({
    GDPR:  { name: 'GDPR',  applicableTo: 'email' },
    CCPA:  { name: 'CCPA',  applicableTo: 'email' },   // CCPA covers both; see PII_FIELD_FRAMEWORKS
    GLBA:  { name: 'GLBA',  applicableTo: 'ssn'   },
    HIPAA: { name: 'HIPAA', applicableTo: 'email' },   // HIPAA covers both; see PII_FIELD_FRAMEWORKS
  } as const);

// ---------------------------------------------------------------------------
// PII field → framework mapping (forward index for audit annotation)
// ---------------------------------------------------------------------------

/**
 * Maps each sensitive PII field name to the list of frameworks that apply to it.
 * This is the authoritative source used by getFrameworksForFields().
 *
 * - email / recipientEmail  → GDPR, CCPA, HIPAA
 * - ssn                     → CCPA, GLBA, HIPAA
 */
export const PII_FIELD_FRAMEWORKS: Readonly<Record<string, RegulatoryFrameworkName[]>> =
  Object.freeze({
    email:          ['GDPR', 'CCPA', 'HIPAA'],
    recipientEmail: ['GDPR', 'CCPA', 'HIPAA'],
    ssn:            ['CCPA', 'GLBA', 'HIPAA'],
  });

// ---------------------------------------------------------------------------
// Type guard & helpers
// ---------------------------------------------------------------------------

/**
 * Type guard that asserts a string is a known RegulatoryFrameworkName.
 * Use this to validate user-supplied or externally-sourced framework names
 * before they are recorded in audit logs.
 *
 * @example
 *   if (isValidFramework('GLBA')) { ... }   // true
 *   if (isValidFramework('GDPPR')) { ... }  // false
 */
export function isValidFramework(name: string): name is RegulatoryFrameworkName {
  return name in FRAMEWORKS_REGISTRY;
}

/**
 * Returns the deduplicated list of framework names that apply to the given
 * array of PII field names.
 *
 * @param fields - e.g. ['email', 'ssn']
 * @returns      - e.g. ['GDPR', 'CCPA', 'HIPAA', 'GLBA']
 *
 * @example
 *   getFrameworksForFields(['email'])        // ['GDPR', 'CCPA', 'HIPAA']
 *   getFrameworksForFields(['ssn'])          // ['CCPA', 'GLBA', 'HIPAA']
 *   getFrameworksForFields(['email', 'ssn']) // ['GDPR', 'CCPA', 'HIPAA', 'GLBA']
 */
export function getFrameworksForFields(fields: string[]): RegulatoryFrameworkName[] {
  const result = new Set<RegulatoryFrameworkName>();

  for (const field of fields) {
    const frameworks = PII_FIELD_FRAMEWORKS[field];
    if (frameworks) {
      for (const fw of frameworks) {
        result.add(fw);
      }
    }
  }

  return Array.from(result);
}