export const categories = [
  {
    id: 'cameras',
    name: 'Cameras',
    tagline: 'Cinema, Mirrorless, DSLR & Action',
    count: 42,
    image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=85',
  },
  {
    id: 'lighting',
    name: 'Lighting',
    tagline: 'LED, Strobes & Grip',
    count: 35,
    image: 'https://waldo.pro/wp-content/uploads/2024/03/Lighting-Equipment-1-564x317.jpg',
  },
  {
    id: 'audio',
    name: 'Audio',
    tagline: 'Mics, Mixers & Wireless',
    count: 18,
    image: 'https://images.unsplash.com/photo-1524678606370-a47ad25cb82a?auto=format&fit=crop&w=1200&q=85',
  },
  {
    id: 'camping',
    name: 'Camping Gear',
    tagline: 'Tents, Sleeping Bags & Cooking',
    count: 8,
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1200&q=85',
  },
  {
    id: 'events',
    name: 'Event Supplies',
    tagline: 'Tables, Chairs & Decor',
    count: 15,
    image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=85',
  },
];

const productRecords = [
  {
    id: 'sony-pxw-z150',
    name: 'Sony PXW-Z150 4K',
    category: 'cameras',
    price: 15000,
    status: 'available',
    blurb: 'Professional 4K XDCAM camcorder with 1.0-type Exmor RS CMOS sensor. Basic package included.',
    description: 'A dependable run-and-gun 4K camcorder built for documentary and event work. The 1.0-type sensor holds up in mixed lighting, and the fixed zoom lens means fewer moving parts to worry about on set.',
    specs: { Capacity: '1 Operator', Weight: '2.1 lbs', Sensor: '1.0-type Exmor RS', Rating: 'Pro' },
    features: ['4K XDCAM recording', 'Fixed 25x zoom lens', 'Dual XLR audio inputs', '3.5" LCD touchscreen'],
  },
  {
    id: 'sony-a7iv',
    name: 'Sony A7IV 4K',
    category: 'cameras',
    price: 8000,
    status: 'available',
    blurb: 'Hybrid full-frame mirrorless, 4K60 internal, ideal for run-and-gun shoots.',
    description: 'The workhorse hybrid body for shooters who need stills and video from one kit. 4K60 internal recording and reliable autofocus make it a safe pick for fast-moving shoots.',
    specs: { Capacity: '1 Operator', Weight: '1.4 lbs', Sensor: 'Full-Frame', Rating: 'Pro' },
    features: ['4K60 internal recording', 'In-body stabilization', 'Dual card slots', 'Real-time eye AF'],
  },
  {
    id: 'manfrotto-mt190',
    name: 'Manfrotto MT190XPRO4',
    category: 'lighting',
    price: 1500,
    status: 'available',
    blurb: 'MVH500AH Fluid Head',
    description: 'A dependable aluminum tripod with a fluid video head, suited to interviews and steady handheld-alternative shots.',
    specs: { Capacity: '15 lbs Payload', Weight: '5.7 lbs', 'Max Height': '61.4 in', Rating: 'Standard' },
    features: ['Fluid video head', '4-section legs', 'Quick-release plate', 'Bubble level'],
  },
  {
    id: 'blackmagic-pocket-6k',
    name: 'Blackmagic Pocket 6K Pro',
    category: 'cameras',
    price: 10000,
    status: 'available',
    blurb: 'Lite Package',
    description: 'A cinema camera in a compact body, with a Super 35 sensor and built-in ND filters for narrative and commercial work.',
    specs: { Capacity: '1 Operator', Weight: '2.4 lbs', Sensor: 'Super 35', Rating: 'Pro' },
    features: ['6K resolution', 'Built-in ND filters', 'Dual native ISO', '5" touchscreen'],
  },
  {
    id: 'aputure-ls600d',
    name: 'Aputure LS 600d Pro',
    category: 'lighting',
    price: 40000,
    status: 'available',
    blurb: '2 sets w/ Modifiers',
    description: 'A daylight-balanced LED fixture bright enough to punch through windows or key a wide set, paired with common modifiers.',
    specs: { Capacity: '2 Fixtures', Weight: '18 lbs / set', Output: '2x Bowens Mount', Rating: 'Pro' },
    features: ['600W daylight LED', 'Bowens mount modifiers', 'DMX control', 'Silent operation'],
  },
  {
    id: 'north-face-tent',
    name: 'North Face 4-Person Expedition Tent',
    category: 'camping',
    price: 2500,
    status: 'available',
    blurb: '4-Person Weatherproof',
    description: 'Designed for high-altitude base camps and extreme weather conditions. This expedition-grade tent features a dual-wall construction and a reinforced geodesic dome structure capable of withstanding hurricane-force winds and heavy snow loads. Engineered for reliability when failure is not an option.',
    specs: { Capacity: '4 Person', Weight: '12.4 lbs', 'Floor Area': '64 sq ft', Rating: '4-Season' },
    features: [
      'Fully taped nylon tub floor',
      'Glow-in-the-dark color-coded zip pulls',
      'DAC featherlite NSL™ poles',
      'High-low venting for internal breathability',
      'Dual doors with a large front vestibule',
      'Internal hanger loops and pockets',
    ],
  },
  {
    id: 'jbl-partybox-310',
    name: 'JBL PartyBox 310',
    category: 'events',
    price: 3000,
    status: 'available',
    blurb: 'Bluetooth, RGB Lights',
    description: 'A portable PA speaker with punchy bass and built-in lighting, sized right for a backyard event or a small venue.',
    specs: { Capacity: '1 Unit', Weight: '31 lbs', Battery: '18 hrs', Rating: 'Standard' },
    features: ['240W output', 'Bluetooth streaming', 'Dynamic RGB lighting', 'Guitar/mic input'],
  },
  {
    id: 'msr-whisperlite',
    name: 'MSR WhisperLite Universal',
    category: 'camping',
    price: 800,
    status: 'available',
    blurb: 'Stove & Fuel',
    description: 'A multi-fuel backpacking stove that runs on canister or liquid fuel, built for basecamp cooking in any conditions.',
    specs: { Capacity: '1 Unit', Weight: '1.0 lb', 'Boil Time': '3.5 min/L', Rating: 'Standard' },
    features: ['Multi-fuel capable', 'Field-maintainable', 'Compact fold-down', 'Wind-resistant burner'],
  },
  {
    id: 'summit-sleeping-bag',
    name: 'Summit Series -20F Bag',
    category: 'camping',
    price: 1200,
    status: 'available',
    blurb: 'Sleeping System',
    description: 'A down-filled mummy bag rated for sub-zero nights, built for expedition basecamps.',
    specs: { Capacity: '1 Person', Weight: '3.9 lbs', 'Temp Rating': '-20°F', Rating: '4-Season' },
    features: ['800-fill down', 'Draft collar & tube', 'Compression sack included', 'Water-resistant shell'],
  },
  {
    id: 'osprey-aether',
    name: 'Osprey Aether Pro 85L',
    category: 'camping',
    price: 1500,
    status: 'available',
    blurb: 'Packs',
    description: 'An 85-liter expedition pack with an adjustable suspension, built to carry heavy loads over multi-day trips.',
    specs: { Capacity: '85L', Weight: '4.6 lbs', Frame: 'Adjustable', Rating: 'Pro' },
    features: ['Adjustable torso length', 'Removable top lid', 'Hydration compatible', 'Rain cover included'],
  },
  {
    id: 'petzl-swift-rl',
    name: 'Petzl Swift RL 900',
    category: 'lighting',
    price: 400,
    status: 'available',
    blurb: 'Lighting',
    description: 'A rechargeable headlamp with reactive lighting that auto-adjusts brightness to your surroundings.',
    specs: { Capacity: '1 Unit', Weight: '0.2 lbs', Output: '900 lumens', Rating: 'Standard' },
    features: ['Reactive Lighting technology', 'USB-C rechargeable', 'Red night vision mode', 'Water resistant'],
  },
  {
    id: 'canon-24-70',
    name: 'Canon EF 24-70mm',
    category: 'cameras',
    price: 1800,
    status: 'available',
    blurb: 'f/2.8L II Zoom Lens',
    description: 'A constant f/2.8 standard zoom, the default workhorse lens for run-and-gun and interview work.',
    specs: { Mount: 'Canon EF', Weight: '1.8 lbs', Aperture: 'f/2.8 Constant', Rating: 'Pro' },
    features: ['Constant f/2.8 aperture', 'Ring-type USM autofocus', 'Weather-sealed', 'Fluorine coating'],
  },
  {
    id: 'canon-eos-r6',
    name: 'Canon EOS R6 Mark II',
    category: 'cameras',
    price: 7500,
    status: 'available',
    blurb: 'Full-Frame Hybrid Body',
    description: 'A fast full-frame mirrorless camera for photo and video productions, with dependable autofocus and strong low-light performance.',
    specs: { Capacity: '1 Operator', Weight: '1.5 lbs', Sensor: 'Full-Frame', Rating: 'Pro' },
    features: ['4K60 video', 'Dual-pixel autofocus', 'In-body stabilization', 'Dual card slots'],
  },
  {
    id: 'gopro-hero12',
    name: 'GoPro HERO12 Black',
    category: 'cameras',
    price: 1800,
    status: 'available',
    blurb: 'Action Camera Kit',
    description: 'A rugged action camera kit for travel, sports, and outdoor shoots, with stabilized high-resolution capture.',
    specs: { Capacity: '1 Operator', Weight: '0.3 lbs', Sensor: '1/1.9-inch', Rating: 'Standard' },
    features: ['5.3K video', 'HyperSmooth stabilization', 'Waterproof housing', 'Mounting accessories'],
  },
  {
    id: 'nanlite-forza-60',
    name: 'Nanlite Forza 60B Kit',
    category: 'lighting',
    price: 2200,
    status: 'available',
    blurb: 'Bi-Color LED Light',
    description: 'A compact bi-color LED fixture with a softbox and stand, ideal for interviews, portraits, and small sets.',
    specs: { Capacity: '1 Fixture', Weight: '5.2 lbs', Output: '60W LED', Rating: 'Standard' },
    features: ['Bi-color 2700K-6500K', 'Bowens adapter', 'Softbox included', 'Battery compatible'],
  },
  {
    id: 'godox-ad600',
    name: 'Godox AD600Pro Flash Kit',
    category: 'lighting',
    price: 1900,
    status: 'available',
    blurb: 'Portable Strobe System',
    description: 'A battery-powered studio strobe for location portraits, product photography, and event coverage.',
    specs: { Capacity: '1 Flash', Weight: '6.4 lbs', Output: '600Ws', Rating: 'Pro' },
    features: ['Wireless trigger', 'High-speed sync', 'Rechargeable battery', 'Reflector included'],
  },
  {
    id: 'rode-wireless-pro',
    name: 'Rode Wireless PRO',
    category: 'audio',
    price: 1600,
    status: 'available',
    blurb: 'Dual Wireless Microphone',
    description: 'A compact two-person wireless microphone system with onboard recording for interviews, events, and creator shoots.',
    specs: { Capacity: '2 Speakers', Weight: '0.4 lbs', Range: '200m', Rating: 'Pro' },
    features: ['Two transmitters', '32-bit float recording', 'Timecode support', 'Charging case'],
  },
  {
    id: 'zoom-h6',
    name: 'Zoom H6 Essential Recorder',
    category: 'audio',
    price: 1200,
    status: 'available',
    blurb: 'Portable Audio Recorder',
    description: 'A flexible field recorder with multiple inputs for film sets, podcasts, live performances, and location sound.',
    specs: { Capacity: '4 Inputs', Weight: '1.3 lbs', Recording: '32-bit Float', Rating: 'Standard' },
    features: ['Four XLR inputs', 'Interchangeable capsule', 'Headphone monitoring', 'SD card recording'],
  },
  {
    id: 'sennheiser-mkhs',
    name: 'Sennheiser MKH 416 Boom Kit',
    category: 'audio',
    price: 1500,
    status: 'available',
    blurb: 'Shotgun Microphone Set',
    description: 'A professional short shotgun microphone package for focused dialogue capture on film, commercial, and documentary sets.',
    specs: { Capacity: '1 Microphone', Weight: '0.4 lbs', Pattern: 'Supercardioid', Rating: 'Pro' },
    features: ['MKH 416 microphone', 'Boom pole', 'Shock mount', 'Windscreen included'],
  },
  {
    id: 'rei-half-dome',
    name: 'REI Half Dome 4 Tent',
    category: 'camping',
    price: 1800,
    status: 'available',
    blurb: '4-Person Backpacking Tent',
    description: 'A spacious, weather-ready tent for weekend trips and multi-day camps, with easy setup and two vestibules.',
    specs: { Capacity: '4 Person', Weight: '5.5 lbs', 'Floor Area': '60 sq ft', Rating: '3-Season' },
    features: ['Two doors', 'Two vestibules', 'Aluminum poles', 'Rainfly included'],
  },
  {
    id: 'jetboil-minimo',
    name: 'Jetboil MiniMo Cooking System',
    category: 'camping',
    price: 700,
    status: 'available',
    blurb: 'Compact Camp Kitchen',
    description: 'A fast and compact cooking system for hot drinks, meals, and basecamp use on hiking and camping trips.',
    specs: { Capacity: '2 Person', Weight: '1.5 lbs', 'Boil Time': '4.5 min/L', Rating: 'Standard' },
    features: ['Integrated igniter', 'Insulated cup', 'Fuel regulator', 'Pot support included'],
  },
  {
    id: 'event-folding-table',
    name: '6-Foot Folding Event Table',
    category: 'events',
    price: 500,
    status: 'available',
    blurb: 'Heavy-Duty Folding Table',
    description: 'A durable folding table for catering, markets, workshops, parties, and production staging areas.',
    specs: { Capacity: '6 People', Weight: '24 lbs', Length: '6 ft', Rating: 'Standard' },
    features: ['Seats six guests', 'Water-resistant top', 'Folding steel legs', 'Carry handle'],
  },
  {
    id: 'uplighting-kit',
    name: 'Wireless LED Uplighting Kit',
    category: 'events',
    price: 2400,
    status: 'available',
    blurb: '12-Light Event Set',
    description: 'A wireless color-changing uplighting set for weddings, parties, brand events, and venue decor.',
    specs: { Capacity: '12 Fixtures', Weight: '42 lbs', Battery: '10 hrs', Rating: 'Pro' },
    features: ['12 LED fixtures', 'Wireless remote', 'RGBWA color mixing', 'Protective case'],
  },
  {
    id: 'portable-pa-system',
    name: 'Bose S1 Pro+ PA System',
    category: 'events',
    price: 2800,
    status: 'available',
    blurb: 'Portable Event Speaker',
    description: 'A battery-powered PA system for speeches, acoustic sets, workshops, and small outdoor gatherings.',
    specs: { Capacity: '100 Guests', Weight: '15.7 lbs', Battery: '11 hrs', Rating: 'Pro' },
    features: ['Wireless microphone ready', 'Bluetooth streaming', 'Built-in mixer', 'Tripod compatible'],
  },
];

