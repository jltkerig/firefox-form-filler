const form = document.getElementById('login-form');
const password = document.getElementById('password');
const confirmation = document.getElementById('confirm-password');
const confirmRow = document.getElementById('confirm-row');
const submit = document.getElementById('submit');
const status = document.getElementById('status');
let setup = false;

function destination() {
  return new URLSearchParams(location.search).get('next') === 'options' ? 'options.html' : 'popup.html';
}

async function initialize() {
  const current = await FFF_AUTH.state();
  if (current.unlocked) { location.replace(destination()); return; }
  setup = !current.configured;
  if (setup) {
    document.getElementById('title').textContent = 'Protect Job Autofill';
    document.getElementById('intro').textContent = 'Create a local password. You will use it after Firefox restarts or whenever you lock the extension.';
    password.autocomplete = 'new-password';
    confirmRow.hidden = false;
    confirmation.required = true;
    submit.textContent = 'Create password';
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  submit.disabled = true;
  status.textContent = '';
  try {
    if (setup) {
      if (password.value !== confirmation.value) throw new Error('The passwords do not match.');
      await FFF_AUTH.create(password.value);
    } else if (!(await FFF_AUTH.unlock(password.value))) {
      await new Promise(resolve => setTimeout(resolve, 700));
      throw new Error('That password is not correct.');
    }
    await browser.runtime.sendMessage({type: 'unlock-extension'});
    location.replace(destination());
  } catch (error) {
    status.textContent = error.message || 'Could not unlock the extension.';
    password.select();
  } finally { submit.disabled = false; }
});

initialize().catch(() => { status.textContent = 'Could not read the local lock settings.'; submit.disabled = true; });
