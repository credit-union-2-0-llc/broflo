import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { GiftPoolService } from "./gift-pool.service";
import { CreatePoolDto, ContributeDto } from "./dto/gift-pool.dto";

@Controller("family/gift-pools")
export class GiftPoolController {
  constructor(private readonly giftPools: GiftPoolService) {}

  @Get()
  async list(@CurrentUser() user: User) {
    return this.giftPools.listPools(user);
  }

  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreatePoolDto) {
    return this.giftPools.createPool(user, dto);
  }

  @Post(":id/contributions")
  async contribute(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: ContributeDto,
  ) {
    return this.giftPools.addContribution(user, id, dto);
  }

  @Patch(":id/contributions/:contributionId")
  async updateContribution(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Param("contributionId") contributionId: string,
    @Body() dto: ContributeDto,
  ) {
    return this.giftPools.updateContribution(user, id, contributionId, dto);
  }

  @Delete(":id/contributions/:contributionId")
  async deleteContribution(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Param("contributionId") contributionId: string,
  ) {
    return this.giftPools.deleteContribution(user, id, contributionId);
  }
}
