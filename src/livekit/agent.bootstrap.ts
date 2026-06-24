import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from "@nestjs/common";
import { ChildProcess, spawn } from "child_process";
import { resolve } from "path";

@Injectable()
export class AgentBootstrap
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(AgentBootstrap.name);
  private child?: ChildProcess;

  onApplicationBootstrap() {
    const workerPath = resolve(__dirname, "agent.worker.js");
    const child = spawn(process.execPath, [workerPath, "start"], {
      env: { ...process.env },
      stdio: "inherit",
    });
    this.child = child;
    child.on("error", (e) => this.logger.error("Agent worker failed to start", e));
    child.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        this.logger.error(`Agent worker exited with code ${code}`);
      }
    });
    this.logger.log("Agent worker process started");
  }

  // Ensure the spawned worker is torn down whenever Nest shuts down —
  // otherwise watch-mode reloads leave it holding port 8081 (EADDRINUSE).
  onApplicationShutdown() {
    if (this.child && !this.child.killed) {
      this.child.kill("SIGTERM");
      this.logger.log("Agent worker process terminated");
    }
  }
}
