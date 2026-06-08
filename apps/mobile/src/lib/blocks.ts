/**
 * Block-type presentation table — the single source of truth for how each
 * {@link BlockType} renders and reads in the page editor (see {@link PageView}).
 *
 * Keeps the editor component declarative: instead of inline `switch`/`if` on the
 * type for the label, leading icon, text variant, mono-ness and multiline-ness,
 * components look these up here. Also carries the Markdown shortcut prefix
 * (`mdPrefix`) and the slash-menu glyph so the block-type menu and the typing
 * shortcuts share ONE definition.
 */
import type { IconName } from '@/components/ui/Icon';
import type { type as typeScale } from '@/theme';

import type { BlockType } from './use-page';

/** A {@link BlockType}'s presentation: how it reads and which editor it uses. */
export interface BlockTypeDef {
  type: BlockType;
  /** Menu label + empty-block placeholder. */
  label: string;
  /** Glyph in the block-type / slash menu and (where shown) the gutter. */
  icon: IconName;
  /** Type-scale step the block's text renders at (also the editor's `textVariant`). */
  variant: keyof typeof typeScale;
  /** Render the text in JetBrains Mono (code blocks). */
  mono: boolean;
  /** Editor allows newlines (Enter is a newline, not close). */
  multiline: boolean;
  /** Start-of-line Markdown shortcut that converts an empty block to this type. */
  mdPrefix?: string;
}

/**
 * Every block type, in the order they appear in the block-type / slash menu.
 * `divider` is included for the menu but renders as a rule (no text editor).
 */
export const BLOCK_TYPES: BlockTypeDef[] = [
  { type: 'paragraph', label: 'Text', icon: 'text', variant: 'body', mono: false, multiline: true },
  { type: 'heading', label: 'Heading', icon: 'heading', variant: 'title', mono: false, multiline: false, mdPrefix: '# ' },
  { type: 'subheading', label: 'Subheading', icon: 'subheading', variant: 'heading', mono: false, multiline: false, mdPrefix: '## ' },
  { type: 'todo', label: 'To-do', icon: 'todo', variant: 'body', mono: false, multiline: false, mdPrefix: '[] ' },
  { type: 'bulleted', label: 'Bulleted list', icon: 'list', variant: 'body', mono: false, multiline: false, mdPrefix: '- ' },
  { type: 'numbered', label: 'Numbered list', icon: 'list-numbered', variant: 'body', mono: false, multiline: false, mdPrefix: '1. ' },
  { type: 'toggle', label: 'Toggle', icon: 'chev', variant: 'body', mono: false, multiline: false, mdPrefix: '> ' },
  { type: 'quote', label: 'Quote', icon: 'quote', variant: 'body', mono: false, multiline: true },
  { type: 'code', label: 'Code', icon: 'code', variant: 'callout', mono: true, multiline: true, mdPrefix: '``` ' },
  { type: 'divider', label: 'Divider', icon: 'minus', variant: 'body', mono: false, multiline: false },
];

const BY_TYPE: Record<BlockType, BlockTypeDef> = BLOCK_TYPES.reduce(
  (acc, def) => {
    acc[def.type] = def;
    return acc;
  },
  {} as Record<BlockType, BlockTypeDef>,
);

/** The full presentation def for a block type. */
export function blockDef(type: BlockType): BlockTypeDef {
  return BY_TYPE[type] ?? BY_TYPE.paragraph;
}

export const labelFor = (type: BlockType): string => blockDef(type).label;
export const iconFor = (type: BlockType): IconName => blockDef(type).icon;
export const variantFor = (type: BlockType): keyof typeof typeScale => blockDef(type).variant;
export const monoFor = (type: BlockType): boolean => blockDef(type).mono;
export const isMultiline = (type: BlockType): boolean => blockDef(type).multiline;

/**
 * Resolve a start-of-line Markdown shortcut: if `text` is exactly a known prefix
 * (e.g. `"# "`, `"- "`, `"[] "`), return the {@link BlockType} it converts to.
 * Matched on the *trimmed-trailing* form so the user can type "# " or "#·" alike.
 */
export function mdShortcut(text: string): BlockType | undefined {
  for (const def of BLOCK_TYPES) {
    if (def.mdPrefix && text === def.mdPrefix) return def.type;
  }
  return undefined;
}
