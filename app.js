// ==========================================
// GLOBAL STATE
// ==========================================
let globalAthleteData = []; 
let allPeerStats = {}; // Stores arrays of all scores for the Bell Curve math
let currentProfileId = null;
let currentSelectedStation = "";
let globalTeamNames = ['Varsity', 'JV', 'Freshman']; // Default fallback

const STATION_CONFIG = {
    "Vertical Jump": { min: 84, max: 120, step: 0.5, default: 90, display: (val) => Math.floor(val/12) + "'" + (val%12) + '"' }, 
    "Sprint Time": { min: 4.0, max: 8.0, step: 0.1, default: 5.5, display: (val) => parseFloat(val).toFixed(1) + "s" },
    "Triple Jump": { min: 120, max: 360, step: 1, default: 240, display: (val) => Math.floor(val/12) + "'" + (val%12) + '"' }, 
    "Passing": { min: 0.5, max: 5, step: 0.5, default: 3, display: (val, max) => Number(val).toFixed(1) + " / " + max },
    "Serving": { min: 0.5, max: 5, step: 0.5, default: 3, display: (val, max) => Number(val).toFixed(1) + " / " + max },
    "Hitting": { min: 0.5, max: 5, step: 0.5, default: 3, display: (val, max) => Number(val).toFixed(1) + " / " + max },
    "Setting": { min: 0.5, max: 5, step: 0.5, default: 3, display: (val, max) => Number(val).toFixed(1) + " / " + max },
    "Defense": { min: 0.5, max: 5, step: 0.5, default: 3, display: (val, max) => Number(val).toFixed(1) + " / " + max },
    "Receive": { min: 0.5, max: 5, step: 0.5, default: 3, display: (val, max) => Number(val).toFixed(1) + " / " + max }
};

// ==========================================
// INITIALIZATION & ROUTING
// ==========================================
document.addEventListener("DOMContentLoaded", function() {
    // Setup Hamburger Menu
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    
    if (hamburgerBtn && sidebar && overlay) {
        hamburgerBtn.addEventListener('click', () => {
            sidebar.classList.add('open');
            overlay.classList.add('open');
        });
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('open');
        });
    }

    // Load Default View
    loadView('overview');

    // Fetch and apply your custom colors immediately
    fetchAndApplySettings();
});

function loadView(viewName) {
    // 1. Close mobile sidebar if open
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('overlay')?.classList.remove('open');

    // 2. Hide all views
    document.querySelectorAll('.app-view').forEach(view => {
        view.style.display = 'none';
    });

    // 3. Highlight correct nav link
    document.querySelectorAll('#sidebar a').forEach(link => {
        link.classList.remove('active-nav');
        if (link.getAttribute('onclick')?.includes(`loadView('${viewName}')`)) {
            link.classList.add('active-nav');
        }
    });

    // 4. Show the selected view
    const viewElement = document.getElementById(`view-${viewName}`);
    if (viewElement) viewElement.style.display = 'block';

    const pageTitle = document.getElementById('pageTitle');

    // 5. Update Header Title and Fetch Data
    if (viewName === 'overview') {
        pageTitle.innerText = "Dashboard Overview";
        fetchAndRenderDashboard();
    } else if (viewName === 'photo') {
        pageTitle.innerText = "Photo Check-In";
        renderPhotoTable();
    } else if (viewName === 'mile') {
        pageTitle.innerText = "Mile Time Entry";
        renderMileTable(globalAthleteData);
    } else if (viewName === 'station') {
        pageTitle.innerText = "Station Evaluator";
        renderStationTable();
    } else if (viewName === 'settings') {
        pageTitle.innerText = "App Settings";
        fetchAndApplySettings(); // Pulls the latest colors/toggles from Supabase!
    }
}

