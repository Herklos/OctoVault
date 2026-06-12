/**
 * Text size-scale variant names — mirrors the keys of the `type` const in
 * `apps/mobile/src/theme.ts`. Defined here so non-UI SDK modules (blocks,
 * page-model) can carry the variant as data without importing @/theme.
 */
export type TextVariant =
  | 'pageTitle'
  | 'display'
  | 'title'
  | 'heading'
  | 'subhead'
  | 'body'
  | 'callout'
  | 'footnote'
  | 'caption'
  | 'micro';
