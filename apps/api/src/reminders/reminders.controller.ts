import {
  Controller,
  Get,
  Patch,
  Param,
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { RemindersService } from "./reminders.service";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@Controller("reminders")
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Get()
  async list(@CurrentUser() user: User) {
    return this.reminders.listActive(user.id);
  }

  @Patch(":reminderId/dismiss")
  async dismiss(
    @CurrentUser() user: User,
    @Param("reminderId") reminderId: string,
  ) {
    return this.reminders.dismiss(user.id, reminderId);
  }
}