const productImageSets = {
  cameras: [
    'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1519183071298-a2962be96f83?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1495121605193-b116b5b09a3f?auto=format&fit=crop&w=1200&q=85',
  ],
  lighting: [
    'https://waldo.pro/wp-content/uploads/2024/03/Lighting-Equipment-1-564x317.jpg',
    'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=85',
  ],
  audio: [
    'https://images.unsplash.com/photo-1524678606370-a47ad25cb82a?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1590602847861-13ad7d7d7c5a?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1483412033650-1015ddeb83d1?auto=format&fit=crop&w=1200&q=85',
  ],
  camping: [
    'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1445307806294-bff7f67ff225?auto=format&fit=crop&w=1200&q=85',
  ],
  events: [
    'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff32?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=85',
  ],
};

const productImageOverrides = {
  'sony-pxw-z150': {
    image: 'https://img.lazcdn.com/g/p/1251e944bdbb10b01b155004411e728c.jpg_720x720q80.jpg',
    images: [
      'https://img.lazcdn.com/g/p/1251e944bdbb10b01b155004411e728c.jpg_720x720q80.jpg',
      'https://img.lazcdn.com/g/p/66ac4dc4061cc9afaef0d8312abaf2be.jpg_720x720q80.jpg',
      'https://img.lazcdn.com/g/p/2d55c9eb3a743c3ba5933803ee914605.jpg_720x720q80.jpg',
    ],
  },
  'sony-a7iv': {
    image: 'https://fdn.gsmarena.com/imgroot/news/21/10/sony-as74/-1200/gsmarena_001.jpg',
    images: [
      'https://fdn.gsmarena.com/imgroot/news/21/10/sony-as74/-1200/gsmarena_001.jpg',
      'https://fdn.gsmarena.com/imgroot/news/21/10/sony-as74/-1200/gsmarena_002.jpg',
      'https://fdn.gsmarena.com/imgroot/news/21/10/sony-as74/-1200/gsmarena_001.jpg',
    ],
  },
  'manfrotto-mt190': {
    image: 'https://cdn.manfrotto.com/media/catalog/product/m/t/mt190xpro4.jpg',
    images: [
      'https://cdn.manfrotto.com/media/catalog/product/m/t/mt190xpro4.jpg',
      'https://cdn.manfrotto.com/media/catalog/product/m/t/mt190xpro4-quick-setup.jpg',
      'https://cdn.manfrotto.com/media/catalog/product/m/t/mt190xpro4-closed.jpg',
    ],
  },
  'blackmagic-pocket-6k': {
    image: 'https://images.blackmagicdesign.com/images/media/releases/2021/20210217_blackmagic-pocket-cinema-camera-6k-pro/carousel/blackmagic-pocket-cinema-camera-6k-pro-hero.jpg?_v=1613549833',
    images: [
      'https://images.blackmagicdesign.com/images/media/releases/2021/20210217_blackmagic-pocket-cinema-camera-6k-pro/carousel/blackmagic-pocket-cinema-camera-6k-pro-hero.jpg?_v=1613549833',
      'https://images.blackmagicdesign.com/images/media/releases/2021/20210217_blackmagic-pocket-cinema-camera-6k-pro/carousel/blackmagic-pocket-cinema-camera-6k-pro-angle.jpg?_v=1613549832',
      'https://images.blackmagicdesign.com/images/media/releases/2021/20210217_blackmagic-pocket-cinema-camera-6k-pro/carousel/blackmagic-pocket-cinema-camera-6k-pro-back.jpg?_v=1613549834',
    ],
  },
  'aputure-ls600d': {
    image: 'https://www.newsshooter.com/wp-content/uploads/2022/04/LS-600d_thumbnail-740x416.jpg',
    images: [
      'https://www.newsshooter.com/wp-content/uploads/2022/04/LS-600d_thumbnail-740x416.jpg',
      'https://www.newsshooter.com/wp-content/uploads/2022/04/DSC08791-740x493.jpg',
      'https://www.newsshooter.com/wp-content/uploads/2022/04/DSC08797-740x493.jpg',
    ],
  },
  'north-face-tent': {
    image: 'https://www.cleverhiker.com/wp-content/uploads/2025/12/The-North-Face-Mountain-25-9.jpg',
    images: [
      'https://www.cleverhiker.com/wp-content/uploads/2025/12/The-North-Face-Mountain-25-9.jpg',
      'https://www.cleverhiker.com/wp-content/uploads/2025/12/The-North-Face-Mountain-25-7-768x512.jpg',
      'https://www.cleverhiker.com/wp-content/uploads/2025/12/The-North-Face-Mountain-25-24-768x512.jpg',
    ],
  },
  'jbl-partybox-310': {
    image: 'https://www.jbl.com.ph/dw/image/v2/AAUJ_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/dw91e82668/JBL_PartyBox_310_Hero_0176_x3.png?sw=1200&sfrm=png',
    images: [
      'https://www.jbl.com.ph/dw/image/v2/AAUJ_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/dw91e82668/JBL_PartyBox_310_Hero_0176_x3.png?sw=1200&sfrm=png',
      'https://www.jbl.com.ph/on/demandware.static/-/Sites-masterCatalog_Harman/default/dwe12b210a/pdp/JBL_Partybox_310_Lifestyle01_904x560px.png',
      'https://www.jbl.com.ph/on/demandware.static/-/Sites-masterCatalog_Harman/default/dwe12b210a/pdp/JBL_Partybox_310_Lifestyle02_904x560px.png',
    ],
  },
  'msr-whisperlite': {
    image: 'https://cdn.shopify.com/s/files/1/0574/0642/3174/files/06630_msr_whisperlite_universal_canister_349db84c-f9cc-49fe-be76-8801ac4e0b6d.jpg?v=1725608845',
    images: [
      'https://cdn.shopify.com/s/files/1/0574/0642/3174/files/06630_msr_whisperlite_universal_canister_349db84c-f9cc-49fe-be76-8801ac4e0b6d.jpg?v=1725608845',
      'https://cdn.shopify.com/s/files/1/0574/0642/3174/files/06630_msr_whisperlite_universal_liquid_fuel_aad603c4-bb6b-4674-b648-21f6f9b739ad.jpg?v=1725608845',
      'https://cdn.shopify.com/s/files/1/0574/0642/3174/files/06630_msr_whisperlite_universal_liquid_fuel_2_cef699f1-a202-473e-939e-60279ff16046.jpg?v=1725608845',
    ],
  },
  'summit-sleeping-bag': {
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=85',
    images: [
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1622260614153-03223fb72052?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1200&q=85',
    ],
  },
  'osprey-aether': {
    image: 'https://www.osprey.com/gb/media/catalog/product/cache/abc150b1aa43c5588150538ee4c70a4b/a/e/aetherplus85_s21_side_black-1000x1000_2.jpg',
    images: [
      'https://www.osprey.com/gb/media/catalog/product/cache/abc150b1aa43c5588150538ee4c70a4b/a/e/aetherplus85_s21_side_black-1000x1000_2.jpg',
      'https://www.osprey.com/gb/media/catalog/product/cache/cb3f0dc90cc7c37a14c3312c637579d2/a/e/aetherplus85_s21_sideback_black2.jpg',
      'https://www.osprey.com/gb/media/catalog/product/cache/cb3f0dc90cc7c37a14c3312c637579d2/a/e/aetherplus85_s21_body1_black.jpg',
    ],
  },
  'petzl-swift-rl': {
    image: 'https://www.petzl.com/sfc/servlet.shepherd/version/download/068Tx00000CUCkoIAH',
    images: [
      'https://www.petzl.com/sfc/servlet.shepherd/version/download/068Tx00000CUCkoIAH',
      'https://www.petzl.com/sfc/servlet.shepherd/version/download/068Tx00000CUDQjIAP',
      'https://www.petzl.com/sfc/servlet.shepherd/version/download/068Tx00000EC5SEIA1',
    ],
  },
  'canon-24-70': {
    image: 'https://shoppable-dev.s3.ap-southeast-1.amazonaws.com/products/45e0240f-6bd7-4022-9d16-20552b9b9122.png',
    images: [
      'https://shoppable-dev.s3.ap-southeast-1.amazonaws.com/products/45e0240f-6bd7-4022-9d16-20552b9b9122.png',
      'https://shoppable-dev.s3.ap-southeast-1.amazonaws.com/products/cde1f064-1ea6-493e-bac1-e6dd3d271611.png',
      'https://shoppable-dev.s3.ap-southeast-1.amazonaws.com/products/45e0240f-6bd7-4022-9d16-20552b9b9122.png',
    ],
  },
};

