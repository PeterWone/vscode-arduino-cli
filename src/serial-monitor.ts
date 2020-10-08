import { OutputChannel } from 'vscode';
import * as child_process from "child_process";
export class SerialMonitor {
  private _childProcess: any;
  public serialPortName: string = "NOT SET";
  constructor(public outputChannel: OutputChannel, public baudrate: number = 9600) { }
  get state(): string {
    return this._childProcess ? "monitoring" : "idle";
  }
  private buf: string = "";
  public start(rate?: number) {
    if (rate) {
      this.baudrate = rate;
    }
    if (this._childProcess) {
      this.stop();
    }
    if (this.serialPortName !== "No monitor") {
      this._childProcess = child_process.spawn("d:/serial-monitor/bin/debug/netcoreapp3.1/serial-monitor", [this.serialPortName, this.baudrate.toString()]);
      this._childProcess.stdout.on("data", (data: any) => {
        this.outputChannel.append(data.toString());
      });
      this._childProcess.on("error", (err: any) => {
        this.outputChannel.append(err);
      });
    }
  }
  public stop() {
    if (this._childProcess) {
      this._childProcess.kill();
    }
  }
}