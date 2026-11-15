#!/usr/bin/env node
// Writes docs/RULES-DROPPED.html from rules/dropped.json.
'use strict';
const fs = require('fs');
const { FILES, readJson, renderReport } = require('./rule-governance.js');

const dropped = readJson(FILES.dropped);
fs.writeFileSync(FILES.report, renderReport(dropped));
console.log(`wrote docs/RULES-DROPPED.html (${dropped.length} entries)`);
