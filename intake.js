const SUPABASE_URL = 'https://rtkevenhwlcejfxbmlpd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uuAnsVTxd_NGIm9N9pjtKA_kS85k9VB';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', async () => {
    const { data } = await supabaseClient.from('app_settings').select('*').eq('id', 1).single();
    if (data) {
        // 1. Apply Brand Color
        if (data.theme_color) {
            document.documentElement.style.setProperty('--brand', data.theme_color);
        }
        
        // 2. Apply Brand Name & Logo (if elements exist on intake.html)
        const progNameEl = document.getElementById('displayProgramName');
        if (data.program_name && progNameEl) {
            progNameEl.innerText = data.program_name;
        }
        const logoImg = document.getElementById('displayLogo');
        if (data.logo_url && logoImg) {
            logoImg.src = data.logo_url;
            logoImg.style.display = 'block';
        }
        const brandHeader = document.getElementById('brandHeader');
        if (brandHeader) brandHeader.style.display = 'flex';
        
        // 3. Hide or Show Student ID based on settings
        const idWrapper = document.getElementById('studentIdWrapper');
        const idInput = document.getElementById('student_id');
        if (idWrapper && idInput) {
            if (data.require_student_id) {
                idWrapper.style.display = 'flex';
                idInput.setAttribute('required', 'true');
            } else {
                idWrapper.style.display = 'none';
                idInput.removeAttribute('required');
            }
        }

        // 4. Dynamically Populate Grade Level (5th-12th or 9th-12th)
        const gradeSelect = document.getElementById('grade');
        if (gradeSelect) {
            const minGrade = (data.grade_range === '5-12') ? 5 : 9;
            gradeSelect.innerHTML = '<option value="">Select Grade</option>';
            for (let g = minGrade; g <= 12; g++) {
                gradeSelect.innerHTML += `<option value="${g}">${g}th Grade</option>`;
            }
        }

        // 5. Dynamically Populate Tryout Groups from Settings
        if (data.tryout_groups) {
            const groupSelect = document.getElementById('tryout_group');
            if (groupSelect) {
                const groups = data.tryout_groups.split(',').map(s => s.trim()).filter(s => s !== '');
                groupSelect.innerHTML = '<option value="">Select Group</option>';
                groups.forEach(g => {
                    groupSelect.innerHTML += `<option value="${g}">${g}</option>`;
                });
            }
        }
    }
    
    const wrapper = document.getElementById('formWrapper');
    if (wrapper) wrapper.style.display = 'block';
});

async function submitIntakeForm(event) {
    event.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.innerText = "Submitting..."; btn.disabled = true;

    const positionCheckboxes = document.querySelectorAll('input[name="position"]:checked');
    const positionsArray = Array.from(positionCheckboxes).map(cb => cb.value);

    // NEW: Validation to ensure at least one position (or "Unknown") is selected
    if (positionsArray.length === 0) {
        alert("Please select at least one preferred position, or choose 'No Preference'.");
        btn.innerText = "Submit Registration"; 
        btn.disabled = false;
        return; // Stops the form from submitting to Supabase
    }

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
        experience: parseInt(document.getElementById('years_exp').value) || null,
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
        // This will print the exact database error to your screen!
        alert("Error submitting: " + (error.message || JSON.stringify(error)));
        console.error("Supabase Error:", error);
        
        btn.innerText = "Submit Registration"; 
        btn.disabled = false;
    }
}