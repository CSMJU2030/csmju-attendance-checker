import { Module } from '@nestjs/common';
import { ClassSectionsModule } from '../class-sections/class-sections.module';
import { AttendanceStatsController } from './attendance-stats.controller';
import { AttendanceStatsService } from './attendance-stats.service';

@Module({
  imports: [ClassSectionsModule],
  controllers: [AttendanceStatsController],
  providers: [AttendanceStatsService],
})
export class AttendanceStatsModule {}
