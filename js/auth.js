// js/auth.js

async function login(email, password) {
  try {
    const sessione = await window.AccountSessions.signIn(
      'personale',
      email,
      password
    );
    window.AccountSessions.setActiveSlot('personale');
    return sessione;
  } catch (error) {
    throw new Error(mappaErroreLogin(error));
  }
}

async function loginAccount(slot, email, password) {
  try {
    return await window.AccountSessions.signIn(slot, email, password);
  } catch (error) {
    throw new Error(mappaErroreLogin(error));
  }
}

async function sessioneAccount(slot) {
  return window.AccountSessions.getSession(slot);
}

async function cambiaAccount(slot) {
  const sessione = await sessioneAccount(slot);
  if (!sessione) return null;

  window.AccountSessions.setActiveSlot(slot);
  return sessione;
}

async function logoutAccount(slot) {
  await window.AccountSessions.signOut(slot);
}

async function logout() {
  await logoutAccount(window.AccountSessions.getActiveSlot());
}

async function getSessioneCorrente() {
  const slotAttivo = window.AccountSessions.getActiveSlot();
  const sessioneAttiva = await sessioneAccount(slotAttivo);

  if (sessioneAttiva) return sessioneAttiva;

  const altroSlot = slotAttivo === 'admin' ? 'personale' : 'admin';
  const altraSessione = await sessioneAccount(altroSlot);

  if (altraSessione) {
    window.AccountSessions.setActiveSlot(altroSlot);
    return altraSessione;
  }

  window.AccountSessions.setActiveSlot('personale');
  return null;
}
