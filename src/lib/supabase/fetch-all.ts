/**
 * PostgREST caps every response at 1000 rows (Supabase's default max-rows) and
 * truncates silently, so any select that can grow past that has to be paged.
 *
 * Pass a function that builds the query for one page. It must apply a stable,
 * unique ordering (end with `.order("id")`) so pages neither overlap nor skip
 * rows, and finish with `.range(from, to)`:
 *
 *   const matches = await fetchAllRows((from, to) =>
 *     client.from("matches").select("*").order("id").range(from, to)
 *   );
 *
 * Throws on any page error rather than returning a partial set: a truncated
 * table is exactly the failure this exists to prevent.
 */

export const PAGE_SIZE = 1000;

interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}
