// ⚠️ Initialize Supabase (Same keys as your supabase-api.js file)
const SUPABASE_URL = 'https://rtkevenhwlcejfxbmlpd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uuAnsVTxd_NGIm9N9pjtKA_kS85k9VB';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function submitIntakeForm(event) {
    // Prevent the page from reloading when the form submits
    event.preventDefault();
    
    const btn = document.getElementById('submitBtn');
    btn.innerText = "Submitting...";
    btn.disabled = true;

    // 1. Gather Checkboxes into an Array
    const positionCheckboxes = document.querySelectorAll('input[name="position"]:checked');
    const positionsArray = Array.from(positionCheckboxes).map(cb => cb.value);

    // 2. Format Height (Convert 5'8" to total inches for the database)
    let heightInches = null;
    const heightInput = document.getElementById('height_input').value.trim();
    if (heightInput !== '') {
        const match = heightInput.match(/(\d+)['\s]+(\d+)/);
        if (match) {
            heightInches = (parseInt(match[1]) * 12) + parseInt(match[2]);
        } else {
            // Fallback if they just typed raw inches
            heightInches = parseInt(heightInput); 
        }
    }

    // 3. Build the Athlete Object for the Database
    const newAthleteData = {
        tryout_number: parseInt(document.getElementById('tryout_number').value),
        first_name: document.getElementById('first_name').value.trim(),
        last_name: document.getElementById('last_name').value.trim(),
        grade: parseInt(document.getElementById('grade').value),
        phone: document.getElementById('phone').value.trim(),
        preferred_position: positionsArray, // Supabase TEXT[] column handles arrays perfectly!
        shirt_size: document.getElementById('shirt_size').value,
        spandex_size: document.getElementById('spandex_size').value,
        height_inches: isNaN(heightInches) ? null : heightInches,
        status: 'Evaluating', // Default status
        tryout_group: 'Unassigned' // Default group
    };

    try {
        // 4. Send to Supabase
        const { error } = await supabaseClient
            .from('athletes')
            .insert([newAthleteData]);

        if (error) throw error;

        // 5. Show Success Screen
        document.getElementById('intakeForm').style.display = 'none';
        document.getElementById('successMessage').style.display = 'block';

    } catch (error) {
        console.error("Error submitting form:", error);
        alert("There was an error saving your info. Please try again or ask a coach for help.");
        btn.innerText = "Submit Check-In";
        btn.disabled = false;
    }
}