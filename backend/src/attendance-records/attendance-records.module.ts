import { Module } from '@nestjs/common';
import { CoreHubModule } from '../core-hub/core-hub.module';
import { AttendanceRecordsController } from './attendance-records.controller';
import { AttendanceRecordsService } from './attendance-records.service';

@Module({
  imports: [CoreHubModule],
  controllers: [AttendanceRecordsController],
  providers: [AttendanceRecordsService],
})
export class AttendanceRecordsModule {}
