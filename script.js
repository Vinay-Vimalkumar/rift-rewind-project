// ====== CONFIG: your Lambda Function URL ======
const LAMBDA_URL = 'https://anbqqriwd2ysbwxyquqspqg7ee0xwrcp.lambda-url.us-east-1.on.aws/';

// ====== Riot region mapping (platform -> routing for account API) ======
const REGION_TO_ROUTING = {
  na1: 'americas',
  br1: 'americas',
  la1: 'americas',
  la2: 'americas',
  euw1: 'europe',
  eun1: 'europe',
  tr1: 'europe',
  ru:  'europe',
  kr:  'asia',
  jp1: 'asia',
  oc1: 'sea',
  ph2: 'sea',
  sg2: 'sea',
  th2: 'sea',
  tw2: 'sea',
  vn2: 'sea'
};

// Small helper
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

// ====== CONTACT FORM ======
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('.contact-form-container');
  const messageDiv = document.getElementById('form-message');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = form.querySelector('.contact-submit-btn');
      const name = form.name.value.trim();
      const email = form.email.value.trim();
      const message = form.message.value.trim();

      // Basic validation
      if (!name || !email || !message) {
        showBanner(messageDiv, 'Please fill in your name, email, and a message.', 'error');
        return;
      }
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!emailOk) {
        showBanner(messageDiv, 'Please enter a valid email address.', 'error');
        return;
      }

      submitBtn.textContent = 'Sending...';
      submitBtn.disabled = true;
      messageDiv.style.display = 'none';

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const resp = await fetch(LAMBDA_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, message }),
          mode: 'cors',
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (resp.ok) {
          showBanner(messageDiv, 'Message sent successfully! Thank you for reaching out.', 'success');
          form.reset();
        } else {
          let detail = '';
          try { detail = await resp.text(); } catch {}
          showBanner(messageDiv, 'Failed to send message. ' + (detail || 'Please try again.'), 'error');
        }
      } catch (err) {
        showBanner(messageDiv, 'Network error. Please check your connection and try again.', 'error');
      } finally {
        submitBtn.textContent = 'Send Message';
        submitBtn.disabled = false;
      }
    });
  }

  // ====== RIOT LOOKUP ======
  const lookupBtn = document.getElementById('lookup-btn');
  const summonerInput = document.getElementById('summoner-name');
  const regionSelect = document.getElementById('region');
  const lookupMessage = document.getElementById('lookup-message');
  const resultsSection = document.getElementById('summoner-results');
  const summonerInfoDiv = document.getElementById('summoner-info');
  const champDiv = document.getElementById('champion-mastery');

  if (lookupBtn && summonerInput && regionSelect) {
    lookupBtn.addEventListener('click', async () => {
      const riotId = (summonerInput.value || '').trim();
      const region = regionSelect.value;

      if (!riotId) {
        showBanner(lookupMessage, 'Please enter a Riot ID', 'error');
        return;
      }
      if (!riotId.includes('#')) {
        showBanner(lookupMessage, 'Please use Riot ID format: GameName#TAG', 'error');
        return;
      }

      lookupBtn.textContent = 'Looking up...';
      lookupBtn.disabled = true;
      lookupMessage.style.display = 'none';
      if (resultsSection) resultsSection.style.display = 'none';

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);

        const resp = await fetch(LAMBDA_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            summonerName: riotId,
            region: region
          }),
          mode: 'cors',
          signal: controller.signal
        });
        clearTimeout(timeout);

        const data = await resp.json().catch(() => ({}));

        if (!resp.ok) {
          showBanner(lookupMessage, data?.error || 'Failed to fetch summoner data', 'error');
        } else {
          // Render results
          if (summonerInfoDiv) {
            summonerInfoDiv.innerHTML = `
              <div class="summoner-card">
                <h5>${data.summoner?.name ?? riotId}</h5>
                <p>Level: ${data.summoner?.level ?? '—'}</p>
              </div>
            `;
          }

          if (champDiv) {
            const champs = Array.isArray(data.topChampions) ? data.topChampions : [];
            if (champs.length) {
              champDiv.innerHTML = `
                <h5>Top Champions</h5>
                <div class="champions-grid">
                  ${champs.slice(0,3).map(ch => `
                    <div class="champion-card">
                      <p><strong>Champion ID:</strong> ${ch.championId}</p>
                      <p><strong>Mastery Level:</strong> ${ch.championLevel}</p>
                      <p><strong>Mastery Points:</strong> ${Number(ch.championPoints).toLocaleString()}</p>
                    </div>
                  `).join('')}
                </div>
              `;
            } else {
              champDiv.innerHTML = '<p>No champion mastery data found.</p>';
            }
          }

          if (resultsSection) resultsSection.style.display = 'block';
          showBanner(lookupMessage, 'Summoner found!', 'success');
        }
      } catch (err) {
        showBanner(lookupMessage, 'Network error. Please try again.', 'error');
      } finally {
        lookupBtn.textContent = 'Look Up Summoner';
        lookupBtn.disabled = false;
      }
    });
  }
});

// ====== UI helper ======
function showBanner(node, text, type) {
  if (!node) return;
  node.textContent = text;
  node.className = `lookup-message ${type}`;
  node.style.display = 'block';
  setTimeout(() => { node.style.display = 'none'; }, 10000);
}
