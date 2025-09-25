import { log } from '../log.js';
import { executeStructureCommand } from './commands-structure.js';
import { executeStyleCommand } from './commands-style.js';

export function executeCommand(cmd) {
  if (!cmd || typeof cmd.type !== 'string') {
    log("WARN", "[commands] executeCommand: invalid command");
    return null;
  }
  const resStructure = executeStructureCommand(cmd);
  if (resStructure) return resStructure;

  const resStyle = executeStyleCommand(cmd);
  if (resStyle) return resStyle;

  log("WARN", "[commands] Unknown command", { type: cmd.type });
  return null;
}
