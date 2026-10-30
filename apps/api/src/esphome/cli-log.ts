/** Parse ESPHome CLI stdout/stderr — keep in sync with apps/ui/src/lib/esphome-install-guide.ts */



const COMPILE_SUCCESS = [

  /Successfully compiled program/i,

  /Created:.*firmware\.factory\.bin/i,

];



const COMPILE_FAILURE_LINE = [

  /^Failed config/i,

  /Compilation failed/i,

  /ninja: build stopped/i,

  /fatal error:/i,

  /^ERROR\b/i,

];



const COMPILE_IN_PROGRESS = [

  /checking esp-idf/i,

  /compiling app/i,

  /generating c\+\+/i,

  /discovering available esp-idf/i,

  /regenerating cmakelists/i,

];



function lastMatchingLineIndex(log: string, patterns: RegExp[]): number {

  const lines = log.split(/\r?\n/);

  for (let i = lines.length - 1; i >= 0; i--) {

    const t = lines[i]?.trim() ?? "";

    if (!t) continue;

    if (patterns.some((re) => re.test(t))) return i;

  }

  return -1;

}



export function esphomeCompileLogSucceeded(log: string): boolean {

  const text = log.trim();

  if (!text) return false;

  return COMPILE_SUCCESS.some((re) => re.test(text));

}



export function esphomeCompileLogFailed(log: string): boolean {

  const text = log.trim();

  if (!text) return false;

  if (esphomeCompileLogSucceeded(text)) return false;



  const successIdx = lastMatchingLineIndex(text, COMPILE_SUCCESS);

  const failureIdx = lastMatchingLineIndex(text, COMPILE_FAILURE_LINE);

  if (failureIdx >= 0 && successIdx > failureIdx) return false;

  if (failureIdx >= 0) return true;



  return text.split(/\r?\n/).some((line) => {

    const t = line.trim();

    if (!t) return false;

    return COMPILE_FAILURE_LINE.some((re) => re.test(t));

  });

}



export function esphomeCompileLogInProgress(log: string): boolean {

  const text = log.trim().toLowerCase();

  if (!text || esphomeCompileLogSucceeded(log)) return false;

  return COMPILE_IN_PROGRESS.some((re) => re.test(text));

}



export function esphomeCompileSucceeded(log: string, exitOk: boolean): boolean {

  if (esphomeCompileLogSucceeded(log)) return true;

  if (exitOk && !esphomeCompileLogFailed(log)) return true;

  return false;

}



/** A board's build files were made with the build tools in another place (CMake's cache check). */
export function buildCacheMismatch(log: string): boolean {
  return (
    /does not match the source .* used to generate cache/i.test(log) ||
    /is currently active in the environment while the project was configured with/i.test(log)
  );
}
