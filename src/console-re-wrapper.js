import 'console-remote-client';

const consoleReGlobal = typeof window !== "undefined"
  ? (window.ConsoleRe || window.re || null)
  : null;

export default consoleReGlobal;
export const init = consoleReGlobal?.init ?? null;
