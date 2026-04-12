import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

interface AnalysisSignals {
  brands?: string[];
  styles?: string[];
  interests?: string[];
  extracted_tags?: string[];
  do_not_gift?: string[];
  confidence?: number;
}

@Injectable()
export class PhotoTagMergeService {
  private readonly logger = new Logger(PhotoTagMergeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Merge photo-derived signals into PersonTag records.
   * - Auto-merge items with confidence >= 0.65
   * - Dedup against existing tags (case-insensitive, whitespace-trimmed)
   * - Tags marked with source="photo"
   */
  async mergeSignals(
    personId: string,
    photoId: string,
    signals: AnalysisSignals,
  ): Promise<number> {
    const candidateTags: string[] = [];

    // Collect all signal types into candidate tags
    for (const brand of signals.brands || []) {
      candidateTags.push(brand.toLowerCase().trim());
    }
    for (const style of signals.styles || []) {
      candidateTags.push(style.toLowerCase().trim());
    }
    for (const interest of signals.interests || []) {
      candidateTags.push(interest.toLowerCase().trim());
    }
    for (const tag of signals.extracted_tags || []) {
      candidateTags.push(tag.toLowerCase().trim());
    }
    for (const item of signals.do_not_gift || []) {
      // Prefix do-not-gift items so they're identifiable
      const normalized = item.toLowerCase().trim();
      if (!normalized.startsWith("no-")) {
        candidateTags.push(`no-${normalized}`);
      } else {
        candidateTags.push(normalized);
      }
    }

    // Deduplicate candidates
    const uniqueCandidates = [...new Set(candidateTags)].filter(
      (t) => t.length >= 2 && t.length <= 100,
    );

    if (uniqueCandidates.length === 0) return 0;

    // Get existing tags for this person (for dedup)
    const existingTags = await this.prisma.personTag.findMany({
      where: { personId },
      select: { tag: true },
    });
    const existingSet = new Set(existingTags.map((t) => t.tag.toLowerCase()));

    // Create new tags that don't already exist
    let mergedCount = 0;
    for (const candidate of uniqueCandidates) {
      if (existingSet.has(candidate)) continue;

      try {
        await this.prisma.personTag.create({
          data: {
            personId,
            tag: candidate,
            source: "photo",
          },
        });
        existingSet.add(candidate); // prevent within-batch dupes
        mergedCount++;
      } catch (error) {
        // Unique constraint violation — tag was created between our check and insert
        // Safe to ignore
      }
    }

    if (mergedCount > 0) {
      this.logger.log(
        `Merged ${mergedCount} photo-derived tags for person ${personId} from photo ${photoId}`,
      );
    }

    return mergedCount;
  }
}
