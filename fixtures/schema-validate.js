/* Tiny, dependency-free JSON-Schema (draft-07 subset) validator.
   Supports exactly the keywords aura-project.schema.json uses:
   type (incl. ["x","null"]), const, enum, minimum, maximum, minItems, maxItems,
   items (schema OR tuple array), additionalItems:false, properties, required,
   additionalProperties (bool|schema), and $ref into #/definitions.
   Runs unchanged in the browser and in any CommonJS/JS host. */
(function (root) {
  function typeOk(t, v) {
    switch (t) {
      case 'integer': return typeof v === 'number' && Number.isFinite(v) && Math.floor(v) === v;
      case 'number':  return typeof v === 'number' && Number.isFinite(v);
      case 'string':  return typeof v === 'string';
      case 'boolean': return typeof v === 'boolean';
      case 'array':   return Array.isArray(v);
      case 'object':  return v !== null && typeof v === 'object' && !Array.isArray(v);
      case 'null':    return v === null;
      default:        return false;
    }
  }
  var eq = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };

  function resolve(rootSchema, ref) {
    // only local pointers like #/definitions/name
    var parts = ref.replace(/^#\//, '').split('/');
    var cur = rootSchema;
    for (var i = 0; i < parts.length; i++) cur = cur && cur[parts[i]];
    return cur || {};
  }

  function validate(schema, data, rootSchema, path, errs) {
    path = path || '$';
    errs = errs || [];
    rootSchema = rootSchema || schema;
    if (schema.$ref) schema = resolve(rootSchema, schema.$ref);

    if (schema.type) {
      var types = Array.isArray(schema.type) ? schema.type : [schema.type];
      if (!types.some(function (t) { return typeOk(t, data); })) {
        errs.push(path + ': expected ' + types.join(' | '));
        return errs; // no point checking further against the wrong type
      }
    }
    if ('const' in schema && !eq(data, schema.const))
      errs.push(path + ': must equal ' + JSON.stringify(schema.const));
    if (schema.enum && !schema.enum.some(function (e) { return eq(e, data); }))
      errs.push(path + ': ' + JSON.stringify(data) + ' not one of ' + JSON.stringify(schema.enum));

    if (typeof data === 'number') {
      if ('minimum' in schema && data < schema.minimum) errs.push(path + ': ' + data + ' < minimum ' + schema.minimum);
      if ('maximum' in schema && data > schema.maximum) errs.push(path + ': ' + data + ' > maximum ' + schema.maximum);
    }

    if (Array.isArray(data)) {
      if ('minItems' in schema && data.length < schema.minItems)
        errs.push(path + ': ' + data.length + ' items < minItems ' + schema.minItems);
      if ('maxItems' in schema && data.length > schema.maxItems)
        errs.push(path + ': ' + data.length + ' items > maxItems ' + schema.maxItems);
      if (Array.isArray(schema.items)) { // tuple validation
        data.forEach(function (v, i) {
          if (i < schema.items.length) validate(schema.items[i], v, rootSchema, path + '[' + i + ']', errs);
          else if (schema.additionalItems === false) errs.push(path + '[' + i + ']: unexpected extra item');
        });
      } else if (schema.items) {
        data.forEach(function (v, i) { validate(schema.items, v, rootSchema, path + '[' + i + ']', errs); });
      }
    }

    if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
      if (schema.required) schema.required.forEach(function (k) {
        if (!(k in data)) errs.push(path + ': missing required "' + k + '"');
      });
      var props = schema.properties || {};
      Object.keys(data).forEach(function (k) {
        if (props[k]) validate(props[k], data[k], rootSchema, path + '.' + k, errs);
        else if (schema.additionalProperties === false) errs.push(path + '.' + k + ': property not allowed');
        else if (schema.additionalProperties && typeof schema.additionalProperties === 'object')
          validate(schema.additionalProperties, data[k], rootSchema, path + '.' + k, errs);
      });
    }
    return errs;
  }

  var api = { validate: function (schema, data) { return validate(schema, data, schema, '$', []); } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AuraSchema = api;
})(typeof self !== 'undefined' ? self : this);
