import * as vscode from 'vscode';
import { TaskVariables } from '../models';
import { extractProgramPath, getDefaultExecutablePath, replaceTemplateVariables } from '../utils';

export class ConfigurationManager {
  public getBuildCommand(variables: TaskVariables): string {
    return replaceTemplateVariables(this.settings().get<string>('tasks.buildCommandTemplate', ''), variables);
  }

  public getRunCommand(variables: TaskVariables): string {
    return replaceTemplateVariables(this.settings().get<string>('tasks.runCommandTemplate', ''), variables);
  }

  public shouldClearTerminalBeforeRun(): boolean {
    return this.settings().get<boolean>('tasks.clearTerminalBeforeRun', true);
  }

  public resolveDebugProgram(variables: TaskVariables): string {
    const runCommand = this.getRunCommand(variables);
    const inferredProgram = extractProgramPath(runCommand);
    return inferredProgram || getDefaultExecutablePath(variables.buildDir, variables.target);
  }

  private settings(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('myPlugin');
  }
}
