// I have a nasty feeling this is specific to Windows
export class CppConfigurations {
  public configurations: CppConfiguration[] = [];
  public version: number = 4;
}

export class CppConfiguration {
  constructor(
    public name: string,
    public includePath: string[],
    public forcedInclude: string[],
    public intelliSenseMode: string,
    public cStandard: string,
    public compilerArgs: string[],
    public defines: string[],
    public browse: CppBrowse
  ) { }
}

export class CppBrowse {
  constructor(
    public path: string[],
    public limitSymbolsToIncludedHeaders: boolean = true,
    public databaseFilename: string = ""
  ) { }
}