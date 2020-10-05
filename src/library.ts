import { QuickPickBase } from './quick-pick-base';
export class LibraryCatalogue {
  public libraries!: LibraryCatalogueEntry[];
  public name!: string;
  public releases!: any[];
}
export class LibraryCatalogueEntry {
  public latest!: Library;
  public name!: string;
  public releases!: any[];
}
export class LibraryRelease {
  public library: Library = new Library();
  public release: any;
}
export class QuickPickLibrary extends QuickPickBase {
  constructor(public library: LibraryCatalogueEntry) {
    super();
    this.label = library.name;
    this.description = library.latest.sentence;
    // this.detail = library.latest.paragraph;
  }
}
export class Library {
  public name: string = "";
  public author: string = "";
  public maintainer: string = "";
  public sentence: string = "";
  public paragraph: string = "";
  public website: string = "";
  public category: string = "";
  public architectures: string[] = [];
  public install_dir: string = "";
  public source_dir: string = "";
  public real_name: string = "";
  public version: string = "";
  public license: string = "";
  public location: string = "";
  public examples: string[] = [];
  public provides_includes: string[] = [];
}

