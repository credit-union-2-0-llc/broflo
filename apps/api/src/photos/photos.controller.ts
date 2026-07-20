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

  // fieldNestingDepth: 0 — this endpoint's form only ever sends flat fields
  // (file + category), never bracket-nested ones (e.g. "a[b][c]"). Multer
  // 2.2.0 patched GHSA-72gw-mp4g-v24j (DoS via unbounded nested field-name
  // parsing) but only enforces it when a caller opts in via this limit.
  // Cast to `any`: @nestjs/platform-express@11.1.18's MulterOptions.limits
  // type hasn't been updated for this new multer 2.2.0 option yet, even
  // though the underlying multer package reads and enforces it at runtime.
  @Post()
  @UseInterceptors(
    FileInterceptor("file", { limits: { fieldNestingDepth: 0 } } as unknown as Parameters<typeof FileInterceptor>[1]),
  )
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

  @Post(":photoId/reanalyze")
  async reanalyzePhoto(
    @CurrentUser() user: User,
    @Param("personId") personId: string,
    @Param("photoId") photoId: string,
  ) {
    return this.photos.reanalyzePhoto(user.id, personId, photoId);
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
