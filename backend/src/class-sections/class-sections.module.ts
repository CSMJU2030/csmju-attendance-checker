import { Module } from '@nestjs/common';
import { ClassSectionStudentsController } from './class-section-students.controller';
import { ClassSectionStudentsService } from './class-section-students.service';
import { ClassSectionsController } from './class-sections.controller';
import { ClassSectionsService } from './class-sections.service';

@Module({
  controllers: [ClassSectionsController, ClassSectionStudentsController],
  providers: [ClassSectionsService, ClassSectionStudentsService],
  exports: [ClassSectionsService],
})
export class ClassSectionsModule {}
