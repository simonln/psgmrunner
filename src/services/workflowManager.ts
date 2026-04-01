import * as path from 'path';
import * as vscode from 'vscode';
import { PresetInfo, TargetInfo } from '../models';
import { ConfigurationManager } from './configurationManager';
import { TaskExecutionEngine } from './taskExecutionEngine';

export class WorkflowManager {
  public constructor(
    private readonly configurationManager: ConfigurationManager,
    private readonly taskExecutionEngine: TaskExecutionEngine,
  ) {}

  public async buildTarget(preset: PresetInfo, target: TargetInfo): Promise<void> {
    const variables = this.createVariables(preset, target);
    const command = this.configurationManager.getBuildCommand(variables);
    const label = `CMake Runner: Build ${target.displayName} [${preset.name}]`;
    const result = await this.taskExecutionEngine.executeBuild(command, label);

    if (result.exitCode === 0) {
      const action = await vscode.window.showInformationMessage(
        `Target ${target.displayName} built successfully.`,
        'Run',
        'Debug',
      );

      if (action === 'Run') {
        await this.runTarget(preset, target, false);
      }

      if (action === 'Debug') {
        await this.startDebugging(preset, target);
      }

      return;
    }

    if (typeof result.exitCode === 'number') {
      void vscode.window.showErrorMessage(`Build failed for target ${target.displayName}. Exit code: ${result.exitCode}`);
    }
  }

  public async runTarget(preset: PresetInfo, target: TargetInfo, buildFirst = true): Promise<void> {
    if (buildFirst) {
      const buildVariables = this.createVariables(preset, target);
      const buildCommand = this.configurationManager.getBuildCommand(buildVariables);
      const buildLabel = `CMake Runner: Build ${target.displayName} [${preset.name}]`;
      const buildResult = await this.taskExecutionEngine.executeBuild(buildCommand, buildLabel);
      if (buildResult.exitCode !== 0) {
        if (typeof buildResult.exitCode === 'number') {
          void vscode.window.showErrorMessage(`Build failed for target ${target.displayName}. Exit code: ${buildResult.exitCode}`);
        }
        return;
      }
    }

    const runVariables = this.createVariables(preset, target);
    const runCommand = this.configurationManager.getRunCommand(runVariables);
    const runLabel = `CMake Runner: Run ${target.displayName} [${preset.name}]`;
    await this.taskExecutionEngine.executeRun(runCommand, runLabel);
  }

  public async debugTarget(preset: PresetInfo, target: TargetInfo): Promise<void> {
    const buildVariables = this.createVariables(preset, target);
    const buildCommand = this.configurationManager.getBuildCommand(buildVariables);
    const buildLabel = `CMake Runner: Build ${target.displayName} [${preset.name}]`;
    const result = await this.taskExecutionEngine.executeBuild(buildCommand, buildLabel);

    if (result.exitCode === 0) {
      await this.startDebugging(preset, target);
      return;
    }

    if (typeof result.exitCode === 'number') {
      void vscode.window.showErrorMessage(`Build failed for target ${target.displayName}. Exit code: ${result.exitCode}`);
    }
  }

  private async startDebugging(preset: PresetInfo, target: TargetInfo): Promise<void> {
    const variables = this.createVariables(preset, target);
    const program = this.configurationManager.resolveDebugProgram(variables);
    const debugType = process.platform === 'win32' ? 'cppvsdbg' : 'cppdbg';

    const started = await vscode.debug.startDebugging(undefined, {
      name: `Debug ${target.displayName}`,
      type: debugType,
      request: 'launch',
      program,
      cwd: path.dirname(program || target.guessedExecutablePath),
      args: [],
      stopAtEntry: false,
      externalConsole: false,
    });

    if (!started) {
      void vscode.window.showWarningMessage(`Unable to start a debug session for ${target.displayName}. Make sure the C/C++ debug extension is installed and the executable exists.`);
    }
  }

  private createVariables(preset: PresetInfo, target: TargetInfo): { buildDir: string; preset: string; target: string; sourceDir: string } {
    return {
      buildDir: preset.binaryDir,
      preset: preset.name,
      target: target.name,
      sourceDir: preset.sourceDir,
    };
  }
}
