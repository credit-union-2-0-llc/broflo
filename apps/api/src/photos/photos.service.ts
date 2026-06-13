import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PhotoAnalysisProcessor } from './photo-analysis.processor';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

@Injectable()
export class PhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly processor: PhotoAnalysisProcessor,
  ) {}

  async upload(
    userId: string,
    personId: string,
    file: Express.Multer.File,
    tag: string,
  ) {
    // Verify person belongs to user
    const person = await this.prisma.person.findFirst({
      where: { id: personId, userId },
    });

    if (!person) {
      throw new NotFoundException('Person not found');
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed`,
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('File exceeds maximum size of 10MB');
    }

    const storagePath = `photos/${userId}/${personId}/${Date.now()}-${file.originalname}`;

    const { url } = await this.storage.upload(file.buffer, storagePath, file.mimetype, tag);

    await this.processor.enqueue({
      userId,
      personId,
      photoUrl: url,
      storagePath,
      tag,
    });

    const photo = await this.prisma.photo.create({
      data: {
        userId,
        personId,
        url,
        storagePath,
        tag: tag || null,
        analysisStatus: 'pending',
      },
    });

    return photo;
  }

  async list(userId: string, personId: string) {
    const person = await this.prisma.person.findFirst({
      where: { id: personId, userId },
    });

    if (!person) {
      throw new NotFoundException('Person not found');
    }

    return this.prisma.photo.findMany({
      where: { personId, userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async delete(userId: string, personId: string, photoId: string) {
    const photo = await this.prisma.photo.findFirst({
      where: { id: photoId, personId, userId },
    });

    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    if (photo.storagePath) {
      await this.storage.delete(photo.storagePath);
    }

    await this.prisma.photo.delete({ where: { id: photoId } });

    return { success: true };
  }

  async getSignedUrl(userId: string, personId: string, photoId: string) {
    const photo = await this.prisma.photo.findFirst({
      where: { id: photoId, personId, userId },
    });

    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    if (!photo.storagePath) {
      throw new BadRequestException('Photo has no storage path');
    }

    const signedUrl = await this.storage.getSignedUrl(photo.storagePath);

    return { url: signedUrl };
  }
}