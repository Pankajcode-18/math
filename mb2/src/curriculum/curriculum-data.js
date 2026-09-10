'use strict';

// ═══════════════════════════════════════════════════════════
// PIYUSHDHARA EDUVERSE BOARD — CURRICULUM DATA REGISTRY
// Supports multiple classes, subjects, chapters, topics, and tools.
// Primary: Nepal SEE (Grade 10) Mathematics + Science & Technology
// ═══════════════════════════════════════════════════════════

const CURRICULUM_DATA = {
  classes: [
    { id: 'grade-10', name: 'Grade 10', board: 'Nepal SEE', active: true },
    { id: 'grade-9',  name: 'Grade 9',  board: 'Nepal CDC', active: false },
    { id: 'grade-8',  name: 'Grade 8',  board: 'Nepal BLE', active: false },
    { id: 'grade-11', name: 'Grade 11', board: 'Nepal NEB', active: false },
    { id: 'grade-12', name: 'Grade 12', board: 'Nepal NEB', active: false }
  ],

  subjects: [
    {
      id: 'mathematics',
      name: 'Mathematics',
      nepaliName: 'गणित',
      shortName: 'Math',
      classId: 'grade-10',
      board: 'Nepal SEE',
      icon: '📐',
      color: '#c9a84c',
      badgeColor: 'rgba(201,168,76,0.2)',
      description: 'Nepal SEE Compulsory Mathematics — Complete Syllabus with interactive 2D/3D shapes, formulas, and graphing.',
      active: true,
      chapters: [
        {
          id: 1,
          name: 'Sets',
          nepaliName: 'समूह',
          badge: 'interactive',
          icon: '∪',
          tools: ['venn'],
          desc: 'Venn diagrams, cardinality, two & three set word problems',
          topics: [
            { id: 'sets-intro', name: 'Introduction to Sets & Notation', duration: '45m' },
            { id: 'sets-cardinality', name: 'Cardinality of Sets', duration: '45m' },
            { id: 'sets-two-venn', name: 'Two-Set Venn Diagrams & Operations', duration: '60m' },
            { id: 'sets-three-venn', name: 'Three-Set Venn Diagrams & Practical Problems', duration: '90m' }
          ]
        },
        {
          id: 2,
          name: 'Compound Interest',
          nepaliName: 'चक्रिय ब्याज',
          badge: 'interactive',
          icon: '%',
          tools: ['ci'],
          desc: 'Compound interest, compound amount, annual & semi-annual compounding',
          topics: [
            { id: 'ci-simple-vs-compound', name: 'Simple Interest vs Compound Interest', duration: '45m' },
            { id: 'ci-annual', name: 'Annual Compound Interest & Amount Formula', duration: '60m' },
            { id: 'ci-semi-annual', name: 'Semi-annual Compound Interest', duration: '60m' },
            { id: 'ci-varying-rates', name: 'Varying Annual Interest Rates', duration: '45m' }
          ]
        },
        {
          id: 3,
          name: 'Growth & Depreciation',
          nepaliName: 'वृद्धि र ह्रास',
          badge: 'interactive',
          icon: '↑↓',
          tools: ['gd'],
          desc: 'Population growth, compound depreciation of assets',
          topics: [
            { id: 'gd-growth', name: 'Population Growth Rate', duration: '45m' },
            { id: 'gd-depreciation', name: 'Compound Depreciation of Machines & Assets', duration: '60m' },
            { id: 'gd-scrap-value', name: 'Book Value & Scrap Value Problems', duration: '45m' }
          ]
        },
        {
          id: 4,
          name: 'Currency & Exchange Rate',
          nepaliName: 'मुद्रा र विनिमय दर',
          badge: 'interactive',
          icon: '₹$',
          tools: ['fx'],
          desc: 'Foreign exchange rate, buying & selling rates, chain rule',
          topics: [
            { id: 'fx-buying-selling', name: 'Bank Buying & Selling Rates', duration: '45m' },
            { id: 'fx-chain-rule', name: 'Chain Rule for Multi-currency Conversions', duration: '60m' },
            { id: 'fx-devaluation', name: 'Devaluation & Revaluation of Currency', duration: '45m' }
          ]
        },
        {
          id: 5,
          name: 'Area and Volume',
          nepaliName: 'क्षेत्रफल र आयतन',
          badge: 'interactive',
          icon: '□',
          tools: ['area2d', 'area3d'],
          desc: 'Prism, cylinder, sphere, hemisphere, cone, combined solids',
          topics: [
            { id: 'av-prism', name: 'Triangular & Rectangular Prisms', duration: '60m' },
            { id: 'av-cylinder', name: 'Cylinder Surface Area & Volume', duration: '60m' },
            { id: 'av-sphere', name: 'Sphere & Hemisphere Area and Volume', duration: '60m' },
            { id: 'av-cone', name: 'Cone & Slant Height Calculations', duration: '60m' },
            { id: 'av-combined', name: 'Combined Solids (Cylinder + Cone / Hemisphere)', duration: '90m' }
          ]
        },
        {
          id: 6,
          name: 'Sequence & Series',
          nepaliName: 'अनुक्रम र श्रेणी',
          badge: 'interactive',
          icon: '…',
          tools: ['seq'],
          desc: 'Arithmetic Progression (AP) and Geometric Progression (GP)',
          topics: [
            { id: 'seq-ap-terms', name: 'AP: General Term (nth term)', duration: '45m' },
            { id: 'seq-ap-sum', name: 'AP: Sum of First n Terms', duration: '60m' },
            { id: 'seq-means', name: 'Arithmetic & Geometric Means', duration: '60m' },
            { id: 'seq-gp-terms', name: 'GP: General Term and Sum of GP', duration: '60m' }
          ]
        },
        {
          id: 7,
          name: 'Quadratic Equation',
          nepaliName: 'वर्ग समीकरण',
          badge: 'interactive',
          icon: 'x²',
          tools: ['quad'],
          desc: 'Roots of quadratic equation, discriminant, word problems',
          topics: [
            { id: 'quad-factoring', name: 'Solution by Factorization Method', duration: '45m' },
            { id: 'quad-formula', name: 'Quadratic Formula & Discriminant', duration: '60m' },
            { id: 'quad-nature-roots', name: 'Nature of Roots (Real, Equal, Imaginary)', duration: '45m' },
            { id: 'quad-word-problems', name: 'Word Problems on Quadratic Equations', duration: '75m' }
          ]
        },
        {
          id: 8,
          name: 'Algebraic Fraction',
          nepaliName: 'बीजीय भिन्न',
          badge: 'board',
          icon: 'a/b',
          tools: [],
          desc: 'Simplification of rational algebraic expressions',
          topics: [
            { id: 'alg-hcf-lcm', name: 'HCF and LCM of Polynomials', duration: '60m' },
            { id: 'alg-simplification', name: 'Simplification of Algebraic Fractions', duration: '75m' }
          ]
        },
        {
          id: 9,
          name: 'Indices',
          nepaliName: 'घाताङ्क',
          badge: 'board',
          icon: 'aⁿ',
          tools: [],
          desc: 'Laws of indices, exponential equations',
          topics: [
            { id: 'indices-laws', name: 'Fundamental Laws of Indices', duration: '45m' },
            { id: 'indices-simplify', name: 'Simplification of Exponential Expressions', duration: '60m' },
            { id: 'indices-equations', name: 'Solving Exponential Equations', duration: '60m' }
          ]
        },
        {
          id: 10,
          name: 'Triangles & Quadrilaterals',
          nepaliName: 'त्रिभुज र चतुर्भुज',
          badge: 'interactive',
          icon: '△',
          tools: ['tri'],
          desc: 'Theorems on area of triangles and parallelograms',
          topics: [
            { id: 'geom-parallelograms-same-base', name: 'Parallelograms on Same Base and Between Same Parallels', duration: '60m' },
            { id: 'geom-triangle-parallelogram', name: 'Relation between Triangle and Parallelogram on Same Base', duration: '60m' },
            { id: 'geom-triangles-same-base', name: 'Triangles on Same Base and Same Parallels', duration: '60m' }
          ]
        },
        {
          id: 11,
          name: 'Construction',
          nepaliName: 'रचना',
          badge: 'board',
          icon: '✎',
          tools: [],
          desc: 'Geometric construction of triangles and equal-area quadrilaterals',
          topics: [
            { id: 'const-triangle-to-parallelogram', name: 'Constructing Parallelogram Equal in Area to Triangle', duration: '60m' },
            { id: 'const-quad-to-triangle', name: 'Constructing Triangle Equal in Area to Quadrilateral', duration: '60m' }
          ]
        },
        {
          id: 12,
          name: 'Circle',
          nepaliName: 'वृत्त',
          badge: 'interactive',
          icon: '○',
          tools: ['circle'],
          desc: 'Inscribed angle, central angle, cyclic quadrilateral theorems',
          topics: [
            { id: 'circle-central-inscribed', name: 'Central Angle vs Inscribed Angle on Same Arc', duration: '60m' },
            { id: 'circle-inscribed-equal', name: 'Inscribed Angles on Same Arc are Equal', duration: '45m' },
            { id: 'circle-semicircle', name: 'Angle in a Semicircle is Right Angle', duration: '45m' },
            { id: 'circle-cyclic-quad', name: 'Opposite Angles of Cyclic Quadrilateral are Supplementary', duration: '60m' },
            { id: 'circle-tangents', name: 'Tangent Theorems & Alternating Segment Theorem', duration: '60m' }
          ]
        },
        {
          id: 13,
          name: 'Statistics',
          nepaliName: 'तथ्याङ्कशास्त्र',
          badge: 'interactive',
          icon: '∑',
          tools: ['stats'],
          desc: 'Mean, median, quartiles (Q1, Q3), and ogive curves',
          topics: [
            { id: 'stats-mean', name: 'Arithmetic Mean of Grouped Data', duration: '45m' },
            { id: 'stats-median', name: 'Median of Continuous Series', duration: '60m' },
            { id: 'stats-quartiles', name: 'Lower Quartile (Q1) & Upper Quartile (Q3)', duration: '60m' },
            { id: 'stats-cumulative-chart', name: 'Cumulative Frequency Curve (Ogive)', duration: '60m' }
          ]
        },
        {
          id: 14,
          name: 'Probability',
          nepaliName: 'सम्भाव्यता',
          badge: 'interactive',
          icon: 'P',
          tools: ['prob'],
          desc: 'Addition & multiplication principles, tree diagrams',
          topics: [
            { id: 'prob-definition', name: 'Basic Probability Definition & Scale (0 to 1)', duration: '45m' },
            { id: 'prob-mutually-exclusive', name: 'Mutually Exclusive and Independent Events', duration: '60m' },
            { id: 'prob-tree-diagram', name: 'Tree Diagrams with & without Replacement', duration: '75m' }
          ]
        }
      ]
    },

    {
      id: 'science',
      name: 'Science & Technology',
      nepaliName: 'विज्ञान तथा प्रविधि',
      shortName: 'Science',
      classId: 'grade-10',
      board: 'Nepal SEE',
      icon: '🔬',
      color: '#38bdf8',
      badgeColor: 'rgba(56,189,248,0.2)',
      description: 'Official Nepal CDC Class 10 Science and Technology curriculum with interactive physics, biology, chemistry, and earth science tools.',
      active: true,
      chapters: [
        {
          id: 1,
          name: 'Scientific Learning',
          nepaliName: 'वैज्ञानिक सिकाइ',
          badge: 'interactive',
          icon: '⚗️',
          tools: ['sc-measurement'],
          desc: 'Scientific method, experimental variables, observation, SI units, and reporting',
          topics: [
            { id: 'sc-method', name: 'The Scientific Method & Inquiry', duration: '45m' },
            { id: 'sc-variables', name: 'Independent, Dependent & Controlled Variables', duration: '45m' },
            { id: 'sc-units', name: 'Fundamental & Derived SI Units in Physics', duration: '60m' },
            { id: 'sc-reporting', name: 'Data Presentation, Graphs and Scientific Reporting', duration: '45m' }
          ]
        },
        {
          id: 2,
          name: 'Information and Communication Technology',
          nepaliName: 'सूचना तथा सञ्चार प्रविधि',
          badge: 'board',
          icon: '💻',
          tools: [],
          desc: 'Computer networks, internet, digital communication, and cybersecurity',
          topics: [
            { id: 'ict-networks', name: 'Computer Network Topologies & Types (LAN, WAN)', duration: '45m' },
            { id: 'ict-internet', name: 'Internet Protocols, World Wide Web & Cloud Computing', duration: '45m' },
            { id: 'ict-cybersecurity', name: 'Cybersecurity, Safe Internet Practices & Digital Ethics', duration: '45m' }
          ]
        },
        {
          id: 3,
          name: 'Classification of Living Beings & Cellular Structure',
          nepaliName: 'जीवहरूको वर्गीकरण र कोष',
          badge: 'interactive',
          icon: '🧬',
          tools: ['sc-cell'],
          desc: 'Five kingdom classification, plant and animal cell organelles, cell division',
          topics: [
            { id: 'bio-five-kingdom', name: 'Five Kingdom Classification System (Whittaker)', duration: '60m' },
            { id: 'bio-plant-animal-cell', name: 'Ultrastructure of Plant Cell vs Animal Cell', duration: '60m' },
            { id: 'bio-organelles', name: 'Functions of Nucleus, Mitochondria, Chloroplast & Ribosomes', duration: '60m' },
            { id: 'bio-cell-division', name: 'Mitosis vs Meiosis Cell Division & Significance', duration: '75m' }
          ]
        },
        {
          id: 4,
          name: 'Biodiversity and Environment',
          nepaliName: 'जैविक विविधता र वातावरण',
          badge: 'board',
          icon: '🌿',
          tools: [],
          desc: 'Ecosystem, ecological balance, biogeochemical cycles, and biodiversity conservation',
          topics: [
            { id: 'bio-ecosystem', name: 'Trophic Levels, Food Chains & Food Webs', duration: '45m' },
            { id: 'bio-cycles', name: 'Carbon Cycle and Nitrogen Cycle in Nature', duration: '60m' },
            { id: 'bio-conservation', name: 'Endangered Species of Nepal & Protected Areas', duration: '45m' }
          ]
        },
        {
          id: 5,
          name: 'Life Processes',
          nepaliName: 'जीवन प्रक्रिया',
          badge: 'interactive',
          icon: '🫀',
          tools: ['sc-anatomy'],
          desc: 'Human circulatory, nervous, and endocrine systems, and plant physiology',
          topics: [
            { id: 'lp-circulatory', name: 'Structure of Human Heart, Blood Vessels & Blood Flow', duration: '60m' },
            { id: 'lp-nervous', name: 'Central & Peripheral Nervous System, Reflex Action', duration: '60m' },
            { id: 'lp-endocrine', name: 'Endocrine Glands (Pituitary, Thyroid, Pancreas, Adrenal)', duration: '60m' },
            { id: 'lp-plant-transpiration', name: 'Photosynthesis & Transpiration in Plants', duration: '45m' }
          ]
        },
        {
          id: 6,
          name: 'Heredity and Evolution',
          nepaliName: 'वंशाणुक्रम र विकास',
          badge: 'interactive',
          icon: '🧪',
          tools: ['sc-punnett'],
          desc: 'Genetics, Mendel’s laws of inheritance, DNA/RNA, and theories of organic evolution',
          topics: [
            { id: 'her-dna-rna', name: 'Structure of DNA, Chromosomes and Genes', duration: '60m' },
            { id: 'her-mendel-first', name: 'Mendel’s Law of Segregation (Monohybrid Cross)', duration: '60m' },
            { id: 'her-mendel-second', name: 'Mendel’s Law of Independent Assortment', duration: '60m' },
            { id: 'her-evolution', name: 'Darwinism & Theory of Natural Selection', duration: '45m' }
          ]
        },
        {
          id: 7,
          name: 'Force and Motion',
          nepaliName: 'बल र गति',
          badge: 'interactive',
          icon: '🚀',
          tools: ['sc-force', 'sc-motion'],
          desc: 'Gravitation, Newton’s law of gravitation, acceleration due to gravity, free fall, weightlessness',
          topics: [
            { id: 'fm-gravity-gravitation', name: 'Difference between Gravitation and Gravity', duration: '45m' },
            { id: 'fm-newtons-gravitation', name: 'Newton’s Universal Law of Gravitation (F = G m1 m2 / d²)', duration: '60m' },
            { id: 'fm-acc-gravity', name: 'Acceleration due to Gravity (g = GM / R²) & Factors Affecting g', duration: '60m' },
            { id: 'fm-mass-weight', name: 'Mass vs Weight (W = mg)', duration: '45m' },
            { id: 'fm-freefall', name: 'Free Fall, Terminal Velocity & Weightlessness', duration: '60m' }
          ]
        },
        {
          id: 8,
          name: 'Pressure',
          nepaliName: 'चाप',
          badge: 'interactive',
          icon: '⚖️',
          tools: ['sc-pressure'],
          desc: 'Atmospheric pressure, liquid pressure, Pascal’s law, Archimedes’ principle, flotation',
          topics: [
            { id: 'press-liquid', name: 'Liquid Pressure (P = h ρ g) and its Characteristics', duration: '60m' },
            { id: 'press-pascals-law', name: 'Pascal’s Law and Hydraulic Machines (Hydraulic Lift/Press)', duration: '60m' },
            { id: 'press-archimedes', name: 'Archimedes’ Principle & Upthrust (U = V ρ g)', duration: '60m' },
            { id: 'press-floatation', name: 'Law of Flotation & Hydrometer', duration: '45m' },
            { id: 'press-atmospheric', name: 'Atmospheric Pressure, Barometer & Syringe/Water Pump', duration: '45m' }
          ]
        },
        {
          id: 9,
          name: 'Energy in Daily Life',
          nepaliName: 'दैनिक जीवनमा ऊर्जा',
          badge: 'interactive',
          icon: '⚡',
          tools: ['sc-energy'],
          desc: 'Work, energy, power, conservation of mechanical energy, renewable sources',
          topics: [
            { id: 'energy-work-power', name: 'Work (W = F·d) and Power (P = W/t)', duration: '45m' },
            { id: 'energy-ke-pe', name: 'Kinetic Energy (1/2 mv²) and Potential Energy (mgh)', duration: '60m' },
            { id: 'energy-conservation', name: 'Law of Conservation of Energy', duration: '45m' },
            { id: 'energy-sources', name: 'Renewable (Hydro, Solar, Wind) vs Non-renewable Energy in Nepal', duration: '45m' }
          ]
        },
        {
          id: 10,
          name: 'Wave, Sound and Light',
          nepaliName: 'तरङ्ग, ध्वनि र प्रकाश',
          badge: 'interactive',
          icon: '💡',
          tools: ['sc-optics', 'sc-wave'],
          desc: 'Transverse/longitudinal waves, sound echo/ultrasound, light refraction, lenses, eye defects',
          topics: [
            { id: 'opt-waves', name: 'Wave Motion, Frequency, Wavelength & Velocity (v = f λ)', duration: '45m' },
            { id: 'opt-sound', name: 'Reflection of Sound, Echo, Reverberation and Ultrasound', duration: '45m' },
            { id: 'opt-refraction', name: 'Refraction of Light, Snell’s Law & Total Internal Reflection', duration: '60m' },
            { id: 'opt-lenses', name: 'Convex and Concave Lenses, Ray Diagrams & Lens Formula', duration: '75m' },
            { id: 'opt-eye-defects', name: 'Defects of Vision (Myopia, Hypermetropia) and Correction', duration: '60m' }
          ]
        },
        {
          id: 11,
          name: 'Electricity and Magnetism',
          nepaliName: 'विद्युत् र चुम्बकत्व',
          badge: 'interactive',
          icon: '🔌',
          tools: ['sc-circuit', 'sc-ohm'],
          desc: 'Ohm’s law, series/parallel circuits, electric power, transformers, motor effect, generators',
          topics: [
            { id: 'elec-ohms-law', name: 'Ohm’s Law (V = IR) and Electrical Resistance', duration: '60m' },
            { id: 'elec-resistors', name: 'Resistors in Series (Rs = R1+R2) and Parallel (1/Rp = 1/R1+1/R2)', duration: '75m' },
            { id: 'elec-power-bill', name: 'Electric Power (P = VI) and Household Electricity Billing', duration: '60m' },
            { id: 'elec-induction', name: 'Faraday’s Law of Electromagnetic Induction & Generator / Dynamo', duration: '60m' },
            { id: 'elec-transformer', name: 'Transformer (Step-up and Step-down) (Vp/Vs = Np/Ns)', duration: '60m' }
          ]
        },
        {
          id: 12,
          name: 'Chemical Reactions and Periodic Table',
          nepaliName: 'रासायनिक प्रतिक्रिया र तत्वहरूको वर्गीकरण',
          badge: 'interactive',
          icon: '⚛️',
          tools: ['sc-periodic', 'sc-chem-reaction'],
          desc: 'Modern periodic table, electronic configuration, types of chemical reactions, catalyst',
          topics: [
            { id: 'chem-periodic-table', name: 'Modern Periodic Law and Structure of Periodic Table (s, p, d, f)', duration: '60m' },
            { id: 'chem-reactivity', name: 'Trends in Periodic Properties (Atomic Radius, Valency, Reactivity)', duration: '60m' },
            { id: 'chem-reactions', name: 'Types of Chemical Reactions (Combination, Decomposition, Displacement, Acid-Base)', duration: '60m' },
            { id: 'chem-rate', name: 'Factors Affecting Rate of Reaction & Catalyst Action', duration: '45m' }
          ]
        },
        {
          id: 13,
          name: 'Some Common Gases',
          nepaliName: 'केही उपयोगी ग्यासहरू',
          badge: 'interactive',
          icon: '☁️',
          tools: ['sc-lab-apparatus'],
          desc: 'Laboratory preparation, properties, and tests for Carbon Dioxide and Ammonia gases',
          topics: [
            { id: 'gas-co2', name: 'Laboratory Preparation of Carbon Dioxide Gas (CaCO3 + 2HCl)', duration: '60m' },
            { id: 'gas-nh3', name: 'Laboratory Preparation of Ammonia Gas (2NH4Cl + Ca(OH)2)', duration: '60m' },
            { id: 'gas-industrial', name: 'Industrial Production of Ammonia (Haber’s Process)', duration: '45m' },
            { id: 'gas-properties', name: 'Physical and Chemical Properties & Uses of CO2 and NH3', duration: '45m' }
          ]
        },
        {
          id: 14,
          name: 'Metals and Non-metals',
          nepaliName: 'धातु र अधातुहरू',
          badge: 'board',
          icon: '⛏️',
          tools: [],
          desc: 'Metallurgy of Iron, Copper, Aluminum; corrosion prevention; alloys',
          topics: [
            { id: 'metal-properties', name: 'General Physical and Chemical Properties of Metals', duration: '45m' },
            { id: 'metal-ores', name: 'Ores and Extraction of Iron, Copper and Aluminum', duration: '60m' },
            { id: 'metal-corrosion', name: 'Corrosion of Metals, Rusting of Iron and Prevention Methods', duration: '45m' },
            { id: 'metal-alloys', name: 'Important Alloys (Brass, Bronze, Steel) and their Uses', duration: '45m' }
          ]
        },
        {
          id: 15,
          name: 'Hydrocarbons and Carbon Compounds',
          nepaliName: 'हाइड्रोकार्बन र कार्बनका यौगिकहरू',
          badge: 'interactive',
          icon: '🧪',
          tools: ['sc-molecule'],
          desc: 'Alkanes, alkenes, alkynes, structural formulas, IUPAC naming, ethanol',
          topics: [
            { id: 'hc-classification', name: 'Saturated vs Unsaturated Hydrocarbons (Alkanes, Alkenes, Alkynes)', duration: '60m' },
            { id: 'hc-homologous', name: 'Homologous Series, Structural & Molecular Formulas', duration: '60m' },
            { id: 'hc-iupac', name: 'IUPAC Nomenclature of Simple Hydrocarbons', duration: '60m' },
            { id: 'hc-alcohol-ether', name: 'Properties and Uses of Ethyl Alcohol (Ethanol) & Glycerol', duration: '45m' }
          ]
        },
        {
          id: 16,
          name: 'Materials Used in Daily Life',
          nepaliName: 'दैनिक जीवनमा प्रयोग हुने वस्तुहरू',
          badge: 'board',
          icon: '🧱',
          tools: [],
          desc: 'Cement, glass, ceramics, fibers, plastics, soap, detergent, fertilizers',
          topics: [
            { id: 'mat-cement', name: 'Raw Materials & Manufacturing of Portland Cement', duration: '45m' },
            { id: 'mat-glass-ceramics', name: 'Types of Glass and Ceramic Manufacturing', duration: '45m' },
            { id: 'mat-plastics', name: 'Thermosetting vs Thermoplastic Polymers', duration: '45m' },
            { id: 'mat-fertilizers', name: 'Chemical Fertilizers (Nitrogenous, Phosphatic, Potassic) and Pollution', duration: '45m' }
          ]
        },
        {
          id: 17,
          name: 'The Earth, Climate and Universe',
          nepaliName: 'पृथ्वी, जलवायु र ब्रह्माण्ड',
          badge: 'interactive',
          icon: '🪐',
          tools: ['sc-universe'],
          desc: 'Geological timescale, fossils, climate change, origin of universe, stars, satellites',
          topics: [
            { id: 'earth-geological-time', name: 'Geological Time Scale (Eras: Cenozoic, Mesozoic, Paleozoic)', duration: '60m' },
            { id: 'earth-fossils', name: 'Formation and Importance of Fossils', duration: '45m' },
            { id: 'earth-climate-change', name: 'Greenhouse Effect, Global Warming & Climate Change in Nepal', duration: '45m' },
            { id: 'uni-origin', name: 'Origin of Universe, Big Bang Theory & Life Cycle of Stars', duration: '60m' },
            { id: 'uni-solar-satellites', name: 'Solar System, Comets, Asteroids and Artificial Satellites', duration: '45m' }
          ]
        }
      ]
    }
  ]
};

// Expose globally
if (typeof window !== 'undefined') {
  window.CURRICULUM_DATA = CURRICULUM_DATA;
}
