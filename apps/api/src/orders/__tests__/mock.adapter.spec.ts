import { MockAdapter } from '../adapters/mock/mock.adapter';
import { RetailerOrderError } from '../adapters/retailer.adapter';
import type { RetailerProduct, ShippingAddress } from '../adapters/retailer.adapter';

jest.setTimeout(10000);

// placeOrder has a genuine, intentional 5% random failure rate (per D-07).
// Tests that just need a successful placement to exercise other behavior
// (not testing the failure path itself) retry past it rather than being
// flaky — each attempt is independently ~95% likely to succeed, so the
// odds of exhausting 10 retries are astronomically lower than the ~5%
// per-run flakiness this replaces. Pinning specific Math.random() call
// indices instead is fragile — see git history on this file for why.
async function placeOrderRetryingSimulatedFailures(
  adapter: MockAdapter,
  product: RetailerProduct,
  shippingAddress: ShippingAddress,
  stripePaymentIntentId: string,
) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      return await adapter.placeOrder(product, shippingAddress, stripePaymentIntentId);
    } catch (err) {
      if (!(err instanceof RetailerOrderError) || err.code !== 'MOCK_FAILURE') throw err;
    }
  }
  throw new Error('placeOrder kept hitting the simulated 5% failure rate 10 times in a row');
}

describe('MockAdapter', () => {
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter();
  });

  describe('searchProducts', () => {
    it('returns at least 6 flower items when searching for flowers', async () => {
      const results = await adapter.searchProducts('flowers', 0, 999999);
      expect(results.length).toBeGreaterThanOrEqual(6);
      results.forEach((p) => {
        expect(p.retailerHint).toBe('flowers');
      });
    });

    it('returns spa items when searching for spa', async () => {
      const results = await adapter.searchProducts('spa', 0, 999999);
      expect(results.length).toBeGreaterThan(0);
    });

    it('only returns items within budget range 3000-5000', async () => {
      const results = await adapter.searchProducts('', 3000, 5000);
      results.forEach((p) => {
        expect(p.priceCents).toBeGreaterThanOrEqual(3000);
        expect(p.priceCents).toBeLessThanOrEqual(5000);
      });
    });

    it('falls back to budget-only matching for nonsense keyword', async () => {
      const results = await adapter.searchProducts('xyznonexistentproduct1234', 0, 999999);
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns empty when no products match budget range', async () => {
      const results = await adapter.searchProducts('xyznonexistentproduct1234', 0, 100);
      expect(results).toHaveLength(0);
    });

    it('returns results sorted by price ascending', async () => {
      const results = await adapter.searchProducts('flowers', 0, 999999);
      for (let i = 1; i < results.length; i++) {
        expect(results[i].priceCents).toBeGreaterThanOrEqual(results[i - 1].priceCents);
      }
    });
  });

  describe('getProduct', () => {
    it('returns the Classic Rose Bouquet for mock-001', async () => {
      const product = await adapter.getProduct('mock-001');
      expect(product.id).toBe('mock-001');
      expect(product.title).toBe('Classic Rose Bouquet');
    });

    it('throws RetailerOrderError with code NOT_FOUND for nonexistent product', async () => {
      await expect(adapter.getProduct('nonexistent')).rejects.toThrow(RetailerOrderError);
      await expect(adapter.getProduct('nonexistent')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('placeOrder', () => {
    it('returns an OrderResult with retailerOrderId starting with MOCK-', async () => {
      const shippingAddress = {
        name: 'Jane Doe',
        address1: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zip: '97201',
      };
      const product = await adapter.getProduct('mock-001');
      const result = await placeOrderRetryingSimulatedFailures(
        adapter,
        product,
        shippingAddress,
        'pi_test_123',
      );

      expect(result.retailerOrderId).toMatch(/^MOCK-\d+$/);
      expect(result.confirmationNumber).toMatch(/^CONF-[A-Z0-9]{6}$/);
      expect(result.actualPriceCents).toBe(product.priceCents);
    });
  });

  describe('cancelOrder', () => {
    it('returns { success: true } for a recently placed order', async () => {
      const product = await adapter.getProduct('mock-001');
      const shippingAddress = {
        name: 'Jane Doe',
        address1: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zip: '97201',
      };
      const orderResult = await placeOrderRetryingSimulatedFailures(
        adapter,
        product,
        shippingAddress,
        'pi_test_456',
      );
      const cancelResult = await adapter.cancelOrder(orderResult.retailerOrderId);
      expect(cancelResult.success).toBe(true);
    });
  });
});
