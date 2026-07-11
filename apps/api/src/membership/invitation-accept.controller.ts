import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { InvitationPreview } from '@worldbinder/contracts';
import { CurrentUser } from '../auth/guards/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/token.service';
import { MembershipService } from './membership.service';

@Controller('invitations')
export class InvitationAcceptController {
  constructor(private readonly membership: MembershipService) {}

  @Get(':token')
  previewInvitation(@Param('token') token: string): Promise<InvitationPreview> {
    return this.membership.previewInvitation(token);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':token/accept')
  @HttpCode(HttpStatus.OK)
  acceptInvitation(
    @Param('token') token: string,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<{ campaignId: string }> {
    return this.membership.acceptInvitation(token, {
      id: user.sub,
      email: user.email,
    });
  }
}
