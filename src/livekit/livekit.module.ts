import { Module } from "@nestjs/common";
import { TokenController } from "./token.controller";
import { AgentBootstrap } from "./agent.bootstrap";

@Module({
  controllers: [TokenController],
  providers: [AgentBootstrap],
})
export class LiveKitModule {}
