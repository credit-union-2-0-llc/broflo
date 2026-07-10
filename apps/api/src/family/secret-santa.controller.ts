import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SecretSantaService } from "./secret-santa.service";
import { CreateExchangeDto, JoinExchangeDto } from "./dto/secret-santa.dto";

@Controller("family/secret-santa")
export class SecretSantaController {
  constructor(private readonly secretSanta: SecretSantaService) {}

  @Get()
  async list(@CurrentUser() user: User) {
    return this.secretSanta.listExchanges(user);
  }

  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateExchangeDto) {
    return this.secretSanta.createExchange(user, dto);
  }

  @Post(":id/join")
  async join(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: JoinExchangeDto,
  ) {
    return this.secretSanta.joinExchange(user, id, dto);
  }

  @Post(":id/assign")
  async assign(@CurrentUser() user: User, @Param("id") id: string) {
    return this.secretSanta.assign(user, id);
  }

  // Privacy-critical: only ever returns the caller's own assignment, never
  // a full mapping — not even to the organizer.
  @Get(":id/my-assignment")
  async myAssignment(@CurrentUser() user: User, @Param("id") id: string) {
    return this.secretSanta.getMyAssignment(user, id);
  }
}
