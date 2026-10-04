import { Module } from '@nestjs/common';
import { CoreHubModule } from '../core-hub/core-hub.module';
import { DirectoryController } from './directory.controller';

@Module({
  imports: [CoreHubModule],
  controllers: [DirectoryController],
})
export class DirectoryModule {}
