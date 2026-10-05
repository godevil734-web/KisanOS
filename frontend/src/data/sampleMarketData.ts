export interface SampleCropItem {
  id: string;
  nameEn: string;
  nameHi: string;
  icon: string;
  samplePricePerQ: number;
  samplePriceRange: string;
  demoBuyerCount: number;
}

export interface SampleBuyerRequirement {
  id: string;
  cropId: string;
  buyerNameEn: string;
  buyerNameHi: string;
  categoryEn: string;
  categoryHi: string;
  varietyEn: string;
  varietyHi: string;
  quantityQ: number;
  offeredPricePerQ: number;
  locationEn: string;
  locationHi: string;
  termsEn: string;
  termsHi: string;
  isDemoData: boolean;
}

export const SAMPLE_CROPS: SampleCropItem[] = [
  {
    id: 'potato',
    nameEn: 'Potato',
    nameHi: 'आलू',
    icon: '🥔',
    samplePricePerQ: 1650,
    samplePriceRange: '₹1,500 - ₹1,850',
    demoBuyerCount: 14
  },
  {
    id: 'mustard',
    nameEn: 'Mustard / Sarson',
    nameHi: 'सरसों',
    icon: '🌼',
    samplePricePerQ: 5400,
    samplePriceRange: '₹5,150 - ₹5,650',
    demoBuyerCount: 12
  },
  {
    id: 'wheat',
    nameEn: 'Wheat',
    nameHi: 'गेहूं',
    icon: '🌾',
    samplePricePerQ: 2380,
    samplePriceRange: '₹2,275 - ₹2,480',
    demoBuyerCount: 18
  },
  {
    id: 'bajra',
    nameEn: 'Bajra (Millet)',
    nameHi: 'बाजरा',
    icon: '🌾',
    samplePricePerQ: 2250,
    samplePriceRange: '₹2,150 - ₹2,350',
    demoBuyerCount: 9
  },
  {
    id: 'garlic',
    nameEn: 'Garlic',
    nameHi: 'लहसुन',
    icon: '🧄',
    samplePricePerQ: 9500,
    samplePriceRange: '₹8,500 - ₹10,500',
    demoBuyerCount: 7
  },
  {
    id: 'tomato',
    nameEn: 'Tomato',
    nameHi: 'टमाटर',
    icon: '🍅',
    samplePricePerQ: 1400,
    samplePriceRange: '₹1,200 - ₹1,650',
    demoBuyerCount: 11
  }
];

export const SAMPLE_BUYER_REQUIREMENTS: SampleBuyerRequirement[] = [
  {
    id: 'req-potato-01',
    cropId: 'potato',
    buyerNameEn: 'Braj Agro Processing Pvt Ltd',
    buyerNameHi: 'ब्रज एग्रो प्रोसेसिंग प्रा. लि.',
    categoryEn: 'Snacks & Cold Storage Processing',
    categoryHi: 'चिप्स व कोल्ड स्टोरेज प्रसंस्करण',
    varietyEn: 'Chipsona / Kufri Bahar (Grade A)',
    varietyHi: 'चिपसोना / कुफरी बहार (ग्रेड A)',
    quantityQ: 350,
    offeredPricePerQ: 1650,
    locationEn: 'Sadabad-Khandauli Road, Agra (18 km)',
    locationHi: 'सादाबाद-खंदौली मार्ग, आगरा (18 किमी)',
    termsEn: 'Farm-gate collection • Electronic weighing • Direct bank transfer',
    termsHi: 'खेत पर उठान • इलेक्ट्रॉनिक तुलाई • 48 घंटे में सीधा बैंक भुगतान',
    isDemoData: true
  },
  {
    id: 'req-wheat-01',
    cropId: 'wheat',
    buyerNameEn: 'Taj Roller Flour Mills',
    buyerNameHi: 'ताज रोलर फ्लोर मिल्स',
    categoryEn: 'Flour Milling & Food Processing',
    categoryHi: 'आटा मिलिंग व खाद्य प्रसंस्करण',
    varietyEn: 'Sharbati / Lokwan (Moisture <12%)',
    varietyHi: 'शरबती / लोकवन (नमी <12%)',
    quantityQ: 300,
    offeredPricePerQ: 2380,
    locationEn: 'Achhnera Industrial Road, Agra (24 km)',
    locationHi: 'अछनेरा इंडस्ट्रियल रोड, आगरा (24 किमी)',
    termsEn: 'Mandi weighment slip • Payment release within 24 hours',
    termsHi: 'मंडी तुलाई पर्ची • 24 घंटे में बैंक भुगतान',
    isDemoData: true
  },
  {
    id: 'req-mustard-01',
    cropId: 'mustard',
    buyerNameEn: 'Yamuna Valley Agro Mills',
    buyerNameHi: 'यमुना वैली एग्रो मिल्स',
    categoryEn: 'Oilseed Extraction & Refining',
    categoryHi: 'तिलहन निष्कर्षण व तेल मिल',
    varietyEn: 'Pusa Bold / Giriraj (Oil >40%)',
    varietyHi: 'पूसा बोल्ड / गिरिराज (तेल >40%)',
    quantityQ: 180,
    offeredPricePerQ: 5400,
    locationEn: 'Shamsabad Road, Agra (22 km)',
    locationHi: 'शमसाबाद मार्ग, आगरा (22 किमी)',
    termsEn: 'Moisture & oil testing on intake • Immediate account settlement',
    termsHi: 'आवक पर नमी व तेल जांच • तुरंत खाता भुगतान',
    isDemoData: true
  },
  {
    id: 'req-tomato-01',
    cropId: 'tomato',
    buyerNameEn: 'Fatehabad Kisan Foods Co.',
    buyerNameHi: 'फतेहाबाद किसान फूड्स कंपनी',
    categoryEn: 'Fresh Vegetables & Pulping',
    categoryHi: 'ताजा सब्जी व पल्प प्रसंस्करण',
    varietyEn: 'Hybrid Ripe Red (Standard 25kg crates)',
    varietyHi: 'हाइब्रिड पका लाल (25 किग्रा क्रेट)',
    quantityQ: 150,
    offeredPricePerQ: 1400,
    locationEn: 'Fatehabad Mandi Bypass, Agra (30 km)',
    locationHi: 'फतेहाबाद मंडी बाईपास, आगरा (30 किमी)',
    termsEn: 'Crates provided by buyer • Daily digital payment',
    termsHi: 'क्रेट खरीदार द्वारा उपलब्ध • दैनिक डिजिटल भुगतान',
    isDemoData: true
  },
  {
    id: 'req-garlic-01',
    cropId: 'garlic',
    buyerNameEn: 'Bichpuri Agro Cold Chain',
    buyerNameHi: 'बिचपुरी एग्रो कोल्ड चेन',
    categoryEn: 'Spices & Controlled Atmosphere Storage',
    categoryHi: 'मसाला व नियंत्रित भंडारण',
    varietyEn: 'Desi White Garlic (Grade A)',
    varietyHi: 'देसी सफेद लहसुन (ग्रेड A)',
    quantityQ: 80,
    offeredPricePerQ: 9500,
    locationEn: 'Bichpuri Highway, Agra (16 km)',
    locationHi: 'बिचपुरी हाईवे, आगरा (16 किमी)',
    termsEn: 'Moisture controlled intake slip • Direct bank transfer',
    termsHi: 'नियंत्रित तुलाई पर्ची • सीधा बैंक ट्रांसफर',
    isDemoData: true
  }
];
