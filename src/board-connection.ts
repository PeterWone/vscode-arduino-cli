import { QuickPickBase } from './quick-pick-base';

export class BoardConnection {
  public address = "";
  public protocol = "";
  public protocol_label = "";
}
export class QuickPickBoardConnection extends QuickPickBase {
  boardConnection: BoardConnection;
  constructor(b: BoardConnection) {
    super();
    this.boardConnection = b;
    this.label = b.address;
    this.description = b.protocol_label;
  }
}