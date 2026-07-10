import { CarrierDetectionService } from "../carrier-detection.service";

describe("CarrierDetectionService", () => {
  const service = new CarrierDetectionService();

  describe("UPS", () => {
    it("detects the classic 1Z format", () => {
      expect(service.detectCarrier("1Z999AA10123456784")).toBe("ups");
    });

    it("is case-insensitive and tolerates whitespace", () => {
      expect(service.detectCarrier(" 1z999aa10123456784 ")).toBe("ups");
    });
  });

  describe("FedEx", () => {
    it("detects a 12-digit Express number", () => {
      expect(service.detectCarrier("123456789012")).toBe("fedex");
    });

    it("detects a 15-digit Ground number", () => {
      expect(service.detectCarrier("123456789012345")).toBe("fedex");
    });

    it("falls back to fedex for a 20-digit number with no USPS prefix", () => {
      expect(service.detectCarrier("12345678901234567890")).toBe("fedex");
    });
  });

  describe("USPS", () => {
    it("detects a 22-digit number with a known service prefix", () => {
      expect(service.detectCarrier("9400111202555842761234")).toBe("usps");
    });

    it("detects the international two-letter format", () => {
      expect(service.detectCarrier("EA123456789US")).toBe("usps");
    });
  });

  describe("unknown", () => {
    it("returns null for something that matches no known format", () => {
      expect(service.detectCarrier("NOT-A-TRACKING-NUMBER")).toBeNull();
    });

    it("returns null for an empty string", () => {
      expect(service.detectCarrier("")).toBeNull();
    });
  });
});
