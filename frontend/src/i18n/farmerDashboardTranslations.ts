export type DashboardLang = 'en' | 'hi' | 'hinglish';

export interface DashboardTranslations {
  nav: {
    overview: string;
    dashboard: string;
    liveFeed: string;
    mainMenu: string;
    features: string;
    support: string;
    home: string;
    myProduce: string;
    mandiPrices: string;
    findBuyers: string;
    myOffers: string;
    myDeals: string;
    coldStorage: string;
    farmerPool: string;
    kisanSaathi: string;
    whatsapp: string;
    profile: string;
    collapseSidebar: string;
    expandSidebar: string;
    returnToCurrent: string;
    voiceSearch: string;
    notifications: string;
    searchPlaceholder: string;
  };
  banner: {
    greetingPrefix: string;
    ji: string;
    verifiedFarmer: string;
    acresFarming: string;
    tagline: string;
    selectCrop: string;
    searchProducePlaceholder: string;
    findBuyersBtn: string;
    popularCropsLabel: string;
    calloutTitle: string;
    calloutSub: string;
    weatherLabel: string;
    clearSky: string;
    mandiLabel: string;
    perQuintal: string;
    trendUp: string;
  };
  actions: {
    sellProduce: {
      title: string;
      desc: string;
      badge?: string;
    };
    findBuyers: {
      title: string;
      desc: string;
    };
    myOffers: {
      title: string;
      desc: string;
      badge: string;
    };
    myDeals: {
      title: string;
      desc: string;
    };
    coldStorage: {
      title: string;
      desc: string;
    };
    poolFarmers: {
      title: string;
      desc: string;
    };
    govtMandi: {
      title: string;
      desc: string;
      badge: string;
    };
  };
  metrics: {
    totalVolumeTitle: string;
    activeCrops: string;
    volumeTrend: string;
    interestedBuyersTitle: string;
    inLast7Days: string;
    confirmedDealsTitle: string;
    dealsVolume: string;
    dealsTrend: string;
    projectedRevenueTitle: string;
    estimatedValue: string;
  };
  recentListings: {
    title: string;
    viewAll: string;
    tabAll: string;
    tabActive: string;
    tabDraft: string;
    tabSold: string;
    manage: string;
    addNewCrop: string;
    activeBadge: string;
  };
  recentOffers: {
    title: string;
    viewAll: string;
    newBadge: string;
    reviewReply: string;
    findMoreBuyers: string;
  };
  marketInsights: {
    title: string;
    humidity: string;
    rainChance: string;
    mandiTitle: string;
    modalPrice: string;
    sinceYesterday: string;
    aiTitle: string;
    aiAdvice: string;
  };
  tabs: {
    listings: {
      title: string;
      subtitle: string;
      addNewBtn: string;
      totalCrops: string;
      activeCrops: string;
      draftCrops: string;
      harvestReady: string;
      searchPlaceholder: string;
      filterAll: string;
      filterVerified: string;
      filterInNegotiation: string;
      colCrop: string;
      colAvailableQty: string;
      colExpectedPrice: string;
      colLocation: string;
      colStatus: string;
      colActions: string;
      viewOffers: string;
      editListing: string;
    };
    buyers: {
      title: string;
      subtitle: string;
      searchPlaceholder: string;
      filterAll: string;
      filterPotato: string;
      filterTomato: string;
      verifiedBuyer: string;
      lookingFor: string;
      demandQty: string;
      offeringRate: string;
      sendProposal: string;
      contactBuyer: string;
    };
    offers: {
      title: string;
      subtitle: string;
      tabsReceived: string;
      tabsSent: string;
      tabsCountered: string;
      tabsAccepted: string;
      buyerLabel: string;
      offeredRate: string;
      yourExpected: string;
      quantity: string;
      acceptOffer: string;
      counterOffer: string;
      rejectOffer: string;
      pendingReview: string;
    };
    orders: {
      title: string;
      subtitle: string;
      orderId: string;
      orderCrop: string;
      buyerName: string;
      totalValue: string;
      orderStatus: string;
      trackDelivery: string;
      downloadReceipt: string;
    };
    storage: {
      title: string;
      subtitle: string;
      searchPlaceholder: string;
      verifiedFacility: string;
      distanceAway: string;
      availableCapacity: string;
      ratePerMonth: string;
      bookSpace: string;
      callFacility: string;
    };
    pool: {
      title: string;
      subtitle: string;
      createPoolBtn: string;
      activePools: string;
      targetContract: string;
      currentCollected: string;
      contributeCrop: string;
      viewDetails: string;
    };
    profile: {
      title: string;
      subtitle: string;
      basicInfo: string;
      farmDetails: string;
      bankDetails: string;
      kycStatus: string;
      editProfile: string;
    };
  };
  wizard: {
    title: string;
    step1Title: string;
    step2Title: string;
    step3Title: string;
    cropSelect: string;
    variety: string;
    quantity: string;
    expectedPrice: string;
    harvestDate: string;
    storageType: string;
    cancel: string;
    next: string;
    submit: string;
    submitting: string;
  };
  voice: {
    title: string;
    listening: string;
    instruction: string;
    trySaying: string;
    close: string;
  };
  crops: {
    potato: string;
    tomato: string;
    onion: string;
    wheat: string;
    mustard: string;
    paddy: string;
    maize: string;
  };
}

