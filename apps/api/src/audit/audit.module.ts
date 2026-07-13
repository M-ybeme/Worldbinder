import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';

// Unchanged by Milestone 8 — auth-only, imported by AuthModule. Campaign-
// scoped auditing lives in campaign-audit.module.ts instead (see that
// file's comment for why this needs to stay a separate module).
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
