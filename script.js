// Contact form handler - Sends form data to AWS Lambda
const LAMBDA_URL = 'YOUR_LAMBDA_FUNCTION_URL_HERE'; // Replace with your Function URL

document.addEventListener('DOMContentLoaded', function() {
    const form = document.querySelector('.contact-form-container');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const submitBtn = form.querySelector('.contact-submit-btn');
        const messageDiv = document.getElementById('form-message');

        // Show loading state
        submitBtn.textContent = 'Sending...';
        submitBtn.disabled = true;
        messageDiv.style.display = 'none';

        // Get form data
        const formData = {
            name: form.name.value,
            email: form.email.value,
            message: form.message.value
        };

        try {
            const response = await fetch(LAMBDA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                showMessage('Message sent successfully! Thank you for reaching out.', 'success');
                form.reset();
            } else {
                showMessage('Failed to send message. Please try again.', 'error');
            }
        } catch (error) {
            showMessage('Network error. Please check your connection and try again.', 'error');
        }

        // Reset button
        submitBtn.textContent = 'Send Message';
        submitBtn.disabled = false;
    });
});

function showMessage(text, type) {
    const messageDiv = document.getElementById('form-message');
    messageDiv.textContent = text;
    messageDiv.className = `form-message ${type}`;
    messageDiv.style.display = 'block';

    // Auto-hide after 10 seconds
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 10000);
}
// Contact form handler with validation + Lambda fallback
// If LAMBDA_URL is not set, we gracefully show a local success message.
// Replace LAMBDA_URL with your actual AWS Lambda Function URL once ready.
const LAMBDA_URL = 'YOUR_LAMBDA_FUNCTION_URL_HERE'; // e.g., https://abc123.lambda-url.us-east-1.on.aws/

document.addEventListener('DOMContentLoaded', function () {
  const form = document.querySelector('.contact-form-container');
  const messageDiv = document.getElementById('form-message');
  if (!form || !messageDiv) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const submitBtn = form.querySelector('.contact-submit-btn');
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const message = form.message.value.trim();

    // Basic validation
    if (!name || !email || !message) {
      showMessage('Please fill in your name, email, and a message.', 'error');
      return;
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      showMessage('Please enter a valid email address.', 'error');
      return;
    }

    // Loading state
    submitBtn.textContent = 'Sending...';
    submitBtn.disabled = true;
    messageDiv.style.display = 'none';

    // If no Lambda URL configured, simulate success locally
    const hasLambda = LAMBDA_URL && !/YOUR_LAMBDA_FUNCTION_URL_HERE/i.test(LAMBDA_URL);

    if (!hasLambda) {
      await sleep(600); // small delay for UX
      showMessage('Thanks! (Local demo) Your message was captured on the client.', 'success');
      form.reset();
      submitBtn.textContent = 'Send Message';
      submitBtn.disabled = false;
      return;
    }

    // Send to Lambda
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const resp = await fetch(LAMBDA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
        mode: 'cors',
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (resp.ok) {
        showMessage('Message sent successfully! Thank you for reaching out.', 'success');
        form.reset();
      } else {
        let detail = '';
        try { detail = await resp.text(); } catch {}
        showMessage('Failed to send message. ' + (detail || 'Please try again.'), 'error');
      }
    } catch (err) {
      showMessage('Network error. Please check your connection and try again.', 'error');
    } finally {
      submitBtn.textContent = 'Send Message';
      submitBtn.disabled = false;
    }
  });

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `form-message ${type}`;
    messageDiv.style.display = 'block';
    // Auto-hide after 10s
    setTimeout(() => { messageDiv.style.display = 'none'; }, 10000);
  }

  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
});