// ==========================================
// DASHBOARD LOGIC
// ==========================================
async function fetchAndRenderDashboard() {
    document.getElementById('dashboardCardContainer').innerHTML = '<div style="padding: 40px; text-align: center; color: #94A3B8;">Loading athlete data...</div>';
    
    const response = await apiFetchDashboardData(); 
    
    if (!response) {
        document.getElementById('dashboardCardContainer').innerHTML = '<div style="padding: 40px; text-align: center; color: #EF4444;">Failed to load data. Please check your connection.</div>';
        return;
    }

    const data = response.athletes;
    allPeerStats = response.allStats; 

    const athleticismCategories = ['Vertical Jump', 'Sprint Time', 'Triple Jump', 'Mile Time'];
    const skillsCategories = ['Passing', 'Serving', 'Hitting', 'Setting', 'Defense', 'Receive'];

    data.forEach(athlete => {
        let athTotal = 0, athCount = 0;
        let skillTotal = 0, skillCount = 0;

        athleticismCategories.forEach(cat => {
            let rawVal = athlete.rawStats[cat];
            if (rawVal !== undefined && rawVal !== null) {
                let curvedScore = calculateBellCurveScore(cat, rawVal, allPeerStats[cat] || []);
                let numScore = parseFloat(curvedScore);
                if (!isNaN(numScore)) { athTotal += numScore; athCount++; }
            }
        });

        skillsCategories.forEach(cat => {
            let rawVal = athlete.rawStats[cat];
            if (rawVal !== undefined && rawVal !== null) {
                let curvedScore = calculateBellCurveScore(cat, rawVal, allPeerStats[cat] || []);
                let numScore = parseFloat(curvedScore);
                if (!isNaN(numScore)) { skillTotal += numScore; skillCount++; }
            }
        });

        athlete.athAvg = athCount > 0 ? parseFloat((athTotal / athCount).toFixed(1)) : 0;
        athlete.skillAvg = skillCount > 0 ? parseFloat((skillTotal / skillCount).toFixed(1)) : 0;
        athlete.overallAvg = (athCount > 0 || skillCount > 0) ? parseFloat(((athTotal + skillTotal) / (athCount + skillCount)).toFixed(1)) : 0;
    });

    globalAthleteData = data;

    updateStatCards(data);
    renderTable(globalAthleteData);
}

function updateStatCards(data) {
    const statGrid = document.getElementById('statGrid');
    if (!statGrid) return;

    // 1. Total & Pending
    let html = `<div class="stat-card"><span class="stat-title">Total</span><span class="stat-value">${data.length}</span></div>`;
    const evaluatingCount = data.filter(a => a.status === 'Evaluating' || !a.status).length;
    html += `<div class="stat-card" style="border-top-color: var(--color-eval);"><span class="stat-title">Pending</span><span class="stat-value">${evaluatingCount}</span></div>`;

    // 2. Dynamic Teams
    globalTeamNames.forEach(team => {
        const count = data.filter(a => a.status === team).length;
        html += `<div class="stat-card" style="border-top-color: var(--accentBlue);"><span class="stat-title">${team}</span><span class="stat-value">${count}</span></div>`;
    });

    // 3. Cuts
    const cutCount = data.filter(a => a.status === 'Cut').length;
    html += `<div class="stat-card" style="border-top-color: var(--color-cut);"><span class="stat-title">Cuts</span><span class="stat-value">${cutCount}</span></div>`;

    statGrid.innerHTML = html;
}

function filterTable() {
    renderTable(globalAthleteData);
}

