import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { PersonsService } from "./persons.service";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type {
  CreatePersonDto,
  UpdatePersonDto,
  CreateNeverAgainDto,
} from "./dto/persons.dto";

@Controller("persons")
export class PersonsController {
  constructor(private readonly persons: PersonsService) {}

  @Get()
  async list(@CurrentUser() user: User) {
    return this.persons.list(user.id);
  }

  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreatePersonDto) {
    return this.persons.create(user.id, dto);
  }

  @Get(":id")
  async get(@CurrentUser() user: User, @Param("id") id: string) {
    return this.persons.get(user.id, id);
  }

  @Patch(":id")
  async update(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: UpdatePersonDto,
  ) {
    return this.persons.update(user.id, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: User, @Param("id") id: string) {
    await this.persons.softDelete(user.id, id);
  }

  @Post(":id/never-again")
  async addNeverAgain(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: CreateNeverAgainDto,
  ) {
    return this.persons.addNeverAgain(user.id, id, dto);
  }

  @Delete(":id/never-again/:itemId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeNeverAgain(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Param("itemId") itemId: string,
  ) {
    await this.persons.removeNeverAgain(user.id, id, itemId);
  }
}
