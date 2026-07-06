---
name: Sed-based JSX attribute substitution breaks syntax
description: Regex/sed replacement of quoted JSX attribute values with identifier expressions produces invalid JSX unless braces are added.
---

Replacing a quoted JSX attribute value (e.g. `color="#EF4444"`) with an identifier/expression (e.g. a semantic token `Colors.error`) via sed/regex must wrap the replacement in `{}`. A naive substitution produces `color=Colors.error`, which is invalid JSX (looks like a bare identifier, not a string or expression) and fails to compile.

**Why:** During a bulk hex-color-to-token sweep across ~10 files, `attr="#HEX"` → `attr=Colors.token` sed replacements silently produced broken JSX. It only surfaced via `tsc --noEmit`, not visually.

**How to apply:** After any bulk find/replace that changes a JSX attribute's value from a string literal to an identifier or expression, immediately grep for the broken pattern (e.g. `=Identifier.path` with no leading `{`) across the affected files and run `tsc --noEmit` before considering the sweep done.

**Related lesson — hardcoded hex color sweeps miss case variants:** a grep for lowercase hex codes (`"#ef4444"`) will miss uppercase-hex or theme-object (`theme.error` vs `Colors.error`) variants of the same value. Before declaring a hex-to-token sweep complete, grep case-insensitively (`-i`) for all target hex codes across the whole tree, not just the files already touched.
