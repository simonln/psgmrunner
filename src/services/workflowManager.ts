import * as path from 'path';
import * as vscode from 'vscode';
import { PresetInfo, TargetInfo } from '../models';
import { quoteForShell } from '../utils';
import { ConfigurationManager } from './configurationManager';
import { OutputLogger } from './outputLogger';
import { TaskExecutionEngine } from './taskExecutionEngine';

export class WorkflowManager {
  public constructor(
    private readonly configurationManager: ConfigurationManager,
    private readonly taskExecutionEngine: TaskExecutionEngine,
    private readonly logger: OutputLogger,
  ) {}

  public async buildPreset(preset: PresetInfo): Promise<boolean> {
    await this.ensureCMakeFileApiQuery(preset);
    const variables = this.createPresetVariables(preset);
    const command = this.configurationManager.getPresetConfigureCommand(variables);
    return this.executeBuildStep({
      command,
      label: `Configure [${preset.name}]`,
      reveal: vscode.TaskRevealKind.Never,
      logName: preset.name,
      displayName: preset.displayName,
      failureVerb: 'Configure',
    });
  }

  public async buildTarget(preset: PresetInfo, target: TargetInfo): Promise<void> {
    const variables = this.createVariables(preset, target);
    const command = this.configurationManager.getBuildCommand(variables);
    const built = await this.executeBuildStep({
      command,
      label: `Build ${target.displayName} [${preset.name}]`,
      reveal: vscode.TaskRevealKind.Never,
      logName: target.name,
      displayName: target.displayName,
      failureVerb: 'Build',
    });

    if (!built) {
      return;
    }

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
  }

  public async runTarget(preset: PresetInfo, target: TargetInfo, buildFirst = true): Promise<void> {
    if (buildFirst) {
      const buildVariables = this.createVariables(preset, target);
      const built = await this.executeBuildStep({
        command: this.configurationManager.getBuildCommand(buildVariables),
        label: `Build ${target.displayName} [${preset.name}]`,
        logName: target.name,
        displayName: target.displayName,
        failureVerb: 'Build',
      });
      if (!built) {
        return;
      }
    }

    const runVariables = this.createVariables(preset, target);
    const runCommand = this.configurationManager.getRunCommand(runVariables);
    const runLabel = `Run ${target.displayName} [${preset.name}]`;
    this.logger.info(`Launching run task for target ${target.name}`);
    await this.taskExecutionEngine.executeRun(runCommand, runLabel, preset.binaryDir);
  }

  public async debugTarget(preset: PresetInfo, target: TargetInfo): Promise<void> {
    const buildVariables = this.createVariables(preset, target);
    const built = await this.executeBuildStep({
      command: this.configurationManager.getBuildCommand(buildVariables),
      label: `Build ${target.displayName} [${preset.name}]`,
      logName: target.name,
      displayName: target.displayName,
      failureVerb: 'Build',
    });

    if (built) {
      await this.startDebugging(preset, target);
    }
  }

  private async startDebugging(preset: PresetInfo, target: TargetInfo): Promise<void> {
    const variables = this.createVariables(preset, target);
    const program = this.configurationManager.resolveDebugProgram(variables);
    const debugType = process.platform === 'win32' ? 'cppvsdbg' : 'cppdbg';

    // this.logger.info(`Starting debug session for ${target.name}. type=${debugType}, program=${program}`);

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
      this.logger.warn(`VS Code did not start a debug session for ${target.name}`);
      void vscode.window.showWarningMessage(`Unable to start a debug session for ${target.displayName}. Make sure the C/C++ debug extension is installed and the executable exists.`);
      return;
    }

    // this.logger.info(`Debug session started for ${target.name}`);
  }

  private createPresetVariables(preset: PresetInfo): { buildDir: string; preset: string; sourceDir: string } {
    return {
      buildDir: preset.binaryDir,
      preset: preset.name,
      sourceDir: preset.sourceDir,
    };
  }

  private createVariables(preset: PresetInfo, target: TargetInfo): { buildDir: string; preset: string; target: string; sourceDir: string; buildPreset?: string; configuration?: string; configurationArgument: string; executablePath: string; quotedExecutablePath: string; executableCommand: string; buildPresetArgument: string} {
    const configuration = target.configuration ?? preset.configuration;
    const quotedExecutablePath = quoteForShell(target.guessedExecutablePath);
    return {
      buildDir: preset.binaryDir,
      preset: preset.name,
      target: target.name,
      sourceDir: preset.sourceDir,
      buildPreset: preset.buildPresetName,
      configuration,
      configurationArgument: configuration ? ` --config ${configuration}` : '',
      executablePath: target.guessedExecutablePath,
      quotedExecutablePath,
      executableCommand: process.platform === 'win32' ? `& ${quotedExecutablePath}` : quotedExecutablePath,
      buildPresetArgument: preset.buildPresetName ? ` --preset ${preset.buildPresetName}` : '',
    };
  }

  private async executeBuildStep(options: {
    command: string;
    label: string;
    logName: string;
    displayName: string;
    failureVerb: string;
    reveal?: vscode.TaskRevealKind;
  }): Promise<boolean> {
    const result = await this.taskExecutionEngine.executeBuild(
      options.command,
      options.label,
      options.reveal ?? vscode.TaskRevealKind.Always,
    );
    if (result.exitCode === 0) {
      return true;
    }

    this.reportBuildFailure(options.failureVerb, options.logName, options.displayName, result.exitCode);
    return false;
  }

  private reportBuildFailure(
    failureVerb: string,
    logName: string,
    displayName: string,
    exitCode: number | undefined,
  ): void {
    if (typeof exitCode !== 'number') {
      return;
    }

    this.logger.error(`${failureVerb} failed for ${logName} with exit code ${exitCode}`);
    void vscode.window.showErrorMessage(`${failureVerb} failed for ${displayName}. Exit code: ${exitCode}`);
  }

  private async ensureCMakeFileApiQuery(preset: PresetInfo): Promise<void> {
    const queryDir = vscode.Uri.file(path.join(preset.binaryDir, '.cmake', 'api', 'v1', 'query'));
    const queryFile = vscode.Uri.file(path.join(queryDir.fsPath, 'codemodel-v2'));

    try {
      await vscode.workspace.fs.createDirectory(queryDir);
      await vscode.workspace.fs.writeFile(queryFile, new Uint8Array());
    //   this.logger.info(`Prepared CMake File API query at ${queryFile.fsPath}`);
    } catch (error) {
      this.logger.warn(`Unable to prepare CMake File API query for ${preset.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
