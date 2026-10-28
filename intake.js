const SUPABASE_URL = 'https://rtkevenhwlcejfxbmlpd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uuAnsVTxd_NGIm9N9pjtKA_kS85k9VB';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Fetch settings when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    const { data } = await supabaseClient.from('app_settings').select('*').eq('id', 1).single();
    if (data) {
        // Update the brand color
        document.documentElement.style.setProperty('--brand', data.theme_color);
        
        // Hide or Show Student ID based on settings
        const idWrapper = document.getElementById('studentIdWrapper');
        const idInput = document.getElementById('student_id');
        if (data.require_student_id) {
            idWrapper.style.display = 'flex';
            idInput.setAttribute('required', 'true');
        } else {
            idWrapper.style.display = 'none';
            idInput.removeAttribute('required');
        }
    }
    // Fade the form in after settings are applied
    document.getElementById('formWrapper').style.display = 'block';
});

async function submitIntakeForm(event) {
    event.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.innerText = "Submitting..."; btn.disabled = true;

    const positionCheckboxes = document.querySelectorAll('input[name="position"]:checked');
    const positionsArray = Array.from(positionCheckboxes).map(cb => cb.value);

    let heightInches = null;
    const heightInput = document.getElementById('height_input').value.trim();
    if (heightInput !== '') {
        const match = heightInput.match(/(\d+)['\s]+(\d+)/);
        if (match) heightInches = (parseInt(match[1]) * 12) + parseInt(match[2]);
        else heightInches = parseInt(heightInput); 
    }

    const newAthleteData = {
        first_name: document.getElementById('first_name').value.trim(),
        last_name: document.getElementById('last_name').value.trim(),
        student_id: document.getElementById('student_id').value.trim() || null,
        tryout_number: parseInt(document.getElementById('tryout_number').value),
        grade: parseInt(document.getElementById('grade').value),
        tryout_group: document.getElementById('tryout_group').value,
        phone: document.getElementById('phone').value.trim(),
        email: document.getElementById('email').value.trim(),
        height_inches: isNaN(heightInches) ? null : heightInches,
        years_exp: parseInt(document.getElementById('years_exp').value) || null,
        preferred_position: positionsArray,
        shirt_size: document.getElementById('shirt_size').value || null,
        spandex_size: document.getElementById('spandex_size').value || null,
        status: 'Evaluating'
    };

    try {
        const { error } = await supabaseClient.from('athletes').insert([newAthleteData]);
        if (error) throw error;
        document.getElementById('intakeForm').style.display = 'none';
        document.getElementById('successMessage').style.display = 'block';
    } catch (error) {
        alert("Error submitting. Please try again.");
        btn.innerText = "Submit Registration"; btn.disabled = false;
    }
}