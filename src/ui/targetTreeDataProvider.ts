import * as path from 'path';
import * as vscode from 'vscode';
import { TargetInfo } from '../models';
import { normalizePath, relativeDisplayPath } from '../utils';

export class TargetTreeItem extends vscode.TreeItem {
  public constructor(public readonly target: TargetInfo) {
    super(target.displayName, vscode.TreeItemCollapsibleState.Collapsed);
    this.description = path.basename(target.guessedExecutablePath);
    this.tooltip = `${target.displayName}\n${target.guessedExecutablePath}`;
    this.contextValue = 'target';
    this.iconPath = new vscode.ThemeIcon('package');
  }
}

export class SourceTreeItem extends vscode.TreeItem {
  public constructor(
    public readonly sourcePath: string,
    public readonly targetId: string,
    private readonly sourceDir: string,
    isActive: boolean,
  ) {
    super(relativeDisplayPath(sourcePath, sourceDir), vscode.TreeItemCollapsibleState.None);
    this.description = isActive ? 'Current' : undefined;
    this.tooltip = sourcePath;
    this.contextValue = 'source';
    this.iconPath = new vscode.ThemeIcon(isActive ? 'circle-filled' : 'file-code');
    this.command = {
      command: 'vscode.open',
      title: 'Open Source File',
      arguments: [vscode.Uri.file(sourcePath)],
    };
  }
}

type Node = TargetTreeItem | SourceTreeItem;

export class TargetTreeDataProvider implements vscode.TreeDataProvider<Node> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<Node | undefined | void>();
  private targets: TargetInfo[] = [];
  private sourceDir = '';
  private activeSourcePath?: string;
  private targetItems = new Map<string, TargetTreeItem>();
  private sourceItems = new Map<string, SourceTreeItem>();

  public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  public setTargets(targets: TargetInfo[], sourceDir: string, activeSourcePath?: string): void {
    this.targets = targets;
    this.sourceDir = sourceDir;
    this.activeSourcePath = activeSourcePath;
    this.rebuildCache();
    this.onDidChangeTreeDataEmitter.fire();
  }

  public setActiveSourcePath(activeSourcePath: string | undefined): void {
    this.activeSourcePath = activeSourcePath;
    this.rebuildCache();
    this.onDidChangeTreeDataEmitter.fire();
  }

  public getTreeItem(element: Node): vscode.TreeItem {
    return element;
  }

  public getChildren(element?: Node): Thenable<Node[]> {
    if (!element) {
      return Promise.resolve(this.targets.map((target) => this.targetItems.get(target.id) as TargetTreeItem));
    }

    if (element instanceof TargetTreeItem) {
      return Promise.resolve(
        element.target.sourceFiles.map((sourcePath) => this.sourceItems.get(this.createSourceKey(element.target.id, sourcePath)) as SourceTreeItem),
      );
    }

    return Promise.resolve([]);
  }

  public getParent(element: Node): vscode.ProviderResult<Node> {
    if (element instanceof SourceTreeItem) {
      return this.targetItems.get(element.targetId);
    }

    return undefined;
  }

  public findTargetItem(targetId: string): TargetTreeItem | undefined {
    return this.targetItems.get(targetId);
  }

  public findFirstSourceItemByFile(filePath: string): SourceTreeItem | undefined {
    const normalizedFilePath = normalizePath(filePath);
    for (const target of this.targets) {
      for (const sourcePath of target.sourceFiles) {
        if (normalizePath(sourcePath) === normalizedFilePath) {
          return this.sourceItems.get(this.createSourceKey(target.id, sourcePath));
        }
      }
    }

    return undefined;
  }

  private rebuildCache(): void {
    this.targetItems = new Map(this.targets.map((target) => [target.id, new TargetTreeItem(target)]));
    this.sourceItems = new Map();

    const activeSource = this.activeSourcePath ? normalizePath(this.activeSourcePath) : undefined;
    for (const target of this.targets) {
      for (const sourcePath of target.sourceFiles) {
        const key = this.createSourceKey(target.id, sourcePath);
        const isActive = !!activeSource && normalizePath(sourcePath) === activeSource;
        this.sourceItems.set(key, new SourceTreeItem(sourcePath, target.id, this.sourceDir, isActive));
      }
    }
  }

  private createSourceKey(targetId: string, sourcePath: string): string {
    return `${targetId}::${normalizePath(sourcePath)}`;
  }
}
