/** Coloca Viola no início para viola caipira, preservando a ordem dentro de cada prioridade. */
export function sortVersionsForInstrument<T extends { version_name?: string }>(
  versions: readonly T[],
  instrumentId: string,
  { preferPrincipal = false } = {},
): readonly T[] {
  if (versions.length < 2 || (instrumentId !== 'viola' && !preferPrincipal)) return versions;

  const priority = (version: T) => {
    const name = version.version_name?.toLowerCase() ?? '';
    if (instrumentId === 'viola' && name === 'viola') return 2;
    return preferPrincipal && name.includes('principal') ? 1 : 0;
  };

  return [...versions].sort((a, b) => priority(b) - priority(a));
}
