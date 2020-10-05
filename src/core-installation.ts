import { QuickPickBase } from './quick-pick-base';

export class CoreInstallation {
  public ID: string = "";
  public Installed: string = "";
  public Latest: string = "";
  public Name: string = "";
}
export class QuickPickCoreInstallation extends QuickPickBase {
  coreInstallation: CoreInstallation;
  constructor(c: CoreInstallation) {
    super();
    this.coreInstallation = c;
    this.label = c.Name;
    this.description = c.Installed;
  }
}