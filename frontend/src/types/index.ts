export type UserRole = 'farmer' | 'aggregator' | 'buyer' | 'cold_storage' | 'transporter' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  location: string;
  rating: number;
  reviewsCount: number;
  verified: boolean;
  completedOrders: number;
  createdAt: string;
  farmerProfile?: {
    farmName: string;
    acres: number;
    cropsGrown: string[];
    irrigationType: string;
    historicalYieldPerAcre: number;
  };
  aggregatorProfile?: {
    businessName: string;
    operatingRegion: string;
    serviceRadiusKm: number;
    maxAggregationCapacityTons: number;
    subscribedPlanId: string | null;
    subscriptionStatus: 'ACTIVE' | 'EXPIRED' | 'NONE';
    subscriptionExpiresAt: string | null;
    allowedCrops: string[];
    warehouseLocation: string;
    bankVerified: boolean;
  };
  buyerProfile?: {
    companyName: string;
    businessType: string;
    gstNumber: string;
    annualDemandTons: number;
    preferredDelivery: string;
  };
}

export interface Crop {
  id: string;
  name: string;
  category: string;
  defaultUnit: string;
  varieties: string[];
  standardGrades: string[];
  storageType: string;
  shelfLifeDaysFresh: number;
  shelfLifeDaysColdStored: number;
  keyQualityParams: string[];
  image: string;
}

export interface FarmerListing {
  id: string;
  farmerId: string;
  farmerName: string;
  farmerPhone: string;
  farmerLocation: string;
  cropId: string;
  cropName: string;
  variety: string;
  quantityTons: number;
  listingType: 'AVAILABLE_NOW' | 'FUTURE_HARVEST';
  availableDate: string;
  harvestDate?: string;
  grade: string;
  sizeMinMm: number;
  sizeMaxMm: number;
  moisturePercent: number;
  defectsPercent: number;
  expectedPricePerKg: number;
  storageRequirement: 'NONE' | 'COLD_STORAGE' | 'DRY_VENTILATED';
  verificationStatus: 'SELF_DECLARED' | 'VERIFIED';
  verifier?: string;
  status: 'ACTIVE' | 'PARTIALLY_MATCHED' | 'FULFILLED' | 'CANCELLED';
  images: string[];
  notes?: string;
  createdAt?: string;
}

export interface BuyerRequirement {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerCompany: string;
  cropId: string;
  cropName: string;
  variety: string;
  quantityTons: number;
  unit: string;
  gradeRequired: string;
  sizeMinMm: number;
  sizeMaxMm: number;
  maxMoisture: number;
  maxDefects: number;
  location: string;
  requiredDate: string;
  offeredPricePerKg: number;
  deliveryType: 'PICKUP_REQUIRED' | 'DELIVERY_TO_BUYER';
  status: 'OPEN' | 'MATCHED' | 'PARTIALLY_FULFILLED' | 'FULFILLED' | 'CANCELLED';
  specialRequirements?: string;
  createdAt?: string;
}

export interface MatchBreakdown {
  factor: string;
  weight: number;
  earned: number;
  status: string;
}

export interface NetRealization {
  buyerPrice: number;
  transportCostPerKg: number;
  loadingCostPerKg: number;
  storageCostPerKg: number;
  platformFeePerKg: number;
  totalDeductions: number;
  estimatedNetRealization: number;
  isEstimate: boolean;
  disclaimer: string;
}

export interface RequirementMatch {
  requirement: BuyerRequirement;
  matchScore: number;
  isViable: boolean;
  breakdown: MatchBreakdown[];
  reasons: string[];
  netRealization: NetRealization;
}

export interface AggregationBatchFarmer {
  listingId: string;
  farmerId: string;
  farmerName: string;
  farmerLocation: string;
  quantityTons: number;
  purchasePricePerKg: number;
  status: 'COMMITTED' | 'COLLECTED';
}

export interface AggregationBatch {
  id: string;
  aggregatorId: string;
  aggregatorName: string;
  buyerRequirementId: string;
  buyerName: string;
  cropName: string;
  variety: string;
  targetQuantityTons: number;
  currentAggregatedTons: number;
  status: 'PLANNING' | 'GATHERING' | 'READY_TO_FULFILL' | 'ACCEPTED_BY_BUYER' | 'DISPATCHED' | 'COMPLETED';
  buyerSalePricePerKg: number;
  farmerPurchasePriceAvg: number;
  estimatedLogisticsCostPerKg: number;
  estimatedStorageCostPerKg: number;
  estimatedPlatformFeePerKg: number;
  estimatedGrossMarginPerKg: number;
  farmers: AggregationBatchFarmer[];
  collectionRoute: {
    stops: string[];
    totalDistanceKm: number;
    estimatedTransportCostTotal: number;
    estimatedCostPerKg: number;
  };
  createdAt: string;
}

