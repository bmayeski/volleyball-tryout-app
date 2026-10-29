// ==========================================
// 1. SUPABASE INITIALIZATION
// ==========================================
const SUPABASE_URL = 'https://rtkevenhwlcejfxbmlpd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uuAnsVTxd_NGIm9N9pjtKA_kS85k9VB';

// FIXED: Renamed to 'supabaseClient' so it doesn't fight with the CDN script!
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// We cache the metric IDs so we don't have to constantly query the database 
// to find out the ID for "Vertical Jump" every time a coach saves a score.
let metricCache = {};

// ==========================================
// 2. FETCH ALL DASHBOARD DATA
// ==========================================
async function apiFetchDashboardData() {
    try {
        // 1. Fetch all athletes
        const { data: athletes, error: athleteError } = await supabaseClient
            .from('athletes')
            .select('*');
            
        if (athleteError) throw athleteError;

        // 2. Fetch all evaluations, and use Supabase's relational querying 
        // to grab the exact name of the metric (e.g., "Passing") at the same time!
        const { data: evaluations, error: evalError } = await supabaseClient
            .from('evaluations')
            .select(`
                athlete_id,
                raw_score,
                evaluation_metrics ( id, name, category )
            `);
            
        if (evalError) throw evalError;
        
        // 3. Build the metric cache for saving scores later
        const { data: metrics } = await supabaseClient.from('evaluation_metrics').select('id, name');
        if (metrics) {
            metrics.forEach(m => metricCache[m.name] = m.id);
        }

        // 4. Format data so app.js can read it exactly like it used to
        let allStats = {}; 
        let completedEvals = {}; 
        
        // Map evaluations to standard arrays for the Bell Curve math
        evaluations.forEach(ev => {
            const metricName = ev.evaluation_metrics.name;
            const score = ev.raw_score;
            const athleteId = ev.athlete_id;
            
            // Add to allStats for Bell Curve peer math (e.g., allStats["Mile Time"] = [265, 300, 240])
            if (!allStats[metricName]) allStats[metricName] = [];
            allStats[metricName].push(score);
            
            // Build the specific athlete's score dictionary
            if (!completedEvals[athleteId]) completedEvals[athleteId] = {};
            completedEvals[athleteId][metricName] = score;
        });

        // Attach the evaluations directly to the athlete objects
        const formattedAthletes = athletes.map(athlete => {
            const myEvals = completedEvals[athlete.id] || {};
            
            athlete.rawStats = myEvals;
            
            // Create the boolean flags expected by the UI for the sliders/buttons
            for (const [key, value] of Object.entries(myEvals)) {
                athlete[`scored_${key}`] = true; 
                if (key === 'Mile Time') athlete.mileTimeSaved = true;
            }
            
            // Check if they checked in both gear items
            athlete.hasGearCheckedIn = (athlete.shirt_size && athlete.spandex_size) ? true : false;
            
            return athlete;
        });

        return { athletes: formattedAthletes, allStats: allStats };
        
    } catch (error) {
        console.error("Error fetching data:", error);
        return null;
    }
}

// ==========================================
// 3. SAVE A SCORE
// ==========================================
async function apiSaveScoreToDatabase(athleteId, metricName, score) {
    try {
        const metricId = metricCache[metricName];
        if (!metricId) throw new Error(`Metric '${metricName}' not found in database.`);
        
        // Upsert the score
        const { error } = await supabaseClient
            .from('evaluations')
            .upsert({
                athlete_id: athleteId,
                metric_id: metricId,
                raw_score: score,
                updated_at: new Date().toISOString()
            }, { 
                onConflict: 'athlete_id, metric_id' 
            });
            
        if (error) throw error;
        return { success: true };
        
    } catch (error) {
        console.error("Error saving score:", error);
        return { success: false, error: error.message };
    }
}

// ==========================================
// 4. UPDATE ATHLETE FIELDS
// ==========================================
async function apiUpdateAthleteField(athleteId, fieldName, newValue) {
    try {
        const { error } = await supabaseClient
            .from('athletes')
            .update({ [fieldName]: newValue })
            .eq('id', athleteId);
            
        if (error) throw error;
        return { success: true };
        
    } catch (error) {
        console.error(`Error updating ${fieldName}:`, error);
        return { success: false, error: error.message };
    }
}

// ==========================================
// 5. UPLOAD PHOTO TO STORAGE
// ==========================================
async function apiUploadAthletePhoto(athleteId, file) {
    try {
        // 1. Generate a unique filename using the athlete's ID and timestamp
        const fileExt = file.name.split('.').pop();
        const fileName = `${athleteId}_${Date.now()}.${fileExt}`;
        
        // 2. Upload to Supabase Storage
        const { data, error } = await supabaseClient.storage
            .from('athlete-photos')
            .upload(fileName, file, { cacheControl: '3600', upsert: true });

        if (error) throw error;

        // 3. Get the public URL for the image
        const { data: publicUrlData } = supabaseClient.storage
            .from('athlete-photos')
            .getPublicUrl(fileName);

        const photoUrl = publicUrlData.publicUrl;

        // 4. Save that URL to the athlete's record in the database
        await apiUpdateAthleteField(athleteId, 'photo_url', photoUrl);

        return { success: true, url: photoUrl };
    } catch (error) {
        console.error("Photo upload error:", error);
        return { success: false, error: error.message };
    }
}

// ==========================================
// 6. GLOBAL SETTINGS
// ==========================================
async function apiFetchSettings() {
    try {
        const { data, error } = await supabaseClient.from('app_settings').select('*').eq('id', 1).single();
        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error fetching settings:", error);
        return null;
    }
}

async function apiSaveSettings(requireId, themeColor, programName, logoUrl, teamNames) {
    try {
        const { error } = await supabaseClient.from('app_settings').update({
            require_student_id: requireId,
            theme_color: themeColor,
            program_name: programName,
            logo_url: logoUrl,
            team_names: teamNames
        }).eq('id', 1);
        if (error) throw error;
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ==========================================
// 7. METRICS MANAGEMENT
// ==========================================
async function apiFetchAllMetrics() {
    try {
        const { data, error } = await supabaseClient.from('evaluation_metrics').select('*').order('category').order('name');
        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error fetching metrics:", error);
        return [];
    }
}

async function apiUpdateMetrics(metricsArray) {
    try {
        // Upsert efficiently updates multiple rows at once
        const { error } = await supabaseClient.from('evaluation_metrics').upsert(metricsArray);
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error("Error updating metrics:", error);
        return { success: false, error: error.message };
    }
}

async function apiAddMetric(name, category, measurementType) {
    try {
        const { data, error } = await supabaseClient.from('evaluation_metrics')
            .insert([{ 
                name: name, 
                category: category, 
                measurement_type: measurementType, 
                is_active: true 
            }])
            .select().single();
        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function apiRenameMetric(id, newName) {
    try {
        const { error } = await supabaseClient.from('evaluation_metrics')
            .update({ name: newName }).eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function apiDeleteMetric(id) {
    try {
        const { error } = await supabaseClient.from('evaluation_metrics')
            .delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    } catch (error) {
        // Prevent deletion if athletes already have scores for this metric!
        if (error.message.includes('foreign key') || error.message.includes('violates')) {
            return { success: false, error: "Athletes already have scores for this metric! Uncheck the box to hide it instead of deleting it." };
        }
        return { success: false, error: error.message };
    }
}