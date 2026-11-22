export async function fetchJikanNews(anilistId: number, malId?: number | null): Promise<any[]> {
  try {
    const qs = malId ? `?malId=${malId}` : '';
    const response = await fetch(`/api/anime/${anilistId}/news${qs}`);
    if (!response.ok) return [];
    const json = await response.json();
    return json.articles || [];
  } catch {
    return [];
  }
}
