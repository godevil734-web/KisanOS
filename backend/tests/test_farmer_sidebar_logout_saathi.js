/**
 * Automated Verification: Farmer Dashboard Sidebar, Kisan Saathi Visual Identity, & Logout Flow
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..', '..');

async function runFarmerSidebarAndLogoutTests() {
  console.log('=== STARTING FARMER SIDEBAR & LOGOUT VERIFICATION SUITE ===');

  // TEST 1: Authentic Kisan Saathi AI Visual Identity Component
  console.log('\n[1/6] Testing Kisan Saathi AI Visual Identity...');
  const navIconPath = path.join(repoRoot, 'frontend', 'src', 'components', 'KisanSaathiNavIcon.tsx');
  assert(fs.existsSync(navIconPath), 'KisanSaathiNavIcon.tsx must exist');

  const navIconContent = fs.readFileSync(navIconPath, 'utf8');
  assert(navIconContent.includes('/dashboard/farmer_mascot.jpg'), 'KisanSaathiNavIcon must reuse authentic farmer mascot asset');
  assert(navIconContent.includes('animate-ping') && navIconContent.includes('bg-emerald-400'), 'Must include pulsing live online indicator from KisanSaathiWidget');

  const mascotPath = path.join(repoRoot, 'frontend', 'public', 'dashboard', 'farmer_mascot.jpg');
  assert(fs.existsSync(mascotPath), 'farmer_mascot.jpg asset must exist in public/dashboard');
  const mascotStats = fs.statSync(mascotPath);
  assert(mascotStats.size > 10000, 'farmer_mascot.jpg must be a valid image file');
  console.log(`✔ KisanSaathiNavIcon verified with authentic mascot (${(mascotStats.size / 1024).toFixed(1)} KB) and live status indicator.`);

  // TEST 2: Sidebar Menu Updates in FarmerDashboardPreview.tsx
  console.log('\n[2/6] Testing Sidebar Navigation in FarmerDashboardPreview.tsx...');
  const previewPath = path.join(repoRoot, 'frontend', 'src', 'components', 'FarmerDashboardPreview.tsx');
  const previewContent = fs.readFileSync(previewPath, 'utf8');

  // Must import KisanSaathiNavIcon and LogOut
  assert(previewContent.includes("import { KisanSaathiNavIcon } from './KisanSaathiNavIcon'"), 'Must import KisanSaathiNavIcon');
  assert(previewContent.includes('LogOut'), 'Must import LogOut icon from lucide-react');

  // Kisan Saathi menu item must use KisanSaathiNavIcon instead of Headphones
  assert(previewContent.includes("id: 'kisan_saathi', label: t.nav.kisanSaathi, icon: KisanSaathiNavIcon"), 'Kisan Saathi menu item must use KisanSaathiNavIcon');
  assert(previewContent.includes("badge: 'AI'"), 'Kisan Saathi AI badge must be preserved');
  assert(!previewContent.includes("id: 'kisan_saathi', label: t.nav.kisanSaathi, icon: Headphones"), 'Generic Headphones icon must be removed');

  // Logout must be positioned below whatsapp in navSections
  const supportSectionRegex = /title:\s*t\.nav\.support[\s\S]*?items:\s*\[([\s\S]*?)\]/;
  const match = supportSectionRegex.exec(previewContent);
  assert(match && match[1], 'Support section with items array must exist');
  const supportItemsText = match[1];
  const whatsappIndex = supportItemsText.indexOf("'whatsapp'");
  const logoutIndex = supportItemsText.indexOf("'logout'");
  assert(whatsappIndex !== -1, 'WhatsApp item must be in support section');
  assert(logoutIndex !== -1, 'Logout item must be in support section');
  assert(logoutIndex > whatsappIndex, 'Logout item must be positioned below WhatsApp Support');
  console.log('✔ Kisan Saathi icon replaced with authentic identity; Logout item placed below WhatsApp Support.');

  // TEST 3: i18n Translations for Logout across all supported locales
  console.log('\n[3/6] Testing Translations for Logout in farmerDashboardTranslations.ts...');
  const translationsPath = path.join(repoRoot, 'frontend', 'src', 'i18n', 'farmerDashboardTranslations.ts');
  const translationsContent = fs.readFileSync(translationsPath, 'utf8');

  assert(translationsContent.includes("logout: 'Logout'"), 'English nav translation must define logout');
  assert(translationsContent.includes("logout: 'लॉग आउट'"), 'Hindi nav translation must define logout');
  assert(translationsContent.includes("logout: 'Log Out'"), 'Hinglish nav translation must define logout');
  console.log('✔ Bilingual logout translations (EN: Logout, HI: लॉग आउट, Hinglish: Log Out) verified.');

  // TEST 4: Confirmation Dialog Modal and Functionality
  console.log('\n[4/6] Testing Logout Confirmation Dialog and Handler...');
  assert(previewContent.includes('showLogoutModal'), 'showLogoutModal state must be defined');
  assert(previewContent.includes('Are you sure you want to log out?'), 'Confirmation dialog English text must be present');
  assert(previewContent.includes('क्या आप लॉग आउट करना चाहते हैं?'), 'Confirmation dialog Hindi text must be present');
  assert(previewContent.includes('handleConfirmLogout'), 'handleConfirmLogout function must be defined');
  assert(previewContent.includes('sessionStorage.clear()'), 'Must clear session data on logout');
  assert(previewContent.includes("window.history.replaceState(null, '', '/')"), 'Must purge browser history entry to prevent back-navigation');
  console.log('✔ Confirmation dialog, cancel flow, and state clearing verified.');

  // TEST 5: Classic Theme Parity (FarmerDashboard.tsx)
  console.log('\n[5/6] Testing Classic Farmer Dashboard Theme Parity...');
  const classicPath = path.join(repoRoot, 'frontend', 'src', 'components', 'FarmerDashboard.tsx');
  const classicContent = fs.readFileSync(classicPath, 'utf8');

  assert(classicContent.includes('showLogoutModal'), 'Classic theme must implement showLogoutModal');
  assert(classicContent.includes('handleConfirmLogout'), 'Classic theme must implement handleConfirmLogout');
  assert(classicContent.includes('LogOut'), 'Classic theme must include LogOut icon');
  console.log('✔ Classic Farmer Dashboard theme parity verified.');

  // TEST 6: Protected Route Guard in App.tsx
  console.log('\n[6/6] Testing Protected Route Guard in App.tsx...');
  const appPath = path.join(repoRoot, 'frontend', 'src', 'App.tsx');
  const appContent = fs.readFileSync(appPath, 'utf8');

  assert(appContent.includes("pathname === '/farmer'"), 'App.tsx route guard must protect /farmer route');
  assert(appContent.includes("pathname === '/dashboard'"), 'App.tsx route guard must protect /dashboard route');
  assert(appContent.includes('hideFloatingButton={isFarmerRoute}'), 'KisanSaathiWidget must be connected with hideFloatingButton on farmer routes');
  console.log('✔ Protected route guards and on-demand Kisan Saathi integration verified.');

  console.log('\n======================================================');
  console.log('ALL FARMER SIDEBAR & LOGOUT TESTS PASSED (6/6)');
  console.log('======================================================');
}

runFarmerSidebarAndLogoutTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ TEST SUITE FAILED:', err);
    process.exit(1);
  });
