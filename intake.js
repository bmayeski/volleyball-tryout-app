// ⚠️ Initialize Supabase
const SUPABASE_URL = 'https://rtkevenhwlcejfxbmlpd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uuAnsVTxd_NGIm9N9pjtKA_kS85k9VB';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Toggle High School vs Club mode
function toggleStudentId() {
    const mode = document.getElementById('modeToggle').value;
    const idWrapper = document.getElementById('studentIdWrapper');
    const idInput = document.getElementById('student_id');

    if (mode === 'club') {
        idWrapper.style.display = 'none';
        idInput.value = '';
        idInput.removeAttribute('required');
    } else {
        idWrapper.style.display = 'flex';
        idInput.setAttribute('required', 'true');
    }
}

async function submitIntakeForm(event) {
    event.preventDefault();
    
    const btn = document.getElementById('submitBtn');
    btn.innerText = "Submitting...";
    btn.disabled = true;

    // Gather Checkboxes
    const positionCheckboxes = document.querySelectorAll('input[name="position"]:checked');
    const positionsArray = Array.from(positionCheckboxes).map(cb => cb.value);

    // Format Height to raw inches for the database
    let heightInches = null;
    const heightInput = document.getElementById('height_input').value.trim();
    if (heightInput !== '') {
        const match = heightInput.match(/(\d+)['\s]+(\d+)/);
        if (match) {
            heightInches = (parseInt(match[1]) * 12) + parseInt(match[2]);
        } else {
            heightInches = parseInt(heightInput); 
        }
    }

    // Build Payload
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
        const { error } = await supabaseClient
            .from('athletes')
            .insert([newAthleteData]);

        if (error) throw error;

        // Show Success
        document.getElementById('intakeForm').style.display = 'none';
        document.getElementById('modeToggle').style.display = 'none';
        document.getElementById('successMessage').style.display = 'block';

    } catch (error) {
        console.error("Error submitting form:", error);
        alert("There was an error saving your info. Please try again.");
        btn.innerText = "Submit Registration";
        btn.disabled = false;
    }
}