// Formatage des dates exposées par l'API. Les dates restent stockées en ISO
// 8601 en interne (tri chronologique fiable, pas d'ambiguïté) ; ce formatage
// n'intervient qu'à la sortie, juste avant de renvoyer une réponse JSON.
// UTC est utilisé (pas l'heure locale du serveur) pour que le format ne
// dépende pas d'où le serveur est déployé.
export function formatDate(iso: string, withTime = true): string {
  const date = new Date(iso);

  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = date.getUTCFullYear();

  if (!withTime) return `${dd}-${mm}-${yyyy}`;

  const hh = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
}
