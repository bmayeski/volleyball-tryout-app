// ==========================================
// GLOBAL STATE
// ==========================================
let globalAthleteData = []; 
let allPeerStats = {}; // Stores arrays of all scores for the Bell Curve math
let currentProfileId = null;
let currentSelectedStation = "";
let globalTeamNames = ['Varsity', 'JV', 'Freshman']; // Default fallback
let globalTryoutGroups = ['1', '2', '3'];

const STATION_CONFIG = {
    "Vertical Jump": { min: 84, max: 120, step: 0.5, default: 90, display: (val) => Math.floor(val/12) + "'" + (val%12) + '"' }, 
    "Sprint Time": { min: 4.0, max: 8.0, step: 0.1, default: 5.5, display: (val) => parseFloat(val).toFixed(1) + "s" },
    "Triple Jump": { min: 120, max: 360, step: 1, default: 240, display: (val) => Math.floor(val/12) + "'" + (val%12) + '"' }, 
    "Passing": { min: 0, max: 5, step: 0.5, default: 2.5, display: (val, max) => Number(val).toFixed(1) + " / " + max },
    "Serving": { min: 0, max: 5, step: 0.5, default: 2.5, display: (val, max) => Number(val).toFixed(1) + " / " + max },
    "Hitting": { min: 0, max: 5, step: 0.5, default: 2.5, display: (val, max) => Number(val).toFixed(1) + " / " + max },
    "Setting": { min: 0, max: 5, step: 0.5, default: 2.5, display: (val, max) => Number(val).toFixed(1) + " / " + max },
    "Defense": { min: 0, max: 5, step: 0.5, default: 2.5, display: (val, max) => Number(val).toFixed(1) + " / " + max },
    "Receive": { min: 0, max: 5, step: 0.5, default: 2.5, display: (val, max) => Number(val).toFixed(1) + " / " + max }
};

