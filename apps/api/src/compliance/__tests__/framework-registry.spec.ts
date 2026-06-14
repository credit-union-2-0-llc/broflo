import 'reflect-metadata';
import {
  isValidFramework,
  getFrameworksForFields,
  FRAMEWORKS_REGISTRY,
  PII_FIELD_FRAMEWORKS,
  RegulatoryFrameworkName,
} from '../frameworks.config';
import {
  ApplicableFrameworks,
  APPLICABLE_FRAMEWORKS_KEY,
  getAppliedFrameworks,
} from '../applicable-frameworks.decorator';

// ---------------------------------------------------------------------------
// isValidFramework
// ---------------------------------------------------------------------------

describe('isValidFramework', () => {
  it('returns true for GDPR', () => {
    expect(isValidFramework('GDPR')).toBe(true);
  });

  it('returns true for CCPA', () => {
    expect(isValidFramework('CCPA')).toBe(true);
  });

  it('returns true for GLBA', () => {
    expect(isValidFramework('GLBA')).toBe(true);
  });

  it('returns true for HIPAA', () => {
    expect(isValidFramework('HIPAA')).toBe(true);
  });

  it('returns false for a misspelling (GDPPR)', () => {
    expect(isValidFramework('GDPPR')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isValidFramework('')).toBe(false);
  });

  it('returns false for a random unknown string', () => {
    expect(isValidFramework('UNKNOWN_FRAMEWORK')).toBe(false);
  });

  it('returns false for lowercase variant', () => {
    expect(isValidFramework('gdpr')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getFrameworksForFields
// ---------------------------------------------------------------------------

describe('getFrameworksForFields', () => {
  it('returns GDPR, CCPA, HIPAA for email field', () => {
    const result = getFrameworksForFields(['email']);
    expect(result.sort()).toEqual(['CCPA', 'GDPR', 'HIPAA'].sort());
  });

  it('returns CCPA, GLBA, HIPAA for ssn field', () => {
    const result = getFrameworksForFields(['ssn']);
    expect(result.sort()).toEqual(['CCPA', 'GLBA', 'HIPAA'].sort());
  });

  it('returns all unique frameworks for email + ssn fields (no duplicates)', () => {
    const result = getFrameworksForFields(['email', 'ssn']);
    const unique = Array.from(new Set(result));
    expect(result.length).toBe(unique.length);
    expect(result.sort()).toEqual(['CCPA', 'GDPR', 'GLBA', 'HIPAA'].sort());
  });

  it('returns GDPR, CCPA, HIPAA for recipientEmail field', () => {
    const result = getFrameworksForFields(['recipientEmail']);
    expect(result.sort()).toEqual(['CCPA', 'GDPR', 'HIPAA'].sort());
  });

  it('returns empty array for unknown field', () => {
    const result = getFrameworksForFields(['unknownField']);
    expect(result).toEqual([]);
  });

  it('returns empty array for empty fields array', () => {
    const result = getFrameworksForFields([]);
    expect(result).toEqual([]);
  });

  it('deduplicates when the same field is listed twice', () => {
    const result = getFrameworksForFields(['email', 'email']);
    const unique = Array.from(new Set(result));
    expect(result.length).toBe(unique.length);
    expect(result.sort()).toEqual(['CCPA', 'GDPR', 'HIPAA'].sort());
  });

  it('ignores unknown fields when mixed with known fields', () => {
    const result = getFrameworksForFields(['email', 'unknownField']);
    expect(result.sort()).toEqual(['CCPA', 'GDPR', 'HIPAA'].sort());
  });
});

// ---------------------------------------------------------------------------
// FRAMEWORKS_REGISTRY immutability
// ---------------------------------------------------------------------------

describe('FRAMEWORKS_REGISTRY immutability', () => {
  it('is frozen (Object.isFrozen)', () => {
    expect(Object.isFrozen(FRAMEWORKS_REGISTRY)).toBe(true);
  });

  it('throws in strict mode when attempting to assign a new key', () => {
    expect(() => {
      // TypeScript will complain, but we test runtime behavior via any cast
      (FRAMEWORKS_REGISTRY as any)['NEW_FRAMEWORK'] = { name: 'NEW_FRAMEWORK', applicableTo: 'email' };
    }).toThrow();
  });

  it('throws in strict mode when attempting to overwrite an existing key', () => {
    expect(() => {
      (FRAMEWORKS_REGISTRY as any)['GDPR'] = { name: 'GDPR', applicableTo: 'ssn' };
    }).toThrow();
  });

  it('contains exactly the four expected frameworks', () => {
    const keys = Object.keys(FRAMEWORKS_REGISTRY).sort();
    expect(keys).toEqual(['CCPA', 'GDPR', 'GLBA', 'HIPAA']);
  });

  it('GDPR entry has correct shape', () => {
    expect(FRAMEWORKS_REGISTRY['GDPR']).toEqual({ name: 'GDPR', applicableTo: 'email' });
  });

  it('GLBA entry has correct shape', () => {
    expect(FRAMEWORKS_REGISTRY['GLBA']).toEqual({ name: 'GLBA', applicableTo: 'ssn' });
  });
});

// ---------------------------------------------------------------------------
// PII_FIELD_FRAMEWORKS immutability
// ---------------------------------------------------------------------------

describe('PII_FIELD_FRAMEWORKS immutability', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(PII_FIELD_FRAMEWORKS)).toBe(true);
  });

  it('email maps to GDPR, CCPA, HIPAA', () => {
    expect((PII_FIELD_FRAMEWORKS['email'] as RegulatoryFrameworkName[]).sort()).toEqual(
      ['CCPA', 'GDPR', 'HIPAA'].sort(),
    );
  });

  it('ssn maps to CCPA, GLBA, HIPAA', () => {
    expect((PII_FIELD_FRAMEWORKS['ssn'] as RegulatoryFrameworkName[]).sort()).toEqual(
      ['CCPA', 'GLBA', 'HIPAA'].sort(),
    );
  });

  it('recipientEmail maps to GDPR, CCPA, HIPAA', () => {
    expect((PII_FIELD_FRAMEWORKS['recipientEmail'] as RegulatoryFrameworkName[]).sort()).toEqual(
      ['CCPA', 'GDPR', 'HIPAA'].sort(),
    );
  });
});

// ---------------------------------------------------------------------------
// ApplicableFrameworks decorator — metadata assignment
// ---------------------------------------------------------------------------

describe('ApplicableFrameworks decorator — metadata assignment', () => {
  it('stores framework metadata on a decorated method', () => {
    class TestController {
      @ApplicableFrameworks(['GDPR', 'CCPA'])
      handleEmail() {}
    }

    const metadata = Reflect.getMetadata(
      APPLICABLE_FRAMEWORKS_KEY,
      TestController.prototype.handleEmail,
    );
    expect(metadata).toEqual(['GDPR', 'CCPA']);
  });

  it('stores GLBA + CCPA metadata for SSN-handling method', () => {
    class TestController {
      @ApplicableFrameworks(['GLBA', 'CCPA'])
      handleSsn() {}
    }

    const metadata = Reflect.getMetadata(
      APPLICABLE_FRAMEWORKS_KEY,
      TestController.prototype.handleSsn,
    );
    expect(metadata).toEqual(['GLBA', 'CCPA']);
  });

  it('stores all four frameworks when all are provided', () => {
    class TestController {
      @ApplicableFrameworks(['GDPR', 'CCPA', 'GLBA', 'HIPAA'])
      handleAll() {}
    }

    const metadata = Reflect.getMetadata(
      APPLICABLE_FRAMEWORKS_KEY,
      TestController.prototype.handleAll,
    );
    expect(metadata).toEqual(['GDPR', 'CCPA', 'GLBA', 'HIPAA']);
  });

  it('stores metadata when a single framework is provided', () => {
    class TestController {
      @ApplicableFrameworks(['HIPAA'])
      handleHipaa() {}
    }

    const metadata = Reflect.getMetadata(
      APPLICABLE_FRAMEWORKS_KEY,
      TestController.prototype.handleHipaa,
    );
    expect(metadata).toEqual(['HIPAA']);
  });
});

// ---------------------------------------------------------------------------
// ApplicableFrameworks decorator — invalid framework rejection
// ---------------------------------------------------------------------------

describe('ApplicableFrameworks decorator — invalid framework rejection', () => {
  it('throws when an unknown framework name is provided', () => {
    expect(() => {
      class TestController {
        @ApplicableFrameworks(['GDPPR']) // typo
        badMethod() {}
      }
      // Reference to suppress unused variable warning
      void TestController;
    }).toThrow('Unknown framework: "GDPPR"');
  });

  it('throws when one valid and one invalid framework are mixed', () => {
    expect(() => {
      class TestController {
        @ApplicableFrameworks(['GDPR', 'INVALID'])
        badMethod() {}
      }
      void TestController;
    }).toThrow('Unknown framework: "INVALID"');
  });

  it('throws with message listing valid frameworks', () => {
    expect(() => {
      class TestController {
        @ApplicableFrameworks(['FAKE'])
        badMethod() {}
      }
      void TestController;
    }).toThrow(/Valid frameworks: GDPR, CCPA, GLBA, HIPAA/);
  });

  it('does NOT throw when all provided frameworks are valid', () => {
    expect(() => {
      class TestController {
        @ApplicableFrameworks(['GDPR', 'CCPA', 'GLBA', 'HIPAA'])
        goodMethod() {}
      }
      void TestController;
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getAppliedFrameworks helper
// ---------------------------------------------------------------------------

describe('getAppliedFrameworks helper', () => {
  it('returns the correct array for a decorated method', () => {
    class TestController {
      @ApplicableFrameworks(['GDPR', 'CCPA'])
      myMethod() {}
    }

    const result = getAppliedFrameworks(TestController.prototype, 'myMethod');
    expect(result).toEqual(['GDPR', 'CCPA']);
  });

  it('returns empty array for a method without the decorator', () => {
    class TestController {
      undecorated() {}
    }

    const result = getAppliedFrameworks(TestController.prototype, 'undecorated');
    expect(result).toEqual([]);
  });

  it('returns empty array for a non-existent method key', () => {
    class TestController {}

    const result = getAppliedFrameworks(TestController.prototype, 'nonExistentMethod');
    expect(result).toEqual([]);
  });

  it('returns GLBA + HIPAA for an SSN-focused method', () => {
    class TestController {
      @ApplicableFrameworks(['GLBA', 'HIPAA'])
      ssnMethod() {}
    }

    const result = getAppliedFrameworks(TestController.prototype, 'ssnMethod');
    expect(result).toEqual(['GLBA', 'HIPAA']);
  });
});