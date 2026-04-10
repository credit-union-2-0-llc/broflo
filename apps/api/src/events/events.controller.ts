import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { EventsService } from "./events.service";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CreateEventDto, UpdateEventDto } from "./dto/events.dto";

@Controller()
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post("persons/:personId/events")
  async create(
    @CurrentUser() user: User,
    @Param("personId") personId: string,
    @Body() dto: CreateEventDto,
  ) {
    return this.events.create(user.id, personId, dto);
  }

  @Get("events/upcoming")
  async upcoming(
    @CurrentUser() user: User,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("days") days?: string,
  ) {
    const p = Math.max(1, parseInt(page || "1", 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit || "20", 10) || 20));
    const d = Math.min(365, Math.max(1, parseInt(days || "365", 10) || 365));
    return this.events.upcoming(user.id, p, l, d);
  }

  @Patch("persons/:personId/events/:eventId")
  async update(
    @CurrentUser() user: User,
    @Param("personId") personId: string,
    @Param("eventId") eventId: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.events.update(user.id, personId, eventId, dto);
  }

  @Delete("persons/:personId/events/:eventId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: User,
    @Param("personId") personId: string,
    @Param("eventId") eventId: string,
  ) {
    await this.events.remove(user.id, personId, eventId);
  }
}
