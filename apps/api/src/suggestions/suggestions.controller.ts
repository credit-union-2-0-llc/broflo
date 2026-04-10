import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
} from "@nestjs/common";
import { SuggestionsService } from "./suggestions.service";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import {
  GenerateSuggestionsDto,
  SelectSuggestionDto,
  DismissSuggestionDto,
} from "./dto/suggestions.dto";

@Controller()
export class SuggestionsController {
  constructor(private readonly service: SuggestionsService) {}

  @Post("ai/suggestions")
  generate(
    @CurrentUser("id") userId: string,
    @Body() dto: GenerateSuggestionsDto,
  ) {
    return this.service.generate(userId, dto);
  }

  @Get("events/:eventId/suggestions")
  getEventSuggestions(
    @CurrentUser("id") userId: string,
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Query("requestIndex", new ParseIntPipe({ optional: true }))
    requestIndex?: number,
  ) {
    return this.service.getEventSuggestions(userId, eventId, requestIndex);
  }

  @Get("events/:eventId/suggestions/meta")
  getSuggestionMeta(
    @CurrentUser("id") userId: string,
    @Param("eventId", ParseUUIDPipe) eventId: string,
  ) {
    return this.service.getSuggestionMeta(userId, eventId);
  }

  @Post("events/:eventId/select-suggestion")
  selectSuggestion(
    @CurrentUser("id") userId: string,
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Body() dto: SelectSuggestionDto,
  ) {
    return this.service.selectSuggestion(userId, eventId, dto);
  }

  @Post("suggestions/:suggestionId/dismiss")
  dismissSuggestion(
    @CurrentUser("id") userId: string,
    @Param("suggestionId", ParseUUIDPipe) suggestionId: string,
    @Body() dto: DismissSuggestionDto,
  ) {
    return this.service.dismissSuggestion(userId, suggestionId, dto);
  }
}
