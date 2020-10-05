import { QuickPickDeploymentMethod } from './deployment-method';
import { BoardConnection } from './board-connection';
import { Programmer } from './programmer';
import { Directories } from './directories';
import * as vscode from 'vscode';
import * as child_process from "child_process";
import * as fs from "fs";
import * as nls from 'vscode-nls';
import { LibraryRelease, QuickPickLibrary, LibraryCatalogueEntry, LibraryCatalogue } from './library';
import { Core } from './core';
import { QuickPickBoard } from './board';
const localize = nls.config({ messageFormat: nls.MessageFormat.file })();
const oneMonthMs = 30.43733333 * 24 * 3600 * 1000;
const libraryCatalogueFilename = "library-catalogue.json";
const browserLaunchMap: any = { darwin: "open", linux: "xdg-open", win32: "start" };
let cliPath: string;
let directories: Directories;
let installedLibraries: LibraryRelease[];
let refreshIntervalLibraryCatalogueMonths: number;
var commandArgs: any;
let selectedBoardConnection: BoardConnection;
let selectedDeploymentMethod: QuickPickDeploymentMethod;
let selectedBoard: QuickPickBoard;
let statusBarItemSelectedBoard: vscode.StatusBarItem;
let availableBoards: QuickPickBoard[] = [];
let availableLibraries: QuickPickLibrary[] = [];
let availableDeploymentMethods: QuickPickDeploymentMethod[] = [];
let statusBarItemSelectedDeploymentMethod: vscode.StatusBarItem;
let outputChannel = vscode.window.createOutputChannel("Arduino CLI");
let byLabel = (a: any, b: any) => {
  let A = a.label.toUpperCase();
  let B = b.label.toUpperCase();
  return A < B ? -1 : A > B ? 1 : 0;
};
export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(checkConfigurationChange));
  let config = vscode.workspace.getConfiguration();
  let arduinoCliConfig = vscode.workspace.getConfiguration("arduinoCli");
  refreshIntervalLibraryCatalogueMonths = arduinoCliConfig.refreshIntervalLibraryCatalogueMonths;
  vscode.commands.executeCommand("setContext", "showCompileAndDeployButtonsOnToolbar", arduinoCliConfig.showCompileAndDeployButtonsOnToolbar);
  cliPath = arduinoCliConfig.path;
  loadQuickPickBoards();
  installedLibraries = cli("lib list");
  getLibraryCatalogue("lib search").then(cat => {
    availableLibraries = cat.libraries
      .map(library => {
        let qpl = new QuickPickLibrary(library);
        qpl.picked = !!installedLibraries.find(ilib => ilib.library.name === qpl.label);
        return qpl;
      })
      .sort(byLabel);
  });
  directories = cli("config dump").directories as Directories;

  selectedBoard = arduinoCliConfig.selectedBoard;
  statusBarItemSelectedBoard = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItemSelectedBoard.command = "extension.chooseBoard";
  context.subscriptions.push(statusBarItemSelectedBoard);
  statusBarItemSelectedBoard.text = selectedBoard?.label || "Choose a board";
  statusBarItemSelectedBoard.tooltip = "Board";
  statusBarItemSelectedBoard.show();

  getDeploymentMethodsForSelectedBoard();
  selectedDeploymentMethod = arduinoCliConfig.selectedDeploymentMethod;
  statusBarItemSelectedDeploymentMethod = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItemSelectedDeploymentMethod.command = "extension.chooseDeploymentMethod";
  context.subscriptions.push(statusBarItemSelectedDeploymentMethod);
  statusBarItemSelectedDeploymentMethod.text = selectedDeploymentMethod?.label || "Choose deployment method";
  statusBarItemSelectedDeploymentMethod.tooltip = "Deployment method";
  statusBarItemSelectedDeploymentMethod.show();

  let disposable = vscode.commands.registerCommand('extension.chooseBoard', async (cmdArgs: any) => {
    commandArgs = cmdArgs;
    vscode.window.showQuickPick(availableBoards, { matchOnDescription: true, matchOnDetail: true, placeHolder: "Find your board by make, model or chipset" })
      .then(async x => {
        if (x && x !== selectedBoard) {
          selectedBoard = x;
          if (!selectedBoard.board.fqbn) {
            installCore(selectedBoard.core.ID);
            loadQuickPickBoards();
            if (!fixSelectedBoard()) {
              statusBarItemSelectedBoard.text = "Choose board";
              availableDeploymentMethods.length = 0;
              vscode.window.showWarningMessage("Due to inconsistencies between board names reported by Arduino-CLI before and after core installation, some boards must be manually re-selected after core installation. This has just happened to you.", { modal: true }, "More info").then(button => {
                if (button) {
                  child_process.exec(`${browserLaunchMap[process.platform]} https://github.com/arduino/arduino-cli/issues/997`);
                }
              });
            }
          }
          if (selectedBoard.board.fqbn) {
            await config.update("arduinoCli.selectedBoard", selectedBoard, vscode.ConfigurationTarget.Workspace);
            statusBarItemSelectedBoard.text = selectedBoard.board.name;
            getDeploymentMethodsForSelectedBoard();
            statusBarItemSelectedDeploymentMethod.show();
            vscode.commands.executeCommand('extension.chooseDeploymentMethod');
          } else {
            statusBarItemSelectedBoard.text = "Choose board";
            vscode.commands.executeCommand('extension.chooseBoard');
          }
        }
      });
  });
  context.subscriptions.push(disposable);
  disposable = vscode.commands.registerCommand('extension.chooseDeploymentMethod', async (cmdArgs: any) => {
    commandArgs = cmdArgs;
    vscode.window.showQuickPick(availableDeploymentMethods)
      .then(async x => {
        if (x) {
          selectedDeploymentMethod = x;
          await config.update("arduinoCli.selectedDeploymentMethod", selectedDeploymentMethod, vscode.ConfigurationTarget.Workspace);
          statusBarItemSelectedDeploymentMethod.text = x.label;
        }
      });
  });
  context.subscriptions.push(disposable);
  disposable = vscode.commands.registerCommand('extension.chooseLibraries', async (cmdArgs: any) => {
    vscode.window.showQuickPick(availableLibraries, {
      canPickMany: true,
      matchOnDescription: true,
      matchOnDetail: true,
      placeHolder: "Find your board by make, model or chipset"
    })
      .then(selectedLibraries => {
        selectedLibraries!.forEach(lib => {
          lib.picked = true;
          if (!installedLibraries.find(ilib => ilib.library.name === lib.label)) {
            installLibrary(lib.label, true);
          }
        });
      });
  });
  context.subscriptions.push(disposable);
  disposable = vscode.commands.registerCommand('extension.compile', async (cmdArgs: any) => {
    commandArgs = cmdArgs;
    clit(`compile --fqbn ${selectedBoard.board.fqbn}`);
  });
  context.subscriptions.push(disposable);
  disposable = vscode.commands.registerCommand('extension.deploy', async (cmdArgs: any) => {
    commandArgs = cmdArgs;
    clit(`compile --fqbn ${selectedBoard.board.fqbn}`);
    clit(`upload --fqbn ${selectedBoard.board.fqbn} --port ${selectedBoardConnection.address}`);
  });
  context.subscriptions.push(disposable);
  disposable = vscode.commands.registerCommand('extension.parseRate', async (cmdArgs: any) => {
    let sr = parseRate();
  });
  context.subscriptions.push(disposable);
}
function parseRate(): number | undefined {
  let src = vscode.window.activeTextEditor?.document?.getText();
  if (src) {
    let matches = /Serial.begin\((\d+)\);/.exec(src);
    if (matches?.length) {
      let rate = parseInt(matches[1]);
      return rate;
    }
  }
}

