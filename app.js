/**
 * StrukinAja - Core Application Logic
 * Single Page Application for Midwife & Clinic Receipt Generator
 * 100% Client-Side with LocalStorage, Touch Signature, SVG Stamp & html2canvas
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
      hex: '#1e40af',      // tailwind blue-800
      light: '#eff6ff',
      border: '#1d4ed8'
    },
    purple: {
      id: 'purple',
      name: 'Ungu Medis (Bidan)',
      hex: '#7e22ce',      // tailwind purple-700
      light: '#faf5ff',
      border: '#6b21a8'
    },
    red: {
      id: 'red',
      name: 'Merah Resmi',
      hex: '#dc2626',      // tailwind red-600
      light: '#fef2f2',
      border: '#b91c1c'
    }
  };

  // Default demo data for first time visitors
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
  // 2. STATE MANAGEMENT
  // ==========================================================================
  let appState = {
    profile: { ...DEFAULT_PROFILE },
    patient: { ...DEFAULT_PATIENT },
    licenseKey: "",
    signatureDataUrl: "",
    saveSignatureForNext: false,
    activeTab: "form" // 'form' | 'preview' (for mobile)
  };

  // ==========================================================================
  // 3. DETERMINISTIC LICENSE KEY ALGORITHM
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
  // 4. INDONESIAN "TERBILANG" ALGORITHM
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

  // ==========================================================================
  // 5. TOAST NOTIFICATION SYSTEM
  // ==========================================================================
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    // Clear previous toasts so they never stack up
    container.innerHTML = '';

    const toast = document.createElement('div');
    const bgColors = {
      success: 'bg-emerald-600 text-white shadow-emerald-500/30',
      error: 'bg-red-600 text-white shadow-red-500/30',
      warning: 'bg-amber-600 text-white shadow-amber-500/30',
      info: 'bg-slate-800 text-white shadow-slate-900/30'
    };

    const icons = {
      success: `<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`,
      error: `<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`,
      warning: `<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`,
      info: `<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
    };

    toast.className = `flex items-center gap-3 px-4 py-2.5 rounded-xl shadow-lg font-medium text-xs transition-all duration-300 pointer-events-auto toast-slide-in ${bgColors[type] || bgColors.info}`;
    toast.innerHTML = `
      ${icons[type] || icons.info}
      <span class="flex-1 leading-snug">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.remove('toast-slide-in');
      toast.classList.add('toast-slide-out');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 250);
    }, 2200);
  }

  // ==========================================================================
  // 6. STORAGE SYNC & RESTORE
  // ==========================================================================
  function loadStateFromStorage() {
    try {
      const savedProfile = localStorage.getItem(STORAGE_KEY_PROFILE) || localStorage.getItem('medstruk_profile_v1');
      if (savedProfile) {
        appState.profile = { ...DEFAULT_PROFILE, ...JSON.parse(savedProfile) };
      }

      const savedKey = localStorage.getItem(STORAGE_KEY_LICENSE) || localStorage.getItem('medstruk_license_key_v1');
      if (savedKey) {
        appState.licenseKey = savedKey;
      }

      const savedSig = localStorage.getItem(STORAGE_KEY_SAVED_SIG) || localStorage.getItem('medstruk_saved_signature_v1');
      if (savedSig) {
        appState.signatureDataUrl = savedSig;
        appState.saveSignatureForNext = true;
      }
    } catch (e) {
      console.warn("Error reading from localStorage:", e);
    }

    if (!appState.patient.notaNumber) {
      appState.patient.notaNumber = generateNotaNumber();
    }
  }

  function saveProfileToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(appState.profile));
    } catch (e) {
      console.warn("Error saving profile to localStorage:", e);
    }
  }

  function saveLicenseToStorage(key) {
    try {
      localStorage.setItem(STORAGE_KEY_LICENSE, key);
      appState.licenseKey = key;
    } catch (e) {
      console.warn("Error saving license to localStorage:", e);
    }
  }

  // ==========================================================================
  // 7. STEMPEL SVG GENERATION
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

        <!-- Center Box with "LUNAS / PAID" -->
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
  // 8. RENDER LIVE RECEIPT PREVIEW
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
        <tr class="border-b border-dashed border-slate-200 text-xs text-slate-900">
          <td class="py-2 pr-2 text-left font-medium text-slate-900">
            <span class="text-slate-400 font-mono text-[10px] mr-1">${idx + 1}.</span>
            ${escapeHtml(item.name || 'Tindakan/Obat')}
          </td>
          <td class="py-2 px-1 text-center font-mono font-medium text-slate-900">${q}</td>
          <td class="py-2 px-1 text-right font-mono text-slate-900">${formatRupiah(pr)}</td>
          <td class="py-2 pl-2 text-right font-mono font-bold text-slate-900">${formatRupiah(sub)}</td>
        </tr>
      `;
    }).join('');

    const terbilangText = terbilang(grandTotal);

    // Dynamic Watermark: Only visible if NOT PRO
    const watermarkHtml = !isPro ? `
      <div class="watermark-overlay">
        ${Array(7).fill(0).map(() => `
          <div class="watermark-text-row">
            CONTOH STRUK - BELUM AKTIF<br>
            <span class="text-xs tracking-normal font-bold opacity-80">(Aktivasi Rp35.000 via WA 085176852680)</span>
          </div>
        `).join('')}
      </div>
    ` : '';

    // Clinic Logo Handling
    let logoHtml = '';
    if (isPro && p.logoBase64) {
      logoHtml = `
        <img src="${p.logoBase64}" alt="Logo Klinik" class="w-14 h-14 object-contain rounded-lg border border-slate-200 p-0.5 shadow-sm" />
      `;
    } else {
      // Default clean medical cross icon (neutral dark / black)
      logoHtml = `
        <div class="w-12 h-12 rounded-xl bg-slate-100 text-slate-900 flex items-center justify-center font-bold shadow-inner border border-slate-300 flex-shrink-0">
          <svg class="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 10.5h-5.5V5c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v5.5H5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h5.5V19c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-5.5H19c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z"/>
          </svg>
        </div>
      `;
    }

    // Stempel representation: Unlocked in PRO, locked badge in FREE
    let stampHtml = '';
    if (isPro) {
      stampHtml = `
        <div class="stamp-container absolute -top-5 -left-4 w-28 h-28 pointer-events-none z-10 opacity-90">
          ${generateStampSvg(p.stampColor, p.clinicName, p.sipb)}
        </div>
      `;
    } else {
      stampHtml = `
        <div class="absolute -top-3 -left-3 px-2.5 py-1.5 rounded-lg border border-dashed border-red-300 bg-red-50/90 text-red-700 text-[10px] font-bold shadow-sm z-10 flex items-center gap-1">
          <svg class="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
          STEMPEL KHUSUS PRO
        </div>
      `;
    }

    // Midwife Signature Drawing
    const signatureImgHtml = appState.signatureDataUrl ? `
      <img src="${appState.signatureDataUrl}" alt="Tanda Tangan" class="h-16 max-w-[150px] object-contain relative z-0" />
    ` : `
      <div class="h-16 flex items-center justify-center text-slate-400 italic text-xs font-serif border border-dashed border-slate-200 rounded px-4">
        (Belum Ditandatangani)
      </div>
    `;

    // Render receipt template - ALL BLACK/NEUTRAL FONTS ONLY
    paper.innerHTML = `
      ${watermarkHtml}

      <!-- Header Klinik -->
      <div class="relative z-10 pb-3 border-b-2 border-slate-900">
        <div class="flex items-center gap-3">
          ${logoHtml}
          <div class="flex-1 min-w-0">
            <h1 class="text-sm font-extrabold uppercase text-slate-900 leading-tight tracking-wide">
              ${escapeHtml(p.clinicName || 'PRAKTIK MANDIRI BIDAN')}
            </h1>
            <p class="text-[11px] font-bold text-slate-900 tracking-tight mt-0.5">
              ${escapeHtml(p.sipb ? 'SIPB: ' + p.sipb : 'IZIN PRAKTIK RESMI')}
            </p>
            <p class="text-[10px] text-slate-600 leading-tight mt-0.5">
              ${escapeHtml(p.address || 'Alamat Praktik')}
            </p>
            ${p.phone ? `<p class="text-[10px] text-slate-600 font-mono">Telp/WA: ${escapeHtml(p.phone)}</p>` : ''}
          </div>
        </div>
      </div>

      <!-- Title & Document Info -->
      <div class="relative z-10 py-3 border-b border-dashed border-slate-300">
        <div class="flex items-center justify-between">
          <div class="bg-slate-100 text-slate-900 text-[10px] font-black px-2 py-0.5 rounded tracking-wider uppercase border border-slate-300">
            KWITANSI RESMI
          </div>
          <span class="text-[10px] font-mono font-bold text-slate-700">
            ${escapeHtml(pt.notaNumber || 'NOT-000000')}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-x-2 gap-y-1 mt-2.5 text-[11px]">
          <div>
            <span class="text-slate-500 block text-[9px] uppercase tracking-wider font-semibold">Tanggal Periksa</span>
            <span class="font-bold text-slate-900">${formatIndoDate(pt.examDate)}</span>
          </div>
          <div>
            <span class="text-slate-500 block text-[9px] uppercase tracking-wider font-semibold">Nama Pasien</span>
            <span class="font-bold text-slate-900 truncate block">${escapeHtml(pt.patientName || '-')}</span>
          </div>
          <div>
            <span class="text-slate-500 block text-[9px] uppercase tracking-wider font-semibold">Usia Pasien</span>
            <span class="font-bold text-slate-900">${escapeHtml(pt.patientAge || '-')}</span>
          </div>
          <div>
            <span class="text-slate-500 block text-[9px] uppercase tracking-wider font-semibold">Layanan / Diagnosa</span>
            <span class="font-bold text-slate-900 truncate block">${escapeHtml(pt.serviceType || 'Pemeriksaan Umum')}</span>
          </div>
        </div>
      </div>

      <!-- Itemized Cost Table -->
      <div class="relative z-10 py-3">
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b-2 border-slate-900 text-[10px] uppercase font-bold text-slate-700 tracking-wider">
              <th class="py-1.5 pr-2 text-left">Rincian Tindakan / Obat</th>
              <th class="py-1.5 px-1 text-center w-8">Qty</th>
              <th class="py-1.5 px-1 text-right w-20">Tarif</th>
              <th class="py-1.5 pl-2 text-right w-24">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml || '<tr><td colspan="4" class="py-4 text-center text-xs text-slate-400 italic">Belum ada rincian tindakan</td></tr>'}
          </tbody>
        </table>
      </div>

      <!-- Total & Terbilang -->
      <div class="relative z-10 pt-2 pb-3 border-t-2 border-slate-900">
        <div class="flex items-baseline justify-between">
          <span class="text-xs font-black uppercase text-slate-900 tracking-wider">TOTAL TAGIHAN</span>
          <span class="text-base font-black font-mono text-slate-900">${formatRupiah(grandTotal)}</span>
        </div>

        <!-- Terbilang Box -->
        <div class="mt-2 p-2 bg-slate-50 rounded-lg border border-slate-300 text-[10.5px]">
          <span class="text-slate-500 font-bold block text-[9px] uppercase tracking-wider">Terbilang:</span>
          <span class="italic font-bold text-slate-900 leading-snug">
            "${terbilangText}"
          </span>
        </div>
      </div>

      <!-- Signature & Official Stamp Section -->
      <div class="relative z-10 pt-3 pb-2 border-t border-dashed border-slate-300">
        <div class="flex justify-between items-end">
          <!-- Quick Status Badge (Neutral Dark) -->
          <div class="text-[10px] text-slate-500 max-w-[130px] leading-tight pb-1">
            <span class="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${isPro ? 'bg-slate-100 text-slate-900 border border-slate-300' : 'bg-amber-100 text-amber-900 border border-amber-200'}">
              ${isPro ? '✓ KWITANSI LUNAS' : '⚠️ STATUS TRIAL'}
            </span>
          </div>

          <!-- Signature + Stamp Overlay Area -->
          <div class="text-right">
            <p class="text-[10px] text-slate-600 font-medium">
              ${escapeHtml(p.city || 'Kota')}, ${formatIndoDate(pt.examDate)}
            </p>
            <p class="text-[10px] font-bold text-slate-900 mb-1">
              Bidan / Tenaga Medis Pemeriksa
            </p>

            <div class="relative inline-flex items-center justify-end min-h-[64px] min-w-[150px]">
              ${signatureImgHtml}
              ${stampHtml}
            </div>

            <p class="text-[11px] font-black text-slate-900 underline underline-offset-2 mt-1">
              ${escapeHtml(p.bidanName || p.clinicName || 'Bidan Praktik Mandiri')}
            </p>
            <p class="text-[9px] text-slate-700 font-mono font-medium mt-0.5">
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
        <p class="text-[8px] text-slate-400 font-mono mt-0.5">
          Dicetak otomatis via StrukinAja • ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
        </p>
      </div>
    `;

    // Update Pro UI states throughout the page
    updateProStatusUI();
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
  // 9. UPDATE PRO BADGES & LOCKED FEATURE STATES
  // ==========================================================================
  function updateProStatusUI() {
    const isPro = isProActive();

    // Top Header Badge
    const headerBadge = document.getElementById('headerProBadge');
    if (headerBadge) {
      if (isPro) {
        headerBadge.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white shadow-sm ring-1 ring-emerald-400/50";
        headerBadge.innerHTML = `
          <svg class="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
          PRO AKTIF
        `;
      } else {
        headerBadge.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-white shadow-sm ring-1 ring-amber-400/50 cursor-pointer";
        headerBadge.innerHTML = `
          <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          VERSI TRIAL (BELUM AKTIF)
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
        licenseStatusCard.className = "p-4 rounded-xl border border-emerald-300 bg-emerald-50/70 text-emerald-900";
        licenseStatusText.innerHTML = `
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span class="font-extrabold text-sm text-emerald-800">Lisensi PRO Aktif Permanen</span>
          </div>
          <p class="text-xs text-emerald-700 mt-1">
            Terima kasih! Fitur Logo Resmi & Stempel Digital Otomatis telah terbuka tanpa watermark.
          </p>
        `;
        if (licenseInputContainer) licenseInputContainer.classList.add('hidden');
      } else {
        licenseStatusCard.className = "p-4 rounded-xl border border-amber-300 bg-amber-50/80 text-amber-900";
        licenseStatusText.innerHTML = `
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span class="font-extrabold text-sm text-amber-900">Versi Uji Coba (Terkunci)</span>
          </div>
          <p class="text-xs text-amber-800 mt-1">
            Struk masih ber-watermark. Aktifkan lisensi PRO sekali bayar Rp35.000 untuk selamanya.
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
    const stampSection = document.getElementById('stampConfigSection');
    const stampLockBadge = document.getElementById('stampLockBadge');
    if (stampSection && stampLockBadge) {
      if (isPro) {
        stampLockBadge.classList.add('hidden');
      } else {
        stampLockBadge.classList.remove('hidden');
      }
    }
  }

  // ==========================================================================
  // 10. FORM INPUT BINDINGS
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
          // Revert selection
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
          showToast("Logo klinik berhasil disimpan!", "success");
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

  function bindPatientInputs() {
    const fields = [
      { id: 'patientNotaNumber', prop: 'notaNumber' },
      { id: 'patientExamDate', prop: 'examDate' },
      { id: 'patientName', prop: 'patientName' },
      { id: 'patientAge', prop: 'patientAge' },
      { id: 'patientServiceType', prop: 'serviceType' }
    ];

    fields.forEach(({ id, prop }) => {
      const el = document.getElementById(id);
      if (el) {
        el.value = appState.patient[prop] || '';
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
  // 11. DYNAMIC ITEMS MANAGEMENT
  // ==========================================================================
  function renderDynamicItemRows() {
    const container = document.getElementById('itemsContainer');
    if (!container) return;

    container.innerHTML = '';

    appState.patient.items.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = "flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl transition hover:border-emerald-300";
      row.innerHTML = `
        <div class="flex-1 min-w-0">
          <input 
            type="text" 
            placeholder="Nama Tindakan atau Obat" 
            value="${escapeHtml(item.name)}" 
            data-index="${index}" 
            data-field="name"
            class="item-field w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:ring-1 focus:ring-emerald-500 font-medium text-slate-800"
          />
        </div>
        <div class="w-16 flex-shrink-0">
          <input 
            type="number" 
            min="1" 
            value="${item.qty}" 
            data-index="${index}" 
            data-field="qty"
            placeholder="Qty"
            class="item-field w-full px-2 py-1.5 text-xs text-center rounded-lg border border-slate-200 focus:ring-1 focus:ring-emerald-500 font-mono font-medium text-slate-800"
          />
        </div>
        <div class="w-28 flex-shrink-0">
          <input 
            type="number" 
            min="0" 
            step="1000"
            value="${item.price}" 
            data-index="${index}" 
            data-field="price"
            placeholder="Tarif (Rp)"
            class="item-field w-full px-2 py-1.5 text-xs text-right rounded-lg border border-slate-200 focus:ring-1 focus:ring-emerald-500 font-mono font-semibold text-slate-800"
          />
        </div>
        <button 
          type="button" 
          data-index="${index}" 
          class="delete-item-btn p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition flex-shrink-0"
          title="Hapus Baris"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      `;
      container.appendChild(row);
    });

    // Attach listeners to input fields
    container.querySelectorAll('.item-field').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'), 10);
        const field = e.target.getAttribute('data-field');
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
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        if (appState.patient.items.length <= 1) {
          // Keep at least one row, just reset it
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
        // Focus new item input
        setTimeout(() => {
          const container = document.getElementById('itemsContainer');
          if (container && container.lastElementChild) {
            const firstInput = container.lastElementChild.querySelector('input');
            if (firstInput) firstInput.focus();
          }
        }, 50);
      });
    }

    // Quick Add Service Buttons
    const quickServiceContainer = document.getElementById('quickServiceList');
    if (quickServiceContainer) {
      quickServiceContainer.innerHTML = QUICK_SERVICES.map((srv, i) => `
        <button 
          type="button" 
          data-qs-index="${i}" 
          class="quick-srv-chip inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/60 hover:bg-emerald-100 hover:border-emerald-300 transition text-left"
        >
          <span>+ ${escapeHtml(srv.name)}</span>
          <span class="text-[10px] text-emerald-600 font-mono font-semibold">${formatRupiah(srv.price)}</span>
        </button>
      `).join('');

      quickServiceContainer.querySelectorAll('.quick-srv-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-qs-index'), 10);
          const template = QUICK_SERVICES[idx];
          if (template) {
            // If the only existing row is empty, overwrite it
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
  // 12. TOUCH & POINTER SIGNATURE CANVAS
  // ==========================================================================
  function setupSignatureCanvas() {
    const canvas = document.getElementById('signatureCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    // Canvas sizing with devicePixelRatio support for maximum sharpness
    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width || (canvas.parentElement ? canvas.parentElement.clientWidth : 340);
      const height = rect.height || 144;
      const dpr = window.devicePixelRatio || 1;
      
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      
      // Reset transform then scale
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      ctx.strokeStyle = '#1e3a8a'; // Deep blue ballpoint pen ink
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (appState.signatureDataUrl) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, width, height);
        };
        img.src = appState.signatureDataUrl;
      }
    }

    // Initial resize after a short tick to ensure layout is computed
    setTimeout(resizeCanvas, 100);
    window.addEventListener('resize', resizeCanvas);

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

    function startDrawing(e) {
      e.preventDefault();
      isDrawing = true;
      const coords = getCoords(e);
      lastX = coords.x;
      lastY = coords.y;

      // Draw initial dot for taps/clicks
      ctx.beginPath();
      ctx.arc(lastX, lastY, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = '#1e3a8a';
      ctx.fill();
    }

    function draw(e) {
      if (!isDrawing) return;
      e.preventDefault();
      const coords = getCoords(e);

      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      // Smooth curve interpolation
      const midX = (lastX + coords.x) / 2;
      const midY = (lastY + coords.y) / 2;
      ctx.quadraticCurveTo(lastX, lastY, midX, midY);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();

      lastX = coords.x;
      lastY = coords.y;
    }

    function stopDrawing() {
      if (!isDrawing) return;
      isDrawing = false;
      const dataUrl = canvas.toDataURL('image/png');
      appState.signatureDataUrl = dataUrl;
      
      if (appState.saveSignatureForNext) {
        try {
          localStorage.setItem(STORAGE_KEY_SAVED_SIG, dataUrl);
        } catch (e) {
          console.warn("Could not save signature to storage:", e);
        }
      }

      renderReceipt();
    }

    // Touch events with active prevention of scroll
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchcancel', stopDrawing);

    // Mouse / Pointer events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);

    // Clear Canvas Button
    const clearBtn = document.getElementById('clearSigBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(dpr, dpr);
        ctx.strokeStyle = '#1e3a8a';
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        appState.signatureDataUrl = "";
        try {
          localStorage.removeItem(STORAGE_KEY_SAVED_SIG);
        } catch (e) {}
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
          localStorage.setItem(STORAGE_KEY_SAVED_SIG, appState.signatureDataUrl);
        } else if (!e.target.checked) {
          localStorage.removeItem(STORAGE_KEY_SAVED_SIG);
        }
      });
    }
  }

  // ==========================================================================
  // 13. HIGH RESOLUTION EXPORT (html2canvas)
  // ==========================================================================
  function setupExportActions() {
    const downloadBtn = document.getElementById('downloadImgBtn');
    const printBtn = document.getElementById('printReceiptBtn');
    const shareWaBtn = document.getElementById('shareWaBtn');
    const newTransactionBtn = document.getElementById('newTransactionBtn');

    // Download High-Resolution PNG (Scale: 3)
    if (downloadBtn) {
      downloadBtn.addEventListener('click', async () => {
        const receiptEl = document.getElementById('receiptPaper');
        if (!receiptEl) return;

        if (typeof html2canvas !== 'function') {
          showToast("Library html2canvas belum siap. Cek koneksi internet Anda.", "error");
          return;
        }

        const originalBtnText = downloadBtn.innerHTML;
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = `
          <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
          Memproses Gambar HD...
        `;

        try {
          // Render via html2canvas with scale 3 for ultra-sharp result
          const canvas = await html2canvas(receiptEl, {
            scale: 3,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
          });

          const patientClean = (appState.patient.patientName || 'Pasien').replace(/[^a-zA-Z0-9]/g, '_');
          const notaClean = (appState.patient.notaNumber || 'Nota').replace(/[^a-zA-Z0-9]/g, '_');
          const filename = `Struk_${patientClean}_${notaClean}.png`;

          // Trigger download
          const link = document.createElement('a');
          link.download = filename;
          link.href = canvas.toDataURL('image/png');
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          showToast("Struk resolusi tinggi (HD 3x) berhasil diunduh!", "success");
        } catch (err) {
          console.error("Export error:", err);
          showToast("Gagal mengunduh gambar: " + err.message, "error");
        } finally {
          downloadBtn.disabled = false;
          downloadBtn.innerHTML = originalBtnText;
        }
      });
    }

    // Print Receipt via window.print()
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
          const sub = (it.qty || 1) * (it.price || 0);
          total += sub;
          return `• ${it.name} (${it.qty}x) = ${formatRupiah(sub)}`;
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

        // Reset inputs
        bindPatientInputs();
        renderDynamicItemRows();
        
        // If midwife didn't check save signature, clear it
        if (!appState.saveSignatureForNext) {
          appState.signatureDataUrl = "";
          const canvas = document.getElementById('signatureCanvas');
          if (canvas) {
            const ctx = canvas.getContext('2d');
            const dpr = window.devicePixelRatio || 1;
            ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
          }
        }

        renderReceipt();

        // On mobile, switch to form tab
        if (window.innerWidth < 1024) {
          switchMobileTab('form');
        }
      });
    }
  }

  // ==========================================================================
  // 14. PRO ACTIVATION & WHATSAPP PURCHASE FLOW
  // ==========================================================================
  function setupLicenseActivation() {
    const buyWaBtn = document.getElementById('buyLicenseWaBtn');
    const activateBtn = document.getElementById('activateLicenseBtn');
    const licenseInput = document.getElementById('licenseKeyInput');
    const openLicenseModalBtn = document.getElementById('openLicenseModalBtn');
    const closeLicenseModalBtn = document.getElementById('closeLicenseModalBtn');
    const licenseModal = document.getElementById('licenseModal');

    // Open/Close License Modal
    if (openLicenseModalBtn && licenseModal) {
      openLicenseModalBtn.addEventListener('click', () => {
        licenseModal.classList.remove('hidden');
      });
    }

    if (closeLicenseModalBtn && licenseModal) {
      closeLicenseModalBtn.addEventListener('click', () => {
        licenseModal.classList.add('hidden');
      });
    }

    // Header badge click scrolls directly to PRO activation section
    const headerBadge = document.getElementById('headerProBadge');
    if (headerBadge) {
      headerBadge.addEventListener('click', () => {
        if (!isProActive()) {
          if (window.innerWidth < 1024) {
            switchMobileTab('form');
          }
          const proCard = document.getElementById('licenseStatusCard');
          if (proCard) {
            proCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            proCard.classList.add('ring-2', 'ring-emerald-400');
            setTimeout(() => proCard.classList.remove('ring-2', 'ring-emerald-400'), 1500);
          }
        }
      });
    }

    // Buy via WhatsApp Button
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

    // Validate and Activate Code
    function processActivation() {
      const code = (licenseInput.value || '').trim().toUpperCase();
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
        showToast("🎉 Selamat! StrukinAja PRO berhasil diaktifkan secara permanen!", "success");
        if (licenseModal) licenseModal.classList.add('hidden');
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
  // 15. SECRET ADMIN PANEL (5 CLICKS ON HEADER TITLE / LOGO)
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

      // Subtle press animation on header logo
      adminTrigger.classList.add('scale-95');
      setTimeout(() => adminTrigger.classList.remove('scale-95'), 120);

      // Silently open modal on 5th tap without showing progress toasts
      if (tapCount >= 5) {
        tapCount = 0;
        clearTimeout(tapTimer);
        openAdminModal();
        return;
      }

      // 4 seconds timeout window before count resets
      tapTimer = setTimeout(() => {
        tapCount = 0;
      }, 4000);
    }

    // Attach click listener
    adminTrigger.addEventListener('click', handleTap);

    // Make trigger function available on window
    window.handleAdminSecretTap = handleTap;

    // Connect footer admin link as backup access
    const footerAdminBtn = document.getElementById('footerAdminLink');
    if (footerAdminBtn) {
      footerAdminBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openAdminModal();
      });
    }

    // Also support keyboard shortcut for desktop (Ctrl+Shift+A or Alt+A)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) || (e.altKey && (e.key === 'A' || e.key === 'a'))) {
        e.preventDefault();
        openAdminModal();
      }
      // Close modal on Escape
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

    // Close modal when clicking backdrop outside dialog
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
        // Pre-fill with current clinic name for fast testing
        if (appState.profile.clinicName) {
          adminClinicInput.value = appState.profile.clinicName;
          updateAdminGenerator();
        }
        showToast("Akses Admin Terverifikasi!", "success");
      } else {
        showToast("PIN Admin salah!", "error");
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
            showToast(`Kode "${key}" berhasil disalin ke clipboard!`, "success");
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
  // 16. MOBILE NAVIGATION TABS
  // ==========================================================================
  function switchMobileTab(tab) {
    appState.activeTab = tab;
    const formSection = document.getElementById('inputSection');
    const previewSection = document.getElementById('previewSection');
    const tabFormBtn = document.getElementById('tabFormBtn');
    const tabPreviewBtn = document.getElementById('tabPreviewBtn');

    if (!formSection || !previewSection) return;

    if (tab === 'form') {
      formSection.classList.remove('hidden');
      previewSection.classList.add('hidden');
      previewSection.classList.remove('block');

      if (tabFormBtn) {
        tabFormBtn.className = "flex-1 py-2.5 text-center text-xs font-bold rounded-lg bg-emerald-600 text-white shadow-sm transition";
      }
      if (tabPreviewBtn) {
        tabPreviewBtn.className = "flex-1 py-2.5 text-center text-xs font-bold rounded-lg text-slate-600 hover:text-slate-900 transition";
      }
    } else {
      formSection.classList.add('hidden');
      previewSection.classList.remove('hidden');
      previewSection.classList.add('block');

      if (tabFormBtn) {
        tabFormBtn.className = "flex-1 py-2.5 text-center text-xs font-bold rounded-lg text-slate-600 hover:text-slate-900 transition";
      }
      if (tabPreviewBtn) {
        tabPreviewBtn.className = "flex-1 py-2.5 text-center text-xs font-bold rounded-lg bg-emerald-600 text-white shadow-sm transition";
      }

      // Re-render when switching to preview to guarantee full sharpness
      renderReceipt();
    }
  }

  function setupMobileTabs() {
    const tabFormBtn = document.getElementById('tabFormBtn');
    const tabPreviewBtn = document.getElementById('tabPreviewBtn');

    if (tabFormBtn) {
      tabFormBtn.addEventListener('click', () => switchMobileTab('form'));
    }
    if (tabPreviewBtn) {
      tabPreviewBtn.addEventListener('click', () => switchMobileTab('preview'));
    }

    // Quick floating preview button on mobile
    const floatPreviewBtn = document.getElementById('floatPreviewBtn');
    if (floatPreviewBtn) {
      floatPreviewBtn.addEventListener('click', () => switchMobileTab('preview'));
    }
  }

  // ==========================================================================
  // 17. INITIALIZATION
  // ==========================================================================
  function init() {
    loadStateFromStorage();
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

    // Check screen width for initial mobile tab state
    if (window.innerWidth < 1024) {
      switchMobileTab('form');
    }

    console.log("StrukinAja initialized successfully.");
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
