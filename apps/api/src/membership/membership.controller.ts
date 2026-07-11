import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  CampaignInvitationSummary,
  MembershipSummary,
} from '@worldbinder/contracts';
import {
  inviteMemberSchema,
  updateMemberRoleSchema,
  type InviteMemberInput,
  type UpdateMemberRoleInput,
} from '@worldbinder/validation';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { extractClientIp, hashIp } from '../auth/network.util';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { EnvService } from '../config/env.service';
import {
  type CampaignMembership,
  CampaignMembershipGuard,
} from './guards/campaign-membership.guard';
import { RequireCampaignRole } from './guards/campaign-roles.decorator';
import { CampaignRolesGuard } from './guards/campaign-roles.guard';
import { CurrentMembership } from './guards/current-membership.decorator';
import { MembershipService } from './membership.service';

@UseGuards(JwtAuthGuard, CampaignMembershipGuard, CampaignRolesGuard)
@Controller('campaigns/:campaignId')
export class MembershipController {
  constructor(
    private readonly membership: MembershipService,
    private readonly env: EnvService,
  ) {}

  @Get('members')
  listMembers(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ): Promise<MembershipSummary[]> {
    return this.membership.listMembers(campaignId);
  }

  @RequireCampaignRole('owner', 'gm')
  @Patch('members/:memberId')
  updateMemberRole(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body(new ZodValidationPipe(updateMemberRoleSchema))
    body: UpdateMemberRoleInput,
    @CurrentMembership() actor: CampaignMembership,
  ): Promise<{ message: string }> {
    return this.membership
      .updateMemberRole(campaignId, actor, memberId, body)
      .then(() => ({ message: 'Role updated' }));
  }

  @RequireCampaignRole('owner', 'gm')
  @Delete('members/:memberId')
  @HttpCode(HttpStatus.OK)
  removeMember(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @CurrentMembership() actor: CampaignMembership,
  ): Promise<{ message: string }> {
    return this.membership
      .removeMember(campaignId, actor, memberId)
      .then(() => ({ message: 'Member removed' }));
  }

  @RequireCampaignRole('owner', 'gm')
  @Get('invitations')
  listInvitations(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ): Promise<CampaignInvitationSummary[]> {
    return this.membership.listInvitations(campaignId);
  }

  @RequireCampaignRole('owner', 'gm')
  @Post('invitations')
  @HttpCode(HttpStatus.OK)
  inviteMember(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body(new ZodValidationPipe(inviteMemberSchema)) body: InviteMemberInput,
    @CurrentMembership() actor: CampaignMembership,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const ipHash = hashIp(
      extractClientIp(req),
      this.env.values.JWT_ACCESS_SECRET,
    );
    return this.membership.inviteMember(campaignId, actor, body, ipHash);
  }

  @RequireCampaignRole('owner', 'gm')
  @Delete('invitations/:invitationId')
  @HttpCode(HttpStatus.OK)
  revokeInvitation(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
    @CurrentMembership() actor: CampaignMembership,
  ): Promise<{ message: string }> {
    return this.membership
      .revokeInvitation(campaignId, actor, invitationId)
      .then(() => ({ message: 'Invitation revoked' }));
  }
}
