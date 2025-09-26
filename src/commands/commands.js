import { log } from '../log.js';
import { executeSceneCommand } from './commands-scene.js';
import { executeStructureCommand } from './commands-structure.js';
import { executeStyleCommand } from './commands-style.js';

/*
  Command execution dispatcher (ordered):
    1. Scene-level (image, scene name/logic, etc.)
    2. Structural (add/delete/duplicate/move/selection/lock/align/transforms)
    3. Style (stroke/fill/strokeWidth)

  Each executor returns an inverse command object or null.
  First non-null inverse short-circuits the chain.
*/
export function executeCommand(cmd) {
  if (!cmd || typeof cmd.type !== 'string') {
    log("WARN", "[commands] executeCommand: invalid command", { cmd });
    return null;
  }

  // Scene-level
  const resScene = executeSceneCommand(cmd);
  if (resScene) return resScene;

  // Structural
  const resStructure = executeStructureCommand(cmd);
  if (resStructure) return resStructure;

  // Style
  const resStyle = executeStyleCommand(cmd);
  if (resStyle) return resStyle;

  log("WARN", "[commands] Unknown command", { type: cmd.type });
  return null;
}
