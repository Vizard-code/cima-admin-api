const axios = require('axios');
const cheerio = require('cheerio');

// دالة للبحث في جوجل وإرجاع أفضل النتائج
async function searchGoogle(query) {
    console.log(`[LOG] Searching for: "${query}"`);
    try {
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const { data } = await axios.get(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });

        const $ = cheerio.load(data);
        const links = [];
        $('.result__url').each((i, element) => {
            // ❗️ تم التعديل: نأخذ أول 5 نتائج فقط لزيادة السرعة
            if (i < 5) { 
                let url = $(element).text().trim();
                if (!url.startsWith('http')) {
                    url = 'https://' + url;
                }
                links.push(url);
            }
        });
        console.log(`[LOG] Found ${links.length} search results.`);
        return links;
    } catch (error) {
        console.error('Error in searchGoogle:', error.message);
        return [];
    }
}

// دالة لزيارة صفحة واستخراج روابط المشاهدة/التحميل
async function scrapePageForLinks(url) {
    console.log(`[LOG] Scraping page: ${url}`);
    try {
        const { data } = await axios.get(url, {
             headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
            timeout: 4000 // ❗️ تم التعديل: تقليل المهلة إلى 4 ثوانٍ
        });

        const $ = cheerio.load(data);
        const foundLinks = new Set(); 

        $('iframe[src]').each((i, element) => {
            const src = $(element).attr('src');
            if (src && (src.includes('embed') || src.includes('player') || src.includes('video'))) {
                foundLinks.add(src);
            }
        });

        $('a[href]').each((i, element) => {
            const href = $(element).attr('href');
            const text = $(element).text().toLowerCase();
            if (href && (text.includes('تحميل') || text.includes('download') || href.match(/\.(mp4|mkv|avi)$/))) {
                foundLinks.add(href);
            }
        });
        
        const pageLinks = Array.from(foundLinks).map(linkUrl => ({
            url: new URL(linkUrl, url).href,
            title: new URL(url).hostname
        }));
        console.log(`[LOG] Found ${pageLinks.length} links on ${url}`);
        return pageLinks;

    } catch (error) {
        console.error(`[WARN] Failed to scrape ${url}:`, error.message);
        return []; // إرجاع مصفوفة فارغة بدلاً من الفشل الكامل
    }
}


module.exports = async (req, res) => {
    const movieTitle = req.query.title;

    if (!movieTitle) {
        return res.status(400).json({ error: 'Movie title is required.' });
    }

    try {
        const searchQuery = `${movieTitle} مشاهدة اون لاين OR تحميل`;
        const googleResults = await searchGoogle(searchQuery);

        if (googleResults.length === 0) {
            return res.status(404).json({ error: 'Could not find search results.' });
        }
        
        const scrapingPromises = googleResults.map(url => scrapePageForLinks(url));
        const resultsFromAllPages = await Promise.all(scrapingPromises);
        const finalResults = resultsFromAllPages.flat();

        if (finalResults.length === 0) {
            console.log(`[LOG] No direct links found for "${movieTitle}".`);
            return res.status(404).json({ results: [], message: 'No direct links found on the top search results.' });
        }

        console.log(`[SUCCESS] Found a total of ${finalResults.length} links for "${movieTitle}".`);
        res.status(200).json({ results: finalResults });

    } catch (error) {
        console.error('Main handler error:', error);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
};

