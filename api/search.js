// --- Advanced Link Scraper API using Puppeteer on Vercel ---
// This file should be placed in the /api directory of your Vercel project.
// For example: /api/search.js

// We use puppeteer-core which is a lightweight version of Puppeteer.
// chrome-aws-lambda is a special package that makes Chromium work on Vercel's environment.
const puppeteer = require('puppeteer-core');
const chrome = require('chrome-aws-lambda');

// This is the main function that Vercel will run.
export default async function handler(request, response) {
  // --- Security: Set CORS headers to allow your admin panel to call this API ---
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*'); // Or replace * with your admin panel's domain for more security
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  // Handle preflight requests for CORS
  if (request.method === 'OPTIONS') {
    response.status(200).end();
    return;
  }

  let browser = null;

  try {
    // --- Get the movie title from the request URL ---
    // Example request: /api/search?title=Inception
    const movieTitle = request.query.title;
    if (!movieTitle) {
      return response.status(400).json({ error: 'Movie title is required.' });
    }

    // --- Launch the headless browser ---
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      args: chrome.args,
      executablePath: await chrome.executablePath,
      headless: chrome.headless,
    });
    
    const page = await browser.newPage();
    // Set a realistic user agent to avoid being blocked
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');


    // --- Perform the search on a search engine ---
    console.log(`Navigating to Google for movie: ${movieTitle}`);
    // We will search for a specific site, for example, "akoam" to get direct links.
    // You can change this to any search query you prefer.
    const searchQuery = `${movieTitle} موقع ايموشن فيديو`;
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`);
    
    // --- Scrape the search results ---
    console.log('Scraping search results...');
    
    // This code runs inside the browser context
    const links = await page.evaluate(() => {
      const results = [];
      // Select all the search result links from Google
      const items = document.querySelectorAll('div.g a');
      items.forEach(item => {
        // We only want links that lead to the target site and have a title
        if (item.href && item.querySelector('h3')) {
          results.push({
            title: item.querySelector('h3').innerText,
            url: item.href,
          });
        }
      });
      // Return the first 5 results
      return results.slice(0, 5);
    });

    console.log('Found links:', links);
    
    // --- TODO: Visit each link and find the actual download/watch links ---
    // This part is more complex as each site has a different structure.
    // For now, we will just return the search results.
    // You would add a loop here: for (const link of links) { await page.goto(link.url); ...scrape... }


    // --- Send the results back to your admin panel ---
    response.status(200).json({
      message: `Found ${links.length} potential pages.`,
      results: links,
    });

  } catch (error) {
    console.error('Error during scraping:', error);
    response.status(500).json({ error: 'Failed to scrape links.', details: error.message });
  } finally {
    // --- ALWAYS close the browser to free up resources ---
    if (browser !== null) {
      console.log('Closing browser...');
      await browser.close();
    }
  }
}
