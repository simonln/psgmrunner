export interface PresetInfo {
  readonly name: string;
  readonly displayName: string;
  readonly binaryDir: string;
  readonly sourceDir: string;
  readonly description?: string;
}

export interface TargetInfo {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
  readonly sourceFiles: string[];
  readonly guessedExecutablePath: string;
}

export interface MappingIndex {
  readonly targets: Map<string, TargetInfo>;
  readonly sourceToTargets: Map<string, string[]>;
}

export interface TaskVariables {
  readonly buildDir: string;
  readonly preset: string;
  readonly target: string;
  readonly sourceDir: string;
}

export interface TaskExecutionResult {
  readonly exitCode: number | undefined;
}
