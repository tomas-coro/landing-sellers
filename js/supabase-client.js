// js/supabase-client.js

(function () {
  const ACTIVE_SLOT_KEY = 'le-active-account-slot';
  const ADMIN_STORAGE_KEY = 'le-admin-auth-session';

  function creaClientPersonale() {
    return window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );
  }

  function creaClientAdmin() {
    return window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          storageKey: ADMIN_STORAGE_KEY
        }
      }
    );
  }

  const clients = {
    personale: creaClientPersonale(),
    admin: creaClientAdmin()
  };

  function normalizzaSlot(slot) {
    return slot === 'admin' ? 'admin' : 'personale';
  }

  function getActiveSlot() {
    return normalizzaSlot(localStorage.getItem(ACTIVE_SLOT_KEY));
  }

  function setActiveSlot(slot) {
    const normalized = normalizzaSlot(slot);
    localStorage.setItem(ACTIVE_SLOT_KEY, normalized);
    window.supabaseClient = clients[normalized];
    return normalized;
  }

  function getClient(slot) {
    return clients[normalizzaSlot(slot)];
  }

  async function getSession(slot) {
    const { data } = await getClient(slot).auth.getSession();
    return data.session || null;
  }

  async function signIn(slot, email, password) {
    const { data, error } = await getClient(slot).auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    return data.session;
  }

  async function signOut(slot) {
    const { error } = await getClient(slot).auth.signOut();
    if (error) throw error;
  }

  window.AccountSessions = {
    getActiveSlot,
    setActiveSlot,
    getClient,
    getSession,
    signIn,
    signOut
  };

  window.supabaseClient = clients[getActiveSlot()];
})();
