/**
 * ZILHAJ PARTNER OPERATIONS - ADD OFFER & PACKAGE ENGINE
 * Vanilla JavaScript (ES6+) - Production-Grade Architecture
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. CONSTANTS & SEED DATA
  // ==========================================================================
  const STORAGE_KEY = 'ZILHAJ_PACKAGE_INVENTORY';

  const SEED_PACKAGES = [
    {
      packageId: 'PKG-0001',
      agentId: 'AGENT-1042',
      serviceType: 'Umrah',
      packageTitle: '18 Days Umrah Package',
      departureDate: '2026-10-15',
      duration: '18 Days',
      pricePerPerson: 85000,
      seatsLeft: '4',
      hotels: {
        makkah: {
          name: 'Fairmont Clock Tower',
          distance: '50 meters'
        },
        madinah: {
          name: 'Oberoi Madinah',
          distance: '100 meters'
        }
      },
      packageIncludes: [
        'Return Flights',
        'Daily Meals',
        'Sharing Accommodation',
        'Guided Ziyarat in Makkah',
        'Guided Ziyarat in Madinah',
        'Airport & Intercity Transfers'
      ],
      complimentaryServices: ['Ihram Kit', 'Laundry Service', 'Zamzam Water'],
      importantNote: 'All room bookings are subject to flight availability. Passport must be valid for at least 6 months from travel date.',
      packageImage: '',
      bookingHelpline: '+91 98765 43210',
      supportEmail: 'support@zilhaj.com',
      status: 'Active',
      createdAt: '2026-09-20T10:00:00.000Z'
    },
    {
      packageId: 'PKG-0002',
      agentId: 'AGENT-1087',
      serviceType: 'Hajj',
      packageTitle: '21 Days Deluxe Hajj Itinerary',
      departureDate: '2027-05-18',
      duration: '21 Days',
      pricePerPerson: 375000,
      seatsLeft: '2',
      hotels: {
        makkah: {
          name: 'Swissotel Makkah',
          distance: '20 meters'
        },
        madinah: {
          name: 'Anwar Al Madinah Movenpick',
          distance: '50 meters'
        }
      },
      packageIncludes: [
        'Return Flights',
        'Daily Meals',
        'Sharing Accommodation',
        'Guided Ziyarat in Makkah',
        'Guided Ziyarat in Madinah',
        'Airport & Intercity Transfers'
      ],
      complimentaryServices: ['Ihram Kit', 'Zamzam Water'],
      importantNote: 'Full Hajj visa processing and VIP Azizia shuttle included. Non-refundable after official Nusuk quota allocation.',
      packageImage: '',
      bookingHelpline: '+91 98765 43210',
      supportEmail: 'support@zilhaj.com',
      status: 'Active',
      createdAt: '2026-09-22T11:30:00.000Z'
    },
    {
      packageId: 'PKG-0003',
      agentId: 'AGENT-1015',
      serviceType: 'Umrah',
      packageTitle: '14 Days Economy Umrah Special',
      departureDate: '2026-11-05',
      duration: '14 Days',
      pricePerPerson: 68000,
      seatsLeft: '',
      hotels: {
        makkah: {
          name: 'Pullman Zamzam Makkah',
          distance: '150 meters'
        },
        madinah: {
          name: 'Dallah Taibah',
          distance: '200 meters'
        }
      },
      packageIncludes: [
        'Return Flights',
        'Daily Meals',
        'Guided Ziyarat in Madinah',
        'Airport & Intercity Transfers'
      ],
      complimentaryServices: ['Zamzam Water'],
      importantNote: 'Quad sharing standard rooms. Free cancellation up to 14 days before departure.',
      packageImage: '',
      bookingHelpline: '+91 98765 43210',
      supportEmail: 'support@zilhaj.com',
      status: 'Active',
      createdAt: '2026-09-24T14:15:00.000Z'
    }
  ];

  // ==========================================================================
  // 2. STATE STORE & INVENTORY SERVICE
  // ==========================================================================
  const InventoryStore = {
    getAll: function () {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_PACKAGES));
          return [...SEED_PACKAGES];
        }
        return JSON.parse(raw);
      } catch (err) {
        console.error('Failed to read inventory store:', err);
        return [...SEED_PACKAGES];
      }
    },

    saveAll: function (packages) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(packages));
      } catch (err) {
        console.error('Failed to persist inventory store:', err);
      }
    },

    getById: function (id) {
      const all = this.getAll();
      return all.find((p) => p.packageId === id) || null;
    },

    generatePackageId: function () {
      const all = this.getAll();
      let maxNum = 0;
      all.forEach((pkg) => {
        if (pkg.packageId && pkg.packageId.startsWith('PKG-')) {
          const num = parseInt(pkg.packageId.replace('PKG-', ''), 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      });
      const nextNum = maxNum + 1;
      return `PKG-${String(nextNum).padStart(4, '0')}`;
    },

    save: function (pkg) {
      const all = this.getAll();
      const existingIdx = all.findIndex((p) => p.packageId === pkg.packageId);

      if (existingIdx >= 0) {
        all[existingIdx] = { ...all[existingIdx], ...pkg, updatedAt: new Date().toISOString() };
      } else {
        all.unshift({ ...pkg, createdAt: new Date().toISOString() });
      }

      this.saveAll(all);
      return pkg;
    },

    delete: function (id) {
      const all = this.getAll();
      const filtered = all.filter((p) => p.packageId !== id);
      this.saveAll(filtered);
      return filtered;
    },

    findDuplicate: function (pkg, currentEditingId = null) {
      const all = this.getAll();
      return (
        all.find((item) => {
          if (currentEditingId && item.packageId === currentEditingId) {
            return false;
          }
          const isSameAgent = (item.agentId || '').trim().toLowerCase() === (pkg.agentId || '').trim().toLowerCase();
          const isSameService = (item.serviceType || '').trim().toLowerCase() === (pkg.serviceType || '').trim().toLowerCase();
          const isSameDate = (item.departureDate || '').trim() === (pkg.departureDate || '').trim();
          const isSameTitle = (item.packageTitle || '').trim().toLowerCase() === (pkg.packageTitle || '').trim().toLowerCase();

          return isSameAgent && isSameService && isSameDate && isSameTitle;
        }) || null
      );
    },

    resetToDemo: function () {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_PACKAGES));
      return [...SEED_PACKAGES];
    }
  };

  // ==========================================================================
  // 3. UTILITY FUNCTIONS
  // ==========================================================================
  function formatIndianCurrency(amount) {
    if (!amount || isNaN(amount)) return '--';
    const num = Number(amount);
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 0
    }).format(num);
  }

  function formatDateFriendly(dateStr) {
    if (!dateStr) return '--';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const dateObj = new Date(year, month, day);
        if (!isNaN(dateObj.getTime())) {
          return dateObj.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          });
        }
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  }

  function sanitizeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==========================================================================
  // 4. TOAST NOTIFICATIONS
  // ==========================================================================
  function showToast(title, message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"></path></svg>`;
    } else if (type === 'warning') {
      iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    } else {
      iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    }

    toast.innerHTML = `
      ${iconSvg}
      <div class="toast-body">
        <h5 class="toast-title">${sanitizeHtml(title)}</h5>
        <p class="toast-message">${sanitizeHtml(message)}</p>
      </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ==========================================================================
  // 5. DOM ELEMENTS & CONTROLLER
  // ==========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    // Form Inputs
    const form = document.getElementById('packageForm');
    const editPackageIdInput = document.getElementById('editPackageId');
    const editModeBanner = document.getElementById('editModeBanner');
    const editBannerPkgId = document.getElementById('editBannerPkgId');
    const cancelEditModeBtn = document.getElementById('cancelEditModeBtn');

    // Service Buttons (Default: Umrah)
    const btnHajj = document.getElementById('btnHajj');
    const btnUmrah = document.getElementById('btnUmrah');
    const serviceTypeCard = document.getElementById('serviceTypeCard');
    let selectedServiceType = 'Umrah'; // UMRAH IS SELECTED BY DEFAULT

    // Inputs
    const agentIdInput = document.getElementById('agentIdInput');
    const packageTitleInput = document.getElementById('packageTitleInput');
    const departureDateInput = document.getElementById('departureDateInput');
    const durationInput = document.getElementById('durationInput');
    const priceInput = document.getElementById('priceInput');
    const seatsLeftInput = document.getElementById('seatsLeftInput');

    const makkahHotelInput = document.getElementById('makkahHotelInput');
    const madinahHotelInput = document.getElementById('madinahHotelInput');
    const makkahDistInput = document.getElementById('makkahDistInput');
    const madinahDistInput = document.getElementById('madinahDistInput');

    const importantNoteInput = document.getElementById('importantNoteInput');
    const bookingHelplineInput = document.getElementById('bookingHelplineInput');
    const supportEmailInput = document.getElementById('supportEmailInput');

    // Image upload
    const packageImageInput = document.getElementById('packageImageInput');
    const imageUploadZone = document.getElementById('imageUploadZone');
    const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const uploadedImageDisplay = document.getElementById('uploadedImageDisplay');
    const removeImageBtn = document.getElementById('removeImageBtn');
    let currentUploadedImageData = '';

    // Checkboxes
    const packageIncludeChks = document.querySelectorAll('.package-include-chk');
    const complimentaryChks = document.querySelectorAll('.complimentary-chk');

    // Verification Checkbox
    const verifyPackageCheckbox = document.getElementById('verifyPackageCheckbox');

    // Preview DOM Elements
    const previewAgentId = document.getElementById('previewAgentId');
    const previewSeatsBadge = document.getElementById('previewSeatsBadge');
    const previewServiceTypeTitle = document.getElementById('previewServiceTypeTitle');
    const previewCustomPackageTitle = document.getElementById('previewCustomPackageTitle');
    const previewDepartureDate = document.getElementById('previewDepartureDate');
    const previewDuration = document.getElementById('previewDuration');
    const previewPriceAmount = document.getElementById('previewPriceAmount');
    const previewMakkahHotel = document.getElementById('previewMakkahHotel');
    const previewMadinahHotel = document.getElementById('previewMadinahHotel');
    const previewMakkahDist = document.getElementById('previewMakkahDist');
    const previewMadinahDist = document.getElementById('previewMadinahDist');
    const previewIncludesGrid = document.getElementById('previewIncludesGrid');
    const previewComplimentaryRow = document.getElementById('previewComplimentaryRow');
    const previewImportantNote = document.getElementById('previewImportantNote');
    const previewHelpline = document.getElementById('previewHelpline');
    const previewEmail = document.getElementById('previewEmail');
    const previewCtaLabel = document.getElementById('previewCtaLabel');
    const previewCustomImageWrap = document.getElementById('previewCustomImageWrap');
    const previewCustomImg = document.getElementById('previewCustomImg');

    // Action buttons
    const btnCancelForm = document.getElementById('btnCancelForm');
    const btnSavePackage = document.getElementById('btnSavePackage');
    const saveButtonLabel = document.getElementById('saveButtonLabel');

    // Header buttons
    const viewInventoryBtn = document.getElementById('viewInventoryBtn');
    const inventoryCountBadge = document.getElementById('inventoryCountBadge');
    const notifBtn = document.getElementById('notifBtn');
    const notifMenu = document.getElementById('notifMenu');
    const notifBadge = document.getElementById('notifBadge');
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    const profileBtn = document.getElementById('profileBtn');
    const profileMenu = document.getElementById('profileMenu');
    const userProfileBtn = document.getElementById('userProfileBtn');
    const userSettingsBtn = document.getElementById('userSettingsBtn');
    const userLogoutBtn = document.getElementById('userLogoutBtn');

    // Logout Modal Elements
    const logoutConfirmModal = document.getElementById('logoutConfirmModal');
    const btnCancelLogout = document.getElementById('btnCancelLogout');
    const btnConfirmLogout = document.getElementById('btnConfirmLogout');

    // Inventory Modal Elements
    const inventoryModal = document.getElementById('inventoryModal');
    const closeInventoryModalBtn = document.getElementById('closeInventoryModalBtn');
    const inventorySearchInput = document.getElementById('inventorySearchInput');
    const inventoryServiceFilter = document.getElementById('inventoryServiceFilter');
    const inventoryStatusFilter = document.getElementById('inventoryStatusFilter');
    const inventoryListContainer = document.getElementById('inventoryListContainer');
    const inventorySummaryCount = document.getElementById('inventorySummaryCount');
    const btnNewPackageFromModal = document.getElementById('btnNewPackageFromModal');

    // Duplicate Warning Modal Elements
    const duplicateWarningModal = document.getElementById('duplicateWarningModal');
    const duplicateDetailsBox = document.getElementById('duplicateDetailsBox');
    const btnCancelDuplicate = document.getElementById('btnCancelDuplicate');
    const btnProceedDuplicate = document.getElementById('btnProceedDuplicate');
    let pendingDuplicatePackageData = null;

    // ==========================================================================
    // 6. LIVE PREVIEW REFRESH FUNCTION
    // ==========================================================================
    function updateLivePreview() {
      // 1. Service Type & Title
      if (selectedServiceType === 'Hajj') {
        previewServiceTypeTitle.textContent = 'HAJJ PACKAGE';
      } else {
        previewServiceTypeTitle.textContent = 'UMRAH PACKAGE';
      }

      // 2. Agent ID
      const agentVal = agentIdInput.value.trim();
      previewAgentId.textContent = agentVal ? agentVal.toUpperCase() : 'AGENT-XXXX';

      // 3. Seats Left (Optional Availability Badge)
      const seatsVal = seatsLeftInput ? seatsLeftInput.value.trim() : '';
      if (seatsVal) {
        const numOnly = seatsVal.replace(/[^\d]/g, '');
        if (numOnly && !seatsVal.toLowerCase().includes('seat')) {
          previewSeatsBadge.textContent = `${numOnly} Seats Left`;
        } else {
          previewSeatsBadge.textContent = seatsVal;
        }
        previewSeatsBadge.hidden = false;
      } else {
        previewSeatsBadge.hidden = true;
      }

      // 4. Departure Date
      const dateVal = departureDateInput.value;
      previewDepartureDate.textContent = dateVal ? formatDateFriendly(dateVal) : '--';

      // 5. Duration
      const durVal = durationInput.value.trim();
      previewDuration.textContent = durVal || '--';

      // 6. Price Per Person
      const priceVal = parseFloat(priceInput.value);
      if (!isNaN(priceVal) && priceVal > 0) {
        const formatted = formatIndianCurrency(priceVal);
        previewPriceAmount.textContent = formatted;
        previewCtaLabel.textContent = `Book This Offer (₹ ${formatted})`;
      } else {
        previewPriceAmount.textContent = '--';
        previewCtaLabel.textContent = 'Book This Offer (₹ --)';
      }

      // 7. Hotels
      const makkahHotelVal = makkahHotelInput.value.trim();
      previewMakkahHotel.textContent = makkahHotelVal || '--';

      const makkahDistVal = makkahDistInput.value.trim();
      if (makkahDistVal) {
        previewMakkahDist.textContent = makkahDistVal.toLowerCase().includes('masjid')
          ? makkahDistVal
          : `${makkahDistVal} from Masjid al-Haram`;
      } else {
        previewMakkahDist.textContent = '-- meters from Masjid al-Haram';
      }

      const madinahHotelVal = madinahHotelInput.value.trim();
      previewMadinahHotel.textContent = madinahHotelVal || '--';

      const madinahDistVal = madinahDistInput.value.trim();
      if (madinahDistVal) {
        previewMadinahDist.textContent = madinahDistVal.toLowerCase().includes('masjid')
          ? madinahDistVal
          : `${madinahDistVal} from Masjid an-Nabawi`;
      } else {
        previewMadinahDist.textContent = '-- meters from Masjid an-Nabawi';
      }

      // 8. Package Includes
      const selectedIncludes = [];
      packageIncludeChks.forEach((chk) => {
        if (chk.checked) selectedIncludes.push(chk.value);
      });

      if (selectedIncludes.length === 0) {
        previewIncludesGrid.innerHTML = `<div class="empty-preview-msg">No inclusions selected</div>`;
      } else {
        previewIncludesGrid.innerHTML = selectedIncludes
          .map(
            (item) => `
            <div class="preview-include-item">
              <span class="check-icon-wrap">&#10003;</span>
              <span>${sanitizeHtml(item)}</span>
            </div>
          `
          )
          .join('');
      }

      // 9. Complimentary Services
      const selectedComp = [];
      complimentaryChks.forEach((chk) => {
        if (chk.checked) selectedComp.push(chk.value);
      });

      if (selectedComp.length === 0) {
        previewComplimentaryRow.innerHTML = `<div class="empty-preview-msg">No complimentary services selected</div>`;
      } else {
        previewComplimentaryRow.innerHTML = selectedComp
          .map((item) => {
            let iconSvg = '';
            if (item === 'Ihram Kit') {
              iconSvg = `<span class="pill-icon"><svg viewBox="0 0 24 24" fill="#d97706"><path d="M19 6h-3V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zm-9-2h4v2h-4V4z"/></svg></span>`;
            } else if (item === 'Laundry Service') {
              iconSvg = `<span class="pill-icon"><svg viewBox="0 0 24 24" fill="#0d9488"><circle cx="12" cy="12" r="8" fill="#d97706"/></svg></span>`;
            } else {
              iconSvg = `<span class="pill-icon"><svg viewBox="0 0 24 24" fill="#0284c7"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg></span>`;
            }
            return `
              <div class="preview-comp-pill">
                ${iconSvg}
                <span class="pill-text">${sanitizeHtml(item)}</span>
              </div>
            `;
          })
          .join('');
      }

      // 10. Important Note
      const noteVal = importantNoteInput.value.trim();
      previewImportantNote.textContent = noteVal || '--';

      // 11. Helpline & Email
      const phoneVal = bookingHelplineInput.value.trim();
      previewHelpline.textContent = phoneVal || '+91 98765 43210';

      const emailVal = supportEmailInput.value.trim();
      previewEmail.textContent = emailVal || 'support@zilhaj.com';

      // 12. Image Banner
      if (currentUploadedImageData) {
        previewCustomImg.src = currentUploadedImageData;
        previewCustomImageWrap.hidden = false;
      } else {
        previewCustomImg.src = '';
        previewCustomImageWrap.hidden = true;
      }
    }

    // ==========================================================================
    // 7. SERVICE TYPE SELECTOR LOGIC
    // ==========================================================================
    function setServiceType(type) {
      selectedServiceType = type;
      if (type === 'Hajj') {
        btnHajj.classList.add('active');
        btnHajj.setAttribute('aria-checked', 'true');
        btnUmrah.classList.remove('active');
        btnUmrah.setAttribute('aria-checked', 'false');
      } else {
        // Default & Umrah case
        selectedServiceType = 'Umrah';
        btnUmrah.classList.add('active');
        btnUmrah.setAttribute('aria-checked', 'true');
        btnHajj.classList.remove('active');
        btnHajj.setAttribute('aria-checked', 'false');
      }

      // Clear validation error if any
      clearFieldError('serviceType');
      updateLivePreview();
    }

    btnHajj.addEventListener('click', () => setServiceType('Hajj'));
    btnUmrah.addEventListener('click', () => setServiceType('Umrah'));

    // ==========================================================================
    // 8. INPUT LISTENERS (LIVE SYNC)
    // ==========================================================================
    const liveInputs = [
      agentIdInput,
      packageTitleInput,
      departureDateInput,
      durationInput,
      priceInput,
      seatsLeftInput,
      makkahHotelInput,
      madinahHotelInput,
      makkahDistInput,
      madinahDistInput,
      importantNoteInput,
      bookingHelplineInput,
      supportEmailInput
    ];

    liveInputs.forEach((input) => {
      if (!input) return;
      input.addEventListener('input', () => {
        clearFieldError(input.id.replace('Input', ''));
        updateLivePreview();
      });
      input.addEventListener('change', () => {
        updateLivePreview();
      });
    });

    packageIncludeChks.forEach((chk) => {
      chk.addEventListener('change', updateLivePreview);
    });

    complimentaryChks.forEach((chk) => {
      chk.addEventListener('change', updateLivePreview);
    });

    // ==========================================================================
    // 9. VERIFICATION CHECKBOX & UPLOAD BUTTON SYNC
    // ==========================================================================
    if (verifyPackageCheckbox) {
      verifyPackageCheckbox.addEventListener('change', () => {
        btnSavePackage.disabled = !verifyPackageCheckbox.checked;
      });
    }

    // ==========================================================================
    // 10. IMAGE UPLOAD & PREVIEW HANDLER
    // ==========================================================================
    function handleImageFile(file) {
      if (!file) return;

      const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        showFieldError('packageImage', 'Please upload a valid image (JPG or PNG).');
        return;
      }

      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        showFieldError('packageImage', 'Image file exceeds maximum limit of 5MB.');
        return;
      }

      clearFieldError('packageImage');

      const reader = new FileReader();
      reader.onload = function (e) {
        currentUploadedImageData = e.target.result;
        uploadedImageDisplay.src = currentUploadedImageData;
        imagePreviewContainer.hidden = false;
        uploadPlaceholder.hidden = true;
        updateLivePreview();
      };
      reader.readAsDataURL(file);
    }

    imageUploadZone.addEventListener('click', (e) => {
      if (e.target.closest('#removeImageBtn')) return;
      packageImageInput.click();
    });

    imageUploadZone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        packageImageInput.click();
      }
    });

    packageImageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleImageFile(file);
    });

    // Drag & Drop
    imageUploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      imageUploadZone.classList.add('dragover');
    });

    imageUploadZone.addEventListener('dragleave', () => {
      imageUploadZone.classList.remove('dragover');
    });

    imageUploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      imageUploadZone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) handleImageFile(file);
    });

    removeImageBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      currentUploadedImageData = '';
      packageImageInput.value = '';
      uploadedImageDisplay.src = '';
      imagePreviewContainer.hidden = true;
      uploadPlaceholder.hidden = false;
      clearFieldError('packageImage');
      updateLivePreview();
    });

    // ==========================================================================
    // 11. FORM VALIDATION
    // ==========================================================================
    function showFieldError(fieldKey, message) {
      const errorEl = document.getElementById(`${fieldKey}Error`);
      const inputEl = document.getElementById(`${fieldKey}Input`);

      if (fieldKey === 'serviceType') {
        const selector = document.querySelector('.service-type-selector');
        if (selector) selector.classList.add('is-invalid');
      } else if (inputEl) {
        inputEl.classList.add('is-invalid');
      }

      if (errorEl) {
        if (message) errorEl.textContent = message;
        errorEl.classList.add('visible');
      }
    }

    function clearFieldError(fieldKey) {
      const errorEl = document.getElementById(`${fieldKey}Error`);
      const inputEl = document.getElementById(`${fieldKey}Input`);

      if (fieldKey === 'serviceType') {
        const selector = document.querySelector('.service-type-selector');
        if (selector) selector.classList.remove('is-invalid');
      } else if (inputEl) {
        inputEl.classList.remove('is-invalid');
      }

      if (errorEl) {
        errorEl.classList.remove('visible');
      }
    }

    function clearAllValidationErrors() {
      document.querySelectorAll('.form-control').forEach((el) => el.classList.remove('is-invalid'));
      document.querySelectorAll('.field-error-msg').forEach((el) => el.classList.remove('visible'));
      const selector = document.querySelector('.service-type-selector');
      if (selector) selector.classList.remove('is-invalid');
    }

    function validateForm() {
      let isValid = true;
      let firstErrorEl = null;

      // 1. Service Type
      if (!selectedServiceType) {
        showFieldError('serviceType', 'Please select Hajj or Umrah.');
        isValid = false;
        if (!firstErrorEl) firstErrorEl = serviceTypeCard;
      }

      // 2. Agent ID
      const agentId = agentIdInput.value.trim();
      if (!agentId) {
        showFieldError('agentId', 'Please enter or select an Agent ID.');
        isValid = false;
        if (!firstErrorEl) firstErrorEl = agentIdInput;
      }

      // 3. Package Title
      const title = packageTitleInput.value.trim();
      if (!title) {
        showFieldError('packageTitle', 'Please enter the package title.');
        isValid = false;
        if (!firstErrorEl) firstErrorEl = packageTitleInput;
      }

      // 4. Departure Date
      const depDate = departureDateInput.value;
      if (!depDate) {
        showFieldError('departureDate', 'Please select departure date.');
        isValid = false;
        if (!firstErrorEl) firstErrorEl = departureDateInput;
      }

      // 5. Duration
      const dur = durationInput.value.trim();
      if (!dur) {
        showFieldError('duration', 'Please enter duration (e.g. 18 Days).');
        isValid = false;
        if (!firstErrorEl) firstErrorEl = durationInput;
      }

      // 6. Price Per Person
      const price = parseFloat(priceInput.value);
      if (isNaN(price) || price <= 0) {
        showFieldError('price', 'Please enter a valid numeric price (greater than ₹0).');
        isValid = false;
        if (!firstErrorEl) firstErrorEl = priceInput;
      }

      // 7. Makkah Hotel & Dist
      const makkahHotel = makkahHotelInput.value.trim();
      if (!makkahHotel) {
        showFieldError('makkahHotel', 'Please enter Makkah hotel name.');
        isValid = false;
        if (!firstErrorEl) firstErrorEl = makkahHotelInput;
      }

      const makkahDist = makkahDistInput.value.trim();
      if (!makkahDist) {
        showFieldError('makkahDist', 'Please specify distance from Masjid al-Haram.');
        isValid = false;
        if (!firstErrorEl) firstErrorEl = makkahDistInput;
      }

      // 8. Madinah Hotel & Dist
      const madinahHotel = madinahHotelInput.value.trim();
      if (!madinahHotel) {
        showFieldError('madinahHotel', 'Please enter Madinah hotel name.');
        isValid = false;
        if (!firstErrorEl) firstErrorEl = madinahHotelInput;
      }

      const madinahDist = madinahDistInput.value.trim();
      if (!madinahDist) {
        showFieldError('madinahDist', 'Please specify distance from Masjid an-Nabawi.');
        isValid = false;
        if (!firstErrorEl) firstErrorEl = madinahDistInput;
      }

      // 9. Important Note
      const note = importantNoteInput.value.trim();
      if (!note) {
        showFieldError('importantNote', 'Please enter an important note.');
        isValid = false;
        if (!firstErrorEl) firstErrorEl = importantNoteInput;
      }

      // 10. Booking Helpline
      const helpline = bookingHelplineInput.value.trim();
      const phoneRegex = /^[+]?[\d\s-]{7,18}$/;
      if (!helpline || !phoneRegex.test(helpline)) {
        showFieldError('bookingHelpline', 'Please enter a valid booking helpline phone number.');
        isValid = false;
        if (!firstErrorEl) firstErrorEl = bookingHelplineInput;
      }

      // 11. Support Email
      const email = supportEmailInput.value.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        showFieldError('supportEmail', 'Please enter a valid email address.');
        isValid = false;
        if (!firstErrorEl) firstErrorEl = supportEmailInput;
      }

      // 12. Verification Checkbox confirmation
      if (verifyPackageCheckbox && !verifyPackageCheckbox.checked) {
        showToast('Verification Required', 'Please check the verification checkbox below the package preview.', 'warning');
        isValid = false;
        if (!firstErrorEl) firstErrorEl = verifyPackageCheckbox;
      }

      if (!isValid && firstErrorEl) {
        firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      return isValid;
    }

    // ==========================================================================
    // 12. COLLECT PACKAGE DATA OBJECT
    // ==========================================================================
    function getFormDataAsPackageObject() {
      const selectedIncludes = [];
      packageIncludeChks.forEach((chk) => {
        if (chk.checked) selectedIncludes.push(chk.value);
      });

      const selectedComp = [];
      complimentaryChks.forEach((chk) => {
        if (chk.checked) selectedComp.push(chk.value);
      });

      const existingId = editPackageIdInput.value.trim();
      const packageId = existingId || InventoryStore.generatePackageId();

      return {
        packageId: packageId,
        agentId: agentIdInput.value.trim().toUpperCase(),
        serviceType: selectedServiceType,
        packageTitle: packageTitleInput.value.trim(),
        departureDate: departureDateInput.value,
        duration: durationInput.value.trim(),
        pricePerPerson: parseFloat(priceInput.value) || 0,
        seatsLeft: seatsLeftInput ? seatsLeftInput.value.trim() : '',
        hotels: {
          makkah: {
            name: makkahHotelInput.value.trim(),
            distance: makkahDistInput.value.trim()
          },
          madinah: {
            name: madinahHotelInput.value.trim(),
            distance: madinahDistInput.value.trim()
          }
        },
        packageIncludes: selectedIncludes,
        complimentaryServices: selectedComp,
        importantNote: importantNoteInput.value.trim(),
        packageImage: currentUploadedImageData || '',
        bookingHelpline: bookingHelplineInput.value.trim(),
        supportEmail: supportEmailInput.value.trim(),
        status: 'Active'
      };
    }

    // ==========================================================================
    // 13. LOAD PACKAGE INTO FORM (FOR EDITING)
    // ==========================================================================
    function loadPackageIntoForm(pkg) {
      if (!pkg) return;

      editPackageIdInput.value = pkg.packageId;
      editBannerPkgId.textContent = pkg.packageId;
      editModeBanner.hidden = false;
      saveButtonLabel.textContent = 'Update Package';

      // Reset verification checkbox for security
      if (verifyPackageCheckbox) {
        verifyPackageCheckbox.checked = false;
      }
      btnSavePackage.disabled = true;

      // Set Service Type
      setServiceType(pkg.serviceType || 'Umrah');

      // Basic info
      agentIdInput.value = pkg.agentId || '';
      packageTitleInput.value = pkg.packageTitle || '';
      departureDateInput.value = pkg.departureDate || '';
      durationInput.value = pkg.duration || '';
      priceInput.value = pkg.pricePerPerson || '';
      if (seatsLeftInput) {
        seatsLeftInput.value = pkg.seatsLeft || '';
      }

      // Hotels
      makkahHotelInput.value = (pkg.hotels && pkg.hotels.makkah && pkg.hotels.makkah.name) || '';
      makkahDistInput.value = (pkg.hotels && pkg.hotels.makkah && pkg.hotels.makkah.distance) || '';
      madinahHotelInput.value = (pkg.hotels && pkg.hotels.madinah && pkg.hotels.madinah.name) || '';
      madinahDistInput.value = (pkg.hotels && pkg.hotels.madinah && pkg.hotels.madinah.distance) || '';

      // Inclusions
      const incList = pkg.packageIncludes || [];
      packageIncludeChks.forEach((chk) => {
        chk.checked = incList.includes(chk.value);
      });

      // Complimentary
      const compList = pkg.complimentaryServices || [];
      complimentaryChks.forEach((chk) => {
        chk.checked = compList.includes(chk.value);
      });

      // Note & Contacts
      importantNoteInput.value = pkg.importantNote || '';
      bookingHelplineInput.value = pkg.bookingHelpline || '+91 98765 43210';
      supportEmailInput.value = pkg.supportEmail || 'support@zilhaj.com';

      // Image
      if (pkg.packageImage) {
        currentUploadedImageData = pkg.packageImage;
        uploadedImageDisplay.src = pkg.packageImage;
        imagePreviewContainer.hidden = false;
        uploadPlaceholder.hidden = true;
      } else {
        currentUploadedImageData = '';
        uploadedImageDisplay.src = '';
        imagePreviewContainer.hidden = true;
        uploadPlaceholder.hidden = false;
      }

      clearAllValidationErrors();
      updateLivePreview();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function resetFormToDefault() {
      form.reset();
      editPackageIdInput.value = '';
      editModeBanner.hidden = true;
      saveButtonLabel.textContent = 'Upload Package';
      
      // Default to Umrah
      setServiceType('Umrah');

      if (verifyPackageCheckbox) {
        verifyPackageCheckbox.checked = false;
      }
      btnSavePackage.disabled = true;

      currentUploadedImageData = '';
      uploadedImageDisplay.src = '';
      imagePreviewContainer.hidden = true;
      uploadPlaceholder.hidden = false;

      bookingHelplineInput.value = '+91 98765 43210';
      supportEmailInput.value = 'support@zilhaj.com';

      // Re-check default checkboxes
      packageIncludeChks.forEach((chk) => (chk.checked = true));
      complimentaryChks.forEach((chk) => (chk.checked = true));

      clearAllValidationErrors();
      updateLivePreview();
    }

    cancelEditModeBtn.addEventListener('click', () => {
      resetFormToDefault();
      showToast('Edit Mode Cancelled', 'Form has been reset to new package creation.', 'info');
    });

    btnCancelForm.addEventListener('click', () => {
      if (confirm('Are you sure you want to cancel? Any unsaved changes will be discarded.')) {
        resetFormToDefault();
      }
    });

    // ==========================================================================
    // 14. SAVE & DUPLICATE PROTECTION HANDLER
    // ==========================================================================
    function commitPackageSave(packageObj, isUpdate = false) {
      InventoryStore.save(packageObj);
      updateInventoryBadge();

      if (isUpdate) {
        showToast('Package Updated', `Package ${packageObj.packageId} updated successfully.`, 'success');
      } else {
        showToast('Package Uploaded', 'Package uploaded successfully to ZILHAJ inventory.', 'success');
      }

      // Reset form and open inventory modal to show newly saved item
      resetFormToDefault();
      setTimeout(() => {
        openInventoryModal();
      }, 700);
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      if (!validateForm()) {
        return;
      }

      const isEditMode = Boolean(editPackageIdInput.value.trim());
      const packageObj = getFormDataAsPackageObject();

      // Check Duplicate
      const duplicateFound = InventoryStore.findDuplicate(packageObj, isEditMode ? packageObj.packageId : null);

      if (duplicateFound) {
        pendingDuplicatePackageData = {
          pkg: packageObj,
          isUpdate: isEditMode
        };

        duplicateDetailsBox.innerHTML = `
          <div><strong>Existing ID:</strong> ${sanitizeHtml(duplicateFound.packageId)}</div>
          <div><strong>Agent ID:</strong> ${sanitizeHtml(duplicateFound.agentId)}</div>
          <div><strong>Service:</strong> ${sanitizeHtml(duplicateFound.serviceType)} Package</div>
          <div><strong>Title:</strong> ${sanitizeHtml(duplicateFound.packageTitle)}</div>
          <div><strong>Departure:</strong> ${sanitizeHtml(duplicateFound.departureDate)}</div>
          <div><strong>Price:</strong> ₹${formatIndianCurrency(duplicateFound.pricePerPerson)}</div>
        `;

        duplicateWarningModal.hidden = false;
        return;
      }

      commitPackageSave(packageObj, isEditMode);
    });

    btnCancelDuplicate.addEventListener('click', () => {
      duplicateWarningModal.hidden = true;
      pendingDuplicatePackageData = null;
    });

    btnProceedDuplicate.addEventListener('click', () => {
      if (pendingDuplicatePackageData) {
        const { pkg, isUpdate } = pendingDuplicatePackageData;
        duplicateWarningModal.hidden = true;
        commitPackageSave(pkg, isUpdate);
        pendingDuplicatePackageData = null;
      }
    });

    // ==========================================================================
    // 15. INVENTORY DRAWER / MODAL CONTROLLER
    // ==========================================================================
    function updateInventoryBadge() {
      const all = InventoryStore.getAll();
      inventoryCountBadge.textContent = all.length;
    }

    function renderInventoryList() {
      const all = InventoryStore.getAll();
      const query = (inventorySearchInput.value || '').trim().toLowerCase();
      const serviceFilter = inventoryServiceFilter.value;
      const statusFilter = inventoryStatusFilter.value;

      const filtered = all.filter((pkg) => {
        const matchesService = serviceFilter === 'ALL' || (pkg.serviceType || '').toLowerCase() === serviceFilter.toLowerCase();
        const matchesStatus = statusFilter === 'ALL' || (pkg.status || 'Active').toLowerCase() === statusFilter.toLowerCase();

        const searchBlob = `${pkg.packageId} ${pkg.agentId} ${pkg.packageTitle} ${pkg.serviceType} ${(pkg.hotels && pkg.hotels.makkah && pkg.hotels.makkah.name) || ''} ${(pkg.hotels && pkg.hotels.madinah && pkg.hotels.madinah.name) || ''}`.toLowerCase();

        const matchesSearch = !query || searchBlob.includes(query);

        return matchesService && matchesStatus && matchesSearch;
      });

      inventorySummaryCount.textContent = `Showing ${filtered.length} of ${all.length} packages`;

      if (filtered.length === 0) {
        inventoryListContainer.innerHTML = `
          <div style="text-align:center; padding: 40px 20px; color: #64748b;">
            <svg style="width:40px;height:40px;margin-bottom:8px;color:#cbd5e1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <p style="font-weight:600;">No matching packages found</p>
            <p style="font-size:12px;margin-top:4px;">Try modifying your search keywords or filter criteria.</p>
          </div>
        `;
        return;
      }

      inventoryListContainer.innerHTML = filtered
        .map((pkg) => {
          const serviceClass = (pkg.serviceType || '').toLowerCase() === 'hajj' ? 'hajj' : 'umrah';
          const formattedPrice = formatIndianCurrency(pkg.pricePerPerson);
          const makkahHotel = (pkg.hotels && pkg.hotels.makkah && pkg.hotels.makkah.name) || 'Makkah Hotel';
          const madinahHotel = (pkg.hotels && pkg.hotels.madinah && pkg.hotels.madinah.name) || 'Madinah Hotel';

          return `
            <div class="inventory-pkg-card" data-id="${sanitizeHtml(pkg.packageId)}">
              <div class="pkg-main-info">
                <span class="pkg-service-badge ${serviceClass}">${sanitizeHtml(pkg.serviceType || 'Package')}</span>
                <div class="pkg-text-details">
                  <h4>${sanitizeHtml(pkg.packageTitle || 'Untitled Package')} <span style="font-size:12px;color:#64748b;font-weight:600;">(${sanitizeHtml(pkg.packageId)})</span></h4>
                  <div class="pkg-meta-row">
                    <span class="pkg-meta-item">Agent: <strong>${sanitizeHtml(pkg.agentId)}</strong></span>
                    <span class="pkg-meta-item">Departure: <strong>${sanitizeHtml(formatDateFriendly(pkg.departureDate))}</strong></span>
                    <span class="pkg-meta-item">Price: <strong style="color:#064e3b;">₹${formattedPrice}</strong></span>
                    ${pkg.seatsLeft ? `<span class="pkg-meta-item" style="color:#dc2626;">Seats Left: <strong>${sanitizeHtml(pkg.seatsLeft)}</strong></span>` : ''}
                    <span class="pkg-meta-item">Hotels: <strong>${sanitizeHtml(makkahHotel)}</strong> &amp; <strong>${sanitizeHtml(madinahHotel)}</strong></span>
                  </div>
                </div>
              </div>

              <div class="pkg-actions-group">
                <button type="button" class="btn-pkg-action btn-pkg-edit" data-action="edit" data-id="${sanitizeHtml(pkg.packageId)}">
                  Edit
                </button>
                <button type="button" class="btn-pkg-action btn-pkg-del" data-action="delete" data-id="${sanitizeHtml(pkg.packageId)}" title="Delete package">
                  Delete
                </button>
              </div>
            </div>
          `;
        })
        .join('');
    }

    function openInventoryModal() {
      renderInventoryList();
      inventoryModal.hidden = false;
    }

    function closeInventoryModal() {
      inventoryModal.hidden = true;
    }

    viewInventoryBtn.addEventListener('click', openInventoryModal);
    closeInventoryModalBtn.addEventListener('click', closeInventoryModal);

    btnNewPackageFromModal.addEventListener('click', () => {
      closeInventoryModal();
      resetFormToDefault();
    });

    inventorySearchInput.addEventListener('input', renderInventoryList);
    inventoryServiceFilter.addEventListener('change', renderInventoryList);
    inventoryStatusFilter.addEventListener('change', renderInventoryList);

    inventoryListContainer.addEventListener('click', (e) => {
      const target = e.target.closest('button[data-action]');
      if (!target) return;

      const action = target.getAttribute('data-action');
      const pkgId = target.getAttribute('data-id');

      if (action === 'edit') {
        const pkg = InventoryStore.getById(pkgId);
        if (pkg) {
          closeInventoryModal();
          loadPackageIntoForm(pkg);
          showToast('Loaded Package', `Package ${pkgId} loaded into editor.`, 'info');
        }
      } else if (action === 'delete') {
        if (confirm(`Are you sure you want to delete package ${pkgId} from ZILHAJ inventory?`)) {
          InventoryStore.delete(pkgId);
          updateInventoryBadge();
          renderInventoryList();
          showToast('Package Deleted', `Package ${pkgId} was removed from inventory.`, 'warning');
        }
      }
    });

    // Close Modals on click outside
    window.addEventListener('click', (e) => {
      if (e.target === inventoryModal) {
        closeInventoryModal();
      }
      if (e.target === duplicateWarningModal) {
        duplicateWarningModal.hidden = true;
      }
      if (e.target === logoutConfirmModal) {
        logoutConfirmModal.hidden = true;
      }
    });

    // ==========================================================================
    // 16. TOP HEADER NOTIFICATIONS & PROFILE DROPDOWNS
    // ==========================================================================
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = notifMenu.hidden;
      notifMenu.hidden = !isHidden;
      profileMenu.hidden = true;
      notifBtn.setAttribute('aria-expanded', String(isHidden));
    });

    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = profileMenu.hidden;
      profileMenu.hidden = !isHidden;
      notifMenu.hidden = true;
      profileBtn.setAttribute('aria-expanded', String(isHidden));
    });

    document.addEventListener('click', () => {
      notifMenu.hidden = true;
      profileMenu.hidden = true;
      notifBtn.setAttribute('aria-expanded', 'false');
      profileBtn.setAttribute('aria-expanded', 'false');
    });

    markAllReadBtn.addEventListener('click', () => {
      document.querySelectorAll('.notif-item.unread').forEach((item) => {
        item.classList.remove('unread');
      });
      notifBadge.style.display = 'none';
      showToast('Notifications', 'All notifications marked as read.', 'info');
    });

    // Profile Dropdown Actions
    if (userProfileBtn) {
      userProfileBtn.addEventListener('click', () => {
        profileMenu.hidden = true;
        showToast('Partner Operations Profile', 'Logged in as Partner Operations Specialist.', 'info');
      });
    }

    if (userSettingsBtn) {
      userSettingsBtn.addEventListener('click', () => {
        profileMenu.hidden = true;
        showToast('Settings', 'Partner Operations preferences and inventory sync settings.', 'info');
      });
    }

    // Logout Modal Action
    if (userLogoutBtn) {
      userLogoutBtn.addEventListener('click', () => {
        profileMenu.hidden = true;
        logoutConfirmModal.hidden = false;
      });
    }

    if (btnCancelLogout) {
      btnCancelLogout.addEventListener('click', () => {
        logoutConfirmModal.hidden = true;
      });
    }

    if (btnConfirmLogout) {
      btnConfirmLogout.addEventListener('click', () => {
        logoutConfirmModal.hidden = true;
        showToast('Logged Out', 'You have been safely logged out of Partner Operations.', 'info');
      });
    }

    // ==========================================================================
    // 17. URL QUERY PARAM EDIT CHECK & INITIALIZATION
    // ==========================================================================
    function checkUrlQueryParam() {
      const urlParams = new URLSearchParams(window.location.search);
      const editId = urlParams.get('id') || urlParams.get('edit') || urlParams.get('packageId');
      if (editId) {
        const pkg = InventoryStore.getById(editId);
        if (pkg) {
          loadPackageIntoForm(pkg);
          showToast('Loaded Package', `Loaded ${editId} from URL parameter.`, 'info');
          return;
        }
      }

      // Default: Initial live preview update with Umrah default
      setServiceType('Umrah');
    }

    // Init
    updateInventoryBadge();
    checkUrlQueryParam();
  });
})();
