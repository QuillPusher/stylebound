/*
 * The one config file, stylebound.config.json (plan chunk 1.5). The core never
 * reads files: the CLI finds and parses the file, and the core validates the
 * plain object and applies it to the rules. The JSON Schema is in
 * docs/config.schema.json and must list the same settings.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PROFILES } = require('./load-rules.js');
const { toRuleData } = require('./glossary.js');

export const CONFIG_KEYS = ['$schema', 'profile', 'thresholds', 'enable', 'ignore', 'glossary', 'productNames', 'brands'];
export const DEFAULT_THRESHOLDS = Object.freeze({ instructionWords: 20, descriptionWords: 25, paragraphSentences: 6 });
const THRESHOLD_RANGES = { instructionWords: [5, 100], descriptionWords: [5, 100], paragraphSentences: [1, 50] };

export class ConfigError extends Error {
  constructor(problems) {
    super('stylebound.config.json is not valid:\n' + problems.map(p => '- ' + p).join('\n'));
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const quote = v => JSON.stringify(v);

function stringList(raw, key, problems) {
  const v = raw[key];
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.some(x => typeof x !== 'string' || !x.trim())) {
    problems.push(`${key} must be a list of non-empty strings.`);
    return [];
  }
  const dupes = v.filter((x, i) => v.indexOf(x) !== i);
  if (dupes.length) problems.push(`${key} lists ${quote(dupes[0])} more than once.`);
  return v.slice();
}

/**
 * Checks a parsed config object against the known settings and rule ids.
 * Returns a complete config with defaults filled in, or throws a ConfigError
 * that lists every problem in plain words.
 */
export function validateConfig(raw, ruleIds) {
  const problems = [];
  if (!isObject(raw)) throw new ConfigError(['the file must contain one JSON object, such as { "profile": "strict-plain" }.']);
  for (const k of Object.keys(raw)) {
    if (!CONFIG_KEYS.includes(k)) problems.push(`unknown setting ${quote(k)}. Known settings: ${CONFIG_KEYS.filter(x => x !== '$schema').join(', ')}.`);
  }
  if (raw.$schema !== undefined && typeof raw.$schema !== 'string') problems.push('$schema must be a string.');

  let profile = 'base';
  if (raw.profile !== undefined) {
    if (!PROFILES.includes(raw.profile)) problems.push(`profile must be one of ${PROFILES.map(quote).join(', ')}, not ${quote(raw.profile)}.`);
    else profile = raw.profile;
  }

  const thresholds = { ...DEFAULT_THRESHOLDS };
  if (raw.thresholds !== undefined) {
    if (!isObject(raw.thresholds)) problems.push('thresholds must be an object, such as { "instructionWords": 20 }.');
    else {
      for (const [k, v] of Object.entries(raw.thresholds)) {
        const range = THRESHOLD_RANGES[k];
        if (!range) problems.push(`unknown threshold ${quote(k)}. Known thresholds: ${Object.keys(THRESHOLD_RANGES).join(', ')}.`);
        else if (!Number.isInteger(v) || v < range[0] || v > range[1]) problems.push(`thresholds.${k} must be a whole number from ${range[0]} to ${range[1]}, not ${quote(v)}.`);
        else thresholds[k] = v;
      }
    }
  }

  const known = new Set(ruleIds);
  const enable = stringList(raw, 'enable', problems);
  const ignore = stringList(raw, 'ignore', problems);
  for (const [key, list] of [['enable', enable], ['ignore', ignore]]) {
    for (const id of list) if (!known.has(id)) problems.push(`${key} names an unknown rule ${quote(id)}.`);
  }
  for (const id of enable) if (ignore.includes(id)) problems.push(`rule ${quote(id)} is in both enable and ignore.`);

  let glossary = null;
  if (raw.glossary !== undefined) {
    if (typeof raw.glossary !== 'string' || !raw.glossary.trim()) problems.push('glossary must be a path to a CSV file, relative to the config file.');
    else glossary = raw.glossary;
  }
  const productNames = stringList(raw, 'productNames', problems);
  const brands = stringList(raw, 'brands', problems);

  if (problems.length) throw new ConfigError(problems);
  return { profile, thresholds, enable, ignore, glossary, productNames, brands };
}

/**
 * Applies a validated config to a rule set. Returns new rule objects only for
 * the rules it changes; the input is never modified.
 */
export function applyConfig(rules, config) {
  const t = config.thresholds;
  const names = [...config.productNames, ...config.brands];
  const out = [];
  for (const r of rules) {
    if (config.ignore.includes(r.id)) continue;
    if (r.id === 'plain-sentence-length') out.push({ ...r, maxWordsProcedure: t.instructionWords, maxWordsDescription: t.descriptionWords });
    else if (r.id === 'plain-paragraph-sentences') out.push({ ...r, maxSentences: t.paragraphSentences });
    else out.push(r);
  }
  return withNames(out, names);
}

// Names keep their exact casing (brand-casing) and their capitals in headings (heading-title-case).
function withNames(rules, names) {
  if (!names.length) return rules;
  return rules.map(r => {
    if (r.id === 'brand-casing') {
      const have = new Set((r.terms || []).map(x => x.canonical));
      return { ...r, terms: [...(r.terms || []), ...names.filter(n => !have.has(n)).map(canonical => ({ canonical }))] };
    }
    if (r.id === 'heading-title-case') return { ...r, names: [...new Set([...(r.names || []), ...names])] };
    return r;
  });
}

/**
 * Adds a project glossary (entries from parseGlossary) to the rules. Its rows
 * join the starter glossary and win over starter rows with the same term.
 */
export function applyGlossary(rules, starterEntries, projectEntries) {
  const data = toRuleData([...starterEntries, ...projectEntries]);
  const out = rules.map(r => {
    if (r.id === 'glossary-preferred') return { ...r, terms: data.terms };
    return r;
  });
  return withNames(out, data.names);
}
