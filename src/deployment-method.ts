import { QuickPickBase } from './quick-pick-base';
import { BoardConnection } from './board-connection';
import { Programmer } from './programmer';
export class QuickPickDeploymentMethod extends QuickPickBase {
  public isProgrammer: boolean;
  constructor(public method: Programmer | BoardConnection) {
    super();
    if ("address" in method) {
      this.label = (method as BoardConnection).address;
      this.description = (method as BoardConnection).protocol_label;
      this.isProgrammer = false;
    } else {
      this.label = (method as Programmer).name;
      this.description = "";
      this.isProgrammer = true;
    }
  }

}