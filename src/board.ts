import { OutputChannel } from 'vscode';
import { Core } from './core';
import { QuickPickBase } from './quick-pick-base';

export class Board {
  public fqbn: string = "";
  public name: string = "";
}
export class QuickPickBoard extends QuickPickBase {
  constructor(public board: Board, public core: Core) {
    super();
    this.label = board.name;
    this.description = `${board.fqbn ? "uses" : "will install"} ${core.ID} core`;
  }
}