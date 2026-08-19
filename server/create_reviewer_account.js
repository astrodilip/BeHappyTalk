// Seeds the Google Play reviewer accounts for both apps.
//
// The reviewer signs in with the OTP flow using phone 9999999999 and the fixed
// OTP 123456 (see REVIEWER_PHONE / REVIEWER_OTP in server.js). This script only
// creates the matching database rows so that OTP verification finds an existing
// account instead of pushing the reviewer into the signup screen.
//
//   Customer app -> `users` row   (wallet pre-funded so paid features are testable)
//   Vendor app   -> `providers` row (hidden from the public provider listing)
//
// Run with: node server/create_reviewer_account.js
const db = require('./db.js');
const bcrypt = require('bcryptjs');

const REVIEWER_PHONE = process.env.REVIEWER_PHONE || '9999999999';
const LEGACY_PHONE = '+91' + REVIEWER_PHONE; // an older script stored it in E.164
const REVIEWER_NAME = 'Play Store Reviewer';
const REVIEWER_WALLET = 5000;
// The reviewer never signs in with a password; these rows exist only for the OTP
// flow, and `password` is NOT NULL in the schema.
const REVIEWER_PASSWORD = process.env.REVIEWER_PASSWORD || 'password';

async function normalizeLegacyPhone(table) {
  const { data: legacy } = await db.from(table).select('id').eq('phone', LEGACY_PHONE).maybeSingle();
  if (!legacy) return;
  const { data: current } = await db.from(table).select('id').eq('phone', REVIEWER_PHONE).maybeSingle();
  if (current) {
    // A correctly-formatted row already exists, so the E.164 duplicate is dead weight.
    await db.from(table).delete().eq('id', legacy.id);
    console.log(`[${table}] removed legacy ${LEGACY_PHONE} row`);
  } else {
    await db.from(table).update({ phone: REVIEWER_PHONE }).eq('id', legacy.id);
    console.log(`[${table}] migrated ${LEGACY_PHONE} -> ${REVIEWER_PHONE}`);
  }
}

async function seedUser(hashedPassword) {
  await normalizeLegacyPhone('users');
  const { data: existing } = await db.from('users').select('id').eq('phone', REVIEWER_PHONE).maybeSingle();
  if (existing) {
    const { error } = await db.from('users').update({
      name: REVIEWER_NAME, password: hashedPassword, walletBalance: REVIEWER_WALLET,
    }).eq('id', existing.id);
    if (error) throw new Error(`users update: ${error.message}`);
    console.log(`[users] updated reviewer account (${existing.id})`);
    return;
  }
  const id = 'u_reviewer';
  const { error } = await db.from('users').insert({
    id, name: REVIEWER_NAME, phone: REVIEWER_PHONE, password: hashedPassword,
    walletBalance: REVIEWER_WALLET,
  });
  if (error) throw new Error(`users insert: ${error.message}`);
  console.log(`[users] created reviewer account (${id})`);
}

async function seedProvider(hashedPassword) {
  await normalizeLegacyPhone('providers');
  const { data: existing } = await db.from('providers').select('id').eq('phone', REVIEWER_PHONE).maybeSingle();
  if (existing) {
    const { error } = await db.from('providers').update({
      name: REVIEWER_NAME, password: hashedPassword, verified: true, status: 'offline',
    }).eq('id', existing.id);
    if (error) throw new Error(`providers update: ${error.message}`);
    console.log(`[providers] updated reviewer account (${existing.id})`);
    return;
  }
  const id = 'p_reviewer';
  const { error } = await db.from('providers').insert({
    id, name: REVIEWER_NAME, phone: REVIEWER_PHONE, password: hashedPassword,
    verified: true, status: 'offline', priceChat: 10, priceCall: 20, priceVideo: 30,
    walletBalance: 0,
  });
  if (error) throw new Error(`providers insert: ${error.message}`);
  console.log(`[providers] created reviewer account (${id})`);
}

(async () => {
  try {
    const hashedPassword = await bcrypt.hash(REVIEWER_PASSWORD, 10);
    await seedUser(hashedPassword);
    await seedProvider(hashedPassword);
    console.log(`\nReviewer sign-in: phone ${REVIEWER_PHONE}, OTP ${process.env.REVIEWER_OTP || '123456'} (fixed, no SMS)`);
    process.exit(0);
  } catch (e) {
    console.error('Failed to seed reviewer accounts:', e.message);
    process.exit(1);
  }
})();
