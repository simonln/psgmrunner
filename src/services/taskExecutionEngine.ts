import * as vscode from 'vscode';
import { TaskExecutionResult } from '../models';
import { ConfigurationManager } from './configurationManager';

export class TaskExecutionEngine {
  public constructor(
    private readonly workspaceRoot: string,
    private readonly configurationManager: ConfigurationManager,
  ) {}

  public async executeBuild(command: string, label: string): Promise<TaskExecutionResult> {
    return this.executeTask(command, label, ['$gcc', '$msCompile'], vscode.TaskGroup.Build);
  }

  public async executeRun(command: string, label: string): Promise<TaskExecutionResult> {
    return this.executeTask(command, label, []);
  }

  private async executeTask(
    command: string,
    label: string,
    problemMatchers: string[],
    group?: vscode.TaskGroup,
  ): Promise<TaskExecutionResult> {
    const task = new vscode.Task(
      {
        type: 'shell',
        task: label,
      },
      vscode.TaskScope.Workspace,
      label,
      'myPlugin',
      new vscode.ShellExecution(command, { cwd: this.workspaceRoot }),
      problemMatchers,
    );

    if (group) {
      task.group = group;
    }

    task.presentationOptions = {
      reveal: vscode.TaskRevealKind.Always,
      focus: false,
      clear: this.configurationManager.shouldClearTerminalBeforeRun(),
      panel: vscode.TaskPanelKind.Shared,
    };

    const execution = await vscode.tasks.executeTask(task);

    return await new Promise<TaskExecutionResult>((resolve) => {
      let resolved = false;

      const finish = (exitCode: number | undefined): void => {
        if (resolved) {
          return;
        }

        resolved = true;
        endProcessDisposable.dispose();
        endTaskDisposable.dispose();
        resolve({ exitCode });
      };

      const endProcessDisposable = vscode.tasks.onDidEndTaskProcess((event) => {
        if (event.execution === execution) {
          finish(event.exitCode);
        }
      });

      const endTaskDisposable = vscode.tasks.onDidEndTask((event) => {
        if (event.execution === execution) {
          finish(undefined);
        }
      });
    });
  }
}
