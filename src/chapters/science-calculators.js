'use strict';

// ═══════════════════════════════════════════════════════════
// PIYUSHDHARA EDUVERSE BOARD — SCIENCE CHAPTER TOOLS & CALCULATORS
// Nepal Grade 10 / SEE Curriculum
// ═══════════════════════════════════════════════════════════

const ScienceCalculators = (() => {

  // Periodic table data for first 20 elements (Nepal SEE syllabus)
  const ELEMENTS_20 = [
    { z:1,  s:'H',  n:'Hydrogen',   a:1.008, e:'1',       v:'1', t:'Non-metal' },
    { z:2,  s:'He', n:'Helium',     a:4.003, e:'2',       v:'0', t:'Noble Gas' },
    { z:3,  s:'Li', n:'Lithium',    a:6.94,  e:'2, 1',    v:'1', t:'Alkali Metal' },
    { z:4,  s:'Be', n:'Beryllium',  a:9.012, e:'2, 2',    v:'2', t:'Alkaline Earth' },
    { z:5,  s:'B',  n:'Boron',      a:10.81, e:'2, 3',    v:'3', t:'Metalloid' },
    { z:6,  s:'C',  n:'Carbon',     a:12.01, e:'2, 4',    v:'4', t:'Non-metal' },
    { z:7,  s:'N',  n:'Nitrogen',   a:14.01, e:'2, 5',    v:'3', t:'Non-metal' },
    { z:8,  s:'O',  n:'Oxygen',     a:16.00, e:'2, 6',    v:'2', t:'Non-metal' },
    { z:9,  s:'F',  n:'Fluorine',   a:19.00, e:'2, 7',    v:'1', t:'Halogen' },
    { z:10, s:'Ne', n:'Neon',       a:20.18, e:'2, 8',    v:'0', t:'Noble Gas' },
    { z:11, s:'Na', n:'Sodium',     a:22.99, e:'2, 8, 1', v:'1', t:'Alkali Metal' },
    { z:12, s:'Mg', n:'Magnesium',  a:24.31, e:'2, 8, 2', v:'2', t:'Alkaline Earth' },
    { z:13, s:'Al', n:'Aluminum',   a:26.98, e:'2, 8, 3', v:'3', t:'Metal' },
    { z:14, s:'Si', n:'Silicon',    a:28.09, e:'2, 8, 4', v:'4', t:'Metalloid' },
    { z:15, s:'P',  n:'Phosphorus', a:30.97, e:'2, 8, 5', v:'3, 5', t:'Non-metal' },
    { z:16, s:'S',  n:'Sulphur',    a:32.06, e:'2, 8, 6', v:'2, 4, 6', t:'Non-metal' },
    { z:17, s:'Cl', n:'Chlorine',   a:35.45, e:'2, 8, 7', v:'1', t:'Halogen' },
    { z:18, s:'Ar', n:'Argon',      a:39.95, e:'2, 8, 8', v:'0', t:'Noble Gas' },
    { z:19, s:'K',  n:'Potassium',  a:39.10, e:'2, 8, 8, 1', v:'1', t:'Alkali Metal' },
    { z:20, s:'Ca', n:'Calcium',    a:40.08, e:'2, 8, 8, 2', v:'2', t:'Alkaline Earth' }
  ];

  // Helper to insert text block onto active board
  function insertNotes(title, body) {
    const text = `📌 ${title}\n${body}`;
    if (typeof Canvas !== 'undefined') {
      const sz = Canvas.getCanvasSize();
      Canvas.addTextShape(sz.W / 2 - 140, sz.H / 2 - 80, text, '#e8c96b', 16);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast(`Notes for "${title}" pasted onto board!`);
      }
    }
  }

  // Helper to insert shape onto active board
  function insertShape(type) {
    if (typeof Canvas !== 'undefined') {
      Canvas.addShape(type);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast(`Inserted diagram: ${type}`);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // BUILD SCIENCE CHAPTER CONTENT
  // ─────────────────────────────────────────────────────────────
  function buildContent(ch) {
    const topicsHtml = (ch.topics || []).map((t, idx) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;background:rgba(255,255,255,0.03);border-radius:5px;border:1px solid rgba(56,189,248,0.12);margin-bottom:5px;">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:10px;color:#38bdf8;font-weight:700">#${idx+1}</span>
          <span style="font-size:12px;color:rgba(255,255,255,0.9)">${t.name}</span>
        </div>
        <span style="font-size:10px;color:rgba(201,168,76,0.8);background:rgba(201,168,76,0.12);padding:2px 6px;border-radius:4px;white-space:nowrap">${t.duration || '45m'}</span>
      </div>
    `).join('');

    switch(Number(ch.id)) {

      // ── CH 1: SCIENTIFIC LEARNING ──
      case 1:
        return `
        <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:14px;height:100%">
          <div class="calc-card" style="display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <h4 style="color:#38bdf8;margin:0">⚗️ Scientific Units & Metric Prefixes</h4>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertNotes('SI Fundamental Units', '1. Length: Metre (m)\\n2. Mass: Kilogram (kg)\\n3. Time: Second (s)\\n4. Temperature: Kelvin (K)\\n5. Electric Current: Ampere (A)\\n6. Luminous Intensity: Candela (cd)\\n7. Amount of Substance: Mole (mol)')">📌 Add to Board</button>
            </div>
            <p style="font-size:11px;color:rgba(255,255,255,0.6);margin:0">Convert standard scientific notation and metric prefixes used in physics & chemistry.</p>
            <div class="c-row" style="margin-top:6px">
              <span class="c-lbl">Value</span>
              <input class="c-inp" id="sci-val" type="number" value="5000">
              <select class="c-sel" id="sci-unit-from">
                <option value="1">Base (m, s, g)</option>
                <option value="1e3" selected>kilo (k) [10³]</option>
                <option value="1e6">mega (M) [10⁶]</option>
                <option value="1e9">giga (G) [10⁹]</option>
                <option value="1e-3">milli (m) [10⁻³]</option>
                <option value="1e-6">micro (μ) [10⁻⁶]</option>
                <option value="1e-9">nano (n) [10⁻⁹]</option>
              </select>
            </div>
            <div style="display:flex;gap:6px;margin-top:8px">
              <button class="c-btn" onclick="ScienceCalculators.calcMetricPrefix()">Convert Prefix</button>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertShape('sc-beaker')">🧪 Insert Beaker</button>
            </div>
            <div class="c-ans-box" style="margin-top:10px" id="sci-unit-result">
              Result: 5,000 kilo = <b>5.00 × 10⁶ Base units</b>
            </div>
          </div>
          <div class="calc-card">
            <h4 style="color:#c9a84c;margin-bottom:8px">CDC Class 10 Syllabus Topics</h4>
            <div style="max-height:220px;overflow-y:auto">${topicsHtml}</div>
          </div>
        </div>`;

      // ── CH 2: ICT ──
      case 2:
        return `
        <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:14px;height:100%">
          <div class="calc-card" style="display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <h4 style="color:#38bdf8;margin:0">💻 Digital Data Storage Converter</h4>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertNotes('Network Topologies', '1. Star: Central switch/hub. If switch fails, whole network down.\\n2. Bus: Single linear backbone cable with terminators.\\n3. Ring: Token ring passing, unidirectional flow.\\n4. Mesh: High redundancy, point-to-point connections.')">📌 Topologies to Board</button>
            </div>
            <div class="c-row" style="margin-top:6px">
              <span class="c-lbl">Size</span>
              <input class="c-inp" id="ict-input" type="number" value="16">
              <select class="c-sel" id="ict-unit">
                <option value="GB" selected>Gigabytes (GB)</option>
                <option value="MB">Megabytes (MB)</option>
                <option value="TB">Terabytes (TB)</option>
                <option value="KB">Kilobytes (KB)</option>
              </select>
            </div>
            <button class="c-btn" style="margin-top:6px" onclick="ScienceCalculators.calcStorage()">Convert Storage</button>
            <div class="c-ans-box" style="margin-top:10px" id="ict-result">
              16 GB = <b>16,384 MB</b> = 137,438,953,472 bits
            </div>
          </div>
          <div class="calc-card">
            <h4 style="color:#c9a84c;margin-bottom:8px">Curriculum Topics</h4>
            <div style="max-height:220px;overflow-y:auto">${topicsHtml}</div>
          </div>
        </div>`;

      // ── CH 3: LIVING BEINGS & CELLS ──
      case 3:
        return `
        <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:14px;height:100%">
          <div class="calc-card" style="display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <h4 style="color:#38bdf8;margin:0">🧬 Cell Structure & Organelles</h4>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertNotes('Plant vs Animal Cell', 'Plant Cell:\\n- Has Cell Wall (cellulose)\\n- Has Chloroplasts for photosynthesis\\n- Large central permanent vacuole\\n\\nAnimal Cell:\\n- Only Cell Membrane\\n- Centrosome with centrioles for division\\n- Small temporary vacuoles')">📌 Notes to Board</button>
            </div>
            <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
              <button class="c-btn-sm" onclick="ScienceCalculators.insertShape('sc-plant-cell')">🌿 Insert Plant Cell</button>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertShape('sc-animal-cell')">🐾 Insert Animal Cell</button>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertShape('sc-nucleus')">🔬 Insert Nucleus</button>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertShape('sc-label-pointer')">🏷️ Insert Label Pointer</button>
            </div>
            <div class="c-ref" style="margin-top:10px">
              <b>Five Kingdoms (Whittaker):</b><br>
              1. Monera (Prokaryotes: Bacteria)<br>
              2. Protista (Unicellular Eukaryotes: Amoeba)<br>
              3. Fungi (Saprophytes: Mushroom, Yeast)<br>
              4. Plantae (Autotrophs: Algae to Angiosperms)<br>
              5. Animalia (Heterotrophs: Invertebrates & Vertebrates)
            </div>
          </div>
          <div class="calc-card">
            <h4 style="color:#c9a84c;margin-bottom:8px">Class 10 Biology Topics</h4>
            <div style="max-height:220px;overflow-y:auto">${topicsHtml}</div>
          </div>
        </div>`;

      // ── CH 4: BIODIVERSITY & ENVIRONMENT ──
      case 4:
        return `
        <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:14px;height:100%">
          <div class="calc-card" style="display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <h4 style="color:#38bdf8;margin:0">🌿 10% Energy Transfer Law in Ecosystem</h4>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertNotes('Lindeman 10% Law', 'Only about 10% of energy transferred from one trophic level to the next:\\n- Producers (Plants): 10,000 J\\n- Primary Consumers (Herbivores): 1,000 J\\n- Secondary Consumers (Carnivores): 100 J\\n- Tertiary Consumers (Apex): 10 J')">📌 Copy to Board</button>
            </div>
            <div class="c-row" style="margin-top:6px">
              <span class="c-lbl">Producer Energy</span>
              <input class="c-inp" id="bio-energy" type="number" value="10000">
              <span class="prop-unit" style="color:var(--gold)">Joules (J)</span>
            </div>
            <button class="c-btn" style="margin-top:6px" onclick="ScienceCalculators.calcTrophicEnergy()">Compute Trophic Pyramid</button>
            <div class="c-ans-box" style="margin-top:10px" id="bio-energy-res">
              Herbivore: <b>1,000 J</b> | Carnivore: <b>100 J</b> | Apex: <b>10 J</b> (90% dissipated as heat)
            </div>
          </div>
          <div class="calc-card">
            <h4 style="color:#c9a84c;margin-bottom:8px">Curriculum Topics</h4>
            <div style="max-height:220px;overflow-y:auto">${topicsHtml}</div>
          </div>
        </div>`;

      // ── CH 5: LIFE PROCESSES ──
      case 5:
        return `
        <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:14px;height:100%">
          <div class="calc-card" style="display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <h4 style="color:#38bdf8;margin:0">🫀 Human Circulatory & Organ Systems</h4>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertNotes('Human Circulation', 'Double Circulation:\\n1. Pulmonary: Right Ventricle -> Pulmonary Artery -> Lungs -> Pulmonary Vein -> Left Atrium\\n2. Systemic: Left Ventricle -> Aorta -> Body Organs -> Vena Cava -> Right Atrium\\nNormal BP: 120/80 mmHg')">📌 Add to Board</button>
            </div>
            <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
              <button class="c-btn-sm" onclick="ScienceCalculators.insertShape('sc-label-pointer')">🏷️ Insert Anatomical Pointer</button>
            </div>
            <div class="c-ref" style="margin-top:10px">
              <b>Key Endocrine Glands:</b><br>
              • Pituitary: Master gland (Growth Hormone)<br>
              • Thyroid: Thyroxine (Metabolic rate, Goitre on deficiency)<br>
              • Pancreas (Islets of Langerhans): Insulin & Glucagon (Diabetes)<br>
              • Adrenal: Adrenaline (Emergency / Fight or Flight)
            </div>
          </div>
          <div class="calc-card">
            <h4 style="color:#c9a84c;margin-bottom:8px">Curriculum Topics</h4>
            <div style="max-height:220px;overflow-y:auto">${topicsHtml}</div>
          </div>
        </div>`;

      // ── CH 6: HEREDITY & EVOLUTION ──
      case 6:
        return `
        <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:14px;height:100%">
          <div class="calc-card" style="display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <h4 style="color:#38bdf8;margin:0">🧪 Mendel's Monohybrid Cross (Punnett Square)</h4>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertPunnettToBoard()">📌 Square to Board</button>
            </div>
            <div class="c-row">
              <span class="c-lbl">Parent 1 Genotype</span>
              <input class="c-inp" id="punnett-p1" type="text" value="Tt" maxlength="2">
            </div>
            <div class="c-row">
              <span class="c-lbl">Parent 2 Genotype</span>
              <input class="c-inp" id="punnett-p2" type="text" value="Tt" maxlength="2">
            </div>
            <button class="c-btn" style="margin-top:6px" onclick="ScienceCalculators.calcPunnett()">Generate Punnett Square</button>
            <div class="c-ans-box" style="margin-top:8px" id="punnett-result">
              Phenotypic Ratio: <b>3 Tall : 1 Dwarf (3:1)</b><br>
              Genotypic Ratio: <b>1 TT : 2 Tt : 1 tt (1:2:1)</b>
            </div>
          </div>
          <div class="calc-card">
            <h4 style="color:#c9a84c;margin-bottom:8px">Curriculum Topics</h4>
            <div style="max-height:220px;overflow-y:auto">${topicsHtml}</div>
          </div>
        </div>`;

      // ── CH 7: FORCE AND MOTION ──
      case 7:
        return `
        <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:14px;height:100%">
          <div class="calc-card" style="display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <h4 style="color:#38bdf8;margin:0">🚀 Newton's Law of Universal Gravitation</h4>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertNotes('Gravitation Formula', 'F = G · (m₁ · m₂) / d²\\nwhere G = 6.67 × 10⁻¹¹ N·m²/kg²\\nAcceleration due to gravity: g = GM / R²\\nEarth: g ≈ 9.8 m/s² | Moon: g ≈ 1.63 m/s²')">📌 Formula to Board</button>
            </div>
            <div class="c-row">
              <span class="c-lbl">Mass 1 (m₁)</span>
              <input class="c-inp" id="sci-grav-m1" type="number" value="6e24">
              <span class="prop-unit" style="color:var(--gold)">kg</span>
            </div>
            <div class="c-row">
              <span class="c-lbl">Mass 2 (m₂)</span>
              <input class="c-inp" id="sci-grav-m2" type="number" value="70">
              <span class="prop-unit" style="color:var(--gold)">kg</span>
            </div>
            <div class="c-row">
              <span class="c-lbl">Distance (d)</span>
              <input class="c-inp" id="sci-grav-d" type="number" value="6.4e6">
              <span class="prop-unit" style="color:var(--gold)">m</span>
            </div>
            <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
              <button class="c-btn" onclick="ScienceCalculators.calcGravitation()">Compute Force F</button>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertShape('sc-force-vector')">➡️ Force Vector</button>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertShape('sc-free-body')">🎯 Free Body</button>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertShape('sc-pulley')">⚙️ Pulley</button>
            </div>
            <div class="c-ans-box" style="margin-top:8px" id="sci-grav-result">
              F = <b>686.0 N</b> | Weight W = mg = 70 × 9.8 = <b>686 N</b>
            </div>
          </div>
          <div class="calc-card">
            <h4 style="color:#c9a84c;margin-bottom:8px">Nepal SEE Physics Topics</h4>
            <div style="max-height:220px;overflow-y:auto">${topicsHtml}</div>
          </div>
        </div>`;

      // ── CH 8: PRESSURE ──
      case 8:
        return `
        <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:14px;height:100%">
          <div class="calc-card" style="display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <h4 style="color:#38bdf8;margin:0">⚖️ Liquid Pressure & Pascal's Law</h4>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertNotes('Pressure Formulas', '1. Liquid Pressure: P = h · ρ · g\\n2. Pascal Law: F₁/A₁ = F₂/A₂\\n3. Upthrust: U = V · ρ · g = Weight of displaced liquid')">📌 Notes to Board</button>
            </div>
            <div class="c-row">
              <span class="c-lbl">Depth h (m)</span>
              <input class="c-inp" id="press-h" type="number" value="5">
              <span class="c-lbl">Density ρ (kg/m³)</span>
              <input class="c-inp" id="press-rho" type="number" value="1000">
            </div>
            <div class="c-row">
              <span class="c-lbl">Gravity g</span>
              <input class="c-inp" id="press-g" type="number" value="9.8">
            </div>
            <div style="display:flex;gap:6px;margin-top:6px">
              <button class="c-btn" onclick="ScienceCalculators.calcLiquidPressure()">Calculate Liquid Pressure</button>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertShape('sc-beaker')">🧪 Beaker</button>
            </div>
            <div class="c-ans-box" style="margin-top:8px" id="press-result">
              P = 5 × 1000 × 9.8 = <b>49,000 Pa (49 kPa)</b>
            </div>
          </div>
          <div class="calc-card">
            <h4 style="color:#c9a84c;margin-bottom:8px">Curriculum Topics</h4>
            <div style="max-height:220px;overflow-y:auto">${topicsHtml}</div>
          </div>
        </div>`;

      // ── CH 9: ENERGY IN DAILY LIFE ──
      case 9:
        return `
        <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:14px;height:100%">
          <div class="calc-card" style="display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <h4 style="color:#38bdf8;margin:0">⚡ Mechanical Energy (KE & PE)</h4>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertNotes('Energy Formulas', 'Kinetic Energy: KE = 1/2 · m · v²\\nPotential Energy: PE = m · g · h\\nWork: W = F · d\\nPower: P = W / t (Watts)')">📌 Add to Board</button>
            </div>
            <div class="c-row">
              <span class="c-lbl">Mass m (kg)</span>
              <input class="c-inp" id="energy-m" type="number" value="50">
              <span class="c-lbl">Velocity v (m/s)</span>
              <input class="c-inp" id="energy-v" type="number" value="10">
            </div>
            <div class="c-row">
              <span class="c-lbl">Height h (m)</span>
              <input class="c-inp" id="energy-h" type="number" value="15">
            </div>
            <button class="c-btn" style="margin-top:6px" onclick="ScienceCalculators.calcKEPE()">Compute Energies</button>
            <div class="c-ans-box" style="margin-top:8px" id="energy-result">
              KE = 1/2 × 50 × 10² = <b>2,500 J</b> | PE = 50 × 9.8 × 15 = <b>7,350 J</b>
            </div>
          </div>
          <div class="calc-card">
            <h4 style="color:#c9a84c;margin-bottom:8px">Curriculum Topics</h4>
            <div style="max-height:220px;overflow-y:auto">${topicsHtml}</div>
          </div>
        </div>`;

      // ── CH 10: WAVE, SOUND AND LIGHT ──
      case 10:
        return `
        <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:14px;height:100%">
          <div class="calc-card" style="display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <h4 style="color:#38bdf8;margin:0">💡 Optics: Lens Formula & Wave Speed</h4>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertNotes('Lens Formula', '1/f = 1/u + 1/v\\nMagnification: m = v / u = Image Height / Object Height\\nPower of Lens: P = 1/f (in metres) [Dioptre D]\\nWave Equation: v = f · λ')">📌 Add to Board</button>
            </div>
            <div class="c-row">
              <span class="c-lbl">Focal length f (cm)</span>
              <input class="c-inp" id="lens-f" type="number" value="10">
              <span class="c-lbl">Object dist u (cm)</span>
              <input class="c-inp" id="lens-u" type="number" value="20">
            </div>
            <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
              <button class="c-btn" onclick="ScienceCalculators.calcLens()">Calculate Image Distance (v)</button>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertShape('sc-convex-lens')">🔍 Convex Lens</button>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertShape('sc-concave-lens')">🔍 Concave Lens</button>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertShape('sc-optical-ray')">✨ Light Ray</button>
            </div>
            <div class="c-ans-box" style="margin-top:8px" id="lens-result">
              Image distance v = <b>20.0 cm</b> (Real & Inverted) | Magnification m = <b>1.0</b> (Same size)
            </div>
          </div>
          <div class="calc-card">
            <h4 style="color:#c9a84c;margin-bottom:8px">Curriculum Topics</h4>
            <div style="max-height:220px;overflow-y:auto">${topicsHtml}</div>
          </div>
        </div>`;

      // ── CH 11: ELECTRICITY AND MAGNETISM ──
      case 11:
        return `
        <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:14px;height:100%">
          <div class="calc-card" style="display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <h4 style="color:#38bdf8;margin:0">🔌 Ohm's Law & Circuit Calculator</h4>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertNotes('Electricity Formulas', 'Ohm\\'s Law: V = I · R\\nElectric Power: P = V · I = I²R = V²/R\\nSeries Resistance: Rs = R₁ + R₂\\nParallel Resistance: 1/Rp = 1/R₁ + 1/R₂\\nTransformer: Vp/Vs = Np/Ns = Is/Ip')">📌 Copy to Board</button>
            </div>
            <div class="c-row">
              <span class="c-lbl">Voltage V (Volts)</span>
              <input class="c-inp" id="elec-v" type="number" value="220">
              <span class="c-lbl">Current I (Amps)</span>
              <input class="c-inp" id="elec-i" type="number" value="5">
            </div>
            <div class="c-row">
              <span class="c-lbl">Resistance R₁ (Ω)</span>
              <input class="c-inp" id="elec-r1" type="number" value="10">
              <span class="c-lbl">Resistance R₂ (Ω)</span>
              <input class="c-inp" id="elec-r2" type="number" value="15">
            </div>
            <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
              <button class="c-btn" onclick="ScienceCalculators.calcElectricity()">Compute Power & R</button>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertShape('sc-battery')">🔋 Battery</button>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertShape('sc-resistor')">⚡ Resistor</button>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertShape('sc-bulb')">💡 Bulb</button>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertShape('sc-switch-open')">🔘 Switch</button>
            </div>
            <div class="c-ans-box" style="margin-top:8px" id="elec-result">
              Power P = <b>1,100 W</b> | Series Rs = <b>25 Ω</b> | Parallel Rp = <b>6.0 Ω</b>
            </div>
          </div>
          <div class="calc-card">
            <h4 style="color:#c9a84c;margin-bottom:8px">Curriculum Topics</h4>
            <div style="max-height:220px;overflow-y:auto">${topicsHtml}</div>
          </div>
        </div>`;

      // ── CH 12: CHEMICAL REACTIONS & PERIODIC TABLE ──
      case 12:
        return `
        <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:14px;height:100%">
          <div class="calc-card" style="display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <h4 style="color:#38bdf8;margin:0">⚛️ Periodic Table Elements 1–20</h4>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertShape('sc-atom-bohr')">⚛️ Insert Bohr Atom</button>
            </div>
            <div class="c-row">
              <span class="c-lbl">Select Element</span>
              <select class="c-sel" id="chem-elem-sel" onchange="ScienceCalculators.selectElement(this.value)">
                ${ELEMENTS_20.map(el => `<option value="${el.z}">${el.z}. ${el.n} (${el.s})</option>`).join('')}
              </select>
            </div>
            <div class="c-ans-box" style="margin-top:8px" id="chem-elem-info">
              <b>Hydrogen (H)</b> | Atomic No: 1 | Mass: 1.008<br>
              Electronic Config: <b>K = 1</b> | Valency: <b>1</b> | Type: Non-metal
            </div>
            <div class="c-ref" style="margin-top:8px">
              <b>4 Types of Chemical Reactions:</b><br>
              1. Combination: A + B → AB<br>
              2. Decomposition: AB → A + B<br>
              3. Displacement: A + BC → AC + B<br>
              4. Double Displacement / Neutralization: AB + CD → AD + CB
            </div>
          </div>
          <div class="calc-card">
            <h4 style="color:#c9a84c;margin-bottom:8px">Curriculum Topics</h4>
            <div style="max-height:220px;overflow-y:auto">${topicsHtml}</div>
          </div>
        </div>`;

      // ── CH 13: SOME COMMON GASES ──
      case 13:
        return `
        <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:14px;height:100%">
          <div class="calc-card" style="display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <h4 style="color:#38bdf8;margin:0">☁️ Laboratory Preparation of CO₂ & NH₃</h4>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertNotes('Lab Preparation of Gases', 'Carbon Dioxide (CO₂):\\nCaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂↑\\n- Upward displacement of air (denser than air)\\n- Test: Turns lime water milky\\n\\nAmmonia (NH₃):\\n2NH₄Cl + Ca(OH)₂ → CaCl₂ + 2H₂O + 2NH₃↑\\n- Downward displacement of air\\n- Dried by Quicklime (CaO)\\n- Turns moist red litmus blue')">📌 Add to Board</button>
            </div>
            <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
              <button class="c-btn-sm" onclick="ScienceCalculators.insertShape('sc-test-tube')">🧪 Test Tube</button>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertShape('sc-beaker')">🧪 Beaker</button>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertShape('sc-erlenmeyer')">🏺 Conical Flask</button>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertShape('sc-bunsen')">🔥 Bunsen Burner</button>
            </div>
            <div class="c-ref" style="margin-top:10px">
              <b>Industrial Manufacture of Ammonia (Haber Process):</b><br>
              N₂ + 3H₂ ⇌ 2NH₃ + Heat<br>
              Conditions: Temp ≈ 450–500°C, Pressure ≈ 200–900 atm, Catalyst: Iron (Fe) with Molybdenum (Mo) promoter.
            </div>
          </div>
          <div class="calc-card">
            <h4 style="color:#c9a84c;margin-bottom:8px">Curriculum Topics</h4>
            <div style="max-height:220px;overflow-y:auto">${topicsHtml}</div>
          </div>
        </div>`;

      // ── CH 14: METALS & NON-METALS ──
      case 14:
        return `
        <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:14px;height:100%">
          <div class="calc-card" style="display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <h4 style="color:#38bdf8;margin:0">⛏️ Reactivity Series & Metallurgy</h4>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertNotes('Reactivity Series of Metals', 'Most Reactive:\\nK > Na > Ca > Mg > Al > Zn > Fe > Pb > [H] > Cu > Hg > Ag > Au\\nLeast Reactive\\n\\nImportant Ores:\\n- Iron: Haematite (Fe₂O₃)\\n- Copper: Copper Pyrite (CuFeS₂)\\n- Aluminum: Bauxite (Al₂O₃·2H₂O)')">📌 Copy to Board</button>
            </div>
            <div class="c-ref" style="margin-top:8px">
              <b>Rusting of Iron Prevention:</b><br>
              1. Galvanization (Coating with Zinc)<br>
              2. Electroplating (Chromium or Nickel)<br>
              3. Painting / Oiling / Greasing<br>
              4. Alloying (e.g. Stainless Steel = Fe + Cr + Ni)
            </div>
          </div>
          <div class="calc-card">
            <h4 style="color:#c9a84c;margin-bottom:8px">Curriculum Topics</h4>
            <div style="max-height:220px;overflow-y:auto">${topicsHtml}</div>
          </div>
        </div>`;

      // ── CH 15: HYDROCARBONS ──
      case 15:
        return `
        <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:14px;height:100%">
          <div class="calc-card" style="display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <h4 style="color:#38bdf8;margin:0">🧪 Hydrocarbon IUPAC Formula Builder</h4>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertHydrocarbonToBoard()">📌 Formula to Board</button>
            </div>
            <div class="c-row">
              <span class="c-lbl">Series Type</span>
              <select class="c-sel" id="hc-type" onchange="ScienceCalculators.calcHydrocarbon()">
                <option value="alkane" selected>Alkane (CₙH₂ₙ₊₂) — Saturated</option>
                <option value="alkene">Alkene (CₙH₂ₙ) — Double bond</option>
                <option value="alkyne">Alkyne (CₙH₂ₙ₋₂) — Triple bond</option>
              </select>
            </div>
            <div class="c-row">
              <span class="c-lbl">Number of Carbons (n)</span>
              <input class="c-inp" id="hc-n" type="number" value="3" min="1" max="10" oninput="ScienceCalculators.calcHydrocarbon()">
            </div>
            <div class="c-ans-box" style="margin-top:8px" id="hc-result">
              IUPAC Name: <b>Propane</b> | Molecular Formula: <b>C₃H₈</b>
            </div>
          </div>
          <div class="calc-card">
            <h4 style="color:#c9a84c;margin-bottom:8px">Curriculum Topics</h4>
            <div style="max-height:220px;overflow-y:auto">${topicsHtml}</div>
          </div>
        </div>`;

      // ── CH 16: MATERIALS IN DAILY LIFE ──
      case 16:
        return `
        <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:14px;height:100%">
          <div class="calc-card" style="display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <h4 style="color:#38bdf8;margin:0">🧱 Daily Life Chemical Materials</h4>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertNotes('Daily Materials Notes', '1. Portland Cement: Limestone (CaCO₃) + Clay (SiO₂, Al₂O₃, Fe₂O₃) + 2-3% Gypsum (CaSO₄·2H₂O to slow setting)\\n2. Types of Glass: Soda glass, Hard glass, Pyrex (Borosilicate), Flint glass\\n3. Polymers: Thermoplastics (Polythene, PVC) vs Thermosetting (Bakelite)')">📌 Add to Board</button>
            </div>
            <div class="c-ref" style="margin-top:8px">
              <b>Chemical Fertilizers (NPK):</b><br>
              • Nitrogenous: Urea [CO(NH₂)₂] — stimulates vegetative growth<br>
              • Phosphatic: Triple superphosphate — promotes root growth<br>
              • Potassic: Potassium Chloride (KCl) — disease resistance
            </div>
          </div>
          <div class="calc-card">
            <h4 style="color:#c9a84c;margin-bottom:8px">Curriculum Topics</h4>
            <div style="max-height:220px;overflow-y:auto">${topicsHtml}</div>
          </div>
        </div>`;

      // ── CH 17: EARTH, CLIMATE & UNIVERSE ──
      case 17:
        return `
        <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:14px;height:100%">
          <div class="calc-card" style="display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <h4 style="color:#38bdf8;margin:0">🪐 Earth, Climate & Universe</h4>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertNotes('Geological Eras', '1. Cenozoic (Age of Mammals & Humans - Present)\\n2. Mesozoic (Age of Reptiles & Dinosaurs)\\n3. Paleozoic (Age of Amphibians & Ancient Life)\\n4. Precambrian (Origin of Earth ≈ 4.6 Billion Years ago)')">📌 Add to Board</button>
            </div>
            <div style="display:flex;gap:6px;margin-top:8px">
              <button class="c-btn-sm" onclick="ScienceCalculators.insertShape('sc-earth')">🌍 Insert Earth Globe</button>
              <button class="c-btn-sm" onclick="ScienceCalculators.insertShape('sc-orbit')">🪐 Insert Planetary Orbit</button>
            </div>
            <div class="c-ref" style="margin-top:10px">
              <b>Big Bang Theory & Solar System:</b><br>
              • Universe originated approx 13.8 billion years ago.<br>
              • Orbital Velocity of Satellite: v = √(GM / r)<br>
              • Geostationary satellite orbit altitude: ≈ 36,000 km.
            </div>
          </div>
          <div class="calc-card">
            <h4 style="color:#c9a84c;margin-bottom:8px">Curriculum Topics</h4>
            <div style="max-height:220px;overflow-y:auto">${topicsHtml}</div>
          </div>
        </div>`;

      default:
        return `
        <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:14px;height:100%">
          <div class="calc-card">
            <h4 style="color:#38bdf8">🔬 ${ch.name}</h4>
            <p style="color:rgba(255,255,255,0.7);font-size:12px">${ch.desc || 'Grade 10 Science & Technology curriculum.'}</p>
            <div style="margin-top:14px">
              <button class="c-btn" onclick="ScienceCalculators.insertNotes('${ch.name}', '${ch.desc || ''}')">📌 Insert Chapter Summary to Board</button>
            </div>
          </div>
          <div class="calc-card">
            <h4 style="color:#c9a84c;margin-bottom:8px">Topics</h4>
            <div style="max-height:220px;overflow-y:auto">${topicsHtml}</div>
          </div>
        </div>`;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // INTERACTIVE ACTION HANDLERS
  // ─────────────────────────────────────────────────────────────

  function calcMetricPrefix() {
    const val = parseFloat(document.getElementById('sci-val')?.value || 0);
    const factor = parseFloat(document.getElementById('sci-unit-from')?.value || 1);
    const base = val * factor;
    const res = document.getElementById('sci-unit-result');
    if (res) {
      res.innerHTML = `${val.toLocaleString()} = <b>${base.toExponential(3)} Base Units</b> (${base.toLocaleString()} standard)`;
    }
  }

  function calcStorage() {
    const val = parseFloat(document.getElementById('ict-input')?.value || 0);
    const unit = document.getElementById('ict-unit')?.value || 'GB';
    let bytes = val;
    if (unit === 'KB') bytes = val * 1024;
    if (unit === 'MB') bytes = val * 1024 * 1024;
    if (unit === 'GB') bytes = val * 1024 * 1024 * 1024;
    if (unit === 'TB') bytes = val * 1024 * 1024 * 1024 * 1024;

    const mb = bytes / (1024 * 1024);
    const gb = bytes / (1024 * 1024 * 1024);
    const bits = bytes * 8;
    const res = document.getElementById('ict-result');
    if (res) {
      res.innerHTML = `${val} ${unit} = <b>${mb.toLocaleString()} MB</b> = <b>${gb.toFixed(2)} GB</b> = ${bits.toExponential(3)} bits`;
    }
  }

  function calcTrophicEnergy() {
    const e = parseFloat(document.getElementById('bio-energy')?.value || 0);
    const res = document.getElementById('bio-energy-res');
    if (res) {
      res.innerHTML = `Producer: <b>${e.toLocaleString()} J</b> → Herbivore: <b>${(e*0.1).toLocaleString()} J</b> → Carnivore: <b>${(e*0.01).toLocaleString()} J</b> → Apex: <b>${(e*0.001).toLocaleString()} J</b>`;
    }
  }

  function calcPunnett() {
    const p1 = (document.getElementById('punnett-p1')?.value || 'Tt').padEnd(2,'t').slice(0,2);
    const p2 = (document.getElementById('punnett-p2')?.value || 'Tt').padEnd(2,'t').slice(0,2);

    const g1 = [p1[0], p1[1]];
    const g2 = [p2[0], p2[1]];

    const c1 = g1[0] + g2[0];
    const c2 = g1[0] + g2[1];
    const c3 = g1[1] + g2[0];
    const c4 = g1[1] + g2[1];

    const res = document.getElementById('punnett-result');
    if (res) {
      res.innerHTML = `
        <table style="border-collapse:collapse;margin:6px 0;width:100%;text-align:center;font-family:var(--mono);font-size:13px">
          <tr style="border-bottom:1px solid rgba(56,189,248,0.3)">
            <th style="color:#38bdf8">Gametes</th>
            <th style="color:#c9a84c">${g2[0]}</th>
            <th style="color:#c9a84c">${g2[1]}</th>
          </tr>
          <tr style="border-bottom:1px solid rgba(255,255,255,0.08)">
            <td style="color:#c9a84c;font-weight:700">${g1[0]}</td>
            <td style="background:rgba(56,189,248,0.1);padding:4px">${c1}</td>
            <td style="background:rgba(56,189,248,0.06);padding:4px">${c2}</td>
          </tr>
          <tr>
            <td style="color:#c9a84c;font-weight:700">${g1[1]}</td>
            <td style="background:rgba(56,189,248,0.06);padding:4px">${c3}</td>
            <td style="background:rgba(56,189,248,0.1);padding:4px">${c4}</td>
          </tr>
        </table>
        Offspring Genotypes: <b>${c1}, ${c2}, ${c3}, ${c4}</b>
      `;
    }
  }

  function insertPunnettToBoard() {
    insertNotes('Mendel Monohybrid Punnett Square', 'Parents: Tt × Tt\nOffspring:\n- TT (Homozygous Tall): 25%\n- Tt (Heterozygous Tall): 50%\n- tt (Homozygous Dwarf): 25%\n\nPhenotypic Ratio = 3 Tall : 1 Dwarf (3:1)\nGenotypic Ratio = 1 TT : 2 Tt : 1 tt (1:2:1)');
  }

  function calcGravitation() {
    const m1 = parseFloat(document.getElementById('sci-grav-m1')?.value || 0);
    const m2 = parseFloat(document.getElementById('sci-grav-m2')?.value || 0);
    const d  = parseFloat(document.getElementById('sci-grav-d')?.value || 1);
    const G  = 6.674e-11;

    const F = G * (m1 * m2) / (d * d);
    const res = document.getElementById('sci-grav-result');
    if (res) {
      res.innerHTML = `F = 6.67×10⁻¹¹ × (${m1.toExponential(2)} × ${m2}) / (${d.toExponential(2)})² = <b>${F.toFixed(2)} N</b>`;
    }
  }

  function calcLiquidPressure() {
    const h   = parseFloat(document.getElementById('press-h')?.value || 0);
    const rho = parseFloat(document.getElementById('press-rho')?.value || 1000);
    const g   = parseFloat(document.getElementById('press-g')?.value || 9.8);
    const P   = h * rho * g;
    const res = document.getElementById('press-result');
    if (res) {
      res.innerHTML = `P = ${h}m × ${rho}kg/m³ × ${g}m/s² = <b>${P.toLocaleString()} Pa</b> (${(P/1000).toFixed(2)} kPa)`;
    }
  }

  function calcKEPE() {
    const m = parseFloat(document.getElementById('energy-m')?.value || 0);
    const v = parseFloat(document.getElementById('energy-v')?.value || 0);
    const h = parseFloat(document.getElementById('energy-h')?.value || 0);
    const ke = 0.5 * m * v * v;
    const pe = m * 9.8 * h;
    const res = document.getElementById('energy-result');
    if (res) {
      res.innerHTML = `KE = 1/2 × ${m} × ${v}² = <b>${ke.toLocaleString()} J</b> | PE = ${m} × 9.8 × ${h} = <b>${pe.toLocaleString()} J</b>`;
    }
  }

  function calcLens() {
    const f = parseFloat(document.getElementById('lens-f')?.value || 10);
    const u = parseFloat(document.getElementById('lens-u')?.value || 20);
    const denom = u - f;
    const res = document.getElementById('lens-result');
    if (denom === 0) {
      if (res) res.innerHTML = `Image is at <b>Infinity (∞)</b> (Object at Focus F)`;
      return;
    }
    const v = (u * f) / denom;
    const m = Math.abs(v / u);
    if (res) {
      res.innerHTML = `Image Distance v = <b>${v.toFixed(2)} cm</b> | Magnification m = <b>${m.toFixed(2)}×</b>`;
    }
  }

  function calcElectricity() {
    const v = parseFloat(document.getElementById('elec-v')?.value || 0);
    const i = parseFloat(document.getElementById('elec-i')?.value || 0);
    const r1 = parseFloat(document.getElementById('elec-r1')?.value || 0);
    const r2 = parseFloat(document.getElementById('elec-r2')?.value || 0);

    const P = v * i;
    const rs = r1 + r2;
    const rp = (r1 * r2) / ((r1 + r2) || 1);

    const res = document.getElementById('elec-result');
    if (res) {
      res.innerHTML = `Electric Power P = ${v}V × ${i}A = <b>${P.toLocaleString()} Watts</b><br>Series: Rs = <b>${rs.toFixed(1)} Ω</b> | Parallel: Rp = <b>${rp.toFixed(2)} Ω</b>`;
    }
  }

  function selectElement(z) {
    const el = ELEMENTS_20.find(e => e.z === Number(z));
    const info = document.getElementById('chem-elem-info');
    if (el && info) {
      info.innerHTML = `
        <b>${el.n} (${el.s})</b> | Atomic No: <b>${el.z}</b> | Mass: <b>${el.a}</b><br>
        Electronic Config: <b>${el.e}</b> | Valency: <b>${el.v}</b> | Type: <span style="color:#38bdf8">${el.t}</span>
      `;
    }
  }

  function calcHydrocarbon() {
    const type = document.getElementById('hc-type')?.value || 'alkane';
    const n = parseInt(document.getElementById('hc-n')?.value || 1, 10);
    const prefixes = ['Meth','Eth','Prop','But','Pent','Hex','Hept','Oct','Non','Dec'];
    const pfx = prefixes[n-1] || `C${n}`;

    let h = 0;
    let name = '';
    if (type === 'alkane') {
      h = 2 * n + 2;
      name = pfx + 'ane';
    } else if (type === 'alkene') {
      if (n < 2) {
        document.getElementById('hc-result').innerHTML = 'Alkene requires at least n = 2 carbons (Ethene)';
        return;
      }
      h = 2 * n;
      name = pfx + 'ene';
    } else if (type === 'alkyne') {
      if (n < 2) {
        document.getElementById('hc-result').innerHTML = 'Alkyne requires at least n = 2 carbons (Ethyne)';
        return;
      }
      h = 2 * n - 2;
      name = pfx + 'yne';
    }

    const res = document.getElementById('hc-result');
    if (res) {
      res.innerHTML = `IUPAC Name: <b>${name}</b> | Molecular Formula: <b>C${n > 1 ? n : ''}H${h}</b>`;
    }
  }

  function insertHydrocarbonToBoard() {
    const res = document.getElementById('hc-result');
    const text = res ? res.innerText : 'Hydrocarbon Formula';
    insertNotes('Hydrocarbon Nomenclature', text);
  }

  return {
    buildContent,
    insertNotes,
    insertShape,
    calcMetricPrefix,
    calcStorage,
    calcTrophicEnergy,
    calcPunnett,
    insertPunnettToBoard,
    calcGravitation,
    calcLiquidPressure,
    calcKEPE,
    calcLens,
    calcElectricity,
    selectElement,
    calcHydrocarbon,
    insertHydrocarbonToBoard
  };
})();

// Expose globally
if (typeof window !== 'undefined') {
  window.ScienceCalculators = ScienceCalculators;
}
