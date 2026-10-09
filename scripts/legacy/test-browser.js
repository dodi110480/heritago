const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    console.log("Starte Puppeteer...");
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    page.on('console', msg => {
        if (msg.type() === 'error') console.log('PAGE ERROR LOG:', msg.text());
        else console.log('PAGE LOG:', msg.text());
    });
    page.on('pageerror', error => console.log('PAGE UNCAUGHT ERROR:', error.message));

    console.log("Navigiere zu http://localhost:4200...");
    await page.goto('http://localhost:4200', { waitUntil: 'networkidle2' });
    
    // Prüfe ob Login erforderlich ist
    const bodyText = await page.evaluate(() => document.body.innerText);
    if (bodyText.includes('Willkommen') || bodyText.includes('Passwort')) {
        console.log("Führe Login durch...");
        await page.type('input[type="password"]', 'root');
        await page.click('button[type="submit"], .btn-primary');
        await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
        await new Promise(r => setTimeout(r, 1000));
    }

    console.log("Navigiere zu /media...");
    await page.goto('http://localhost:4200/media', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    
    const bodyHtml = await page.evaluate(() => document.body.innerHTML);
    if (!bodyHtml.includes('app-list-view')) {
        console.log(`Media Body HTML (Erste 2000 Zeichen):\n${bodyHtml.substring(0, 2000)}`);
    }

    const listViewHtml = await page.evaluate(() => {
        const lv = document.querySelector('app-list-view');
        return lv ? lv.innerHTML : 'KEIN APP-LIST-VIEW';
    });
    console.log(`Media app-list-view HTML: ${listViewHtml.substring(0, 500)}...`);
    const mediaCount = await page.evaluate(() => document.querySelectorAll('app-entity-card').length);
    console.log(`Gefundene Media Entities: ${mediaCount}`);

    console.log("Navigiere zu /persons...");
    await page.goto('http://localhost:4200/persons', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    
    const personCount = await page.evaluate(() => document.querySelectorAll('app-entity-card').length);
    console.log(`Gefundene Person Entities: ${personCount}`);
    await page.screenshot({path: 'screenshot_persons.png'});

    await browser.close();
    console.log("Fertig.");
})();
