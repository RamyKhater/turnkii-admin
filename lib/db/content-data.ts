/**
 * Baseline site content — the real content the public Turnkii site ships with.
 * Shared by the demo seed (local) and the production bootstrap (idempotent), so
 * a freshly bootstrapped admin shows the same styles/services/copy that are live
 * on the site, ready to edit.
 */

export const SERVICES = [
  { key: "finishing", name: "Finishing", short: "Walls, floors, ceilings, MEP and paint to a liveable standard.", lead: "6–9 wks", priceFrom: "3,500", image: "/services/finishing.jpg" },
  { key: "furniture", name: "Furniture & FF&E", short: "Sofas, beds, dining, lighting and soft goods, delivered and styled.", lead: "4–6 wks", priceFrom: "On request", image: "/services/furniture.jpg" },
  { key: "kitchen", name: "Kitchens", short: "Design, cabinetry, stone and appliances as one package.", lead: "6 wks", priceFrom: "45,000", image: "/services/kitchen.jpg" },
  { key: "hvac", name: "HVAC & cooling", short: "Split, concealed or VRF systems sized to the unit.", lead: "3 wks", priceFrom: "On request", image: "/services/hvac.jpg" },
  { key: "shutters", name: "Shutters & shading", short: "Rollers, blackout and external shading, motorised optional.", lead: "3 wks", priceFrom: "On request", image: "/services/shutters.jpg" },
  { key: "outdoor", name: "Outdoor & landscaping", short: "Terraces, decking, planting and water features.", lead: "4 wks", priceFrom: "On request", image: "/services/outdoor.jpg" },
  { key: "full", name: "Full turnkey fit-out", short: "Everything above under one contract and one programme.", lead: "9 wks", priceFrom: "10,900", image: "/services/full.jpg" },
];

export const STYLES = [
  { key: "warm", name: "Warm Contemporary", fromPrice: "11,500", leadTime: "4 wks", pieceCount: "38", heroImage: "/styles/warm.jpg",
    blurb: "Soft mass and warm timber — sand and bone upholstery, walnut casegoods, olive accents.",
    palette: [{ name: "Sand", hex: "#D9CDB8" }, { name: "Walnut", hex: "#6B4A33" }, { name: "Olive", hex: "#6C7A20" }, { name: "Bone", hex: "#F1EBDF" }] },
  { key: "neoclassic", name: "Neo-Classic Calm", fromPrice: "14,800", leadTime: "6 wks", pieceCount: "41", heroImage: "/styles/neoclassic.png",
    blurb: "Panelled walls, quiet symmetry and sage, with brass and smoked glass as the only ornament.",
    palette: [{ name: "Chalk", hex: "#EDE9E0" }, { name: "Sage", hex: "#8D9779" }, { name: "Brass", hex: "#B79150" }, { name: "Graphite", hex: "#3C3C36" }] },
  { key: "majlis", name: "Modern Majlis", fromPrice: "16,200", leadTime: "6 wks", pieceCount: "34", heroImage: "/styles/majlis.jpg",
    blurb: "Deep perimeter seating, low tables and gold — built for hosting large groups.",
    palette: [{ name: "Cocoa", hex: "#4A3227" }, { name: "Camel", hex: "#B8895C" }, { name: "Gold", hex: "#C2A055" }, { name: "Cream", hex: "#EFE5D5" }] },
  { key: "eclectic", name: "Layered Eclectic", fromPrice: "12,400", leadTime: "5 wks", pieceCount: "46", heroImage: "/styles/eclectic.jpg",
    blurb: "Teal, rattan and plants — a photograph-ready character that suits short-stay listings.",
    palette: [{ name: "Teal", hex: "#1F5B5B" }, { name: "Rattan", hex: "#C79B62" }, { name: "Linen", hex: "#E6DFD0" }, { name: "Terracotta", hex: "#B5613C" }] },
  { key: "coastal", name: "Coastal Light", fromPrice: "10,900", leadTime: "4 wks", pieceCount: "36", heroImage: "/styles/coastal.jpg",
    blurb: "Bone, oak and sea green, built for salt and sun — washable covers, UV-stable outdoor pieces.",
    palette: [{ name: "Bone", hex: "#F1EBDF" }, { name: "Oak", hex: "#C9A87C" }, { name: "Sea green", hex: "#7FA79B" }, { name: "Slate", hex: "#5C6B70" }] },
];

