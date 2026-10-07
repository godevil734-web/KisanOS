export type UserRole = 'farmer' | 'aggregator' | 'dealer' | 'buyer' | 'cold_storage' | 'transporter' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  buyerType?: 'local' | 'bulk';
  latitude?: number;
  longitude?: number;
  status?: 'active' | 'pending' | 'rejected' | 'blocked';
  phoneMasked?: string;
  rejectionReason?: string;
  isDemo?: boolean;
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
    businessType?: string;
    buyerType?: 'local' | 'bulk';
    gstNumber?: string;
    annualDemandTons?: number;
    preferredDelivery?: string;
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
  quantityKg?: number;
  totalQuantityTons?: number;
  reservedQuantityTons?: number;
  confirmedQuantityTons?: number;
  availableQuantityTons?: number;
  latitude?: number;
  longitude?: number;
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
  status: 'ACTIVE' | 'RESERVED' | 'SOLD' | 'PARTIALLY_MATCHED' | 'FULFILLED' | 'CANCELLED';
  images: string[];
  notes?: string;
  createdAt?: string;
}

export interface BuyerRequirement {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerCompany: string;
  buyerType?: 'local' | 'bulk';
  cropId: string;
  cropName: string;
  variety: string;
  quantityTons: number;
  requiredQuantityKg?: number;
  minimumDirectFarmerLotKg?: number;
  aggregationAllowed?: boolean;
  unit: string;
  gradeRequired: string;
  sizeMinMm?: number;
  sizeMaxMm?: number;
  maxMoisture?: number;
  maxDefects?: number;
  location: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  requiredDate: string;
  offeredPricePerKg: number;
  deliveryType: 'PICKUP_REQUIRED' | 'DELIVERY_TO_BUYER' | 'DIRECT_FARM';
  status: 'OPEN' | 'MATCHED' | 'PARTIALLY_FULFILLED' | 'FULFILLED' | 'CANCELLED';
  confirmedProcuredTons?: number;
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
  distanceKm?: number;
  eligibility?: {
    eligible: boolean;
    routeType: 'direct_local' | 'direct_bulk' | 'aggregator_pooled' | 'ineligible';
    reason: string;
    minLotKg?: number;
    farmerQuantityKg?: number;
    aggregationAllowed?: boolean;
  };
  visibleToFarmer?: boolean;
  breakdown: MatchBreakdown[];
  reasons: string[];
  netRealization: NetRealization;
}

export interface ProcurementPlanFarmer {
  listingId: string;
  farmerId: string;
  farmerName: string;
  quantityTons: number;
  quantityKg?: number;
  pricePerKg: number;
  distanceKm?: number;
  grade?: string;
  variety?: string;
  location?: string;
}

export interface ProcurementPlan {
  id: string;
  aggregatorId: string;
  buyerRequirementId: string;
  buyerName: string;
  cropName: string;
  variety?: string;
  targetQuantityTons: number;
  selectedFarmers: ProcurementPlanFarmer[];
  totalProcuredTons: number;
  remainingTons: number;
  buyerOfferedPricePerKg: number;
  avgFarmerPricePerKg: number;
  estimatedLogisticsCostPerKg: number;
  estimatedGrossMarginPerKg: number;
  estimatedGrossMarginTotal: number;
  status: 'DRAFT' | 'COMMITTED' | 'BATCH_CREATED' | 'CANCELLED';
  notes?: string;
  createdBatchId?: string;
  createdAt?: string;
  updatedAt?: string;
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
  status: 'CREATED' | 'CONFIRMED' | 'ACTIVE' | 'AGGREGATING' | 'READY_FOR_PICKUP' | 'IN_TRANSIT' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED';
  paymentStatus: 'PENDING' | 'ESCROW_LOCKED' | 'RELEASED_TO_SELLER' | 'REFUNDED';
  createdAt: string;
  estimatedDeliveryDate?: string;
  offerId?: string;
  listingId?: string;
  requirementId?: string;
  agreedPricePerKg?: number;
  timeline: OrderTimelineItem[];
}