function renderTable(dataToRender) {
    const container = document.getElementById('dashboardCardContainer');
    if (!container) return;
    container.innerHTML = '';

    const searchVal = document.getElementById('dashboardSearch')?.value.toLowerCase() || '';
    const filterGroup = document.getElementById('filterGroup')?.value || 'All';
    const filterStatus = document.getElementById('filterStatus')?.value || 'All';
    const filterPosition = document.getElementById('filterPosition')?.value || 'All';
    const sortBy = document.getElementById('sortBy')?.value || 'number';

    let filteredData = dataToRender.filter(athlete => {
        const textMatch = athlete.first_name.toLowerCase().includes(searchVal) || 
                          athlete.last_name.toLowerCase().includes(searchVal) || 
                          athlete.tryout_number.toString().includes(searchVal);
        const groupMatch = (filterGroup === 'All') || (athlete.tryout_group === filterGroup);
        const statusMatch = (filterStatus === 'All') || (athlete.status === filterStatus);
        const positionMatch = (filterPosition === 'All') || (athlete.preferred_position && athlete.preferred_position.includes(filterPosition));

        return textMatch && groupMatch && statusMatch && positionMatch;
    });

    filteredData.sort((a, b) => {
        if (sortBy === 'firstAsc') return a.first_name.localeCompare(b.first_name);
        if (sortBy === 'firstDesc') return b.first_name.localeCompare(a.first_name);
        if (sortBy === 'lastAsc') return a.last_name.localeCompare(b.last_name);
        if (sortBy === 'lastDesc') return b.last_name.localeCompare(a.last_name);
        if (sortBy === 'overallDesc') return b.overallAvg - a.overallAvg;
        if (sortBy === 'athDesc') return b.athAvg - a.athAvg;
        if (sortBy === 'skillDesc') return b.skillAvg - a.skillAvg;
        if (sortBy === 'gradeAsc') return parseInt(a.grade) - parseInt(b.grade);
        if (sortBy === 'gradeDesc') return parseInt(b.grade) - parseInt(a.grade);
        return parseInt(a.tryout_number) - parseInt(b.tryout_number);
    });

    if (filteredData.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #94A3B8;">No athletes match these filters.</div>';
        return;
    }

    filteredData.forEach(athlete => {
        // Dynamic Colors without needing extra CSS classes
        let statusColor = 'var(--color-eval)';
        if (athlete.status === 'Cut') statusColor = 'var(--color-cut)';
        else if (athlete.status !== 'Evaluating' && globalTeamNames.includes(athlete.status)) statusColor = 'var(--accentBlue)';

        let splashHtml = `<div class="team-splash" style="background: color-mix(in srgb, ${statusColor} 15%, transparent);"></div>`;

        const scoreBadge = athlete.overallAvg > 0 ? 
            `<div style="position: relative; z-index: 2; display: flex; justify-content: space-around; align-items: center; background: var(--primary); padding: 10px; border-radius: 8px; margin-top: 15px;">
              <div style="text-align: center;"><div style="font-size: 10px; color: #94A3B8; text-transform: uppercase; margin-bottom: 2px;">Overall</div><div style="font-weight: bold; color: var(--text-color); font-size: 15px;">⭐ ${athlete.overallAvg.toFixed(1)}</div></div>
              <div style="width: 1px; height: 20px; background: #3A4150;"></div>
              <div style="text-align: center;"><div style="font-size: 10px; color: #94A3B8; text-transform: uppercase; margin-bottom: 2px;">Skills</div><div style="color: var(--accentGreen); font-size: 14px; font-weight: bold;">🏐 ${athlete.skillAvg.toFixed(1)}</div></div>
              <div style="width: 1px; height: 20px; background: #3A4150;"></div>
              <div style="text-align: center;"><div style="font-size: 10px; color: #94A3B8; text-transform: uppercase; margin-bottom: 2px;">Athletic</div><div style="color: var(--accentBlue); font-size: 14px; font-weight: bold;">🏃 ${athlete.athAvg.toFixed(1)}</div></div>
            </div>` : 
            `<div style="position: relative; z-index: 2; text-align: center; color: #94A3B8; font-size: 12px; margin-top: 15px; padding: 10px; background: var(--primary); border-radius: 8px;">No scores recorded yet</div>`;

        // Generate the Dropdown Options dynamically
        let optionsHtml = `<option value="Evaluating" ${athlete.status === 'Evaluating' ? 'selected' : ''}>Evaluating</option>`;
        globalTeamNames.forEach(team => {
            optionsHtml += `<option value="${team}" ${athlete.status === team ? 'selected' : ''}>${team}</option>`;
        });
        optionsHtml += `<option value="Cut" ${athlete.status === 'Cut' ? 'selected' : ''}>Cut</option>`;

        const card = document.createElement('div');
        card.className = 'mobile-card';
        card.style.borderTop = `4px solid ${statusColor}`;
        card.style.cursor = 'pointer'; 
        card.onclick = () => openAthleteProfile(athlete.id);

        card.innerHTML = 
            `${splashHtml}
            <div style="position: relative; z-index: 1;">
              <div style="display: flex; gap: 15px; align-items: flex-start;">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; flex-shrink: 0;">
                  <div style="font-size: 16px; font-weight: bold; color: ${statusColor};">#${athlete.tryout_number}</div>
                  ${getAvatarHtml(athlete.photo_url)}
                </div>
                <div style="flex: 1; padding-top: 2px;">
                  <div style="font-weight: bold; font-size: 18px; color: var(--text-color); line-height: 1.2;">${athlete.first_name} ${athlete.last_name}</div>
                  <div style="font-size: 13px; color: #94A3B8; margin-top: 6px;">${athlete.grade}th Grade • ${athlete.preferred_position ? athlete.preferred_position.join(', ') : 'Unknown'}</div>
                  <div style="font-size: 12px; color: #94A3B8; margin-top: 2px;">Group ${athlete.tryout_group || 'Unassigned'}</div>
                </div>
                <select onchange="changeStatusInline(event, '${athlete.id}', this.value)" onclick="event.stopPropagation()" style="background: ${statusColor}20; color: ${statusColor}; padding: 6px 10px; border-radius: 12px; font-size: 11px; font-weight: bold; text-transform: uppercase; border: none; outline: none; cursor: pointer; flex-shrink: 0;">
                  ${optionsHtml}
                </select>
              </div>
              ${scoreBadge}
            </div>`;
        
        container.appendChild(card);
    });
}

// ==========================================
// ATHLETE PROFILE & STATUS
// ==========================================
function openAthleteProfile(athleteId) {
    currentProfileId = athleteId;
    loadView('profile');
    document.getElementById('pageTitle').innerText = "Athlete Profile";
    renderAthleteProfile(athleteId);
}

