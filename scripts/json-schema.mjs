// A small JSON Schema validator for the subset this repository's schemas use:
// type, const, enum, properties, required, additionalProperties, items,
// minItems, maxItems, minLength, minimum, maximum, pattern, uniqueItems and
// local $ref ("#/$defs/..."). It exists so the schemas are tested without a
// dependency. Returns a list of problems; empty means valid.

const typeOf = v => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
const fits = (v, t) => typeOf(v) === t || (t === 'number' && typeof v === 'number');

export function validate(schema, value, root = schema, at = '$') {
  if (schema.$ref) {
    const target = schema.$ref.replace(/^#\//, '').split('/').reduce((o, k) => o[k], root);
    return validate(target, value, root, at);
  }
  const problems = [];
  const fail = msg => problems.push(`${at}: ${msg}`);
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some(t => fits(value, t))) { fail(`expected ${types.join(' or ')}, got ${typeOf(value)}`); return problems; }
  }
  if ('const' in schema && value !== schema.const) fail(`expected ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) fail(`expected one of ${schema.enum.map(x => JSON.stringify(x)).join(', ')}`);
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) fail(`shorter than ${schema.minLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) fail(`does not match ${schema.pattern}`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) fail(`less than ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) fail(`more than ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) fail(`fewer than ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) fail(`more than ${schema.maxItems} items`);
    if (schema.uniqueItems && new Set(value.map(v => JSON.stringify(v))).size !== value.length) fail('items are not unique');
    if (schema.items) value.forEach((v, i) => problems.push(...validate(schema.items, v, root, `${at}[${i}]`)));
  }
  if (typeOf(value) === 'object') {
    for (const k of schema.required || []) if (!(k in value)) fail(`missing ${k}`);
    const props = schema.properties || {};
    for (const [k, v] of Object.entries(value)) {
      if (props[k]) problems.push(...validate(props[k], v, root, `${at}.${k}`));
      else if (schema.additionalProperties === false) fail(`unexpected property ${k}`);
    }
  }
  return problems;
}
