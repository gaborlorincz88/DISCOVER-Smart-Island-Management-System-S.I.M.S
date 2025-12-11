
import { Place, PlaceCategory } from "../types";

const WIKIMEDIA_API_URL = "https://en.wikipedia.org/w/api.php";

interface WikipediaInfo {
  imageUrl?: string;
  galleryImages?: string[];
  wikipediaUrl?: string;
}

// Keyword definitions for smart image ranking
const CATEGORY_KEYWORDS: { [key in PlaceCategory]?: { positive: string[], negative: string[] } } = {
    [PlaceCategory.DIVING]: {
        positive: ['underwater', 'wreck', 'scuba', 'diving', 'dive', 'diver'],
        negative: ['on the surface', 'boat', 'ship', 'yacht', 'ferry'],
    },
    [PlaceCategory.VIEWPOINT]: {
        positive: ['view', 'panorama', 'lookout', 'vista', 'skyline'],
        negative: ['map', 'sign'],
    },
    [PlaceCategory.LANDSCAPE]: {
        positive: ['landscape', 'mountain', 'valley', 'canyon', 'sunrise', 'sunset', 'peak', 'ridge'],
        negative: ['map', 'diagram', 'people'],
    },
    [PlaceCategory.HISTORICAL]: {
        positive: ['exterior', 'facade', 'building', 'castle', 'tower', 'church', 'ruins'],
        negative: ['interior', 'map', 'portrait', 'artifact', 'painting', 'sculpture'],
    },
    [PlaceCategory.ART_CULTURE]: {
        positive: ['exterior', 'facade', 'building', 'entrance', 'theater'],
        negative: ['map', 'diagram', 'close-up', 'painting', 'sculpture', 'artifact'],
    },
    [PlaceCategory.NATURE]: {
        positive: ['trail', 'forest', 'tree', 'flower', 'fauna', 'river', 'lake', 'spring', 'cave'],
        negative: ['map', 'signpost', 'diagram'],
    },
    [PlaceCategory.BEACH]: {
        positive: ['beach', 'sand', 'coast', 'ocean', 'sea', 'shore', 'waves'],
        negative: ['map', 'sign', 'people', 'portrait', 'street'],
    },
    [PlaceCategory.PUBLIC_TOILET]: {
        positive: ['building', 'exterior', 'facade'],
        negative: ['map', 'diagram', 'sign', 'interior'],
    },
};

const GENERAL_NEGATIVE_KEYWORDS = ['map', 'diagram', 'chart', 'plan', 'coat of arms', 'flag', 'logo', 'schema', 'location', 'locator', 'button', 'badge', 'emblem', 'seal'];


