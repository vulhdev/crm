import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CustomersController } from './customers.controller.js';
import { SheetsService } from './sheets.service.js';
import { DriveService } from './drive.service.js';

@Module({
  imports: [AuthModule],
  controllers: [CustomersController],
  providers: [SheetsService, DriveService],
})
export class CustomersModule {}