export interface ColdStorageInventoryItem {
  cropName: string;
  variety: string;
  quantityTons: number;
  occupiedPercent: number;
  expectedReleaseMonths: { month: string; quantityTons: number }[];
}

export interface ColdStorage {
  id: string;
  ownerId: string;
  name: string;
  location: string;
  totalCapacityTons: number;
  occupiedCapacityTons: number;
  availableCapacityTons: number;
  utilizationPercent: number;
  storageChargePerMonthPerTon: number;
  supportedCrops: string[];
  facilities: string[];
  status: 'ACTIVE' | 'MAINTENANCE';
  managerContact: string;
  inventory: ColdStorageInventoryItem[];
}

export interface StorageBooking {
  id: string;
  storageId: string;
  storageName: string;
  farmerId: string;
  farmerName: string;
  cropName: string;
  variety: string;
  quantityTons: number;
  entryDate: string;
  expectedReleaseDate: string;
  durationMonths: number;
  ratePerTonPerMonth: number;
  totalStorageCharge: number;
  status: string;
  receiptNumber: string;
}

export interface TransporterVehicle {
  id: string;
  registrationNumber: string;
  vehicleType: string;
  capacityTons: number;
  currentLocation: string;
  availability: string;
  ratePerKm: number;
  baseCharge: number;
  suitedCrops: string[];
}

export interface Transporter {
  id: string;
  userId: string;
  transporterName: string;
  companyName: string;
  baseLocation: string;
  rating: number;
  totalTripsCompleted: number;
  vehicles: TransporterVehicle[];
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  maxFarmers: number;
  maxActiveBatches: number;
  maxRegions: number;
  maxAggregationCapacityTons: number;
  allowedCrops: string[];
  analyticsAccess: boolean;
  storageAccess: boolean;
  demandAlerts: boolean;
  priorityMatching: boolean;
  badge: string;
  description: string;
}

export interface OrderTimelineItem {
  status: string;
  note: string;
  timestamp: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  buyerId: string;
  buyerName: string;
  sellerType: 'FARMER' | 'AGGREGATOR';
  sellerId: string;
  sellerName: string;
  cropName: string;
  variety: string;
  quantityTons: number;
  unitPricePerKg: number;
  produceTotal: number;
  logisticsCost: number;
  platformFee: number;
  totalAmount: number;
  pickupLocation: string;
  deliveryLocation: string;
  transporterId: string;
  transporterName: string;
  status: 'CREATED' | 'CONFIRMED' | 'AGGREGATING' | 'READY_FOR_PICKUP' | 'IN_TRANSIT' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED';
  paymentStatus: 'PENDING' | 'ESCROW_LOCKED' | 'RELEASED_TO_SELLER' | 'REFUNDED';
  createdAt: string;
  estimatedDeliveryDate: string;
  timeline: OrderTimelineItem[];
}

export interface Offer {
  id: string;
  requirementId: string;
  listingId: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  sellerRole: string;
  cropName: string;
  variety: string;
  quantityTons: number;
  buyerOfferedPricePerKg: number;
  farmerExpectedPricePerKg: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  deliveryTerms: string;
  createdAt: string;
  message?: string;
}

export interface MarketPrice {
  id: string;
  cropName: string;
  variety: string;
  mandi: string;
  district: string;
  state: string;
  date: string;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
  volumeTonsToday: number;
  source: string;
}

export interface RegionalSupplyForecast {
  region: string;
  crop: string;
  estimatedSupplyTons: number;
  estimatedDemandTons: number;
  potentialBalance: number;
  balanceType: 'SURPLUS' | 'DEFICIT';
  harvestWindow: string;
  confidenceScore: string;
  coldStorageBufferTons: number;
  recommendation: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'MATCH' | 'OFFER' | 'ORDER' | 'BATCH' | 'SUBSCRIPTION' | 'STORAGE';
  read: boolean;
  timestamp: string;
}