export interface NegotiationHistoryItem {
  round: number;
  action: 'OFFER_CREATED' | 'COUNTER_OFFER' | 'OFFER_REJECTED' | 'DEAL_CONFIRMED' | string;
  senderId: string;
  senderRole: string;
  senderName: string;
  quantityTons?: number;
  pricePerKg?: number;
  pickupTerms?: string;
  deliveryTerms?: string;
  date?: string;
  message?: string;
  createdAt: string;
}

export interface Offer {
  id: string;
  requirementId?: string;
  listingId?: string;
  dealId?: string;
  initiatorId?: string;
  initiatorRole?: 'farmer' | 'buyer' | 'aggregator' | string;
  recipientId?: string;
  recipientRole?: 'farmer' | 'buyer' | 'aggregator' | string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  sellerRole?: string;
  cropName: string;
  variety?: string;
  quantityTons: number;
  offeredPricePerKg?: number;
  buyerOfferedPricePerKg?: number;
  farmerExpectedPricePerKg?: number;
  counterPricePerKg?: number;
  counterQuantityTons?: number;
  counterMessage?: string;
  counterBy?: 'farmer' | 'buyer' | string;
  lastActionBy?: string;
  lastActionRole?: string;
  status: 'PENDING' | 'COUNTERED' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  pickupTerms?: string;
  deliveryTerms?: string;
  targetDate?: string;
  createdAt: string;
  updatedAt?: string;
  message?: string;
  negotiationHistory?: NegotiationHistoryItem[];
  effectivePricePerKg?: number;
  effectiveQuantityTons?: number;
  direction?: 'SENT' | 'RECEIVED';
  isMyTurn?: boolean;
  statusBadge?: string;
  statusText?: string;
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

export interface AuditLogEntry {
  id: string;
  adminId: string;
  adminName?: string;
  action: string;
  targetUserId: string | null;
  targetUserName?: string | null;
  details: any;
  createdAt: string;
}

export interface FarmActivity {
  id: string;
  name: string;
  typeUri: 'sowing' | 'irrigation' | 'fertilization' | 'crop_protection' | 'harvesting' | 'sorting_grading' | 'storage_dispatch' | string;
  typeLabel?: string;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  startsAt: string;
  endsAt?: string;
  bbchStage?: string;
  conditions?: {
    temperature?: number;
    humidity?: number;
    soilMoisture?: number;
    windSpeedKmh?: number;
    [key: string]: any;
  };
  geometry?: any;
  farmerId: string;
  farmerName?: string;
  listingId?: string;
  cropName?: string;
  variety?: string;
  batchId?: string;
  resources?: Array<{
    resourceType: 'MACHINE' | 'WORKER';
    name: string;
    role?: string;
  }>;
  inputsOutputs?: Array<{
    type: 'INPUT' | 'OUTPUT';
    item: string;
    quantity: string;
  }>;
  notes?: string;
  createdAt: string;
}

export interface TraceabilityPassport {
  listing: FarmerListing;
  passportId: string;
  standardCompliance: string;
  activitiesCount: number;
  activities: FarmActivity[];
  agronomicSummary: {
    crop: string;
    variety: string;
    grade: string;
    harvestDate: string;
    location: string;
    verificationStatus: string;
    organicOrIpmpPractices: boolean;
    waterOptimized: boolean;
  };
}

export interface BuyerRecommendationItem {
  buyerId: string;
  buyerName: string;
  route: 'LOCAL_DIRECT' | 'BULK_DIRECT' | 'AGGREGATOR' | string;
  reason: string;
  distanceKm: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface BuyerRecommendationResponse {
  available: boolean;
  summary: string;
  recommendations: BuyerRecommendationItem[];
  fallbackMessage?: string | null;
}

export interface KisanSaathiAction {
  label: string;
  actionType: 'navigate_buyers' | 'navigate_crops' | 'navigate_offers' | 'navigate_storage' | 'navigate_deals' | 'navigate_diary' | 'navigate_aggregator' | string;
  tab?: 'buyers' | 'listings' | 'offers' | 'storage' | 'orders' | 'activities' | 'aggregator_info' | string;
}

export interface KisanSaathiMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  actions?: KisanSaathiAction[];
  isFallback?: boolean;
}



