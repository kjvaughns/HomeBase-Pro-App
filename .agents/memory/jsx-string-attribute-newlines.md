---
name: JSX string-attribute newlines
description: Why \n inside a plain JSX string attribute renders as literal backslash-n instead of a line break
---

`headline="line one\nline two"` as a plain double-quoted JSX attribute does NOT
interpret `\n` as a newline character — JSX attribute string literals are not
JS string literals, so the backslash-n stays literal text in the DOM (visible
even with `whitespace-pre-wrap` on the container).

**Why:** JSX only parses escape sequences inside `{...}` expression children/attributes,
which are real JS. A bare `attr="..."` value is treated as a raw JSX text literal.

**How to apply:** Any multi-line copy passed as a JSX attribute must be wrapped in an
expression: `headline={'line one\nline two'}` (or a template literal `{`...`}`).
When auditing/reviewing generated scene or copy components for a video/animation
build, grep for `="[^"]*\\n` patterns in attribute values — they are a reliable sign
of this bug.
