import { Global, Module } from '@nestjs/common';
import { BusinessConfig } from './business.config';
@Global()
@Module({ providers: [BusinessConfig], exports: [BusinessConfig] })
export class BusinessConfigModule {}
