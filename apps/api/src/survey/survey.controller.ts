import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SurveyService } from "./survey.service";
import { SendSurveyDto, ReviewSurveyResponseDto } from "./dto/survey.dto";

@Controller("persons/:personId/survey")
export class SurveyController {
  constructor(private readonly survey: SurveyService) {}

  @Post()
  async send(
    @CurrentUser() user: User,
    @Param("personId") personId: string,
    @Body() dto: SendSurveyDto,
  ) {
    return this.survey.sendSurvey(user.id, personId, dto);
  }

  @Get("responses")
  async listResponses(@CurrentUser() user: User, @Param("personId") personId: string) {
    return this.survey.listResponses(user.id, personId);
  }

  @Post("responses/:responseId/review")
  async reviewResponse(
    @CurrentUser() user: User,
    @Param("personId") personId: string,
    @Param("responseId") responseId: string,
    @Body() dto: ReviewSurveyResponseDto,
  ) {
    return this.survey.reviewResponse(user.id, personId, responseId, dto);
  }
}
