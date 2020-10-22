import { SerialMonitor } from './serial-monitor';
import { QuickPickDeploymentMethod } from './deployment-method';
import { BoardConnection, QuickPickBoardConnection } from './board-connection';
import { Programmer } from './programmer';
import { Directories } from './directories';
import * as vscode from 'vscode';
import * as child_process from "child_process";
import * as fs from "fs";
import * as path from "path";
// import * as nls from 'vscode-nls';
import * as i18n from "vscode-nls-i18n";
import { LibraryRelease, QuickPickLibrary, LibraryCatalogue } from './library';
import { Core } from './core';
import { QuickPickBoard } from './board';
import * as kill from 'tree-kill';
// const localize = nls.config({ messageFormat: nls.MessageFormat.file })();
const oneMonthMs = 30.43733333 * 24 * 3600 * 1000;
const libraryCatalogueFilename = "library-catalogue.json";
const browserLaunchMap: any = { darwin: "open", linux: "xdg-open", win32: "start" };
let cliPath: string;
let directories: Directories;
let installedLibraries: LibraryRelease[];
let refreshIntervalLibraryCatalogueMonths: number;
var commandArgs: any;
let selectedDeploymentMethod: QuickPickDeploymentMethod;
let selectedBoard: QuickPickBoard;
let statusBarItemSelectedBoard: vscode.StatusBarItem;
let statusBarItemMonitorBoardConnection: vscode.StatusBarItem;
let selectedMonitorBoardConnection: QuickPickBoardConnection;
let availableBoardConnections: QuickPickBoardConnection[] = [];
let availableBoards: QuickPickBoard[] = [];
let availableLibraries: QuickPickLibrary[] = [];
let availableDeploymentMethods: QuickPickDeploymentMethod[] = [];
let statusBarItemSelectedDeploymentMethod: vscode.StatusBarItem;
let outputChannel = vscode.window.createOutputChannel("Arduino CLI");
let serialChannel = vscode.window.createOutputChannel("Serial monitor");
let serialMonitor: SerialMonitor;
let arduinoCliConfig: vscode.WorkspaceConfiguration;
// someArray.sort(byLabel)
let byLabel = (a: any, b: any) => {
  let A = a.label.toUpperCase();
  let B = b.label.toUpperCase();
  return A < B ? -1 : A > B ? 1 : 0;
};
export function activate(context: vscode.ExtensionContext) {
  i18n.init(context.extensionPath);
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(checkConfigurationChange));
  arduinoCliConfig = vscode.workspace.getConfiguration("arduinoCli");
  if (arduinoCliConfig.warnAboutDetectionLag && arduinoCliConfig.alwaysDetectBoardConnections) {
    let msg = i18n.localize("warning.detectionLag.message");
    let stopTellingMe = i18n.localize("warning.detectionLag.stopTellingMe");
    let close = i18n.localize("warning.detectionLag.close");
    vscode.window.showWarningMessage(msg, stopTellingMe, close)
      .then(async button => {
        if (button === stopTellingMe) {
          await arduinoCliConfig.update("warnAboutDetectionLag", false, vscode.ConfigurationTarget.Workspace);
        }
      });
  }
  cliPath = arduinoCliConfig.path;
  cli("board list").then((x: BoardConnection[]) =>
    availableBoardConnections = x.map(bc => new QuickPickBoardConnection(bc))
  );
  refreshIntervalLibraryCatalogueMonths = arduinoCliConfig.refreshIntervalLibraryCatalogueMonths;
  vscode.commands.executeCommand("setContext", "showCompileAndDeployButtonsOnToolbar", arduinoCliConfig.showCompileAndDeployButtonsOnToolbar);
  loadQuickPickBoards();
  cli("lib list").then(x => {
    installedLibraries = x;
    getLibraryCatalogue("lib search").then(cat => {
      availableLibraries = cat.libraries
        .map(library => {
          let qpl = new QuickPickLibrary(library);
          qpl.picked = !!installedLibraries.find(ilib => ilib.library.name === qpl.label);
          return qpl;
        })
        .sort(byLabel);
    });
  });
  cli("config dump").then(x => directories = x.directories);

  selectedBoard = arduinoCliConfig.selectedBoard;
  statusBarItemSelectedBoard = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItemSelectedBoard.command = "extension.chooseBoard";
  context.subscriptions.push(statusBarItemSelectedBoard);

  statusBarItemSelectedBoard.text = selectedBoard?.label || "Choose a board";
  statusBarItemSelectedBoard.tooltip = "Board";
  statusBarItemSelectedBoard.show();

  selectedMonitorBoardConnection = arduinoCliConfig.selectedMonitorBoardConnection;
  serialMonitor = new SerialMonitor(serialChannel);
  serialMonitor.serialPortName = selectedMonitorBoardConnection.boardConnection?.address || "No monitor";
  statusBarItemMonitorBoardConnection = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItemMonitorBoardConnection.text = `M:${selectedMonitorBoardConnection?.label}` || "No monitor";
  statusBarItemMonitorBoardConnection.tooltip = "Serial Monitor";
  statusBarItemMonitorBoardConnection.command = "extension.chooseMonitorBoardConnection";
  context.subscriptions.push(statusBarItemMonitorBoardConnection);
  statusBarItemMonitorBoardConnection.show();
  serialMonitor.start(getSerialMonitorBaudrateFromSourceCode());

  statusBarItemSelectedDeploymentMethod = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItemSelectedDeploymentMethod.tooltip = "Deployment method";
  statusBarItemSelectedDeploymentMethod.command = "extension.chooseDeploymentMethod";
  context.subscriptions.push(statusBarItemSelectedDeploymentMethod);
  if (selectedBoard?.board?.fqbn) {
    getDeploymentMethodsForSelectedBoard();
    selectedDeploymentMethod = arduinoCliConfig.selectedDeploymentMethod as QuickPickDeploymentMethod;
    vscode.commands.executeCommand("setContext", "showFlashButtonOnToolbar", selectedDeploymentMethod.isProgrammer);
    statusBarItemSelectedDeploymentMethod.text = `D:${selectedDeploymentMethod?.label || "NOT SET"}`;
    statusBarItemSelectedDeploymentMethod.show();
  }

  let disposable = vscode.commands.registerCommand('extension.chooseBoard', async (cmdArgs: any) => {
    commandArgs = cmdArgs;
    vscode.window.showQuickPick(availableBoards, { matchOnDescription: true, matchOnDetail: true, placeHolder: "Find your board by make, model or chipset" })
      // this is a nifty way to use await without making the outer method async
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
                  // browserLaunchMap is an array of the commands for the different platforms, indexed by platform
                  child_process.exec(`${browserLaunchMap[process.platform]} https://github.com/arduino/arduino-cli/issues/997`);
                }
              });
            }
          }
          if (selectedBoard.board.fqbn) {
            // config updates can fail if you don't wait for them
            await arduinoCliConfig.update("selectedBoard", selectedBoard, vscode.ConfigurationTarget.Workspace);
            statusBarItemSelectedBoard.text = selectedBoard.board.name;
            statusBarItemSelectedDeploymentMethod.text = "D:NOT SET";
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
  disposable = vscode.commands.registerCommand('extension.chooseMonitorBoardConnection', async (cmdArgs: any) => {
    arduinoCliConfig = vscode.workspace.getConfiguration("arduinoCli");
    if (arduinoCliConfig.alwaysDetectBoardConnections) {
      availableBoardConnections = (await cli("board list") as BoardConnection[])
        .map(bc => new QuickPickBoardConnection(bc));
    }
    vscode.window.showQuickPick(availableBoardConnections)
      .then(async x => {
        if (x) {
          selectedMonitorBoardConnection = x;
          await arduinoCliConfig.update("selectedMonitorBoardConnection", selectedMonitorBoardConnection, vscode.ConfigurationTarget.Workspace);
          statusBarItemMonitorBoardConnection.text = `M:${selectedMonitorBoardConnection.label}`;
          serialMonitor.serialPortName = selectedMonitorBoardConnection.label;
          if (selectedMonitorBoardConnection.label === "No monitor") {
            serialMonitor.stop();
          } else {
            serialMonitor.start(getSerialMonitorBaudrateFromSourceCode());
            serialChannel.show(true);
          }
        }
      });
  });
  context.subscriptions.push(disposable);
  disposable = vscode.commands.registerCommand('extension.chooseDeploymentMethod', async (cmdArgs: any) => {
    commandArgs = cmdArgs;
    arduinoCliConfig = vscode.workspace.getConfiguration("arduinoCli");
    if (arduinoCliConfig.alwaysDetectBoardConnections) {
      getDeploymentMethodsForSelectedBoard();
    }
    vscode.window.showQuickPick(availableDeploymentMethods)
      .then(async x => {
        if (x) {
          selectedDeploymentMethod = x;
          vscode.commands.executeCommand("setContext", "showFlashButtonOnToolbar", selectedDeploymentMethod.isProgrammer);
          await arduinoCliConfig.update("selectedDeploymentMethod", selectedDeploymentMethod, vscode.ConfigurationTarget.Workspace);
          statusBarItemSelectedDeploymentMethod.text = `D:${x.label}`;
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
        // add selected libraries that are not installed
        selectedLibraries!.forEach(lib => {
          lib.picked = true;
          if (!installedLibraries.find(ilib => ilib.library.name === lib.label)) {
            installLibrary(lib.label, true);
          }
        });
        // remove installed libraries that are not selected
        installedLibraries.forEach(lib => {
          if (!selectedLibraries?.find(slib => slib.library.name === lib.library.name)) {
            installLibrary(lib.library.name, false);
          }
        });
      });
  });
  context.subscriptions.push(disposable);
  disposable = vscode.commands.registerCommand('extension.compile', async (cmdArgs: any) => {
    outputChannel.show(true);
    arduinoCliConfig = vscode.workspace.getConfiguration("arduinoCli");
    commandArgs = cmdArgs;
    let args = ["compile", "--fqbn", selectedBoard.board.fqbn];
    if (arduinoCliConfig.verboseCompile) {
      args.push("--verbose");
    }
    let cp = child_process.spawn(cliPath, args, { cwd: getInoPath() });
    cp.stdout.on("data", (data: any) => outputChannel.append(data.toString()));
    cp.stderr.on("data", (data: any) => outputChannel.append(data.toString()));
    cp.on("error", (err: any) => {
      outputChannel.append(err);
    });
  });
  context.subscriptions.push(disposable);
  disposable = vscode.commands.registerCommand('extension.deploy', async (cmdArgs: any) => {
    arduinoCliConfig = vscode.workspace.getConfiguration("arduinoCli");
    outputChannel.show(true);
    commandArgs = cmdArgs;
    let args = ["compile", "--fqbn", selectedBoard.board.fqbn];
    let cp = child_process.spawn(cliPath, args, { cwd: getInoPath() });
    cp.stdout.on("data", (data: any) => outputChannel.append(`${data}`));
    cp.stderr.on("data", (data: any) => outputChannel.append(`${data}`));
    cp.on("error", (err: any) => {
      outputChannel.append(err);
    });
    cp.on("exit", () => {
      let restartSerialMonitorAfterDeploy = false;
      if (!selectedDeploymentMethod.isProgrammer) {
        restartSerialMonitorAfterDeploy = selectedMonitorBoardConnection.label !== "No monitor";
        serialMonitor.stop();
      }
      args = ["upload", "--fqbn", selectedBoard.board.fqbn];
      if (arduinoCliConfig.verboseDeploy) {
        args.push("--verbose");
      }
      if (selectedDeploymentMethod.isProgrammer) {
        args.push("--programmer");
        args.push((selectedDeploymentMethod.method as Programmer).id);
      } else {
        args.push("--port");
        args.push((selectedDeploymentMethod.method as BoardConnection).address);
      }
      cp = child_process.spawn(cliPath, args, { cwd: getInoPath() });
      cp.stdout.on("data", (data: any) => outputChannel.append(`${data}`));
      cp.stderr.on("data", (data: any) => {
        if (!selectedDeploymentMethod.isProgrammer && data.toString().indexOf("not responding") > 0) {
          kill(cp.pid);
          outputChannel.appendLine("Deployment aborted");
          vscode.window.showWarningMessage(
            `Your ${selectedBoard.label} is not responding on ${selectedDeploymentMethod.label}. This could be a loose connector, the wrong port or a different version of your board that uses a different baudrate. Check the list of boards for a similar name with "old" in it. Check all connectors.\n\nTo update the bootloader, set up a hardware programmer. When you select it as the deployment method, "Flash" will appear beside "Compile" and "Deploy".`,
            "OK"
          );
        } else {
          outputChannel.append(`${data}`);
        }
      });
      cp.on("error", (err: any) => {
        outputChannel.append(err);
      });
      cp.on("exit", () => {
        if (restartSerialMonitorAfterDeploy) {
          serialMonitor.start();
        }
      });
    });
  });
  context.subscriptions.push(disposable);
  disposable = vscode.commands.registerCommand('extension.flash', async (cmdArgs: any) => {
    outputChannel.show(true);
    commandArgs = cmdArgs;
    let args = [
      "burn-bootloader",
      "--fqbn", selectedBoard.board.fqbn,
      "--programmer", (selectedDeploymentMethod.method as Programmer).id
    ];
    let cp = child_process.spawn(cliPath, args, { cwd: getInoPath() });
    cp.stdout.on("data", (data: any) => outputChannel.append(data.toString()));
    cp.stderr.on("data", (data: any) => outputChannel.append(data.toString()));
    cp.on("error", (err: any) => {
      outputChannel.append(err);
    });
  });
  context.subscriptions.push(disposable);
}
function getSerialMonitorBaudrateFromSourceCode(): number | undefined {
  let src = getInoDoc()?.getText();
  if (src) {
    let matches = /Serial.begin\((\d+)\);/.exec(src);
    if (matches?.length) {
      return parseInt(matches[1]);
    }
  }
}
function getDeploymentMethodsForSelectedBoard() {
  // get the programmers for that board
  let progs: Programmer[] = [];
  cli(`board details --fqbn ${selectedBoard.board.fqbn} --list-programmers`).then(x => {
    progs = x.programmers;
    if (progs) {
      availableDeploymentMethods = progs.map(p => new QuickPickDeploymentMethod(p)).sort(byLabel);
    }
    // and any detected USB serial connections
    let boardConnections: BoardConnection[];
    cli("board list").then(x => {
      boardConnections = x;
      let bcons = boardConnections.map(bc => new QuickPickDeploymentMethod(bc));
      availableDeploymentMethods.splice(0, 0, ...bcons);
    });
  });
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
  cli("core search").then((x: Core[]) => {
    x.forEach(c => c.Boards.forEach(b => availableBoards.push(new QuickPickBoard(b, c))));
    availableBoards.sort(byLabel);
  });

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
export function installCore(coreName: string, install = true) {
  let args = ["core", install ? "install" : "uninstall", coreName];
  let cp = child_process.spawn(cliPath, args, { cwd: getInoPath() });
  cp.stdout.on("data", (data: any) => outputChannel.append(`${data}`));
  cp.stderr.on("data", (data: any) => outputChannel.append(`${data}`));
  cp.on("error", (err: any) => {
    outputChannel.append(err);
  }).on("exit", () => {
    vscode.window.showInformationMessage(`"${coreName}" resources and toolchain are installed and ready.`);
  });
}
export function installLibrary(libName: string, install = true) {
  let args = ["lib", install ? "install" : "uninstall", libName];
  let cp = child_process.spawn(cliPath, args, { cwd: getInoPath() });
  cp.stdout.on("data", (data: any) => outputChannel.append(`${data}`));
  cp.stderr.on("data", (data: any) => outputChannel.append(`${data}`));
  cp.on("error", (err: any) => {
    outputChannel.append(err);
  }).on("exit", () => {
    vscode.window.showInformationMessage(`Library "${libName}" installed and ready. Compiler paths have been updated but you must add a pragma to your code: #include <${libName}.h>`);
  });
}
async function cli(command: string) {
  let fqc = `"${cliPath}" ${command} --format json`;
  return JSON.parse(child_process.execSync(fqc, { cwd: getInoPath(), encoding: 'utf8' }));
}
function getInoDoc() {
  return vscode.window.visibleTextEditors
    .find(e => e.document.fileName.toLowerCase().endsWith(".ino"))?.document;
}
function getInoPath() {
  let ed = getInoDoc();
  if (ed) {
    return path.dirname(ed.fileName);
  } else {
    let wf = vscode.workspace.workspaceFolders?.find(x => fs.existsSync(path.join(x.uri.fsPath, `${x.name}.ino`)));
    return wf!.uri.fsPath;
  }
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