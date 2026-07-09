import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { FamilyService } from "./family.service";
import { CreateFamilyGroupDto, InviteFamilyMemberDto } from "./dto/family.dto";

@Controller("family")
export class FamilyController {
  constructor(private readonly family: FamilyService) {}

  @Get()
  async getMyFamily(@CurrentUser() user: User) {
    return this.family.getMyFamily(user);
  }

  @Post("group")
  async createGroup(@CurrentUser() user: User, @Body() dto: CreateFamilyGroupDto) {
    return this.family.createGroup(user, dto);
  }

  @Post("invites")
  async inviteMember(@CurrentUser() user: User, @Body() dto: InviteFamilyMemberDto) {
    return this.family.inviteMember(user, dto);
  }

  // Unauthenticated preview so the join page can show context before the
  // invitee logs in — security rests on the token itself (32 random bytes)
  // plus this throttle, same defense-in-depth posture as the survey invite.
  @Public()
  @Throttle({ short: { ttl: 60000, limit: 20 } })
  @Get("invites/:token")
  async previewInvite(@Param("token") token: string) {
    return this.family.getInvitePreview(token);
  }

  @Post("invites/:token/accept")
  async acceptInvite(@CurrentUser() user: User, @Param("token") token: string) {
    return this.family.acceptInvite(user, token);
  }

  @Delete("members/:userId")
  async removeMember(@CurrentUser() user: User, @Param("userId") memberUserId: string) {
    return this.family.removeMember(user, memberUserId);
  }

  @Post("leave")
  async leave(@CurrentUser() user: User) {
    return this.family.leaveFamily(user);
  }
}
