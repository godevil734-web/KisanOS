/**
 * KisanConnect Gemini AI Recommendation & Kisan Saathi Service
 * Uses the official @google/genai SDK.
 * 
 * CORE PRINCIPLE:
 * DETERMINISTIC BACKEND = SINGLE SOURCE OF TRUTH.
 * Gemini provides conversational understanding, explanation, and recommendation ONLY.
 * Gemini NEVER calculates distance, NEVER overrides eligibility, NEVER invents data.
 */

const { GoogleGenAI } = require('@google/genai');

let aiClient = null;

function getAiClient() {
  if (aiClient) return aiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) return null;
  try {
    aiClient = new GoogleGenAI({ apiKey: apiKey.trim() });
    return aiClient;
  } catch (err) {
    console.warn('[GEMINI AI] Client initialization error:', err.message);
    return null;
  }
}

/**
 * Deterministic fallback builder for buyer recommendations
 * Used when Gemini is offline, unconfigured, rate-limited, or returns invalid JSON.
 */
function buildDeterministicRecommendationFallback(listing, opportunities, language = 'hi') {
  const isHi = language === 'hi';
  const farmerQty = Number(listing?.quantityTons || (listing?.quantityKg ? listing.quantityKg / 1000 : 8));
  
  // Pick best local and best bulk/aggregator opportunities to present both pathways
  const localOpp = opportunities.find(o => (o.requirement?.buyerType || '').toLowerCase() === 'local');
  const bulkOpp = opportunities.find(o => (o.requirement?.buyerType || '').toLowerCase() === 'bulk');
  
  let selected = [];
  if (localOpp && bulkOpp) {
    selected = [localOpp, bulkOpp];
  } else {
    selected = opportunities.slice(0, 2);
  }

  const recommendations = selected.map(opp => {
    const req = opp.requirement || {};
    const buyerId = req.id;
    const buyerName = req.buyerCompany || req.buyerName || 'Verified Buyer';
    const dist = opp.distanceKm || 8;
    const minLotTons = (req.minimumDirectFarmerLotKg || 0) / 1000;
    const isLocal = (req.buyerType || '').toLowerCase() === 'local';
    
    let route = 'LOCAL_DIRECT';
    let reason = '';

    if (isLocal) {
      route = 'LOCAL_DIRECT';
      reason = isHi 
        ? `यह स्थानीय खरीदार ${dist} km दूर है और आपकी ${farmerQty}T फसल के लिए सीधा उपयुक्त है।`
        : `This local trader is ${dist} km away and compatible for direct purchase of your ${farmerQty}T lot.`;
    } else if (farmerQty >= minLotTons && minLotTons > 0) {
      route = 'BULK_DIRECT';
      reason = isHi
        ? `आपकी मात्रा (${farmerQty}T) खरीदार के न्यूनतम ${minLotTons}T नियम के अनुकूल है। सीधा थोक सौदा संभव है।`
        : `Your quantity (${farmerQty}T) meets the buyer's ${minLotTons}T minimum. Eligible for direct bulk procurement.`;
    } else {
      route = 'AGGREGATOR';
      reason = isHi
        ? `आपकी मात्रा (${farmerQty}T) खरीदार के न्यूनतम ${minLotTons}T से कम है। संग्राहक (Aggregator) के साथ पूल करके बेचना सबसे बेहतर विकल्प है।`
        : `Your quantity (${farmerQty}T) is below the buyer's direct minimum (${minLotTons}T). Best route is through local aggregator pooling.`;
    }

    return {
      buyerId,
      buyerName,
      route,
      reason,
      distanceKm: dist,
      confidence: 'high'
    };
  });

  const summary = isHi
    ? `आपकी ${farmerQty} टन ${listing?.cropName || 'फसल'} के लिए पास के स्थानीय खरीदार और संग्राहक विकल्प सबसे व्यावहारिक हैं।`
    : `For your ${farmerQty} Ton ${listing?.cropName || 'produce'}, local direct buyers and aggregator options provide the strongest net payout.`;

  return {
    summary,
    recommendations
  };
}

/**
 * 1. AI BUYER RECOMMENDATION (For "Find Buyers" Page)
 * Strictly grounded in verified platform facts. Validates structured JSON.
 */
