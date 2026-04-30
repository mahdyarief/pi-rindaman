const normalizeCommandText = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .replace(/^[\s"'`([{]+|[\s"'`)\]}!,.?:;]+$/g, "");

const getNormalizedLines = (text: string) =>
  text.split(/\r?\n/).map(normalizeCommandText).filter(Boolean);

const getLastNormalizedCommandLine = (text: string) => getNormalizedLines(text).at(-1);

export const stripCommandPrefix = (text: string, commandName: string) => {
  const normalized = getLastNormalizedCommandLine(text);
  if (!normalized) return "";

  const prefixes = [`/${commandName}`, commandName];
  for (const prefix of prefixes) {
    if (normalized === prefix) return "";
    if (normalized.startsWith(`${prefix} `)) return normalized.slice(prefix.length + 1).trim();
  }

  return normalized;
};

export const getToggle = (text: string) => {
  const onCommands = new Set([
    "/pi-rindaman on",
    "pi-rindaman on",
    "/strict on",
    "strict on",
    "strict mode",
    "be strict",
  ]);
  const offCommands = new Set([
    "/pi-rindaman off",
    "pi-rindaman off",
    "/strict off",
    "strict off",
    "normal mode",
    "stop strict",
  ]);

  const full = normalizeCommandText(text);
  if (onCommands.has(full)) return true;
  if (offCommands.has(full)) return false;

  const lines = getNormalizedLines(text);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (onCommands.has(lines[i])) return true;
    if (offCommands.has(lines[i])) return false;
  }

  return undefined;
};
