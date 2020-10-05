import { QuickPickBase } from './quick-pick-base';

export class Programmer {
  public platform = "";
  public id = "";
  public name = "";
}

export class QuickPickProgrammer extends QuickPickBase {
  programmer: Programmer;
  constructor(p: Programmer) {
    super();
    this.programmer = p;
    this.label = p.name;
    this.description = p.platform;
  }
}