// Background script with proper tab handling
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only process if tab is fully loaded
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      // Validate tabId before using it
      if (typeof tabId === 'number' && tabId >= 0) {
        chrome.tabs.get(tabId, (tabInfo) => {
          if (chrome.runtime.lastError) {
            console.error('Tab access error:', chrome.runtime.lastError);
            return;
          }
          
          // Process tab info safely
          if (tabInfo && tabInfo.url) {
            console.log('Tab updated:', tabInfo.url);
          }
        });
      }
    } catch (error) {
      console.error('Background script error:', error);
    }
  }
});

// Handle navigation completion safely
chrome.webNavigation.onCompleted.addListener((details) => {
  try {
    // Validate tabId before processing
    if (typeof details.tabId === 'number' && details.tabId >= 0) {
      chrome.tabs.get(details.tabId, (tab) => {
        if (chrome.runtime.lastError) {
          console.error('Tab navigation error:', chrome.runtime.lastError);
          return;
        }
        
        if (tab && tab.url) {
          console.log('Navigation completed:', tab.url);
        }
      });
    }
  } catch (error) {
    console.error('Navigation handling error:', error);
  }
});

// Error handling for invalid tab access
chrome.runtime.onInstalled.addListener(() => {
  console.log('Keyman Hotel Extension installed');
});
