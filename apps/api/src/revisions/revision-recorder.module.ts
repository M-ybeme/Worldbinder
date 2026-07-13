import { Module } from '@nestjs/common';
import { RevisionRecorderService } from './revision-recorder.service';

@Module({
  providers: [RevisionRecorderService],
  exports: [RevisionRecorderService],
})
export class RevisionRecorderModule {}
