/*
 * Reads the project glossary named in stylebound.config.json. The path is
 * relative to the config file. The core parses and applies it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseGlossary } from '../../core/index.mjs';

/**
 * Returns the project glossary entries for a loaded config ({ file, dir, config }),
 * or [] when the config names no glossary. Throws an Error that names the file
 * and every problem line.
 */
export function loadGlossary(loaded) {
  if (!loaded || !loaded.config || !loaded.config.glossary) return [];
  const file = path.resolve(loaded.dir, loaded.config.glossary);
  if (!fs.existsSync(file)) throw new Error(`${file}: glossary file not found (named in ${loaded.file}).`);
  const { entries, problems } = parseGlossary(fs.readFileSync(file, 'utf8'), file);
  if (problems.length) throw new Error(`The glossary has ${problems.length} problem(s):\n` + problems.map(p => '- ' + p).join('\n'));
  return entries;
}
