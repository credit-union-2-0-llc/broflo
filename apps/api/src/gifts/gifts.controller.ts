import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
} from "@nestjs/common";
import { GiftsService } from "./gifts.service";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CreateGiftRecordDto, RecordFeedbackDto } from "./dto/gifts.dto";

@Controller()
export class GiftsController {
  constructor(private readonly service: GiftsService) {}

  @Get("persons/:personId/gifts")
  listGifts(
    @CurrentUser("id") userId: string,
    @CurrentUser("subscriptionTier") tier: string,
    @Param("personId", ParseUUIDPipe) personId: string,
    @Query("page", new ParseIntPipe({ optional: true })) page?: number,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
    @Query("year", new ParseIntPipe({ optional: true })) year?: number,
  ) {
    return this.service.listGifts(userId, personId, { page, limit, year }, tier || "free");
  }

  @Post("persons/:personId/gifts")
  createGift(
    @CurrentUser("id") userId: string,
    @Param("personId", ParseUUIDPipe) personId: string,
    @Body() dto: CreateGiftRecordDto,
  ) {
    return this.service.createGift(userId, personId, dto);
  }

  @Patch("gifts/:giftId/feedback")
  recordFeedback(
    @CurrentUser("id") userId: string,
    @Param("giftId", ParseUUIDPipe) giftId: string,
    @Body() dto: RecordFeedbackDto,
  ) {
    return this.service.recordFeedback(userId, giftId, dto);
  }

  @Get("gifts/recent")
  getRecentGifts(@CurrentUser("id") userId: string) {
    return this.service.getRecentGifts(userId);
  }
}
