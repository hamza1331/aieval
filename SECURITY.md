# Security Policy

## Supported versions

Security fixes are applied to the latest released minor version.

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Email **hamxa1331@gmail.com** with a description, steps
to reproduce, and the affected version. You can expect an acknowledgement within a few days and a fix or mitigation
plan as soon as practical.

## Notes for users

`aieval` runs only the checks you give it. Regular-expression checks (`regexCheck` and the `regex` fixture type) run
the pattern you supply against model output; avoid patterns prone to catastrophic backtracking when validating
untrusted input. Fixture files and `--checks` files are data, never executed as code.