const categoryImageIndexes = {};
export const products = productRecords.map((product) => {
  const images = productImageSets[product.category];
  const imageOverride = productImageOverrides[product.id];
  const imageIndex = categoryImageIndexes[product.category] || 0;
  categoryImageIndexes[product.category] = imageIndex + 1;

  return {
    ...product,
    image: imageOverride?.image || images[imageIndex % images.length],
    images: imageOverride?.images || images,
  };
});

export const providerGears = [
  { productId: 'canon-eos-r6', status: 'active', availableUnits: 2, totalUnits: 2 },
  { productId: 'nanlite-forza-60', status: 'active', availableUnits: 1, totalUnits: 2 },
  { productId: 'rode-wireless-pro', status: 'paused', availableUnits: 0, totalUnits: 1 },
];

export const currentUser = {
  name: 'Marcus Thorne',
  email: 'marcus.t@gearrent.ph',
  tier: 'Elite Explorer',
  activeRentals: 2,
  totalRentals: 14,
  memberSince: 'Jan 2024',
  tierProgress: 0.7,
};

export const activeRentals = [
  {
    id: 'ord-9921',
    productId: 'north-face-tent',
    name: 'North Face 4-Person Expedition Tent',
    dates: 'Oct 12 - Oct 15',
    status: 'due-soon',
    statusLabel: '2 DAYS REMAINING',
  },
  {
    id: 'ord-9922',
    productId: 'osprey-aether',
    name: 'Osprey Aether Pro 85L',
    dates: 'Oct 12 - Oct 15',
    status: 'due-urgent',
    statusLabel: 'DUE IN 48 HOURS',
  },
];