function renderAthleteProfile(athleteId) {
    const athlete = globalAthleteData.find(a => a.id === athleteId);
    if (!athlete) return;
    
    document.getElementById('profilePhotoContainer').innerHTML = getAvatarHtml(athlete.photo_url);
    const img = document.getElementById('profilePhotoContainer').querySelector('img, div');
    if (img) { img.style.width = '100px'; img.style.height = '100px'; img.style.fontSize = '40px'; }
    
    document.getElementById('profileName').innerText = `#${athlete.tryout_number} - ${athlete.first_name} ${athlete.last_name}`;
    document.getElementById('profileDetails').innerText = `Grade ${athlete.grade} • ${athlete.preferred_position ? athlete.preferred_position.join(', ') : 'Unknown'}`;
    
    document.getElementById('statusSelect').value = athlete.status;
    document.getElementById('groupSelect').value = athlete.tryout_group || 'Unassigned';

    renderProfileStats(athlete);
}

function renderProfileStats(athlete) {
    const grid = document.getElementById('profileStatsGrid');
    const loading = document.getElementById('profileStatsLoading');
    
    loading.style.display = 'none';
    grid.style.display = 'block';
    
    const athleticismCategories = ['Vertical Jump', 'Sprint Time', 'Triple Jump', 'Mile Time'];
    const skillsCategories = ['Passing', 'Serving', 'Hitting', 'Setting', 'Defense', 'Receive'];

    let athleticismHtml = '';
    let skillsHtml = '';

    const buildCardHtml = (category) => {
        let rawVal = athlete.rawStats[category];
        let hasData = (rawVal !== undefined && rawVal !== null);
        
        let curvedScore = '-';
        let displayVal = 'No data';
        let editVal = '';
        
        if (hasData) {
            curvedScore = calculateBellCurveScore(category, rawVal, allPeerStats[category] || []);
            displayVal = formatRawStat(category, rawVal);
            editVal = rawVal;
        }

        let rawHtml = '';
        if (athleticismCategories.includes(category)) {
             rawHtml = `<div style="font-size: 13px; color: #94A3B8; margin-bottom: 10px;">Raw: ${displayVal}</div>`;
        }

        return `<div onclick="editStat('${athlete.id}', '${category}', '${editVal}')" style="background: var(--bg-color); padding: 12px; border-radius: 8px; border: 1px solid #3A4150; text-align: center; position: relative; cursor: pointer; transition: 0.2s;">
            <div style="font-size: 11px; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px;">${category}</div>
            <div style="font-size: 26px; font-weight: bold; color: var(--secondary); margin: 4px 0;">${curvedScore}<span style="font-size: 14px; color:#94A3B8; font-weight: normal;"> / 5</span></div>
            ${rawHtml}
            <div style="font-size: 10px; color: var(--accentBlue); margin-top: 5px;">✎ Edit</div>
          </div>`;
    };

    athleticismCategories.forEach(cat => athleticismHtml += buildCardHtml(cat));
    skillsCategories.forEach(cat => skillsHtml += buildCardHtml(cat));

    const summaryCardsHtml = 
        `<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 25px;">
            <div style="background: var(--bg-color); padding: 15px 5px; border-radius: 8px; border: 1px solid var(--accentBlue); text-align: center;">
                <div style="font-size: 10px; color: var(--accentBlue); text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Athleticism</div>
                <div style="font-size: 24px; font-weight: bold; color: var(--text-color); margin-top: 5px;">${athlete.athAvg > 0 ? athlete.athAvg.toFixed(1) : '-'}</div>
            </div>
            <div style="background: var(--bg-color); padding: 15px 5px; border-radius: 8px; border: 1px solid var(--accentGreen); text-align: center;">
                <div style="font-size: 10px; color: var(--accentGreen); text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Skills</div>
                <div style="font-size: 24px; font-weight: bold; color: var(--text-color); margin-top: 5px;">${athlete.skillAvg > 0 ? athlete.skillAvg.toFixed(1) : '-'}</div>
            </div>
            <div style="background: var(--bg-color); padding: 15px 5px; border-radius: 8px; border: 1px solid var(--secondary); text-align: center;">
                <div style="font-size: 10px; color: var(--secondary); text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Overall</div>
                <div style="font-size: 24px; font-weight: bold; color: var(--text-color); margin-top: 5px;">${athlete.overallAvg > 0 ? athlete.overallAvg.toFixed(1) : '-'}</div>
            </div>
        </div>`;

    grid.innerHTML = 
        summaryCardsHtml + 
        `<div style="margin-bottom: 20px;">
            <h4 style="color: var(--text-color); margin-top: 0; margin-bottom: 10px; border-bottom: 1px solid #2A303C; padding-bottom: 5px;">Athleticism</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">${athleticismHtml}</div>
        </div>
        <div>
            <h4 style="color: var(--text-color); margin-top: 0; margin-bottom: 10px; border-bottom: 1px solid #2A303C; padding-bottom: 5px;">Volleyball Skills</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">${skillsHtml}</div>
        </div>`;
}

