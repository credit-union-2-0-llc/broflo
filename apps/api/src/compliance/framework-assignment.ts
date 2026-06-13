// Framework assignments are compliance metadata only and do not enforce runtime protection.

const FRAMEWORK_MAP: Readonly<Record<string, readonly string[]>> = Object.freeze({
  ssn: Object.freeze(['GLBA', 'CCPA', 'GDPR']),
  email: Object.freeze(['GDPR', 'CCPA']),
});

export function assignFrameworks(dataType: string): string[] {
  const frameworks = FRAMEWORK_MAP[dataType];
  if (!frameworks) {
    return [];
  }
  return [...frameworks];
}