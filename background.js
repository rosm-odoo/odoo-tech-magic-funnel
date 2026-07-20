browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
        id: "force-manual",
        title: "Manual Input",
        contexts: ["action"]
    });

    browser.contextMenus.create({
        id: "settings",
        title: "Settings...",
        contexts: ["action"]
    });
});

browser.action.onClicked.addListener((tab) => {
    triggerExtension(tab, "auto");
});

browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "force-manual") {
        triggerExtension(tab, "manual");
    } else if (info.menuItemId === "settings") {
        triggerExtension(tab, "settings");
    }
});

async function triggerExtension(tab, mode) {
    try {
        await browser.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ["modal.css"]
        });
        
        await browser.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["search-automation.js"],
            world: "MAIN" 
        });

        await browser.scripting.executeScript({
            target: { tabId: tab.id },
            func: (m) => { window.triggerOdooSearch.start(m); },
            args: [mode],
            world: "MAIN"
        });
    } catch (error) {
        console.error("Failed to trigger extension:", error);
    }
}