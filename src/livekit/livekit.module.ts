import { Module } from '@nestjs/common';
import { TokenController } from './token.controller';
import { AgentBootstrap } from './agent.bootstrap';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TokenController],
  providers: [AgentBootstrap],
})
export class LiveKitModule {}
