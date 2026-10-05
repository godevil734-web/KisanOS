# KisanConnect — Full Agricultural Supply Chain Platform

> **"Connect. Aggregate. Store. Move. Sell."**

KisanConnect is a multi-sided agricultural marketplace and supply chain platform designed to overcome fragmentation in agricultural commerce. Rather than attempting to "remove middlemen," KisanConnect digitizes and coordinates the functions performed by farmers, local aggregators, food processors, cold storage operators, and transporters.

---

## 🌾 Platform Architecture & Core Features

### 1. Crop-Agnostic Engine
* Fully configurable across **Vegetables, Grains, Pulses, Fruits, and Oilseeds** (Demonstrated with Potato, Onion, Tomato, Wheat, Rice, Maize, and Mango).
* Dynamic quality grading parameters: size range ($mm$), dry matter, moisture %, permissible defects %, and storage compatibility.

### 2. Multi-Sided Stakeholder Dashboards
* **Farmer Hub**:
  * Create produce listings for **Available Now** (harvested) or **Future Harvest** (pre-harvest).
  * **Transparent 7-Factor Match Engine**: Crop (25%), Quality (20%), Quantity (15%), Proximity (15%), Date (10%), Price (10%), Variety (5%).
  * **Estimated Net Realization Calculator**: Calculates farm-gate realization ($\text{Buyer Bid} - \text{Transport} - \text{Handling} - \text{Storage} - \text{Fees}$).
  * **Farmer Storage Decision Engine**: "Sell Now vs Cold Store & Sell Later" scenario simulator.
* **Local Aggregator Desk**:
  * Geographic operating zones (e.g., Agra - Mathura - Firozabad, 0–50 km radius).
  * **Subscription System**: Basic (₹499/mo), Professional (₹999/mo), and Business (₹1,999/mo) with limits on active batches, farmer connections, and capacity.
  * **Interactive Batch Aggregation Builder**: Pool small farmer lots (10T + 15T + 20T) toward 60T–100T industrial contracts with a live progress bar.
  * **Economic Gross Margin Model**: Displays $\text{Buyer Sale Value} - \text{Farmer Purchase Cost} - \text{Logistics/Storage Costs}$.
  * **Multi-Stop Collection Route Planner**: Route consolidation preview with distance and ₹/kg freight metrics.
* **Buyer Procurement**:
  * Industrial demand specifications (volume, variety, grade, size caliber, delivery timeline).
  * **3-Channel Supply Discovery**: Direct Farmers, Aggregator Batches, and Cold Storage inventory.
  * **Escrow Order Lifecycle**: State machine transitions (`CREATED` → `CONFIRMED` → `AGGREGATING` → `READY_FOR_PICKUP` → `IN_TRANSIT` → `DELIVERED` → `COMPLETED`).
* **Cold Storage Operator**:
  * 10,000T capacity gauge with live utilization % (Occupied vs Available).
  * Crop inventory breakdown (Potato, Onion, etc.).
  * Scheduled market release calendar (monthly out-turn projections).
  * Digital intake booking receipt generation.
* **Transporter Logistics**:
  * Vehicle fleet directory (Canter 6T, Tata Heavy 22T, Bolero 2T).
  * Aggregated multi-pickup collection route freight calculator.
* **Market Intelligence & AI Agronomic Layer**:
  * APMC Mandi spot rates across Agra, Mathura, Firozabad, Azadpur, Kanpur, and Lucknow.
  * Regional Supply vs Demand Gap balance (Surplus / Deficit analysis).
  * **Machine Learning Agronomic Yield Predictor**: Area × Variety × Irrigation multiplier.
  * **Computer Vision Produce Grader Simulator**: Convolutional neural net produce visual inspection for tuber sizing, surface blemishes, and grade certification.
* **Admin Control Center**:
  * Platform KPIs, GMV transacted, and user verification toggles.
  * Dynamic Subscription Plan Editor (tune prices, batch limits, and regional caps without hardcoding).
  * Seed data restoration utility.

---

## ⚡ Quick Demo Persona Switcher (Local Development & Evaluator Demo Only)

The application includes a persona switch bar in the top navigation allowing evaluators to preview roles with one click in development mode:
* **🌾 Farmer**: Ramesh Kumar (`ramesh@kisan.in` / `9876543210`) — Logs in via Mobile + OTP (`123456` when DEMO_MODE=true)
* **📦 Aggregator**: Vikram Singh (`vikram@aggregator.in`)
* **🏭 Buyer**: FreshBites Foods Pvt Ltd (`pooja@freshbites.com`)
* **❄️ Cold Storage**: Agra Imperial Cold Logistics (`harish@agracold.in`)
* **🚚 Transporter**: Kisan Express Freight (`manoj@kisanexpress.in`)
* **⚙️ Admin**: Platform Administrator (`admin@kisanconnect.in`)

> **Security Advisory**: 
> - **Demo Mode (`DEMO_MODE=true`)**: Demo accounts (`password123`), persona switching (`/api/auth/demo-switch`), database resetting (`/api/admin/reset-demo`), and fixed demo OTP (`123456`) are strictly controlled by `DEMO_MODE=true`. By default (`DEMO_MODE=false`), none of these work in any environment.
> - **Demo OTP Scope (`DEMO_PHONES`)**: The fixed demo OTP `123456` is scoped exclusively to authorized demo phone numbers listed in `DEMO_PHONES`. Real users can never be accessed with the demo OTP.
> - **Admin Password (`ADMIN_PASSWORD`)**: There is **no default admin password** in the codebase. You **must** provide `ADMIN_PASSWORD` in your `.env` file; if missing, admin initialization and seeding will fail with a fatal error in all environments.

---

## 🚀 Running Locally

### 1. Start the Backend API Server
```bash
cd backend
npm install
node server.js
```
*Backend runs on `http://localhost:5001` with persistent JSON database in `backend/data/db.json`.*

### 2. Start the Frontend React Client
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:3000`.*

---

## 🛡️ Statutory Advisory
Agricultural price realizations and supply forecasts are indicative model estimates based on terminal arrivals and distance metrics. No guaranteed futures or guaranteed profits are claimed, adhering strictly to fair agricultural trade transparency.
