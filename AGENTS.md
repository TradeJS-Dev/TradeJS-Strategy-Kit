# AGENTS.md

## Scope

These rules apply to the complete `TradeJS-Strategy-Kit` repository.

## Purpose

This package owns browser-safe, strategy-neutral helpers used by independently
versioned TradeJS strategy packages.

## Boundaries

- Keep the public API subpath-only; do not add a root export.
- Depend only on public `@tradejs/core/*` subpaths and `@tradejs/types`.
- Do not add strategy registries, individual detector behavior, infrastructure,
  storage, networking, AI providers, or order placement.
- A helper belongs here only when at least two unrelated strategy packages can
  use the same contract without strategy-name branches.
- Keep strategy-family mechanics in the family strategy repository. In
  particular, TrendLine and ReverseTrendLine share their mechanics in
  `TradeJS-Strategy-TrendLine`, not here.

## Verification

Run `yarn checks` before every commit. Reusable CI and publish behavior is owned
by `TradeJS-Workflows`; keep this repository's workflow files as thin callers.
