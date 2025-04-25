// --- Global State (will be loaded from API) ---
let GLOBAL_CONFIG = {
    icons: {},
    positions: {},
    size: 'small'
};

// --- API Interaction Functions ---
async function fetchConfig() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) {
            // Attempt to provide more detail from the response if possible
            let errorBody = "Unknown error";
            try {
                errorBody = await response.text();
            } catch (e) { /* ignore */ }
            throw new Error(`HTTP error! status: ${response.status}, Body: ${errorBody}`);
        }
        const config = await response.json();
        console.log("Configuration loaded from API:", config);
        // Basic validation
        if (typeof config !== 'object' || config === null) throw new Error("Invalid config format from API");
        GLOBAL_CONFIG.icons = config.icons || {};
        GLOBAL_CONFIG.positions = config.positions || {};
        GLOBAL_CONFIG.size = config.size || 'small';
        return true; // Indicate success
    } catch (error) {
        console.error("Error fetching configuration:", error);
        alert(`Error fetching configuration from server: ${error.message}. Using default state.`);
        // Reset to default state on error
        GLOBAL_CONFIG = { icons: {}, positions: {}, size: 'small' };
        return false; // Indicate failure
    }
}

async function saveConfigToServer(configToSave) {
    // Accepts the config object to save
    console.log("Saving configuration to server:", configToSave);
    try {
        const response = await fetch('/api/config', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(configToSave),
        });
        if (!response.ok) {
             let errorBody = "Unknown error";
             try {
                 errorBody = await response.text();
             } catch (e) { /* ignore */ }
            throw new Error(`HTTP error! status: ${response.status}, Body: ${errorBody}`);
        }
        const result = await response.json();
        console.log("Save response:", result.message);
        return true; // Indicate success
    } catch (error) {
        console.error("Error saving configuration:", error);
        alert(`Error saving configuration to server: ${error.message}`);
        return false; // Indicate failure
    }
}

// Function to gather current state from DOM and GLOBAL_CONFIG
function getCurrentConfigState() {
    const currentPositions = {};
    const currentIconsSettings = {};
    const currentIconsOnDesktop = document.querySelectorAll('.desktop .icon');

    currentIconsOnDesktop.forEach(icon => {
        if (!icon.id) return;
        currentPositions[icon.id] = {
            x: parseInt(icon.style.left) || 0,
            y: parseInt(icon.style.top) || 0
        };
        const link = icon.getAttribute('href') || '#';
        const img = icon.querySelector('img');
        const imageSrc = img?.getAttribute('src') || 'icons/placeholder.png';
        const name = icon.querySelector('span')?.textContent || icon.id;
        currentIconsSettings[icon.id] = { link, imageSrc, name };
    });

    return {
        icons: currentIconsSettings,
        positions: currentPositions,
        size: GLOBAL_CONFIG.size // Get size from global state
    };
}


