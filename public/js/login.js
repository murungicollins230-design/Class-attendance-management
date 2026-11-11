/** Login page logic. */

const DEMO_ACCOUNTS = [
  { label: '👩‍🏫 Lecturer — AINE DICKENS (teaches SWE2106, SWE2101)', email: 'dickens.aine@must.ac.ug', password: 'lecturer123' },
  { label: '👩‍🏫 Lecturer — MUSONIRWA IBRAHIM (teaches SWE2104)', email: 'ibrahim.musonirwa@must.ac.ug', password: 'lecturer123' },
  { label: '🎓 Student — NKAMUSHABA SAVIOUR', email: 'savour.nkamushaba@student.must.ac.ug', password: 'student123' },
  { label: '🗂️ Registrar — KANYESIGYE OSBERT (read-only)', email: 'osbert.kanyesigye@must.ac.ug', password: 'registrar123' },
  { label: '⚙️ Administrator — MURUNGI COLLINS', email: 'collins.murungi@must.ac.ug', password: 'admin123' },
];

(function init() {
  // already signed in? go straight to the dashboard
  if (sessionStorage.getItem('token')) {
    window.location.href = '/dashboard.html';
    return;
  }

  const list = document.getElementById('demo-list');
  for (const account of DEMO_ACCOUNTS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ghost';
    btn.textContent = account.label;
    btn.addEventListener('click', () => {
      document.getElementById('email').value = account.email;
      document.getElementById('password').value = account.password;
      document.getElementById('login-form').requestSubmit();
    });
    list.appendChild(btn);
  }

  document.getElementById('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const errorBox = document.getElementById('login-error');
    errorBox.classList.remove('show');

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
      const data = await api.post('/api/auth/login', { email, password });
      sessionStorage.setItem('token', data.token);
      sessionStorage.setItem('user', JSON.stringify(data.user));
      toast(`Welcome, ${data.user.full_name}!`, 'success');
      setTimeout(() => { window.location.href = '/dashboard.html'; }, 400);
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.add('show');
    }
  });
})();
