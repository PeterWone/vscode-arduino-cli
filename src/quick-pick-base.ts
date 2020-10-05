import * as vscode from 'vscode';
export class QuickPickBase implements vscode.QuickPickItem {
  label: string = "NOT SET";
  description: string = "NOT SET";
  detail?: string | undefined;
  picked?: boolean | undefined;
  alwaysShow?: boolean | undefined;
}