/**
 * StrukinAja v2.7 - Core Application Logic
 * Single Page Application for Midwife & Clinic Receipt Generator
 * 100% Client-Side with LocalStorage, Touch Signature, SVG Stamp & HD html2canvas Export
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. CONSTANTS & CONFIGURATION
  // ==========================================================================
  const SECRET_SALT = "STRUKINAJA_SECRET_2026";
  const ADMIN_PIN = "210920";
  const ADMIN_WA_PHONE = "6285176852680";
  const STORAGE_KEY_PROFILE = "strukinaja_profile_v1";
  const STORAGE_KEY_LICENSE = "strukinaja_license_key_v1";
  const STORAGE_KEY_SAVED_SIG = "strukinaja_saved_signature_v1";

  // Pre-configured Stamp Color Schemes
  const STAMP_COLORS = {
    blue: {
      id: 'blue',
      name: 'Biru Medis',
      hex: '#1e40af',
      light: '#eff6ff',
      border: '#1d4ed8'
    },
    purple: {
      id: 'purple',
      name: 'Ungu Medis (Bidan)',
      hex: '#7e22ce',
      light: '#faf5ff',
      border: '#6b21a8'
    },
    red: {
      id: 'red',
      name: 'Merah Resmi',
      hex: '#dc2626',
      light: '#fef2f2',
      border: '#b91c1c'
    }
  };

  // Default demo data for first-time visitors
  const DEFAULT_PROFILE = {
    clinicName: "Praktik Mandiri Bidan Hj. Siti Rahmawati, S.Tr.Keb",
    sipb: "503/SIPB/088/DINKES/2024",
    address: "Jl. Dahlia No. 15, RT 03/04, Kel. Sukajadi",
    phone: "0812-9876-5432",
    bidanName: "Bd. Hj. Siti Rahmawati, S.Tr.Keb",
    city: "Bandung",
    logoBase64: "",
    stampColor: "purple"
  };

  const DEFAULT_PATIENT = {
    notaNumber: "",
    examDate: new Date().toISOString().split('T')[0],
    patientName: "Ny. Maya Kartika",
    patientAge: "27 Tahun",
    serviceType: "Pemeriksaan Kehamilan (ANC) Trimester 2",
    items: [
      { name: "Pemeriksaan Fisik ANC & Detak Jantung Janin (Doppler)", qty: 1, price: 60000 },
      { name: "Pemeriksaan USG 2D Skrining Kehamilan", qty: 1, price: 100000 },
      { name: "Suplemen Kalsium & Tablet Tambah Darah (30 Tab)", qty: 1, price: 50000 },
      { name: "Jasa Konseling Gizi & Evaluasi Buku KIA", qty: 1, price: 25000 }
    ]
  };

  // Common quick-add items for Indonesian Midwives
  const QUICK_SERVICES = [
    { name: "Pemeriksaan Kehamilan (ANC)", price: 60000 },
    { name: "Suntik KB 3 Bulan", price: 35000 },
    { name: "Suntik KB 1 Bulan", price: 30000 },
    { name: "Pemasangan IUD / Implan", price: 250000 },
    { name: "Imunisasi Dasar Bayi (BCG/Polio/DPT)", price: 55000 },
    { name: "Tindik Telinga Bayi Steril", price: 50000 },
    { name: "Perawatan Tali Pusat & Nifas (PNC)", price: 75000 },
    { name: "Cek Lab Sederhana (HB & Gol. Darah)", price: 40000 },
    { name: "Paket Vitamin & Asam Folat", price: 45000 },
    { name: "Jasa Konsultasi & Buku KIA", price: 25000 }
  ];

  // ==========================================================================
  // 2. STATE MANAGEMENT & SAFE STORAGE HELPERS
  // ==========================================================================
  let appState = {
    profile: { ...DEFAULT_PROFILE },
    patient: {
      ...DEFAULT_PATIENT,
      items: DEFAULT_PATIENT.items.map(it => ({ ...it }))
    },
    licenseKey: "",
    signatureDataUrl: "",
    saveSignatureForNext: false,
    activeTab: "form", // 'form' | 'preview' (for mobile < 1024px)
    isReturningUser: false
  };

  let resizeSignatureCanvasFn = null;

  function safeStorageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn("localStorage.getItem gagal:", e);
      return null;
    }
  }

  function safeStorageSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.warn("localStorage.setItem gagal:", e);
      return false;
    }
  }

  function safeStorageRemove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.warn("localStorage.removeItem gagal:", e);
      return false;
    }
  }

  function safeJsonParse(raw) {
    if (!raw || typeof raw !== 'string') return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.warn("JSON.parse gagal (data korup/legacy diabaikan):", e);
      return null;
    }
  }

  // ==========================================================================
  // 3. DETERMINISTIC LICENSE KEY ALGORITHM (PRESERVED)
  // ==========================================================================
  /**
   * Generates a 6-character alphanumeric uppercase activation key
   * from the normalized clinic name and the secret salt.
   * Deterministic: Identical clinic names always yield the same key.
   */
  function generateLicenseKey(clinicName) {
    if (!clinicName || typeof clinicName !== 'string') return '';
    const cleanName = clinicName.trim().toLowerCase();
    if (!cleanName) return '';

    const combined = cleanName + "::" + SECRET_SALT;

    // Dual 32-bit FNV-1a hash with non-linear avalanche mixing
    let h1 = 0x811c9dc5;
    let h2 = 0x9e3779b9;
    for (let i = 0; i < combined.length; i++) {
      const c = combined.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193);
      h2 = Math.imul(h2 ^ c, 0x5bd1e995);
      h2 ^= (h2 >>> 15);
    }

    h1 = Math.imul(h1 ^ (h2 >>> 16), 0x85ebca6b);
    h1 ^= (h1 >>> 13);
    h2 = Math.imul(h2 ^ (h1 >>> 16), 0xc2b2ae35);
    h2 ^= (h2 >>> 16);

    const val1 = BigInt(h1 >>> 0);
    const val2 = BigInt(h2 >>> 0);
    let n = (val1 << 32n) | val2;

    // 32-char alphanumeric set without visually confusing characters (0, O, 1, I)
    const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      const idx = Number(n % 32n);
      code += charset[Math.abs(idx)];
      n = n / 32n;
    }
    return code;
  }

  /**
   * Checks whether the current clinic name has a valid PRO license key.
   */
  function isProActive() {
    if (!appState.profile.clinicName || !appState.profile.clinicName.trim()) return false;
    const expectedKey = generateLicenseKey(appState.profile.clinicName);
    const savedKey = (appState.licenseKey || '').trim().toUpperCase();
    return !!expectedKey && expectedKey === savedKey;
  }

  // ==========================================================================
  // 4. INDONESIAN "TERBILANG" ALGORITHM & FORMATTERS (PRESERVED)
  // ==========================================================================
  /**
   * Converts a number to Indonesian grammatical words with "Rupiah".
   * E.g. 250000 -> "Dua Ratus Lima Puluh Ribu Rupiah"
   */
  function terbilang(n) {
    const num = Math.floor(Math.abs(Number(n) || 0));
    if (num === 0) return "Nol Rupiah";

    const huruf = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];

    function konversi(angka) {
      if (angka < 12) {
        return huruf[angka];
      } else if (angka < 20) {
        return konversi(angka - 10) + " Belas";
      } else if (angka < 100) {
        return konversi(Math.floor(angka / 10)) + " Puluh " + konversi(angka % 10);
      } else if (angka < 200) {
        return "Seratus " + konversi(angka - 100);
      } else if (angka < 1000) {
        return konversi(Math.floor(angka / 100)) + " Ratus " + konversi(angka % 100);
      } else if (angka < 2000) {
        return "Seribu " + konversi(angka - 1000);
      } else if (angka < 1000000) {
        return konversi(Math.floor(angka / 1000)) + " Ribu " + konversi(angka % 1000);
      } else if (angka < 1000000000) {
        return konversi(Math.floor(angka / 1000000)) + " Juta " + konversi(angka % 1000000);
      } else if (angka < 1000000000000) {
        return konversi(Math.floor(angka / 1000000000)) + " Miliar " + konversi(angka % 1000000000);
      } else {
        return konversi(Math.floor(angka / 1000000000000)) + " Triliun " + konversi(angka % 1000000000000);
      }
    }

    const hasil = konversi(num).replace(/\s+/g, " ").trim();
    return hasil + " Rupiah";
  }

  /**
   * Format numbers to Indonesian Rupiah representation: Rp 250.000
   */
  function formatRupiah(amount) {
    const val = Math.floor(Number(amount) || 0);
    return "Rp " + val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  /**
   * Format date string YYYY-MM-DD to Indonesian format: 14 November 2026
   */
  function formatIndoDate(dateStr) {
    if (!dateStr) return "";
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const months = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const day = parseInt(parts[2], 10);
    const month = months[parseInt(parts[1], 10) - 1] || "";
    const year = parts[0];
    return `${day} ${month} ${year}`;
  }

  /**
   * Generate an authentic Nota Number: NOT-YYYYMMDD-XXXX
   */
  function generateNotaNumber() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `NOT-${y}${m}${day}-${rand}`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==========================================================================
  // 5. TOAST NOTIFICATION SYSTEM (CLEAN CLINICAL STYLE)
  // ==========================================================================
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    container.innerHTML = '';

    const toast = document.createElement('div');
    const styles = {
      success: 'bg-teal-700 text-white border border-teal-600 shadow-lg',
      error: 'bg-red-600 text-white border border-red-500 shadow-lg',
      warning: 'bg-amber-700 text-white border border-amber-600 shadow-lg',
      info: 'bg-slate-900 text-white border border-slate-700 shadow-lg'
    };

    const icons = {
      success: `<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>`,
      error: `<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>`,
      warning: `<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`,
      info: `<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
    };

    toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-xl font-medium text-xs transition-all duration-300 pointer-events-auto toast-slide-in ${styles[type] || styles.info}`;
    toast.innerHTML = `
      ${icons[type] || icons.info}
      <span class="flex-1 leading-snug">${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.remove('toast-slide-in');
      toast.classList.add('toast-slide-out');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 240);
    }, 2600);
  }

  // ==========================================================================
  // 6. STORAGE SYNC & RESTORE (FULLY TRY/CATCH PROTECTED)
  // ==========================================================================
  function loadStateFromStorage() {
    let hasSavedClinicData = false;
    let hasSavedLicense = false;

    const rawProfile = safeStorageGet(STORAGE_KEY_PROFILE) || safeStorageGet('medstruk_profile_v1');
    if (rawProfile) {
      const parsedProfile = safeJsonParse(rawProfile);
      if (parsedProfile && typeof parsedProfile === 'object' && !Array.isArray(parsedProfile)) {
        appState.profile = { ...DEFAULT_PROFILE, ...parsedProfile };
        hasSavedClinicData = true;
      }
    }

    const savedKey = safeStorageGet(STORAGE_KEY_LICENSE) || safeStorageGet('medstruk_license_key_v1');
    if (savedKey && typeof savedKey === 'string' && savedKey.trim()) {
      appState.licenseKey = savedKey.trim();
      hasSavedLicense = true;
    }

    const savedSig = safeStorageGet(STORAGE_KEY_SAVED_SIG) || safeStorageGet('medstruk_saved_signature_v1');
    if (savedSig && typeof savedSig === 'string' && savedSig.startsWith('data:image/')) {
      appState.signatureDataUrl = savedSig;
      appState.saveSignatureForNext = true;
    }

    // Returning user check: skip landing hero directly if clinic profile or license exists
    appState.isReturningUser = hasSavedClinicData || hasSavedLicense;

    if (!appState.patient.notaNumber) {
      appState.patient.notaNumber = generateNotaNumber();
    }
  }

  function saveProfileToStorage() {
    try {
      const serialized = JSON.stringify(appState.profile);
      safeStorageSet(STORAGE_KEY_PROFILE, serialized);
    } catch (e) {
      console.warn("Gagal menyimpan profil ke localStorage:", e);
    }
  }

  function saveLicenseToStorage(key) {
    appState.licenseKey = key;
    safeStorageSet(STORAGE_KEY_LICENSE, key);
  }

  // ==========================================================================
  // 7. SMART HERO / LANDING VIEW CONTROLLER
  // ==========================================================================
  function setupHeroSection() {
    const heroSection = document.getElementById('heroSection');
    const toggleHeroBtn = document.getElementById('toggleHeroBtn');
    const dismissHeroBtn = document.getElementById('dismissHeroBtn');
    const startWorkspaceBtn = document.getElementById('startWorkspaceBtn');
    const heroUpgradeBtn = document.getElementById('heroUpgradeBtn');
    const workspaceSection = document.getElementById('workspaceSection');

    if (!heroSection) return;

    function setHeroVisible(visible) {
      if (visible) {
        heroSection.classList.remove('hidden');
        if (toggleHeroBtn) toggleHeroBtn.setAttribute('aria-expanded', 'true');
      } else {
        heroSection.classList.add('hidden');
        if (toggleHeroBtn) toggleHeroBtn.setAttribute('aria-expanded', 'false');
      }
    }

    // Show landing hero only to first-time visitors; open workspace directly if clinic/license exists
    setHeroVisible(!appState.isReturningUser);

    if (toggleHeroBtn) {
      toggleHeroBtn.addEventListener('click', () => {
        const isCurrentlyHidden = heroSection.classList.contains('hidden');
        setHeroVisible(isCurrentlyHidden);
        if (isCurrentlyHidden) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    }

    if (dismissHeroBtn) {
      dismissHeroBtn.addEventListener('click', () => setHeroVisible(false));
    }

    if (startWorkspaceBtn) {
      startWorkspaceBtn.addEventListener('click', () => {
        setHeroVisible(false);
        if (window.innerWidth < 1024) {
          switchMobileTab('form', { scrollToTop: false });
        }
        if (workspaceSection) {
          workspaceSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        const clinicInput = document.getElementById('profileClinicName');
        if (clinicInput && window.innerWidth >= 1024) {
          setTimeout(() => clinicInput.focus(), 250);
        }
      });
    }

    if (heroUpgradeBtn) {
      heroUpgradeBtn.addEventListener('click', () => {
        setHeroVisible(false);
        if (window.innerWidth < 1024) {
          switchMobileTab('form', { scrollToTop: false });
        }
        const proSection = document.getElementById('proLicenseSection');
        if (proSection) {
          setTimeout(() => {
            proSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 80);
        }
      });
    }
  }

  // ==========================================================================
  // 8. STEMPEL SVG GENERATION (PRESERVED)
  // ==========================================================================
  /**
   * Generates a circular SVG stamp with curved top text, centered LUNAS,
   * and curved bottom SIPB text.
   */
  function generateStampSvg(colorKey, clinicName, sipb) {
    const color = STAMP_COLORS[colorKey] || STAMP_COLORS.purple;
    const rawName = (clinicName || "PRAKTIK MANDIRI BIDAN").trim().toUpperCase();
    const sipbText = (sipb ? "SIPB: " + sipb : "RESMI & SAH").trim().toUpperCase();

    // Adjust font size dynamically if clinic name is long
    let nameFontSize = 10;
    let letterSpacing = 1.2;
    if (rawName.length > 38) {
      nameFontSize = 7.5;
      letterSpacing = 0.6;
    } else if (rawName.length > 28) {
      nameFontSize = 8.5;
      letterSpacing = 0.9;
    }

    // Unique IDs for SVG text paths to prevent collisions
    const pathUpperId = "stampUpperPath_" + Math.random().toString(36).substr(2, 6);
    const pathLowerId = "stampLowerPath_" + Math.random().toString(36).substr(2, 6);

    return `
      <svg viewBox="0 0 200 200" class="w-full h-full transform -rotate-12 select-none" style="color: ${color.hex};" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <!-- Upper Arc (Clockwise, top half) -->
          <path id="${pathUpperId}" d="M 28 100 A 72 72 0 0 1 172 100" fill="none" />
          <!-- Lower Arc (Clockwise from left to right curving down, keeping text upright) -->
          <path id="${pathLowerId}" d="M 28 102 A 72 72 0 0 0 172 102" fill="none" />
        </defs>

        <!-- Outer Double Rings -->
        <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" stroke-width="3" opacity="0.95" />
        <circle cx="100" cy="100" r="86" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="3,2" opacity="0.85" />
        <circle cx="100" cy="100" r="62" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.9" />

        <!-- Curved Upper Text: Clinic / Midwife Name -->
        <text font-size="${nameFontSize}" font-weight="800" fill="currentColor" letter-spacing="${letterSpacing}" opacity="0.95">
          <textPath href="#${pathUpperId}" startOffset="50%" text-anchor="middle">
            ${escapeHtml(rawName)}
          </textPath>
        </text>

        <!-- Center Box with "LUNAS" -->
        <line x1="36" y1="84" x2="164" y2="84" stroke="currentColor" stroke-width="1.6" opacity="0.9" />
        <text x="100" y="103" font-size="17" font-weight="900" text-anchor="middle" fill="currentColor" letter-spacing="2.5" opacity="0.98">
          LUNAS
        </text>
        <line x1="36" y1="113" x2="164" y2="113" stroke="currentColor" stroke-width="1.6" opacity="0.9" />

        <!-- Flanking Star Ornaments -->
        <text x="46" y="101" font-size="10" fill="currentColor" text-anchor="middle" opacity="0.9">★</text>
        <text x="154" y="101" font-size="10" fill="currentColor" text-anchor="middle" opacity="0.9">★</text>

        <!-- Curved Lower Text: SIPB -->
        <text font-size="8.5" font-weight="700" fill="currentColor" letter-spacing="1" opacity="0.9">
          <textPath href="#${pathLowerId}" startOffset="50%" text-anchor="middle">
            ${escapeHtml(sipbText)}
          </textPath>
        </text>
      </svg>
    `;
  }

  // ==========================================================================
  // 9. RENDER LIVE RECEIPT PREVIEW & LIVE TOTAL BADGES
  // ==========================================================================
  function renderReceipt() {
    const paper = document.getElementById('receiptPaper');
    if (!paper) return;

    const isPro = isProActive();
    const p = appState.profile;
    const pt = appState.patient;

    // Calculate itemized totals
    let grandTotal = 0;
    const itemsHtml = (pt.items || []).map((item, idx) => {
      const q = Math.max(1, parseInt(item.qty, 10) || 1);
      const pr = Math.max(0, parseInt(item.price, 10) || 0);
      const sub = q * pr;
      grandTotal += sub;

      return `
        <tr class="border-b border-dashed border-slate-200 text-[11px] sm:text-xs text-slate-900">
          <td class="py-2 pr-1.5 text-left font-medium text-slate-900 break-words leading-snug">
            <span class="text-slate-400 font-mono-num text-[10px] mr-0.5">${idx + 1}.</span>
            ${escapeHtml(item.name || 'Tindakan/Obat')}
          </td>
          <td class="py-2 px-1 text-center font-mono-num font-medium text-slate-900 whitespace-nowrap">${q}</td>
          <td class="py-2 px-1 text-right font-mono-num text-slate-800 whitespace-nowrap">${formatRupiah(pr)}</td>
          <td class="py-2 pl-1.5 text-right font-mono-num font-bold text-slate-900 whitespace-nowrap">${formatRupiah(sub)}</td>
        </tr>
      `;
    }).join('');

    const formattedTotal = formatRupiah(grandTotal);
    const terbilangText = terbilang(grandTotal);

    // Update live totals in mobile sticky tab bar & form footer
    const mobileTotalBadge = document.getElementById('mobileTabTotalBadge');
    if (mobileTotalBadge) {
      mobileTotalBadge.textContent = formattedTotal;
    }
    const formRunningTotal = document.getElementById('formRunningTotal');
    if (formRunningTotal) {
      formRunningTotal.textContent = formattedTotal;
    }

    // Dynamic Watermark: Only visible if NOT PRO
    const watermarkHtml = !isPro ? `
      <div class="watermark-overlay">
        ${Array(7).fill(0).map(() => `
          <div class="watermark-text-row">
            CONTOH STRUK - BELUM AKTIF<br>
            <span class="text-[11px] tracking-normal font-bold opacity-80">(Aktivasi Rp35.000 via WA 085176852680)</span>
          </div>
        `).join('')}
      </div>
    ` : '';

    // Clinic Logo Handling
    let logoHtml = '';
    if (isPro && p.logoBase64) {
      logoHtml = `
        <img src="${p.logoBase64}" alt="Logo Klinik" class="w-12 h-12 sm:w-14 sm:h-14 object-contain rounded-lg border border-slate-200 p-0.5 flex-shrink-0" />
      `;
    } else {
      logoHtml = `
        <div class="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-slate-100 text-slate-900 flex items-center justify-center font-bold border border-slate-300 flex-shrink-0">
          <svg class="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 10.5h-5.5V5c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v5.5H5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h5.5V19c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-5.5H19c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z"/>
          </svg>
        </div>
      `;
    }

    // Stempel representation: Unlocked in PRO, locked badge in FREE
    let stampHtml = '';
    if (isPro) {
      stampHtml = `
        <div class="stamp-container absolute -top-5 -left-4 w-24 h-24 sm:w-28 sm:h-28 pointer-events-none z-10 opacity-90">
          ${generateStampSvg(p.stampColor, p.clinicName, p.sipb)}
        </div>
      `;
    } else {
      stampHtml = `
        <div class="absolute -top-3 -left-2 px-2 py-1 rounded-lg border border-dashed border-red-300 bg-red-50/90 text-red-700 text-[9px] font-bold z-10 flex items-center gap-1 whitespace-nowrap">
          <svg class="w-3 h-3 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
          STEMPEL KHUSUS PRO
        </div>
      `;
    }

    // Midwife Signature Drawing
    const signatureImgHtml = appState.signatureDataUrl ? `
      <img src="${appState.signatureDataUrl}" alt="Tanda Tangan" class="h-14 sm:h-16 max-w-[140px] sm:max-w-[150px] object-contain relative z-0" />
    ` : `
      <div class="h-14 sm:h-16 flex items-center justify-center text-slate-400 italic text-[11px] font-serif border border-dashed border-slate-200 rounded px-3">
        (Belum Ditandatangani)
      </div>
    `;

    // Render crisp monochrome receipt template
    paper.innerHTML = `
      ${watermarkHtml}

      <!-- Header Klinik -->
      <div class="relative z-10 pb-3 border-b-2 border-slate-900">
        <div class="flex items-center gap-3">
          ${logoHtml}
          <div class="flex-1 min-w-0">
            <h1 class="text-xs sm:text-sm font-extrabold uppercase text-slate-900 leading-tight tracking-wide break-words">
              ${escapeHtml(p.clinicName || 'PRAKTIK MANDIRI BIDAN')}
            </h1>
            <p class="text-[10px] sm:text-[11px] font-bold text-slate-900 tracking-tight mt-0.5 break-words">
              ${escapeHtml(p.sipb ? 'SIPB: ' + p.sipb : 'IZIN PRAKTIK RESMI')}
            </p>
            <p class="text-[10px] text-slate-600 leading-tight mt-0.5 break-words">
              ${escapeHtml(p.address || 'Alamat Praktik')}
            </p>
            ${p.phone ? `<p class="text-[10px] text-slate-600 font-mono-num">Telp/WA: ${escapeHtml(p.phone)}</p>` : ''}
          </div>
        </div>
      </div>

      <!-- Title & Document Info -->
      <div class="relative z-10 py-3 border-b border-dashed border-slate-300">
        <div class="flex items-center justify-between gap-2">
          <div class="bg-slate-100 text-slate-900 text-[10px] font-black px-2 py-0.5 rounded tracking-wider uppercase border border-slate-300 whitespace-nowrap">
            KWITANSI RESMI
          </div>
          <span class="text-[10px] font-mono-num font-bold text-slate-700 truncate">
            ${escapeHtml(pt.notaNumber || 'NOT-000000')}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-x-2.5 gap-y-1.5 mt-2.5 text-[11px]">
          <div class="min-w-0">
            <span class="text-slate-500 block text-[9px] uppercase tracking-wider font-semibold">Tanggal Periksa</span>
            <span class="font-bold text-slate-900 block truncate">${formatIndoDate(pt.examDate)}</span>
          </div>
          <div class="min-w-0">
            <span class="text-slate-500 block text-[9px] uppercase tracking-wider font-semibold">Nama Pasien</span>
            <span class="font-bold text-slate-900 block truncate">${escapeHtml(pt.patientName || '-')}</span>
          </div>
          <div class="min-w-0">
            <span class="text-slate-500 block text-[9px] uppercase tracking-wider font-semibold">Usia Pasien</span>
            <span class="font-bold text-slate-900 block truncate">${escapeHtml(pt.patientAge || '-')}</span>
          </div>
          <div class="min-w-0">
            <span class="text-slate-500 block text-[9px] uppercase tracking-wider font-semibold">Layanan / Diagnosa</span>
            <span class="font-bold text-slate-900 block truncate">${escapeHtml(pt.serviceType || 'Pemeriksaan Umum')}</span>
          </div>
        </div>
      </div>

      <!-- Itemized Cost Table -->
      <div class="relative z-10 py-3">
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b-2 border-slate-900 text-[9.5px] sm:text-[10px] uppercase font-bold text-slate-700 tracking-wider">
              <th class="py-1.5 pr-1.5 text-left">Rincian</th>
              <th class="py-1.5 px-1 text-center w-7">Qty</th>
              <th class="py-1.5 px-1 text-right whitespace-nowrap">Tarif</th>
              <th class="py-1.5 pl-1.5 text-right whitespace-nowrap">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml || '<tr><td colspan="4" class="py-4 text-center text-xs text-slate-400 italic">Belum ada rincian tindakan</td></tr>'}
          </tbody>
        </table>
      </div>

      <!-- Total & Terbilang -->
      <div class="relative z-10 pt-2.5 pb-3 border-t-2 border-slate-900">
        <div class="flex items-baseline justify-between gap-2">
          <span class="text-xs font-black uppercase text-slate-900 tracking-wider">TOTAL TAGIHAN</span>
          <span class="text-base font-black font-mono-num text-slate-900 whitespace-nowrap">${formattedTotal}</span>
        </div>

        <!-- Terbilang Box -->
        <div class="mt-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[10.5px]">
          <span class="text-slate-500 font-bold block text-[9px] uppercase tracking-wider">Terbilang:</span>
          <span class="italic font-bold text-slate-900 leading-snug">
            "${terbilangText}"
          </span>
        </div>
      </div>

      <!-- Signature & Official Stamp Section -->
      <div class="relative z-10 pt-3 pb-2 border-t border-dashed border-slate-300">
        <div class="flex justify-between items-end gap-2">
          <!-- Status Pill -->
          <div class="text-[10px] text-slate-500 max-w-[115px] leading-tight pb-1">
            <span class="inline-block px-2 py-0.5 rounded text-[9px] font-bold whitespace-nowrap ${isPro ? 'bg-slate-100 text-slate-900 border border-slate-300' : 'bg-amber-50 text-amber-900 border border-amber-200'}">
              ${isPro ? 'KWITANSI LUNAS' : 'STATUS TRIAL'}
            </span>
          </div>

          <!-- Signature + Stamp Overlay Area -->
          <div class="text-right min-w-0">
            <p class="text-[10px] text-slate-600 font-medium">
              ${escapeHtml(p.city || 'Kota')}, ${formatIndoDate(pt.examDate)}
            </p>
            <p class="text-[10px] font-bold text-slate-900 mb-1">
              Bidan / Tenaga Medis Pemeriksa
            </p>

            <div class="relative inline-flex items-center justify-end min-h-[60px] sm:min-h-[64px] min-w-[136px] sm:min-w-[150px]">
              ${signatureImgHtml}
              ${stampHtml}
            </div>

            <p class="text-[11px] font-black text-slate-900 underline underline-offset-2 mt-1 break-words">
              ${escapeHtml(p.bidanName || p.clinicName || 'Bidan Praktik Mandiri')}
            </p>
            <p class="text-[9px] text-slate-700 font-mono-num font-medium mt-0.5">
              ${escapeHtml(p.sipb ? 'SIPB: ' + p.sipb : '')}
            </p>
          </div>
        </div>
      </div>

      <!-- Footer Disclaimer -->
      <div class="relative z-10 mt-3 pt-2 border-t border-slate-200 text-center">
        <p class="text-[9px] font-semibold text-slate-600 tracking-tight">
          Kwitansi ini sah sebagai bukti pembayaran layanan kesehatan / klaim medis.
        </p>
        <p class="text-[8px] text-slate-400 font-mono-num mt-0.5">
          Dicetak otomatis via StrukinAja &bull; ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
        </p>
      </div>
    `;

    updateProStatusUI();
  }

  // ==========================================================================
  // 10. UPDATE PRO BADGES & LOCKED FEATURE STATES
  // ==========================================================================
  function updateProStatusUI() {
    const isPro = isProActive();

    // Top Header Badge
    const headerBadge = document.getElementById('headerProBadge');
    if (headerBadge) {
      if (isPro) {
        headerBadge.className = "inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200 transition";
        headerBadge.innerHTML = `
          <svg class="w-3.5 h-3.5 text-teal-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
          <span>PRO Aktif</span>
        `;
      } else {
        headerBadge.className = "inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition cursor-pointer";
        headerBadge.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0"></span>
          <span>Versi Trial</span>
        `;
      }
    }

    // License Card Status
    const licenseStatusCard = document.getElementById('licenseStatusCard');
    const licenseStatusText = document.getElementById('licenseStatusText');
    const licenseClinicNameDisplay = document.getElementById('licenseClinicNameDisplay');
    const licenseInputContainer = document.getElementById('licenseInputContainer');

    if (licenseStatusCard && licenseStatusText) {
      if (isPro) {
        licenseStatusCard.className = "p-4 rounded-xl border border-teal-200 bg-teal-50/70 text-teal-900";
        licenseStatusText.innerHTML = `
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-teal-600 flex-shrink-0"></span>
            <span class="font-bold text-sm text-teal-900">Lisensi PRO Aktif Permanen</span>
          </div>
          <p class="text-xs text-teal-800 mt-1 leading-relaxed">
            Fitur Logo Klinik Resmi dan Stempel Digital Otomatis telah terbuka tanpa watermark.
          </p>
        `;
        if (licenseInputContainer) licenseInputContainer.classList.add('hidden');
      } else {
        licenseStatusCard.className = "p-4 rounded-xl border border-amber-200 bg-amber-50/70 text-amber-900";
        licenseStatusText.innerHTML = `
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0"></span>
            <span class="font-bold text-sm text-amber-900">Versi Uji Coba (Terkunci)</span>
          </div>
          <p class="text-xs text-amber-800 mt-1 leading-relaxed">
            Kwitansi masih menampilkan watermark contoh. Aktifkan lisensi PRO sekali bayar Rp 35.000 untuk selamanya.
          </p>
        `;
        if (licenseInputContainer) licenseInputContainer.classList.remove('hidden');
      }
    }

    if (licenseClinicNameDisplay) {
      licenseClinicNameDisplay.textContent = appState.profile.clinicName || '(Belum mengisi Nama Praktik)';
    }

    // Logo Upload Locking
    const logoInput = document.getElementById('logoInput');
    const logoLockBadge = document.getElementById('logoLockBadge');
    if (logoInput && logoLockBadge) {
      if (isPro) {
        logoInput.disabled = false;
        logoLockBadge.classList.add('hidden');
      } else {
        logoInput.disabled = true;
        logoLockBadge.classList.remove('hidden');
      }
    }

    // Stempel Color Selector Locking
    const stampLockBadge = document.getElementById('stampLockBadge');
    if (stampLockBadge) {
      if (isPro) {
        stampLockBadge.classList.add('hidden');
      } else {
        stampLockBadge.classList.remove('hidden');
      }
    }
  }

  // ==========================================================================
  // 11. FORM INPUT BINDINGS
  // ==========================================================================
  function bindProfileInputs() {
    const fields = [
      { id: 'profileClinicName', prop: 'clinicName' },
      { id: 'profileSipb', prop: 'sipb' },
      { id: 'profileAddress', prop: 'address' },
      { id: 'profilePhone', prop: 'phone' },
      { id: 'profileBidanName', prop: 'bidanName' },
      { id: 'profileCity', prop: 'city' }
    ];

    fields.forEach(({ id, prop }) => {
      const el = document.getElementById(id);
      if (el) {
        el.value = appState.profile[prop] || '';
        el.addEventListener('input', (e) => {
          appState.profile[prop] = e.target.value;
          saveProfileToStorage();
          renderReceipt();
        });
      }
    });

    // Stamp Color Selection
    const stampRadios = document.querySelectorAll('input[name="stampColor"]');
    stampRadios.forEach((radio) => {
      if (radio.value === appState.profile.stampColor) {
        radio.checked = true;
      }
      radio.addEventListener('change', (e) => {
        if (!isProActive()) {
          showToast("Pilihan Stempel Digital adalah fitur PRO. Silakan lakukan aktivasi terlebih dahulu.", "warning");
          stampRadios.forEach(r => r.checked = (r.value === appState.profile.stampColor));
          return;
        }
        appState.profile.stampColor = e.target.value;
        saveProfileToStorage();
        renderReceipt();
      });
    });

    // Logo Upload with Base64 Conversion
    const logoInput = document.getElementById('logoInput');
    const logoRemoveBtn = document.getElementById('logoRemoveBtn');
    const logoPreviewImg = document.getElementById('logoPreviewImg');
    const logoPlaceholder = document.getElementById('logoPlaceholder');

    function updateLogoPreviewUI() {
      if (appState.profile.logoBase64) {
        if (logoPreviewImg) {
          logoPreviewImg.src = appState.profile.logoBase64;
          logoPreviewImg.classList.remove('hidden');
        }
        if (logoPlaceholder) logoPlaceholder.classList.add('hidden');
        if (logoRemoveBtn) logoRemoveBtn.classList.remove('hidden');
      } else {
        if (logoPreviewImg) {
          logoPreviewImg.src = '';
          logoPreviewImg.classList.add('hidden');
        }
        if (logoPlaceholder) logoPlaceholder.classList.remove('hidden');
        if (logoRemoveBtn) logoRemoveBtn.classList.add('hidden');
      }
    }

    updateLogoPreviewUI();

    if (logoInput) {
      logoInput.addEventListener('change', (e) => {
        if (!isProActive()) {
          showToast("Fitur upload logo klinik khusus untuk StrukinAja PRO.", "warning");
          logoInput.value = '';
          return;
        }

        const file = e.target.files && e.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
          showToast("Ukuran logo maksimal 2MB.", "error");
          logoInput.value = '';
          return;
        }

        const reader = new FileReader();
        reader.onload = function (event) {
          appState.profile.logoBase64 = event.target.result;
          saveProfileToStorage();
          updateLogoPreviewUI();
          renderReceipt();
          showToast("Logo klinik berhasil disimpan.", "success");
        };
        reader.readAsDataURL(file);
      });
    }

    if (logoRemoveBtn) {
      logoRemoveBtn.addEventListener('click', () => {
        appState.profile.logoBase64 = "";
        if (logoInput) logoInput.value = '';
        saveProfileToStorage();
        updateLogoPreviewUI();
        renderReceipt();
      });
    }
  }

  function syncPatientInputsFromState() {
    const fields = [
      { id: 'patientNotaNumber', prop: 'notaNumber' },
      { id: 'patientExamDate', prop: 'examDate' },
      { id: 'patientName', prop: 'patientName' },
      { id: 'patientAge', prop: 'patientAge' },
      { id: 'patientServiceType', prop: 'serviceType' }
    ];
    fields.forEach(({ id, prop }) => {
      const el = document.getElementById(id);
      if (el) el.value = appState.patient[prop] || '';
    });
  }

  function bindPatientInputs() {
    const fields = [
      { id: 'patientNotaNumber', prop: 'notaNumber' },
      { id: 'patientExamDate', prop: 'examDate' },
      { id: 'patientName', prop: 'patientName' },
      { id: 'patientAge', prop: 'patientAge' },
      { id: 'patientServiceType', prop: 'serviceType' }
    ];

    syncPatientInputsFromState();

    fields.forEach(({ id, prop }) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', (e) => {
          appState.patient[prop] = e.target.value;
          renderReceipt();
        });
      }
    });

    // Refresh Nota Number button
    const refreshNotaBtn = document.getElementById('refreshNotaBtn');
    if (refreshNotaBtn) {
      refreshNotaBtn.addEventListener('click', () => {
        const newNota = generateNotaNumber();
        appState.patient.notaNumber = newNota;
        const notaInput = document.getElementById('patientNotaNumber');
        if (notaInput) notaInput.value = newNota;
        renderReceipt();
      });
    }

    // Quick Service Pills (for fast midwife diagnosis entry)
    const quickPills = document.querySelectorAll('.service-pill');
    quickPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const val = pill.getAttribute('data-service');
        if (val) {
          appState.patient.serviceType = val;
          const serviceInput = document.getElementById('patientServiceType');
          if (serviceInput) serviceInput.value = val;
          renderReceipt();
        }
      });
    });
  }

  // ==========================================================================
  // 12. DYNAMIC ITEMS MANAGEMENT (MOBILE MINI-CARDS + DESKTOP GRID)
  // ==========================================================================
  function renderDynamicItemRows() {
    const container = document.getElementById('itemsContainer');
    if (!container) return;

    container.innerHTML = '';

    appState.patient.items.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = "p-3 sm:p-2.5 bg-slate-50/80 sm:bg-white border border-slate-200 rounded-xl space-y-2.5 sm:space-y-0 sm:grid sm:grid-cols-12 sm:gap-2.5 sm:items-center transition hover:border-teal-300";
      row.innerHTML = `
        <!-- Mobile Row 1: Service Name + Delete Button (flattens to grid on sm+) -->
        <div class="flex items-end gap-2 sm:contents">
          <div class="flex-1 min-w-0 sm:col-span-6">
            <label class="block sm:hidden text-[11px] font-semibold text-slate-500 mb-1">
              Nama Layanan / Obat
            </label>
            <input
              type="text"
              placeholder="Nama Tindakan atau Obat"
              value="${escapeHtml(item.name)}"
              data-index="${index}"
              data-field="name"
              class="item-field w-full min-h-[44px] px-3 py-2 text-base lg:text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 font-medium text-slate-900 placeholder-slate-400 transition"
            />
          </div>
          <button
            type="button"
            data-index="${index}"
            aria-label="Hapus baris tindakan"
            title="Hapus Baris"
            class="delete-item-btn sm:col-span-1 sm:order-last sm:justify-self-end w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition flex-shrink-0"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>

        <!-- Mobile Row 2: Qty + Price Side-by-Side (flattens to grid on sm+) -->
        <div class="grid grid-cols-12 gap-2.5 sm:contents">
          <div class="col-span-4 sm:col-span-2">
            <label class="block sm:hidden text-[11px] font-semibold text-slate-500 mb-1">
              Qty
            </label>
            <input
              type="number"
              inputmode="numeric"
              min="1"
              value="${item.qty}"
              data-index="${index}"
              data-field="qty"
              placeholder="1"
              class="item-field w-full min-h-[44px] px-2.5 py-2 text-base lg:text-sm text-center rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 font-mono-num font-semibold text-slate-900 transition"
            />
          </div>
          <div class="col-span-8 sm:col-span-3">
            <label class="block sm:hidden text-[11px] font-semibold text-slate-500 mb-1">
              Tarif (Rp)
            </label>
            <input
              type="number"
              inputmode="numeric"
              min="0"
              step="1000"
              value="${item.price}"
              data-index="${index}"
              data-field="price"
              placeholder="0"
              class="item-field w-full min-h-[44px] px-3 py-2 text-base lg:text-sm text-right rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 font-mono-num font-semibold text-slate-900 transition"
            />
          </div>
        </div>
      `;
      container.appendChild(row);
    });

    // Attach listeners to input fields
    container.querySelectorAll('.item-field').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'), 10);
        const field = e.target.getAttribute('data-field');
        if (!appState.patient.items[idx]) return;

        if (field === 'qty') {
          appState.patient.items[idx].qty = Math.max(1, parseInt(e.target.value, 10) || 1);
        } else if (field === 'price') {
          appState.patient.items[idx].price = Math.max(0, parseInt(e.target.value, 10) || 0);
        } else {
          appState.patient.items[idx].name = e.target.value;
        }
        renderReceipt();
      });
    });

    // Attach delete listeners
    container.querySelectorAll('.delete-item-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        if (appState.patient.items.length <= 1) {
          appState.patient.items[0] = { name: "", qty: 1, price: 0 };
        } else {
          appState.patient.items.splice(idx, 1);
        }
        renderDynamicItemRows();
        renderReceipt();
      });
    });
  }

  function setupItemControls() {
    const addItemBtn = document.getElementById('addItemBtn');
    if (addItemBtn) {
      addItemBtn.addEventListener('click', () => {
        appState.patient.items.push({ name: "", qty: 1, price: 0 });
        renderDynamicItemRows();
        renderReceipt();
        setTimeout(() => {
          const container = document.getElementById('itemsContainer');
          if (container && container.lastElementChild) {
            const firstInput = container.lastElementChild.querySelector('input');
            if (firstInput) firstInput.focus();
          }
        }, 50);
      });
    }

    // Quick Add Service Buttons (Thumb-friendly 44px min height)
    const quickServiceContainer = document.getElementById('quickServiceList');
    if (quickServiceContainer) {
      quickServiceContainer.innerHTML = QUICK_SERVICES.map((srv, i) => `
        <button
          type="button"
          data-qs-index="${i}"
          class="quick-srv-chip inline-flex items-center gap-2 min-h-[44px] px-3 py-2 rounded-xl text-xs font-medium bg-white text-slate-700 border border-slate-200 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-900 transition text-left"
        >
          <span class="font-semibold">+ ${escapeHtml(srv.name)}</span>
          <span class="text-[11px] text-teal-700 font-mono-num font-semibold whitespace-nowrap">${formatRupiah(srv.price)}</span>
        </button>
      `).join('');

      quickServiceContainer.querySelectorAll('.quick-srv-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-qs-index'), 10);
          const template = QUICK_SERVICES[idx];
          if (template) {
            if (appState.patient.items.length === 1 && !appState.patient.items[0].name && appState.patient.items[0].price === 0) {
              appState.patient.items[0] = { ...template, qty: 1 };
            } else {
              appState.patient.items.push({ ...template, qty: 1 });
            }
            renderDynamicItemRows();
            renderReceipt();
          }
        });
      });
    }
  }

  // ==========================================================================
  // 13. TOUCH & POINTER SIGNATURE CANVAS (SHARP DPR + NO SCROLL)
  // ==========================================================================
  function setupSignatureCanvas() {
    const canvas = document.getElementById('signatureCanvas');
    if (!canvas) return;

    canvas.style.touchAction = 'none';
    const ctx = canvas.getContext('2d');
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let lastCssWidth = 0;
    let lastCssHeight = 0;
    let activePointerId = null;

    function configureStroke() {
      ctx.strokeStyle = '#1e3a8a'; // Deep blue ballpoint ink
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    function resizeCanvas(force = false) {
      const rect = canvas.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);

      // Do not wipe canvas when hidden (e.g. mobile preview tab)
      if (width === 0 || height === 0) return;
      if (!force && Math.abs(width - lastCssWidth) <= 2 && Math.abs(height - lastCssHeight) <= 2) {
        return;
      }

      lastCssWidth = width;
      lastCssHeight = height;

      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      configureStroke();

      if (appState.signatureDataUrl) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, width, height);
        };
        img.src = appState.signatureDataUrl;
      }
    }

    resizeSignatureCanvasFn = resizeCanvas;

    setTimeout(() => resizeCanvas(true), 80);
    window.addEventListener('resize', () => resizeCanvas(false));

    function getCoords(e) {
      const rect = canvas.getBoundingClientRect();
      let clientX, clientY;
      if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    }

    function beginStroke(coords) {
      // Ensure canvas buffer is initialized if it was hidden earlier
      if (lastCssWidth === 0) {
        resizeCanvas(true);
      }
      isDrawing = true;
      lastX = coords.x;
      lastY = coords.y;

      configureStroke();
      ctx.beginPath();
      ctx.arc(lastX, lastY, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = '#1e3a8a';
      ctx.fill();
    }

    function continueStroke(coords) {
      if (!isDrawing) return;
      configureStroke();
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      const midX = (lastX + coords.x) / 2;
      const midY = (lastY + coords.y) / 2;
      ctx.quadraticCurveTo(lastX, lastY, midX, midY);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();

      lastX = coords.x;
      lastY = coords.y;
    }

    function finishStroke() {
      if (!isDrawing) return;
      isDrawing = false;
      activePointerId = null;
      const dataUrl = canvas.toDataURL('image/png');
      appState.signatureDataUrl = dataUrl;

      if (appState.saveSignatureForNext) {
        safeStorageSet(STORAGE_KEY_SAVED_SIG, dataUrl);
      }

      renderReceipt();
    }

    // Unified Pointer Events for crisp finger, stylus & mouse tracking
    if (window.PointerEvent) {
      canvas.addEventListener('pointerdown', (e) => {
        if (e.button && e.button !== 0) return;
        e.preventDefault();
        activePointerId = e.pointerId;
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch (_) {}
        beginStroke(getCoords(e));
      });

      canvas.addEventListener('pointermove', (e) => {
        if (!isDrawing || (activePointerId !== null && e.pointerId !== activePointerId)) return;
        e.preventDefault();
        continueStroke(getCoords(e));
      });

      canvas.addEventListener('pointerup', (e) => {
        if (activePointerId !== null && e.pointerId !== activePointerId) return;
        finishStroke();
      });

      canvas.addEventListener('pointercancel', finishStroke);

      // Extra iOS Safari safeguard against page scroll while touching canvas
      canvas.addEventListener('touchmove', (e) => {
        if (isDrawing) e.preventDefault();
      }, { passive: false });
    } else {
      // Fallback for older browsers without PointerEvent
      canvas.addEventListener('touchstart', (e) => { e.preventDefault(); beginStroke(getCoords(e)); }, { passive: false });
      canvas.addEventListener('touchmove', (e) => { e.preventDefault(); continueStroke(getCoords(e)); }, { passive: false });
      canvas.addEventListener('touchend', finishStroke);
      canvas.addEventListener('touchcancel', finishStroke);

      canvas.addEventListener('mousedown', (e) => { e.preventDefault(); beginStroke(getCoords(e)); });
      canvas.addEventListener('mousemove', (e) => { if (isDrawing) { e.preventDefault(); continueStroke(getCoords(e)); } });
      canvas.addEventListener('mouseup', finishStroke);
      canvas.addEventListener('mouseleave', finishStroke);
    }

    // Clear Canvas Button
    const clearBtn = document.getElementById('clearSigBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(dpr, dpr);
        configureStroke();

        appState.signatureDataUrl = "";
        safeStorageRemove(STORAGE_KEY_SAVED_SIG);
        renderReceipt();
      });
    }

    // Save Signature Checkbox
    const saveSigCheck = document.getElementById('saveSigCheckbox');
    if (saveSigCheck) {
      saveSigCheck.checked = appState.saveSignatureForNext;
      saveSigCheck.addEventListener('change', (e) => {
        appState.saveSignatureForNext = e.target.checked;
        if (e.target.checked && appState.signatureDataUrl) {
          safeStorageSet(STORAGE_KEY_SAVED_SIG, appState.signatureDataUrl);
        } else if (!e.target.checked) {
          safeStorageRemove(STORAGE_KEY_SAVED_SIG);
        }
      });
    }
  }

  // ==========================================================================
  // 14. HIGH RESOLUTION EXPORT (FIXED PRINT WIDTH + SCALE 3x HD)
  // ==========================================================================
  function setupExportActions() {
    const downloadBtn = document.getElementById('downloadImgBtn');
    const printBtn = document.getElementById('printReceiptBtn');
    const shareWaBtn = document.getElementById('shareWaBtn');
    const newTransactionBtn = document.getElementById('newTransactionBtn');

    if (downloadBtn) {
      downloadBtn.addEventListener('click', async () => {
        const receiptEl = document.getElementById('receiptPaper');
        if (!receiptEl) return;

        if (typeof html2canvas !== 'function') {
          showToast("Library html2canvas belum siap. Cek koneksi internet Anda.", "error");
          return;
        }

        const originalBtnHtml = downloadBtn.innerHTML;
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = `
          <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
          <span>Memproses Gambar HD...</span>
        `;

        // Offscreen fixed print-ready wrapper (420px) so 360px phones still export full crisp HD width
        let exportStage = null;
        try {
          exportStage = document.createElement('div');
          exportStage.style.position = 'fixed';
          exportStage.style.left = '-9999px';
          exportStage.style.top = '0';
          exportStage.style.width = '420px';
          exportStage.style.backgroundColor = '#ffffff';
          exportStage.style.zIndex = '-1';
          exportStage.style.pointerEvents = 'none';

          const clonedReceipt = receiptEl.cloneNode(true);
          clonedReceipt.removeAttribute('id');

          // Ensure SVG textPath IDs are unique inside the offscreen export clone
          clonedReceipt.querySelectorAll('path[id^="stamp"]').forEach((pathEl) => {
            const oldId = pathEl.getAttribute('id');
            const newId = oldId + '_export';
            pathEl.setAttribute('id', newId);
            clonedReceipt.querySelectorAll(`textPath[href="#${oldId}"]`).forEach((tp) => {
              tp.setAttribute('href', `#${newId}`);
            });
          });

          clonedReceipt.style.width = '420px';
          clonedReceipt.style.maxWidth = '420px';
          clonedReceipt.style.minWidth = '420px';
          clonedReceipt.style.margin = '0';
          clonedReceipt.style.padding = '22px';
          clonedReceipt.style.borderRadius = '0px';
          clonedReceipt.style.boxShadow = 'none';
          clonedReceipt.style.border = '1px solid #e2e8f0';

          exportStage.appendChild(clonedReceipt);
          document.body.appendChild(exportStage);

          // Wait one frame for layout & SVG textPath calculations
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

          const canvas = await html2canvas(clonedReceipt, {
            scale: 3,
            width: 420,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
          });

          const patientClean = (appState.patient.patientName || 'Pasien').replace(/[^a-zA-Z0-9]/g, '_');
          const notaClean = (appState.patient.notaNumber || 'Nota').replace(/[^a-zA-Z0-9]/g, '_');
          const filename = `Struk_${patientClean}_${notaClean}.png`;

          const link = document.createElement('a');
          link.download = filename;
          link.href = canvas.toDataURL('image/png');
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          showToast("Kwitansi resolusi tinggi (HD 3x) berhasil diunduh.", "success");
        } catch (err) {
          console.error("Export error:", err);
          showToast("Gagal mengunduh gambar: " + err.message, "error");
        } finally {
          if (exportStage && exportStage.parentNode) {
            exportStage.parentNode.removeChild(exportStage);
          }
          downloadBtn.disabled = false;
          downloadBtn.innerHTML = originalBtnHtml;
        }
      });
    }

    // Print Receipt
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        window.print();
      });
    }

    // Share / WhatsApp Text Summary
    if (shareWaBtn) {
      shareWaBtn.addEventListener('click', () => {
        const pt = appState.patient;
        const p = appState.profile;
        let total = 0;
        const itemsList = pt.items.map(it => {
          const q = Math.max(1, parseInt(it.qty, 10) || 1);
          const pr = Math.max(0, parseInt(it.price, 10) || 0);
          const sub = q * pr;
          total += sub;
          return `• ${it.name || 'Tindakan/Obat'} (${q}x) = ${formatRupiah(sub)}`;
        }).join('\n');

        const message = `*KWITANSI RESMI LAYANAN KESEHATAN*\n` +
          `*${p.clinicName || 'Praktik Bidan'}*\n` +
          `No. Nota: ${pt.notaNumber}\n` +
          `Tanggal: ${formatIndoDate(pt.examDate)}\n` +
          `Pasien: ${pt.patientName} (${pt.patientAge})\n` +
          `Layanan: ${pt.serviceType}\n\n` +
          `*Rincian Biaya:*\n${itemsList}\n\n` +
          `*TOTAL: ${formatRupiah(total)}*\n` +
          `_Terbilang: ${terbilang(total)}_\n\n` +
          `Status: *LUNAS*\n` +
          `Terima kasih atas kepercayaannya. Semoga lekas pulih dan sehat selalu! 🙏`;

        const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(waUrl, '_blank');
      });
    }

    // New Patient Transaction
    if (newTransactionBtn) {
      newTransactionBtn.addEventListener('click', () => {
        if (!confirm("Buat transaksi baru? Rincian pasien dan tindakan saat ini akan di-reset (Profil Praktik tetap tersimpan).")) {
          return;
        }

        appState.patient = {
          notaNumber: generateNotaNumber(),
          examDate: new Date().toISOString().split('T')[0],
          patientName: "",
          patientAge: "",
          serviceType: "Pemeriksaan Kehamilan (ANC)",
          items: [{ name: "", qty: 1, price: 0 }]
        };

        syncPatientInputsFromState();
        renderDynamicItemRows();

        if (!appState.saveSignatureForNext) {
          appState.signatureDataUrl = "";
          const canvas = document.getElementById('signatureCanvas');
          if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const dpr = Math.min(window.devicePixelRatio || 1, 3);
            ctx.scale(dpr, dpr);
          }
        }

        renderReceipt();

        if (window.innerWidth < 1024) {
          switchMobileTab('form', { scrollToTop: true });
        }
      });
    }
  }

  // ==========================================================================
  // 15. PRO ACTIVATION & WHATSAPP PURCHASE FLOW (PRESERVED)
  // ==========================================================================
  function setupLicenseActivation() {
    const buyWaBtn = document.getElementById('buyLicenseWaBtn');
    const activateBtn = document.getElementById('activateLicenseBtn');
    const licenseInput = document.getElementById('licenseKeyInput');
    const headerBadge = document.getElementById('headerProBadge');

    if (headerBadge) {
      headerBadge.addEventListener('click', () => {
        if (!isProActive()) {
          if (window.innerWidth < 1024) {
            switchMobileTab('form', { scrollToTop: false });
          }
          const proCard = document.getElementById('proLicenseSection');
          if (proCard) {
            setTimeout(() => {
              proCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
              proCard.classList.add('ring-2', 'ring-teal-500');
              setTimeout(() => proCard.classList.remove('ring-2', 'ring-teal-500'), 1400);
            }, 60);
          }
        }
      });
    }

    if (buyWaBtn) {
      buyWaBtn.addEventListener('click', () => {
        const clinicName = (appState.profile.clinicName || '').trim();
        if (!clinicName) {
          showToast("Mohon isi Nama Praktik Bidan terlebih dahulu pada form di atas.", "warning");
          const clinicInput = document.getElementById('profileClinicName');
          if (clinicInput) clinicInput.focus();
          return;
        }

        const msg = `Halo Admin, saya ingin beli Kode Aktivasi StrukinAja PRO (Rp35.000) untuk Nama Praktik: ${clinicName}`;
        const url = `https://wa.me/${ADMIN_WA_PHONE}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
      });
    }

    function processActivation() {
      const code = (licenseInput ? licenseInput.value : '').trim().toUpperCase();
      const clinicName = (appState.profile.clinicName || '').trim();

      if (!clinicName) {
        showToast("Nama Praktik Bidan wajib diisi sebelum aktivasi.", "error");
        return;
      }

      if (!code) {
        showToast("Silakan masukkan 6 digit Kode Aktivasi.", "warning");
        return;
      }

      const expectedKey = generateLicenseKey(clinicName);

      if (code === expectedKey) {
        saveLicenseToStorage(code);
        renderReceipt();
        showToast("Selamat! StrukinAja PRO berhasil diaktifkan secara permanen.", "success");
      } else {
        showToast("Kode aktivasi tidak valid untuk Nama Praktik ini. Pastikan penulisan nama klinik sama persis.", "error");
      }
    }

    if (activateBtn) {
      activateBtn.addEventListener('click', processActivation);
    }

    if (licenseInput) {
      licenseInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') processActivation();
      });
      licenseInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      });
    }
  }

  // ==========================================================================
  // 16. SECRET ADMIN PANEL (5 CLICKS ON HEADER LOGO / CTRL+SHIFT+A)
  // ==========================================================================
  function setupSecretAdminPanel() {
    const adminTrigger = document.getElementById('adminSecretTrigger');
    const adminModal = document.getElementById('adminModal');
    const adminPinStep = document.getElementById('adminPinStep');
    const adminGeneratorStep = document.getElementById('adminGeneratorStep');
    const adminPinInput = document.getElementById('adminPinInput');
    const adminPinSubmitBtn = document.getElementById('adminPinSubmitBtn');
    const closeAdminModalBtn = document.getElementById('closeAdminModalBtn');

    const adminClinicInput = document.getElementById('adminClinicInput');
    const adminGeneratedKey = document.getElementById('adminGeneratedKey');
    const copyAdminKeyBtn = document.getElementById('copyAdminKeyBtn');
    const sendAdminWaBtn = document.getElementById('sendAdminWaBtn');

    if (!adminTrigger) return;

    let tapCount = 0;
    let tapTimer = null;

    function handleTap(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      tapCount++;
      clearTimeout(tapTimer);

      adminTrigger.classList.add('scale-95');
      setTimeout(() => adminTrigger.classList.remove('scale-95'), 120);

      if (tapCount >= 5) {
        tapCount = 0;
        clearTimeout(tapTimer);
        openAdminModal();
        return;
      }

      tapTimer = setTimeout(() => {
        tapCount = 0;
      }, 4000);
    }

    adminTrigger.addEventListener('click', handleTap);
    window.handleAdminSecretTap = handleTap;

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) || (e.altKey && (e.key === 'A' || e.key === 'a'))) {
        e.preventDefault();
        openAdminModal();
      }
      if (e.key === 'Escape' && adminModal && (!adminModal.classList.contains('hidden') || adminModal.style.display === 'flex')) {
        closeAdminModal();
      }
    });

    function openAdminModal() {
      if (!adminModal) return;
      adminPinInput.value = '';
      adminPinStep.classList.remove('hidden');
      adminGeneratorStep.classList.add('hidden');
      adminModal.classList.remove('hidden');
      adminModal.style.display = 'flex';
      setTimeout(() => adminPinInput.focus(), 150);
    }

    function closeAdminModal() {
      if (!adminModal) return;
      adminModal.classList.add('hidden');
      adminModal.style.display = 'none';
    }

    window.openAdminModal = openAdminModal;

    if (closeAdminModalBtn) {
      closeAdminModalBtn.addEventListener('click', closeAdminModal);
    }

    if (adminModal) {
      adminModal.addEventListener('click', (e) => {
        if (e.target === adminModal) {
          closeAdminModal();
        }
      });
    }

    function verifyAdminPin() {
      const pin = (adminPinInput.value || '').trim();
      if (pin === ADMIN_PIN) {
        adminPinStep.classList.add('hidden');
        adminGeneratorStep.classList.remove('hidden');
        if (appState.profile.clinicName) {
          adminClinicInput.value = appState.profile.clinicName;
          updateAdminGenerator();
        }
        showToast("Akses Admin terverifikasi.", "success");
      } else {
        showToast("PIN Admin salah.", "error");
        adminPinInput.value = '';
        adminPinInput.focus();
      }
    }

    if (adminPinSubmitBtn) {
      adminPinSubmitBtn.addEventListener('click', verifyAdminPin);
    }
    if (adminPinInput) {
      adminPinInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') verifyAdminPin();
      });
    }

    function updateAdminGenerator() {
      const name = (adminClinicInput.value || '').trim();
      if (!name) {
        adminGeneratedKey.textContent = "------";
        return;
      }
      const key = generateLicenseKey(name);
      adminGeneratedKey.textContent = key;
    }

    if (adminClinicInput) {
      adminClinicInput.addEventListener('input', updateAdminGenerator);
    }

    if (copyAdminKeyBtn) {
      copyAdminKeyBtn.addEventListener('click', () => {
        const key = adminGeneratedKey.textContent.trim();
        if (key && key !== "------") {
          navigator.clipboard.writeText(key).then(() => {
            showToast(`Kode "${key}" berhasil disalin ke clipboard.`, "success");
          }).catch(() => {
            showToast(`Kode: ${key}`, "info");
          });
        }
      });
    }

    if (sendAdminWaBtn) {
      sendAdminWaBtn.addEventListener('click', () => {
        const name = (adminClinicInput.value || '').trim();
        const key = adminGeneratedKey.textContent.trim();
        if (!name || key === "------") {
          showToast("Isi nama klinik pembeli terlebih dahulu.", "warning");
          return;
        }

        const replyMsg = `Halo Bidan/Klinik *${name}*, terima kasih atas pembayarannya! 🙏\n\n` +
          `Berikut adalah *Kode Aktivasi StrukinAja PRO* resmi Anda:\n\n` +
          `👉 *${key}*\n\n` +
          `Cara Aktivasi:\n` +
          `1. Buka aplikasi StrukinAja\n` +
          `2. Pastikan Nama Praktik sudah tertulis persis: "${name}"\n` +
          `3. Masukkan kode di atas pada menu *Aktivasi PRO*\n` +
          `4. Klik *Verifikasi & Aktifkan*\n\n` +
          `Watermark akan hilang seketika dan fitur Logo serta Stempel Resmi akan langsung aktif selamanya. Selamat melayani pasien! 🌸`;

        const waUrl = `https://wa.me/?text=${encodeURIComponent(replyMsg)}`;
        window.open(waUrl, '_blank');
      });
    }
  }

  // ==========================================================================
  // 17. MOBILE STICKY SEGMENTED TAB SWITCHER (< 1024px)
  // ==========================================================================
  function switchMobileTab(tab, options = {}) {
    const { scrollToTop = true } = options;
    appState.activeTab = tab;

    const formSection = document.getElementById('inputSection');
    const previewSection = document.getElementById('previewSection');
    const tabFormBtn = document.getElementById('tabFormBtn');
    const tabPreviewBtn = document.getElementById('tabPreviewBtn');
    const totalBadge = document.getElementById('mobileTabTotalBadge');

    if (!formSection || !previewSection) return;

    if (tab === 'form') {
      // Responsive classes keep both panels visible on desktop (>= 1024px)
      formSection.classList.remove('hidden', 'lg:block');
      previewSection.classList.add('hidden', 'lg:block');

      if (tabFormBtn) {
        tabFormBtn.className = "flex items-center justify-center gap-1.5 min-h-[48px] px-2 py-2 rounded-xl text-xs font-bold bg-teal-600 text-white shadow-sm transition";
        tabFormBtn.setAttribute('aria-pressed', 'true');
      }
      if (tabPreviewBtn) {
        tabPreviewBtn.className = "flex flex-col items-center justify-center min-h-[48px] px-2 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 transition";
        tabPreviewBtn.setAttribute('aria-pressed', 'false');
      }
      if (totalBadge) {
        totalBadge.className = "mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-mono-num font-bold bg-teal-50 text-teal-700 border border-teal-200 leading-none";
      }

      // Re-initialize canvas sizing once form panel is visible
      setTimeout(() => {
        if (typeof resizeSignatureCanvasFn === 'function') {
          resizeSignatureCanvasFn(false);
        }
      }, 60);
    } else {
      formSection.classList.add('hidden', 'lg:block');
      previewSection.classList.remove('hidden', 'lg:block');

      if (tabFormBtn) {
        tabFormBtn.className = "flex items-center justify-center gap-1.5 min-h-[48px] px-2 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 transition";
        tabFormBtn.setAttribute('aria-pressed', 'false');
      }
      if (tabPreviewBtn) {
        tabPreviewBtn.className = "flex flex-col items-center justify-center min-h-[48px] px-2 py-1.5 rounded-xl text-xs font-bold bg-teal-600 text-white shadow-sm transition";
        tabPreviewBtn.setAttribute('aria-pressed', 'true');
      }
      if (totalBadge) {
        totalBadge.className = "mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-mono-num font-bold bg-white/20 text-white border border-white/25 leading-none";
      }

      renderReceipt();
    }

    if (scrollToTop && window.innerWidth < 1024) {
      const workspace = document.getElementById('workspaceSection');
      if (workspace) {
        const y = workspace.getBoundingClientRect().top + window.scrollY - 76;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      }
    }
  }

  function setupMobileTabs() {
    const tabFormBtn = document.getElementById('tabFormBtn');
    const tabPreviewBtn = document.getElementById('tabPreviewBtn');

    if (tabFormBtn) {
      tabFormBtn.addEventListener('click', () => switchMobileTab('form', { scrollToTop: true }));
    }
    if (tabPreviewBtn) {
      tabPreviewBtn.addEventListener('click', () => switchMobileTab('preview', { scrollToTop: true }));
    }
  }

  // ==========================================================================
  // 18. INITIALIZATION
  // ==========================================================================
  function init() {
    loadStateFromStorage();
    setupHeroSection();
    bindProfileInputs();
    bindPatientInputs();
    setupItemControls();
    renderDynamicItemRows();
    setupSignatureCanvas();
    setupExportActions();
    setupLicenseActivation();
    setupSecretAdminPanel();
    setupMobileTabs();
    renderReceipt();

    // Always initialize responsive tab classes (lg:block preserves desktop 2-col layout)
    switchMobileTab('form', { scrollToTop: false });

    console.log("StrukinAja v2.7 initialized successfully.");
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
