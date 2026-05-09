const puppeteer = require('puppeteer');
const assert = require('assert');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    await page.emulate({
        name: 'iPhone 13',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
        viewport: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true, isLandscape: false },
    });
    
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle0' });
    
    await page.waitForFunction('window.gameInstance !== undefined');
    
    await page.waitForSelector('#start-btn', { visible: true });
    await page.click('#start-btn');
    await new Promise(r => setTimeout(r, 500));
    
    const dispatchOrientation = async (alpha, beta, gamma) => {
        await page.evaluate((a, b, g) => {
            const event = new DeviceOrientationEvent('deviceorientation', { alpha: a, beta: b, gamma: g });
            window.dispatchEvent(event);
        }, alpha, beta, gamma);
        await new Promise(r => setTimeout(r, 50));
    };

    await dispatchOrientation(0, 90, 0); 
    
    let initialRotation = await page.evaluate(() => ({
        x: window.gameInstance.camera.rotation.x,
        y: window.gameInstance.camera.rotation.y
    }));

    await dispatchOrientation(350, 90, 0);
    
    let rightTurnRotation = await page.evaluate(() => ({
        x: window.gameInstance.camera.rotation.x,
        y: window.gameInstance.camera.rotation.y
    }));
    
    console.log(`Initial Y: ${initialRotation.y}, After Right Turn Y: ${rightTurnRotation.y}`);
    assert(rightTurnRotation.y < initialRotation.y, "Camera did not turn right as expected!");

    await dispatchOrientation(350, 80, 0);

    let upTiltRotation = await page.evaluate(() => ({
        x: window.gameInstance.camera.rotation.x,
        y: window.gameInstance.camera.rotation.y
    }));

    console.log(`Initial X: ${initialRotation.x}, After Up Tilt X: ${upTiltRotation.x}`);
    assert(upTiltRotation.x > rightTurnRotation.x, "Camera did not look up as expected!");

    console.log("SUCCESS: Gyro logic verified. Right movement -> Camera Right. Up tilt -> Camera Up.");
    await browser.close();
})();