async function changeStatusInline(event, athleteId, newStatus) {
    if (event) event.stopPropagation();
    const athlete = globalAthleteData.find(a => a.id === athleteId);
    if (athlete) athlete.status = newStatus;
    renderTable(globalAthleteData);
    const result = await apiUpdateAthleteField(athleteId, 'status', newStatus);
    if (!result.success) {
        alert("Failed to update status on server.");
    }
}

async function changeAthleteGroup(newGroup) {
    if (!currentProfileId) return;
    const athlete = globalAthleteData.find(a => a.id === currentProfileId);
    if (athlete) athlete.tryout_group = newGroup;

    const result = await apiUpdateAthleteField(currentProfileId, 'tryout_group', newGroup);
    if (!result.success) alert("Failed to update group on server.");
}

async function saveStatus() {
    const newStatus = document.getElementById('statusSelect').value;
    if (!currentProfileId) return;
    
    const athlete = globalAthleteData.find(a => a.id === currentProfileId);
    if (athlete) athlete.status = newStatus;

    const result = await apiUpdateAthleteField(currentProfileId, 'status', newStatus);
    if (!result.success) alert("Failed to update status on server.");
}

// ==========================================
// STATION EVALUATOR
// ==========================================
function applyCustomLimits() { renderStationTable(); }

function renderStationTable() {
    const station = document.getElementById('stationSelect').value;
    const searchInput = document.getElementById('stationSearch')?.value.toLowerCase().trim() || '';
    const container = document.getElementById('stationCardContainer');
    const limitControls = document.getElementById('limitControls');
    const customMinInput = document.getElementById('customMin');
    const customMaxInput = document.getElementById('customMax');
    
    if(!container) return;
    
    if(!station) {
        if(limitControls) limitControls.style.display = 'none';
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #94A3B8;">Please select a Station to begin.</div>';
        return;
    }
    
    const config = STATION_CONFIG[station];
    if (currentSelectedStation !== station) {
        if(customMinInput) customMinInput.value = config.min;
        if(customMaxInput) customMaxInput.value = config.max;
        currentSelectedStation = station;
    }
    
    const activeMin = customMinInput ? parseFloat(customMinInput.value) : config.min;
    const activeMax = customMaxInput ? parseFloat(customMaxInput.value) : config.max;
    
    if(limitControls) limitControls.style.display = 'flex';
    
    const athletesToDisplay = globalAthleteData.filter(a => {
        const notScored = !a[`scored_${station}`];
        const matchesSearch = searchInput === '' || 
                              a.tryout_number.toString().includes(searchInput) || 
                              a.first_name.toLowerCase().includes(searchInput) || 
                              a.last_name.toLowerCase().includes(searchInput);
        return notScored && matchesSearch;
    });
    
    athletesToDisplay.sort((a, b) => parseInt(a.tryout_number) - parseInt(b.tryout_number));
    container.innerHTML = '';
    
    if (athletesToDisplay.length === 0) {
        if (searchInput !== '') {
            container.innerHTML = '<div style="text-align:center; padding: 40px; color: #94A3B8;">No unscored athletes match that search.</div>';
        } else {
            container.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--accentGreen); font-weight: bold;">All athletes evaluated for this station!</div>';
        }
        return;
    }

    athletesToDisplay.forEach(athlete => {
        let startValue = config.default;
        if (startValue < activeMin) startValue = activeMin;
        if (startValue > activeMax) startValue = activeMax;
        
        const card = document.createElement('div');
        card.className = 'mobile-card';
        card.innerHTML = 
            `<div class="card-header" style="display: flex; align-items: center; gap: 15px;">
              ${getAvatarHtml(athlete.photo_url)}
              <div style="flex: 1;"><strong style="color: var(--secondary); font-size: 16px;">#${athlete.tryout_number}</strong><br>${athlete.first_name} ${athlete.last_name}</div>
              <div id="display_${athlete.id}" style="text-align: right; font-size: 22px; font-weight: bold; color: var(--accentBlue);">${config.display(startValue, activeMax)}</div>
            </div>
            <input type="range" id="slider_${athlete.id}" min="${activeMin}" max="${activeMax}" step="${config.step}" value="${startValue}" oninput="updateSliderDisplay('${athlete.id}', '${station}', this.value)">
            <button class="btn-action" id="btnStat_${athlete.id}" onclick="submitStationScore('${athlete.id}', '${station}')" style="width: 100%; padding: 14px; font-size: 16px; margin-top: 5px;">Save Score</button>`;
        container.appendChild(card);
    });
}

function updateSliderDisplay(athleteId, station, rawValue) {
    const config = STATION_CONFIG[station];
    const activeMax = document.getElementById('customMax').value;
    document.getElementById(`display_${athleteId}`).innerText = config.display(rawValue, activeMax);
}

