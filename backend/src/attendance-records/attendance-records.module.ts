import { Module } from '@nestjs/common';
import { AttendanceRecordsController } from './attendance-records.controller';
import { AttendanceRecordsService } from './attendance-records.service';

@Module({
  controllers: [AttendanceRecordsController],
  providers: [AttendanceRecordsService],
})
export class AttendanceRecordsModule {}
