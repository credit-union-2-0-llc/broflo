import { RetailerProfileService } from '../retailer-profile.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('RetailerProfileService — allowlist gate (H2)', () => {
  let prisma: { retailerProfile: { findUnique: jest.Mock } };

  function make(envAllowlist?: string): RetailerProfileService {
    if (envAllowlist === undefined) delete process.env.AGENT_RETAILER_ALLOWLIST;
    else process.env.AGENT_RETAILER_ALLOWLIST = envAllowlist;
    prisma = { retailerProfile: { findUnique: jest.fn() } };
    return new RetailerProfileService(prisma as unknown as PrismaService);
  }

  afterEach(() => {
    delete process.env.AGENT_RETAILER_ALLOWLIST;
  });

  describe('isAllowedRetailer', () => {
    it('allows an apex and its subdomains, case/www-insensitively', () => {
      const svc = make();
      expect(svc.isAllowedRetailer('amazon.com')).toBe(true);
      expect(svc.isAllowedRetailer('www.amazon.com')).toBe(true);
      expect(svc.isAllowedRetailer('smile.amazon.com')).toBe(true);
      expect(svc.isAllowedRetailer('AMAZON.COM')).toBe(true);
    });

    it('blocks unknown and suffix-confusion domains', () => {
      const svc = make();
      expect(svc.isAllowedRetailer('evil.com')).toBe(false);
      expect(svc.isAllowedRetailer('amazon.com.evil.com')).toBe(false);
      expect(svc.isAllowedRetailer('evil-amazon.com')).toBe(false);
      expect(svc.isAllowedRetailer('notamazon.com')).toBe(false);
    });

    it('honors an env-provided allowlist over the default', () => {
      const svc = make('shop.example.com, myretailer.io');
      expect(svc.isAllowedRetailer('shop.example.com')).toBe(true);
      expect(svc.isAllowedRetailer('myretailer.io')).toBe(true);
      expect(svc.isAllowedRetailer('amazon.com')).toBe(false); // default no longer applies
    });
  });

  describe('isSupported', () => {
    it('default-denies a non-allowlisted domain without touching the DB', async () => {
      const svc = make();
      await expect(svc.isSupported('evil.com')).resolves.toBe(false);
      expect(prisma.retailerProfile.findUnique).not.toHaveBeenCalled();
    });

    it('allows an allowlisted domain with no profile history', async () => {
      const svc = make();
      prisma.retailerProfile.findUnique.mockResolvedValue(null);
      await expect(svc.isSupported('amazon.com')).resolves.toBe(true);
    });

    it('respects the circuit breaker for an allowlisted-but-delisted domain', async () => {
      const svc = make();
      prisma.retailerProfile.findUnique.mockResolvedValue({
        supported: false,
        blockedSince: new Date(),
      });
      await expect(svc.isSupported('amazon.com')).resolves.toBe(false);
    });
  });
});
