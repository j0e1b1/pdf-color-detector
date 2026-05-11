// offscreen.js
import * as pdfjsLib from './lib/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = './lib/pdf.worker.mjs';

// Listen for the command from background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target === 'offscreen' && message.type === 'SCAN_PDF') {
        analyzePDF(message.url, message.tabId);
    }
});

async function analyzePDF(url, tabId) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const arrayBuffer = await response.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        let colorPages = [];
        let bwPages = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 0.2 });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d', { willReadFrequently: true });
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;

            if (checkForColor(context, canvas.width, canvas.height)) {
                colorPages.push(pageNum);
            } else {
                bwPages.push(pageNum);
            }
        }

        // SCAN COMPLETE: Save results to browser storage using the tab's ID
        const resultKey = `pdf_result_${tabId}`;
        await chrome.storage.local.set({ 
            [resultKey]: { 
                colorPages: colorPages, 
                bwPages: bwPages, 
                totalPages: pdf.numPages 
            } 
        });

        // Update the extension badge to show it's done!
        chrome.action.setBadgeText({ text: 'Done', tabId: tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#34a853', tabId: tabId });

    } catch (error) {
        console.error("Background PDF Scan Error:", error);
        chrome.action.setBadgeText({ text: 'Err', tabId: tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#ea4335', tabId: tabId });
    }
}

function checkForColor(context, width, height) {
    const imageData = context.getImageData(0, 0, width, height);
    const data = imageData.data;
    const threshold = 15; 
    const step = 4 * 10; // Check 1 in 10 pixels

    for (let i = 0; i < data.length; i += step) { 
        if (Math.abs(data[i] - data[i+1]) > threshold || 
            Math.abs(data[i] - data[i+2]) > threshold || 
            Math.abs(data[i+1] - data[i+2]) > threshold) {
            return true; 
        }
    }
    return false; 
}