import * as path from 'path';

export function normalizePath(filePath: string): string {
  const normalized = path.normalize(filePath);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

export function toAbsolutePath(candidatePath: string, baseDir: string): string {
  const normalizedCandidate = candidatePath.replace(/\\/g, path.sep).replace(/\//g, path.sep);
  return path.isAbsolute(normalizedCandidate)
    ? path.normalize(normalizedCandidate)
    : path.resolve(baseDir, normalizedCandidate);
}

export function uniqueSorted(items: Iterable<string>): string[] {
  return Array.from(new Set(items)).sort((left, right) => left.localeCompare(right));
}

export function basenameWithoutExecutableExtension(targetName: string): string {
  const parsed = path.parse(targetName);
  if (parsed.ext.toLowerCase() === '.exe') {
    return parsed.name;
  }

  return parsed.base;
}

export function replaceTemplateVariables(template: string, variables: Record<string, string | undefined> | object): string {
  const valueMap = variables as Record<string, string | undefined>;
  return template.replace(/\$\{([^}]+)\}/g, (_, key: string) => valueMap[key] ?? '');
}

export function getDefaultExecutablePath(buildDir: string, targetName: string): string {
  const hasExtension = path.extname(targetName).length > 0;
  const executableName = process.platform === 'win32' && !hasExtension
    ? `${targetName}.exe`
    : targetName;

  return path.join(buildDir, executableName);
}

export function extractProgramPath(commandOrPath: string): string {
  const trimmed = commandOrPath.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (trimmed.startsWith('"')) {
    const closingQuoteIndex = trimmed.indexOf('"', 1);
    return closingQuoteIndex > 1 ? trimmed.slice(1, closingQuoteIndex) : trimmed.slice(1);
  }

  const firstSpace = trimmed.search(/\s/);
  return firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace);
}

export function quoteForShell(commandPart: string): string {
  return commandPart.includes(' ') ? `"${commandPart}"` : commandPart;
}

export function relativeDisplayPath(filePath: string, sourceDir: string): string {
  const relative = path.relative(sourceDir, filePath);
  return relative && !relative.startsWith('..') ? relative : filePath;
}
