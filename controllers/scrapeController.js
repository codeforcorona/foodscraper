const featured_restaurants = new Set();
const Restaurant = require('../models/Restaurant');
const request = require('request');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

const deliverooUrl = 'https://deliveroo.com.sg';
const foodPandaUrl = 'https://foodpanda.sg';

const navigateByPostalCode = async (page, url, postalCode) => {
    await page.goto(url);

    await page.focus('input[id="delivery-information-postal-index"]');
    await page.keyboard.type(postalCode);
    await page.evaluate(() => {
        document.querySelectorAll('button')[3].click();
    });

    await page.waitForNavigation();
};

const navigateBySearch = async(page, searchPhrase) => {
    await page.evaluate(() => document.querySelector('button[class="search-clear hide"]').click());
    await page.waitForSelector('input[class="restaurants-search-input"]');
    await page.focus('input[class="restaurants-search-input"]');
    await page.keyboard.type(searchPhrase);
    await page.waitFor(3000);
};

const scrapeRestaurants = async page => {
    const output = await page.evaluate(() => {
        //const tile = document.querySelector('figure[class^="vendor-tile"]');
        const tiles = document.querySelectorAll('figure[class^="vendor-tile"]');
        return Array.from(tiles).map(tile => {
            const imageurl = tile.querySelector('div[class^="vendor-picture"]').getAttribute('data-src');
            const timeaway = tile.querySelector('span[class="badge-info"]').innerText;
            return {
                company: "Food Panda",
                restaurant: tile.querySelector('span[class^="name fn"]').innerText,
                imageurl: imageurl.split('|')[1],
                timeaway: timeaway.replace(/\D/g,'')
            }
        })
            .filter(elem => elem.timeaway.length === 2);
    });
    console.log(output);
    return output;

};

exports.getDeliveroFeatured = async (req, res, body) => {
    console.log("reached getFeatured");
    const postalCode = "119618";
    console.log(postalCode);

    const browser = await puppeteer.launch({ headless : false});
    const page = await browser.newPage();

    await page.goto(deliverooUrl);

    await page.focus('input[id="location-search"]');
    await page.keyboard.type(postalCode);
    await page.keyboard.press('Enter');

    console.log(page.url());
    await page.waitForNavigation();

    await page.waitForSelector('button[aria-label="Close"]')
        .then(() => page.click('button[aria-label="Close"]'));

    console.log("after closing popup");

    const output = [];
    const cards = await page.$$('a[class^=HomeFeedUICard', elem => elem);

    for (const card of cards) {
        output.push(await page.evaluate(elem =>
                new Restaurant("Deliveroo", elem.getAttribute('aria-label'),
                    elem.find('div[style^="background-image"]'), elem))
            , card);
    }
    console.log(output);
};

exports.postFoodPandaFeatured = async (req, res, next) => {
    console.log("reached getFeatured");
    const postalCode = req.body.postalCode;

    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();

    await navigateByPostalCode(page, foodPandaUrl, postalCode);

    res.send(await scrapeRestaurants(page));

};

exports.postSearch = async (req, res, next) => {
    const postalCode = req.body.postalCode;
    const searchPhrase = req.body.searchPhrase;

    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();

    await navigateByPostalCode(page, foodPandaUrl, postalCode);
    await navigateBySearch(page, searchPhrase);

    res.send(await scrapeRestaurants(page));

};
