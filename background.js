chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "force-manual",
        title: "Manual Input",
        contexts: ["action"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "force-manual") {
        chrome.storage.local.set({ forceManual: true }, () => {
            chrome.action.openPopup({ windowId: tab.windowId }).catch(err => {
                console.error("Could not open popup:", err);
            });
        });
    }
});