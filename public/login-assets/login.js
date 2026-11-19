// Shows a friendly message after a failed sign-in.
const e = new URLSearchParams(location.search).get('e');
if (e) {
  const el = document.getElementById('err');
  el.textContent = e === 'wait' ? 'Too many attempts. Try again in a few minutes.' : 'That name and password did not match.';
  el.hidden = false;
}
