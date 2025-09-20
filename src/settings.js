/**
 * settings.js
 * -------------------------------------------------------------------
 * Scene Designer – Settings Facade (ESM ONLY)
 * Purpose:
 * - Keep the public import path stable: import from './settings.js'.
 * - Re-export core settings APIs from settings-core.js and UI builder from settings-ui.js.
 * - No implementation logic here; this file is intentionally thin.
 *
 * Exports:
 * - From settings-core.js:
 *    LOG_LEVELS, LOG_LEVEL_LABEL_TO_NUM, LOG_LEVEL_NUM_TO_LABEL,
 *    settingsRegistry, loadSettings, saveSettings,
 *    setSettingAndSave, setSettingsAndSave
 * - From settings-ui.js:
 *    buildSettingsPanel
 *
 * Notes:
 * - This split keeps file sizes small and concerns separate (core vs UI).
 * - All modules elsewhere should continue importing from './settings.js'.
 * -------------------------------------------------------------------
 */

export {
  LOG_LEVELS,
  LOG_LEVEL_LABEL_TO_NUM,
  LOG_LEVEL_NUM_TO_LABEL,
  settingsRegistry,
  loadSettings,
  saveSettings,
  setSettingAndSave,
  setSettingsAndSave
} from './settings-core.js';

export {
  buildSettingsPanel
} from './settings-ui.js';