// NEW: Smart Metric Formatter Helper
// Automatically formats numbers into MM:SS, Inches, Percentages, etc.
function getSmartMetricConfig(stationName) {
    const dbMetric = globalMetricsData.find(m => m.name === stationName);
    
    // Grab base config if it exists, otherwise set a baseline
    let config = STATION_CONFIG[stationName] ? { ...STATION_CONFIG[stationName] } : { min: 0, max: 5, step: 0.5 };
    
    if (dbMetric) {
        // Override bounds with your database Settings
        if (dbMetric.min_value !== null) config.min = parseFloat(dbMetric.min_value);
        if (dbMetric.max_value !== null) config.max = parseFloat(dbMetric.max_value);
        
        // Smart Formatting based on the measurement type
        if (dbMetric.measurement_type === 'time') {
            config.display = (v) => {
                if (config.max >= 60) {
                    const mins = Math.floor(v / 60);
                    const secs = Math.floor(v % 60).toString().padStart(2, '0');
                    return `${mins}:${secs}`;
                }
                return Number(v).toFixed(1) + "s";
            };
            if (config.max >= 60) config.step = 1; // Snap to whole seconds for long runs
        } else if (dbMetric.measurement_type === 'inches') {
            config.display = (v) => Math.floor(v/12) + "'" + (v%12) + '"';
            config.step = 1;
        } else if (dbMetric.measurement_type === 'count') {
            config.display = (v) => Math.round(v) + " reps";
            config.step = 1;
        } else if (dbMetric.measurement_type === 'percentage') {
            config.display = (v) => Math.round(v) + "%";
            config.step = 1;
        } else if (dbMetric.measurement_type === 'mph') {
            config.display = (v) => Math.round(v) + " mph";
            config.step = 1;
        } else {
            config.display = (v, m) => Number(v).toFixed(1) + " / " + m;
        }
    }
    
    // Default the slider to start exactly in the middle
    if (config.default === undefined) {
        config.default = config.min + ((config.max - config.min) / 2);
    }
    
    return config;
}

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
    
    // Ensure metrics are loaded BEFORE trying to calculate scores
    if (globalMetricsData.length === 0) {
        globalMetricsData = await apiFetchAllMetrics();
    }

    const response = await apiFetchDashboardData(); 
    
    if (!response) {
        document.getElementById('dashboardCardContainer').innerHTML = '<div style="padding: 40px; text-align: center; color: #EF4444;">Failed to load data.</div>';
        return;
    }

    const data = response.athletes;
    allPeerStats = response.allStats; 

    // DYNAMIC GROUPS: Build these arrays straight from your Database
    const activeMetrics = globalMetricsData.filter(m => m.is_active);
    const athleticismCategories = activeMetrics.filter(m => m.category === 'Athleticism').map(m => m.name);
    const skillsCategories = activeMetrics.filter(m => m.category === 'Volleyball Skills').map(m => m.name);

    data.forEach(athlete => {
        let athTotal = 0, athCount = 0;
        let skillTotal = 0, skillCount = 0;

        athleticismCategories.forEach(metric => {
            let rawVal = athlete.rawStats[metric];
            if (rawVal !== undefined && rawVal !== null) {
                let curvedScore = calculateBellCurveScore(metric, rawVal, allPeerStats[metric] || []);
                let numScore = parseFloat(curvedScore);
                if (!isNaN(numScore)) { athTotal += numScore; athCount++; }
            }
        });

        skillsCategories.forEach(metric => {
            let rawVal = athlete.rawStats[metric];
            if (rawVal !== undefined && rawVal !== null) {
                let curvedScore = calculateBellCurveScore(metric, rawVal, allPeerStats[metric] || []);
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

    // THE UPGRADE: Added !important to force the row layout over your CSS file
    const compactCardStyle = "cursor: pointer; padding: 12px 16px !important; display: flex !important; flex-direction: row !important; justify-content: space-between !important; align-items: center !important; min-height: 0 !important;";
    const titleStyle = "font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0; color: #94A3B8; text-align: left;";
    const valueStyle = "font-size: 18px; font-weight: bold; margin: 0; color: var(--text-color); text-align: right;";

    // 1. Total & Pending
    let html = `<div class="stat-card" style="${compactCardStyle}" onclick="filterByCard('All')">
                  <span class="stat-title" style="${titleStyle}">Total</span>
                  <span class="stat-value" style="${valueStyle}">${data.length}</span>
                </div>`;
    
    const evaluatingCount = data.filter(a => a.status === 'Evaluating' || !a.status).length;
    html += `<div class="stat-card" style="border-top-color: var(--color-eval); ${compactCardStyle}" onclick="filterByCard('Evaluating')">
               <span class="stat-title" style="${titleStyle}">Pending</span>
               <span class="stat-value" style="${valueStyle}">${evaluatingCount}</span>
             </div>`;

    // 2. Dynamic Teams 
    globalTeamNames.forEach((team, index) => {
        const count = data.filter(a => a.status === team).length;
        const teamColor = getTeamColor(team, index);
        html += `<div class="stat-card" style="border-top-color: ${teamColor}; ${compactCardStyle}" onclick="filterByCard('${team}')" title="${team}">
                   <span class="stat-title" style="${titleStyle}">${team}</span>
                   <span class="stat-value" style="${valueStyle}">${count}</span>
                 </div>`;
    });

    // 3. Cuts
    const cutCount = data.filter(a => a.status === 'Cut').length;
    html += `<div class="stat-card" style="border-top-color: var(--color-cut); ${compactCardStyle}" onclick="filterByCard('Cut')">
               <span class="stat-title" style="${titleStyle}">Cuts</span>
               <span class="stat-value" style="${valueStyle}">${cutCount}</span>
             </div>`;

    statGrid.innerHTML = html;
}

// NEW: Toggles the visibility of the Team Breakdown grid
function toggleStatGrid() {
    const grid = document.getElementById('statGrid');
    const icon = document.getElementById('statGridIcon');
    
    if (grid.style.display === 'none') {
        grid.style.display = 'grid';
        icon.innerText = '▼';
    } else {
        grid.style.display = 'none';
        icon.innerText = '▶';
    }
}

function filterByCard(statusValue) {
    const statusDropdown = document.getElementById('filterStatus');
    if (statusDropdown) {
        statusDropdown.value = statusValue; // Changes the dropdown to match the card
        filterTable(); // Redraws the table!
    }
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
        // --- THE UPGRADE: Smart Status Colors ---
        let statusColor = 'var(--color-eval)';
        if (athlete.status === 'Cut') {
            statusColor = 'var(--color-cut)';
        } else if (athlete.status !== 'Evaluating' && globalTeamNames.includes(athlete.status)) {
            const teamIndex = globalTeamNames.indexOf(athlete.status);
            statusColor = getTeamColor(athlete.status, teamIndex);
        }

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

        // Generate the Dropdown Options dynamically (Forcing dark backgrounds so it's readable!)
        const optionStyle = 'style="background: #232732; color: #E2E8F0;"';
        
        let optionsHtml = `<option value="Evaluating" ${optionStyle} ${athlete.status === 'Evaluating' ? 'selected' : ''}>Evaluating</option>`;
        globalTeamNames.forEach(team => {
            optionsHtml += `<option value="${team}" ${optionStyle} ${athlete.status === team ? 'selected' : ''}>${team}</option>`;
        });
        optionsHtml += `<option value="Cut" ${optionStyle} ${athlete.status === 'Cut' ? 'selected' : ''}>Cut</option>`;

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
                  ${getAvatarHtml(athlete.photo_url, athlete.id)}
                </div>
                <div style="flex: 1; padding-top: 2px;">
                  <div style="font-weight: bold; font-size: 18px; color: var(--text-color); line-height: 1.2;">${athlete.first_name} ${athlete.last_name}</div>
                  <div style="font-size: 13px; color: #94A3B8; margin-top: 6px;">${athlete.grade}th Grade • ${athlete.preferred_position ? athlete.preferred_position.join(', ') : 'Unknown'}</div>
                  <div style="font-size: 12px; color: #94A3B8; margin-top: 2px;">Group ${athlete.tryout_group || 'Unassigned'}</div>
                </div>
                <select onchange="changeStatusInline(event, '${athlete.id}', this.value)" onclick="event.stopPropagation()" style="background: color-mix(in srgb, ${statusColor} 15%, transparent); color: ${statusColor}; padding: 6px 10px; border-radius: 12px; font-size: 11px; font-weight: bold; text-transform: uppercase; border: none; outline: none; cursor: pointer; flex-shrink: 0;">
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
    
    document.getElementById('profilePhotoContainer').innerHTML = getAvatarHtml(athlete.photo_url, athlete.id);
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
    
    // DYNAMIC GROUPS
    const activeMetrics = globalMetricsData.filter(m => m.is_active);
    const athleticismCategories = activeMetrics.filter(m => m.category === 'Athleticism').map(m => m.name);
    const skillsCategories = activeMetrics.filter(m => m.category === 'Volleyball Skills').map(m => m.name);

    let athleticismHtml = '';
    let skillsHtml = '';

    const buildCardHtml = (metricName) => {
        let rawVal = athlete.rawStats[metricName];
        let hasData = (rawVal !== undefined && rawVal !== null);
        
        let curvedScore = '-';
        let displayVal = 'No data';
        let editVal = '';
        
        if (hasData) {
            curvedScore = calculateBellCurveScore(metricName, rawVal, allPeerStats[metricName] || []);
            displayVal = formatRawStat(metricName, rawVal);
            editVal = rawVal;
        }

        let rawHtml = '';
        const metricDef = globalMetricsData.find(m => m.name === metricName);
        const isScale = metricDef ? metricDef.measurement_type === 'scale_0_to_5' : false;

        // Show the raw value below the score if it's NOT a standard 0-5 scale
        if (!isScale) {
             rawHtml = `<div style="font-size: 13px; color: #94A3B8; margin-bottom: 10px;">Raw: ${displayVal}</div>`;
        }

        return `<div onclick="editStat('${athlete.id}', '${metricName}', '${editVal}')" style="background: var(--bg-color); padding: 12px; border-radius: 8px; border: 1px solid #3A4150; text-align: center; position: relative; cursor: pointer; transition: 0.2s;">
            <div style="font-size: 11px; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px;">${metricName}</div>
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

    // Instantly update UI locally
    const athlete = globalAthleteData.find(a => a.id === athleteId);
    if (athlete) athlete.status = newStatus;
    
    // NEW: Redraw BOTH the cards and the table!
    updateStatCards(globalAthleteData);
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

    // NEW: Ensure cards update in the background when editing a profile
    updateStatCards(globalAthleteData);

    const result = await apiUpdateAthleteField(currentProfileId, 'status', newStatus);
    if (!result.success) alert("Failed to update status on server.");
}

// ==========================================
// STATION EVALUATOR
// ==========================================
async function applyCustomLimits() {
    const station = document.getElementById('stationSelect').value;
    if (!station) return;
    
    const newMin = parseFloat(document.getElementById('customMin').value);
    const newMax = parseFloat(document.getElementById('customMax').value);
    
    if (isNaN(newMin) || isNaN(newMax)) return;

    // 1. Find the metric in the global state
    const metric = globalMetricsData.find(m => m.name === station);
    if (!metric) return;
    
    // 2. Update locally immediately for a snappy UI
    metric.min_value = newMin;
    metric.max_value = newMax;
    
    // 3. Re-render the sliders right away
    renderStationTable();
    
    // 4. Send the update to the database in the background
    const response = await apiUpdateMetricLimits(metric.id, newMin, newMax);
    if (!response.success) {
        alert("Failed to save new limits to the database: " + response.error);
    }
}

function renderStationTable() {
    const station = document.getElementById('stationSelect').value;
    const container = document.getElementById('stationCardContainer');
    const searchInput = document.getElementById('stationSearch').value.toLowerCase();
    const limitControls = document.getElementById('limitControls');
    
    if (!station) {
        container.innerHTML = '<div style="text-align:center; padding: 40px; color: #94A3B8;">Select a station above to begin evaluating.</div>';
        if(limitControls) limitControls.style.display = 'none';
        return;
    }

    const config = getSmartMetricConfig(station);
    const activeMin = config.min;
    const activeMax = config.max;
    
    // NEW: Show the controls and populate them with the current metric's bounds
    if (limitControls) {
        limitControls.style.display = 'flex';
        document.getElementById('customMin').value = activeMin;
        document.getElementById('customMax').value = activeMax;
    }
    
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
        
        // --- NEW: Generate Dynamic Slider Track Labels ---
        let tickLabels = '';
        const range = activeMax - activeMin;
        
        if (range <= 10) {
            // For 0-5 scales: show every whole number perfectly spaced
            let spans = '';
            for(let i = Math.ceil(activeMin); i <= Math.floor(activeMax); i++) {
                spans += `<span>${i}</span>`;
            }
            tickLabels = `<div style="display: flex; justify-content: space-between; padding: 0 4px; color: #94A3B8; font-size: 12px; margin-top: 2px; margin-bottom: 12px; font-weight: bold;">${spans}</div>`;
        } else {
            // For large athletic scales (inches/time): show Min, Middle, and Max
            const mid = activeMin + (range / 2);
            tickLabels = `<div style="display: flex; justify-content: space-between; padding: 0 4px; color: #94A3B8; font-size: 11px; margin-top: 2px; margin-bottom: 12px;">
                            <span>${config.display(activeMin, activeMax).split(' ')[0]}</span>
                            <span>${config.display(mid, activeMax).split(' ')[0]}</span>
                            <span>${config.display(activeMax, activeMax).split(' ')[0]}</span>
                          </div>`;
        }
        
        const card = document.createElement('div');
        card.className = 'mobile-card';
        card.innerHTML = 
            `<div class="card-header" style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
              ${getAvatarHtml(athlete.photo_url, athlete.id)}
              <div style="flex: 1;"><strong style="color: var(--secondary); font-size: 16px;">#${athlete.tryout_number}</strong><br>${athlete.first_name} ${athlete.last_name}</div>
              <div id="display_${athlete.id}" style="text-align: right; font-size: 26px; font-weight: bold; color: var(--accentBlue);">${config.display(startValue, activeMax)}</div>
            </div>
            
            <!-- Thicker slider for mobile thumbs -->
            <input type="range" id="slider_${athlete.id}" min="${activeMin}" max="${activeMax}" step="${config.step}" value="${startValue}" oninput="updateSliderDisplay('${athlete.id}', '${station}', this.value)" style="width: 100%; height: 12px; accent-color: var(--secondary); cursor: pointer;">
            
            <!-- Inject the visual labels directly beneath the slider -->
            ${tickLabels}
            
            <button class="btn-action" id="btnStat_${athlete.id}" onclick="submitStationScore('${athlete.id}', '${station}')" style="width: 100%; padding: 14px; font-size: 16px; margin-top: 5px;">Save Score</button>`;
        container.appendChild(card);
    });
}

function updateSliderDisplay(athleteId, station, val) {
    const config = getSmartMetricConfig(station);
    const displayDiv = document.getElementById(`display_${athleteId}`);
    if (displayDiv) {
        displayDiv.innerText = config.display(val, config.max);
    }
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

// Add this near the top of app.js with your other GLOBAL STATE variables
let currentRunMode = "Mile Time";

// Add this function to handle the UI toggle switch
function setRunMode(mode) {
    currentRunMode = mode;

    // Update Toggle Button Styles
    const btnMile = document.getElementById('btnToggleMile');
    const btnHalf = document.getElementById('btnToggleHalf');

    if (mode === 'Mile Time') {
        btnMile.style.background = 'var(--secondary)';
        btnMile.style.color = 'white';
        btnHalf.style.background = 'transparent';
        btnHalf.style.color = '#94A3B8';
    } else {
        btnHalf.style.background = 'var(--secondary)';
        btnHalf.style.color = 'white';
        btnMile.style.background = 'transparent';
        btnMile.style.color = '#94A3B8';
    }

    // Update Table Header
    document.getElementById('runTimeHeader').innerText = mode;

    // Re-render the table with unscored athletes for the new mode
    filterMileTable();
}

// Update your existing renderMileTable function
function renderMileTable(dataToRender) {
    const container = document.getElementById('mileTableBody');
    if (!container) return; 
    container.innerHTML = ''; 

    const searchTerm = document.getElementById('mileSearch')?.value.toLowerCase() || '';

    const athletesToDisplay = dataToRender.filter(a => {
        // Create a dynamic flag key (e.g., 'MileTimeSaved' or 'HalfMileTimeSaved')
        const flagKey = currentRunMode.replace(/\s+/g, '') + 'Saved';
        const savedNow = a[flagKey] === true;
        const savedInDB = a.rawStats && a.rawStats[currentRunMode] !== undefined && a.rawStats[currentRunMode] !== null;
        
        const matchesSearch = a.first_name.toLowerCase().includes(searchTerm) || 
                              a.last_name.toLowerCase().includes(searchTerm) || 
                              a.tryout_number.toString().includes(searchTerm);
                              
        return !savedNow && !savedInDB && matchesSearch;
    });

    athletesToDisplay.sort((a, b) => parseInt(a.tryout_number) - parseInt(b.tryout_number));

    if (athletesToDisplay.length === 0) {
        container.innerHTML = `<tr><td colspan="4" style="padding: 20px; text-align: center; color: var(--accentGreen); font-weight: bold;">All athletes have recorded ${currentRunMode.toLowerCase()}s!</td></tr>`;
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
               <input type="text" id="runTime_${athlete.id}" placeholder="MM:SS" style="width: 70px; padding: 8px; border-radius: 6px; border: 1px solid #3A4150; background: var(--primary); color: white; text-align: center;">
             </td>
             <td>
               <button onclick="saveRunTime('${athlete.id}')" class="btn-action" style="background: var(--accentBlue); color: white;">Save</button>
             </td>`;
        container.appendChild(row);
    });
}

// Rename saveMileTime to saveRunTime and make it dynamic
async function saveRunTime(athleteId) {
    const inputField = document.getElementById(`runTime_${athleteId}`);
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

    // Use currentRunMode instead of "Mile Time"
    const response = await apiSaveScoreToDatabase(athleteId, currentRunMode, totalSeconds);
    
    if (response.success) {
        btn.innerText = "Saved!";
        btn.style.background = "var(--accentGreen)";
        setTimeout(() => { 
            const athlete = globalAthleteData.find(a => a.id === athleteId);
            if (athlete) {
                // Set dynamic flag so they vanish from the active list
                const flagKey = currentRunMode.replace(/\s+/g, '') + 'Saved';
                athlete[flagKey] = true; 
            }
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
function getAvatarHtml(photoUrl, athleteId) {
    // Adds the click listener and stops the card underneath it from opening
    const clickHandler = athleteId ? `onclick="openPhotoModal(event, '${athleteId}')"` : '';
    
    if (!photoUrl) {
        return `<div ${clickHandler} style="width: 50px; height: 50px; border-radius: 8px; background: #3A4150; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #94A3B8; flex-shrink: 0; cursor: pointer; border: 2px dashed #94A3B8;">📷</div>`;
    }
    return `<img src="${photoUrl}" ${clickHandler} style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover; border: 2px solid var(--secondary); flex-shrink: 0; cursor: pointer;">`;
}

function formatRawStat(metricName, rawVal) {
    if (rawVal === undefined || rawVal === null) return 'No data';
    
    // Leverage the smart configuration from your database settings
    const config = getSmartMetricConfig(metricName);
    if (config && config.display) {
        return config.display(rawVal, config.max);
    }
    return rawVal; 
}

function getTeamColor(teamName, index) {
    if (!teamName) return '#94A3B8';
    const name = teamName.toLowerCase();
    
    // 1. Smart Name Matching (If the team name has a color, use it!)
    if (name.includes('white')) return '#F8FAFC'; // slightly off-white for dark mode visibility
    if (name.includes('blue')) return '#3B82F6';
    if (name.includes('red')) return '#EF4444';
    if (name.includes('green')) return '#10B981';
    if (name.includes('gold') || name.includes('yellow')) return '#F59E0B';
    if (name.includes('purple')) return '#8B5CF6';
    if (name.includes('orange')) return '#F97316';
    if (name.includes('pink')) return '#EC4899';
    if (name.includes('black')) return '#334155'; // Dark slate for dark mode
    if (name.includes('silver') || name.includes('grey') || name.includes('gray')) return '#94A3B8';
    
    // 2. Expanded Vibrant Fallback Palette (15 unique colors for large programs!)
    const palette = [
        '#10B981', // Emerald
        '#F59E0B', // Amber
        '#8B5CF6', // Purple
        '#EC4899', // Pink
        '#14B8A6', // Teal
        '#F43F5E', // Rose
        '#0EA5E9', // Sky
        '#84CC16', // Lime
        '#6366F1', // Indigo
        '#D946EF', // Fuchsia
        '#EAB308', // Yellow
        '#06B6D4', // Cyan
        '#F97316', // Orange
        '#EF4444', // Bright Red
        '#34D399'  // Mint
    ];
    
    return palette[index % palette.length];
}

// Add this helper function anywhere in app.js
function checkRunViewVisibility() {
    const navItem = document.getElementById('navMileItem');
    if (!navItem || !globalMetricsData) return;

    // Check if either running metric exists AND is currently active
    const mileActive = globalMetricsData.some(m => m.name === "Mile Time" && m.is_active);
    const halfMileActive = globalMetricsData.some(m => m.name === "Half Mile Time" && m.is_active);

    // Hide or show the sidebar link based on the toggles
    if (mileActive || halfMileActive) {
        navItem.style.display = 'block';
    } else {
        navItem.style.display = 'none';
        
        // If they disable it while actively looking at the Mile view, boot them to Dashboard
        const mileView = document.getElementById('view-mile');
        if (mileView && mileView.style.display === 'block') {
            loadView('overview');
        }
    }
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
        
        // Use our new smart refresh so the active screen redraws the new image
        smartRefreshActiveView(athleteId);
    } else {
        alert("Error uploading: " + response.error);
        if (btn) {
            btn.innerText = '📷 Take Photo';
            btn.disabled = false;
        }
    }
}

// Helper to redraw the UI without changing screens
function smartRefreshActiveView(athleteId) {
    if (document.getElementById('view-photo').style.display === 'block') {
        renderPhotoTable();
    } else if (document.getElementById('view-overview').style.display === 'block') {
        filterTable();
    } else if (document.getElementById('view-profile').style.display === 'block') {
        renderAthleteProfile(athleteId);
    } else if (document.getElementById('view-station').style.display === 'block') {
        renderStationTable();
    }
}

// ==========================================
// PHOTO MANAGEMENT OVERRIDES
// ==========================================
let currentPhotoAthleteId = null;

function openPhotoModal(event, athleteId) {
    if (event) event.stopPropagation(); // Prevents the Dashboard card from opening the profile
    currentPhotoAthleteId = athleteId;
    document.getElementById('photoActionModal').style.display = 'flex';
}

function closePhotoModal() {
    document.getElementById('photoActionModal').style.display = 'none';
    currentPhotoAthleteId = null;
}

function triggerRetakePhoto() {
    const athleteId = currentPhotoAthleteId;
    closePhotoModal();
    triggerCamera(athleteId); // Reuses your existing camera function!
}

async function removeAthletePhoto() {
    if (!currentPhotoAthleteId) return;
    const athleteId = currentPhotoAthleteId;
    
    // 1. Instantly update local UI
    const athlete = globalAthleteData.find(a => a.id === athleteId);
    if (athlete) athlete.photo_url = null;
    
    closePhotoModal();
    smartRefreshActiveView(athleteId);
    
    // 2. Remove from database
    const response = await apiUpdateAthleteField(athleteId, 'photo_url', null);
    if (!response.success) {
        alert("Failed to remove photo from database.");
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

    // 1. Fetch metric configuration from the database data
    const metricDef = globalMetricsData.find(m => m.name === category);
    const mType = metricDef ? metricDef.measurement_type : 'unknown';
    const isLongTime = mType === 'time' && metricDef && metricDef.max_value >= 60; // For minutes/seconds

    let promptVal = currentVal;
    let placeholder = "e.g., 3.5"; // Default

    // 2. Set dynamic placeholders and formatting based on measurement type
    if (mType === 'time' && isLongTime) {
        placeholder = "e.g., 6:30";
        if (currentVal && currentVal !== 'No data') promptVal = formatRawStat(category, currentVal); 
    } else if (mType === 'inches') {
        placeholder = "e.g., 8'11\"";
        if (currentVal && currentVal !== 'No data') promptVal = formatRawStat(category, currentVal);
    } else if (mType === 'time') { // Short time (sprints)
        placeholder = "e.g., 4.5";
        if (currentVal && currentVal !== 'No data') promptVal = parseFloat(currentVal).toFixed(2); 
    } else if (mType === 'percentage') {
        placeholder = "e.g., 85";
        if (currentVal && currentVal !== 'No data') promptVal = Math.round(currentVal);
    } else {
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

        // 1. Fetch metric configuration
        const metricDef = globalMetricsData.find(m => m.name === editModalCategory);
        const mType = metricDef ? metricDef.measurement_type : 'unknown';
        const isLongTime = mType === 'time' && metricDef && metricDef.max_value >= 60;

        let valToSave = newVal;
        
        // 2. Parse the input value dynamically based on measurement type
        if (mType === 'time' && isLongTime) {
            let cleanVal = newVal.replace('.', ':'); 
            if (cleanVal.includes(':')) {
                let parts = cleanVal.split(':');
                valToSave = (parseInt(parts[0]) * 60) + (parseInt(parts[1]) || 0);
            } else {
                valToSave = parseFloat(cleanVal); 
            }
        } 
        else if (mType === 'inches') {
            let match = newVal.match(/(\d+)['\s]+([\d.]+)/); // Checks for 8'11 formats
            if (match) {
                valToSave = (parseInt(match[1]) * 12) + parseFloat(match[2]);
            } else {
                valToSave = parseFloat(newVal);
            }
        } 
        else if (mType === 'time' || mType === 'mph' || mType === 'percentage' || mType === 'count') {
            // Strip out letters or symbols (s, mph, %, etc.) in case the user typed them
            valToSave = parseFloat(newVal.replace(/[a-zA-Z%]/g, '')); 
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
let globalMetricsData = []; // Stores the database metrics so we can toggle them

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
            
            // NEW: Apply Groups to the Settings Input
            document.getElementById('settingTryoutGroups').value = settings.tryout_groups || '1, 2, 3';
            
            const sidebarName = document.getElementById('sidebarSchoolName');
            if (sidebarName && settings.program_name) {
                sidebarName.innerHTML = `${settings.program_name}<br><span style="color: var(--secondary); font-size: 14px;">Tryout Manager</span>`;
            }

            if (settings.team_names) {
                globalTeamNames = settings.team_names.split(',').map(s => s.trim()).filter(s => s !== '');
            }

            // NEW: Parse the groups into the global array
            if (settings.tryout_groups) {
                globalTryoutGroups = settings.tryout_groups.split(',').map(s => s.trim()).filter(s => s !== '');
            }

            const filterStatus = document.getElementById('filterStatus');
            if (filterStatus) {
                filterStatus.innerHTML = `<option value="All">All Statuses</option><option value="Evaluating">Evaluating (Pending)</option>`;
                globalTeamNames.forEach(team => filterStatus.innerHTML += `<option value="${team}">${team}</option>`);
                filterStatus.innerHTML += `<option value="Cut">Cut</option>`;
            }

            const profileStatus = document.getElementById('statusSelect');
            if (profileStatus) {
                profileStatus.innerHTML = `<option value="Evaluating">Evaluating (Pending)</option>`;
                globalTeamNames.forEach(team => profileStatus.innerHTML += `<option value="${team}">${team}</option>`);
                profileStatus.innerHTML += `<option value="Cut">Cut</option>`;
            }

            // NEW: Rebuild the Dashboard Group Filter Dropdown
            const filterGroup = document.getElementById('filterGroup');
            if (filterGroup) {
                filterGroup.innerHTML = '<option value="All">All Groups</option>';
                globalTryoutGroups.forEach(g => filterGroup.innerHTML += `<option value="${g}">${g}</option>`);
            }

            // NEW: Rebuild the Athlete Profile Group Dropdown
            const groupSelect = document.getElementById('groupSelect');
            if (groupSelect) {
                groupSelect.innerHTML = '';
                globalTryoutGroups.forEach(g => groupSelect.innerHTML += `<option value="${g}">${g}</option>`);
                groupSelect.innerHTML += '<option value="Unassigned">Unassigned</option>';
            }
        }
    }

    // Fetch and draw the Metrics Toggles!
    globalMetricsData = await apiFetchAllMetrics();
    renderSettingsMetrics();
    populateStationDropdown();
    
    // Check if we should hide the Mile Time nav link
    checkRunViewVisibility();
}

// Add this right below the `renderSettingsMetrics` function declaration!
function renderSettingsMetrics() {
    const container = document.getElementById('settingsMetricsList');
    if (!container) return;
    container.innerHTML = '';

    if (!globalMetricsData || globalMetricsData.length === 0) {
        container.innerHTML = '<div style="color: #94A3B8; font-size: 13px;">No metrics found in database.</div>';
        return;
    }

    const categories = {};
    globalMetricsData.forEach(m => {
        if (!categories[m.category]) categories[m.category] = [];
        categories[m.category].push(m);
    });

    for (const [category, metrics] of Object.entries(categories)) {
        let html = `<h5 style="color: var(--text-color); margin: 15px 0 10px 0; border-bottom: 1px solid #3A4150; padding-bottom: 5px; font-size: 14px;">${category}</h5>`;
        
        metrics.forEach(m => {
            html += `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #2A303C; flex-wrap: wrap; gap: 10px;">
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; color: #E2E8F0; font-size: 14px; flex: 1; min-width: 140px;">
                <input type="checkbox" id="metric_toggle_${m.id}" data-id="${m.id}" style="width: 18px; height: 18px; accent-color: var(--secondary);" ${m.is_active ? 'checked' : ''}>
                ${m.name}
              </label>
              
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 11px; color: #94A3B8;">Min:</span>
                <input type="number" id="metric_min_${m.id}" value="${m.min_value !== null ? m.min_value : 0}" class="search-box" style="width: 50px; padding: 4px; font-size: 12px; text-align: center;">
                <span style="font-size: 11px; color: #94A3B8;">Max:</span>
                <input type="number" id="metric_max_${m.id}" value="${m.max_value !== null ? m.max_value : 5}" class="search-box" style="width: 50px; padding: 4px; font-size: 12px; text-align: center;">
                
                <div style="display: flex; gap: 10px; margin-left: 10px;">
                  <button onclick="renameMetric('${m.id}', '${m.name}')" style="background: transparent; border: none; color: var(--accentBlue); cursor: pointer; font-size: 14px;" title="Rename">✎</button>
                  <button onclick="deleteMetric('${m.id}')" style="background: transparent; border: none; color: var(--color-cut); cursor: pointer; font-size: 14px;" title="Delete">🗑</button>
                </div>
              </div>
            </div>`;
        });
        container.innerHTML += html;
    }
}

// ------------------------------------
// NEW METRIC MANAGEMENT FUNCTIONS
// ------------------------------------
async function addNewMetric(event) {
    const nameInput = document.getElementById('newMetricName');
    const catInput = document.getElementById('newMetricCategory');
    const typeInput = document.getElementById('newMetricType');
    const name = nameInput.value.trim();
    
    if(!name) { alert("Please enter a metric name."); return; }
    
    const btn = event.target;
    btn.innerText = "Adding..."; btn.disabled = true;
    
    // Pass the third parameter (measurement type) to the database
    const response = await apiAddMetric(name, catInput.value, typeInput.value);
    
    if(response.success) {
        nameInput.value = '';
        globalMetricsData = await apiFetchAllMetrics();
        renderSettingsMetrics();
        populateStationDropdown(); 
    } else {
        alert("Error adding metric: " + response.error);
    }
    btn.innerText = "Add to Tryouts"; btn.disabled = false;
}

async function renameMetric(id, oldName) {
    const newName = prompt("Enter new name for metric:", oldName);
    if (!newName || newName.trim() === '' || newName.trim() === oldName) return;
    
    const response = await apiRenameMetric(id, newName.trim());
    if (response.success) {
        globalMetricsData = await apiFetchAllMetrics();
        renderSettingsMetrics();
        populateStationDropdown();
    } else {
        alert("Error renaming: " + response.error);
    }
}

async function deleteMetric(id) {
    if(!confirm("Are you sure you want to delete this metric?")) return;
    
    const response = await apiDeleteMetric(id);
    if (response.success) {
        globalMetricsData = globalMetricsData.filter(m => m.id != id);
        renderSettingsMetrics();
        populateStationDropdown();
    } else {
        alert(response.error);
    }
}

// Automatically builds the dropdown for the Station Evaluator page based on active DB metrics
function populateStationDropdown() {
    const select = document.getElementById('stationSelect');
    if(!select) return;
    
    // Filter out inactive metrics AND our specific running metrics
    const activeMetrics = globalMetricsData.filter(m => 
        m.is_active && 
        m.name !== "Mile Time" && 
        m.name !== "Half Mile Time"
    );
    
    let html = '<option value="">-- Select Station --</option>';
    
    const categories = {};
    activeMetrics.forEach(m => {
        if(!categories[m.category]) categories[m.category] = [];
        categories[m.category].push(m);
    });
    
    for(const [cat, metrics] of Object.entries(categories)) {
        html += `<optgroup label="${cat}">`;
        metrics.forEach(m => { html += `<option value="${m.name}">${m.name}</option>`; });
        html += `</optgroup>`;
    }
    
    select.innerHTML = html;
}

async function saveAppSettings() {
    const btn = document.getElementById('btnSaveSettings');
    btn.innerText = "Saving...";
    btn.disabled = true;

    // 1. Save Basic Settings
    const newColor = document.getElementById('settingThemeColor').value;
    const requireId = document.getElementById('settingRequireId').checked;
    const programName = document.getElementById('settingProgramName').value.trim();
    const logoUrl = document.getElementById('settingLogoUrl').value.trim();
    const teamNames = document.getElementById('settingTeamNames').value.trim();
    const tryoutGroups = document.getElementById('settingTryoutGroups').value.trim();

    const response = await apiSaveSettings(requireId, newColor, programName, logoUrl, teamNames, tryoutGroups);
    
    // 2. Save Metric Toggles & Bounds
    const metricCheckboxes = document.querySelectorAll('input[id^="metric_toggle_"]');
    let updatedMetrics = [];
    metricCheckboxes.forEach(cb => {
        const id = cb.getAttribute('data-id');
        const metric = globalMetricsData.find(m => m.id == id);
        if (metric) {
            updatedMetrics.push({
                id: metric.id,
                name: metric.name,
                category: metric.category,
                measurement_type: metric.measurement_type, // <-- THE FIX: Included to satisfy the database rule!
                is_active: cb.checked,
                min_value: parseFloat(document.getElementById(`metric_min_${id}`).value) || 0,
                max_value: parseFloat(document.getElementById(`metric_max_${id}`).value) || 5
            });
        }
    });

    if (updatedMetrics.length > 0) {
        await apiUpdateMetrics(updatedMetrics);
    }

    if (response.success) {
        await fetchAndApplySettings();
        fetchAndRenderDashboard(); 

        btn.innerText = "Saved!";
        btn.style.background = "var(--accentGreen)";
        setTimeout(() => {
            btn.innerText = "Save All Settings";
            btn.style.background = "var(--secondary)";
            btn.disabled = false;
        }, 1500);
    } else {
        alert("Failed to save settings.");
        btn.innerText = "Save All Settings";
        btn.disabled = false;
    }
}