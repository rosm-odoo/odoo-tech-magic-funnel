let isSearching = false;

async function triggerOdooSearch(val) {
    if (isSearching || !val) return;
    isSearching = true;

    const statusEl = document.getElementById('status');
    const inputEl = document.getElementById('idValue');
    const btnEl = document.getElementById('searchBtn');

    statusEl.innerHTML = "Searching...";
    statusEl.style.color = "#00A09D"; // Odoo success green
    inputEl.disabled = true;
    btnEl.disabled = true;

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // inject script that adds filter to ticket list view
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: performOdooSearch,
            args: [val]
        });
    } catch (err) {
        statusEl.innerHTML = "Error: Cannot run on this page.";
        statusEl.style.color = "#ff4d4d";
        console.error("Script injection failed:", err);
    }

    setTimeout(() => {
        window.close();
    }, 800);
}

document.addEventListener('DOMContentLoaded', async () => {
    // theme management (tries to match configured Odoo theme)
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const [themeResult] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                const match = document.cookie.match(/(^|;) ?color_scheme=([^;]*)(;|$)/);
                let scheme = match ? match[2] : null;
                if (!scheme || scheme === 'system') {
                    scheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                }
                return scheme;
            }
        });

        if (themeResult && themeResult.result === 'light') {
            document.documentElement.classList.add('light-mode');
        }
    } catch (err) {
        console.log("Could not detect theme, sticking to default dark.", err);
    }

    const data = await chrome.storage.local.get('forceManual');

    if (data.forceManual) {
        await chrome.storage.local.remove('forceManual');
        document.getElementById('status').innerHTML = "Manual Mode Forced";
        document.getElementById('status').style.color = "#e0a800";
        document.getElementById('idValue').focus();
        return;
    }

    document.getElementById('status').innerHTML = "Getting tickets from Odoo...";

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // inject script to get boundary from Odoo
        const [apiResult] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: async () => {
                const rpcPayload = {
                    jsonrpc: "2.0",
                    method: "call",
                    params: {
                        model: "account.analytic.line",
                        method: "search_read",
                        args: [
                            // There is a task on odoo.com that stores oldest ticket boundary calculated once a day
                            // by psus-tools, stored in the timesheet_ids `name` field in the format
                            // <ticket count>|<boundary ticket id>
                            [["task_id", "=", 5437679]]
                        ],
                        kwargs: {
                            limit: 1,
                            fields: ["name"],
                        }
                    }
                };
                const response = await fetch('/web/dataset/call_kw', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(rpcPayload)
                });

                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

                const responseData = await response.json();

                return responseData.result[0].name;
            }
        });

        const val = apiResult.result;

        if (!val || parseInt(val.split('|')[1]) === 0) {
            document.getElementById('status').innerHTML = "No boundary found. Please enter a numeric ID.";
            document.getElementById('idValue').focus();
            return;
        }

        // add 1 to the boundary because the given ticket is considered old
        // (and we can't filter <=, only <)
        const boundary = parseInt(val.split('|')[1]) + 1;

        if (boundary) {
            document.getElementById('idValue').value = boundary;
            triggerOdooSearch(boundary);
        } else {
            document.getElementById('status').innerHTML = "Boundary fetch failed. Please enter a numeric ID.";
            document.getElementById('idValue').focus();
        }
    } catch (err) {
        console.error("API Fetch Error:", err);
        document.getElementById('status').innerHTML = "Boundary fetch failed. Please enter a numeric ID.";
        document.getElementById('idValue').focus();
    }
});

document.getElementById('searchBtn').addEventListener('click', () => {
    const val = document.getElementById('idValue').value.trim();
    if (/^\d{1,10}$/.test(val)) { // you can thank jaca for this one
        triggerOdooSearch(val);
    } else {
        document.getElementById('status').innerHTML = "Please enter a numeric ID";
        document.getElementById('status').style.color = "#ff4d4d";
    }
});

document.getElementById('idValue').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const val = document.getElementById('idValue').value.trim();
        if (/^\d{1,10}$/.test(val)) {
            triggerOdooSearch(val);
        } else {
            document.getElementById('status').innerHTML = "Please enter a numeric ID";
            document.getElementById('status').style.color = "#ff4d4d";
        }
    }
});

// add the boundary filter to the list view by manually interacting with the UI
async function performOdooSearch(idValue) {
    document.querySelector('.o_searchview_dropdown_toggler')?.click();

    // we use this pattern to wait for the element to appear
    let customFilterBtn;
    while (!customFilterBtn) {
        customFilterBtn = document.querySelector('.o_add_custom_filter');
        await new Promise(r => setTimeout(r, 50));
    }
    customFilterBtn.click();

    // we will allow multiple attempts for this next phase to compensate for
    // possible slow loading times
    let attempts = 0;
    const interval = setInterval(async () => {
        const fieldSelector = document.querySelector('.o_model_field_selector_value');
        const searchBtn = document.querySelector('.modal-footer .btn-primary');

        if (fieldSelector && searchBtn) {
            clearInterval(interval);

            fieldSelector.click();

            let fieldItem;
            while (!fieldItem) {
                fieldItem = Array.from(document.querySelectorAll('.o_model_field_selector_popover_item_name'))
                    .find(el => el.textContent.includes('ID'));
                await new Promise(r => setTimeout(r, 50));
            }
            fieldItem.click();

            let operatorSelect;
            while (!operatorSelect) {
                operatorSelect = document.querySelector('.o_tree_editor_editor select');
                await new Promise(r => setTimeout(r, 50));
            }
            operatorSelect.value = '"<"';
            operatorSelect.dispatchEvent(new Event('change', { bubbles: true }));

            let valueInput;
            while (!valueInput) {
                valueInput = document.querySelector('.o_multi_record_selector input, .o_tree_editor_editor input[type="text"]');
                await new Promise(r => setTimeout(r, 50));
            }
            valueInput.value = idValue;
            valueInput.dispatchEvent(new Event('input', { bubbles: true }));
            valueInput.dispatchEvent(new Event('change', { bubbles: true }));

            setTimeout(() => searchBtn.click(), 100);
        }
        if (++attempts > 30) clearInterval(interval);
    }, 100);
}
