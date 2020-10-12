import { QuickPickBase } from './quick-pick-base';
import { BoardConnection } from './board-connection';
import { Programmer } from './programmer';
export class QuickPickDeploymentMethod extends QuickPickBase {
  public isProgrammer: boolean;
  get asProgrammer(): Programmer { return this.method as Programmer; }
  get asBoardConnection(): BoardConnection { return this.method as BoardConnection; }
  constructor(public method: any) {
    super();
    this.isProgrammer = "platform" in method;
    this.label = this.asBoardConnection.address || this.asProgrammer.name;
    this.description = this.asBoardConnection.protocol_label || this.asProgrammer.platform;
  }

}

export class Command {
  constructor(
    public label: string,
    public action: () => void,
    public description: string = ""
  ) { }
}