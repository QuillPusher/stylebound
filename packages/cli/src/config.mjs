/*
 * Finds and reads stylebound.config.json for the CLI. The core never reads
 * files; it validates the parsed object (validateConfig in the core).
 */
import fs from 'node:fs';
import path from 'node:path';

export const CONFIG_FILE = 'stylebound.config.json';

/** The nearest stylebound.config.json in startDir or a parent folder, or null. */
export function findConfig(startDir) {
  let dir = path.resolve(startDir);
  for (;;) {
    const file = path.join(dir, CONFIG_FILE);
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Reads the nearest config file. Returns { file, dir, config } with the parsed
 * object, or null when there is none. Throws an Error that names the file when
 * it is not valid JSON.
 */
export function loadConfig(startDir) {
  const file = findConfig(startDir);
  if (!file) return null;
  let text = fs.readFileSync(file, 'utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // byte order mark
  let config;
  try {
    config = JSON.parse(text);
  } catch (e) {
    throw new Error(`${file} is not valid JSON: ${e.message}`);
  }
  return { file, dir: path.dirname(file), config };
}
