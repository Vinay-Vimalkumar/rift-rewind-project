/**
 * ========== Configuration ==========
 * If you have ONE Lambda for both features, keep the single URL below.
 * If you have TWO Lambdas, set RIOT_API_URL and LAMBDA_URL separately.
 */
const FUNCTION_URL = 'https://anbqqriwd2ysbwxyquqspqg7ee0xwrcp.lambda-url.us-east-1.on.aws/';

// Riot API lookup endpoint
const RIOT_API_URL = FUNCTION_URL; // change if you use a separate Lambda

// Contact form endpoint
const LAMBDA_URL = FUNCTION_URL;   // change if you use a separate Lambda

/**
 * Utility: show a temporary message in a target element
 */
function showTempMessage(el, text, type = 'info', ms = 10000) {
  if (!el) return;
  el.textContent = text;
  el.className = `form-message ${type}`;
  el.style.display = 'block';
  clearTimeout(el.__hideTimer);
  el.__hideTimer = setTimeout(() => (el.style.display = 'none'), ms);
}

/**
 * League Data Lookup
 * Expects the following HTML elements (as provided in the updated index.html):
 * - #lookup-message (div)
 * - #summoner-name (input)
 * - #region (select)
 * - #lookup-btn (button)
 * - #summoner-results (container)
 * - #summoner-info (div)
 * - #champion-mastery (div)
 */
function wireLeagueLookup() {
  const lookupBtn = document.getElementById('lookup-btn');
  const summonerNameInput = document.getElementById('summoner-name');
  const regionSelect = document.getElementById('region');
  const messageDiv = document.getElementById('lookup-message');
  const resultsDiv = document.getElementById('summoner-results');

  if (!lookupBtn || !summonerNameInput || !regionSelect || !messageDiv || !resultsDiv) {
    // Elements not on this page — skip wiring
    return;
  }

  lookupBtn.addEventListener('click', async function () {
    const summonerName = summonerNameInput.value.trim();
    const region = regionSelect.value;

    if (!summonerName) {
      showTempMessage(messageDiv, 'Please enter a Riot ID', 'error');
      return;
    }
    if (!summonerName.includes('#')) {
      showTempMessage(messageDiv, 'Please use Riot ID format: GameName#TAG', 'error');
      return;
    }

    // UI state
    lookupBtn.textContent = 'Looking up...';
    lookupBtn.disabled = true;
    messageDiv.style.display = 'none';
    resultsDiv.style.display = 'none';

    try {
      const resp = await fetch(RIOT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summonerName, region }),
        mode: 'cors'
      });

      const data = await resp.json().catch(() => ({}));

      if (resp.ok) {
        displaySummonerData(data);
        showTempMessage(messageDiv, 'Summoner found!', 'success');
      } else {
        const detail = data?.error || 'Failed to fetch summoner data';
        showTempMessage(messageDiv, detail, 'error');
      }
    } catch (err) {
      showTempMessage(messageDiv, 'Network error. Please try again.', 'error');
    } finally {
      lookupBtn.textContent = 'Look Up Summoner';
      lookupBtn.disabled = false;
    }
  });

  // Enter key support
  summonerNameInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      lookupBtn.click();
    }
  });

  function displaySummonerData(data) {
    const resultsDiv = document.getElementById('summoner-results');
    const summonerInfo = document.getElementById('summoner-info');
    const championMastery = document.getElementById('champion-mastery');
    if (!resultsDiv || !summonerInfo || !championMastery) return;

    // Summoner info
    const level = data?.summoner?.level ?? '—';
    const name = data?.summoner?.name ?? '—';
    summonerInfo.innerHTML = `
      <div class="summoner-card">
        <h5>${name}</h5>
        <p>Level: ${level}</p>
      </div>
    `;

    // Top champions
    const champs = Array.isArray(data?.topChampions) ? data.topChampions : [];
    if (champs.length > 0) {
      const championsHtml = champs
        .slice(0, 3)
        .map(
          (c) => `
          <div class="champion-card">
            <p><strong>Champion ID:</strong> ${c.championId}</p>
            <p><strong>Mastery Level:</strong> ${c.championLevel}</p>
            <p><strong>Mastery Points:</strong> ${(c.championPoints ?? 0).toLocaleString()}</p>
          </div>
        `
        )
        .join('');

      championMastery.innerHTML = `
        <h5>Top Champions</h5>
        <div class="champions-grid">
          ${championsHtml}
        </div>
      `;
    } else {
      championMastery.innerHTML = '<p>No champion mastery data found.</p>';
    }

    resultsDiv.style.display = 'block';
  }
}

/**
 * Contact Form
 * Expects:
 * - .contact-form-container (form)
 * - #form-message (div)
 * - .contact-submit-btn (button inside form)
 */
function wireContactForm() {
  const form = document.querySelector('.contact-form-container');
  const messageDiv = document.getElementById('form-message');
  if (!form || !messageDiv) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const submitBtn = form.querySelector('.contact-submit-btn');
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const msg = form.message.value.trim();

    // Basic validation
    if (!name || !email || !msg) {
      showTempMessage(messageDiv, 'Please fill in your name, email, and a message.', 'error');
      return;
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      showTempMessage(messageDiv, 'Please enter a valid email address.', 'error');
      return;
    }

    // Loading state
    submitBtn.textContent = 'Sending...';
    submitBtn.disabled = true;
    messageDiv.style.display = 'none';

    const hasLambda = !!LAMBDA_URL && /^https?:\/\//i.test(LAMBDA_URL);

    // If not configured, simulate success
    if (!hasLambda) {
      await new Promise((r) => setTimeout(r, 600));
      showTempMessage(messageDiv, 'Thanks! (Local demo) Your message was captured on the client.', 'success');
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
        body: JSON.stringify({ name, email, message: msg }),
        mode: 'cors',
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (resp.ok) {
        showTempMessage(messageDiv, 'Message sent successfully! Thank you for reaching out.', 'success');
        form.reset();
      } else {
        let detail = '';
        try {
          detail = await resp.text();
        } catch {}
        showTempMessage(
          messageDiv,
          'Failed to send message. ' + (detail || 'Please try again.'),
          'error'
        );
      }
    } catch (err) {
      showTempMessage(messageDiv, 'Network error. Please check your connection and try again.', 'error');
    } finally {
      submitBtn.textContent = 'Send Message';
      submitBtn.disabled = false;
    }
  });
}

// Wire everything once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  wireLeagueLookup();
  wireContactForm();
});
