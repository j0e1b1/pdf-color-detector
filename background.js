// background.js

// Listen for tab updates (when a page finishes loading)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.split('?')[0].toLowerCase().endsWith('.pdf')) {
        
        // Show a "Scanning" badge on the extension icon
        chrome.action.setBadgeText({ text: '...', tabId: tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#FFA500', tabId: tabId });

        // Ensure the offscreen document is ready
        await setupOffscreenDocument('offscreen.html');

        // Tell the offscreen document to scan this URL
        chrome.runtime.sendMessage({
            target: 'offscreen',
            type: 'SCAN_PDF',
            url: tab.url,
            tabId: tabId
        });
    }
});

// Helper function to create the hidden DOM environment
async function setupOffscreenDocument(path) {
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [chrome.runtime.getURL(path)]
    });
    if (existingContexts.length > 0) return; // Already exists

    await chrome.offscreen.createDocument({
        url: path,
        reasons: ['DOM_PARSER'],
        justification: 'Rendering PDF on canvas for color detection'
    });
}

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