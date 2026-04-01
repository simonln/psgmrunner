import * as vscode from 'vscode';
import { PresetInfo } from '../models';

export class PresetTreeItem extends vscode.TreeItem {
  public constructor(public readonly preset: PresetInfo, isSelected: boolean) {
    super(preset.displayName, vscode.TreeItemCollapsibleState.None);
    this.description = isSelected ? 'Current' : preset.name;
    this.tooltip = [preset.displayName, preset.binaryDir, preset.description].filter(Boolean).join('\n');
    this.contextValue = 'preset';
    this.iconPath = isSelected ? new vscode.ThemeIcon('check') : new vscode.ThemeIcon('gear');
    this.command = {
      command: 'psgmrunner.selectPreset',
      title: 'Select Preset',
      arguments: [this],
    };
  }
}

export class PresetTreeDataProvider implements vscode.TreeDataProvider<PresetTreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<PresetTreeItem | undefined | void>();
  private presets: PresetInfo[] = [];
  private selectedPresetName?: string;
  private itemsByPresetName = new Map<string, PresetTreeItem>();

  public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  public setPresets(presets: PresetInfo[], selectedPresetName: string | undefined): void {
    this.presets = presets;
    this.selectedPresetName = selectedPresetName;
    this.itemsByPresetName = new Map(
      presets.map((preset) => [preset.name, new PresetTreeItem(preset, preset.name === selectedPresetName)]),
    );
    this.onDidChangeTreeDataEmitter.fire();
  }

  public getTreeItem(element: PresetTreeItem): vscode.TreeItem {
    return element;
  }

  public getChildren(): Thenable<PresetTreeItem[]> {
    return Promise.resolve(this.presets.map((preset) => this.itemsByPresetName.get(preset.name) as PresetTreeItem));
  }

  public findItem(presetName: string): PresetTreeItem | undefined {
    return this.itemsByPresetName.get(presetName);
  }
}
