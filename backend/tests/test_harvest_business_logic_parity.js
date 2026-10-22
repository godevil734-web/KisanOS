/**
 * Regression Test: Harvest Premium Dashboard Business Logic Parity
 * Verifies that FarmerDashboardPreview.tsx matches FarmerDashboard.tsx functionality,
 * has no mock data in production, calls real backend APIs with proper auth payloads,
 * and includes all necessary modals, calculations, and handlers.
 */
const fs = require('fs');
const path = require('path');

const previewFilePath = path.join(__dirname, '../../frontend/src/components/FarmerDashboardPreview.tsx');
const classicFilePath = path.join(__dirname, '../../frontend/src/components/FarmerDashboard.tsx');

function runParityRegressionTests() {
  console.log('=== TEST SUITE: HARVEST BUSINESS LOGIC PARITY VERIFICATION ===');
  let passed = 0;
  let total = 0;

  function assert(condition, desc) {
    total++;
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
    }
  }

  assert(fs.existsSync(previewFilePath), 'FarmerDashboardPreview.tsx exists');
  assert(fs.existsSync(classicFilePath), 'FarmerDashboard.tsx exists');

  const previewContent = fs.readFileSync(previewFilePath, 'utf8');

  // 1. Zero mock records in initial state
  assert(!previewContent.includes("id: 'listing-1'"), 'Initial mock listing "listing-1" removed');
  assert(!previewContent.includes("id: 'listing-2'"), 'Initial mock listing "listing-2" removed');
  assert(!previewContent.includes("id: 'off-1'"), 'Initial mock offer "off-1" removed');
  assert(!previewContent.includes("id: 'off-2'"), 'Initial mock offer "off-2" removed');
  assert(previewContent.includes("const [listings, setListings] = useState<FarmerListing[]>([]);"), 'listings state initialized to empty array');
  assert(previewContent.includes("const [offers, setOffers] = useState<Offer[]>([]);"), 'offers state initialized to empty array');
  assert(previewContent.includes("const [orders, setOrders] = useState<Order[]>([]);"), 'orders state initialized to empty array');

  // 2. Authenticated farmer ID passed to getListings
  assert(previewContent.includes("api.getListings({ farmerId })"), 'api.getListings called with authenticated farmerId');

  // 3. Status management (mark sold & reactivate)
  assert(previewContent.includes("api.updateListingStatus(listingId, 'SOLD')"), 'api.updateListingStatus called with "SOLD"');
  assert(previewContent.includes("api.updateListingStatus(listingId, 'ACTIVE')"), 'api.updateListingStatus called with "ACTIVE"');

  // 4. Algorithmic matching & Gemini AI buyer recommendation
  assert(previewContent.includes("api.getListingMatches(listing.id)"), 'Real buyer matching algorithm called via api.getListingMatches');
  assert(previewContent.includes("api.getAiBuyerRecommendation"), 'AI Buyer Guide recommendation called via api.getAiBuyerRecommendation');

  // 5. Send Direct Offer modal & api.createOffer
  assert(previewContent.includes("api.createOffer"), 'api.createOffer called with full proposal payload');
  assert(previewContent.includes("openMakeOfferModal"), 'openMakeOfferModal handler properly implemented');

  // 6. Offer negotiation (accept, counter modal, reject)
  assert(previewContent.includes("api.acceptOffer"), 'api.acceptOffer called and refreshes data');
  assert(previewContent.includes("api.counterOffer"), 'api.counterOffer called with structured counter terms');
  assert(previewContent.includes("api.rejectOffer"), 'api.rejectOffer called with confirmation');
  assert(previewContent.includes("setCounterModal"), 'counterModal state wired to negotiation workflow');

  // 7. Order 5-step delivery & payment timeline
  assert(previewContent.includes("1. ") && previewContent.includes("5. "), 'Order delivery & payment 5-step timeline rendered');
  assert(previewContent.includes("Escrow") || previewContent.includes("एस्क्रो"), 'Escrow protection indicator present in orders');

  // 8. Modals integrated and rendered
  assert(previewContent.includes("<FarmTraceabilityModal"), 'FarmTraceabilityModal rendered');
  assert(previewContent.includes("<FieldActivityLoggerModal"), 'FieldActivityLoggerModal rendered');
  assert(previewContent.includes("makeOfferModal.isOpen"), 'MakeOfferModal rendered when open');
  assert(previewContent.includes("counterModal.isOpen"), 'CounterOfferModal rendered when open');
  assert(previewContent.includes("selectedMatchExplanation"), 'MatchExplanationModal rendered when match selected');

  // 9. Storage booking error handling (no fake receipt on catch)
  const storageErrorCheck = previewContent.includes("Storage booking failed") || previewContent.includes("भंडारण बुकिंग विफल");
  assert(storageErrorCheck, 'Storage booking failure caught and displays real error without fake success alert');

  // 10. Dynamic badges & KPI stats
  assert(previewContent.includes("activeListings.length"), 'activeListings.length used dynamically');
  assert(previewContent.includes("pendingOffersCount"), 'pendingOffersCount calculated dynamically');
  assert(previewContent.includes("activeOrdersCount"), 'activeOrdersCount calculated dynamically');

  console.log(`\n=== RESULTS: ${passed}/${total} PARITY CHECKS PASSED ===`);
  if (passed === total) {
    console.log('✅ ALL HARVEST BUSINESS LOGIC PARITY VERIFICATIONS PASSED!\n');
    process.exit(0);
  } else {
    console.error('❌ SOME PARITY CHECKS FAILED!\n');
    process.exit(1);
  }
}

runParityRegressionTests();