function getDeploymentMethodsForSelectedBoard() {
  // get the programmers for that board
  let progs = cli(`board details --fqbn ${selectedBoard.board.fqbn} --list-programmers`).programmers as Programmer[];
  if (progs) {
    availableDeploymentMethods = progs.map(p => new QuickPickDeploymentMethod(p)).sort(byLabel);
  }
  // and any detected USB serial connections
  let boardConnections = cli("board list") as BoardConnection[];
  let bcons = boardConnections.map(bc => new QuickPickDeploymentMethod(bc));
  availableDeploymentMethods.splice(0, 0, ...bcons);
}
function checkConfigurationChange(e: vscode.ConfigurationChangeEvent) {
  if (e.affectsConfiguration("arduinoCli.showCompileAndDeployButtonsOnToolbar")) {
    vscode.commands.executeCommand(
      "setContext", "showCompileAndDeployButtonsOnToolbar",
      vscode.workspace.getConfiguration("arduinoCli", null)
        .get("showCompileAndDeployButtonsOnToolbar"));
  }
}
function loadQuickPickBoards() {
  availableBoards.length = 0;
  let coresearch = cli("core search") as Core[];
  coresearch.forEach(c => c.Boards.forEach(b => availableBoards.push(new QuickPickBoard(b, c))));
  availableBoards.sort(byLabel);
}
function fixSelectedBoard(): boolean {
  let found = availableBoards.find(b => b.board.name === selectedBoard.board.name);
  if (found) {
    selectedBoard = found;
    return true;
  } else {
    return false;
  }
}
export function flashBootloader() {
  outputChannel.appendLine(`Flashing bootloader using ${selectedDeploymentMethod.label}`);
  cli(`burn-bootloader --fqbn ${selectedBoard.board.fqbn} --programmer ${selectedDeploymentMethod.label}`);
}
export function installCore(coreName: string, install = true) {
  clit(`core ${install ? "install" : "uninstall"} ${coreName}`);
  vscode.window.showInformationMessage(`"${coreName}" resources and toolchain are installed and ready.`);
}
export function installLibrary(libName: string, install = true) {
  clit(`lib ${install ? "install" : "uninstall"} ${libName}`);
  vscode.window.showInformationMessage(`Library "${libName}" installed and ready. Compiler paths have been updated but you must add a pragma to your code: #include <${libName}.h>`);
}
function clit(command: string) {
  let fqc = `"${cliPath}" ${command}`;
  console.log(fqc);
  outputChannel.appendLine(fqc);
  return child_process.execSync(fqc, { encoding: 'utf8' });
}
function cli(command: string) {
  let fqc = `"${cliPath}" ${command} --format json`;
  console.log(fqc);
  outputChannel.appendLine(fqc);
  return JSON.parse(child_process.execSync(fqc, { encoding: 'utf8' }));
}
function getLibraryCatalogue(command: string): Promise<LibraryCatalogue> {
  return new Promise<LibraryCatalogue>((resolve, reject) => {
    let result: any;
    try {
      if (fs.existsSync(libraryCatalogueFilename)) {
        let stats = fs.statSync(libraryCatalogueFilename);
        if (Date.now() - stats.ctimeMs > refreshIntervalLibraryCatalogueMonths * oneMonthMs) {
          vscode.window.showInformationMessage("Updating library catalogue");
          outputChannel.appendLine("Updating library catalogue");
          fs.unlinkSync(libraryCatalogueFilename);
          child_process.execSync(`"${cliPath}" ${command} --format json > ${libraryCatalogueFilename}`, { encoding: 'utf8' });
          vscode.window.showInformationMessage("Library catalogue fetched and ready");
        }
      } else {
        child_process.execSync(`"${cliPath}" ${command} --format json > ${libraryCatalogueFilename}`, { encoding: 'utf8' });
        vscode.window.showInformationMessage("Library catalogue refreshed and ready");
      }
      let raw = fs.readFileSync(libraryCatalogueFilename).toString();
      let result = JSON.parse(raw);
      resolve(result);
    }
    catch (err) {
      reject(err);
    }
  });
}
export function deactivate() { }