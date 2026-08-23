// Login + signup page logic

(function () {
  const errorBox = document.getElementById('error');

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.remove('hidden');
    errorBox.scrollIntoView({ block: 'nearest' });
  }

  function clearError() {
    errorBox.textContent = '';
    errorBox.classList.add('hidden');
  }

  // Where to send a user who just authenticated
  function landing(data) {
    return data.onboarded ? '/app' : '/onboarding';
  }

  async function submit(form, path, payload, busyLabel) {
    const button = document.getElementById('submit');
    const original = button.textContent;
    button.disabled = true;
    button.textContent = busyLabel;

    const { ok, data } = await apiPost(path, payload);

    if (!ok) {
      button.disabled = false;
      button.textContent = original;
      showError((data && data.error) || 'Something went wrong. Please try again.');
      return;
    }

    Auth.save(data);
    window.location.href = landing(data);
  }

  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    // Already signed in? Skip the form.
    if (Auth.isLoggedIn()) window.location.href = Auth.isOnboarded() ? '/app' : '/onboarding';

    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      clearError();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      if (!email || !password) return showError('Enter your email and password.');
      submit(loginForm, '/auth/login', { email, password }, 'Logging in…');
    });
  }

  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      clearError();
      const payload = {
        business_name: document.getElementById('business_name').value.trim(),
        name: document.getElementById('name').value.trim(),
        email: document.getElementById('email').value.trim(),
        password: document.getElementById('password').value
      };
      if (!payload.business_name || !payload.name || !payload.email) {
        return showError('All fields are required.');
      }
      if (payload.password.length < 8) {
        return showError('Password must be at least 8 characters.');
      }
      submit(signupForm, '/auth/signup', payload, 'Creating account…');
    });
  }
})();
