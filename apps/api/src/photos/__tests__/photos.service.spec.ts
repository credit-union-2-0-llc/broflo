import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PhotosService } from '../photos.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { PhotoAnalysisProcessor } from '../photo-analysis.processor';

describe('PhotosService', () => {
  let service: PhotosService;
  let prisma: {
    person: { findFirst: jest.Mock };
    photo: { create: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock; delete: jest.Mock };
  };
  let storage: { upload: jest.Mock; delete: jest.Mock; getSignedUrl: jest.Mock };
  let processor: { enqueue: jest.Mock };

  const userId = 'user-123';
  const personId = 'person-456';
  const photoId = 'photo-789';

  const makeFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File => ({
    fieldname: 'file',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('fake-image'),
    destination: '',
    filename: 'test.jpg',
    path: '',
    stream: null as any,
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      person: {
        findFirst: jest.fn(),
      },
      photo: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
    };

    storage = {
      upload: jest.fn().mockResolvedValue({ url: 'https://storage.example.com/photos/test.jpg', path: 'photos/test.jpg' }),
      delete: jest.fn().mockResolvedValue(undefined),
      getSignedUrl: jest.fn().mockResolvedValue('https://storage.example.com/photos/test.jpg?expires=9999'),
    };

    processor = {
      enqueue: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhotosService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
        { provide: PhotoAnalysisProcessor, useValue: processor },
      ],
    }).compile();

    service = module.get<PhotosService>(PhotosService);
  });

  describe('upload', () => {
    it('uploads a photo successfully', async () => {
      const file = makeFile();
      prisma.person.findFirst.mockResolvedValue({ id: personId, userId });
      prisma.photo.create.mockResolvedValue({
        id: photoId,
        userId,
        personId,
        url: 'https://storage.example.com/photos/test.jpg',
        storagePath: 'photos/test.jpg',
        tag: 'default-tag',
        analysisStatus: 'pending',
        createdAt: new Date(),
      });

      const result = await service.upload(userId, personId, file, 'default-tag');

      expect(result).toBeDefined();
      expect(result.id).toBe(photoId);
      expect(storage.upload).toHaveBeenCalled();
      expect(processor.enqueue).toHaveBeenCalled();
      expect(prisma.photo.create).toHaveBeenCalled();
    });

    it('uploads a photo with a custom tag', async () => {
      const file = makeFile();
      prisma.person.findFirst.mockResolvedValue({ id: personId, userId });
      prisma.photo.create.mockResolvedValue({
        id: photoId,
        userId,
        personId,
        url: 'https://storage.example.com/photos/test.jpg',
        storagePath: 'photos/test.jpg',
        tag: 'closet',
        analysisStatus: 'pending',
        createdAt: new Date(),
      });

      const result = await service.upload(userId, personId, file, 'closet');

      expect(result).toBeDefined();
      expect(storage.upload).toHaveBeenCalled();
    });

    it('uploads a photo with an empty tag', async () => {
      const file = makeFile();
      prisma.person.findFirst.mockResolvedValue({ id: personId, userId });
      prisma.photo.create.mockResolvedValue({
        id: photoId,
        userId,
        personId,
        url: 'https://storage.example.com/photos/test.jpg',
        storagePath: 'photos/test.jpg',
        tag: null,
        analysisStatus: 'pending',
        createdAt: new Date(),
      });

      const result = await service.upload(userId, personId, file, '');

      expect(result).toBeDefined();
      expect(storage.upload).toHaveBeenCalled();
    });

    it('throws NotFoundException when person does not exist', async () => {
      const file = makeFile();
      prisma.person.findFirst.mockResolvedValue(null);

      await expect(service.upload(userId, personId, file, 'default-tag')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when file type is not allowed', async () => {
      const file = makeFile({ mimetype: 'application/pdf' });
      prisma.person.findFirst.mockResolvedValue({ id: personId, userId });

      await expect(service.upload(userId, personId, file, 'default-tag')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when file exceeds size limit', async () => {
      const file = makeFile({ size: 20 * 1024 * 1024 }); // 20MB
      prisma.person.findFirst.mockResolvedValue({ id: personId, userId });

      await expect(service.upload(userId, personId, file, 'default-tag')).rejects.toThrow(BadRequestException);
    });
  });

  describe('list', () => {
    it('returns list of photos for a person', async () => {
      prisma.person.findFirst.mockResolvedValue({ id: personId, userId });
      prisma.photo.findMany.mockResolvedValue([
        {
          id: photoId,
          userId,
          personId,
          url: 'https://storage.example.com/photos/test.jpg',
          storagePath: 'photos/test.jpg',
          tag: null,
          analysisStatus: 'pending',
          createdAt: new Date(),
        },
      ]);

      const result = await service.list(userId, personId);

      expect(result).toHaveLength(1);
      expect(prisma.photo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { personId, userId } }),
      );
    });

    it('throws NotFoundException when person does not exist', async () => {
      prisma.person.findFirst.mockResolvedValue(null);

      await expect(service.list(userId, personId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes a photo successfully', async () => {
      prisma.photo.findFirst.mockResolvedValue({
        id: photoId,
        userId,
        personId,
        storagePath: 'photos/test.jpg',
      });
      prisma.photo.delete.mockResolvedValue({});

      await expect(service.delete(userId, photoId)).resolves.not.toThrow();

      expect(storage.delete).toHaveBeenCalledWith('photos/test.jpg');
      expect(prisma.photo.delete).toHaveBeenCalledWith({ where: { id: photoId } });
    });

    it('throws NotFoundException when photo does not exist', async () => {
      prisma.photo.findFirst.mockResolvedValue(null);

      await expect(service.delete(userId, photoId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSignedUrl', () => {
    it('returns a signed URL for a photo', async () => {
      prisma.photo.findFirst.mockResolvedValue({
        id: photoId,
        userId,
        personId,
        storagePath: 'photos/test.jpg',
      });

      const result = await service.getSignedUrl(userId, photoId);

      expect(result).toBe('https://storage.example.com/photos/test.jpg?expires=9999');
      expect(storage.getSignedUrl).toHaveBeenCalledWith('photos/test.jpg');
    });

    it('throws NotFoundException when photo does not exist', async () => {
      prisma.photo.findFirst.mockResolvedValue(null);

      await expect(service.getSignedUrl(userId, photoId)).rejects.toThrow(NotFoundException);
    });
  });
});