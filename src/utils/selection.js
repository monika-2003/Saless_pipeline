export function pinSelectedFirst(ids, selectedIds) {
  if (!ids?.length || !selectedIds?.size) return ids
  const selected = []
  const rest = []
  for (const id of ids) {
    if (selectedIds.has(id)) selected.push(id)
    else rest.push(id)
  }
  return selected.length ? selected.concat(rest) : ids
}