async function submitStationScore(athleteId, station) {
    const rawValue = document.getElementById(`slider_${athleteId}`).value;
    const btn = document.getElementById(`btnStat_${athleteId}`);
    
    btn.innerText = "Saving...";
    btn.disabled = true;

    const response = await apiSaveScoreToDatabase(athleteId, station, rawValue);
    
    if(response.success) {
        const athlete = globalAthleteData.find(a => a.id === athleteId);
        if (athlete) athlete[`scored_${station}`] = true;
        renderStationTable();
    } else {
        alert("Error: " + response.error);
        btn.innerText = "Save Score";
        btn.disabled = false;
    }
}

// ==========================================
// MILE TIME ENTRY
// ==========================================
function filterMileTable() {
    renderMileTable(globalAthleteData);
}

function renderMileTable(dataToRender) {
    const container = document.getElementById('mileTableBody');
    if (!container) return; 
    container.innerHTML = ''; 

    const searchTerm = document.getElementById('mileSearch')?.value.toLowerCase() || '';

    const athletesToDisplay = dataToRender.filter(a => {
        const savedNow = a.mileTimeSaved === true;
        const savedInDB = a.rawStats && a.rawStats['Mile Time'] !== undefined && a.rawStats['Mile Time'] !== null;
        
        const matchesSearch = a.first_name.toLowerCase().includes(searchTerm) || 
                              a.last_name.toLowerCase().includes(searchTerm) || 
                              a.tryout_number.toString().includes(searchTerm);
                              
        return !savedNow && !savedInDB && matchesSearch;
    });

    athletesToDisplay.sort((a, b) => parseInt(a.tryout_number) - parseInt(b.tryout_number));

    if (athletesToDisplay.length === 0) {
        container.innerHTML = '<tr><td colspan="4" style="padding: 20px; text-align: center; color: var(--accentGreen); font-weight: bold;">All athletes have recorded times!</td></tr>';
        return;
    }

    athletesToDisplay.forEach(athlete => {
        const row = document.createElement('tr');
        row.innerHTML = 
            `<td><strong style="color: var(--secondary);">#${athlete.tryout_number}</strong></td>
             <td>
               <div style="font-weight: bold; color: var(--text-color);">${athlete.first_name} ${athlete.last_name}</div>
               <div style="font-size: 12px; color: #94A3B8;">Grp ${athlete.tryout_group || 'N/A'} • ${athlete.grade}th</div>
             </td>
             <td>
               <input type="text" id="mileTime_${athlete.id}" placeholder="MM:SS" style="width: 70px; padding: 8px; border-radius: 6px; border: 1px solid #3A4150; background: var(--primary); color: white; text-align: center;">
             </td>
             <td>
               <button onclick="saveMileTime('${athlete.id}')" class="btn-action" style="background: var(--accentBlue); color: white;">Save</button>
             </td>`;
        container.appendChild(row);
    });
}

async function saveMileTime(athleteId) {
    const inputField = document.getElementById(`mileTime_${athleteId}`);
    let timeValue = inputField.value.trim().replace('.', ':');
    
    if (!timeValue || !timeValue.includes(':')) {
        alert("Please include a colon (e.g., 7:45)");
        return;
    }

    const parts = timeValue.split(':');
    const minutes = parseInt(parts[0], 10) || 0;
    const seconds = parseInt(parts[1], 10) || 0;
    const totalSeconds = (minutes * 60) + seconds;
    
    const btn = inputField.parentElement.nextElementSibling.querySelector('button');
    btn.innerText = "Saving...";
    btn.style.background = "#94A3B8";
    btn.disabled = true;

    const response = await apiSaveScoreToDatabase(athleteId, "Mile Time", totalSeconds);
    
    if (response.success) {
        btn.innerText = "Saved!";
        btn.style.background = "var(--accentGreen)";
        setTimeout(() => { 
            const athlete = globalAthleteData.find(a => a.id === athleteId);
            if (athlete) athlete.mileTimeSaved = true; 
            filterMileTable(); 
        }, 1000);
    } else {
        alert("Error saving time: " + response.error);
        btn.innerText = "Save";
        btn.style.background = "var(--accentBlue)";
        btn.disabled = false;
    }
}

// ==========================================
// HELPERS
// ==========================================
function getAvatarHtml(photoUrl) {
    if (!photoUrl) {
        return '<div style="width: 50px; height: 50px; border-radius: 8px; background: #3A4150; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #94A3B8; flex-shrink: 0;">📷</div>';
    }
    return `<img src="${photoUrl}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover; border: 2px solid var(--secondary); flex-shrink: 0;">`;
}

