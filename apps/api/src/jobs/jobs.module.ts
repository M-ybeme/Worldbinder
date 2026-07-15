import { Module } from '@nestjs/common';
import { AttachmentQueueService } from './attachment-queue.service';
import { ExportQueueService } from './export-queue.service';
import { ImportQueueService } from './import-queue.service';

// Sibling of AttachmentsModule per the roadmap's own directory sketch
// (§7) — now also hosting Milestone 12's export/import queue plumbing,
// as anticipated.
@Module({
  providers: [AttachmentQueueService, ExportQueueService, ImportQueueService],
  exports: [AttachmentQueueService, ExportQueueService, ImportQueueService],
})
export class JobsModule {}
