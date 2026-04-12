import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { PhotosService } from "./photos.service";
import { UploadPhotoDto } from "./dto/photos.dto";

@Controller("persons/:personId/photos")
export class PhotosController {
  constructor(private readonly photos: PhotosService) {}

  @Post()
  @UseInterceptors(FileInterceptor("file"))
  async uploadPhoto(
    @CurrentUser() user: User,
    @Param("personId") personId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadPhotoDto,
  ) {
    return this.photos.uploadPhoto(user, personId, file, dto.category);
  }

  @Get()
  async getPhotos(
    @CurrentUser() user: User,
    @Param("personId") personId: string,
  ) {
    return this.photos.getPhotos(user.id, personId);
  }

  @Get(":photoId/url")
  async getPhotoUrl(
    @CurrentUser() user: User,
    @Param("personId") personId: string,
    @Param("photoId") photoId: string,
  ) {
    return this.photos.getPhotoUrl(user.id, personId, photoId);
  }

  @Delete(":photoId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePhoto(
    @CurrentUser() user: User,
    @Param("personId") personId: string,
    @Param("photoId") photoId: string,
  ) {
    await this.photos.deletePhoto(user.id, personId, photoId);
  }
}
