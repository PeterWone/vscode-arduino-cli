import { QuickPickBase } from './quick-pick-base';

export class BoardConnection {
  public address = "";
  public protocol = "";
  public protocol_label = "";
}
export class QuickPickBoardConnection extends QuickPickBase {
  constructor(public boardConnection?: BoardConnection) {
    super();
    this.label = boardConnection?.address || "No monitor";
    this.description = boardConnection?.protocol_label || "";
  }
}