document.addEventListener('DOMContentLoaded', async () => { // Make async for await fetchConfig

    const desktop = document.querySelector('.desktop');
    let icons = []; // Initialize empty, will be populated by recreateIconsFromConfig
    const iconContextMenu = document.getElementById('context-menu');
    const desktopContextMenu = document.getElementById('desktop-context-menu');
    const settingsModal = document.getElementById('settings-modal');
    const settingsForm = document.getElementById('settings-form');
    const iconLinkInput = document.getElementById('icon-link');
    const iconImageInput = document.getElementById('icon-image');
    const closeModalButton = document.getElementById('close-modal');
    const cancelModalButton = document.getElementById('cancel-modal');

    // Start Menu elements
    const startButton = document.querySelector('.start-button');
    const startMenu = document.getElementById('start-menu');
    const startMenuNewShortcut = document.getElementById('start-menu-new-shortcut');
    const startMenuSaveConfig = document.getElementById('start-menu-save-config'); // Re-added ref
    const startMenuLoadConfig = document.getElementById('start-menu-load-config'); // Re-added ref
    const startMenuShutdown = document.getElementById('start-menu-shutdown');
    const loadConfigInput = document.getElementById('load-config-input'); // Ref for file input

    // New elements for creating shortcuts
    const createShortcutModal = document.getElementById('create-shortcut-modal');
    const createShortcutForm = document.getElementById('create-shortcut-form');
    const shortcutNameInput = document.getElementById('shortcut-name');
    const shortcutLinkInput = document.getElementById('shortcut-link');
    const shortcutImageInput = document.getElementById('shortcut-image');
    const closeCreateModalButton = document.getElementById('close-create-modal');
    const cancelCreateModalButton = document.getElementById('cancel-create-modal');
    const createShortcutMenuItem = document.getElementById('desktop-context-new-shortcut');
    const desktopSortMenuItem = document.getElementById('desktop-context-sort');
    const desktopUpscaleMenuItem = document.getElementById('desktop-context-upscale');
    const desktopDownscaleMenuItem = document.getElementById('desktop-context-downscale');

    let currentIcon = null;
    let lastContextMenuClickPos = { x: 0, y: 0 };
    let isDragging = false;
    let isActuallyDragging = false;
    let offsetX, offsetY;

    // --- Icon Size Configuration ---
    const iconSizes = ['small', 'medium', 'large'];
    const iconSizeClasses = {
        small: '',
        medium: 'icons-medium',
        large: 'icons-large'
    };
    let currentIconSizeIndex = 0; // Will be set after loading config

    // --- Icon Initialization Function (called by recreateIconsFromConfig) ---
    function initializeIcon(icon) {
        if (!icon) return;
        icon.style.position = 'absolute';
        icon.style.cursor = 'move';
        icon.setAttribute('tabindex', '0');

        // Position is set by recreateIconsFromConfig using loaded data

        // Drag start
        icon.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            isDragging = true;
            isActuallyDragging = false;
            currentIcon = icon;
            offsetX = e.clientX - icon.getBoundingClientRect().left;
            offsetY = e.clientY - icon.getBoundingClientRect().top;
        });

        // Prevent default link drag behavior
        icon.addEventListener('dragstart', (e) => {
            e.preventDefault();
        });

        // Add click listener to prevent navigation after drag
        icon.addEventListener('click', (e) => {
            if (isActuallyDragging) {
                e.preventDefault();
                isActuallyDragging = false;
            }
        });
    }

    // --- Helper Functions ---

    // --- Initial Desktop Setup ---
    async function setupDesktop() {
        // 1. Fetch config from backend
        const fetchSuccess = await fetchConfig(); // Populates GLOBAL_CONFIG

        // 2. Apply loaded icon size (even if fetch failed, use default)
        applyIconSize(GLOBAL_CONFIG.size);

        // 3. Clear any icons initially present in HTML
        desktop.innerHTML = '';

        // 4. Recreate icons based ONLY on the loaded config data
        recreateIconsFromConfig(GLOBAL_CONFIG.icons);

        // 5. Do NOT sort automatically on load
    }

    await setupDesktop(); // Run the setup and wait for it


    // Drag move
    document.addEventListener('mousemove', (e) => {
        if (!isDragging || !currentIcon) return;
        isActuallyDragging = true;
        const desktopRect = desktop.getBoundingClientRect();
        let x = e.clientX - desktopRect.left - offsetX;
        let y = e.clientY - desktopRect.top - offsetY;
        x = Math.max(0, Math.min(x, desktopRect.width - currentIcon.offsetWidth));
        y = Math.max(0, Math.min(y, desktopRect.height - currentIcon.offsetHeight));
        currentIcon.style.left = x + 'px';
        currentIcon.style.top = y + 'px';
    });

    // Drag end
    document.addEventListener('mouseup', () => {
        if (!isDragging || !currentIcon) return;
        // Save the entire configuration after a drag ends
        const currentState = getCurrentConfigState();
        saveConfigToServer(currentState); // Pass the gathered state
        isDragging = false;
        currentIcon = null;
    });

    // Context Menu Logic
    desktop.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const { clientX: mouseX, clientY: mouseY } = e;
        lastContextMenuClickPos = { x: mouseX, y: mouseY };
        hideIconContextMenu();
        hideDesktopContextMenu();
        hideStartMenu();
        const targetIcon = e.target.closest('.icon');
        if (targetIcon) {
            currentIcon = targetIcon;
            iconContextMenu.style.top = `${mouseY}px`;
            iconContextMenu.style.left = `${mouseX}px`;
            iconContextMenu.style.display = 'block';
        } else {
            currentIcon = null;
            desktopContextMenu.style.top = `${mouseY}px`;
            desktopContextMenu.style.left = `${mouseX}px`;
            desktopContextMenu.style.display = 'block';
        }
    });

    // Hide context menus when clicking anywhere else
    document.addEventListener('click', (e) => {
        if (iconContextMenu && !iconContextMenu.contains(e.target)) {
            hideIconContextMenu();
        }
        if (desktopContextMenu && !desktopContextMenu.contains(e.target)) {
             hideDesktopContextMenu();
        }
        if (startMenu && startMenu.style.display === 'block' && !startMenu.contains(e.target) && e.target !== startButton && !startButton.contains(e.target)) {
             hideStartMenu();
        }
    });

    function hideIconContextMenu() {
        if (iconContextMenu) iconContextMenu.style.display = 'none';
    }
    function hideDesktopContextMenu() {
        if (desktopContextMenu) desktopContextMenu.style.display = 'none';
    }
    function hideStartMenu() {
        if (startMenu) startMenu.style.display = 'none';
    }


    // --- Settings Modal Logic (for existing icons) ---
    document.getElementById('context-settings').addEventListener('click', () => {
        if (currentIcon) {
            showSettingsModal();
            hideIconContextMenu();
        }
    });

    // Handle click on "Sort by Name" in icon context menu
    document.getElementById('context-sort').addEventListener('click', () => {
        sortIconsByName(); // This updates GLOBAL_CONFIG.positions
        saveConfigToServer(GLOBAL_CONFIG); // Save the updated global state
        hideIconContextMenu();
    });

    // Handle click on "Delete" in icon context menu
    document.getElementById('context-delete').addEventListener('click', () => {
        if (currentIcon) {
            const iconId = currentIcon.id;
            const iconName = currentIcon.querySelector('span')?.textContent || iconId;
            if (confirm(`Are you sure you want to delete "${iconName}"?`)) {
                try {
                    currentIcon.remove(); // Remove from DOM
                    // Update global config and save to server
                    delete GLOBAL_CONFIG.icons[iconId];
                    delete GLOBAL_CONFIG.positions[iconId];
                    saveConfigToServer(GLOBAL_CONFIG); // Save changes
                    console.log(`Deleted icon: ${iconId}`);
                    currentIcon = null;
                } catch (error) {
                    console.error(`Error deleting icon ${iconId}:`, error);
                    alert('Error deleting icon. Check console.');
                }
            }
            hideIconContextMenu();
        }
    });


    // Handle click on "Sort by Name" in desktop context menu
    desktopSortMenuItem.addEventListener('click', () => {
        sortIconsByName(); // This updates GLOBAL_CONFIG.positions
        saveConfigToServer(GLOBAL_CONFIG); // Save the updated global state
        hideDesktopContextMenu();
    });

    // Handle click on "Upscale Icons" in desktop context menu
    desktopUpscaleMenuItem.addEventListener('click', () => {
        changeIconSize(1); // This calls sort and save
        hideDesktopContextMenu();
    });

    // Handle click on "Downscale Icons" in desktop context menu
    desktopDownscaleMenuItem.addEventListener('click', () => {
        changeIconSize(-1); // This calls sort and save
        hideDesktopContextMenu();
    });


     function sortIconsByName() {
        let currentIconsOnDesktop = Array.from(desktop.querySelectorAll('.icon'));
        currentIconsOnDesktop.sort((a, b) => {
            const textA = a.querySelector('span')?.textContent.toLowerCase() || '';
            const textB = b.querySelector('span')?.textContent.toLowerCase() || '';
            return textA.localeCompare(textB);
        });

        const currentSize = iconSizes[currentIconSizeIndex];
        const iconDimensions = getIconDimensions(currentSize);
        const iconWidth = iconDimensions.width;
        const iconHeight = iconDimensions.height;
        const padding = 5;
        const desktopHeight = desktop.clientHeight;
        const maxRows = Math.max(1, Math.floor(desktopHeight / iconHeight));

        // Update GLOBAL_CONFIG.positions based on new layout
        const newPositions = {};
        currentIconsOnDesktop.forEach((icon, index) => {
            const col = Math.floor(index / maxRows);
            const row = index % maxRows;
            const x = col * iconWidth + padding;
            const y = row * iconHeight + padding;
            icon.style.left = x + 'px';
            icon.style.top = y + 'px';
            if (icon.id) {
                newPositions[icon.id] = { x, y };
            }
        });
        GLOBAL_CONFIG.positions = newPositions; // Update global state directly
        // Note: saveConfigToServer() is called by the click handlers *after* this runs
    }


    function showSettingsModal() {
        if (!currentIcon) return;
        const iconId = currentIcon.id;
        const settings = GLOBAL_CONFIG.icons[iconId] || {};
        const link = currentIcon.getAttribute('href') || settings.link || '#';
        const imageSrc = currentIcon.querySelector('img')?.getAttribute('src') || settings.imageSrc || '';

        iconLinkInput.value = link;
        iconImageInput.value = imageSrc;
        settingsModal.style.display = 'block';
    }

    function hideSettingsModal() {
        settingsModal.style.display = 'none';
    }

    // Handle Settings form submission (Save button)
    settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentIcon) return;

        const newLink = iconLinkInput.value.trim();
        const newImageSrc = iconImageInput.value.trim();
        const iconId = currentIcon.id;
        const name = currentIcon.querySelector('span')?.textContent || iconId;

        if (!iconId) return;

        try {
            // Update icon visually
            currentIcon.setAttribute('href', newLink || '#');
            const img = currentIcon.querySelector('img');
            if (img) {
                img.setAttribute('src', newImageSrc || 'icons/placeholder.png');
                if (newImageSrc) img.src = newImageSrc + '?t=' + Date.now();
            }

            // Update global config and save to server
            GLOBAL_CONFIG.icons[iconId] = { link: newLink, imageSrc: newImageSrc, name: name };
            // Position doesn't change here, just settings
            saveConfigToServer(GLOBAL_CONFIG);
            console.log('Saved settings for icon:', iconId);
            hideSettingsModal();
        } catch (error) {
            console.error('Error saving icon settings:', error);
            alert('Error saving settings. Check console.');
        }
    });

    // Handle Settings Cancel button
    cancelModalButton.addEventListener('click', hideSettingsModal);
    // Handle Settings Close (X) button
    closeModalButton.addEventListener('click', hideSettingsModal);


    // --- Start Menu Logic ---
    startButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = startMenu.style.display === 'block';
        hideIconContextMenu();
        hideDesktopContextMenu();
        startMenu.style.display = isVisible ? 'none' : 'block';
    });

    // Add listener for "New Shortcut" in Start Menu
    startMenuNewShortcut.addEventListener('click', () => {
        showCreateShortcutModal();
        hideStartMenu();
    });

     // Add listener for "Save Configuration" (to file) in Start Menu
    startMenuSaveConfig.addEventListener('click', () => {
        saveConfigurationToFile(); // New function
        hideStartMenu();
    });

    // Add listener for "Load Configuration" (from file) in Start Menu
    startMenuLoadConfig.addEventListener('click', () => {
        loadConfigInput.click(); // Trigger hidden file input
        hideStartMenu();
    });

    // Add listener for "Shut Down" in Start Menu
    startMenuShutdown.addEventListener('click', () => {
        hideStartMenu();
        document.body.classList.add('shutdown-active');
        hideDesktopContextMenu();
        hideIconContextMenu();
    });


    // --- Create Shortcut Modal Logic ---
    createShortcutMenuItem.addEventListener('click', () => {
        showCreateShortcutModal();
        hideDesktopContextMenu();
    });

    function showCreateShortcutModal() {
        createShortcutForm.reset();
        createShortcutModal.style.display = 'block';
        shortcutNameInput.focus();
    }

    function hideCreateShortcutModal() {
        createShortcutModal.style.display = 'none';
    }

    // Handle Create Shortcut form submission
    createShortcutForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = shortcutNameInput.value.trim();
        const link = shortcutLinkInput.value.trim();
        const imageSrc = shortcutImageInput.value.trim() || 'icons/placeholder.png';
        const id = 'shortcut_' + Date.now();

        if (!name || !link) {
            alert('Shortcut Name and Target URL are required.');
            return;
        }

        try {
            // Create element locally first
            const newIcon = createIconElement(id, name, link, imageSrc);
            desktop.appendChild(newIcon);
            // Calculate initial position for the new icon
            const currentSize = iconSizes[currentIconSizeIndex];
            const iconDimensions = getIconDimensions(currentSize);
            const padding = 5;
            const desktopHeight = desktop.clientHeight;
            const maxRows = Math.max(1, Math.floor(desktopHeight / iconDimensions.height));
            const existingIconCount = Object.keys(GLOBAL_CONFIG.positions).length; // Count existing positions
            const col = Math.floor(existingIconCount / maxRows);
            const row = existingIconCount % maxRows;
            const x = col * iconDimensions.width + padding;
            const y = row * iconDimensions.height + padding;

            // Apply calculated position
            newIcon.style.left = `${x}px`;
            newIcon.style.top = `${y}px`;

            // Initialize (Make draggable, add listeners)
            initializeIcon(newIcon);

            // Update global config (including the new position) and save to server
            GLOBAL_CONFIG.icons[id] = { link, imageSrc, name };
            GLOBAL_CONFIG.positions[id] = { x: parseInt(newIcon.style.left), y: parseInt(newIcon.style.top) };
            saveConfigToServer(GLOBAL_CONFIG);

            hideCreateShortcutModal();
            console.log('Created new shortcut:', id);

        } catch (error) {
            console.error('Error creating shortcut:', error);
            alert('Error creating shortcut. Check console.');
        }
    });

     // Handle Create Shortcut Cancel button
    cancelCreateModalButton.addEventListener('click', hideCreateShortcutModal);
    // Handle Create Shortcut Close (X) button
    closeCreateModalButton.addEventListener('click', hideCreateShortcutModal);


    // --- Configuration Save/Load Functions (File-based, interacts with API) ---

    async function saveConfigurationToFile() {
        // Fetch the latest config from the server first
        const fetchSuccess = await fetchConfig();
        if (!fetchSuccess) {
            alert("Could not fetch current configuration from server to save.");
            return;
        }
        // Now use the fetched GLOBAL_CONFIG
        try {
            const configString = JSON.stringify(GLOBAL_CONFIG, null, 2); // Pretty print
            const blob = new Blob([configString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = 'win98_config.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            console.log('Configuration download initiated.');

        } catch (error) {
            console.error('Error saving configuration to file:', error);
            alert('Error saving configuration to file. Check console.');
        }
    }

    // Listener for the hidden file input change event (Load from file)
    loadConfigInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = async (e) => { // Make async
            try {
                const configString = e.target.result;
                const config = JSON.parse(configString);

                // Basic validation (reuse checks from fetchConfig if needed)
                if (typeof config !== 'object' || config === null || !config.hasOwnProperty('icons') || !config.hasOwnProperty('positions') || !config.hasOwnProperty('size')) {
                    throw new Error('Invalid configuration file format. Missing keys.');
                }
                 if (!iconSizes.includes(config.size)) {
                     console.warn(`Invalid icon size "${config.size}" in file, defaulting to small.`);
                     config.size = 'small';
                 }

                // Send the loaded config to the server to update the backend state
                const saveSuccess = await saveConfigToServer(config);

                if (saveSuccess) {
                    // If server save was successful, update local state and UI
                    GLOBAL_CONFIG = config; // Update global state directly
                    await setupDesktop(); // Re-run setup to reflect loaded config
                    alert('Configuration loaded and saved successfully!');
                    console.log('Configuration loaded from file and saved to server.');
                } else {
                    // If server save failed, don't update UI
                    alert('Configuration loaded from file, but failed to save to server.');
                }

            } catch (error) {
                console.error('Error loading/processing configuration file:', error);
                alert(`Error loading configuration file: ${error.message}`);
            } finally {
                 event.target.value = null; // Reset file input
            }
        };

        reader.onerror = (e) => {
            console.error('Error reading file:', e);
            alert('Error reading configuration file.');
            event.target.value = null; // Reset file input
        };

        reader.readAsText(file);
    });


    // --- Helper to create icon DOM element ---
    function createIconElement(iconId, name, link, imageSrc) {
        const newIcon = document.createElement('a');
        newIcon.href = link || '#';
        newIcon.target = '_blank';
        newIcon.classList.add('icon');
        newIcon.id = iconId;

        const img = document.createElement('img');
        img.src = imageSrc || 'icons/placeholder.png';
        img.alt = name || iconId;
        img.onerror = () => { img.src = 'icons/placeholder.png'; }; // Fallback

        const span = document.createElement('span');
        span.textContent = name || iconId;

        newIcon.appendChild(img);
        newIcon.appendChild(span);
        return newIcon;
    }


    function recreateIconsFromConfig(iconSettings) {
         if (!iconSettings) return;
         desktop.innerHTML = ''; // Clear desktop before recreating

         Object.keys(iconSettings).forEach(iconId => {
            const settings = iconSettings[iconId];
            const name = settings.name || (iconId.startsWith('shortcut_') ? iconId.replace('shortcut_', '') : iconId);
            const link = settings.link || '#';
            const imageSrc = settings.imageSrc || 'icons/placeholder.png';
            const position = GLOBAL_CONFIG.positions[iconId]; // Get position from global state

            try {
                const newIcon = createIconElement(iconId, name, link, imageSrc);
                desktop.appendChild(newIcon);
                // Set position before initializing
                if (position) {
                    newIcon.style.left = `${position.x}px`;
                    newIcon.style.top = `${position.y}px`;
                } else {
                    // If position is missing for some reason, calculate default
                    loadIconPosition(newIcon);
                }
                initializeIcon(newIcon); // Make draggable, add listeners

            } catch (error) {
                 console.error(`Error recreating icon ${iconId}:`, error);
            }
         });
         // Update the global 'icons' NodeList reference
         icons = desktop.querySelectorAll('.icon');
         console.log('Icons recreated from configuration.');
    }

    // --- Icon Scaling Functions ---
    function getIconDimensions(sizeName) {
        switch (sizeName) {
            case 'large': return { width: 115, height: 115 };
            case 'medium': return { width: 100, height: 95 };
            case 'small':
            default: return { width: 85, height: 75 };
        }
    }

    function changeIconSize(direction) {
        currentIconSizeIndex = (currentIconSizeIndex + direction + iconSizes.length) % iconSizes.length;
        const newSizeName = iconSizes[currentIconSizeIndex];
        applyIconSize(newSizeName);
        // Update global state and save
        GLOBAL_CONFIG.size = newSizeName;
        sortIconsByName(); // Re-sort based on new size
        saveConfigToServer(GLOBAL_CONFIG); // Save the new size and potentially new positions
        console.log(`Icon size changed to: ${newSizeName}`);
    }

    function applyIconSize(sizeName) {
        Object.values(iconSizeClasses).forEach(className => {
            if (className) desktop.classList.remove(className);
        });
        const newClass = iconSizeClasses[sizeName];
        if (newClass) desktop.classList.add(newClass);
        currentIconSizeIndex = iconSizes.indexOf(sizeName);
        if (currentIconSizeIndex === -1) currentIconSizeIndex = 0;
        GLOBAL_CONFIG.size = sizeName; // Ensure global state is updated
    }

    // --- Final Debug Logs ---
    console.log('Script execution finished.');

});