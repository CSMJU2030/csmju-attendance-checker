import { Module } from '@nestjs/common';
import { CourseCatalog } from './course-catalog.service';
import { PeopleService } from './people.service';
import { ReferenceDataEventsLogger } from './reference-data-events.logger';
import { ReferenceDataService } from './reference-data.service';

/**
 * ข้อมูลกลางจาก Core Hub — import module นี้ใน module ที่ต้องใช้
 * แล้ว inject ReferenceDataService (ข้อมูลอ้างอิง cache ได้) หรือ PeopleService
 * (ข้อมูลบุคคล ห้าม cache) · ต้องมี ConfigModule แบบ global อยู่แล้ว
 */
@Module({
  providers: [ReferenceDataEventsLogger, ReferenceDataService, PeopleService, CourseCatalog],
  exports: [ReferenceDataService, PeopleService, CourseCatalog],
})
export class CoreHubModule {}
