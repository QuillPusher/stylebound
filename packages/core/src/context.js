/*
 * Context classifier. Decides whether a block is a procedure (it tells the
 * reader to do something) or a description, so that rules can apply
 * different limits to each. No DOM, no dependencies: it runs in Node and,
 * like engine.js, as a plain script.
 *
 *   classify(block)        -> 'procedure' | 'description' | 'other'
 *   isInstruction(text)    -> true when the text starts with a command
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StyleboundContext = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Verbs that start an instruction in software documentation. Our own list.
  const IMPERATIVE = new Set([
    'add', 'allow', 'apply', 'assign', 'attach', 'browse', 'build', 'cancel', 'change', 'check',
    'choose', 'clear', 'click', 'clone', 'close', 'configure', 'confirm', 'connect', 'copy', 'create',
    'define', 'delete', 'deselect', 'disable', 'disconnect', 'double-click', 'download', 'drag', 'drop',
    'edit', 'enable', 'enter', 'expand', 'export', 'extract', 'fill', 'find', 'follow', 'go', 'import',
    'include', 'insert', 'install', 'keep', 'leave', 'let', 'list', 'locate', 'make', 'mark', 'move',
    'navigate', 'note', 'open', 'paste', 'pick', 'press', 'provide', 'put', 'read', 'reboot', 'refresh',
    'register', 'reload', 'remove', 'rename', 'replace', 'request', 'reset', 'restart', 'restore', 'retry',
    'return', 'review', 'right-click', 'run', 'save', 'scroll', 'search', 'see', 'select', 'send', 'set',
    'share', 'sign', 'specify', 'start', 'stop', 'store', 'submit', 'switch', 'sync', 'tap', 'test', 'try',
    'turn', 'type', 'uncheck', 'uninstall', 'unzip', 'update', 'upgrade', 'upload', 'use', 'validate',
    'verify', 'view', 'visit', 'wait', 'write',
    'accept', 'approve', 'archive', 'ask', 'avoid', 'call', 'commit', 'consider', 'contact', 'deploy',
    'ensure', 'exit', 'filter', 'get', 'grant', 'hide', 'hold', 'invite', 'launch', 'load', 'lock', 'merge',
    'mount', 'pause', 'pin', 'print', 'pull', 'push', 'quit', 'reinstall', 'reject', 'remember', 'repeat',
    'reply', 'report', 'rerun', 'resume', 'revoke', 'rotate', 'show', 'skip', 'sort', 'take', 'toggle',
    'unlock', 'unmount', 'execute', 'launch', 'initiate', 'terminate', 'abort', 'display', 'modify', 'obtain'
  ]);

  // A second word that shows the first word is a noun or a subject, not a command:
  // "Export is available", "Search can take a minute", "Update has finished".
  const NOT_COMMAND_AFTER = new Set([
    'is', 'are', 'was', 'were', 'has', 'have', 'had', 'can', 'could', 'will', 'would', 'may', 'might',
    'must', 'should', 'does', 'did', 'and', 'or', 'of', 'button', 'buttons', 'page', 'dialog', 'menu',
    'tab', 'option', 'options', 'command', 'settings', 'field', 'box', 'mode', 'screen', 'window', 'icon',
    'results', 'history', 'bar', 'panel', 'list', 'view', 'status',
    'complete', 'completed', 'failed', 'finished', 'paused', 'started', 'stopped', 'done', 'ready',
    'error', 'errors', 'conflict', 'conflicts'
  ]);
  // Verbs that are commands only with their particle: "Log in", "Back up".
  const PHRASAL = { log: ['in', 'on', 'out', 'into'], back: ['up'] };

  // Third-person verbs: "Sync runs every hour" is a statement about Sync.
  const THIRD_PERSON = new Set([
    'runs', 'starts', 'stops', 'saves', 'sends', 'shows', 'opens', 'closes', 'creates', 'deletes', 'removes',
    'returns', 'fails', 'works', 'retries', 'syncs', 'finds', 'keeps', 'adds', 'uses', 'takes', 'needs',
    'lets', 'gives', 'makes', 'reads', 'writes', 'stores', 'lists', 'displays', 'appears', 'happens', 'means',
    'requires', 'supports', 'includes', 'contains', 'shares', 'exports', 'imports', 'updates', 'uploads', 'downloads'
  ]);

  // An opening clause before the command: "If the sync fails, restart the service."
  const INTRO = /^(?:if|when|whenever|before|after|once|to|unless|while|until|in|on|from|for|during|optionally)\b[^,.;:!?]{0,150},\s*/i;
  // Leading emphasis, quotes, brackets and masked code before the first word.
  const LEADING = new Set(['*', '_', '"', "'", '“', '‘', '(', '[', '>', String.fromCharCode(0xe000)]);
  const LABEL = /^(?:note|tip|important|warning|caution|example|result|prerequisites?)\s*:/i;

  function words(text) {
    return text.match(/[A-Za-z][A-Za-z'’-]*|\d[\d.,]*/g) || [];
  }

  function trimLeading(s) {
    let i = 0;
    while (i < s.length && (LEADING.has(s[i]) || /\s/.test(s[i]))) i++;
    return s.slice(i);
  }

  function isInstruction(text) {
    let s = trimLeading(String(text || ''));
    if (LABEL.test(s)) return false;
    s = s.replace(/^please\s+/i, '').replace(INTRO, '').replace(/^(?:please|then)\s+/i, '');
    const raw = words(s);
    const w = raw.map(x => x.toLowerCase().replace(/’/g, "'"));
    if (!w.length) return false;
    const [w0, w1 = '', w2 = ''] = w;
    if (w0 === "don't" || w0 === 'never' || (w0 === 'do' && w1 === 'not')) return true;
    if (w0 === 'make' && w1 === 'sure') return true;
    if (w0 === 'note' && w1 === 'that') return false; // "Note that ..." announces a fact
    if (PHRASAL[w0]) return PHRASAL[w0].includes(w1);
    if (!IMPERATIVE.has(w0)) return false;
    // A capitalized second word is a UI label, the object of the command: "Open Settings".
    if (NOT_COMMAND_AFTER.has(w1) && !/^[A-Z]/.test(raw[1])) return false;
    if (THIRD_PERSON.has(w1)) return false;
    // "Update 2.1 fixes the crash": a number followed by a third-person verb.
    if (/^\d/.test(w1) && /^[a-z]+s$/.test(w2) && !/ss$/.test(w2)) return false;
    return true;
  }

  // True when the text opens with a clause that ends in a comma: "If the sync fails, ...".
  function hasOpeningClause(text) {
    return INTRO.test(trimLeading(String(text || '')).replace(/^please\s+/i, ''));
  }

  function classify(block) {
    if (!block) return 'other';
    if (block.kind !== 'paragraph' && block.kind !== 'list' && block.kind !== 'quote') return 'other';
    if (block.kind === 'list' && block.ordered) return 'procedure';
    return isInstruction(block.prose !== undefined ? block.prose : block.text) ? 'procedure' : 'description';
  }

  return { classify: classify, isInstruction: isInstruction, hasOpeningClause: hasOpeningClause, IMPERATIVE: IMPERATIVE };
}));
