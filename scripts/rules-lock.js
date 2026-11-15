#!/usr/bin/env node
// Appends rule ids that are not in rules/RULE-IDS.lock yet. It never removes or changes a line.
'use strict';
const fs = require('fs');
const { FILES, readLock, formatLock, appendNew } = require('./rule-governance.js');
const { loadRules } = require('../packages/core/src/load-rules.js');

const old = fs.existsSync(FILES.lock) ? readLock(fs.readFileSync(FILES.lock, 'utf8')) : new Map();
const { lock, added } = appendNew(old, loadRules().rules);
fs.writeFileSync(FILES.lock, formatLock(lock));
console.log(added.length ? `Added to rules/RULE-IDS.lock: ${added.join(', ')}` : 'rules/RULE-IDS.lock is up to date.');
console.log(`${lock.size} rule ids in the lock.`);
