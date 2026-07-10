import { Injectable } from "@nestjs/common";

export type CarrierKey = "usps" | "ups" | "fedex";

// USPS tracking numbers (Priority/Certified/Signature/etc) are 20-22 digit
// numeric strings that conventionally start with one of these service
// indicator prefixes. FedEx Ground/SmartPost numbers can *also* be 20
// digits with no such convention — this is the one genuinely ambiguous
// case; everything else here is unambiguous by length/prefix alone.
const USPS_NUMERIC_PREFIXES = ["94", "93", "92", "82", "70", "23", "91", "03"];

@Injectable()
export class CarrierDetectionService {
  // Heuristic, not a guarantee — reliable for the common cases, may guess
  // wrong at the edges (documented in the carrier tracking plan).
  detectCarrier(trackingNumber: string): CarrierKey | null {
    const cleaned = trackingNumber.trim().toUpperCase().replace(/\s+/g, "");

    if (/^1Z[0-9A-Z]{16}$/.test(cleaned)) return "ups";

    // FedEx Express (12) / Ground (15) — lengths that never collide with USPS.
    if (/^\d{12}$/.test(cleaned) || /^\d{15}$/.test(cleaned)) return "fedex";

    // USPS international format, e.g. EA123456789US.
    if (/^[A-Z]{2}\d{9}US$/.test(cleaned)) return "usps";

    // 20-22 digit numeric: USPS if it matches a known service prefix,
    // otherwise assume FedEx Ground/SmartPost (also commonly 20 digits).
    if (/^\d{20,22}$/.test(cleaned)) {
      const hasUspsPrefix = USPS_NUMERIC_PREFIXES.some((p) => cleaned.startsWith(p));
      return hasUspsPrefix ? "usps" : "fedex";
    }

    return null;
  }
}
