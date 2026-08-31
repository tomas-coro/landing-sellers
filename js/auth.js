// js/auth.js
async function login(email, password) {
  const { data, error } = await window.supabaseClient.auth.signInWithPassword({
    email, password
  });
  if (error) throw new Error(mappaErroreLogin(error));
  return data.session;
}

async function logout() {
  await window.supabaseClient.auth.signOut();
}

async function getSessioneCorrente() {
  const { data } = await window.supabaseClient.auth.getSession();
  return data.session;
}