export const farmerDashboardTranslations: Record<DashboardLang, DashboardTranslations> = {
  en: {
    nav: {
      overview: 'OVERVIEW',
      dashboard: 'Dashboard',
      liveFeed: 'Live Feed',
      mainMenu: 'Main Menu',
      features: 'Features & Services',
      support: 'Help & Support',
      home: 'Home Overview',
      myProduce: 'My Produce',
      mandiPrices: 'Govt Mandi Prices',
      findBuyers: 'Find Buyers',
      myOffers: 'My Offers',
      myDeals: 'My Deals',
      coldStorage: 'Cold Storage',
      farmerPool: 'Farmer Pooling',
      kisanSaathi: 'Kisan Saathi AI',
      whatsapp: 'WhatsApp Support',
      profile: 'Farmer Profile & KYC',
      collapseSidebar: 'Collapse Sidebar',
      expandSidebar: 'Expand Sidebar',
      returnToCurrent: '← Return to Current Dashboard',
      voiceSearch: 'Voice Input',
      notifications: 'Notifications',
      searchPlaceholder: 'What would you like to sell? (e.g. Potato, Tomato, Wheat...)',
    },
    banner: {
      greetingPrefix: 'Welcome,',
      ji: '',
      verifiedFarmer: '✓ Verified Farmer',
      acresFarming: 'Acres Farming',
      tagline: 'Get fair prices for your crop and connect directly with verified buyers on KisanConnect',
      selectCrop: 'Select Crop',
      searchProducePlaceholder: 'e.g. Potato, Tomato, Wheat...',
      findBuyersBtn: 'Find Buyers',
      popularCropsLabel: 'Popular:',
      calloutTitle: 'Fair Prices, Direct Buyers',
      calloutSub: 'True value for your harvest',
      weatherLabel: "Today's Weather",
      clearSky: 'Clear Sky',
      mandiLabel: "Today's Mandi Rate",
      perQuintal: '/Quintal',
      trendUp: '+5%',
    },
    actions: {
      sellProduce: {
        title: 'Sell My Produce',
        desc: 'List your crops with quantity & expected price',
        badge: 'New',
      },
      findBuyers: {
        title: 'Find Buyers',
        desc: 'Connect directly with verified local & bulk buyers',
      },
      myOffers: {
        title: 'My Offers',
        desc: 'Review received buyer offers & negotiate best prices',
        badge: '3 New',
      },
      myDeals: {
        title: 'My Deals',
        desc: 'Track confirmed orders, payments & deliveries',
      },
      coldStorage: {
        title: 'Cold Storage',
        desc: 'Find nearby certified cold storage space & rates',
      },
      poolFarmers: {
        title: 'Pool with Other Farmers',
        desc: 'Combine small lots into 60T truckloads for premium rates',
      },
      govtMandi: {
        title: 'Govt Mandi Prices',
        desc: 'Live wholesale rates from Agmarknet & data.gov.in',
        badge: 'Live Feed',
      },
    },
    metrics: {
      totalVolumeTitle: 'Total Listed Volume',
      activeCrops: '4 active crops',
      volumeTrend: '↑ +12% from last month',
      interestedBuyersTitle: 'Interested Buyers',
      inLast7Days: 'in the last 7 days',
      confirmedDealsTitle: 'Confirmed Deals',
      dealsVolume: '50 Qtl sold',
      dealsTrend: '↑ +100% from last month',
      projectedRevenueTitle: 'Projected Revenue',
      estimatedValue: 'Estimated value from active crops',
    },
    recentListings: {
      title: 'Recent Crop Listings',
      viewAll: 'View All →',
      tabAll: 'All (4)',
      tabActive: 'Active (3)',
      tabDraft: 'Draft (1)',
      tabSold: 'Sold (0)',
      manage: 'Manage',
      addNewCrop: 'Add New Crop',
      activeBadge: 'Active',
    },
    recentOffers: {
      title: 'Recent Buyer Offers',
      viewAll: 'View All →',
      newBadge: 'New Offer',
      reviewReply: 'Review & Reply →',
      findMoreBuyers: 'Find More Buyers',
    },
    marketInsights: {
      title: "Today's Key Market Insights",
      humidity: 'Humidity',
      rainChance: 'Rain Probability',
      mandiTitle: 'Potato • Agra Mandi',
      modalPrice: 'Modal Price',
      sinceYesterday: '↑ +₹100/Qtl since yesterday',
      aiTitle: 'Kisan Saathi AI Advisory',
      aiAdvice: 'Potato rates are expected to increase over the next 3 days. If possible, hold stock for 2-3 days for maximum return.',
    },
    tabs: {
      listings: {
        title: 'My Produce & Crop Inventory',
        subtitle: 'Manage all listed produce, live quantities, and direct pricing',
        addNewBtn: '+ Add New Crop',
        totalCrops: 'Total Crops',
        activeCrops: 'Active Crops',
        draftCrops: 'Drafts',
        harvestReady: 'Ready for Dispatch',
        searchPlaceholder: 'Search listings by crop name, variety, or location...',
        filterAll: 'All Produce',
        filterVerified: 'Verified Only',
        filterInNegotiation: 'Active Deals',
        colCrop: 'Crop & Variety',
        colAvailableQty: 'Available Qty',
        colExpectedPrice: 'Expected Price',
        colLocation: 'Farm Location',
        colStatus: 'Status',
        colActions: 'Actions',
        viewOffers: 'Offers',
        editListing: 'Edit',
      },
      buyers: {
        title: 'Verified Buyer Discovery',
        subtitle: 'Explore active institutional, processing, and wholesale retail buyers',
        searchPlaceholder: 'Search buyers by company name, crop demand, or region...',
        filterAll: 'All Buyers',
        filterPotato: 'Potato Buyers',
        filterTomato: 'Tomato Buyers',
        verifiedBuyer: 'Verified Buyer',
        lookingFor: 'Seeking Produce',
        demandQty: 'Required Volume',
        offeringRate: 'Target Buying Price',
        sendProposal: 'Send Direct Proposal',
        contactBuyer: 'Contact Buyer',
      },
      offers: {
        title: 'Buyer Price Offers & Negotiations',
        subtitle: 'Review price bids submitted by verified buyers and negotiate in real time',
        tabsReceived: 'Offers Received',
        tabsSent: 'Offers Sent',
        tabsCountered: 'Countered',
        tabsAccepted: 'Accepted',
        buyerLabel: 'Buyer Company',
        offeredRate: 'Offered Price',
        yourExpected: 'Your Listing Price',
        quantity: 'Quantity Requested',
        acceptOffer: 'Accept Deal',
        counterOffer: 'Make Counter-Offer',
        rejectOffer: 'Decline',
        pendingReview: 'Awaiting Your Response',
      },
      orders: {
        title: 'Confirmed Deals & Dispatch Orders',
        subtitle: 'Track agreed contracts, payment escrow milestones, and truck dispatches',
        orderId: 'Order ID',
        orderCrop: 'Produce',
        buyerName: 'Buyer',
        totalValue: 'Total Order Value',
        orderStatus: 'Deal Status',
        trackDelivery: 'Track Dispatch',
        downloadReceipt: 'Download Receipt',
      },
      storage: {
        title: 'Certified Cold Storage Network',
        subtitle: 'Locate nearby temperature-controlled warehouses to preserve crop freshness',
        searchPlaceholder: 'Search storage facilities by district or pin code...',
        verifiedFacility: 'Govt Certified Facility',
        distanceAway: 'Distance',
        availableCapacity: 'Available Space',
        ratePerMonth: 'Monthly Rental Rate',
        bookSpace: 'Reserve Storage Space',
        callFacility: 'Call Facility Manager',
      },
      pool: {
        title: 'Farmer Pooling & Bulk Lots',
        subtitle: 'Combine small lots with neighboring farmers to unlock 60-ton bulk industrial rates',
        createPoolBtn: '+ Create New Farmer Pool',
        activePools: 'Active Regional Pools',
        targetContract: 'Target Industrial Contract',
        currentCollected: 'Collected Volume',
        contributeCrop: 'Contribute My Lot',
        viewDetails: 'View Pool Details',
      },
      profile: {
        title: 'Farmer Profile & Digital Passport',
        subtitle: 'Maintain your farm registration, land verification, and KYC credentials',
        basicInfo: 'Basic Details',
        farmDetails: 'Land & Farming Records',
        bankDetails: 'Bank Account & Escrow Details',
        kycStatus: 'Verification Status',
        editProfile: 'Update Profile',
      },
    },
    wizard: {
      title: 'List Produce for Sale',
      step1Title: 'Select Crop & Variety',
      step2Title: 'Quantity & Harvest Details',
      step3Title: 'Pricing & Quality Specs',
      cropSelect: 'Select Crop',
      variety: 'Variety (e.g. Kufri Jyoti, Hybrid)',
      quantity: 'Quantity (Tons / Quintals)',
      expectedPrice: 'Expected Price (₹/kg or ₹/Qtl)',
      harvestDate: 'Harvest / Availability Date',
      storageType: 'Storage Type',
      cancel: 'Cancel',
      next: 'Continue',
      submit: 'Publish Listing',
      submitting: 'Publishing...',
    },
    voice: {
      title: 'Kisan Voice Assistant',
      listening: 'Listening to your voice...',
      instruction: 'Speak clearly into your microphone to list produce or search buyers',
      trySaying: 'Try saying: "मुझे 50 क्विंटल आलू बेचना है"',
      close: 'Close',
    },
    crops: {
      potato: 'Potato',
      tomato: 'Tomato',
      onion: 'Onion',
      wheat: 'Wheat',
      mustard: 'Mustard',
      paddy: 'Paddy',
      maize: 'Maize',
    },
  },

  hi: {
    nav: {
      overview: 'अवलोकन',
      dashboard: 'डैशबोर्ड',
      liveFeed: 'लाइव फीड',
      mainMenu: 'मुख्य मेनू',
      features: 'सुविधाएं व सेवाएं',
      support: 'सहायता व सहयोग',
      home: 'होम अवलोकन',
      myProduce: 'मेरी फसल',
      mandiPrices: 'सरकारी मंडी भाव',
      findBuyers: 'खरीदार खोजें',
      myOffers: 'मेरे ऑफर',
      myDeals: 'मेरे सौदे',
      coldStorage: 'कोल्ड स्टोरेज',
      farmerPool: 'किसान समूह',
      kisanSaathi: 'किसान साथी AI',
      whatsapp: 'व्हाट्सएप सहायता',
      profile: 'किसान प्रोफाइल व केवाईसी',
      collapseSidebar: 'साइडबार समेटें',
      expandSidebar: 'साइडबार खोलें',
      returnToCurrent: '← वर्तमान डैशबोर्ड पर वापस जाएं',
      voiceSearch: 'बोलकर बताएं',
      notifications: 'सूचनाएं',
      searchPlaceholder: 'आप क्या बेचना चाहते हैं? (जैसे: आलू, टमाटर, गेहूं...)',
    },
    banner: {
      greetingPrefix: 'नमस्ते,',
      ji: ' जी! 👋',
      verifiedFarmer: '✓ सत्यापित किसान',
      acresFarming: 'एकड़ खेती',
      tagline: 'KisanConnect के साथ अपनी फसल का सही दाम पाएं और सीधे खरीदारों से जुड़ें',
      selectCrop: 'फसल चुनें',
      searchProducePlaceholder: 'जैसे: आलू, टमाटर, गेहूं...',
      findBuyersBtn: 'खरीदार खोजें',
      popularCropsLabel: 'लोकप्रिय:',
      calloutTitle: 'अच्छा दाम, सही खरीदार',
      calloutSub: 'आपकी मेहनत का सही मूल्य',
      weatherLabel: 'आज का मौसम',
      clearSky: 'आसमान साफ',
      mandiLabel: 'आज का मंडी भाव',
      perQuintal: '/क्विंटल',
      trendUp: '+5%',
    },
    actions: {
      sellProduce: {
        title: 'मेरी फसल बेचें',
        desc: 'अपनी फसल की जानकारी, मात्रा और अनुमानित भाव डालें',
        badge: 'नया',
      },
      findBuyers: {
        title: 'खरीदार खोजें',
        desc: 'स्थानीय, प्रोसेसिंग और बड़े खरीदारों से सीधे जुड़ें',
      },
      myOffers: {
        title: 'मेरे ऑफर',
        desc: 'आए हुए ऑफर देखें और उचित भाव में पक्का सौदा करें',
        badge: '3 नए',
      },
      myDeals: {
        title: 'मेरे सौदे',
        desc: 'पक्के हुए सौदे, भुगतान और डिलीवरी का स्टेटस देखें',
      },
      coldStorage: {
        title: 'कोल्ड स्टोरेज',
        desc: 'पास के कोल्ड स्टोरेज खोजें और रेट व जगह देखें',
      },
      poolFarmers: {
        title: 'अन्य किसानों के साथ बेचें',
        desc: 'कम मात्रा मिलाकर 60 टन का बड़ा लोड बनाएं और अधिक भाव पाएं',
      },
      govtMandi: {
        title: 'सरकारी मंडी भाव',
        desc: 'ताज़ा थोक मंडी भाव देखें (Agmarknet व data.gov.in)',
        badge: 'लाइव फीड',
      },
    },
    metrics: {
      totalVolumeTitle: 'कुल सूचीबद्ध मात्रा',
      activeCrops: '4 सक्रिय फसलें',
      volumeTrend: '↑ +12% पिछले महीने से',
      interestedBuyersTitle: 'रुचि दिखाने वाले खरीदार',
      inLast7Days: 'पिछले 7 दिनों में',
      confirmedDealsTitle: 'पक्के हुए सौदे',
      dealsVolume: '50 क्विंटल बेचा गया',
      dealsTrend: '↑ +100% पिछले महीने से',
      projectedRevenueTitle: 'संभावित कमाई',
      estimatedValue: 'सक्रिय फसलों से अनुमानित मूल्य',
    },
    recentListings: {
      title: 'हाल की फसल सूची',
      viewAll: 'सभी देखें →',
      tabAll: 'सभी (4)',
      tabActive: 'सक्रिय (3)',
      tabDraft: 'ड्राफ्ट (1)',
      tabSold: 'बेची गई (0)',
      manage: 'प्रबंधित करें',
      addNewCrop: 'नई फसल जोड़ें',
      activeBadge: 'सक्रिय',
    },
    recentOffers: {
      title: 'नए खरीदारों के ऑफर',
      viewAll: 'सभी देखें →',
      newBadge: 'नया ऑफर',
      reviewReply: 'देखें और जवाब दें →',
      findMoreBuyers: 'और खरीदार खोजें',
    },
    marketInsights: {
      title: 'आज की महत्वपूर्ण जानकारी',
      humidity: 'आर्द्रता',
      rainChance: 'बारिश की संभावना',
      mandiTitle: 'आलू • आगरा मंडी',
      modalPrice: 'मॉडल भाव',
      sinceYesterday: '↑ +₹100/क्विंटल कल से',
      aiTitle: 'किसान साथी AI सलाह',
      aiAdvice: 'आलू के दाम अगले 3 दिनों में बढ़ने के आसार हैं। यदि संभव हो तो स्टॉक को 2-3 दिन रोककर बेचें।',
    },
    tabs: {
      listings: {
        title: 'मेरी फसल सूची व भंडार',
        subtitle: 'अपनी सभी सूचीबद्ध फसलों की मात्रा और दरों का प्रबंधन करें',
        addNewBtn: '+ नई फसल जोड़ें',
        totalCrops: 'कुल फसलें',
        activeCrops: 'सक्रिय फसलें',
        draftCrops: 'ड्राफ्ट',
        harvestReady: 'तैयार फसल',
        searchPlaceholder: 'फसल के नाम, किस्म या स्थान से खोजें...',
        filterAll: 'सभी फसलें',
        filterVerified: 'सत्यापित केवल',
        filterInNegotiation: 'सौदा जारी',
        colCrop: 'फसल व किस्म',
        colAvailableQty: 'उपलब्ध मात्रा',
        colExpectedPrice: 'अपेक्षित मूल्य',
        colLocation: 'खेत का स्थान',
        colStatus: 'स्थिति',
        colActions: 'कार्रवाई',
        viewOffers: 'ऑफर देखें',
        editListing: 'बदलें',
      },
      buyers: {
        title: 'सत्यापित खरीदार खोजें',
        subtitle: 'स्थानीय व्यापारियों, बड़ी कंपनियों और खाद्य प्रसंस्करण इकाइयों से जुड़ें',
        searchPlaceholder: 'खरीदार का नाम, फसल या जिले से खोजें...',
        filterAll: 'सभी खरीदार',
        filterPotato: 'आलू खरीदार',
        filterTomato: 'टमाटर खरीदार',
        verifiedBuyer: 'सत्यापित खरीदार',
        lookingFor: 'चाहिए फसल',
        demandQty: 'मांग मात्रा',
        offeringRate: 'खरीद भाव',
        sendProposal: 'प्रस्ताव भेजें',
        contactBuyer: 'संपर्क करें',
      },
      offers: {
        title: 'खरीदारों के ऑफर व बातचीत',
        subtitle: 'खरीदारों द्वारा दिए गए प्रस्तावों की समीक्षा करें और उचित भाव तय करें',
        tabsReceived: 'आए हुए ऑफर',
        tabsSent: 'भेजे गए ऑफर',
        tabsCountered: 'काउंटर ऑफर',
        tabsAccepted: 'स्वीकृत सौदे',
        buyerLabel: 'खरीदार कंपनी',
        offeredRate: 'दिया गया भाव',
        yourExpected: 'आपका भाव',
        quantity: 'मांगी गई मात्रा',
        acceptOffer: 'सौदा पक्का करें',
        counterOffer: 'नया भाव बताएं',
        rejectOffer: 'अस्वीकार करें',
        pendingReview: 'आपके जवाब की प्रतीक्षा',
      },
      orders: {
        title: 'पक्के सौदे व डिलीवरी',
        subtitle: 'स्वीकृत अनुबंध, भुगतान सुरक्षा और लोडिंग व वाहन का विवरण देखें',
        orderId: 'ऑर्डर संख्या',
        orderCrop: 'फसल',
        buyerName: 'खरीदार',
        totalValue: 'कुल राशि',
        orderStatus: 'सौदे की स्थिति',
        trackDelivery: 'वाहन ट्रैक करें',
        downloadReceipt: 'रसीद डाउनलोड करें',
      },
      storage: {
        title: 'सत्यापित कोल्ड स्टोरेज नेटवर्क',
        subtitle: 'फसल को सुरक्षित रखने और सही समय पर बेचने हेतु नजदीकी वेयरहाउस खोजें',
        searchPlaceholder: 'जिले या पिन कोड द्वारा कोल्ड स्टोरेज खोजें...',
        verifiedFacility: 'प्रमाणित वेयरहाउस',
        distanceAway: 'दूरी',
        availableCapacity: 'खाली जगह',
        ratePerMonth: 'मासिक किराया',
        bookSpace: 'स्थान बुक करें',
        callFacility: 'प्रबंधक से बात करें',
      },
      pool: {
        title: 'किसान समूह व बड़ा ट्रक लोड',
        subtitle: 'छोटे किसान आपस में मिलकर 60 टन का बड़ा ऑर्डर बनाएं और थोक भाव पाएं',
        createPoolBtn: '+ नया किसान समूह बनाएं',
        activePools: 'सक्रिय किसान समूह',
        targetContract: 'बड़ा औद्योगिक अनुबंध',
        currentCollected: 'एकत्रित मात्रा',
        contributeCrop: 'अपना माल जोड़ें',
        viewDetails: 'विवरण देखें',
      },
      profile: {
        title: 'किसान प्रोफाइल व डिजिटल पासपोर्ट',
        subtitle: 'अपनी जमीन, बैंक खाता, फसल इतिहास और सत्यापन स्थिति देखें',
        basicInfo: 'बुनियादी जानकारी',
        farmDetails: 'जमीन व रकबा',
        bankDetails: 'बैंक खाता व एस्क्रो',
        kycStatus: 'केवाईसी सत्यापन स्थिति',
        editProfile: 'प्रोफाइल बदलें',
      },
    },
    wizard: {
      title: 'फसल बेचने के लिए जोड़ें',
      step1Title: 'फसल और किस्म चुनें',
      step2Title: 'मात्रा और कटाई की जानकारी',
      step3Title: 'अपेक्षित मूल्य और गुणवत्ता',
      cropSelect: 'फसल चुनें',
      variety: 'किस्म (जैसे: कुफरी ज्योति, हाइब्रिड)',
      quantity: 'मात्रा (क्विंटल या टन)',
      expectedPrice: 'अपेक्षित भाव (₹/किलो या ₹/क्विंटल)',
      harvestDate: 'उपलब्धता की तिथि',
      storageType: 'भंडारण प्रकार',
      cancel: 'रद्द करें',
      next: 'आगे बढ़ें',
      submit: 'फसल प्रकाशित करें',
      submitting: 'प्रकाशित हो रही है...',
    },
    voice: {
      title: 'किसान वॉइस सहायक',
      listening: 'आपकी आवाज सुन रहे हैं...',
      instruction: 'फसल बेचने या खरीदार खोजने के लिए सीधे बोलें',
      trySaying: 'बोलें: "मुझे 50 क्विंटल आलू बेचना है"',
      close: 'बंद करें',
    },
    crops: {
      potato: 'आलू',
      tomato: 'टमाटर',
      onion: 'प्याज',
      wheat: 'गेहूं',
      mustard: 'सरसों',
      paddy: 'धान',
      maize: 'मक्का',
    },
  },

  hinglish: {
    nav: {
      overview: 'OVERVIEW',
      dashboard: 'Dashboard',
      liveFeed: 'Live Feed',
      mainMenu: 'Mukhya Menu',
      features: 'Suvidhaein & Services',
      support: 'Madad & Support',
      home: 'Home Overview',
      myProduce: 'Meri Fasal',
      mandiPrices: 'Govt Mandi Bhav',
      findBuyers: 'Kharidar Khojein',
      myOffers: 'Mere Offers',
      myDeals: 'Mere Saude',
      coldStorage: 'Cold Storage',
      farmerPool: 'Kisan Pool',
      kisanSaathi: 'Kisan Saathi AI',
      whatsapp: 'WhatsApp Support',
      profile: 'Kisan Profile & KYC',
      collapseSidebar: 'Sidebar Sametein',
      expandSidebar: 'Sidebar Kholein',
      returnToCurrent: '← Current Dashboard par wapas jayein',
      voiceSearch: 'Bolkar Batayein',
      notifications: 'Notifications',
      searchPlaceholder: 'Aap kya bechna chahte hain? (jaise: Aloo, Tamatar, Gehun...)',
    },
    banner: {
      greetingPrefix: 'Namaste,',
      ji: ' ji! 👋',
      verifiedFarmer: '✓ Verified Kisan',
      acresFarming: 'Acre Kheti',
      tagline: 'KisanConnect ke saath apni fasal ka sahi daam payein aur seedhe kharidaron se judein',
      selectCrop: 'Fasal Chunein',
      searchProducePlaceholder: 'Jaise: Aloo, Tamatar, Gehun...',
      findBuyersBtn: 'Kharidar Khojein',
      popularCropsLabel: 'Lokpriya:',
      calloutTitle: 'Sahi Daam, Sahi Kharidar',
      calloutSub: 'Aapki mehnat ka sachha mulya',
      weatherLabel: 'Aaj ka Mausam',
      clearSky: 'Aasman Saaf',
      mandiLabel: 'Aaj ka Mandi Bhav',
      perQuintal: '/Quintal',
      trendUp: '+5%',
    },
    actions: {
      sellProduce: {
        title: 'Meri Fasal Bechein',
        desc: 'Apni fasal ki jankari, matra aur sahi daam dalein',
        badge: 'Naya',
      },
      findBuyers: {
        title: 'Kharidar Khojein',
        desc: 'Verified local aur bulk buyers se seedhe judein',
      },
      myOffers: {
        title: 'Mere Offers',
        desc: 'Aaye hue offers dekhein aur behtar daam negotiate karein',
        badge: '3 Naye',
      },
      myDeals: {
        title: 'Mere Saude',
        desc: 'Pakke hue saude, payment aur delivery status track karein',
      },
      coldStorage: {
        title: 'Cold Storage',
        desc: 'Paas ke certified cold storage khojein aur rates dekhein',
      },
      poolFarmers: {
        title: 'Dusre Kisano Ke Sath Bechein',
        desc: 'Chhoti matra jodkar 60T order banayein aur bada fayda lein',
      },
      govtMandi: {
        title: 'Govt Mandi Bhav',
        desc: 'Live wholesale mandi rates dekhein (Agmarknet / data.gov.in)',
        badge: 'Live Feed',
      },
    },
    metrics: {
      totalVolumeTitle: 'Total Listed Matra',
      activeCrops: '4 active fasalein',
      volumeTrend: '↑ +12% pichhle mahine se',
      interestedBuyersTitle: 'Interested Buyers',
      inLast7Days: 'pichhle 7 dino me',
      confirmedDealsTitle: 'Pakke Saude',
      dealsVolume: '50 Qtl becha gaya',
      dealsTrend: '↑ +100% pichhle mahine se',
      projectedRevenueTitle: 'Sambhavit Kamai',
      estimatedValue: 'Active fasal se anumanit kamai',
    },
    recentListings: {
      title: 'Haal Ki Fasal Suchi',
      viewAll: 'Sabhi Dekhein →',
      tabAll: 'Sabhi (4)',
      tabActive: 'Active (3)',
      tabDraft: 'Draft (1)',
      tabSold: 'Bechi Gayi (0)',
      manage: 'Manage Karein',
      addNewCrop: 'Nayi Fasal Jodein',
      activeBadge: 'Active',
    },
    recentOffers: {
      title: 'Naye Buyers Ke Offers',
      viewAll: 'Sabhi Dekhein →',
      newBadge: 'Naya Offer',
      reviewReply: 'Dekhein aur Reply Karein →',
      findMoreBuyers: 'Aur Kharidar Khojein',
    },
    marketInsights: {
      title: 'Aaj Ki Mahatvapurna Jankari',
      humidity: 'Aardrata (Humidity)',
      rainChance: 'Barish Ki Sambhavna',
      mandiTitle: 'Aloo • Agra Mandi',
      modalPrice: 'Modal Bhav',
      sinceYesterday: '↑ +₹100/Qtl kal se',
      aiTitle: 'Kisan Saathi AI Salah',
      aiAdvice: 'Aloo ke daam agle 3 dino me badhne ke asaar hain. Sambhav ho to 2-3 din rokkar bechein.',
    },
    tabs: {
      listings: {
        title: 'Meri Fasal Suchi & Stock',
        subtitle: 'Apni sabhi listed fasalein, matra aur expected daam manage karein',
        addNewBtn: '+ Nayi Fasal Jodein',
        totalCrops: 'Total Fasalein',
        activeCrops: 'Active Fasalein',
        draftCrops: 'Drafts',
        harvestReady: 'Ready Stock',
        searchPlaceholder: 'Fasal ka naam, variety ya location se search karein...',
        filterAll: 'Sabhi Fasal',
        filterVerified: 'Verified Only',
        filterInNegotiation: 'Deal Chalu',
        colCrop: 'Fasal & Variety',
        colAvailableQty: 'Available Matra',
        colExpectedPrice: 'Expected Rate',
        colLocation: 'Farm Location',
        colStatus: 'Status',
        colActions: 'Actions',
        viewOffers: 'Offers',
        editListing: 'Edit Karein',
      },
      buyers: {
        title: 'Verified Kharidar Khojein',
        subtitle: 'Local traders, processing units aur bulk buyers se judein',
        searchPlaceholder: 'Buyer ka naam, crop ya location se khojein...',
        filterAll: 'Sabhi Buyers',
        filterPotato: 'Aloo Buyers',
        filterTomato: 'Tamatar Buyers',
        verifiedBuyer: 'Verified Buyer',
        lookingFor: 'Chahiye Fasal',
        demandQty: 'Requirement Matra',
        offeringRate: 'Buying Rate',
        sendProposal: 'Direct Proposal Bhejein',
        contactBuyer: 'Sampark Karein',
      },
      offers: {
        title: 'Buyers Ke Offers & Baatcheet',
        subtitle: 'Buyers dwara bheje gaye rate bids dekhein aur best price fix karein',
        tabsReceived: 'Aaye Hue Offers',
        tabsSent: 'Bheje Gaye Offers',
        tabsCountered: 'Countered',
        tabsAccepted: 'Accepted Saude',
        buyerLabel: 'Buyer Company',
        offeredRate: 'Offered Rate',
        yourExpected: 'Aapka Rate',
        quantity: 'Mangi Gayi Matra',
        acceptOffer: 'Sauda Pakka Karein',
        counterOffer: 'Naya Bhav Dein',
        rejectOffer: 'Mana Karein',
        pendingReview: 'Aapke reply ka intezar',
      },
      orders: {
        title: 'Pakke Saude & Delivery Status',
        subtitle: 'Confirmed orders, safe payments aur dispatch details track karein',
        orderId: 'Order ID',
        orderCrop: 'Fasal',
        buyerName: 'Kharidar',
        totalValue: 'Total Rashi',
        orderStatus: 'Deal Status',
        trackDelivery: 'Gadi Track Karein',
        downloadReceipt: 'Receipt Download Karein',
      },
      storage: {
        title: 'Verified Cold Storage Network',
        subtitle: 'Fasal safe rakhne aur behtar rate pane ke liye paas ke cold store khojein',
        searchPlaceholder: 'District ya PIN code se storage khojein...',
        verifiedFacility: 'Certified Warehouse',
        distanceAway: 'Doori',
        availableCapacity: 'Khali Jagah',
        ratePerMonth: 'Monthly Kiraya',
        bookSpace: 'Space Book Karein',
        callFacility: 'Manager Se Baat Karein',
      },
      pool: {
        title: 'Kisan Pool & Bulk Truckload',
        subtitle: 'Chhote kisan milkar 60 ton ka bada order banayein aur high rate payein',
        createPoolBtn: '+ Naya Kisan Pool Banayein',
        activePools: 'Active Regional Pools',
        targetContract: 'Bada Industrial Contract',
        currentCollected: 'Collected Matra',
        contributeCrop: 'Apna Maal Jodein',
        viewDetails: 'Details Dekhein',
      },
      profile: {
        title: 'Kisan Profile & Digital Passport',
        subtitle: 'Apni kheti, zameen records, bank account aur KYC status dekhein',
        basicInfo: 'Basic Jankari',
        farmDetails: 'Zameen & Kheti Records',
        bankDetails: 'Bank Account & Escrow',
        kycStatus: 'KYC Status',
        editProfile: 'Profile Edit Karein',
      },
    },
    wizard: {
      title: 'Fasal Bechne Ke Liye Jodein',
      step1Title: 'Fasal aur Variety Chunein',
      step2Title: 'Matra aur Katai Jankari',
      step3Title: 'Expected Rate aur Quality',
      cropSelect: 'Fasal Chunein',
      variety: 'Variety (jaise: Kufri Jyoti, Hybrid)',
      quantity: 'Matra (Quintal ya Ton)',
      expectedPrice: 'Expected Rate (₹/kg ya ₹/Qtl)',
      harvestDate: 'Availability Date',
      storageType: 'Storage Type',
      cancel: 'Cancel',
      next: 'Aage Badhein',
      submit: 'Fasal Publish Karein',
      submitting: 'Publish ho rahi hai...',
    },
    voice: {
      title: 'Kisan Voice Assistant',
      listening: 'Aapki aawaz sun rahe hain...',
      instruction: 'Fasal bechne ya kharidar khojne ke liye seedhe bolein',
      trySaying: 'Bolein: "Mujhe 50 quintal aloo bechna hai"',
      close: 'Band Karein',
    },
    crops: {
      potato: 'Aloo',
      tomato: 'Tamatar',
      onion: 'Pyaaz',
      wheat: 'Gehun',
      mustard: 'Sarson',
      paddy: 'Dhan',
      maize: 'Makka',
    },
  },
};
