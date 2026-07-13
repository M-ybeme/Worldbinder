import { Module } from '@nestjs/common';
import { AttachmentQueueService } from './attachment-queue.service';

// Sibling of AttachmentsModule per the roadmap's own directory sketch
// (§7) — anticipated to also host Milestone 12's export/import queue
// plumbing later, not attachment-specific by design.
@Module({
  providers: [AttachmentQueueService],
  exports: [AttachmentQueueService],
})
export class JobsModule {}
