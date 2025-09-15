// Xpanel - Login Page JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Check if already authenticated
    if (XpanelUtils.isAuthenticated()) {
        window.location.href = '/';
        return;
    }

    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('error-message');

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const remember = document.getElementById('remember').checked;

        // Disable form during login
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<div class="loading-spinner"></div> Вход...';
        submitBtn.disabled = true;

        try {
            const response = await api.login(username, password);
            
            if (response.success) {
                // Store token and user info
                api.setToken(response.access_token);
                XpanelUtils.storage.set('xpanel_user', response.user);
                
                // Redirect to dashboard
                window.location.href = '/';
            } else {
                showError(response.message || 'Неверные учетные данные');
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('Ошибка подключения к серверу');
        } finally {
            // Re-enable form
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        
        // Hide error after 5 seconds
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }

    // Add enter key support for form fields
    document.querySelectorAll('#loginForm input').forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                loginForm.dispatchEvent(new Event('submit'));
            }
        });
    });
});
