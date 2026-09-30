// Pure helpers for moving items within the playlist tree.
//
// A drop onto a dragged item's own descendant would splice the group into
// itself; the resulting cycle makes JSON.stringify throw and every later save
// fail. These helpers let the drop handler refuse such moves before mutating.

interface TreeNode {
  uuid: string;
  type: string;
  children?: TreeNode[];
}

// Chain of items from the root down to (and including) the item with `uuid`,
// or null when it is not in the tree.
export function findPathToUuid<T extends TreeNode>(items: T[], uuid: string): T[] | null {
  for (const item of items) {
    if (item.uuid === uuid) return [item];
    if (item.type === 'group' && item.children) {
      const sub = findPathToUuid(item.children as T[], uuid);
      if (sub) return [item, ...sub];
    }
  }
  return null;
}

// True when `uuid` is `ancestorUuid` itself or lies anywhere inside it.
export function isSelfOrDescendant(items: TreeNode[], ancestorUuid: string, uuid: string): boolean {
  const path = findPathToUuid(items, uuid);
  return !!path && path.some(node => node.uuid === ancestorUuid);
}

// Drops every uuid whose ancestor is also being moved (it travels inside that
// ancestor), and unknown or duplicate uuids. Result is in tree order.
export function normalizeMoveSet(items: TreeNode[], uuids: string[]): string[] {
  const wanted = new Set(uuids);
  const result: string[] = [];
  const walk = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (wanted.has(node.uuid)) {
        result.push(node.uuid);
        continue; // descendants move with this node
      }
      if (node.type === 'group' && node.children) walk(node.children);
    }
  };
  walk(items);
  return result;
}

// False when the drop target is one of the moving items or inside one of them.
export function canDropOnto(items: TreeNode[], movingUuids: string[], targetUuid: string): boolean {
  const path = findPathToUuid(items, targetUuid);
  if (!path) return false;
  const moving = new Set(movingUuids);
  return !path.some(node => moving.has(node.uuid));
}
