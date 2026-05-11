document.addEventListener('DOMContentLoaded', async () => {
    const statusDiv = document.getElementById('status');
    const resultsDiv = document.getElementById('results');
    const copyBtn = document.getElementById('copy-btn');
    const scanBtn = document.getElementById('scan-btn');
    
    // Hide the manual scan button, since we do it automatically now
    if(scanBtn) scanBtn.style.display = 'none';

    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url || !tab.url.split('?')[0].toLowerCase().endsWith('.pdf')) {
        statusDiv.innerText = "Please open a PDF file to see results.";
        return;
    }

    const resultKey = `pdf_result_${tab.id}`;

    // Add this to the bottom of background.js
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        // Listen for the distress signal from the popup
        if (message.action === 'FORCE_SCAN') {
            
            chrome.action.setBadgeText({ text: '...', tabId: message.tabId });
            chrome.action.setBadgeBackgroundColor({ color: '#FFA500', tabId: message.tabId });

            // Spin up the offscreen document and force the scan
            setupOffscreenDocument('offscreen.html').then(() => {
                chrome.runtime.sendMessage({
                    target: 'offscreen',
                    type: 'SCAN_PDF',
                    url: message.url,
                    tabId: message.tabId
                });
            });
        }
    });
});

function displayData(colorPages, bwPages, totalPages, resultsDiv, copyBtn) {
    const colorString = formatPageRanges(colorPages);
    const bwString = formatPageRanges(bwPages);
    
    let outputHTML = "";
    let clipboardText = "";

    if (colorPages.length === 0) {
        outputHTML = `<strong>Result:</strong> Entire document (${totalPages} pages) is Black & White.`;
        clipboardText = `B&W Pages: 1-${totalPages}`;
    } else if (bwPages.length === 0) {
        outputHTML = `<strong>Result:</strong> Entire document (${totalPages} pages) is in Color.`;
        clipboardText = `Color Pages: 1-${totalPages}`;
    } else {
        outputHTML = `
            <strong>Color Pages (${colorPages.length}):</strong><br>${colorString}
            <br><br>
            <strong>B&W Pages (${bwPages.length}):</strong><br>${bwString}
        `;
        clipboardText = `Color Pages: ${colorString}\nB&W Pages: ${bwString}`;
    }

    resultsDiv.innerHTML = outputHTML;
    resultsDiv.style.display = 'block';
    
    copyBtn.style.display = 'block';
    copyBtn.onclick = () => {
        navigator.clipboard.writeText(clipboardText).then(() => {
            copyBtn.innerText = "Copied!";
            setTimeout(() => copyBtn.innerText = "Copy Page Numbers", 2000);
        });
    };
}

function formatPageRanges(pages) {
    if (pages.length === 0) return "";
    let ranges = [];
    let start = pages[0], end = pages[0];

    for (let i = 1; i < pages.length; i++) {
        if (pages[i] === end + 1) {
            end = pages[i];
        } else {
            ranges.push(start === end ? `${start}` : `${start}-${end}`);
            start = pages[i];
            end = pages[i];
        }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    return ranges.join(', ');
}