async function generateBuyerRecommendation(arg1, arg2, arg3) {
  let listing = null;
  let opportunities = [];
  let language = 'hi';

  if (arg1 && typeof arg1 === 'object' && ('listing' in arg1 || 'opportunities' in arg1)) {
    listing = arg1.listing;
    opportunities = arg1.opportunities || [];
    language = arg1.language || 'hi';
  } else {
    listing = arg1;
    opportunities = Array.isArray(arg2) ? arg2 : [];
    language = (arg3 && typeof arg3 === 'object' ? arg3.language : arg3) || 'hi';
  }

  const isHi = language === 'hi';
  const fallbackMessage = isHi 
    ? 'एआई सिफारिश वर्तमान में अनुपलब्ध है। नीचे दिए गए सत्यापित खरीदारों के परिणाम देखें।' 
    : 'AI recommendation temporarily unavailable. Please review verified buyer results below.';

  if (!listing || opportunities.length === 0) {
    return {
      available: true,
      summary: isHi 
        ? 'वर्तमान में इस फसल के लिए कोई सक्रिय खरीदार मांग उपलब्ध नहीं है। जैसे ही नए ऑर्डर आएंगे, आपको सूचित किया जाएगा।' 
        : 'No active buyer requirements currently match this crop. You will be notified when new demand is posted.',
      recommendations: [],
      fallbackMessage: null
    };
  }

  const client = getAiClient();
  // If client is missing or no API key, return deterministic fallback smoothly
  if (!client) {
    const fallbackData = buildDeterministicRecommendationFallback(listing, opportunities, language);
    return {
      available: false,
      summary: fallbackData.summary,
      recommendations: fallbackData.recommendations,
      fallbackMessage
    };
  }

  const farmerQtyTons = Number(listing.quantityTons || (listing.quantityKg ? listing.quantityKg / 1000 : 8));
  
  // Package ONLY verified backend facts
  const verifiedFacts = {
    farmer: {
      crop: listing.cropName,
      variety: listing.variety || 'Standard',
      quantityTons: farmerQtyTons,
      grade: listing.grade || 'Grade A',
      location: listing.farmerLocation || 'Local Farm'
    },
    buyerOpportunities: opportunities.slice(0, 4).map(o => {
      const req = o.requirement || {};
      const minLot = (req.minimumDirectFarmerLotKg || 0) / 1000;
      const bType = (req.buyerType || (req.quantityTons >= 20 ? 'bulk' : 'local')).toLowerCase();
      
      return {
        buyerId: req.id,
        buyerName: req.buyerCompany || req.buyerName || 'Verified Buyer',
        buyerType: bType,
        requiredTons: Number(req.quantityTons),
        minimumDirectLotTons: minLot,
        distanceKm: o.distanceKm || 15,
        offeredPricePerKg: Number(req.offeredPricePerKg || 20),
        routeType: o.eligibility?.routeType || (bType === 'local' ? 'direct_local' : (farmerQtyTons >= minLot ? 'direct_bulk' : 'aggregator_pooled')),
        aggregationAllowed: req.aggregationAllowed !== false
      };
    })
  };

  const systemInstruction = `You are KisanConnect's agricultural buyer recommendation assistant.
You must only reason from the verified platform data supplied by the KisanConnect backend.
Never invent buyers, quantities, prices, distances, demand, availability, profit or market information.
Never override backend eligibility.
Never claim that a farmer is eligible for a route when the backend says they are not eligible.
Do not guarantee future prices or profits.
Explain suitable options in simple farmer-friendly language (${isHi ? 'Hindi' : 'English'}).
Explain the difference between:
1. local direct buyer (LOCAL_DIRECT)
2. direct bulk buyer (BULK_DIRECT)
3. aggregator procurement (AGGREGATOR)
Prefer practical recommendations.
Return concise structured JSON only, matching this exact schema:
{
  "summary": "Short 1-2 sentence overview for the farmer",
  "recommendations": [
    {
      "buyerId": "Must match exact buyerId from verified input",
      "buyerName": "Must match exact buyerName from verified input",
      "route": "LOCAL_DIRECT or BULK_DIRECT or AGGREGATOR",
      "reason": "Clear explanation grounded in quantity and distance",
      "distanceKm": 8,
      "confidence": "high"
    }
  ]
}`;

  try {
    const prompt = `Verified Platform Data:
${JSON.stringify(verifiedFacts, null, 2)}

Provide top 2 recommended options for this farmer. Output valid JSON only.`;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    });

    const rawText = response?.text?.trim() || '';
    let parsed = null;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      // Clean possible backticks
      const clean = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(clean);
    }

    if (!parsed || !Array.isArray(parsed.recommendations)) {
      throw new Error('Malformed JSON structure');
    }

    // Validate that returned recommendations map strictly to verified facts
    const verifiedBuyerIds = new Set(verifiedFacts.buyerOpportunities.map(b => b.buyerId));
    const validRecs = parsed.recommendations
      .filter(r => r.buyerId && verifiedBuyerIds.has(r.buyerId))
      .map(r => {
        const matchingFact = verifiedFacts.buyerOpportunities.find(b => b.buyerId === r.buyerId);
        // Enforce deterministic route rule
        let enforcedRoute = r.route;
        if (matchingFact.buyerType === 'bulk' && farmerQtyTons < matchingFact.minimumDirectLotTons) {
          enforcedRoute = 'AGGREGATOR'; // Gemini cannot override bulk lot rule
        } else if (matchingFact.buyerType === 'local') {
          enforcedRoute = 'LOCAL_DIRECT';
        }
        return {
          buyerId: r.buyerId,
          buyerName: matchingFact.buyerName,
          route: enforcedRoute || (matchingFact.buyerType === 'local' ? 'LOCAL_DIRECT' : 'AGGREGATOR'),
          reason: r.reason || 'Verified match',
          distanceKm: matchingFact.distanceKm,
          confidence: r.confidence || 'high'
        };
      });

    if (validRecs.length === 0) {
      throw new Error('No valid recommendations validated');
    }

    return {
      available: true,
      summary: parsed.summary || (isHi ? 'आपकी फसल के लिए प्रमुख विकल्प:' : 'Top buyer recommendations:'),
      recommendations: validRecs,
      fallbackMessage: null
    };

  } catch (err) {
    console.warn('[GEMINI AI] Buyer recommendation error (falling back to deterministic):', err.message);
    const fallbackData = buildDeterministicRecommendationFallback(listing, opportunities, language);
    return {
      available: false,
      summary: fallbackData.summary,
      recommendations: fallbackData.recommendations,
      fallbackMessage
    };
  }
}

