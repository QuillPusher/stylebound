'use strict';
/*
 * Loads the rule files from src/rules: NN-*.json merged in name order, plus
 * meta.json and coverage.json. Used by the ESM entry point (index.mjs).
 */
const fs = require('fs');
const path = require('path');

const { parseGlossary, toRuleData } = require('./glossary.js');

const RULES_DIR = path.join(__dirname, 'rules');
const STARTER_GLOSSARY = path.join(__dirname, '..', 'glossary', 'starter.csv');

/** The starter glossary entries (glossary/starter.csv). Throws if the file has a problem. */
function loadStarterGlossary() {
  const { entries, problems } = parseGlossary(fs.readFileSync(STARTER_GLOSSARY, 'utf8'), 'glossary/starter.csv');
  if (problems.length) throw new Error(problems.join(' '));
  return entries;
}

function loadRules(dir) {
  dir = dir || RULES_DIR;
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  const coverage = JSON.parse(fs.readFileSync(path.join(dir, 'coverage.json'), 'utf8'));
  let rules = [];
  for (const f of fs.readdirSync(dir).sort()) {
    if (/^\d\d-.*\.json$/.test(f)) rules = rules.concat(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  }
  const ids = new Set();
  for (const r of rules) {
    if (ids.has(r.id)) throw new Error('duplicate rule id: ' + r.id);
    ids.add(r.id);
    for (const key of ['id', 'name', 'severity', 'type', 'source', 'message', 'fix', 'examples']) {
      if (r[key] === undefined) throw new Error('rule ' + r.id + ' is missing ' + key);
    }
  }
  for (const c of coverage) for (const id of c.rules) if (!ids.has(id)) throw new Error('coverage refers to unknown rule ' + id);
  // The glossary rule takes its terms from the starter glossary.
  const starter = toRuleData(loadStarterGlossary());
  for (const r of rules) {
    if (r.id === 'glossary-preferred') r.terms = starter.terms;
  }
  return { meta, rules, coverage };
}

const PROFILES = ['base', 'strict-plain'];

/*
 * The rules that run for a profile. A rule without `profiles` runs in every
 * profile. A rule with `default: "opt-in"` runs only when its id is in
 * `enable`. A selected rule's `replaces` list switches off the rules it
 * supersedes (strict-plain's sentence-length rule replaces the base one).
 */
function selectRules(rules, options) {
  const profile = (options && options.profile) || 'base';
  const enable = (options && options.enable) || [];
  if (!PROFILES.includes(profile)) throw new Error('unknown profile "' + profile + '"; use one of: ' + PROFILES.join(', '));
  const picked = rules.filter(r => (!r.profiles || r.profiles.includes(profile)) && (r.default !== 'opt-in' || enable.includes(r.id)));
  const replaced = new Set();
  for (const r of picked) for (const id of r.replaces || []) replaced.add(id);
  return picked.filter(r => !replaced.has(r.id));
}

module.exports = { loadRules, selectRules, loadStarterGlossary, PROFILES, RULES_DIR, STARTER_GLOSSARY };
