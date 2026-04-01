import * as path from 'path';
import * as vscode from 'vscode';
import { MappingIndex, PresetInfo, TargetInfo } from '../models';
import { basenameWithoutExecutableExtension, getDefaultExecutablePath, normalizePath, toAbsolutePath, uniqueSorted } from '../utils';

interface CompileCommandEntry {
  readonly directory?: string;
  readonly file?: string;
  readonly command?: string;
  readonly arguments?: string[];
  readonly output?: string;
}

export class MappingEngine {
  private currentIndex: MappingIndex = {
    targets: new Map<string, TargetInfo>(),
    sourceToTargets: new Map<string, string[]>(),
  };

  public async rebuild(preset: PresetInfo): Promise<void> {
    const compileCommandsPath = vscode.Uri.file(path.join(preset.binaryDir, 'compile_commands.json'));
    let content: Uint8Array;

    try {
      content = await vscode.workspace.fs.readFile(compileCommandsPath);
    } catch {
      this.currentIndex = {
        targets: new Map<string, TargetInfo>(),
        sourceToTargets: new Map<string, string[]>(),
      };
      return;
    }

    const entries = JSON.parse(Buffer.from(content).toString('utf8')) as CompileCommandEntry[];
    const targets = new Map<string, TargetInfo>();
    const sourceToTargets = new Map<string, string[]>();

    for (const entry of entries) {
      if (!entry.file) {
        continue;
      }

      const baseDir = entry.directory ? toAbsolutePath(entry.directory, preset.binaryDir) : preset.binaryDir;
      const absoluteSourcePath = toAbsolutePath(entry.file, baseDir);
      const targetName = this.inferTargetName(entry, baseDir);

      if (!targetName) {
        continue;
      }

      const targetKey = normalizePath(targetName);
      const existingTarget = targets.get(targetKey);
      const sourceFiles = existingTarget?.sourceFiles ?? [];
      sourceFiles.push(absoluteSourcePath);

      targets.set(targetKey, {
        id: targetKey,
        name: targetName,
        displayName: targetName,
        sourceFiles: uniqueSorted(sourceFiles),
        guessedExecutablePath: getDefaultExecutablePath(preset.binaryDir, targetName),
      });

      const sourceKey = normalizePath(absoluteSourcePath);
      const mappedTargets = sourceToTargets.get(sourceKey) ?? [];
      if (!mappedTargets.includes(targetKey)) {
        mappedTargets.push(targetKey);
      }
      sourceToTargets.set(sourceKey, mappedTargets);
    }

    this.currentIndex = { targets, sourceToTargets };
  }

  public getTargets(): TargetInfo[] {
    return Array.from(this.currentIndex.targets.values()).sort((left, right) => left.displayName.localeCompare(right.displayName));
  }

  public findTargetsBySource(sourcePath: string): TargetInfo[] {
    const targetIds = this.currentIndex.sourceToTargets.get(normalizePath(sourcePath)) ?? [];
    return targetIds
      .map((targetId) => this.currentIndex.targets.get(targetId))
      .filter((target): target is TargetInfo => !!target);
  }

  private inferTargetName(entry: CompileCommandEntry, baseDir: string): string | undefined {
    const outputCandidate = entry.output
      ? toAbsolutePath(entry.output, baseDir)
      : this.extractOutputFromArguments(entry.arguments, baseDir) ?? this.extractOutputFromCommand(entry.command, baseDir);

    if (!outputCandidate) {
      return undefined;
    }

    const normalizedOutput = path.normalize(outputCandidate);
    const cmakeMatch = normalizedOutput.match(/[\\/]CMakeFiles[\\/](.+?)\.dir(?:[\\/]|$)/i);
    if (cmakeMatch?.[1]) {
      return basenameWithoutExecutableExtension(cmakeMatch[1]);
    }

    const parsed = path.parse(normalizedOutput);
    return parsed.name || parsed.base;
  }

  private extractOutputFromArguments(argumentsList: string[] | undefined, baseDir: string): string | undefined {
    if (!Array.isArray(argumentsList)) {
      return undefined;
    }

    const outputIndex = argumentsList.findIndex((item) => item === '-o' || item === '/Fo');
    if (outputIndex >= 0 && argumentsList[outputIndex + 1]) {
      return toAbsolutePath(argumentsList[outputIndex + 1], baseDir);
    }

    const joinedOutput = argumentsList.find((item) => item.startsWith('/Fo'));
    if (joinedOutput) {
      return toAbsolutePath(joinedOutput.slice(3), baseDir);
    }

    return undefined;
  }

  private extractOutputFromCommand(command: string | undefined, baseDir: string): string | undefined {
    if (!command) {
      return undefined;
    }

    const outputMatch = command.match(/(?:^|\s)-o\s+("[^"]+"|\S+)/);
    if (outputMatch?.[1]) {
      return toAbsolutePath(outputMatch[1].replace(/^"|"$/g, ''), baseDir);
    }

    const msvcMatch = command.match(/\/Fo("[^"]+"|\S+)/);
    if (msvcMatch?.[1]) {
      return toAbsolutePath(msvcMatch[1].replace(/^"|"$/g, ''), baseDir);
    }

    return undefined;
  }
}