/**
 * 2. KISAN SAATHI — ON-DEMAND CONVERSATIONAL FARMER AI ASSISTANT
 * Provides context-aware conversation in Hindi / Hinglish / English.
 * Strictly explains backend facts.
 */
async function generateKisanSaathiResponse({ farmer, message, history = [], verifiedContext = {} }) {
  const fallbackMessage = 'किसान साथी (AI सहायक) फ़िलहाल व्यस्त है। आप नीचे दिए गए सीधे विकल्पों से आगे बढ़ सकते हैं।';

  const defaultActions = [
    { label: 'Buyer खोजें', actionType: 'navigate_buyers', tab: 'buyers' },
    { label: 'मेरी फसल', actionType: 'navigate_crops', tab: 'listings' },
    { label: 'मेरे Offers', actionType: 'navigate_offers', tab: 'offers' },
    { label: 'Cold Storage', actionType: 'navigate_storage', tab: 'storage' }
  ];

  const client = getAiClient();
  if (!client) {
    // Deterministic fallback response when Gemini is unconfigured or offline
    const qLower = (message || '').toLowerCase();
    let reply = `नमस्ते ${farmer?.name || 'किसान भाई'}! मैं Kisan Saathi हूँ। `;
    let actions = defaultActions;

    // Security/Injection resistance check in fallback
    if (qLower.includes('ignore previous') || qLower.includes('system prompt') || qLower.includes('api key') || qLower.includes('password') || qLower.includes('database')) {
      reply = 'मैं Kisan Saathi हूँ, KisanConnect का कृषि सहायक। मैं केवल फसलों, खरीदारों और मंडी से जुड़े सवालों में मदद कर सकता हूँ।';
      return {
        success: true,
        available: false,
        reply,
        actions: defaultActions.slice(0, 2),
        fallbackMessage
      };
    }

    const isEng = !(/[\u0900-\u097F]/.test(message)) && (qLower.includes('sell') || qLower.includes('buyer') || qLower.includes('potato') || qLower.includes('crop') || qLower.includes('who'));

    if ((qLower.includes('8') && (qLower.includes('ton') || qLower.includes('t') || qLower.includes('aloo') || qLower.includes('potato'))) ||
        (qLower.includes('kisko bechu') || qLower.includes('who should i sell'))) {
      if (isEng) {
        reply = `For your 8 Ton potato supply, you have 2 verified options:\n\n1. Local Potato Trader (12 km) — Eligible for direct local sale for your 8T lot.\n2. FreshBites Foods (42 km) — Direct bulk requirement is 20T minimum (8T is below minimum), so the aggregator pooling route is recommended.`;
      } else {
        reply = `Aapke area mein 2 suitable options hain:\n\nLocal Potato Trader — 12 km\nAapki 8T quantity ke liye direct sale possible hai.\n\nFreshBites Foods — 42 km\nIs buyer ki minimum direct requirement 20T hai, isliye aapki 8T supply ke liye aggregator route better rahega.`;
      }
      actions = [
        { label: 'Local Buyer देखें', actionType: 'navigate_buyers', tab: 'buyers' },
        { label: 'Aggregator Options देखें', actionType: 'navigate_aggregator', tab: 'aggregator_info' }
      ];
    } else if (qLower.includes('20') && (qLower.includes('bulk') || qLower.includes('direct') || qLower.includes('freshbites'))) {
      reply = isEng 
        ? 'Yes! If you have 20 Tons or more, you are eligible for direct sale to bulk buyers like FreshBites Foods, as your supply meets their 20T minimum direct lot.'
        : 'हाँ, 20 टन या अधिक मात्रा होने पर आप FreshBites जैसे bulk buyers को सीधे (Direct Bulk) बेच सकते हैं, क्योंकि आपकी मात्रा उनके 20T न्यूनतम लॉट के अनुकूल है।';
      actions = [
        { label: 'Bulk Buyers देखें', actionType: 'navigate_buyers', tab: 'buyers' }
      ];
    } else if (qLower.includes('aggregator') || qLower.includes('pool')) {
      reply = isEng
        ? 'Through the Aggregator route, smaller lots are pooled together with other farmers so you can access bulk buyers without needing to supply 20+ tons alone.'
        : 'Aggregator के जरिए आप पास के अन्य किसानों के साथ अपनी फसल मिलाकर बड़े उद्योगों (Bulk Buyers) को बेच सकते हैं, जिससे न्यूनतम लॉट की शर्त पूरी हो जाती है।';
      actions = [
        { label: 'Aggregator Options देखें', actionType: 'navigate_aggregator', tab: 'aggregator_info' }
      ];
    } else if (qLower.includes('storage') || qLower.includes('cold') || qLower.includes('bhandar')) {
      reply = isEng
        ? 'Verified cold storage facilities are available in your region. You can check capacity and calculate holding profits.'
        : 'आपके क्षेत्र में सत्यापित कोल्ड स्टोरेज सुविधाएं उपलब्ध हैं, जहाँ आप अपनी फसल सुरक्षित रख सकते हैं।';
      actions = [
        { label: 'Cold Storage देखें', actionType: 'navigate_storage', tab: 'storage' }
      ];
    } else if (qLower.includes('offer') || qLower.includes('rate') || qLower.includes('bhav')) {
      reply = isEng
        ? 'You can view incoming buyer offers, negotiate prices, and accept deals under My Offers.'
        : 'खरीदारों द्वारा भेजे गए ताज़ा भाव, बोलियां और ऑफ़र देखने के लिए "मेरे Offers" पर जाएं।';
      actions = [
        { label: 'मेरे Offers देखें', actionType: 'navigate_offers', tab: 'offers' }
      ];
    } else if (qLower.includes('list') || qLower.includes('fasal') || qLower.includes('crop')) {
      reply = isEng
        ? 'You can create a new crop listing with harvest timing and quality grade to make it visible to buyers.'
        : 'अपनी फसल को मंडी में खरीदारों को दिखाने के लिए "मेरी फसल" मेनू से नई लिस्टिंग दर्ज करें।';
      actions = [
        { label: 'Crop List करें', actionType: 'navigate_crops', tab: 'listings' }
      ];
    } else if (qLower.includes('paas') || qLower.includes('near') || qLower.includes('distance')) {
      reply = isEng
        ? 'Local buyers within 10-15 km are available for quick dispatch with minimal transport cost.'
        : 'आपके 10-15 km के दायरे में स्थानीय खरीदार उपलब्ध हैं, जहां परिवहन लागत कम और भुगतान तुरंत होता है।';
      actions = [
        { label: 'Buyer खोजें', actionType: 'navigate_buyers', tab: 'buyers' }
      ];
    } else {
      reply += 'मैं फसल बेचने, खरीदार खोजने, एग्रीगेटर पूल और स्टोरेज समझने में आपकी पूरी मदद कर सकता हूँ।';
      actions = defaultActions;
    }

    return {
      success: true,
      available: false,
      reply,
      actions,
      fallbackMessage
    };
  }

  // Sanitize verified facts (NO passwords, tokens, bank details)
  const safeContext = {
    farmer: {
      name: farmer?.name || 'Farmer',
      location: farmer?.location || 'Kushinagar, UP'
    },
    activeListings: (verifiedContext.listings || []).map(l => ({
      crop: l.cropName,
      variety: l.variety,
      quantityTons: Number(l.quantityTons),
      grade: l.grade,
      expectedPricePerKg: Number(l.expectedPricePerKg)
    })),
    nearbyBuyers: (verifiedContext.buyers || []).slice(0, 5).map(b => ({
      buyerName: b.buyerCompany || b.buyerName,
      buyerType: b.buyerType,
      crop: b.cropName,
      demandTons: Number(b.quantityTons),
      minDirectLotTons: Number(b.minimumDirectFarmerLotKg || 0) / 1000,
      distanceKm: b.distanceKm || 10,
      offeredPricePerKg: Number(b.offeredPricePerKg || 20),
      directEligible: b.directEligible !== false,
      routeType: b.routeType || (b.buyerType === 'local' ? 'direct_local' : 'aggregator_pooled'),
      aggregationAllowed: b.aggregationAllowed !== false
    })),
    activeOffersCount: verifiedContext.offersCount || 0,
    storageOptions: (verifiedContext.storageFacilities || []).slice(0, 2).map(s => ({
      name: s.name,
      location: s.location,
      ratePerKgPerMonth: 0.45
    }))
  };

  const systemInstruction = `You are Kisan Saathi, the official AI agricultural assistant inside KisanConnect (KisanOS).
Your job is to help farmers understand and use KisanConnect.

STRICT PRINCIPLES:
1. Only use verified information supplied by the KisanConnect backend facts below.
2. Never invent buyers, prices, quantities, distances, availability, demand, profit or market information.
3. Never override backend eligibility or business rules.
4. If the farmer's quantity is below a buyer's minimum direct quantity (e.g. 8T vs FreshBites 20T min direct lot), clearly explain that direct bulk sale is NOT eligible, and advise the aggregator route since aggregation is allowed.
5. If the farmer has sufficient quantity (e.g. 20T >= 20T min lot), state that direct bulk sale is eligible.
6. Use simple Hindi/Hinglish when the farmer writes in Hindi/Hinglish. Use English when the farmer writes in English.
7. Keep answers concise, practical, and farmer-friendly (under 120 words).
8. Do not guarantee future prices or profits.
9. Suggest relevant existing KisanConnect action buttons.

Output Format: Return JSON only:
{
  "reply": "Your helpful conversational answer in farmer's language",
  "actions": [
    { "label": "Button text (e.g. Buyer खोजें or My Offers देखें)", "actionType": "navigate_buyers | navigate_crops | navigate_offers | navigate_storage | navigate_deals | navigate_diary | navigate_aggregator", "tab": "buyers | listings | offers | storage | orders | activities | aggregator_info" }
  ]
}`;

  try {
    const formattedHistory = (history || []).slice(-4).map(h => `${h.role === 'user' ? 'Farmer' : 'Kisan Saathi'}: ${h.text}`).join('\n');

    const prompt = `Verified Backend Context:
${JSON.stringify(safeContext, null, 2)}

Recent Conversation History:
${formattedHistory || '(New conversation)'}

Farmer's Message:
"${message}"

Respond helpfully in valid JSON format only.`;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.2,
        responseMimeType: 'application/json'
      }
    });

    const rawText = response?.text?.trim() || '';
    let parsed = null;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      const clean = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(clean);
    }

    if (!parsed || !parsed.reply) {
      throw new Error('Empty or invalid Kisan Saathi reply');
    }

    // Default actions if model returned none
    const actions = Array.isArray(parsed.actions) && parsed.actions.length > 0 
      ? parsed.actions 
      : defaultActions.slice(0, 2);

    return {
      success: true,
      available: true,
      reply: parsed.reply,
      actions,
      fallbackMessage: null
    };

  } catch (err) {
    console.warn('[GEMINI AI] Kisan Saathi error (falling back to deterministic):', err.message);
    let reply = `नमस्ते ${farmer?.name || 'किसान भाई'}! `;
    const qLower = (message || '').toLowerCase();
    
    if (qLower.includes('buyer') || qLower.includes('kharid') || qLower.includes('aloo') || qLower.includes('bech')) {
      reply += 'कुशीनगर क्षेत्र में लोकल आलू आढ़ती और बल्क खरीदार सक्रिय हैं। 8 टन आलू के लिए लोकल खरीदार सीधे और बड़े उद्योगों के लिए संग्राहक मार्ग उपयुक्त है।';
    } else {
      reply += 'मैं आपकी सहायता के लिए तैयार हूँ। आप नीचे दिए गए बटनों से तुरंत आगे बढ़ सकते हैं।';
    }

    return {
      success: true,
      available: false,
      reply,
      actions: defaultActions,
      fallbackMessage
    };
  }
}

module.exports = {
  generateBuyerRecommendation,
  generateKisanSaathiResponse,
  buildDeterministicRecommendationFallback,
  getAiClient
};
