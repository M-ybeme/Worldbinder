import { CampaignPolicyService } from './campaign-policy.service';

describe('CampaignPolicyService', () => {
  const policy = new CampaignPolicyService();

  describe('canManageTarget', () => {
    it('lets the owner manage anyone except another owner', () => {
      expect(policy.canManageTarget('owner', 'gm')).toBe(true);
      expect(policy.canManageTarget('owner', 'editor')).toBe(true);
      expect(policy.canManageTarget('owner', 'player')).toBe(true);
      expect(policy.canManageTarget('owner', 'viewer')).toBe(true);
      expect(policy.canManageTarget('owner', 'owner')).toBe(false);
    });

    it('lets a GM manage editors/players/viewers but not the owner or another GM', () => {
      expect(policy.canManageTarget('gm', 'editor')).toBe(true);
      expect(policy.canManageTarget('gm', 'player')).toBe(true);
      expect(policy.canManageTarget('gm', 'viewer')).toBe(true);
      expect(policy.canManageTarget('gm', 'gm')).toBe(false);
      expect(policy.canManageTarget('gm', 'owner')).toBe(false);
    });

    it('gives editors, players, and viewers no management rights', () => {
      for (const actorRole of ['editor', 'player', 'viewer'] as const) {
        for (const targetRole of [
          'owner',
          'gm',
          'editor',
          'player',
          'viewer',
        ] as const) {
          expect(policy.canManageTarget(actorRole, targetRole)).toBe(false);
        }
      }
    });
  });

  describe('canChangeRole', () => {
    it('never allows promoting anyone to owner', () => {
      expect(policy.canChangeRole('owner', 'editor', 'owner')).toBe(false);
    });

    it('defers to canManageTarget for the current role otherwise', () => {
      expect(policy.canChangeRole('gm', 'editor', 'player')).toBe(true);
      expect(policy.canChangeRole('gm', 'gm', 'player')).toBe(false);
    });
  });

  describe('canViewGmContent', () => {
    it('always allows owner and GM', () => {
      expect(policy.canViewGmContent('owner', false)).toBe(true);
      expect(policy.canViewGmContent('gm', false)).toBe(true);
    });

    it('follows the per-member flag for editors', () => {
      expect(policy.canViewGmContent('editor', true)).toBe(true);
      expect(policy.canViewGmContent('editor', false)).toBe(false);
    });

    it('never allows players or viewers', () => {
      expect(policy.canViewGmContent('player', true)).toBe(false);
      expect(policy.canViewGmContent('viewer', true)).toBe(false);
    });
  });

  it('restricts renaming and deleting to the owner only', () => {
    expect(policy.canRenameCampaign('owner')).toBe(true);
    expect(policy.canRenameCampaign('gm')).toBe(false);
    expect(policy.canDeleteCampaign('owner')).toBe(true);
    expect(policy.canDeleteCampaign('gm')).toBe(false);
  });

  it('allows owner and GM to manage settings and archive', () => {
    expect(policy.canManageSettings('gm')).toBe(true);
    expect(policy.canManageSettings('editor')).toBe(false);
    expect(policy.canArchiveCampaign('gm')).toBe(true);
    expect(policy.canArchiveCampaign('editor')).toBe(false);
  });

  it('allows owner, GM, and editor to edit entities but not player or viewer', () => {
    expect(policy.canEditEntities('owner')).toBe(true);
    expect(policy.canEditEntities('gm')).toBe(true);
    expect(policy.canEditEntities('editor')).toBe(true);
    expect(policy.canEditEntities('player')).toBe(false);
    expect(policy.canEditEntities('viewer')).toBe(false);
  });

  it('allows owner, GM, and editor to edit sessions but not player or viewer', () => {
    expect(policy.canEditSessions('owner')).toBe(true);
    expect(policy.canEditSessions('gm')).toBe(true);
    expect(policy.canEditSessions('editor')).toBe(true);
    expect(policy.canEditSessions('player')).toBe(false);
    expect(policy.canEditSessions('viewer')).toBe(false);
  });

  it('allows owner, GM, and editor to manage plot threads but not player or viewer', () => {
    expect(policy.canManagePlotThreads('owner')).toBe(true);
    expect(policy.canManagePlotThreads('gm')).toBe(true);
    expect(policy.canManagePlotThreads('editor')).toBe(true);
    expect(policy.canManagePlotThreads('player')).toBe(false);
    expect(policy.canManagePlotThreads('viewer')).toBe(false);
  });

  it('allows owner, GM, and editor to manage attachments but not player or viewer', () => {
    expect(policy.canManageAttachments('owner')).toBe(true);
    expect(policy.canManageAttachments('gm')).toBe(true);
    expect(policy.canManageAttachments('editor')).toBe(true);
    expect(policy.canManageAttachments('player')).toBe(false);
    expect(policy.canManageAttachments('viewer')).toBe(false);
  });

  it('allows owner, GM, and editor to manage maps but not player or viewer', () => {
    expect(policy.canManageMaps('owner')).toBe(true);
    expect(policy.canManageMaps('gm')).toBe(true);
    expect(policy.canManageMaps('editor')).toBe(true);
    expect(policy.canManageMaps('player')).toBe(false);
    expect(policy.canManageMaps('viewer')).toBe(false);
  });

  it('allows owner, GM, and editor to manage timeline events but not player or viewer', () => {
    expect(policy.canManageTimeline('owner')).toBe(true);
    expect(policy.canManageTimeline('gm')).toBe(true);
    expect(policy.canManageTimeline('editor')).toBe(true);
    expect(policy.canManageTimeline('player')).toBe(false);
    expect(policy.canManageTimeline('viewer')).toBe(false);
  });

  it('restricts revealing content to owner and GM, unlike session/entity editing', () => {
    expect(policy.canRevealContent('owner')).toBe(true);
    expect(policy.canRevealContent('gm')).toBe(true);
    expect(policy.canRevealContent('editor')).toBe(false);
    expect(policy.canRevealContent('player')).toBe(false);
    expect(policy.canRevealContent('viewer')).toBe(false);
  });

  describe('canViewVisibility', () => {
    it('lets everyone see public content regardless of role', () => {
      for (const role of [
        'owner',
        'gm',
        'editor',
        'player',
        'viewer',
      ] as const) {
        expect(policy.canViewVisibility('public', role, false)).toBe(true);
      }
    });

    it('gates gm_only content the same way as canViewGmContent', () => {
      expect(policy.canViewVisibility('gm_only', 'owner', false)).toBe(true);
      expect(policy.canViewVisibility('gm_only', 'gm', false)).toBe(true);
      expect(policy.canViewVisibility('gm_only', 'editor', true)).toBe(true);
      expect(policy.canViewVisibility('gm_only', 'editor', false)).toBe(false);
      expect(policy.canViewVisibility('gm_only', 'player', false)).toBe(false);
      expect(policy.canViewVisibility('gm_only', 'viewer', false)).toBe(false);
    });
  });
});
