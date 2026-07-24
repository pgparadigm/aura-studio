#!/usr/bin/env python3
"""Headless JSON-Schema (draft-07 subset) validator for .aura files.

An independent second implementation of fixtures/schema-validate.js, supporting exactly the
keywords aura-project.schema.json uses. Running both over the same corpus cross-checks the
schema itself: if the two disagree on any fixture, one of them is wrong.

  python3 fixtures/validate.py                     # run the fixture corpus
  python3 fixtures/validate.py path/to/file.aura   # validate one file
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEMA_PATH = os.path.join(ROOT, "aura-project.schema.json")
FIXTURES = os.path.join(ROOT, "fixtures")


def type_ok(t, v):
    if t == "integer":  return isinstance(v, int) and not isinstance(v, bool)
    if t == "number":   return isinstance(v, (int, float)) and not isinstance(v, bool)
    if t == "string":   return isinstance(v, str)
    if t == "boolean":  return isinstance(v, bool)
    if t == "array":    return isinstance(v, list)
    if t == "object":   return isinstance(v, dict)
    if t == "null":     return v is None
    return False


def resolve(root, ref):
    cur = root
    for part in ref.lstrip("#/").split("/"):
        cur = cur.get(part, {}) if isinstance(cur, dict) else {}
    return cur or {}


def validate(schema, data, root=None, path="$", errs=None):
    if errs is None: errs = []
    if root is None: root = schema
    if "$ref" in schema:
        schema = resolve(root, schema["$ref"])

    if "type" in schema:
        types = schema["type"] if isinstance(schema["type"], list) else [schema["type"]]
        if not any(type_ok(t, data) for t in types):
            errs.append(f"{path}: expected {' | '.join(types)}")
            return errs

    if "const" in schema and data != schema["const"]:
        errs.append(f"{path}: must equal {json.dumps(schema['const'])}")
    if "enum" in schema and data not in schema["enum"]:
        errs.append(f"{path}: {json.dumps(data)} not one of {json.dumps(schema['enum'])}")

    if isinstance(data, (int, float)) and not isinstance(data, bool):
        if "minimum" in schema and data < schema["minimum"]:
            errs.append(f"{path}: {data} < minimum {schema['minimum']}")
        if "maximum" in schema and data > schema["maximum"]:
            errs.append(f"{path}: {data} > maximum {schema['maximum']}")

    if isinstance(data, list):
        if "minItems" in schema and len(data) < schema["minItems"]:
            errs.append(f"{path}: {len(data)} items < minItems {schema['minItems']}")
        if "maxItems" in schema and len(data) > schema["maxItems"]:
            errs.append(f"{path}: {len(data)} items > maxItems {schema['maxItems']}")
        items = schema.get("items")
        if isinstance(items, list):  # tuple form
            for i, v in enumerate(data):
                if i < len(items):
                    validate(items[i], v, root, f"{path}[{i}]", errs)
                elif schema.get("additionalItems") is False:
                    errs.append(f"{path}[{i}]: unexpected extra item")
        elif isinstance(items, dict):
            for i, v in enumerate(data):
                validate(items, v, root, f"{path}[{i}]", errs)

    if isinstance(data, dict):
        for k in schema.get("required", []):
            if k not in data:
                errs.append(f'{path}: missing required "{k}"')
        props = schema.get("properties", {})
        addl = schema.get("additionalProperties", True)
        for k, v in data.items():
            if k in props:
                validate(props[k], v, root, f"{path}.{k}", errs)
            elif addl is False:
                errs.append(f"{path}.{k}: property not allowed")
            elif isinstance(addl, dict):
                validate(addl, v, root, f"{path}.{k}", errs)
    return errs


def check(schema, path):
    """Returns (verdict, errors) where verdict is 'pass' or 'fail'."""
    try:
        with open(path, "rb") as f:
            data = json.loads(f.read().decode("utf-8"))
    except Exception as e:
        return "fail", [f"not valid JSON: {e}"]
    errs = validate(schema, data)
    return ("pass" if not errs else "fail"), errs


# fixture -> expected verdict (must match fixtures/test.html)
CASES = [
    ("complete.aura", "pass"), ("empty.aura", "pass"), ("unknown-fields.aura", "pass"),
    ("future-schema.aura", "fail"), ("malformed.aura", "fail"), ("oob-tempo.aura", "fail"),
    ("invalid-mode.aura", "fail"), ("bad-section-count.aura", "fail"),
    ("bad-arrangement-length.aura", "fail"), ("invalid-note-tuple.aura", "fail"),
    ("embedded-media.aura", "fail"), ("legacy-v12.aura", "fail"),
]


def main():
    schema = json.load(open(SCHEMA_PATH))
    if len(sys.argv) > 1:
        rc = 0
        for target in sys.argv[1:]:
            verdict, errs = check(schema, target)
            print(f"{verdict.upper():5} {target}")
            for e in errs: print("        • " + e)
            if verdict == "fail": rc = 1
        return rc

    passed = 0
    for name, expect in CASES:
        verdict, errs = check(schema, os.path.join(FIXTURES, name))
        good = verdict == expect
        passed += good
        print(f"{'✓' if good else '✗'} {name:30} expect={expect:4} actual={verdict:4}")
        if not good:
            for e in errs[:4]: print("      • " + e)
    print(f"\n{passed}/{len(CASES)} fixture tests passed")
    return 0 if passed == len(CASES) else 1


if __name__ == "__main__":
    sys.exit(main())
