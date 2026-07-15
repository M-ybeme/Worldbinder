import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type {
  CampaignImportSummary,
  PresignedImportUploadResponse,
} from '@worldbinder/contracts';
import {
  presignImportSchema,
  type PresignImportInput,
} from '@worldbinder/validation';
import { CurrentUser } from '../auth/guards/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/token.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ImportsService } from './imports.service';

// Not campaign-scoped (roadmap's literal `POST /imports` route) — importing
// creates a campaign, so there's no membership to gate on yet.
@UseGuards(JwtAuthGuard)
@Controller('imports')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Post('presign')
  presign(
    // Validation only (size cap) — ImportsService.presign() doesn't
    // persist the declared filename/size, see its own doc comment.
    @Body(new ZodValidationPipe(presignImportSchema))
    _body: PresignImportInput,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<PresignedImportUploadResponse> {
    return this.imports.presign(user.sub);
  }

  @Post(':importId/complete')
  complete(
    @Param('importId', ParseUUIDPipe) importId: string,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<CampaignImportSummary> {
    return this.imports.complete(importId, user.sub);
  }

  @Get(':importId')
  getById(
    @Param('importId', ParseUUIDPipe) importId: string,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<CampaignImportSummary> {
    return this.imports.getById(importId, user.sub);
  }

  @Post(':importId/confirm')
  @HttpCode(HttpStatus.OK)
  confirm(
    @Param('importId', ParseUUIDPipe) importId: string,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<CampaignImportSummary> {
    return this.imports.confirm(importId, user.sub);
  }
}
