import { assignFrameworks } from '../framework-assignment';

describe('assignFrameworks', () => {
  describe('SSN data type', () => {
    it('returns GLBA, CCPA, and GDPR for ssn', () => {
      const result = assignFrameworks('ssn');
      expect(result).toEqual(['GLBA', 'CCPA', 'GDPR']);
    });

    it('includes GLBA for ssn', () => {
      const assignment = assignFrameworks('ssn');
      expect(assignment).toContain('GLBA');
    });

    it('includes CCPA for ssn', () => {
      const assignment = assignFrameworks('ssn');
      expect(assignment).toContain('CCPA');
    });

    it('includes GDPR for ssn', () => {
      const assignment = assignFrameworks('ssn');
      expect(assignment).toContain('GDPR');
    });

    it('returns exactly 3 frameworks for ssn', () => {
      const assignment = assignFrameworks('ssn');
      expect(assignment).toHaveLength(3);
    });

    it('all ssn frameworks are strings', () => {
      const assignment = assignFrameworks('ssn');
      assignment.forEach((framework: string) => {
        expect(typeof framework).toBe('string');
      });
    });
  });

  describe('email data type', () => {
    it('returns GDPR and CCPA for email', () => {
      const result = assignFrameworks('email');
      expect(result).toEqual(['GDPR', 'CCPA']);
    });

    it('includes GDPR for email', () => {
      const assignment = assignFrameworks('email');
      expect(assignment).toContain('GDPR');
    });

    it('includes CCPA for email', () => {
      const assignment = assignFrameworks('email');
      expect(assignment).toContain('CCPA');
    });

    it('does not include GLBA for email', () => {
      const assignment = assignFrameworks('email');
      expect(assignment).not.toContain('GLBA');
    });

    it('returns exactly 2 frameworks for email', () => {
      const assignment = assignFrameworks('email');
      expect(assignment).toHaveLength(2);
    });

    it('all email frameworks are strings', () => {
      const assignment = assignFrameworks('email');
      assignment.forEach((framework: string) => {
        expect(typeof framework).toBe('string');
      });
    });
  });

  describe('unknown or invalid data types', () => {
    it('returns empty array for unknown data type', () => {
      const result = assignFrameworks('unknown');
      expect(result).toEqual([]);
    });

    it('returns empty array for empty string', () => {
      const result = assignFrameworks('');
      expect(result).toEqual([]);
    });

    it('returns empty array for phone data type', () => {
      const result = assignFrameworks('phone');
      expect(result).toEqual([]);
    });

    it('returns empty array for address data type', () => {
      const result = assignFrameworks('address');
      expect(result).toEqual([]);
    });

    it('returns empty array for arbitrary string', () => {
      const result = assignFrameworks('not-a-real-type');
      expect(result).toEqual([]);
    });

    it('is case-sensitive (SSN uppercase returns empty)', () => {
      const result = assignFrameworks('SSN');
      expect(result).toEqual([]);
    });

    it('is case-sensitive (EMAIL uppercase returns empty)', () => {
      const result = assignFrameworks('EMAIL');
      expect(result).toEqual([]);
    });
  });

  describe('immutability', () => {
    it('returned array for ssn cannot be mutated to affect subsequent calls', () => {
      const first = assignFrameworks('ssn');
      first.push('HIPAA');
      const second = assignFrameworks('ssn');
      expect(second).toEqual(['GLBA', 'CCPA', 'GDPR']);
    });

    it('returned array for email cannot be mutated to affect subsequent calls', () => {
      const first = assignFrameworks('email');
      first.push('GLBA');
      const second = assignFrameworks('email');
      expect(second).toEqual(['GDPR', 'CCPA']);
    });
  });
});