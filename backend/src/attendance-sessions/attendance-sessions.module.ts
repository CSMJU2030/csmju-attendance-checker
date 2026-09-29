import { Module } from '@nestjs/common';
import { ClassSectionsModule } from '../class-sections/class-sections.module';
import { AttendanceSessionsController } from './attendance-sessions.controller';
import { AttendanceSessionsService } from './attendance-sessions.service';

@Module({
  imports: [ClassSectionsModule],
  controllers: [AttendanceSessionsController],
  providers: [AttendanceSessionsService],
})
export class AttendanceSessionsModule {}
