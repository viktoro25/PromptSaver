/*
 * script.js
 * Implements authentication (login/signup) and prompt storage per user.
 * Users can store prompts with images, categories and tags, filter by category or search.
 * Additional features:
 *  - Dynamic categories with admin management (add, rename, delete)
 *  - Gallery-style cards with truncated prompt preview and actions (copy, edit, delete)
 *  - Modal view with full-size image, full prompt, tags and action buttons
 *  - Edit mode to update existing entries
 */

document.addEventListener('DOMContentLoaded', () => {
    /* ---------------- Utility functions ---------------- */
    // Load categories from storage; default if none exist. Categories exclude "All"
    function loadCategories() {
        const data = localStorage.getItem('categories');
        if (data) {
            try {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed) && parsed.length) return parsed;
            } catch (e) {
                console.error('Failed to parse categories:', e);
            }
        }
        return ['MidJourney', 'Sora', 'Leonardo AI', 'VEO3', 'Other'];
    }
    function saveCategories(cats) {
        localStorage.setItem('categories', JSON.stringify(cats));
    }
    // User management
    function getUsers() {
        const data = localStorage.getItem('users');
        if (!data) return [];
        try {
            return JSON.parse(data);
        } catch (e) {
            console.error('Failed to parse users:', e);
            return [];
        }
    }
    function saveUsers(users) {
        localStorage.setItem('users', JSON.stringify(users));
    }
    // Load/save entries for current user
    function loadEntries() {
        if (!currentUser) return [];
        const data = localStorage.getItem('promptData_' + currentUser);
        if (!data) return [];
        try {
            return JSON.parse(data);
        } catch (e) {
            console.error('Failed to parse stored entries:', e);
            return [];
        }
    }
    function saveEntries(entries) {
        if (!currentUser) return;
        localStorage.setItem('promptData_' + currentUser, JSON.stringify(entries));
    }

    // Load/save materials for current user
    function loadMaterials() {
        if (!currentUser) return [];
        const data = localStorage.getItem('materialsData_' + currentUser);
        if (!data) return [];
        try {
            const parsed = JSON.parse(data);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.error('Failed to parse materials:', e);
            return [];
        }
    }
    function saveMaterials(arr) {
        if (!currentUser) return;
        try {
            localStorage.setItem('materialsData_' + currentUser, JSON.stringify(arr));
        } catch (e) {
            console.error('Failed to save materials:', e);
        }
    }
    // Parse comma-separated tags into array of lowercase tags without '#'
    function parseTags(str) {
        if (!str) return [];
        return str.split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0)
            .map(s => s.replace(/^#/, '').toLowerCase());
    }

    /* ---------------- DOM references ---------------- */
    // Authentication pages
    const loginPage = document.getElementById('loginPage');
    const signupPage = document.getElementById('signupPage');
    const appPage = document.getElementById('appPage');
    // Forms and controls
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const toSignup = document.getElementById('toSignup');
    const toLogin = document.getElementById('toLogin');
    const logoutBtn = document.getElementById('logoutBtn');
    const usernameDisplay = document.getElementById('usernameDisplay');
    // Sidebar and main content
    const categoryList = document.getElementById('categoryList');
    const entryForm = document.getElementById('entryForm');
    const generatorSelect = document.getElementById('generatorSelect');
    const promptText = document.getElementById('promptText');
    const imageInput = document.getElementById('imageInput');
    const tagsInput = document.getElementById('tagsInput');
    const searchInput = document.getElementById('searchInput');
    const globalSearchInput = document.getElementById('globalSearchInput');
    const entriesContainer = document.getElementById('entriesContainer');

    // Story mode elements
    const storyModeBtn = document.getElementById('storyModeBtn');
    const storySection = document.getElementById('storySection');
    const storyTimeline = document.getElementById('storyTimeline');
    const storyScenario = document.getElementById('storyScenario');
    const themeColorInput = document.getElementById('themeColorInput');
    const addSceneBtn = document.getElementById('addSceneBtn');
    const saveStoryBtn = document.getElementById('saveStoryBtn');
    const sceneModal = document.getElementById('sceneModal');
    const sceneModalContent = document.getElementById('sceneModalContent');
    const sceneModalClose = document.getElementById('sceneModalClose');
    const newSceneImage = document.getElementById('newSceneImage');
    const newSceneTitle = document.getElementById('newSceneTitle');
    const newSceneVideoTitle = document.getElementById('newSceneVideoTitle');
    const createSceneBtn = document.getElementById('createSceneBtn');
    const newSceneDuration = document.getElementById('newSceneDuration');
    const newSceneAnimationPrompt = document.getElementById('newSceneAnimationPrompt');

    // Materials section elements
    const materialsBtn = document.getElementById('materialsBtn');
    const materialsSection = document.getElementById('materialsSection');
    const materialsContainer = document.getElementById('materialsContainer');
    const addMaterialBtn = document.getElementById('addMaterialBtn');
    const materialTitle = document.getElementById('materialTitle');
    const materialType = document.getElementById('materialType');
    const materialUrl = document.getElementById('materialUrl');
    const materialTags = document.getElementById('materialTags');
    const timelineScale = document.getElementById('timelineScale');
    // Admin panel
    const adminPanel = document.getElementById('adminPanel');
    const addCategoryForm = document.getElementById('addCategoryForm');
    const newCategoryInput = document.getElementById('newCategoryInput');
    const adminCategoryList = document.getElementById('adminCategoryList');
    // Modal
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImg');
    const modalDetails = document.getElementById('modalDetails');
    const modalClose = document.getElementById('modalClose');

    /* ---------------- Application state ---------------- */
    let currentUser = localStorage.getItem('currentUser') || null;
    let currentCategory = 'All';
    let searchTerm = '';
    let editingEntryId = null;
    let editingImageBase64 = null;
    let categories = loadCategories();

    // Story mode state
    let isStoryMode = false;
    let storyData = null;
    let editingSceneIndex = null;
    let editingSceneImageBase64 = null;

    // Materials state
    let isMaterialsMode = false;
    let materialsData = [];

    /* ---------------- View helpers ---------------- */
    function showLogin() {
        loginPage.style.display = 'block';
        signupPage.style.display = 'none';
        appPage.style.display = 'none';
        if (loginForm) loginForm.reset();
    }
    function showSignup() {
        loginPage.style.display = 'none';
        signupPage.style.display = 'block';
        appPage.style.display = 'none';
        if (signupForm) signupForm.reset();
    }
    function showApp() {
        loginPage.style.display = 'none';
        signupPage.style.display = 'none';
        appPage.style.display = 'block';
        usernameDisplay.textContent = currentUser;
        // Reload categories in case admin updated them
        categories = loadCategories();
        renderCategorySelect();
        renderCategories();
        updateActiveCategory();
        renderEntries();
        // Show admin panel only for admin user
        if (currentUser === 'admin') {
            adminPanel.style.display = 'block';
            renderAdminCategories();
        } else {
            adminPanel.style.display = 'none';
        }
        // Initialize story data and view
        storyData = loadStory();
        // Reset story mode
        isStoryMode = false;
        // Reset materials mode
        isMaterialsMode = false;
        // Load materials
        materialsData = loadMaterials();
        // Hide story section by default
        if (storySection) storySection.style.display = 'none';
        // Hide materials section by default
        if (materialsSection) materialsSection.style.display = 'none';
        // Show prompt sections
        const addEntrySection = document.getElementById('add-entry');
        const searchSection = document.getElementById('search-section');
        if (addEntrySection) addEntrySection.style.display = '';
        if (searchSection) searchSection.style.display = '';
        if (entriesContainer) entriesContainer.style.display = '';
        // Reset story mode button state
        if (storyModeBtn) storyModeBtn.classList.remove('active');
        // Reset materials button state
        if (materialsBtn) materialsBtn.classList.remove('active');
        // Apply story theme color and scenario
        if (storyData) {
            if (themeColorInput) themeColorInput.value = storyData.color || '#5a5ce6';
            if (storyScenario) storyScenario.value = storyData.scenario || '';
            document.documentElement.style.setProperty('--accent-color', storyData.color || '#5a5ce6');
        }
        // Render story timeline for later
        renderStory();
        // Render materials for later
        renderMaterials();
    }

    /* ---------------- Authentication events ---------------- */
    // Initial view
    if (currentUser) {
        showApp();
    } else {
        showLogin();
    }
    // Navigate to signup/login
    toSignup && toSignup.addEventListener('click', (e) => {
        e.preventDefault();
        showSignup();
    });
    toLogin && toLogin.addEventListener('click', (e) => {
        e.preventDefault();
        showLogin();
    });
    // Login
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value;
            const users = getUsers();
            const found = users.find(u => u.username === username);
            if (!found || found.password !== password) {
                alert('Невірне імʼя користувача або пароль.');
                return;
            }
            currentUser = username;
            localStorage.setItem('currentUser', currentUser);
            showApp();
        });
    }
    // Signup
    if (signupForm) {
        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('signupUsername').value.trim();
            const password = document.getElementById('signupPassword').value;
            const confirm = document.getElementById('signupConfirm').value;
            if (!username || !password) {
                alert('Будь ласка, заповніть усі поля.');
                return;
            }
            if (password !== confirm) {
                alert('Паролі не співпадають.');
                return;
            }
            const users = getUsers();
            if (users.some(u => u.username === username)) {
                alert('Користувач з таким імʼям вже існує.');
                return;
            }
            users.push({ username, password });
            saveUsers(users);
            currentUser = username;
            localStorage.setItem('currentUser', currentUser);
            showApp();
        });
    }
    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('currentUser');
            currentUser = null;
            showLogin();
        });
    }

    /* ---------------- Category and select rendering ---------------- */
    function renderCategorySelect() {
        if (!generatorSelect) return;
        const prev = generatorSelect.value;
        generatorSelect.innerHTML = '';
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            generatorSelect.appendChild(opt);
        });
        // Provide fallback 'Other' if not present
        if (!categories.includes('Other')) {
            const opt = document.createElement('option');
            opt.value = 'Other';
            opt.textContent = 'Other';
            generatorSelect.appendChild(opt);
        }
        if (prev && [...generatorSelect.options].some(o => o.value === prev)) {
            generatorSelect.value = prev;
        }
    }
    function renderCategories() {
        categoryList.innerHTML = '';
        // Always include All
        const allLi = document.createElement('li');
        const allBtn = document.createElement('button');
        allBtn.textContent = 'All';
        allBtn.dataset.category = 'All';
        if (currentCategory === 'All') allBtn.classList.add('active');
        allBtn.addEventListener('click', () => {
            if (currentCategory !== 'All') {
                currentCategory = 'All';
                updateActiveCategory();
                renderEntries();
            }
        });
        allLi.appendChild(allBtn);
        categoryList.appendChild(allLi);
        categories.forEach(cat => {
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.textContent = cat;
            btn.dataset.category = cat;
            if (cat === currentCategory) btn.classList.add('active');
            btn.addEventListener('click', () => {
                if (currentCategory !== cat) {
                    currentCategory = cat;
                    updateActiveCategory();
                    renderEntries();
                }
            });
            li.appendChild(btn);
            categoryList.appendChild(li);
        });
    }
    function updateActiveCategory() {
        document.querySelectorAll('#sidebar button').forEach(btn => {
            if (btn.dataset.category === currentCategory) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    /* ---------------- Entries rendering ---------------- */
    function renderEntries() {
        const entries = loadEntries();
        entriesContainer.innerHTML = '';
        // Filter by category
        let filtered = currentCategory === 'All' ? entries : entries.filter(e => e.generator === currentCategory);
        // Apply search
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(entry => {
                const inPrompt = entry.prompt.toLowerCase().includes(term);
                const inTags = Array.isArray(entry.tags) && entry.tags.some(t => t.includes(term));
                return inPrompt || inTags;
            });
        }
        if (!filtered.length) {
            const msg = document.createElement('p');
            msg.className = 'entries-empty';
            msg.textContent = 'Поки що немає записів.';
            entriesContainer.appendChild(msg);
            return;
        }
        filtered.forEach(entry => {
            const card = document.createElement('div');
            card.className = 'entry-card';
            // Apply completed styling if entry is marked done
            if (entry.done) {
                card.classList.add('done');
            }
            // Done checkbox
            const doneCheckbox = document.createElement('input');
            doneCheckbox.type = 'checkbox';
            doneCheckbox.className = 'done-checkbox';
            doneCheckbox.checked = !!entry.done;
            doneCheckbox.addEventListener('change', (e) => {
                // Update entry done state and persist
                const allEntries = loadEntries();
                const idx = allEntries.findIndex(en => en.id === entry.id);
                if (idx !== -1) {
                    allEntries[idx].done = doneCheckbox.checked;
                    saveEntries(allEntries);
                }
                renderEntries();
            });
            card.appendChild(doneCheckbox);
            // Generator label
            const label = document.createElement('span');
            label.className = 'generator-label';
            label.textContent = entry.generator;
            card.appendChild(label);
            // Image
            const img = document.createElement('img');
            img.src = entry.image;
            img.alt = 'Збережене зображення';
            img.addEventListener('click', () => openModal(entry));
            card.appendChild(img);
            // Prompt preview
            const pDiv = document.createElement('div');
            pDiv.className = 'prompt-text';
            pDiv.textContent = entry.prompt;
            card.appendChild(pDiv);
            // Tags
            if (Array.isArray(entry.tags) && entry.tags.length > 0) {
                const tagsCont = document.createElement('div');
                tagsCont.className = 'tags-container';
                entry.tags.forEach(tag => {
                    const span = document.createElement('span');
                    span.className = 'tag';
                    span.textContent = `#${tag}`;
                    span.addEventListener('click', (e) => {
                        e.stopPropagation();
                        searchInput.value = tag;
                        searchTerm = tag;
                        renderEntries();
                    });
                    tagsCont.appendChild(span);
                });
                card.appendChild(tagsCont);
            }
            // Action buttons (copy, edit)
            const actions = document.createElement('div');
            actions.className = 'card-actions';
            // Copy
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn';
            copyBtn.title = 'Копіювати';
            copyBtn.textContent = 'Копіювати';
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(entry.prompt).then(() => {
                    alert('Промпт скопійовано в буфер обміну');
                }).catch(err => console.error('Clipboard:', err));
            });
            actions.appendChild(copyBtn);
            // Edit
            const editBtn = document.createElement('button');
            editBtn.className = 'edit-btn';
            editBtn.title = 'Редагувати';
            editBtn.textContent = 'Редагувати';
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                startEdit(entry.id);
            });
            actions.appendChild(editBtn);
            card.appendChild(actions);
            // Delete button (absolute)
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.innerHTML = '&times;';
            delBtn.title = 'Видалити';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteEntry(entry.id);
            });
            card.appendChild(delBtn);
            entriesContainer.appendChild(card);
        });
    }

    /* ---------------- Entry form: add / edit ---------------- */
    if (entryForm) {
        entryForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const generator = generatorSelect.value;
            const promptVal = promptText.value.trim();
            const file = imageInput.files[0];
            if (!promptVal) {
                alert('Будь ласка, заповніть поле "Промпт".');
                return;
            }
            const tags = parseTags(tagsInput.value);
            let entries = loadEntries();
            if (editingEntryId) {
                // Update existing entry
                const idx = entries.findIndex(e => e.id === editingEntryId);
                if (idx !== -1) {
                    const entry = entries[idx];
                    entry.generator = generator;
                    entry.prompt = promptVal;
                    entry.tags = tags;
                    const handleSave = (imageData) => {
                        entry.image = imageData;
                        saveEntries(entries);
                        resetForm();
                        renderEntries();
                        currentCategory = generator;
                        updateActiveCategory();
                    };
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => handleSave(ev.target.result);
                        reader.readAsDataURL(file);
                    } else {
                        handleSave(editingImageBase64);
                    }
                }
            } else {
                // Add new entry
                if (!file) {
                    alert('Будь ласка, оберіть зображення.');
                    return;
                }
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const newEntry = {
                        id: Date.now().toString(),
                        generator,
                        prompt: promptVal,
                        image: ev.target.result,
                        tags,
                        done: false
                    };
                    entries.push(newEntry);
                    saveEntries(entries);
                    resetForm();
                    currentCategory = generator;
                    updateActiveCategory();
                    renderEntries();
                };
                reader.readAsDataURL(file);
            }
        });
    }
    function resetForm() {
        entryForm.reset();
        tagsInput.value = '';
        editingEntryId = null;
        editingImageBase64 = null;
        // Reset heading and button
        const heading = document.querySelector('#add-entry h2');
        if (heading) heading.textContent = 'Додати новий промпт';
        const submitBtn = entryForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Додати';
    }
    function startEdit(id) {
        // Scroll to form
        document.getElementById('add-entry').scrollIntoView({ behavior: 'smooth' });
        const entries = loadEntries();
        const entry = entries.find(e => e.id === id);
        if (!entry) return;
        editingEntryId = id;
        editingImageBase64 = entry.image;
        generatorSelect.value = entry.generator;
        promptText.value = entry.prompt;
        tagsInput.value = entry.tags ? entry.tags.join(', ') : '';
        const heading = document.querySelector('#add-entry h2');
        if (heading) heading.textContent = 'Редагувати промпт';
        const submitBtn = entryForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Зберегти';
    }

    /* ---------------- Delete entry ---------------- */
    function deleteEntry(id) {
        if (!confirm('Ви впевнені, що хочете видалити цей запис?')) return;
        let entries = loadEntries();
        entries = entries.filter(e => e.id !== id);
        saveEntries(entries);
        renderEntries();
    }

    /* ---------------- Search ---------------- */
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            searchTerm = searchInput.value.trim().toLowerCase();
            renderEntries();
        });
    }

    // Global search bar input event (header search)
    if (globalSearchInput) {
        globalSearchInput.addEventListener('input', () => {
            searchTerm = globalSearchInput.value.trim().toLowerCase();
            renderEntries();
            renderMaterials();
        });
    }

    /* ---------------- Story mode: load/save and render ---------------- */
    function loadStory() {
        if (!currentUser) return { scenario: '', color: '#5a5ce6', scenes: [] };
        const data = localStorage.getItem('storyData_' + currentUser);
        if (!data) return { scenario: '', color: '#5a5ce6', scenes: [] };
        try {
            const parsed = JSON.parse(data);
            return {
                scenario: parsed.scenario || '',
                color: parsed.color || '#5a5ce6',
                scenes: Array.isArray(parsed.scenes) ? parsed.scenes : []
            };
        } catch (e) {
            console.error('Failed to parse story data:', e);
            return { scenario: '', color: '#5a5ce6', scenes: [] };
        }
    }
    function saveStory(data) {
        if (!currentUser) return;
        try {
            localStorage.setItem('storyData_' + currentUser, JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save story data:', e);
        }
    }
    function renderStory() {
        if (!storyData) return;
        // Set scenario and color
        if (storyScenario) storyScenario.value = storyData.scenario || '';
        if (themeColorInput) themeColorInput.value = storyData.color || '#5a5ce6';
        document.documentElement.style.setProperty('--accent-color', storyData.color || '#5a5ce6');
        // Clear timeline
        if (!storyTimeline) return;
        storyTimeline.innerHTML = '';
        // Reset timeline scale
        if (timelineScale) {
            timelineScale.innerHTML = '';
        }
        if (!storyData.scenes || storyData.scenes.length === 0) {
            const msg = document.createElement('p');
            msg.className = 'entries-empty';
            msg.textContent = 'Поки що немає сцен.';
            storyTimeline.appendChild(msg);
            return;
        }
        // Build timeline scale segments
        if (timelineScale && storyData.scenes.length > 0) {
            const total = storyData.scenes.reduce((sum, s) => sum + (s.duration && !isNaN(s.duration) ? Number(s.duration) : 1), 0);
            storyData.scenes.forEach(scene => {
                const seg = document.createElement('div');
                seg.className = 'segment';
                const dur = (scene.duration && !isNaN(scene.duration)) ? Number(scene.duration) : 1;
                seg.style.flexGrow = dur;
                seg.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color');
                const label = document.createElement('span');
                label.textContent = scene.duration ? `${scene.duration}s` : '';
                seg.appendChild(label);
                timelineScale.appendChild(seg);
            });
        }
        storyData.scenes.forEach((scene, index) => {
            const card = document.createElement('div');
            card.className = 'scene-card';
            if (scene.done) card.classList.add('done');
            // Done checkbox
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'done-checkbox';
            checkbox.checked = !!scene.done;
            checkbox.addEventListener('change', () => {
                scene.done = checkbox.checked;
                saveStory(storyData);
                renderStory();
            });
            card.appendChild(checkbox);
            // Image
            const img = document.createElement('img');
            img.src = scene.image;
            img.alt = 'Scene image';
            img.addEventListener('click', () => {
                openSceneDetails(index);
            });
            card.appendChild(img);
            // Info container
            const infoDiv = document.createElement('div');
            infoDiv.className = 'scene-info';
            // Title: Scene number and truncated prompt
            const titleEl = document.createElement('div');
            titleEl.className = 'scene-title';
            let displayTitle = scene.prompt || '';
            if (displayTitle.length > 30) {
                displayTitle = displayTitle.substring(0, 30) + '...';
            }
            titleEl.textContent = `Сцена ${index + 1}: ${displayTitle || ''}`;
            infoDiv.appendChild(titleEl);
            // Video title
            const vTitleEl = document.createElement('div');
            vTitleEl.className = 'video-title';
            vTitleEl.textContent = scene.videoTitle || '';
            infoDiv.appendChild(vTitleEl);
            // Duration
            const durationEl = document.createElement('div');
            durationEl.className = 'scene-duration';
            durationEl.textContent = scene.duration ? `Тривалість: ${scene.duration}s` : '';
            infoDiv.appendChild(durationEl);
            // Animation prompt input
            const animInput = document.createElement('input');
            animInput.type = 'text';
            animInput.className = 'animation-input';
            animInput.placeholder = 'Промпт для анімації';
            animInput.value = scene.animationPrompt || '';
            animInput.addEventListener('input', () => {
                scene.animationPrompt = animInput.value;
                saveStory(storyData);
            });
            infoDiv.appendChild(animInput);
            // Actions
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'scene-actions';
            // Copy prompt
            const copyBtn = document.createElement('button');
            copyBtn.textContent = 'Копіювати';
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(scene.prompt || '').then(() => {
                    alert('Промпт скопійовано');
                }).catch(err => console.error('Clipboard:', err));
            });
            actionsDiv.appendChild(copyBtn);
            // Edit scene
            const editBtn = document.createElement('button');
            editBtn.textContent = 'Редагувати';
            editBtn.addEventListener('click', () => {
                editScene(index);
            });
            actionsDiv.appendChild(editBtn);
            // Delete scene
            const delBtn = document.createElement('button');
            delBtn.textContent = 'Видалити';
            delBtn.addEventListener('click', () => {
                if (confirm('Ви впевнені, що хочете видалити цю сцену?')) {
                    storyData.scenes.splice(index, 1);
                    saveStory(storyData);
                    renderStory();
                }
            });
            actionsDiv.appendChild(delBtn);
            infoDiv.appendChild(actionsDiv);
            card.appendChild(infoDiv);
            storyTimeline.appendChild(card);
        });
    }
    function openSceneDetails(index) {
        const scene = storyData && storyData.scenes[index];
        if (!scene) return;
        modal.style.display = 'block';
        modalImg.src = scene.image;
        modalDetails.innerHTML = '';
        // Title
        const h3 = document.createElement('h3');
        h3.textContent = scene.prompt || 'Сцена';
        modalDetails.appendChild(h3);
        // Video title
        if (scene.videoTitle) {
            const vEl = document.createElement('p');
            vEl.textContent = 'Назва для відео: ' + scene.videoTitle;
            modalDetails.appendChild(vEl);
        }
        // Tags if present
        if (Array.isArray(scene.tags) && scene.tags.length > 0) {
            const tagCont = document.createElement('div');
            tagCont.className = 'tags-container';
            scene.tags.forEach(tag => {
                const span = document.createElement('span');
                span.className = 'tag';
                span.textContent = `#${tag}`;
                tagCont.appendChild(span);
            });
            modalDetails.appendChild(tagCont);
        }
        // Buttons
        const btnCont = document.createElement('div');
        btnCont.className = 'modal-buttons';
        // Copy
        const copyBtn = document.createElement('button');
        copyBtn.textContent = 'Копіювати';
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(scene.prompt || '').then(() => {
                alert('Промпт скопійовано в буфер обміну');
            });
        });
        btnCont.appendChild(copyBtn);
        // Edit
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Редагувати';
        editBtn.addEventListener('click', () => {
            closeModal();
            editScene(index);
        });
        btnCont.appendChild(editBtn);
        // Delete
        const delBtn = document.createElement('button');
        delBtn.textContent = 'Видалити';
        delBtn.addEventListener('click', () => {
            closeModal();
            if (confirm('Ви впевнені, що хочете видалити цю сцену?')) {
                storyData.scenes.splice(index, 1);
                saveStory(storyData);
                renderStory();
            }
        });
        btnCont.appendChild(delBtn);
        modalDetails.appendChild(btnCont);
    }
    function openSceneModal(editIndex = null) {
        editingSceneIndex = editIndex;
        editingSceneImageBase64 = null;
        // Reset fields
        if (newSceneTitle) newSceneTitle.value = '';
        if (newSceneVideoTitle) newSceneVideoTitle.value = '';
        if (newSceneDuration) newSceneDuration.value = '';
        if (newSceneAnimationPrompt) newSceneAnimationPrompt.value = '';
        if (newSceneImage) newSceneImage.value = '';
        // If editing, prefill fields and store image base64
        if (editIndex !== null && storyData && storyData.scenes[editIndex]) {
            const scene = storyData.scenes[editIndex];
            newSceneTitle.value = scene.prompt || '';
            newSceneVideoTitle.value = scene.videoTitle || '';
            newSceneDuration.value = scene.duration || '';
            newSceneAnimationPrompt.value = scene.animationPrompt || '';
            editingSceneImageBase64 = scene.image;
            // Hide list of existing entries while editing
            if (sceneModalContent) sceneModalContent.style.display = 'none';
        } else {
            // Show list when adding new
            if (sceneModalContent) sceneModalContent.style.display = 'block';
            renderSceneModalEntries();
        }
        sceneModal.style.display = 'block';
    }
    function closeSceneModal() {
        sceneModal.style.display = 'none';
        editingSceneIndex = null;
        editingSceneImageBase64 = null;
    }
    function renderSceneModalEntries() {
        if (!sceneModalContent) return;
        sceneModalContent.innerHTML = '';
        const entries = loadEntries();
        if (!entries || entries.length === 0) {
            const msg = document.createElement('p');
            msg.textContent = 'Немає доступних промптів.';
            sceneModalContent.appendChild(msg);
            return;
        }
        entries.forEach(entry => {
            const item = document.createElement('div');
            item.className = 'scene-entry-item';
            const img = document.createElement('img');
            img.src = entry.image;
            img.alt = 'Entry image';
            item.appendChild(img);
            const info = document.createElement('div');
            info.className = 'entry-info';
            const title = document.createElement('div');
            title.textContent = entry.prompt;
            info.appendChild(title);
            item.appendChild(info);
            const addBtn = document.createElement('button');
            addBtn.textContent = 'Додати';
            addBtn.addEventListener('click', () => {
                addSceneFromEntry(entry);
                closeSceneModal();
            });
            item.appendChild(addBtn);
            sceneModalContent.appendChild(item);
        });
    }
    function addSceneFromEntry(entry) {
        if (!storyData) return;
        storyData.scenes.push({
            image: entry.image,
            prompt: entry.prompt,
            videoTitle: entry.prompt,
            tags: entry.tags ? [...entry.tags] : [],
            done: false
        });
        saveStory(storyData);
        renderStory();
    }
    function editScene(index) {
        openSceneModal(index);
    }
    // Handle creating or updating scene
    if (createSceneBtn) {
        createSceneBtn.addEventListener('click', () => {
            const title = newSceneTitle.value.trim();
            const videoTitle = newSceneVideoTitle.value.trim();
            const durationVal = newSceneDuration.value.trim();
            const duration = durationVal ? parseInt(durationVal, 10) : undefined;
            const animPrompt = newSceneAnimationPrompt.value.trim();
            const file = newSceneImage.files[0];
            // Handler to save scene after getting image data
            const saveSceneData = (imageData) => {
                if (editingSceneIndex !== null && storyData && storyData.scenes[editingSceneIndex]) {
                    // Update existing scene
                    const scene = storyData.scenes[editingSceneIndex];
                    scene.prompt = title || scene.prompt;
                    scene.videoTitle = videoTitle || scene.videoTitle;
                    if (duration !== undefined && !isNaN(duration)) scene.duration = duration;
                    scene.animationPrompt = animPrompt || scene.animationPrompt;
                    scene.image = imageData;
                } else {
                    // Add new scene
                    storyData.scenes.push({
                        image: imageData,
                        prompt: title || 'Без тексту',
                        videoTitle: videoTitle || '',
                        duration: duration && !isNaN(duration) ? duration : undefined,
                        animationPrompt: animPrompt || '',
                        tags: [],
                        done: false
                    });
                }
                saveStory(storyData);
                renderStory();
                closeSceneModal();
            };
            if (editingSceneIndex !== null) {
                // Editing: if file selected, read; otherwise use existing base64
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        saveSceneData(ev.target.result);
                    };
                    reader.readAsDataURL(file);
                } else {
                    saveSceneData(editingSceneImageBase64);
                }
            } else {
                // Adding new
                if (!file) {
                    alert('Будь ласка, оберіть зображення для сцени.');
                    return;
                }
                const reader = new FileReader();
                reader.onload = (ev) => {
                    saveSceneData(ev.target.result);
                };
                reader.readAsDataURL(file);
            }
        });
    }
    // Scene modal close handlers
    if (sceneModalClose) {
        sceneModalClose.addEventListener('click', closeSceneModal);
    }
    if (sceneModal) {
        sceneModal.addEventListener('click', (e) => {
            if (e.target === sceneModal) {
                closeSceneModal();
            }
        });
    }
    // Story mode button handler
    if (storyModeBtn) {
        storyModeBtn.addEventListener('click', () => {
            if (!isStoryMode) {
                // Switch to story mode
                isStoryMode = true;
                // Hide prompt sections
                const addEntrySection = document.getElementById('add-entry');
                const searchSection = document.getElementById('search-section');
                if (addEntrySection) addEntrySection.style.display = 'none';
                if (searchSection) searchSection.style.display = 'none';
                if (entriesContainer) entriesContainer.style.display = 'none';
                // Show story section
                if (storySection) storySection.style.display = 'block';
                storyModeBtn.classList.add('active');
                renderStory();
            } else {
                // Switch back to entries mode
                isStoryMode = false;
                const addEntrySection = document.getElementById('add-entry');
                const searchSection = document.getElementById('search-section');
                if (addEntrySection) addEntrySection.style.display = '';
                if (searchSection) searchSection.style.display = '';
                if (entriesContainer) entriesContainer.style.display = '';
                if (storySection) storySection.style.display = 'none';
                storyModeBtn.classList.remove('active');
            }
        });
    }
    // Theme color change handler
    if (themeColorInput) {
        themeColorInput.addEventListener('change', (e) => {
            const color = e.target.value;
            document.documentElement.style.setProperty('--accent-color', color);
            if (storyData) {
                storyData.color = color;
                saveStory(storyData);
                renderStory();
            }
        });
    }

    /* ---------------- Materials mode button handler ---------------- */
    if (materialsBtn) {
        materialsBtn.addEventListener('click', () => {
            if (!isMaterialsMode) {
                // Enter materials mode
                isMaterialsMode = true;
                isStoryMode = false;
                // Hide prompt and story sections
                const addEntrySection = document.getElementById('add-entry');
                const searchSection = document.getElementById('search-section');
                if (addEntrySection) addEntrySection.style.display = 'none';
                if (searchSection) searchSection.style.display = 'none';
                if (entriesContainer) entriesContainer.style.display = 'none';
                if (storySection) storySection.style.display = 'none';
                // Show materials
                if (materialsSection) materialsSection.style.display = 'block';
                materialsBtn.classList.add('active');
                if (storyModeBtn) storyModeBtn.classList.remove('active');
                renderMaterials();
            } else {
                // Exit materials mode
                isMaterialsMode = false;
                // Show prompts again
                const addEntrySection = document.getElementById('add-entry');
                const searchSection = document.getElementById('search-section');
                if (addEntrySection) addEntrySection.style.display = '';
                if (searchSection) searchSection.style.display = '';
                if (entriesContainer) entriesContainer.style.display = '';
                if (storySection) storySection.style.display = 'none';
                if (materialsSection) materialsSection.style.display = 'none';
                materialsBtn.classList.remove('active');
            }
        });
    }

    /* ---------------- Add material button handler ---------------- */
    if (addMaterialBtn) {
        addMaterialBtn.addEventListener('click', () => {
            const title = materialTitle.value.trim();
            const type = materialType.value;
            const url = materialUrl.value.trim();
            const tags = parseTags(materialTags.value);
            if (!title || !url) {
                alert('Будь ласка, заповніть назву та посилання.');
                return;
            }
            if (!materialsData) materialsData = [];
            const newMaterial = {
                id: Date.now().toString(),
                title,
                type,
                url,
                tags
            };
            materialsData.push(newMaterial);
            saveMaterials(materialsData);
            // Reset inputs
            materialTitle.value = '';
            materialUrl.value = '';
            materialTags.value = '';
            renderMaterials();
        });
    }

    /* ---------------- Render materials ---------------- */
    function renderMaterials() {
        if (!materialsContainer) return;
        materialsContainer.innerHTML = '';
        const mats = materialsData || [];
        let filtered = mats;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = mats.filter(mat => {
                const inTitle = mat.title.toLowerCase().includes(term);
                const inTags = Array.isArray(mat.tags) && mat.tags.some(t => t.includes(term));
                const inType = mat.type && mat.type.toLowerCase().includes(term);
                return inTitle || inTags || inType;
            });
        }
        if (!filtered.length) {
            const msg = document.createElement('p');
            msg.className = 'entries-empty';
            msg.textContent = 'Поки що немає матеріалів.';
            materialsContainer.appendChild(msg);
            return;
        }
        filtered.forEach(mat => {
            const card = document.createElement('div');
            card.className = 'material-card';
            // Title
            const h4 = document.createElement('h4');
            h4.textContent = mat.title;
            card.appendChild(h4);
            // Type
            const typeEl = document.createElement('div');
            typeEl.className = 'material-type';
            typeEl.textContent = mat.type === 'video' ? 'Відео' : 'Посилання';
            card.appendChild(typeEl);
            // Link
            const link = document.createElement('a');
            link.href = mat.url;
            link.textContent = mat.url;
            link.target = '_blank';
            card.appendChild(link);
            // Tags
            if (Array.isArray(mat.tags) && mat.tags.length > 0) {
                const tagCont = document.createElement('div');
                tagCont.className = 'tags-container';
                mat.tags.forEach(tag => {
                    const span = document.createElement('span');
                    span.className = 'tag';
                    span.textContent = `#${tag}`;
                    span.addEventListener('click', (e) => {
                        e.stopPropagation();
                        searchTerm = tag;
                        if (globalSearchInput) globalSearchInput.value = tag;
                        renderMaterials();
                    });
                    tagCont.appendChild(span);
                });
                card.appendChild(tagCont);
            }
            // Actions
            const actions = document.createElement('div');
            actions.className = 'card-actions';
            // Delete button
            const delBtn = document.createElement('button');
            delBtn.textContent = 'Видалити';
            delBtn.addEventListener('click', () => {
                if (confirm('Ви впевнені, що хочете видалити цей матеріал?')) {
                    materialsData = materialsData.filter(m => m.id !== mat.id);
                    saveMaterials(materialsData);
                    renderMaterials();
                }
            });
            actions.appendChild(delBtn);
            card.appendChild(actions);
            materialsContainer.appendChild(card);
        });
    }
    // Save story button handler
    if (saveStoryBtn) {
        saveStoryBtn.addEventListener('click', () => {
            if (storyData) {
                storyData.scenario = storyScenario ? storyScenario.value.trim() : '';
                storyData.color = themeColorInput ? themeColorInput.value : storyData.color;
                saveStory(storyData);
                alert('Історію збережено');
            }
        });
    }

    // Add scene button handler
    if (addSceneBtn) {
        addSceneBtn.addEventListener('click', () => {
            openSceneModal(null);
        });
    }

    /* ---------------- Modal ---------------- */
    function openModal(entry) {
        modal.style.display = 'block';
        modalImg.src = entry.image;
        modalDetails.innerHTML = '';
        // Generator title
        const gen = document.createElement('h3');
        gen.textContent = entry.generator;
        modalDetails.appendChild(gen);
        // Full prompt
        const p = document.createElement('p');
        p.textContent = entry.prompt;
        modalDetails.appendChild(p);
        // Tags
        if (Array.isArray(entry.tags) && entry.tags.length > 0) {
            const tagCont = document.createElement('div');
            tagCont.className = 'tags-container';
            entry.tags.forEach(tag => {
                const span = document.createElement('span');
                span.className = 'tag';
                span.textContent = `#${tag}`;
                span.addEventListener('click', () => {
                    searchInput.value = tag;
                    searchTerm = tag;
                    renderEntries();
                    closeModal();
                });
                tagCont.appendChild(span);
            });
            modalDetails.appendChild(tagCont);
        }
        // Buttons
        const btnCont = document.createElement('div');
        btnCont.className = 'modal-buttons';
        // Copy
        const copy = document.createElement('button');
        copy.textContent = 'Копіювати';
        copy.addEventListener('click', () => {
            navigator.clipboard.writeText(entry.prompt).then(() => {
                alert('Промпт скопійовано в буфер обміну');
            });
        });
        btnCont.appendChild(copy);
        // Edit
        const edit = document.createElement('button');
        edit.textContent = 'Редагувати';
        edit.addEventListener('click', () => {
            closeModal();
            startEdit(entry.id);
        });
        btnCont.appendChild(edit);
        // Delete
        const del = document.createElement('button');
        del.textContent = 'Видалити';
        del.addEventListener('click', () => {
            closeModal();
            deleteEntry(entry.id);
        });
        btnCont.appendChild(del);
        modalDetails.appendChild(btnCont);
    }
    function closeModal() {
        modal.style.display = 'none';
        modalImg.src = '';
        modalDetails.innerHTML = '';
    }
    modalClose && modalClose.addEventListener('click', closeModal);
    modal && modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    /* ---------------- Admin category management ---------------- */
    function renderAdminCategories() {
        adminCategoryList.innerHTML = '';
        categories.forEach(cat => {
            const li = document.createElement('li');
            const span = document.createElement('span');
            span.textContent = cat;
            li.appendChild(span);
            const actions = document.createElement('div');
            actions.className = 'admin-actions';
            // Rename
            const renameBtn = document.createElement('button');
            renameBtn.textContent = 'Перейменувати';
            renameBtn.addEventListener('click', () => {
                const newName = prompt('Нове імʼя для категорії', cat);
                if (!newName) return;
                if (categories.includes(newName)) {
                    alert('Категорія з таким імʼям вже існує.');
                    return;
                }
                const idx = categories.indexOf(cat);
                if (idx !== -1) {
                    categories[idx] = newName;
                    saveCategories(categories);
                    // Update entries for current user
                    const entries = loadEntries();
                    entries.forEach(entry => {
                        if (entry.generator === cat) entry.generator = newName;
                    });
                    saveEntries(entries);
                    renderCategorySelect();
                    renderCategories();
                    renderEntries();
                    renderAdminCategories();
                }
            });
            actions.appendChild(renameBtn);
            // Delete
            const delBtn = document.createElement('button');
            delBtn.textContent = 'Видалити';
            delBtn.addEventListener('click', () => {
                if (!confirm('Ви впевнені, що хочете видалити цю категорію?')) return;
                if (categories.length === 1) {
                    alert('Не можна видалити усі категорії.');
                    return;
                }
                const idx = categories.indexOf(cat);
                if (idx !== -1) {
                    categories.splice(idx, 1);
                    saveCategories(categories);
                    const entries = loadEntries();
                    entries.forEach(entry => {
                        if (entry.generator === cat) entry.generator = 'Other';
                    });
                    saveEntries(entries);
                    renderCategorySelect();
                    renderCategories();
                    renderEntries();
                    renderAdminCategories();
                }
            });
            actions.appendChild(delBtn);
            li.appendChild(actions);
            adminCategoryList.appendChild(li);
        });
    }
    if (addCategoryForm) {
        addCategoryForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const newCat = newCategoryInput.value.trim();
            if (!newCat) return;
            if (categories.includes(newCat)) {
                alert('Категорія вже існує.');
                return;
            }
            categories.push(newCat);
            saveCategories(categories);
            newCategoryInput.value = '';
            renderCategorySelect();
            renderCategories();
            renderAdminCategories();
        });
    }
});