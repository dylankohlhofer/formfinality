// A pack is a selection of existing scenarios, not another execution pipeline.
export function selectPack(pack, scenarios, id) {
  if (!/^[a-z0-9-]+$/.test(id || '') || pack?.schema !== 1 || pack.id !== id ||
      typeof pack.description !== 'string' || !pack.description.trim() ||
      !Array.isArray(pack.scenarios) || !pack.scenarios.length ||
      !pack.scenarios.every(s => typeof s === 'string' && /^[a-z0-9-]+$/.test(s)) ||
      new Set(pack.scenarios).size !== pack.scenarios.length ||
      !Array.isArray(pack.limitations) || !pack.limitations.length ||
      !pack.limitations.every(s => typeof s === 'string' && s.trim())) throw new Error('Invalid scenario pack');
  return pack.scenarios.map(id => {
    const matching = scenarios.filter(s => s.id === id);
    if (matching.length !== 1) throw new Error(`Pack scenario must resolve exactly once: ${id}`);
    return matching[0];
  });
}