const fetchJson = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Wikimedia API responded with status ${response.status}`);
  }
  return response.json();
};

const findPageByGeoSearch = async (place: Place): Promise<string | null> => {
  const params = new URLSearchParams({
    action: "query",
    list: "geosearch",
    gscoord: `${place.coordinates.lat}|${place.coordinates.lng}`,
    gsradius: "1000",
    gslimit: "5",
    format: "json",
    origin: "*",
  });
  const data = await fetchJson(`${WIKIMEDIA_API_URL}?${params.toString()}`);
  if (!data.query.geosearch || data.query.geosearch.length === 0) return null;

  const bestMatch = data.query.geosearch.find((result: any) => 
    result.title.toLowerCase().includes(place.name.toLowerCase())
  );

  return bestMatch ? bestMatch.title : data.query.geosearch[0].title;
};

const findPageByTextSearch = async (placeName: string): Promise<string | null> => {
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: placeName,
    limit: "1",
    format: "json",
    origin: "*",
  });
  const data = await fetchJson(`${WIKIMEDIA_API_URL}?${params.toString()}`);
  if (!data.query.search || data.query.search.length === 0) return null;
  return data.query.search[0].title;
};

const fetchMediaForPage = async (pageTitle: string, placeCategory: PlaceCategory): Promise<WikipediaInfo> => {
  const params = new URLSearchParams({
    action: "query",
    titles: pageTitle,
    prop: "pageimages|images|info",
    piprop: "thumbnail",
    pithumbsize: "800",
    inprop: "url",
    format: "json",
    origin: "*",
    imlimit: "max",
  });

  const data = await fetchJson(`${WIKIMEDIA_API_URL}?${params.toString()}`);
  
  // Guard against malformed API responses to prevent crashes.
  if (!data?.query?.pages) {
    console.error("Unexpected response structure from Wikimedia API for page:", pageTitle, data);
    return {};
  }
  
  const pageId = Object.keys(data.query.pages)[0];
  const page = data.query.pages[pageId];

  if (!page || pageId === '-1') return {};

  const officialImageUrl = page.thumbnail?.source;
  const wikipediaUrl = page.fullurl;
  
  const imageTitles = page.images?.map((img: any) => img.title)
    .filter((title: string) => /\.(jpg|jpeg|png)$/i.test(title));

  let galleryImages: {url: string; title: string}[] = [];
  if (imageTitles && imageTitles.length > 0) {
    const galleryParams = new URLSearchParams({
        action: 'query',
        titles: imageTitles.join('|'),
        prop: 'imageinfo',
        iiprop: 'url',
        iiurlwidth: '800',
        format: 'json',
        origin: '*',
    });
    const galleryData = await fetchJson(`${WIKIMEDIA_API_URL}?${galleryParams.toString()}`);
    
    // Also guard the gallery response to prevent crashes.
    if (galleryData?.query?.pages) {
        galleryImages = Object.values(galleryData.query.pages)
            .map((p: any) => ({
                url: p.imageinfo?.[0]?.thumburl,
                title: p.title || ''
            }))
            .filter((info): info is {url: string; title: string} => !!info.url);
    } else {
        console.warn("Could not fetch gallery images from Wikimedia for page:", pageTitle);
    }
  }

  const getScore = (title: string, category: PlaceCategory): number => {
      let score = 0;
      const lowerTitle = title.toLowerCase();
      
      if (GENERAL_NEGATIVE_KEYWORDS.some(kw => lowerTitle.includes(kw))) {
          score -= 100;
      }

      const categoryKeywords = CATEGORY_KEYWORDS[category];
      if (categoryKeywords) {
          if (categoryKeywords.positive.some(kw => lowerTitle.includes(kw))) score += 50;
          if (categoryKeywords.negative.some(kw => lowerTitle.includes(kw))) score -= 50;
      }
      return score;
  };
    
  const scoredImages = galleryImages.map(info => ({
      ...info,
      score: getScore(info.title, placeCategory),
  })).sort((a, b) => b.score - a.score);

  let finalGalleryUrls: string[] = [];
  let finalImageUrl: string | undefined;

  if (placeCategory === PlaceCategory.DIVING) {
      // Strict filtering: only accept images with positive scores for diving.
      const divingImages = scoredImages.filter(img => img.score > 0);
      finalGalleryUrls = divingImages.map(img => img.url);
      finalImageUrl = finalGalleryUrls[0]; // The best underwater shot, or undefined if none found.
  } else {
      // Standard logic for other categories
      finalGalleryUrls = scoredImages.map(info => info.url);
      finalImageUrl = officialImageUrl;
      
      const bestGalleryImage = scoredImages[0];
      if (!finalImageUrl && bestGalleryImage) {
          finalImageUrl = bestGalleryImage.url;
      }

      if (finalImageUrl) {
          finalGalleryUrls = finalGalleryUrls.filter(gUrl => gUrl !== finalImageUrl);
          finalGalleryUrls.unshift(finalImageUrl);
      }
  }

  const uniqueGalleryImages = Array.from(new Set(finalGalleryUrls));

  return { imageUrl: finalImageUrl, galleryImages: uniqueGalleryImages, wikipediaUrl };
};

export const fetchWikipediaInfo = async (place: Place): Promise<WikipediaInfo> => {
  try {
    let pageTitle = await findPageByGeoSearch(place);
    
    if (!pageTitle) {
      pageTitle = await findPageByTextSearch(place.name);
    }
    
    if (!pageTitle) {
      console.log(`No Wikipedia page found for "${place.name}".`);
      return {};
    }

    return await fetchMediaForPage(pageTitle, place.category);

  } catch (error) {
    console.error("Error fetching Wikipedia info:", error);
    return {};
  }
};
