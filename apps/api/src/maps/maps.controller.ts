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
  UseGuards,
} from '@nestjs/common';
import type {
  MapDetail,
  MapLayerSummary,
  MapPinSummary,
  MapSummary,
} from '@worldbinder/contracts';
import {
  createMapLayerSchema,
  createMapPinSchema,
  createMapSchema,
  repositionMapPinSchema,
  updateMapLayerSchema,
  updateMapPinSchema,
  updateMapSchema,
  type CreateMapLayerInput,
  type CreateMapPinInput,
  type CreateMapInput,
  type RepositionMapPinInput,
  type UpdateMapLayerInput,
  type UpdateMapPinInput,
  type UpdateMapInput,
} from '@worldbinder/validation';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  type CampaignMembership,
  CampaignMembershipGuard,
} from '../membership/guards/campaign-membership.guard';
import { RequireCampaignRole } from '../membership/guards/campaign-roles.decorator';
import { CampaignRolesGuard } from '../membership/guards/campaign-roles.guard';
import { CurrentMembership } from '../membership/guards/current-membership.decorator';
import { MapsService } from './maps.service';

@UseGuards(JwtAuthGuard, CampaignMembershipGuard, CampaignRolesGuard)
@Controller('campaigns/:campaignId/maps')
export class MapsController {
  constructor(private readonly maps: MapsService) {}

  @Get()
  list(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<MapSummary[]> {
    return this.maps.list(campaignId, membership);
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body(new ZodValidationPipe(createMapSchema)) body: CreateMapInput,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<MapSummary> {
    return this.maps.create(campaignId, membership, body);
  }

  @Get(':mapId')
  getById(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('mapId', ParseUUIDPipe) mapId: string,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<MapDetail> {
    return this.maps.getById(campaignId, mapId, membership);
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Patch(':mapId')
  update(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('mapId', ParseUUIDPipe) mapId: string,
    @Body(new ZodValidationPipe(updateMapSchema)) body: UpdateMapInput,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<MapDetail> {
    return this.maps.update(campaignId, mapId, membership, body);
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Delete(':mapId')
  @HttpCode(HttpStatus.OK)
  delete(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('mapId', ParseUUIDPipe) mapId: string,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<{ message: string }> {
    return this.maps
      .delete(campaignId, mapId, membership)
      .then(() => ({ message: 'Map deleted' }));
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Post(':mapId/layers')
  @HttpCode(HttpStatus.CREATED)
  createLayer(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('mapId', ParseUUIDPipe) mapId: string,
    @Body(new ZodValidationPipe(createMapLayerSchema))
    body: CreateMapLayerInput,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<MapLayerSummary> {
    return this.maps.createLayer(campaignId, mapId, membership, body);
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Patch(':mapId/layers/:layerId')
  updateLayer(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('mapId', ParseUUIDPipe) mapId: string,
    @Param('layerId', ParseUUIDPipe) layerId: string,
    @Body(new ZodValidationPipe(updateMapLayerSchema))
    body: UpdateMapLayerInput,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<MapLayerSummary> {
    return this.maps.updateLayer(campaignId, mapId, layerId, membership, body);
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Delete(':mapId/layers/:layerId')
  @HttpCode(HttpStatus.OK)
  deleteLayer(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('mapId', ParseUUIDPipe) mapId: string,
    @Param('layerId', ParseUUIDPipe) layerId: string,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<{ message: string }> {
    return this.maps
      .deleteLayer(campaignId, mapId, layerId, membership)
      .then(() => ({ message: 'Map layer deleted' }));
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Post(':mapId/pins')
  @HttpCode(HttpStatus.CREATED)
  createPin(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('mapId', ParseUUIDPipe) mapId: string,
    @Body(new ZodValidationPipe(createMapPinSchema)) body: CreateMapPinInput,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<MapPinSummary> {
    return this.maps.createPin(campaignId, mapId, membership, body);
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Patch(':mapId/pins/:pinId')
  updatePin(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('mapId', ParseUUIDPipe) mapId: string,
    @Param('pinId', ParseUUIDPipe) pinId: string,
    @Body(new ZodValidationPipe(updateMapPinSchema)) body: UpdateMapPinInput,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<MapPinSummary> {
    return this.maps.updatePin(campaignId, mapId, pinId, membership, body);
  }

  /** Narrow drag/reposition endpoint — see MapsService.repositionPin's
   * doc comment for why this is separate from the general pin PATCH. */
  @RequireCampaignRole('owner', 'gm', 'editor')
  @Patch(':mapId/pins/:pinId/position')
  repositionPin(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('mapId', ParseUUIDPipe) mapId: string,
    @Param('pinId', ParseUUIDPipe) pinId: string,
    @Body(new ZodValidationPipe(repositionMapPinSchema))
    body: RepositionMapPinInput,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<MapPinSummary> {
    return this.maps.repositionPin(campaignId, mapId, pinId, membership, body);
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Delete(':mapId/pins/:pinId')
  @HttpCode(HttpStatus.OK)
  deletePin(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('mapId', ParseUUIDPipe) mapId: string,
    @Param('pinId', ParseUUIDPipe) pinId: string,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<{ message: string }> {
    return this.maps
      .deletePin(campaignId, mapId, pinId, membership)
      .then(() => ({ message: 'Map pin deleted' }));
  }
}
