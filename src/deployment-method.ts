import { QuickPickBase } from './quick-pick-base';
import { BoardConnection } from './board-connection';
import { Programmer } from './programmer';
export class QuickPickDeploymentMethod extends QuickPickBase {
  constructor(public method: Programmer | BoardConnection) {
    super();
    if ("address" in method) {
      this.label = (method as BoardConnection).address;
      this.description = (method as BoardConnection).protocol_label;
    } else {
      this.label = (method as Programmer).name;
      this.description = "";
    }
  }

}