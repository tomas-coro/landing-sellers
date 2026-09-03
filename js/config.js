// js/config.js
// Valori pubblici (anon key), protetti dalle policy RLS di Supabase.
const SUPABASE_URL = 'https://mptbmhqnsvpiflzjzbea.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wdGJtaHFuc3ZwaWZsemp6YmVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNjYxNTAsImV4cCI6MjEwMzc0MjE1MH0.NT39RlaXDgZwTPttwdj-5a2OpsV_Ek4CJE97JuiSwZM';

// Web Push (VAPID). Solo la PUBLIC key: puo' stare qui perche' senza la
// private key (mai nel repo, solo Supabase Edge Function secret) non permette
// di inviare nulla. Coppia generata una sola volta con @negrel/webpush (Web
// Crypto, curva P-256).
const VAPID_PUBLIC_KEY = 'BBmOrvZUK3lAYpMr6Cgmw2P-u6jpbNRI2zns0_lXB2WZd9nLSAxuJBZd_VhfvECDulJIoXj9fYz-p3yU6Yx9BEo';
