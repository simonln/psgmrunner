import * as vscode from 'vscode';
import { PresetInfo, TargetInfo } from './models';
import { ConfigurationManager } from './services/configurationManager';
import { MappingEngine } from './services/mappingEngine';
import { PresetProvider } from './services/presetProvider';
import { TaskExecutionEngine } from './services/taskExecutionEngine';
import { WorkflowManager } from './services/workflowManager';
import { PresetTreeDataProvider, PresetTreeItem } from './ui/presetTreeDataProvider';
import { SourceTreeItem, TargetTreeDataProvider, TargetTreeItem } from './ui/targetTreeDataProvider';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return;
  }

  const workspaceRoot = workspaceFolder.uri.fsPath;
  const configurationManager = new ConfigurationManager();
  const presetProvider = new PresetProvider(workspaceRoot);
  const mappingEngine = new MappingEngine();
  const taskExecutionEngine = new TaskExecutionEngine(workspaceRoot, configurationManager);
  const workflowManager = new WorkflowManager(configurationManager, taskExecutionEngine);
  const presetTreeDataProvider = new PresetTreeDataProvider();
  const targetTreeDataProvider = new TargetTreeDataProvider();

  const presetsTreeView = vscode.window.createTreeView('myPlugin.presets', {
    treeDataProvider: presetTreeDataProvider,
    showCollapseAll: false,
  });

  const targetsTreeView = vscode.window.createTreeView('myPlugin.targets', {
    treeDataProvider: targetTreeDataProvider,
    showCollapseAll: true,
  });

  context.subscriptions.push(presetsTreeView, targetsTreeView);

  let presets: PresetInfo[] = [];
  let currentPreset: PresetInfo | undefined;

  const updateTargets = async (): Promise<void> => {
    const activeFile = vscode.window.activeTextEditor?.document.uri.fsPath;
    if (currentPreset) {
      await mappingEngine.rebuild(currentPreset);
      targetTreeDataProvider.setTargets(mappingEngine.getTargets(), currentPreset.sourceDir, activeFile);
      await revealActiveSource(activeFile);
      return;
    }

    targetTreeDataProvider.setTargets([], workspaceRoot, activeFile);
  };

  const refresh = async (preferredPresetName?: string): Promise<void> => {
    presets = await presetProvider.loadPresets();
    const storedPresetName = preferredPresetName ?? context.workspaceState.get<string>('myPlugin.selectedPreset');
    currentPreset = presets.find((preset) => preset.name === storedPresetName) ?? presets[0];

    if (currentPreset) {
      await context.workspaceState.update('myPlugin.selectedPreset', currentPreset.name);
    }

    presetTreeDataProvider.setPresets(presets, currentPreset?.name);
    await updateTargets();
  };

  const ensurePreset = (): PresetInfo | undefined => {
    if (!currentPreset) {
      void vscode.window.showWarningMessage('No available CMake Configure Preset was found. Please check CMakePresets.json.');
      return undefined;
    }

    return currentPreset;
  };

  const resolveTargetFromArgument = async (value?: TargetTreeItem | SourceTreeItem): Promise<TargetInfo | undefined> => {
    if (value instanceof TargetTreeItem) {
      return value.target;
    }

    if (value instanceof SourceTreeItem) {
      return mappingEngine.findTargetsBySource(value.sourcePath)[0];
    }

    const activePath = vscode.window.activeTextEditor?.document.uri.fsPath;
    if (!activePath) {
      void vscode.window.showWarningMessage('No active source file is open, so no target can be resolved.');
      return undefined;
    }

    const target = mappingEngine.findTargetsBySource(activePath)[0];
    if (!target) {
      void vscode.window.showWarningMessage('The active source file is not mapped to any executable target.');
    }
    return target;
  };

  const revealActiveSource = async (filePath: string | undefined): Promise<void> => {
    if (!filePath) {
      return;
    }

    targetTreeDataProvider.setActiveSourcePath(filePath);
    const sourceItem = targetTreeDataProvider.findFirstSourceItemByFile(filePath);
    if (!sourceItem) {
      return;
    }

    try {
      await targetsTreeView.reveal(sourceItem, {
        select: true,
        focus: false,
        expand: true,
      });
    } catch {
      // Ignore reveal errors when the view is not ready yet.
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('myPlugin.refresh', async () => {
      await refresh(currentPreset?.name);
    }),
    vscode.commands.registerCommand('myPlugin.selectPreset', async (item?: PresetTreeItem) => {
      if (!item) {
        const pick = await vscode.window.showQuickPick(
          presets.map((preset) => ({ label: preset.displayName, description: preset.name, preset })),
          { placeHolder: 'Select a CMake Configure Preset' },
        );

        if (!pick) {
          return;
        }

        currentPreset = pick.preset;
      } else {
        currentPreset = item.preset;
      }

      await context.workspaceState.update('myPlugin.selectedPreset', currentPreset.name);
      presetTreeDataProvider.setPresets(presets, currentPreset.name);
      await updateTargets();

      const presetTreeItem = presetTreeDataProvider.findItem(currentPreset.name);
      if (presetTreeItem) {
        try {
          await presetsTreeView.reveal(presetTreeItem, { select: true, focus: false });
        } catch {
          // ignore
        }
      }
    }),
    vscode.commands.registerCommand('myPlugin.buildTarget', async (item?: TargetTreeItem | SourceTreeItem) => {
      const preset = ensurePreset();
      if (!preset) {
        return;
      }

      const target = await resolveTargetFromArgument(item);
      if (!target) {
        return;
      }

      await workflowManager.buildTarget(preset, target);
    }),
    vscode.commands.registerCommand('myPlugin.runTarget', async (item?: TargetTreeItem | SourceTreeItem) => {
      const preset = ensurePreset();
      if (!preset) {
        return;
      }

      const target = await resolveTargetFromArgument(item);
      if (!target) {
        return;
      }

      await workflowManager.runTarget(preset, target);
    }),
    vscode.commands.registerCommand('myPlugin.debugTarget', async (item?: TargetTreeItem | SourceTreeItem) => {
      const preset = ensurePreset();
      if (!preset) {
        return;
      }

      const target = await resolveTargetFromArgument(item);
      if (!target) {
        return;
      }

      await workflowManager.debugTarget(preset, target);
    }),
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      await revealActiveSource(editor?.document.uri.fsPath);
    }),
  );

  await refresh();
}

export function deactivate(): void {
  // no-op
}
