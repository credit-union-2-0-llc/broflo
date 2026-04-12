import { Controller, Get, Patch, Param, Body, Query, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('failure-reviews')
  async listFailureReviews(
    @Query('resolved') resolved?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const where = resolved === 'true'
      ? { resolvedAt: { not: null } }
      : resolved === 'false'
        ? { resolvedAt: null }
        : {};

    const [data, total] = await Promise.all([
      this.prisma.failureReview.findMany({
        where: where as never,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      this.prisma.failureReview.count({ where: where as never }),
    ]);

    return { data, meta: { page: pageNum, limit: limitNum, total } };
  }

  @Patch('failure-reviews/:id')
  async updateFailureReview(
    @Param('id') id: string,
    @Body() body: { isSystemic?: boolean; reviewNotes?: string; resolved?: boolean },
  ) {
    return this.prisma.failureReview.update({
      where: { id },
      data: {
        isSystemic: body.isSystemic,
        reviewNotes: body.reviewNotes,
        resolvedAt: body.resolved ? new Date() : undefined,
      },
    });
  }

  @Get('retailers')
  async listRetailers() {
    return this.prisma.retailerProfile.findMany({
      orderBy: { retailerDomain: 'asc' },
    });
  }

  @Patch('retailers/:domain')
  async updateRetailer(
    @Param('domain') domain: string,
    @Body() body: { supported?: boolean; notes?: string },
  ) {
    const profile = await this.prisma.retailerProfile.findFirst({
      where: { retailerDomain: domain },
    });
    if (!profile) throw new NotFoundException(`Retailer ${domain} not found`);

    return this.prisma.retailerProfile.update({
      where: { id: profile.id },
      data: {
        supported: body.supported,
        blockedSince: body.supported === true ? null : undefined,
        notes: body.notes,
      },
    });
  }
}
