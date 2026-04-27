# Odoo Tech Support Magic Funnel
Smart boundary Chrome Extension for finding oldest tickets

### Installation / Setup

1. Clone the repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode" (top-right toggle)
4. Click "Load unpacked"
5. Select the cloned repository folder
6. (Recommended) Pin the extension

### Usage

1. From the ticket list view with your normal filters applied, click the extension icon
2. The extension will pull the boundary ticket ID from Odoo, and interact with the UI to add a filter for tickets older than the boundary

If the extension fails to find the boundary ticket ID, it will prompt you to enter a numeric ID manually.

You can also manually enter a ticket ID by right-clicking the extension icon and selecting "Manual Input".

### Report an Issue / Submit Feedback

Go to the task here: [https://www.odoo.com/odoo/project/31223/tasks/6145563](https://www.odoo.com/odoo/project/31223/tasks/6145563) and add a Log Note describing either:
- The issue, the expected behavior, and steps to replicate 
- The feature you'd like added
