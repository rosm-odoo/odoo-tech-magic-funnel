window.triggerOdooSearch = {
    UI: {
        async waitFor(finderFn, timeout = 3000) {
            let elapsed = 0;
            while (elapsed < timeout) {
                const el = finderFn();
                if (el) return el;
                await new Promise(r => setTimeout(r, 50));
                elapsed += 50;
            }
            throw new Error("UI Automation Timeout: Element not found.");
        },

        async click(finderFn) {
            const el = await this.waitFor(finderFn);
            el.click();
            await new Promise(r => setTimeout(r, 100));
        },

        async select(finderFn, value) {
            const el = await this.waitFor(finderFn);
            el.value = value;
            el.dispatchEvent(new Event('change', { bubbles: true }));
        },

        async type(finderFn, value) {
            const el = await this.waitFor(finderFn);
            el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }
    },

    detectTheme() {
        const match = document.cookie.match(/(^|;) ?color_scheme=([^;]*)(;|$)/);
        let scheme = match ? match[2] : null;
        if (!scheme || scheme === 'system') {
            scheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return scheme;
    },

    settings: {
        includePriority: localStorage.getItem("odooMagicUrgent") ?? false,
        boundaryPlusOne: localStorage.getItem("odooMagicBoundaryPlusOne") ?? true
    },

    async fetchBoundary() {
        try {
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

            const val = responseData.result[0].name;

            if (!val || parseInt(val.split('|')[1]) === 0) {
                document.getElementById('status').innerHTML = "No boundary found. Please enter a numeric ID.";
                document.getElementById('idValue').focus();
                return;
            }

            let boundary = parseInt(val.split('|')[1]);

            // add 1 to the boundary because the given ticket is considered old
            // (and we can't filter <=, only <)
            if (this.settings.boundaryPlusOne === 'true') {
                boundary += 1;
            }

            return boundary;
        } catch (err) {
            console.error("API Fetch Error:", err);
        }
    },

    showSettingsModal() {
        const existing = document.getElementById('odoo-magic-modal-overlay');
        if (existing) existing.remove();

        const tmpl = `
            <div id="odoo-magic-modal-overlay">
                <div id="odoo-magic-modal-card">
                    <h2>Magic Funnel Settings</h2>
                    <br/>

                    <label class="magic-checkbox-label">
                        <input type="checkbox" id="magic-urgent-toggle" ${this.settings.includePriority === 'true' ? 'checked' : ''}> Include Urgent Tickets
                    </label>
                    
                    <div class="magic-setting-group">
                        <label class="magic-checkbox-label tight-label">
                            <input type="checkbox" id="magic-boundary-plus-one-toggle" ${this.settings.boundaryPlusOne === 'true' ? 'checked' : ''}> Boundary + 1
                        </label>
                        <span class="magic-helper-text">Determines whether boundary ticket is considered old</span>
                    </div>
                    
                    <div class="magic-btn-group">
                        <button id="magic-cancel">Cancel</button>
                        <button id="magic-submit">Save</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', tmpl);

        const overlay = document.getElementById('odoo-magic-modal-overlay');
        if (this.detectTheme() === 'light') {
            overlay.classList.add('light-mode');
        }

        document.getElementById('magic-cancel').onclick = () => document.getElementById('odoo-magic-modal-overlay').remove();
        document.getElementById('magic-submit').onclick = () => {
            const isUrgent = document.getElementById('magic-urgent-toggle').checked;
            const boundaryPlusOne = document.getElementById('magic-boundary-plus-one-toggle').checked;
            localStorage.setItem('odooMagicUrgent', isUrgent);
            localStorage.setItem('odooMagicBoundaryPlusOne', boundaryPlusOne);
            document.getElementById('odoo-magic-modal-overlay').remove();
        };
    },

    showManualModal(errorMsg = "") {
        const existing = document.getElementById('odoo-magic-modal-overlay');
        if (existing) existing.remove();

        const tmpl = `
            <div id="odoo-magic-modal-overlay">
                <div id="odoo-magic-modal-card">
                    <h2>Manual Boundary Input</h2>
                    <p id="odoo-magic-error">${errorMsg}</p>
                    
                    <input type="text" id="magic-id-input" placeholder="Enter ID...">
                    
                    <div class="magic-btn-group">
                        <button id="magic-cancel">Cancel</button>
                        <button id="magic-submit">Search</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', tmpl);

        const overlay = document.getElementById('odoo-magic-modal-overlay');
        if (this.detectTheme() === 'light') {
            overlay.classList.add('light-mode');
        }
        
        const inputEl = document.getElementById('magic-id-input');
        inputEl.addEventListener('keypress', e => {
            if (e.key === 'Enter') {
                const val = document.getElementById('magic-id-input').value.trim();
                this.testAndSearch(val);
            }
        })
        inputEl.focus();

        document.getElementById('magic-cancel').onclick = () => document.getElementById('odoo-magic-modal-overlay').remove();
        document.getElementById('magic-submit').onclick = () => {
            const val = document.getElementById('magic-id-input').value.trim();
            this.testAndSearch(val);
        };
        
    },

    testAndSearch(val) {
        if (/^\d{1,10}$/.test(val)) {
            document.getElementById('odoo-magic-modal-overlay').remove();
            this.performOdooSearch(val);
        } else {
            document.getElementById('odoo-magic-error').innerHTML = 'Please enter a valid numeric ticket ID';
        }
    },

    async performOdooSearch(idValue) {
        try {
            await this.UI.click(() => document.querySelector('.o_searchview_dropdown_toggler'));
            await this.UI.click(() => document.querySelector('.o_add_custom_filter'));
            if (this.settings.includePriority === 'true') {
                await this.UI.click(() => Array.from(document.querySelectorAll('.btn-link-inline')).find(e => e.textContent.includes('New Rule')));
            }

            await this.UI.click(() => document.querySelectorAll('.o_model_field_selector_value')[0]);
            await this.UI.click(() => Array.from(document.querySelectorAll('.o_model_field_selector_popover_item_name')).find(e => e.textContent === 'ID'));
            await this.UI.select(() => document.querySelectorAll('.o_tree_editor_editor select')[0], '"<"');
            await this.UI.type(() => document.querySelectorAll('.o_tree_editor_editor input[type="text"]')[0], idValue);

            if (this.settings.includePriority === 'true') {
                await this.UI.click(() => document.querySelectorAll('.o_model_field_selector_value')[1]);
                await this.UI.click(() => Array.from(document.querySelectorAll('.o_model_field_selector_popover_item_name')).find(e => e.textContent.includes('Priority')));
                await this.UI.select(() => document.querySelectorAll('.o_tree_editor_editor select')[1], '"!="');
                await this.UI.select(() => document.querySelectorAll('.o_tree_editor_editor select')[2], '"0"');
            }

            await this.UI.click(() => document.querySelector('.modal-footer .btn-primary'));

        } catch (error) {
            console.error("Smart Filter Failed:", error);
            alert("Automation failed. Odoo's UI may be loading too slowly or has changed.\n" + error);
        }
    },

    async start(mode) {
        if (mode === "manual") {
            this.showManualModal();
            return;
        } else if (mode === "settings") {
            this.showSettingsModal();
            return;
        }

        document.body.style.cursor = 'wait';
        const boundary = await this.fetchBoundary();
        document.body.style.cursor = 'default';

        if (boundary) {
            this.performOdooSearch(boundary);
        } else {
            this.showManualModal("Auto-fetch failed. Enter ID manually.")
        }
    }
}