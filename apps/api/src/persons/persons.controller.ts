import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PersonsService } from './persons.service';
import { CreatePersonDto, UpdatePersonDto } from './dto/persons.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApplicableFrameworks } from '../compliance/applicable-frameworks.decorator';

@UseGuards(JwtAuthGuard)
@Controller('persons')
export class PersonsController {
  constructor(private readonly personsService: PersonsService) {}

  @Get()
  async findAll(@CurrentUser() user: { id: string }) {
    return this.personsService.findAll(user.id);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.personsService.findOne(user.id, id);
  }

  @ApplicableFrameworks(['GDPR', 'CCPA', 'GLBA'])
  @Post()
  async create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreatePersonDto,
  ) {
    return this.personsService.create(user.id, dto);
  }

  @ApplicableFrameworks(['GDPR', 'CCPA', 'GLBA'])
  @Patch(':id')
  async update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdatePersonDto,
  ) {
    return this.personsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.personsService.remove(user.id, id);
  }
}