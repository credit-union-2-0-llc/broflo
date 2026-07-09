import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../auth/decorators/public.decorator";
import { SurveyService } from "./survey.service";
import { SubmitSurveyDto } from "./dto/survey.dto";

// Unauthenticated by design — a recipient filling this out has no Broflo
// account. Security rests on the token itself (32 random bytes, effectively
// unguessable) plus these tight per-IP throttles as defense in depth against
// scripted abuse, not because the limit is doing the real work.
@Public()
@Controller("survey")
export class PublicSurveyController {
  constructor(private readonly survey: SurveyService) {}

  @Throttle({ short: { ttl: 60000, limit: 20 } })
  @Get(":token")
  async get(@Param("token") token: string) {
    return this.survey.getPublicSurvey(token);
  }

  @Throttle({ short: { ttl: 60000, limit: 5 } })
  @Post(":token/submit")
  async submit(@Param("token") token: string, @Body() dto: SubmitSurveyDto) {
    return this.survey.submitSurvey(token, dto);
  }
}
