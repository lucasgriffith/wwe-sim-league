/**
 * Fetch wrestler image from Wikidata/Wikimedia Commons.
 * Uses SPARQL to find the wrestler by name, then gets their P18 (image) property.
 */

const WIKIDATA_SPARQL = "https://query.wikidata.org/sparql";

interface WikidataResult {
  imageUrl: string | null;
  wikidataId: string | null;
}

export async function fetchWrestlerImage(
  wrestlerName: string
): Promise<WikidataResult> {
  // Clean up the name for search (remove "The" prefix, etc.)
  const searchName = wrestlerName
    .replace(/^The\s+/i, "")
    .replace(/\s+Jr\.?$/i, " Jr.");

  const query = `
    SELECT ?wrestler ?image WHERE {
      ?wrestler rdfs:label "${searchName}"@en .
      ?wrestler wdt:P106 wd:Q13474373 .
      ?wrestler wdt:P18 ?image .
    }
    LIMIT 1
  `;

  try {
    const url = `${WIKIDATA_SPARQL}?query=${encodeURIComponent(query)}&format=json`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/sparql-results+json",
        "User-Agent": "WWE-Sim-League/1.0",
      },
    });

    if (!response.ok) return { imageUrl: null, wikidataId: null };

    const data = await response.json();
    const bindings = data?.results?.bindings;

    if (bindings && bindings.length > 0) {
      const imageUrl = bindings[0].image?.value ?? null;
      const wikidataId = bindings[0].wrestler?.value?.split("/").pop() ?? null;

      // Convert Wikimedia Commons file URL to thumbnail
      if (imageUrl) {
        const thumbUrl = getWikimediaThumbnail(imageUrl, 200);
        return { imageUrl: thumbUrl, wikidataId };
      }
    }

    // Try a broader search with just the name as label
    return await fetchWrestlerImageBroadSearch(searchName);
  } catch {
    return { imageUrl: null, wikidataId: null };
  }
}

async function fetchWrestlerImageBroadSearch(
  name: string
): Promise<WikidataResult> {
  // Search using the Wikidata search API
  try {
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&limit=5&format=json&origin=*`;
    const searchRes = await fetch(searchUrl, {
      headers: { "User-Agent": "WWE-Sim-League/1.0" },
    });

    if (!searchRes.ok) return { imageUrl: null, wikidataId: null };

    const searchData = await searchRes.json();
    const entities = searchData?.search ?? [];

    // Try each result to find one with an image
    for (const entity of entities) {
      const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${entity.id}&property=P18&format=json&origin=*`;
      const entityRes = await fetch(entityUrl, {
        headers: { "User-Agent": "WWE-Sim-League/1.0" },
      });

      if (!entityRes.ok) continue;

      const entityData = await entityRes.json();
      const claims = entityData?.claims?.P18;

      if (claims && claims.length > 0) {
        const filename = claims[0]?.mainsnak?.datavalue?.value;
        if (filename) {
          const imageUrl = getWikimediaImageUrl(filename);
          const thumbUrl = getWikimediaThumbnail(imageUrl, 200);
          return { imageUrl: thumbUrl, wikidataId: entity.id };
        }
      }
    }

    return { imageUrl: null, wikidataId: null };
  } catch {
    return { imageUrl: null, wikidataId: null };
  }
}

function getWikimediaImageUrl(filename: string): string {
  const encodedName = encodeURIComponent(filename.replace(/ /g, "_"));
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodedName}`;
}

function getWikimediaThumbnail(
  fileUrl: string,
  width: number = 200
): string {
  // If it's already a FilePath URL, add width parameter
  if (fileUrl.includes("Special:FilePath")) {
    return `${fileUrl}?width=${width}`;
  }
  // For direct commons URLs
  return fileUrl;
}

/**
 * Batch fetch images for multiple wrestlers.
 * Returns a map of wrestlerName -> imageUrl.
 */
export async function batchFetchWrestlerImages(
  names: string[]
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  // Process in batches of 5 to avoid rate limiting
  for (let i = 0; i < names.length; i += 5) {
    const batch = names.slice(i, i + 5);
    const promises = batch.map(async (name) => {
      const result = await fetchWrestlerImage(name);
      if (result.imageUrl) {
        results.set(name, result.imageUrl);
      }
    });
    await Promise.all(promises);

    // Small delay between batches
    if (i + 5 < names.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return results;
}