export const PRODUCTS = [
  { name: "Bouclé modular sofa, 260cm", category: "Seating", spec: "Feather-wrapped foam, 3-year frame warranty", price: "On request", stock: "In stock" },
  { name: "Cane-back armchair", category: "Seating", spec: "Oak frame, linen cushion, hand-woven cane", price: "On request", stock: "In stock" },
  { name: "Nesting coffee tables, pair", category: "Tables", spec: "Walnut veneer, 90cm + 60cm round", price: "On request", stock: "In stock" },
  { name: "Oval dining table, 200cm", category: "Tables", spec: "Sculpted base, honed stone top", price: "On request", stock: "6 weeks" },
  { name: "Padded headboard bed, 180×200", category: "Beds", spec: "Performance velvet, storage base", price: "On request", stock: "4 weeks" },
  { name: "Smoked glass pendant cluster", category: "Lighting", spec: "Three pendants, brass canopy, dimmable", price: "On request", stock: "In stock" },
  { name: "Faceted ring chandelier, 1.2m", category: "Lighting", spec: "Champagne gold frame, 2700K", price: "On request", stock: "8 weeks" },
  { name: "Built-in oven and hob set", category: "Appliances", spec: "60cm pyrolytic oven, induction hob, hood", price: "On request", stock: "In stock" },
  { name: "Fridge freezer, 540L", category: "Appliances", spec: "No-frost, water dispenser, inverter", price: "On request", stock: "In stock" },
  { name: "Washer dryer, 10/7kg", category: "Appliances", spec: "Inverter motor, 5-year motor warranty", price: "On request", stock: "2 weeks" },
  { name: "Terrace lounge set, 4 seats", category: "Outdoor", spec: "Aluminium and rope, UV and salt rated", price: "On request", stock: "In stock" },
  { name: "Curtain and cushion pack", category: "Soft goods", spec: "Blackout plus sheer, made to opening", price: "On request", stock: "3 weeks" },
];

export const INSPIRATION = [
  { key: "warm", room: "Living", title: "Bouclé sofa, walnut and olive", spec: "Modular 3-seat, nesting tables, layered light" },
  { key: "neoclassic", room: "Reception", title: "Panelled walls in chalk and sage", spec: "Sprayed MDF panels, brass sconces, stone table" },
  { key: "majlis", room: "Majlis", title: "Perimeter seating in camel velvet", spec: "9m linear run, low stone tables, gold ring light" },
  { key: "eclectic", room: "Living", title: "Teal velvet and rattan", spec: "Cane-back chairs, open shelving, planting set" },
  { key: "coastal", room: "Living", title: "Bone, oak and sea green", spec: "Washable loose covers, jute rug, sheer linen" },
  { key: "warm", room: "Kitchen", title: "Walnut fronts, quartz island", spec: "Handleless doors, 40mm mitred edge, brass tap" },
  { key: "coastal", room: "Outdoor", title: "Shaded terrace lounge", spec: "3m parasol, rope loungers, deck tiles" },
  { key: "neoclassic", room: "Kitchen", title: "Shaker fronts in sage", spec: "Sprayed satin, Statuario quartz, nickel fittings" },
];

export const CONTENT_BLOCKS = [
  { key: "hero", label: "Landing hero", value: { kicker: "Turnkey delivery · Cairo & North Coast", headline: "The unit is finished when it is liveable.", sub: "Finishing, furniture, kitchens, HVAC, shutters and outdoor — one contract, one programme, photographed handover." } },
  { key: "stats", label: "Landing stats", value: [{ n: "240+", label: "Units handed over" }, { n: "9 wks", label: "Average apartment" }, { n: "5", label: "Costed design styles" }, { n: "1", label: "Contract, one team" }] },
  { key: "financing", label: "Financing plans", value: [
    { name: "Milestone plan", terms: "0% over the build", fit: "Most owners" },
    { name: "Bank financing", terms: "Up to EGP 60M", fit: "Larger scopes" },
    { name: "Rent-backed", terms: "Repay from rent", fit: "Portfolios" },
    { name: "Save ahead", terms: "5% off", fit: "Planners" },
  ] },
];
