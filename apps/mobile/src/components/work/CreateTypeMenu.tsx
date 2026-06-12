import type { RefObject } from 'react';
import type { View as ViewType } from 'react-native';

import { layout } from '@/theme';
import type { CreatableTypeEntry } from '@drakkar.software/octovault-sdk';
import { useTypeRegistry } from '@/lib/type-registry-context';
import { useResponsive } from '@/lib/use-responsive';
import type { ObjectType } from '@drakkar.software/octovault-sdk';
import { Menu, MenuItem } from '@/components/ui/Menu';
import { Popover } from '@/components/ui/Popover';
import { Sheet } from '@/components/ui/Sheet';

interface CreateTypeMenuProps {
  visible: boolean;
  onClose: () => void;
  anchorRef: RefObject<ViewType | null>;
  onCreate: (type: ObjectType) => void;
  disabled?: boolean;
  /** Defaults to creatableTypes() with editor !== 'file' (file/image need a picker). */
  types?: CreatableTypeEntry[];
  /** Sheet header on narrow screens. */
  title?: string;
}

/**
 * Adaptive create-type picker — Popover on wide screens, Sheet on narrow.
 * Defaults to the workTree-creatable types from the registry (page + board
 * for now; any future creatable type drops in automatically once declared).
 * File/image types are excluded until Phase E wires up the file picker.
 */
export function CreateTypeMenu({
  visible,
  onClose,
  anchorRef,
  onCreate,
  disabled,
  types,
  title = 'Create',
}: CreateTypeMenuProps) {
  const { isWide } = useResponsive();
  const registry = useTypeRegistry();
  const items = types ?? registry.creatableTypes().filter((d) => d.workTree && d.editor !== 'file');

  const body = (
    <Menu>
      {items.map((d) => (
        <MenuItem
          key={d.label}
          icon={d.icon}
          label={d.label}
          disabled={disabled}
          onPress={() => { onClose(); onCreate(d.type); }}
        />
      ))}
    </Menu>
  );

  if (isWide) {
    return (
      <Popover visible={visible} onClose={onClose} anchorRef={anchorRef} placement="top-start" width={layout.popoverWidth}>
        {body}
      </Popover>
    );
  }
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {body}
    </Sheet>
  );
}
