chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "force-manual",
        title: "Manual Input",
        contexts: ["action"]
    });

    chrome.contextMenus.create({
        id: "settings",
        title: "Settings...",
        contexts: ["action"]
    });
});

chrome.action.onClicked.addListener((tab) => {
    triggerExtension(tab, "auto");
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "force-manual") {
        triggerExtension(tab, "manual");
    } else if (info.menuItemId === "settings") {
        triggerExtension(tab, "settings");
    }
});

async function triggerExtension(tab, mode) {
    await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ["modal.css"]
    });
    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["search-automation.js"],
        world: "MAIN"
    })

    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (m) => { window.triggerOdooSearch.start(m); },
        args: [mode],
        world: "MAIN"
    })
}