function formatRawStat(category, rawVal) {
    if (rawVal === undefined || rawVal === null) return 'No data';
    if (category === 'Mile Time') {
        let m = Math.floor(parseFloat(rawVal) / 60);
        let s = Math.round(parseFloat(rawVal) % 60);
        return m + ':' + (s < 10 ? '0' : '') + s;
    }
    if (category.includes('Vertical') || category.includes('Triple Jump')) {
        let val = parseFloat(rawVal);
        let feet = Math.floor(val / 12);
        let inches = val % 12;
        return feet + "'" + inches + '"';
    }
    if (category.includes('Sprint')) return parseFloat(rawVal).toFixed(2) + 's';
    return rawVal; 
}

// ==========================================
// PHOTO CHECK-IN
// ==========================================
function renderPhotoTable() {
    const tbody = document.getElementById('photoTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    const missingPhotos = globalAthleteData.filter(a => !a.photo_url);
    const searchInput = document.getElementById('photoSearch')?.value.toLowerCase().trim() || '';

    const athletesToDisplay = missingPhotos.filter(a => {
        return searchInput === '' || 
               a.tryout_number.toString().includes(searchInput) || 
               a.first_name.toLowerCase().includes(searchInput) || 
               a.last_name.toLowerCase().includes(searchInput);
    });

    if (athletesToDisplay.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">All filtered athletes have photos!</td></tr>';
        return;
    }

    athletesToDisplay.forEach(athlete => {
        const tr = document.createElement('tr');
        tr.innerHTML = 
            `<td><strong>#${athlete.tryout_number}</strong></td>
            <td>${athlete.first_name} ${athlete.last_name}</td>
            <td>${athlete.grade}</td>
            <td>
              <button class="btn-action" id="btnPhoto_${athlete.id}" onclick="triggerCamera('${athlete.id}')">
                📷 Take Photo
              </button>
            </td>`;
        tbody.appendChild(tr);
    });
}

function filterPhotoTable() { renderPhotoTable(); }

function triggerCamera(athleteId) {
    document.getElementById('currentUploadId').value = athleteId;
    document.getElementById('cameraInput').click();
}

async function processPhoto(event) {
    const file = event.target.files[0];
    if (!file) return;

    const athleteId = document.getElementById('currentUploadId').value;
    const btn = document.getElementById(`btnPhoto_${athleteId}`);
    
    if (btn) {
        btn.innerText = '⏳ Uploading...';
        btn.disabled = true;
    }

    const response = await apiUploadAthletePhoto(athleteId, file);
    
    if (response.success) {
        const athlete = globalAthleteData.find(a => a.id === athleteId);
        if (athlete) athlete.photo_url = response.url;
        renderPhotoTable(); 
    } else {
        alert("Error uploading: " + response.error);
        if (btn) {
            btn.innerText = '📷 Take Photo';
            btn.disabled = false;
        }
    }
}

// ==========================================
// EDIT STAT MODAL
// ==========================================
let editModalAthleteId = null;
let editModalCategory = null;

function editStat(athleteId, category, currentVal) {
    editModalAthleteId = athleteId;
    editModalCategory = category;

    let promptVal = currentVal;
    let placeholder = "";

    if (category === 'Mile Time') {
        placeholder = "e.g., 6:30";
        if (currentVal && currentVal !== 'No data') promptVal = formatRawStat(category, currentVal); 
    } else if (category.includes('Jump')) {
        placeholder = "e.g., 8'11\"";
        if (currentVal && currentVal !== 'No data') promptVal = formatRawStat(category, currentVal);
    } else if (category.includes('Sprint')) {
        placeholder = "e.g., 4.5";
        if (currentVal && currentVal !== 'No data') promptVal = parseFloat(currentVal).toFixed(2); 
    } else {
        placeholder = "e.g., 3.5";
        if (currentVal && currentVal !== 'No data') promptVal = currentVal;
    }

    document.getElementById('editModalTitle').innerText = 'Edit ' + category;
    
    const inputField = document.getElementById('editModalInput');
    inputField.placeholder = placeholder;
    inputField.value = (promptVal === 'No data' ? '' : promptVal);
    
    document.getElementById('editModalFormattedDisplay').innerText = ''; 
    document.getElementById('editModalOverlay').style.display = 'flex';
    inputField.focus();
}

function closeEditModal() {
    document.getElementById('editModalOverlay').style.display = 'none';
    document.getElementById('editModalInput').value = '';
    document.getElementById('editModalFormattedDisplay').innerText = ''; 
}

function updateModalFormattedDisplay() { }

async function confirmEditStat() {
    const newVal = document.getElementById('editModalInput').value.trim();
    const btn = document.getElementById('editModalSaveBtn');

    if (newVal !== '') {
        btn.innerText = "Saving...";
        btn.disabled = true;

        let valToSave = newVal;
        
        if (editModalCategory === 'Mile Time') {
            let cleanVal = newVal.replace('.', ':'); 
            if (cleanVal.includes(':')) {
                let parts = cleanVal.split(':');
                valToSave = (parseInt(parts[0]) * 60) + (parseInt(parts[1]) || 0);
            } else {
                valToSave = parseFloat(cleanVal); 
            }
        } 
        else if (editModalCategory.includes('Jump')) {
            let match = newVal.match(/(\d+)['\s]+([\d.]+)/);
            if (match) {
                valToSave = (parseInt(match[1]) * 12) + parseFloat(match[2]);
            } else {
                valToSave = parseFloat(newVal);
            }
        } 
        else if (editModalCategory.includes('Sprint')) {
            valToSave = parseFloat(newVal.replace(/s/i, '')); 
        }
        else {
            valToSave = parseFloat(newVal); 
        }

        const response = await apiSaveScoreToDatabase(editModalAthleteId, editModalCategory, valToSave);
        
        if(response.success) {
            closeEditModal();
            btn.innerText = "Save";
            btn.disabled = false;
            
            const athlete = globalAthleteData.find(a => a.id === editModalAthleteId);
            if (athlete) athlete.rawStats[editModalCategory] = valToSave; 
            renderProfileStats(athlete); 
        } else {
            alert("Error saving: " + response.error);
            btn.innerText = "Save";
            btn.disabled = false;
        }
    } else {
        alert("Please enter a value before saving.");
    }
}

// ==========================================
// GLOBAL APP SETTINGS LOGIC
// ==========================================
async function fetchAndApplySettings() {
    const settings = await apiFetchSettings();
    if (settings) {
        document.documentElement.style.setProperty('--secondary', settings.theme_color);
        
        const colorInput = document.getElementById('settingThemeColor');
        if (colorInput) {
            colorInput.value = settings.theme_color;
            document.getElementById('settingThemeHex').value = settings.theme_color;
            document.getElementById('settingRequireId').checked = settings.require_student_id;
            document.getElementById('settingProgramName').value = settings.program_name || '';
            document.getElementById('settingLogoUrl').value = settings.logo_url || '';
            document.getElementById('settingTeamNames').value = settings.team_names || 'Varsity, JV, Freshman';
            
            // Update Sidebar Name
            const sidebarName = document.getElementById('sidebarSchoolName');
            if (sidebarName && settings.program_name) {
                sidebarName.innerHTML = `${settings.program_name}<br><span style="color: var(--secondary); font-size: 14px;">Tryout Manager</span>`;
            }

            // Parse the dynamic teams and update dropdowns globally!
            if (settings.team_names) {
                globalTeamNames = settings.team_names.split(',').map(s => s.trim()).filter(s => s !== '');
            }

            // Dynamically rebuild the Dashboard Filter Dropdown
            const filterStatus = document.getElementById('filterStatus');
            if (filterStatus) {
                filterStatus.innerHTML = `<option value="All">All Statuses</option><option value="Evaluating">Evaluating (Pending)</option>`;
                globalTeamNames.forEach(team => filterStatus.innerHTML += `<option value="${team}">${team}</option>`);
                filterStatus.innerHTML += `<option value="Cut">Cut</option>`;
            }

            // Dynamically rebuild the Athlete Profile Dropdown
            const profileStatus = document.getElementById('statusSelect');
            if (profileStatus) {
                profileStatus.innerHTML = `<option value="Evaluating">Evaluating (Pending)</option>`;
                globalTeamNames.forEach(team => profileStatus.innerHTML += `<option value="${team}">${team}</option>`);
                profileStatus.innerHTML += `<option value="Cut">Cut</option>`;
            }
        }
    }
}

async function saveAppSettings() {
    const btn = document.getElementById('btnSaveSettings');
    btn.innerText = "Saving...";
    btn.disabled = true;

    const newColor = document.getElementById('settingThemeColor').value;
    const requireId = document.getElementById('settingRequireId').checked;
    const programName = document.getElementById('settingProgramName').value.trim();
    const logoUrl = document.getElementById('settingLogoUrl').value.trim();
    const teamNames = document.getElementById('settingTeamNames').value.trim();

    const response = await apiSaveSettings(requireId, newColor, programName, logoUrl, teamNames);
    
    if (response.success) {
        // Immediately fetch and redraw the dashboard to show new team cards/filters
        await fetchAndApplySettings();
        fetchAndRenderDashboard(); 

        btn.innerText = "Saved!";
        btn.style.background = "var(--accentGreen)";
        setTimeout(() => {
            btn.innerText = "Save Settings";
            btn.style.background = "var(--secondary)";
            btn.disabled = false;
        }, 1500);
    } else {
        alert("Failed to save settings.");
        btn.innerText = "Save Settings";
        btn.disabled = false;
    }
}
