import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RequiresTier } from "../billing/decorators/requires-tier.decorator";
import { SubscriptionGuard } from "../billing/guards/subscription.guard";
import { EnrichmentService } from "./enrichment.service";
import { ParseWishlistDto, CreateManualTagDto } from "./dto/enrichment.dto";

@Controller("persons/:personId")
export class EnrichmentController {
  constructor(private readonly enrichment: EnrichmentService) {}

  // --- Wishlist (Pro+) ---

  @Post("parse-wishlist")
  @UseGuards(SubscriptionGuard)
  @RequiresTier("pro", "elite")
  async parseWishlist(
    @CurrentUser() user: User,
    @Param("personId") personId: string,
    @Body() dto: ParseWishlistDto,
  ) {
    return this.enrichment.parseWishlist(user.id, personId, dto.urls);
  }

  @Get("wishlist-items")
  async getWishlistItems(
    @CurrentUser() user: User,
    @Param("personId") personId: string,
  ) {
    return this.enrichment.getWishlistItems(user.id, personId);
  }

  @Delete("wishlist-items/:itemId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWishlistItem(
    @CurrentUser() user: User,
    @Param("personId") personId: string,
    @Param("itemId") itemId: string,
  ) {
    await this.enrichment.deleteWishlistItem(user.id, personId, itemId);
  }

  // --- Tags (Pro+) ---

  @Post("generate-tags")
  @UseGuards(SubscriptionGuard)
  @RequiresTier("pro", "elite")
  async generateTags(
    @CurrentUser() user: User,
    @Param("personId") personId: string,
  ) {
    return this.enrichment.generateTags(user.id, personId);
  }

  @Get("tags")
  async getTags(
    @CurrentUser() user: User,
    @Param("personId") personId: string,
  ) {
    return this.enrichment.getTags(user.id, personId);
  }

  @Post("tags")
  async addManualTag(
    @CurrentUser() user: User,
    @Param("personId") personId: string,
    @Body() dto: CreateManualTagDto,
  ) {
    return this.enrichment.addManualTag(user.id, personId, dto.tag);
  }

  @Delete("tags/:tagId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTag(
    @CurrentUser() user: User,
    @Param("personId") personId: string,
    @Param("tagId") tagId: string,
  ) {
    await this.enrichment.deleteTag(user.id, personId, tagId);
  }

  // --- Insights (Elite) ---

  @Post("generate-insight")
  @UseGuards(SubscriptionGuard)
  @RequiresTier("elite")
  async generateInsight(
    @CurrentUser() user: User,
    @Param("personId") personId: string,
  ) {
    return this.enrichment.generateInsight(user.id, personId);
  }

  @Get("insight")
  async getInsight(
    @CurrentUser() user: User,
    @Param("personId") personId: string,
  ) {
    return this.enrichment.getInsight(user.id, personId);
  }
}