export const rentalHistory = [
  { id: 'ord-9801', productId: 'sony-a7iv', name: 'Sony A7IV', dates: 'Sep 12 - Sep 15', status: 'returned' },
  { id: 'ord-9772', productId: 'canon-24-70', name: 'Canon EF 24-70mm', dates: 'Aug 20 - Aug 25', status: 'returned' },
  { id: 'ord-9650', productId: 'aputure-ls600d', name: 'Aputure 120D II', dates: 'Jul 05 - Jul 10', status: 'returned' },
];

export const membershipTiers = [
  {
    id: 'basic',
    name: 'Gear Renter',
    price: 0,
    description: 'For creators who need reliable equipment for shoots, events, and adventures.',
    perks: ['10% off all standard rentals', 'Access to the full gear catalog', 'Member rental history'],
    cta: 'Rent Gear',
    featured: false,
  },
  {
    id: 'provider',
    name: 'Gear Provider',
    price: 499,
    description: 'For owners who want to list their equipment and earn by renting it to other creators.',
    perks: ['List your own equipment', 'Set your rates and availability', 'Manage rental requests and earnings'],
    cta: 'Become a Provider',
    featured: true,
  },
];

export function formatPeso(amount) {
  return '\u20b1' + amount.toLocaleString('en-PH');
}

export function calculateSecurityDeposit(price) {
  return Math.max(100, Math.ceil((price * 0.02) / 100) * 100);
}

