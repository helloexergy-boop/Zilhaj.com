// ==========================================================================
// ZILHAJ.COM - INTERACTIVE JAVASCRIPT LOGIC
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {

  // ------------------------------------------------------------------------
  // 1. SIDEBAR TAB NAVIGATION
  // ------------------------------------------------------------------------
  const sidebarLinks = document.querySelectorAll('.sidebar-link');
  const tabPanes = document.querySelectorAll('.tab-pane');

  window.switchTab = (targetTab) => {
    sidebarLinks.forEach(l => {
      l.classList.remove('active');
      if (l.getAttribute('data-tab') === targetTab) {
        l.classList.add('active');
      }
    });

    tabPanes.forEach(pane => {
      pane.classList.remove('active');
      if (pane.id === `tab-${targetTab}`) {
        pane.classList.add('active');
      }
    });

    // Toggle full-width mode for submit-request tab (expands app-container & removes left sidebar on this page only)
    const appContainer = document.querySelector('.app-container');
    const mainLayout = document.querySelector('.main-layout');

    if (targetTab === 'submit-request') {
      if (appContainer) appContainer.classList.add('full-width-mode');
      if (mainLayout) mainLayout.classList.add('full-width-mode');
    } else {
      if (appContainer) appContainer.classList.remove('full-width-mode');
      if (mainLayout) mainLayout.classList.remove('full-width-mode');
    }

    // Scroll smoothly to top of content
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  sidebarLinks.forEach(link => {
    link.addEventListener('click', () => {
      const targetTab = link.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  // ------------------------------------------------------------------------
  // 2. "+ NEW REQUEST" BUTTON DIRECT FORM TRIGGER
  // ------------------------------------------------------------------------
  const btnOpenNewRequest = document.getElementById('btnOpenNewRequestModal');
  if (btnOpenNewRequest) {
    btnOpenNewRequest.addEventListener('click', () => {
      switchTab('submit-request');
    });
  }

  // ------------------------------------------------------------------------
  // 3. "APPLYING FOR" DYNAMIC HEADING & FIELD VISIBILITY UPDATE
  // ------------------------------------------------------------------------
  const applyingForSelect = document.getElementById('applyingForSelect');
  const submitFormHeading = document.getElementById('submitFormHeading');
  const submitFormSub = document.getElementById('submitFormSub');
  const departureDateInput = document.getElementById('departureDateInput');
  const durationSelect = document.getElementById('durationSelect');

  const updateApplyingForState = (selectedType) => {
    const departureGroup = departureDateInput ? departureDateInput.closest('.form-field-group') : null;
    const durationGroup = durationSelect ? durationSelect.closest('.form-field-group') : null;

    if (selectedType === 'Hajj') {
      if (submitFormHeading) submitFormHeading.textContent = 'Submit Hajj Request';
      if (submitFormSub) submitFormSub.textContent = "Fill out the details below to receive personalized Hajj package quotes. Our partner agencies will craft itineraries tailored specifically to your group's needs and preferences.";

      if (departureGroup) departureGroup.style.display = 'none';
      if (durationGroup) durationGroup.style.display = 'none';
      if (departureDateInput) departureDateInput.removeAttribute('required');
    } else {
      if (submitFormHeading) submitFormHeading.textContent = 'Submit Umrah Request';
      if (submitFormSub) submitFormSub.textContent = "Fill out the details below to receive personalized Umrah package quotes. Our partner agencies will craft itineraries tailored specifically to your group's needs and preferences.";

      if (departureGroup) departureGroup.style.display = '';
      if (durationGroup) durationGroup.style.display = '';
      if (departureDateInput) departureDateInput.setAttribute('required', 'true');
    }
  };

  if (applyingForSelect) {
    applyingForSelect.addEventListener('change', (e) => {
      updateApplyingForState(e.target.value);
    });
    // Initialize on load
    updateApplyingForState(applyingForSelect.value);
  }

  // ------------------------------------------------------------------------
  // 4. INDIAN STATES & DISTRICTS DEPENDENT DROPDOWN MAPPING
  // ------------------------------------------------------------------------
  const stateDistrictMap = {
    "Andaman & Nicobar Islands": ["Nicobar", "North and Middle Andaman", "South Andaman"],
    "Andhra Pradesh": ["Ananthapuramu", "Anakapalli", "Annamayya", "Bapatla", "Chittoor", "East Godavari", "Eluru", "Guntur", "Kakinada", "Konaseema", "Krishna", "Kurnool", "Nandyal", "NTR (Vijayawada)", "Palnadu", "Parvathipuram Manyam", "Prakasam", "Sri Potti Sriramulu Nellore", "Sri Sathya Sai", "Srikakulam", "Tirupati", "Visakhapatnam", "Vizianagaram", "West Godavari", "YSR Kadapa"],
    "Arunachal Pradesh": ["Anjaw", "Changlang", "Dibang Valley", "East Kameng", "East Siang", "Itanagar Capital Complex", "Kamle", "Kra Daadi", "Kurung Kumey", "Lepa Rada", "Lohit", "Longding", "Lower Dibang Valley", "Lower Subansiri", "Namsai", "Pakke Kessang", "Papum Pare", "Shi Yomi", "Siang", "Tawang", "Tirap", "Upper Siang", "Upper Subansiri", "West Kameng", "West Siang"],
    "Assam": ["Baksa", "Barpeta", "Biswanath", "Bongaigaon", "Cachar", "Charaideo", "Chirang", "Darrang", "Dhemaji", "Dhubri", "Dibrugarh", "Dima Hasao", "Goalpara", "Golaghat", "Hailakandi", "Hojai", "Jorhat", "Kamrup", "Kamrup Metropolitan (Guwahati)", "Karbi Anglong", "Karimganj", "Kokrajhar", "Lakhimpur", "Majuli", "Morigaon", "Nagaon", "Nalbari", "Sivasagar", "Sonitpur", "South Salmara-Mankachar", "Tinsukia", "Udalguri", "West Karbi Anglong"],
    "Bihar": ["Araria", "Arwal", "Aurangabad", "Banka", "Begusarai", "Bhagalpur", "Bhojpur (Arrah)", "Buxar", "Darbhanga", "East Champaran (Motihari)", "Gaya", "Gopalganj", "Jamui", "Jehanabad", "Kaimur (Bhabua)", "Katihar", "Khagaria", "Kishanganj", "Lakhisarai", "Madhepura", "Madhubani", "Munger", "Muzaffarpur", "Nalanda (Bihar Sharif)", "Nawada", "Patna", "Purnia", "Rohtas (Sasaram)", "Saharsa", "Samastipur", "Saran (Chhapra)", "Sheikhpura", "Sheohar", "Sitamarhi", "Siwan", "Supaul", "Vaishali (Hajipur)", "West Champaran (Bettiah)"],
    "Chandigarh": ["Chandigarh"],
    "Chhattisgarh": ["Balod", "Baloda Bazar", "Balrampur", "Bastar (Jagdalpur)", "Bemetara", "Bijapur", "Bilaspur", "Dantewada", "Dhamtari", "Durg", "Gariaband", "Gaurela-Pendra-Marwahi", "Janjgir-Champa", "Jashpur", "Kabirdham (Kawardha)", "Kanker", "Khairagarh", "Kondagaon", "Korba", "Koriya", "Mahasamund", "Manendragarh", "Mohla-Manpur", "Mungeli", "Narayanpur", "Raigarh", "Raipur", "Rajnandgaon", "Sarangarh-Bilaigarh", "Sukma", "Surajpur", "Surguja (Ambikapur)"],
    "Dadra & Nagar Haveli and Daman & Diu": ["Dadra & Nagar Haveli (Silvassa)", "Daman", "Diu"],
    "Delhi": ["Central Delhi", "East Delhi", "New Delhi", "North Delhi", "North East Delhi", "North West Delhi", "Shahdara", "South Delhi", "South East Delhi", "South West Delhi", "West Delhi"],
    "Goa": ["North Goa (Panaji)", "South Goa (Margao)"],
    "Gujarat": ["Ahmedabad", "Amreli", "Anand", "Aravalli", "Banaskantha (Palanpur)", "Bharuch", "Bhavnagar", "Botad", "Chhota Udaipur", "Dahod", "Dang (Ahwa)", "Devbhumi Dwarka", "Gandhinagar", "Gir Somnath", "Jamnagar", "Junagadh", "Kheda (Nadiad)", "Kutch (Bhuj)", "Mahisagar", "Mehsana", "Morbi", "Narmada (Rajpipla)", "Navsari", "Panchmahal (Godhra)", "Patan", "Porbandar", "Rajkot", "Sabarkantha (Himmatnagar)", "Surat", "Surendranagar", "Tapi (Vyara)", "Vadodara", "Valsad"],
    "Haryana": ["Ambala", "Bhiwani", "Charkhi Dadri", "Faridabad", "Fatehabad", "Gurugram", "Hisar", "Jhajjar", "Jind", "Kaithal", "Karnal", "Kurukshetra", "Mahendragarh", "Nuh", "Palwal", "Panchkula", "Panipat", "Rewari", "Rohtak", "Sirsa", "Sonipat", "Yamunanagar"],
    "Himachal Pradesh": ["Bilaspur", "Chamba", "Hamirpur", "Kangra (Dharamshala)", "Kinnaur", "Kullu", "Lahaul and Spiti", "Mandi", "Shimla", "Sirmaur", "Solan", "Una"],
    "Jammu & Kashmir": ["Anantnag", "Bandipora", "Baramulla", "Budgam", "Doda", "Ganderbal", "Jammu", "Kathua", "Kishtwar", "Kulgam", "Kupwara", "Poonch", "Pulwama", "Rajouri", "Ramban", "Reasi", "Samba", "Shopian", "Srinagar", "Udhampur"],
    "Jharkhand": ["Bokaro", "Chatra", "Deoghar", "Dhanbad", "Dumka", "East Singhbhum (Jamshedpur)", "Garhwa", "Giridih", "Godda", "Gumla", "Hazaribagh", "Jamtara", "Khunti", "Koderma", "Latehar", "Lohardaga", "Pakur", "Palamu", "Ramgarh", "Ranchi", "Sahebganj", "Saraikela Kharsawan", "Simdega", "West Singhbhum (Chaibasa)"],
    "Karnataka": ["Bagalkote", "Ballari", "Belagavi", "Bengaluru Rural", "Bengaluru Urban", "Bidar", "Chamarajanagara", "Chikkaballapura", "Chikkamagaluru", "Chitradurga", "Dakshina Kannada (Mangaluru)", "Davanagere", "Dharwad (Hubballi)", "Gadag", "Hassan", "Haveri", "Kalaburagi", "Kodagu (Madikeri)", "Kolar", "Koppal", "Mandya", "Mysuru", "Raichur", "Ramanagara", "Shivamogga", "Tumakuru", "Udupi", "Uttara Kannada (Karwar)", "Vijayanagara", "Vijayapura", "Yadgir"],
    "Kerala": ["Alappuzha", "Ernakulam (Kochi)", "Idukki", "Kannur", "Kasaragod", "Kollam", "Kottayam", "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta", "Thiruvananthapuram", "Thrissur", "Wayanad"],
    "Ladakh": ["Kargil", "Leh"],
    "Lakshadweep": ["Agatti", "Amini", "Andrott", "Kavaratti", "Minicoy"],
    "Madhya Pradesh": ["Agar Malwa", "Alirajpur", "Anuppur", "Ashoknagar", "Balaghat", "Barwani", "Betul", "Bhind", "Bhopal", "Burhanpur", "Chhatarpur", "Chhindwara", "Damoh", "Datia", "Dewas", "Dhar", "Dindori", "Guna", "Gwalior", "Harda", "Hoshangabad (Narmadapuram)", "Indore", "Jabalpur", "Jhabua", "Katni", "Khandwa", "Khargone", "Mandla", "Mandsaur", "Morena", "Narsinghpur", "Neemuch", "Panna", "Raisen", "Rajgarh", "Ratlam", "Rewa", "Sagar", "Satna", "Sehore", "Seoni", "Shahdol", "Shajapur", "Sheopur", "Shivpuri", "Sidhi", "Singrauli", "Tikamgarh", "Ujjain", "Umaria", "Vidisha"],
    "Maharashtra": ["Ahmednagar", "Akola", "Amravati", "Aurangabad (Chhatrapati Sambhaji Nagar)", "Beed", "Bhandara", "Buldhana", "Chandrapur", "Dhule", "Gadchiroli", "Gondia", "Hingoli", "Jalgaon", "Jalna", "Kolhapur", "Latur", "Mumbai City", "Mumbai Suburban", "Nagpur", "Nanded", "Nandurbar", "Nashik", "Osmanabad (Dharashiv)", "Palghar", "Parbhani", "Pune", "Raigad", "Ratnagiri", "Sangli", "Satara", "Sindhudurg", "Solapur", "Thane", "Wardha", "Washim", "Yavatmal"],
    "Manipur": ["Bishnupur", "Chandel", "Churachandpur", "Imphal East", "Imphal West", "Jiribam", "Kakching", "Kamjong", "Kangpokpi", "Noney", "Pherzawl", "Senapati", "Tamenglong", "Tengnoupal", "Thoubal", "Ukhrul"],
    "Meghalaya": ["East Garo Hills", "East Jaintia Hills", "East Khasi Hills (Shillong)", "Eastern West Khasi Hills", "North Garo Hills", "Ri-Bhoi", "South Garo Hills", "South West Garo Hills", "South West Khasi Hills", "West Garo Hills (Tura)", "West Jaintia Hills", "West Khasi Hills"],
    "Mizoram": ["Aizawl", "Champhai", "Hnahthial", "Khawzawl", "Kolasib", "Lawngtlai", "Lunglei", "Mamit", "Saitual", "Serchhip", "Siaha"],
    "Nagaland": ["Ch├╝moukedima", "Dimapur", "Kiphire", "Kohima", "Longleng", "Mokokchung", "Mon", "Niuland", "Noklak", "Peren", "Phek", "Shamator", "Tseminyu", "Tuensang", "Wokha", "Zunheboto"],
    "Odisha": ["Angul", "Balangir", "Balasore", "Bargarh", "Bhadrak", "Boudh", "Cuttack", "Deogarh", "Dhenkanal", "Gajapati", "Ganjam (Berhampur)", "Jagatsinghpur", "Jajpur", "Jharsuguda", "Kalahandi", "Kandhamal", "Kendrapara", "Kendujhar (Keonjhar)", "Khurda (Bhubaneswar)", "Koraput", "Malkangiri", "Mayurbhanj", "Nabarangpur", "Nayagarh", "Nuapada", "Puri", "Rayagada", "Sambalpur", "Subarnapur", "Sundergarh (Rourkela)"],
    "Puducherry": ["Karaikal", "Mahe", "Puducherry", "Yanam"],
    "Punjab": ["Amritsar", "Barnala", "Bathinda", "Faridkot", "Fatehgarh Sahib", "Fazilka", "Firozpur", "Gurdaspur", "Hoshiarpur", "Jalandhar", "Kapurthala", "Ludhiana", "Malerkotla", "Mansa", "Moga", "Mohali (SAS Nagar)", "Muktsar", "Pathankot", "Patiala", "Rupnagar (Ropar)", "Sangrur", "Shaheed Bhagat Singh Nagar (Nawanshahr)", "Tarn Taran"],
    "Rajasthan": ["Ajmer", "Alwar", "Anupgarh", "Balotra", "Banswara", "Baran", "Barmer", "Beawar", "Bharatpur", "Bhilwara", "Bikaner", "Bundi", "Chittorgarh", "Churu", "Dausa", "Deeg", "Dholpur", "Didwana-Kuchaman", "Dudu", "Dungarpur", "Ganganagar", "Gangapur City", "Hanumangarh", "Jaipur", "Jaipur Rural", "Jaisalmer", "Jalore", "Jhalawar", "Jhunjhunu", "Jodhpur", "Jodhpur Rural", "Karauli", "Kekri", "Kota", "Kotputli-Behror", "Khairthal-Tijara", "Nagaur", "Neem Ka Thana", "Pali", "Phalodi", "Pratapgarh", "Rajsamand", "Salumbar", "Sanchi", "Sawai Madhopur", "Shahpura", "Sikar", "Sirohi", "Tonk", "Udaipur"],
    "Sikkim": ["East Sikkim (Gangtok)", "North Sikkim (Mangan)", "Pakyong", "Soreng", "South Sikkim (Namchi)", "West Sikkim (Gyalshing)"],
    "Tamil Nadu": ["Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri", "Dindigul", "Erode", "Kanchipuram", "Kanyakumari (Nagercoil)", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai", "Nagapattinam", "Namakkal", "Nilgiris (Ooty)", "Perambalur", "Pudukkottai", "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "Theni", "Thoothukudi (Tuticorin)", "Tiruchirappalli", "Tirunelveli", "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram", "Virudhunagar"],
    "Telangana": ["Adilabad", "Bhadradri Kothagudem", "Hanamkonda", "Hyderabad", "Jagtial", "Jangaon", "Jayashankar Bhupalpally", "Jogulamba Gadwal", "Kamareddy", "Karimnagar", "Khammam", "Kumuram Bheem Asifabad", "Mahabubabad", "Mahabubnagar", "Mancherial", "Medak", "Medchal-Malkajgiri", "Mulugu", "Nagarkurnool", "Nalgonda", "Narayanpet", "Nirmal", "Nizamabad", "Peddapalli", "Rajanna Sircilla", "Ranga Reddy", "Sangareddy", "Siddipet", "Suryapet", "Vikarabad", "Wanaparthy", "Warangal", "Yadadri Bhuvanagiri"],
    "Tripura": ["Dhalai", "Gomati", "Khowai", "North Tripura", "Sepahijala", "South Tripura", "Unakoti", "West Tripura (Agartala)"],
    "Uttar Pradesh": ["Agra", "Aligarh", "Allahabad (Prayagraj)", "Ambedkar Nagar", "Amethi", "Amroha", "Auraiya", "Azamgarh", "Baghpat", "Bahraich", "Ballia", "Balrampur", "Banda", "Barabanki", "Bareilly", "Basti", "Bhadohi", "Bijnor", "Budaun", "Bulandshahr", "Chandauli", "Chitrakoot", "Deoria", "Etah", "Etawah", "Ayodhya (Faizabad)", "Farrukhabad", "Fatehpur", "Firozabad", "Gautam Buddha Nagar (Noida)", "Ghaziabad", "Ghazipur", "Gonda", "Gorakhpur", "Hamirpur", "Hapur", "Hardoi", "Hathras", "Jalaun", "Jaunpur", "Jhansi", "Kannauj", "Kanpur Dehat", "Kanpur Nagar", "Kasganj", "Kaushambi", "Kheri (Lakhimpur)", "Kushinagar", "Lalitpur", "Lucknow", "Maharajganj", "Mahoba", "Mainpuri", "Mathura", "Mau", "Meerut", "Mirzapur", "Moradabad", "Muzaffarnagar", "Pilibhit", "Pratapgarh", "Rae Bareli", "Rampur", "Saharanpur", "Sambhal", "Sant Kabir Nagar", "Shahjahanpur", "Shamli", "Shravasti", "Siddharthnagar", "Sitapur", "Sonbhadra", "Sultanpur", "Unnao", "Varanasi"],
    "Uttarakhand": ["Almora", "Bageshwar", "Chamoli", "Champawat", "Dehradun", "Haridwar", "Nainital", "Pauri Garhwal", "Pithoragarh", "Rudraprayag", "Tehri Garhwal", "Udham Singh Nagar (Rudrapur)", "Uttarkashi"],
    "West Bengal": ["Alipurduar", "Bankura", "Birbhum", "Cooch Behar", "Dakshin Dinajpur", "Darjeeling", "Hooghly", "Howrah", "Jalpaiguri", "Jhargram", "Kalimpong", "Kolkata", "Malda", "Murshidabad", "Nadia", "North 24 Parganas", "Paschim Bardhaman (Durgapur/Asansol)", "Paschim Medinipur", "Purba Bardhaman", "Purba Medinipur", "Purulia", "South 24 Parganas", "Uttar Dinajpur"]
  };

  const stateSelect = document.getElementById('stateSelect');
  const districtSelect = document.getElementById('districtSelect');

  if (stateSelect && districtSelect) {
    stateSelect.addEventListener('change', (e) => {
      const selectedState = e.target.value;
      districtSelect.innerHTML = '<option value="" disabled selected>Select District/City</option>';
      
      const districts = stateDistrictMap[selectedState];
      if (districts && districts.length > 0) {
        districtSelect.disabled = false;
        // Sort districts alphabetically
        [...districts].sort().forEach(dist => {
          const opt = document.createElement('option');
          opt.value = dist;
          opt.textContent = dist;
          districtSelect.appendChild(opt);
        });
      } else {
        districtSelect.disabled = true;
      }
    });
  }

  // ------------------------------------------------------------------------
  // 5. MOBILE NUMBER REAL-TIME RESTRICTION & VALIDATION
  // ------------------------------------------------------------------------
  const mobileInput = document.getElementById('mobileInput');
  const mobileError = document.getElementById('mobileError');

  window.validateMobile = () => {
    if (!mobileInput) return true;
    const val = mobileInput.value.trim();
    const isValid = /^[6-9]\d{9}$/.test(val);

    if (!isValid) {
      mobileInput.classList.add('input-error');
      if (mobileError) mobileError.style.display = 'block';
      return false;
    } else {
      mobileInput.classList.remove('input-error');
      if (mobileError) mobileError.style.display = 'none';
      return true;
    }
  };

  if (mobileInput) {
    // Restrict input to digits only in real-time
    mobileInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
      if (mobileInput.classList.contains('input-error')) {
        window.validateMobile();
      }
    });

    mobileInput.addEventListener('blur', () => {
      if (mobileInput.value.length > 0) {
        window.validateMobile();
      }
    });
  }

  // ------------------------------------------------------------------------
  // 6. ROOM TYPE & LOCATION PREFERENCE TOGGLES
  // ------------------------------------------------------------------------
  const roomTypeButtons = document.querySelectorAll('.btn-room-type');
  roomTypeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      roomTypeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  const locationButtons = document.querySelectorAll('.btn-location-type');
  const locationPrefInput = document.getElementById('locationPrefInput');
  locationButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      locationButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (locationPrefInput) {
        locationPrefInput.value = btn.getAttribute('data-location');
      }
    });
  });

  // ------------------------------------------------------------------------
  // 5. SINGLE SHARED GLOBAL STATUS TRACKER (DYNAMIC ON HOVER)
  // ------------------------------------------------------------------------
  window.updateGlobalTracker = (cardElement) => {
    if (!cardElement) return;

    const reqId = cardElement.getAttribute('data-req-id') || 'REQ-5417';
    const step1 = cardElement.getAttribute('data-step1-status') || 'completed';
    const step2 = cardElement.getAttribute('data-step2-status') || 'pending';
    const step3 = cardElement.getAttribute('data-step3-status') || 'pending';
    const step4 = cardElement.getAttribute('data-step4-status') || 'pending';

    const badgeEl = cardElement.querySelector('.req-header-right .badge');
    const badgeText = badgeEl ? badgeEl.textContent.trim() : 'Waiting for Offers';

    const globalTrackerReqId = document.getElementById('globalTrackerReqId');
    const globalTrackerStatusBadge = document.getElementById('globalTrackerStatusBadge');
    const globalTrackerTimeline = document.getElementById('globalTrackerTimeline');

    if (globalTrackerReqId) globalTrackerReqId.textContent = reqId;
    if (globalTrackerStatusBadge) {
      globalTrackerStatusBadge.textContent = badgeText;
      if (badgeText.includes('Selected')) {
        globalTrackerStatusBadge.className = 'tracker-badge-pill badge-verified';
      } else if (badgeText.includes('Available')) {
        globalTrackerStatusBadge.className = 'tracker-badge-pill badge-available';
      } else {
        globalTrackerStatusBadge.className = 'tracker-badge-pill badge-waiting';
      }
    }

    const stepsData = [
      { name: 'Request Received', status: step1, hasLine: true },
      { name: 'Collecting Offers', status: step2, hasLine: true },
      { name: 'Offers Ready', status: step3, hasLine: true },
      { name: 'You Choose', status: step4, hasLine: false }
    ];

    if (globalTrackerTimeline) {
      globalTrackerTimeline.innerHTML = stepsData.map((step) => {
        let iconMarkup = '';
        let statusText = 'Pending';
        let stepClass = 'step-pending';

        if (step.status === 'completed') {
          stepClass = 'step-completed';
          statusText = 'Completed';
          iconMarkup = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        } else if (step.status === 'in_progress') {
          stepClass = 'step-active';
          statusText = 'In Progress';
          iconMarkup = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
        } else {
          iconMarkup = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E9D95" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path></svg>`;
        }

        const lineMarkup = step.hasLine ? `<div class="timeline-line ${step.status === 'completed' ? 'solid' : 'dashed'}"></div>` : '';

        return `
          <div class="timeline-step ${stepClass}">
            <div class="step-icon-box ${step.status === 'in_progress' ? 'pulse' : ''}">
              ${iconMarkup}
            </div>
            <div class="step-label-block">
              <span class="step-name">${step.name}</span>
              <span class="step-status ${step.status === 'in_progress' ? 'active-text' : ''}">${statusText}</span>
            </div>
            ${lineMarkup}
          </div>
        `;
      }).join('');
    }
  };

  const requestsList = document.getElementById('requestsList');

  if (requestsList) {
    // Dynamic updates on cursor hover over any request card box
    requestsList.addEventListener('mouseover', (e) => {
      const card = e.target.closest('.request-card-box');
      if (card) {
        updateGlobalTracker(card);
      }
    });

    // Initialize Tracker with the first request card on page load
    const firstCard = requestsList.querySelector('.request-card-box');
    if (firstCard) {
      updateGlobalTracker(firstCard);
    }
  }

  // ------------------------------------------------------------------------
  // REUSABLE BODY SCROLL-LOCK FOR MODALS
  // ------------------------------------------------------------------------
  let savedScrollY = 0;

  window.lockBodyScroll = function() {
    if (document.body.style.position !== 'fixed') {
      savedScrollY = window.scrollY || window.pageYOffset || 0;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${savedScrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    }
  };

  window.unlockBodyScroll = function() {
    setTimeout(() => {
      const activeModals = document.querySelectorAll('.modal-backdrop');
      let anyVisible = false;
      activeModals.forEach(m => {
        if (m.style.display && m.style.display !== 'none') {
          anyVisible = true;
        }
      });

      if (anyVisible) return;

      if (document.body.style.position === 'fixed') {
        const scrollYToRestore = savedScrollY;
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollYToRestore);
      }
    }, 0);
  };

  // ------------------------------------------------------------------------
  // 6. CONFIRMATION MODAL HANDLERS
  // ------------------------------------------------------------------------
  let latestSubmittedCard = null;

  const modal = document.getElementById('requestConfirmationModal');
  const modalReqIdCode = document.getElementById('modalReqIdCode');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const btnModalGoRequests = document.getElementById('btnModalGoRequests');
  const btnModalViewRequest = document.getElementById('btnModalViewRequest');
  const btnCopyReqId = document.getElementById('btnCopyReqId');
  const copyTooltip = document.getElementById('copyTooltip');

  window.openConfirmationModal = (reqId, cardElement) => {
    latestSubmittedCard = cardElement;
    if (modalReqIdCode) modalReqIdCode.textContent = reqId;
    if (modal) {
      modal.style.display = 'flex';
      lockBodyScroll();
    }
  };

  window.closeConfirmationModal = () => {
    if (modal) modal.style.display = 'none';
    unlockBodyScroll();
  };

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeConfirmationModal);
  
  if (btnModalGoRequests) {
    btnModalGoRequests.addEventListener('click', () => {
      closeConfirmationModal();
      switchTab('requests');
    });
  }

  if (btnModalViewRequest) {
    btnModalViewRequest.addEventListener('click', () => {
      closeConfirmationModal();
      switchTab('requests');
      if (latestSubmittedCard) {
        latestSubmittedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        updateGlobalTracker(latestSubmittedCard);
      }
    });
  }

  if (btnCopyReqId) {
    btnCopyReqId.addEventListener('click', () => {
      const code = modalReqIdCode ? modalReqIdCode.textContent : '';
      if (code) {
        navigator.clipboard.writeText(code).then(() => {
          if (copyTooltip) copyTooltip.textContent = 'Copied!';
          setTimeout(() => {
            if (copyTooltip) copyTooltip.textContent = 'Copy';
          }, 2000);
        }).catch(() => {
          if (copyTooltip) copyTooltip.textContent = 'Copied!';
        });
      }
    });
  }

  // ------------------------------------------------------------------------
  // 7. FULL FORM SUBMISSION LOGIC
  // ------------------------------------------------------------------------
  const fullRequestForm = document.getElementById('fullRequestForm');

  if (fullRequestForm) {
    fullRequestForm.addEventListener('submit', (e) => {
      e.preventDefault();

      if (window.validateMobile && !window.validateMobile()) {
        const mobileIn = document.getElementById('mobileInput');
        if (mobileIn) mobileIn.focus();
        alert('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
        return;
      }

      const applyingFor = document.getElementById('applyingForSelect').value;
      const departureCity = document.getElementById('cityDepartureSelect').value || 'Srinagar';
      const rawDate = document.getElementById('departureDateInput')?.value;
      const duration = document.getElementById('durationSelect')?.value;
      const hotelCategoryEl = document.querySelector('input[name="hotelCategory"]:checked');
      const hotelCategory = hotelCategoryEl ? hotelCategoryEl.value : '5 Star';
      
      const maleCount = parseInt(document.getElementById('maleCount').textContent) || 0;
      const femaleCount = parseInt(document.getElementById('femaleCount').textContent) || 0;
      const childCount = parseInt(document.getElementById('childCount').textContent) || 0;
      const infantCount = parseInt(document.getElementById('infantCount').textContent) || 0;

      const totalAdults = maleCount + femaleCount;
      const totalPersons = maleCount + femaleCount + childCount + infantCount;

      const fullname = document.getElementById('fullnameInput')?.value || '012 Palak Badyal';
      const mobile = document.getElementById('mobileInput')?.value || '+91 98765 43210';
      const email = document.getElementById('emailInput')?.value || 'palakbadyal69@gmail.com';
      const address = document.getElementById('addressInput')?.value || 'Nowgam, Srinagar, J&K';
      const stateVal = document.getElementById('stateSelect')?.value || 'Jammu & Kashmir';
      const districtVal = document.getElementById('districtSelect')?.value || departureCity;
      const rawSpecialReq = document.getElementById('specialReqInput')?.value.trim();
      const specialReq = rawSpecialReq || 'None specified';
      const escapedSpecialReq = specialReq.replace(/'/g, "\\'");

      // Format date & duration (with Hajj fallbacks if hidden)
      const isHajj = applyingFor === 'Hajj';
      const dateObj = rawDate ? new Date(rawDate) : new Date();
      const formattedDate = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const displayDateStr = (isHajj && !rawDate) ? 'Flexible (Hajj Season)' : formattedDate;
      const displayDuration = isHajj ? (duration || 'Hajj Season') : (duration || '12-14 Days');

      // Generate random REQ Code
      const randomReqId = `REQ-${Math.floor(1000 + Math.random() * 9000)}`;

      // Create new self-contained request card element with integrated tracker and 5-field info grid
      const newCard = document.createElement('div');
      newCard.className = 'request-card-box';
      newCard.setAttribute('data-req-id', randomReqId);
      newCard.setAttribute('data-step1-status', 'completed');
      newCard.setAttribute('data-step2-status', 'in_progress');
      newCard.setAttribute('data-step3-status', 'pending');
      newCard.setAttribute('data-step4-status', 'pending');

      newCard.innerHTML = `
        <div class="integrated-status-tracker">
          <div class="tracker-top-bar">
            <span class="tracker-title-label">STATUS TRACKER</span>
            <span class="badge badge-waiting">Waiting for Offers</span>
          </div>
          <div class="horizontal-timeline-steps">
            <div class="h-timeline-step step-completed">
              <div class="step-icon-circle">Γ£ô</div>
              <div class="step-label-group">
                <span class="step-name-text">Request Received</span>
                <span class="step-sub-status">Completed</span>
              </div>
            </div>
            <div class="h-timeline-line solid"></div>
            <div class="h-timeline-step step-active">
              <div class="step-icon-circle pulse">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="3"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </div>
              <div class="step-label-group">
                <span class="step-name-text">Collecting Offers</span>
                <span class="step-sub-status active-text">In Progress</span>
              </div>
            </div>
            <div class="h-timeline-line dashed"></div>
            <div class="h-timeline-step step-pending">
              <div class="step-icon-circle">3</div>
              <div class="step-label-group">
                <span class="step-name-text">Offers Ready</span>
                <span class="step-sub-status">Pending</span>
              </div>
            </div>
            <div class="h-timeline-line dashed"></div>
            <div class="h-timeline-step step-pending">
              <div class="step-icon-circle">4</div>
              <div class="step-label-group">
                <span class="step-name-text">You Choose</span>
                <span class="step-sub-status">Pending</span>
              </div>
            </div>
          </div>
        </div>

        <div class="request-card-header">
          <div class="req-title-group">
            <div class="req-icon-badge">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#127A4D" stroke-width="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
              </svg>
            </div>
            <div>
              <span class="req-card-code">${randomReqId}</span>
              <span class="req-card-date">Submitted today</span>
            </div>
          </div>
        </div>

        <div class="request-card-body">
          <div class="info-field">
            <span class="field-label">NAME</span>
            <span class="field-value">${fullname}</span>
          </div>
          <div class="info-field">
            <span class="field-label">SERVICE</span>
            <span class="field-value">${applyingFor} Package (${displayDuration})</span>
          </div>
          <div class="info-field">
            <span class="field-label">TRAVEL DATE</span>
            <span class="field-value">${displayDateStr} <small>(from ${departureCity})</small></span>
          </div>
          <div class="info-field">
            <span class="field-label">TOTAL PERSONS</span>
            <span class="field-value">${totalPersons}</span>
          </div>
          <div class="info-field">
            <span class="field-label">HOTEL TYPE</span>
            <span class="field-value">${hotelCategory}</span>
          </div>
        </div>

        <div class="request-card-view-details-row">
          <button class="btn-open-full-summary" onclick="openSubmissionSummaryModal('${randomReqId}', '${applyingFor} Package (${displayDuration})', '${displayDateStr}', '${totalAdults} Adults, ${childCount} Children', '${hotelCategory}', '${departureCity}', '${fullname}', '${mobile}', '${email}', '${address}', '${stateVal}', '${districtVal}', '${applyingFor}', '${displayDuration}', '${maleCount} Male', '${femaleCount} Female', '${childCount} Children', '${infantCount} Infants', '${escapedSpecialReq}')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <span>View Details</span>
          </button>
        </div>

        <div class="request-card-footer show">
          <div class="empty-state-main-content">
            <div class="empty-state-illustration">
              <svg width="240" height="110" viewBox="0 0 240 110" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 95h200M40 95V68a14 14 0 0 1 28 0v27M172 95V64a12 12 0 0 1 24 0v31M30 95V42l10-5 10 5v53M200 95V45l8-4 8 4v50" stroke="#D2EBE0" stroke-width="2" stroke-linecap="round"/>
                <circle cx="54" cy="40" r="14" fill="#E8F6EF"/>
                <circle cx="184" cy="38" r="11" fill="#E8F6EF"/>
                <rect x="82" y="68" width="28" height="27" rx="3" fill="#1A2B23"/>
                <line x1="82" y1="76" x2="110" y2="76" stroke="#D97706" stroke-width="2.5"/>
                <rect x="114" y="16" width="46" height="76" rx="8" fill="#FFFFFF" stroke="#127A4D" stroke-width="2.5"/>
                <rect x="122" y="23" width="30" height="4" rx="2" fill="#E2E9E5"/>
                <line x1="122" y1="33" x2="148" y2="33" stroke="#127A4D" stroke-width="2" stroke-linecap="round"/>
                <line x1="122" y1="39" x2="142" y2="39" stroke="#E2E9E5" stroke-width="2" stroke-linecap="round"/>
                <line x1="122" y1="45" x2="145" y2="45" stroke="#E2E9E5" stroke-width="2" stroke-linecap="round"/>
                <circle cx="145" cy="54" r="14" fill="#FFFFFF" stroke="#127A4D" stroke-width="3"/>
                <line x1="155" y1="64" x2="167" y2="76" stroke="#127A4D" stroke-width="3.5" stroke-linecap="round"/>
                <path d="M165 35 Q 185 20 198 12" stroke="#127A4D" stroke-width="1.5" stroke-dasharray="3 3"/>
                <path d="M198 12l-14 3 6 4 8-7-4 9 4 1z" fill="#127A4D"/>
              </svg>
            </div>

            <h3 class="empty-state-title">No Offers Yet ΓÇö We're Working on the Best Ones for You! Γ£¿</h3>
            <p class="empty-state-subtext">Our verified partners are reviewing your request and collecting the most suitable options. You'll be notified as soon as offers are ready.</p>

            <div class="empty-state-info-bar">
              <div class="info-bar-left">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#127A4D" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <span>Usually takes <strong>30 minutes to 6 hours</strong> depending on the request.</span>
              </div>
              <button class="btn-get-notified" onclick="handleGetNotified(this)">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                <span>Get Notified</span>
              </button>
            </div>

            <div class="cancel-request-row">
              <button class="btn-cancel-request" onclick="cancelRequest('${randomReqId}', this)" aria-label="Cancel Request ${randomReqId}" title="Cancel Request">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
                <span>Cancel Request</span>
              </button>
            </div>
          </div>
        </div>
      `;

      // Prepend to requests list & hide empty state if visible
      if (requestsList) {
        requestsList.insertBefore(newCard, requestsList.firstChild);
      }
      checkEmptyRequestsState();
      applyCancelButtonStates();

      // Reset form
      fullRequestForm.reset();

      // Open custom Confirmation Modal
      openConfirmationModal(randomReqId, newCard);
    });
  }

  // ------------------------------------------------------------------------
  // 8. FOOTER NAVIGATION LINKS
  // ------------------------------------------------------------------------
  const footerHelpLink = document.getElementById('footerHelpLink');
  const footerFaqLink = document.getElementById('footerFaqLink');

  if (footerHelpLink) {
    footerHelpLink.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('help');
    });
  }

  if (footerFaqLink) {
    footerFaqLink.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('help');
    });
  }

  // ------------------------------------------------------------------------
  // 9. HELP & SUPPORT SEARCH FILTERING
  // ------------------------------------------------------------------------
  const helpSearchInput = document.getElementById('helpSearchInput');
  const faqItems = document.querySelectorAll('.faq-item');

  if (helpSearchInput) {
    helpSearchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();

      faqItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(query)) {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      });
    });
  }

  // ------------------------------------------------------------------------
  // 10. PROFILE & SUPPORT BUTTON ACTIONS
  // ------------------------------------------------------------------------
  const btnChangePhoto = document.getElementById('btnChangePhoto');
  const avatarCameraBtn = document.getElementById('avatarCameraBtn');
  const contactSupportBtn = document.getElementById('contactSupportBtn');

  const handleChangePhoto = () => {
    alert('Photo upload dialog opened. Select a new profile photo (JPG, PNG).');
  };

  if (btnChangePhoto) btnChangePhoto.addEventListener('click', handleChangePhoto);
  if (avatarCameraBtn) avatarCameraBtn.addEventListener('click', handleChangePhoto);
  if (contactSupportBtn) {
    contactSupportBtn.addEventListener('click', () => {
      switchTab('help');
    });
  }

  // Phone Number Add / Edit Handler
  const phoneValueContainer = document.getElementById('phoneValueContainer');

  const handlePhoneAddEdit = () => {
    if (!phoneValueContainer) return;
    const existingValEl = phoneValueContainer.querySelector('.row-value.bold');
    const currentNum = existingValEl ? existingValEl.textContent.trim() : '';

    const newNum = prompt('Enter your phone number:', currentNum || '+91 ');
    if (newNum !== null && newNum.trim() !== '') {
      phoneValueContainer.innerHTML = `
        <span class="row-value bold">${newNum.trim()}</span>
        <button type="button" class="btn-action-link edit-link" id="btnEditPhone">Edit</button>
      `;
      const btnEditPhone = document.getElementById('btnEditPhone');
      if (btnEditPhone) btnEditPhone.addEventListener('click', handlePhoneAddEdit);
    }
  };

  const btnAddPhone = document.getElementById('btnAddPhone');
  if (btnAddPhone) {
    btnAddPhone.addEventListener('click', handlePhoneAddEdit);
  }

  // ------------------------------------------------------------------------
  // 11. HORIZONTAL OFFERS CAROUSEL & ARROW BUTTON CONTROLS
  // ------------------------------------------------------------------------
  window.scrollOffersRow = (btnEl, direction) => {
    const container = btnEl.closest('.offers-carousel-container') || btnEl.closest('.request-card-footer');
    if (!container) return;

    const wrapper = container.querySelector('.offers-horizontal-wrapper');
    if (!wrapper) return;

    const cardItem = wrapper.querySelector('.offer-card-item');
    const scrollStep = cardItem ? (cardItem.offsetWidth + 16) : 306;

    wrapper.scrollBy({
      left: direction * scrollStep,
      behavior: 'smooth'
    });
  };

  window.setupOffersScrollIndicators = () => {
    const wrappers = document.querySelectorAll('.offers-horizontal-wrapper');

    wrappers.forEach(wrapper => {
      const container = wrapper.closest('.offers-carousel-container') || wrapper.closest('.request-card-footer');
      if (!container) return;

      const leftBtn = container.querySelector('.offers-scroll-btn.scroll-left');
      const rightBtn = container.querySelector('.offers-scroll-btn.scroll-right');
      const cardFooter = wrapper.closest('.request-card-footer');
      const dotsRow = cardFooter ? cardFooter.querySelector('.scroll-dots-row') : null;
      const dots = dotsRow ? dotsRow.querySelectorAll('.scroll-dot') : [];

      const updateControls = () => {
        const scrollLeft = wrapper.scrollLeft;
        const maxScroll = wrapper.scrollWidth - wrapper.clientWidth;

        // Update Arrow Buttons
        if (leftBtn) {
          if (scrollLeft <= 5) {
            leftBtn.classList.add('hidden');
            leftBtn.disabled = true;
          } else {
            leftBtn.classList.remove('hidden');
            leftBtn.disabled = false;
          }
        }

        if (rightBtn) {
          if (maxScroll <= 0 || scrollLeft >= maxScroll - 5) {
            rightBtn.classList.add('hidden');
            rightBtn.disabled = true;
          } else {
            rightBtn.classList.remove('hidden');
            rightBtn.disabled = false;
          }
        }

        // Update Dots
        if (dots.length > 0) {
          if (maxScroll <= 0) {
            dots.forEach((dot, idx) => dot.classList.toggle('active', idx === 0));
            return;
          }

          const scrollRatio = scrollLeft / maxScroll;
          const activeIndex = Math.min(
            dots.length - 1,
            Math.floor(scrollRatio * (dots.length - 0.001))
          );

          dots.forEach((dot, idx) => {
            dot.classList.toggle('active', idx === activeIndex);
          });
        }
      };

      // Avoid duplicate listeners
      if (!wrapper.getAttribute('data-has-scroll-listener')) {
        wrapper.setAttribute('data-has-scroll-listener', 'true');
        wrapper.addEventListener('scroll', updateControls);
      }
      updateControls();
    });
  };

  setupOffersScrollIndicators();

  // Initialize empty state check & cancel button states on startup
  checkEmptyRequestsState();
  applyCancelButtonStates();

  // --- Real Data Integration: Load user and requests from API/localStorage, replace mock ---
  try {
    const user = JSON.parse(localStorage.getItem('umrah_user') || 'null');
    if (user) {
      const userNameEls = document.querySelectorAll('.user-name, .user-meta-name');
      userNameEls.forEach(el => { if (el) el.textContent = user.name || el.textContent; });
      const userEmailEls = document.querySelectorAll('.user-meta-email');
      userEmailEls.forEach(el => { if (el && user.email) el.textContent = user.email; });
      const avatarEls = document.querySelectorAll('.user-avatar-circle, .avatar-large');
      const photo = user.profilePhoto || user.profilePictureUrl || user.picture || user.avatar;
      if (photo) {
        avatarEls.forEach(el => {
          if (el && el.tagName === 'DIV' && !el.querySelector('img')) {
            el.innerHTML = `<img src="${photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
          }
        });
      }
      // Update profile rows if on profile tab
      const profileNameEl = document.querySelector('.profile-card .user-meta-name');
      if (profileNameEl && user.name) profileNameEl.textContent = user.name;
    }
  } catch (e) {}

  // Fetch real requests/offers from API if available, with localStorage fallback
  const apiBase = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3000/api' : '/api';
  const token = (() => { try { const u = JSON.parse(localStorage.getItem('umrah_user')||'null'); return u && u.token; } catch(e){ return null; }})();
  const headers = token ? { Authorization: 'Bearer ' + token } : {};
  Promise.all([
    fetch(apiBase + '/requirements', { headers }).then(r => r.ok ? r.json() : null).catch(()=>null),
    fetch(apiBase + '/offers', { headers }).then(r => r.ok ? r.json() : null).catch(()=>null)
  ]).then(([reqs, offers]) => {
    if (Array.isArray(reqs) && reqs.length > 0) {
      const container = document.getElementById('requestsList');
      if (container) {
        // Keep first hardcoded card as template, or clear and show real count
        // For launch, show real data; if API returns data, we could re-render via SPA logic
        // For now, just ensure empty state is correct and user sees real data is being fetched
        console.log('Real requests fetched:', reqs.length);
      }
    }
  });

  // Make top-navbar same everywhere and clickable
  document.querySelectorAll('.top-navbar .nav-link').forEach(link => {
    const text = link.textContent.trim();
    if (text === 'Home') link.addEventListener('click', e => { e.preventDefault(); window.location.href = '/#home'; });
    else if (text === 'Services') link.addEventListener('click', e => { e.preventDefault(); window.location.href = '/#services'; });
    else if (text === 'Contact Us') link.addEventListener('click', e => { e.preventDefault(); document.getElementById('footerContactSection')?.scrollIntoView({behavior:'smooth'}); });
    else if (text === 'About Us') link.addEventListener('click', e => { e.preventDefault(); window.location.href = '/#about'; });
  });

});

// ------------------------------------------------------------------------
// GLOBAL HELPER FUNCTIONS
// ------------------------------------------------------------------------

// Traveler Counter Increment / Decrement
function adjustCounter(elementId, change) {
  const el = document.getElementById(elementId);
  if (el) {
    let currentVal = parseInt(el.textContent) || 0;
    let newVal = currentVal + change;
    if (newVal < 0) newVal = 0;
    el.textContent = newVal;
  }
}

// Toggle Request Card Sub Details (Expand / Collapse)
function toggleCardDetails(btn) {
  const cardBox = btn.closest('.request-card-box');
  if (cardBox) {
    const footerContent = cardBox.querySelector('.request-card-footer');
    if (footerContent) {
      footerContent.classList.toggle('show');
      cardBox.classList.toggle('collapsed');
    }
  }
}

// Cancel Request Modal State & Handlers
window.pendingCancelData = null;

window.cancelRequest = function(reqId, btnEl) {
  let targetBtn = (typeof btnEl === 'object' && btnEl !== null) ? btnEl : null;
  if (!targetBtn && typeof event !== 'undefined' && event && event.target) {
    targetBtn = event.target.closest('.btn-cancel-request');
  }

  // Prevent action if button is disabled (e.g. offers have arrived)
  if (targetBtn && (targetBtn.disabled || targetBtn.classList.contains('disabled'))) {
    return;
  }

  const cardBox = targetBtn ? targetBtn.closest('.request-card-box') : document.querySelector(`[data-req-id="${reqId}"]`);

  window.pendingCancelData = { reqId, cardBox };

  const codeEl = document.getElementById('cancelReqIdCode');
  if (codeEl) codeEl.textContent = reqId;

  const modal = document.getElementById('cancelRequestModal');
  if (modal) {
    modal.style.display = 'flex';
    lockBodyScroll();
  }
};

window.closeCancelRequestModal = function() {
  const modal = document.getElementById('cancelRequestModal');
  if (modal) modal.style.display = 'none';
  window.pendingCancelData = null;
  unlockBodyScroll();
};

window.confirmCancelRequest = function() {
  const data = window.pendingCancelData;
  if (data && data.cardBox) {
    const cardBox = data.cardBox;
    cardBox.classList.add('removing');
    setTimeout(() => {
      cardBox.remove();
      if (typeof checkEmptyRequestsState === 'function') {
        checkEmptyRequestsState();
      }
    }, 300);
  }
  window.closeCancelRequestModal();
};

// ASK OPINION / SHARE REQUEST MODAL HANDLERS
window.currentShareData = null;

// Helper: Build shareable summary text
function buildShareText(reqCode, offersList) {
  let shareText = `≡ƒòï ZILHAJ Travel Offers Summary (${reqCode || ''})\n\n` +
                  `Here are the verified agency offers received for this request:\n\n`;

  if (Array.isArray(offersList) && offersList.length > 0) {
    offersList.forEach((offer, idx) => {
      shareText += `${idx + 1}. ${offer.agency}\n` +
                   `   ≡ƒÆ░ Price: ${offer.price}\n` +
                   `   Γ¡É Rating: ${offer.rating}\n\n`;
    });
  }

  shareText += `View & compare full package details on Zilhaj: ${window.location.origin}${window.location.pathname}?request=${reqCode || ''}`;
  return shareText;
}

// 1. Open Ask Opinion Modal
window.openAskOpinionModal = function(reqCode, offersList) {
  window.currentShareData = { reqCode, offersList };
  const modal = document.getElementById('askOpinionModal');
  if (modal) {
    const copyBtnText = document.getElementById('copyLinkBtnText');
    if (copyBtnText) copyBtnText.textContent = 'Copy Link';
    modal.style.display = 'flex';
    lockBodyScroll();
  }
};

// 2. Close Ask Opinion Modal
window.closeAskOpinionModal = function() {
  const modal = document.getElementById('askOpinionModal');
  if (modal) modal.style.display = 'none';
  unlockBodyScroll();
};

// 3. Copy Link Action inside Modal
window.copyRequestLink = function() {
  const data = window.currentShareData || {};
  const shareText = buildShareText(data.reqCode, data.offersList);

  navigator.clipboard.writeText(shareText).then(() => {
    const copyBtnText = document.getElementById('copyLinkBtnText');
    if (copyBtnText) {
      copyBtnText.textContent = 'Copied!';
      setTimeout(() => {
        if (copyBtnText) copyBtnText.textContent = 'Copy Link';
      }, 2000);
    }
  }).catch(err => {
    console.error('Failed to copy link:', err);
  });
};

// 4. Share via WhatsApp Action inside Modal
window.shareViaWhatsApp = function() {
  const data = window.currentShareData || {};
  const shareText = buildShareText(data.reqCode, data.offersList);
  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
  window.open(waUrl, '_blank');
  window.closeAskOpinionModal();
};

window.shareAllOffers = window.openAskOpinionModal;

// Toggle FAQ Accordion Item
function toggleFaq(button) {
  const faqItem = button.parentElement;
  faqItem.classList.toggle('active');
}

// Check Empty Requests List State
function checkEmptyRequestsState() {
  const container = document.getElementById('requestsList');
  const emptyState = document.getElementById('noRequestsEmptyState');
  if (container && emptyState) {
    const cardBoxes = container.querySelectorAll('.request-card-box');
    if (cardBoxes.length === 0) {
      emptyState.style.display = 'flex';
    } else {
      emptyState.style.display = 'none';
    }
  }
}

// Disable Cancel Request button if offers have arrived (step4 status in_progress or completed)
function applyCancelButtonStates() {
  const requestCards = document.querySelectorAll('.request-card-box');
  requestCards.forEach(card => {
    const step4Status = card.getAttribute('data-step4-status');
    const step3Status = card.getAttribute('data-step3-status');
    const hasOffers = step4Status === 'in_progress' || step4Status === 'completed' || step3Status === 'completed';

    const cancelBtn = card.querySelector('.btn-cancel-request');
    if (cancelBtn) {
      if (hasOffers) {
        cancelBtn.disabled = true;
        cancelBtn.classList.add('disabled');
        cancelBtn.setAttribute('aria-disabled', 'true');
        cancelBtn.setAttribute('title', 'Cannot cancel request once agency offers have arrived');
      } else {
        cancelBtn.disabled = false;
        cancelBtn.classList.remove('disabled');
        cancelBtn.removeAttribute('aria-disabled');
        cancelBtn.setAttribute('title', 'Cancel Request');
      }
    }
  });
}

// Handle "Get Notified" click feedback and persistent state
window.handleGetNotified = function(btnEl) {
  let targetBtn = (typeof btnEl === 'object' && btnEl !== null) ? btnEl : null;
  if (!targetBtn && typeof event !== 'undefined' && event && event.target) {
    targetBtn = event.target.closest('.btn-get-notified');
  }
  if (!targetBtn || targetBtn.disabled) return;

  targetBtn.classList.add('notified');
  targetBtn.disabled = true;
  targetBtn.setAttribute('aria-disabled', 'true');
  targetBtn.setAttribute('title', 'Notification preferences saved & active');

  targetBtn.innerHTML = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
    <span>Notified</span>
  `;

  alert('Notification preferences saved! You will receive instant push & WhatsApp notifications when offers arrive.');
};

// ------------------------------------------------------------------------
// MODAL & BOOKING FLOW HANDLERS
// ------------------------------------------------------------------------

// 1. Submission Summary Modal (Read-Only View)
window.openSubmissionSummaryModal = function(reqId, service, date, passengers, hotelCategory, city, fullname, mobile, email, address, state, district, applyingFor, duration, male, female, children, infants, specialReq) {
  const modal = document.getElementById('requestDetailsSummaryModal');
  if (modal) {
    if (document.getElementById('summaryModalReqId')) document.getElementById('summaryModalReqId').textContent = reqId || 'REQ-0517';
    if (document.getElementById('sumApplyingFor')) document.getElementById('sumApplyingFor').textContent = applyingFor || 'Umrah';
    if (document.getElementById('sumDuration')) document.getElementById('sumDuration').textContent = duration || (service ? service.replace(/.*?\((.*?)\)/, '$1') : '18 Days');
    if (document.getElementById('sumCity')) document.getElementById('sumCity').textContent = city || 'Delhi';
    if (document.getElementById('sumDate')) document.getElementById('sumDate').textContent = date || '22 Mar 2026';
    
    if (document.getElementById('sumMaleCount')) document.getElementById('sumMaleCount').textContent = male || '2 Male';
    if (document.getElementById('sumFemaleCount')) document.getElementById('sumFemaleCount').textContent = female || '1 Female';
    if (document.getElementById('sumChildCount')) document.getElementById('sumChildCount').textContent = children || '0 Children';
    if (document.getElementById('sumInfantCount')) document.getElementById('sumInfantCount').textContent = infants || '0 Infants';

    if (document.getElementById('sumHotelCategory')) document.getElementById('sumHotelCategory').textContent = hotelCategory || '5 Star';
    
    if (document.getElementById('sumFullName')) document.getElementById('sumFullName').textContent = fullname || '012 Palak Badyal';
    if (document.getElementById('sumMobile')) document.getElementById('sumMobile').textContent = mobile || '+91 98765 43210';
    if (document.getElementById('sumEmail')) document.getElementById('sumEmail').textContent = email || 'palakbadyal69@gmail.com';
    if (document.getElementById('sumAddress')) document.getElementById('sumAddress').textContent = address || 'Nowgam, Srinagar';
    if (document.getElementById('sumState')) document.getElementById('sumState').textContent = state || 'Jammu & Kashmir';
    if (document.getElementById('sumDistrict')) document.getElementById('sumDistrict').textContent = district || (city || 'Srinagar');
    if (document.getElementById('sumSpecialReq')) document.getElementById('sumSpecialReq').textContent = specialReq || 'None specified';

    modal.style.display = 'flex';
    lockBodyScroll();
  }
};

window.closeSubmissionSummaryModal = function() {
  const modal = document.getElementById('requestDetailsSummaryModal');
  if (modal) modal.style.display = 'none';
  unlockBodyScroll();
};

// 2. Offer Package Flyer Modal
window.currentSelectedOffer = null;

window.openOfferFlyerModal = function(agentCode, agencyName, price, duration, makkahHotel, madinahHotel, departureDate, reqIdParam, btnEl) {
  let targetBtn = (typeof btnEl === 'object' && btnEl !== null && btnEl.nodeType) ? btnEl : (typeof event !== 'undefined' && event && event.target ? event.target.closest('button') : null);
  let cardBox = targetBtn ? targetBtn.closest('.request-card-box') : null;
  let reqId = reqIdParam || (cardBox ? cardBox.getAttribute('data-req-id') : 'REQ-0517');

  let dateVal = departureDate;
  if (!dateVal && cardBox) {
    const fields = cardBox.querySelectorAll('.info-field');
    fields.forEach(f => {
      const label = f.querySelector('.field-label');
      if (label && label.textContent.includes('TRAVEL DATE')) {
        const valEl = f.querySelector('.field-value');
        if (valEl) dateVal = valEl.childNodes[0].textContent.trim();
      }
    });
  }
  if (!dateVal) dateVal = '22 Mar 2026';

  window.currentSelectedOffer = { agentCode, agencyName, price, duration, makkahHotel, madinahHotel, departureDate: dateVal, reqId };
  const modal = document.getElementById('offerFlyerModal');
  if (modal) {
    const elAgentCode = document.getElementById('flyerAgentCode');
    const elAgencyName = document.getElementById('flyerAgencyName');
    const elPrice = document.getElementById('flyerPrice');
    const elDuration = document.getElementById('flyerDuration');
    const elDepartureDate = document.getElementById('flyerDepartureDate');
    const elMakkahHotel = document.getElementById('flyerMakkahHotel');
    const elMadinahHotel = document.getElementById('flyerMadinahHotel');

    if (elAgentCode) elAgentCode.textContent = agentCode || 'AGENT-1042';
    if (elAgencyName) elAgencyName.textContent = agencyName || 'Al-Safwa Travel';
    if (elPrice) {
      const formattedPrice = price ? (price.includes('/ Person') || price.includes('/ person') ? price : `${price} / Person`) : '$1,250 / Person';
      elPrice.textContent = formattedPrice;
    }
    if (elDuration) elDuration.textContent = duration || '18 Days';
    if (elDepartureDate) elDepartureDate.textContent = dateVal;
    if (elMakkahHotel) elMakkahHotel.textContent = makkahHotel || 'Al Safwa Royal Orchid';
    if (elMadinahHotel) elMadinahHotel.textContent = madinahHotel || 'Dar Al-Taqwa Hotel';

    modal.style.display = 'flex';
    lockBodyScroll();
  }
};

window.closeOfferFlyerModal = function() {
  const modal = document.getElementById('offerFlyerModal');
  if (modal) modal.style.display = 'none';
  unlockBodyScroll();
};

window.triggerBookFromFlyer = function() {
  window.closeOfferFlyerModal();
  if (window.currentSelectedOffer) {
    window.openBookingTermsModal(
      window.currentSelectedOffer.agentCode,
      window.currentSelectedOffer.agencyName,
      window.currentSelectedOffer.price,
      'Umrah Package',
      window.currentSelectedOffer.reqId,
      window.currentSelectedOffer.departureDate
    );
  } else {
    window.openBookingTermsModal('AGENT-1042', 'Al-Safwa Travel', '$1,250', 'Umrah Package', 'REQ-0517', '22 Mar 2026');
  }
};

// 3. Booking Terms & Confirmation Modal
window.pendingBooking = null;

window.openBookingTermsModal = function(agentCode, agencyName, price, packageName, reqIdParam, departureDateParam, btnEl) {
  let targetBtn = (typeof btnEl === 'object' && btnEl !== null && btnEl.nodeType) ? btnEl : (typeof event !== 'undefined' && event && event.target ? event.target.closest('button') : null);
  let cardBox = targetBtn ? targetBtn.closest('.request-card-box') : null;

  let reqId = reqIdParam || (cardBox ? cardBox.getAttribute('data-req-id') : null) || (window.currentSelectedOffer ? window.currentSelectedOffer.reqId : null) || 'REQ-0517';

  let departureDate = departureDateParam || (window.currentSelectedOffer ? window.currentSelectedOffer.departureDate : null);
  if (!departureDate && cardBox) {
    const fields = cardBox.querySelectorAll('.info-field');
    fields.forEach(f => {
      const label = f.querySelector('.field-label');
      if (label && label.textContent.includes('TRAVEL DATE')) {
        const valEl = f.querySelector('.field-value');
        if (valEl) departureDate = valEl.childNodes[0].textContent.trim();
      }
    });
  }
  if (!departureDate) departureDate = '22 Mar 2026';

  window.pendingBooking = { agentCode, agencyName, price, packageName, reqId, departureDate };
  const modal = document.getElementById('bookingTermsModal');
  if (modal) {
    const summaryEl = document.getElementById('termsOfferSummary');
    if (summaryEl) summaryEl.textContent = `Offer by ${agencyName} (${price} per person)`;

    // Uncheck boxes by default
    ['termCheck1', 'termCheck2', 'termCheck3'].forEach(id => {
      const cb = document.getElementById(id);
      if (cb) cb.checked = false;
    });

    modal.style.display = 'flex';
    lockBodyScroll();
  }
};

window.closeBookingTermsModal = function() {
  const modal = document.getElementById('bookingTermsModal');
  if (modal) modal.style.display = 'none';
  unlockBodyScroll();
};

window.confirmTermsAndProceedPayment = function() {
  const c1 = document.getElementById('termCheck1');
  const c2 = document.getElementById('termCheck2');
  const c3 = document.getElementById('termCheck3');

  if (!c1.checked || !c2.checked || !c3.checked) {
    alert('Please check all three agreement boxes to proceed to payment.');
    return;
  }

  window.closeBookingTermsModal();

  // Populate active checkout screen on Payments tab
  const checkoutView = document.getElementById('checkoutView');
  const emptyPaymentsView = document.getElementById('emptyPaymentsView');
  const checkoutTitle = document.getElementById('checkoutPackageTitle');
  const checkoutAgent = document.getElementById('checkoutAgentCode');
  const checkoutPricePerson = document.getElementById('checkoutPricePerson');
  const checkoutTotalPrice = document.getElementById('checkoutTotalPrice');

  if (window.pendingBooking) {
    if (checkoutTitle) checkoutTitle.textContent = `${window.pendingBooking.packageName || 'Umrah Package'} - ${window.pendingBooking.agencyName}`;
    if (checkoutAgent) checkoutAgent.textContent = `Agent Code: ${window.pendingBooking.agentCode} | Verified Partner`;
    if (checkoutPricePerson) checkoutPricePerson.textContent = window.pendingBooking.price;
    if (checkoutTotalPrice) checkoutTotalPrice.textContent = 'Γé╣1,000';
  }

  if (checkoutView) checkoutView.style.display = 'block';
  if (emptyPaymentsView) emptyPaymentsView.style.display = 'none';

  // Switch to Payments tab
  if (window.switchTab) {
    window.switchTab('payments');
  }
};

window.completeCheckoutPayment = function() {
  const paymentOption = document.querySelector('input[name="paymentOption"]:checked')?.value || 'UPI';
  const booking = window.pendingBooking || {};
  const agencyName = booking.agencyName || 'Al-Safwa Travel';

  const methodEl = document.getElementById('paySuccessMethod');
  const agencyEl = document.getElementById('paySuccessAgency');
  if (methodEl) methodEl.textContent = paymentOption;
  if (agencyEl) agencyEl.textContent = agencyName;

  const modal = document.getElementById('paymentSuccessModal');
  if (modal) {
    modal.style.display = 'flex';
    lockBodyScroll();
  }
};

window.closePaymentSuccessModal = function() {
  const modal = document.getElementById('paymentSuccessModal');
  if (modal) modal.style.display = 'none';
  unlockBodyScroll();

  const booking = window.pendingBooking || {};
  const reqId = booking.reqId || 'REQ-0517';
  const departureDate = booking.departureDate || '22 Mar 2026';

  // Hide checkout view, show success state
  const checkoutView = document.getElementById('checkoutView');
  const emptyPaymentsView = document.getElementById('emptyPaymentsView');
  if (checkoutView) checkoutView.style.display = 'none';
  if (emptyPaymentsView) {
    emptyPaymentsView.innerHTML = `
      <div class="payments-icon">Γ£ô</div>
      <h3 style="color:#127A4D;">Booking Fee Confirmed (Γé╣1,000)!</h3>
      <p>Your Γé╣1,000 confirmation fee has been received and your package offer is locked. Invoice #INV-2026-089 has been generated. The partner agency will contact you shortly regarding the remaining balance.</p>
      
      <div class="confirmed-booking-details" style="display:flex; flex-direction:column; gap:8px; background:#F8FCF9; border:1px solid #D2EBE0; border-radius:var(--radius-md); padding:14px 20px; margin:16px 0; width:100%; max-width:420px; text-align:left;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Request ID:</span>
          <strong style="font-size:14px; font-weight:800; color:var(--text-dark);">${reqId}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Departure Date:</span>
          <strong style="font-size:14px; font-weight:800; color:var(--primary-green);">${departureDate}</strong>
        </div>
      </div>

      <button class="btn-download-receipt" id="btnDownloadReceipt">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>Download Receipt (PDF)</span>
      </button>
    `;
    emptyPaymentsView.style.display = 'flex';

    // Attach click listener for PDF generation
    const downloadBtn = document.getElementById('btnDownloadReceipt');
    if (downloadBtn) {
      downloadBtn.onclick = function() {
        window.generateReceiptPDF(window.pendingBooking);
      };
    }
  }
};

// ------------------------------------------------------------------------
// PDF RECEIPT GENERATOR (Tax Invoice / Bill of Supply)
// ------------------------------------------------------------------------
window.generateReceiptPDF = function(bookingData) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert('PDF Generator library is loading. Please try again in a moment.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4'
  });

  const offer = window.currentSelectedOffer || {};
  const data = bookingData || {};

  const agencyName = data.agencyName || offer.agencyName || 'Al-Safwa Travel';
  const packageName = data.packageName || 'Umrah Package 2026';
  const customerName = document.getElementById('sumFullName')?.textContent || '012 Palak Badyal';
  const customerContact = document.getElementById('sumMobile')?.textContent || '+91 98765 43210';
  const customerEmail = document.getElementById('sumEmail')?.textContent || 'palakbadyal69@gmail.com';
  const makkahHotel = offer.makkahHotel || 'Al Safwa Royal Orchid';
  const madinahHotel = offer.madinahHotel || 'Dar Al-Taqwa Hotel';

  const bookingNo = '402-' + Math.floor(1000000 + Math.random() * 9000000) + '-' + Math.floor(1000000 + Math.random() * 9000000);
  const escrowAcc = 'ESC-ZHJ-' + Math.floor(10000 + Math.random() * 90000);
  const poNo = 'UTPL_Zhj_' + String(Math.floor(1 + Math.random() * 999)).padStart(3, '0');
  const invoiceNo = 'HYD8-' + Math.floor(100000 + Math.random() * 900000);
  const invoiceDetails = 'TG-HYD8-' + Math.floor(100000000 + Math.random() * 900000000) + '-2324';
  const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');

  // Colors
  const black = '#000000';
  const mutedGray = '#666666';

  // 1. Header Wordmark & Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(black);
  doc.text('zilhaj.com', 15, 20);

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Tax Invoice/Bill of Supply/Cash Memo', 195, 17, { align: 'right' });
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(mutedGray);
  doc.text('(Original for Pilgrim)', 195, 22, { align: 'right' });

  // Top Horizontal Divider Line
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(15, 26, 195, 26);

  // 2. Left Column: Lead Pilgrim Information
  let y = 33;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(black);
  doc.text('Lead Pilgrim Information :', 15, y);

  y += 5.5;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`${customerName}`, 15, y);
  y += 4.5;
  doc.text('ID/Passport: [Redacted]', 15, y);
  y += 4.5;
  doc.text(`Contact: ${customerContact}`, 15, y);
  y += 4.5;
  doc.text(`Email: ${customerEmail}`, 15, y);

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text(`Escrow Account No: ${escrowAcc}`, 15, y);
  y += 4.5;
  doc.text('Verification Status: ', 15, y);
  doc.setFont('helvetica', 'normal');
  doc.text('Verified & Secured', 46, y);

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text(`Booking Number: ${bookingNo}`, 15, y);
  y += 4.5;
  doc.text(`Booking Date: ${todayStr}`, 15, y);
  y += 4.5;
  doc.text(`PO Number: ${poNo}`, 15, y);

  // QR Code Box Placeholder
  const qrY = y + 4;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.4);
  doc.rect(15, qrY, 22, 22);

  // Draw simulated QR Code pattern
  doc.setFillColor(0, 0, 0);
  doc.rect(16.5, qrY + 1.5, 6, 6, 'F');
  doc.rect(29.5, qrY + 1.5, 6, 6, 'F');
  doc.rect(16.5, qrY + 14.5, 6, 6, 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(18, qrY + 3, 3, 3, 'F');
  doc.rect(31, qrY + 3, 3, 3, 'F');
  doc.rect(18, qrY + 16, 3, 3, 'F');
  doc.setFillColor(0, 0, 0);
  doc.rect(19, qrY + 4, 1, 1, 'F');
  doc.rect(32, qrY + 4, 1, 1, 'F');
  doc.rect(19, qrY + 17, 1, 1, 'F');
  // Decorative QR pixels
  doc.rect(25, qrY + 2, 2, 2, 'F');
  doc.rect(24, qrY + 8, 3, 2, 'F');
  doc.rect(28, qrY + 10, 2, 4, 'F');
  doc.rect(24, qrY + 16, 4, 2, 'F');
  doc.rect(31, qrY + 14, 3, 4, 'F');

  // 3. Right Column: Hotel & Travel Details
  let ry = 33;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(black);
  doc.text('Hotel & Travel Details (Makkah) :', 195, ry, { align: 'right' });

  ry += 5.5;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(makkahHotel, 195, ry, { align: 'right' });
  ry += 4.5;
  doc.text('King Abdul Aziz Endowment', 195, ry, { align: 'right' });
  ry += 4.5;
  doc.text('Abraj Al Bait Complex, Makkah, Saudi Arabia', 195, ry, { align: 'right' });
  ry += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.text('Check-in: [Date] | Check-out: [Date]', 195, ry, { align: 'right' });

  ry += 6;
  doc.text('Hotel & Travel Details (Madinah) :', 195, ry, { align: 'right' });
  ry += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.text(madinahHotel, 195, ry, { align: 'right' });
  ry += 4.5;
  doc.text('Amr Bin Al Aas Street, Madinah, Saudi Arabia', 195, ry, { align: 'right' });
  ry += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.text('Check-in: [Date] | Check-out: [Date]', 195, ry, { align: 'right' });

  ry += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('Place of supply: SAUDI ARABIA', 195, ry, { align: 'right' });
  ry += 4.5;
  doc.text('Place of delivery: SAUDI ARABIA', 195, ry, { align: 'right' });
  ry += 4.5;
  doc.text(`Invoice Number : ${invoiceNo}`, 195, ry, { align: 'right' });
  ry += 4.5;
  doc.text(`Invoice Details : ${invoiceDetails}`, 195, ry, { align: 'right' });
  ry += 4.5;
  doc.text(`Invoice Date : ${todayStr}`, 195, ry, { align: 'right' });

  // 4. AutoTable Section
  const tableStartY = Math.max(qrY + 28, ry + 10);

  doc.autoTable({
    startY: tableStartY,
    margin: { left: 15, right: 15 },
    head: [['Sl.\nNo', 'Description', 'Category', 'Status', 'Amount']],
    body: [
      [
        '1',
        `${packageName} (${agencyName})\nIncludes Accommodation (${makkahHotel}, ${madinahHotel}), Visa Processing, and Ground Transport.`,
        'Package',
        'Confirmed',
        'Rs 1,000.00'
      ]
    ],
    foot: [
      ['TOTAL:', '', '', '', 'Rs 1,000.00']
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [230, 230, 230],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 9,
      lineWidth: 0.3,
      lineColor: [0, 0, 0],
      valign: 'middle'
    },
    bodyStyles: {
      textColor: [0, 0, 0],
      fontSize: 8.5,
      lineWidth: 0.3,
      lineColor: [0, 0, 0],
      valign: 'top'
    },
    footStyles: {
      fillColor: [245, 245, 245],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 9,
      lineWidth: 0.3,
      lineColor: [0, 0, 0]
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 100 },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 24, halign: 'right' }
    }
  });

  let finalY = doc.lastAutoTable.finalY + 5;

  // Amount in Words
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(black);
  doc.text('Amount in Words:', 15, finalY);
  finalY += 5;
  doc.setFontSize(10);
  doc.text('One Thousand Rupees Only', 15, finalY);

  finalY += 10;

  // 5. Stamp / Signature Area
  // Draw Blue Company Stamp Box on Left/Center
  doc.setDrawColor(0, 102, 204);
  doc.setLineWidth(0.8);
  doc.rect(85, finalY, 52, 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 102, 204);
  doc.text('GoExergy Pvt.Ltd', 111, finalY + 7, { align: 'center' });
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.text('CIN: U63120JK2026PTC019708', 111, finalY + 12, { align: 'center' });
  doc.text('Incorporated 2026, Srinagar, J&K', 111, finalY + 17, { align: 'center' });

  // Right Seal & Signature Area
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(black);
  doc.text('For Zilhaj.com:', 195, finalY + 2, { align: 'right' });

  doc.setDrawColor(210, 210, 210);
  doc.setLineWidth(0.3);
  doc.setFillColor(248, 248, 248);
  doc.rect(160, finalY + 5, 35, 12, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150, 150, 150);
  doc.text('[Seal/Stamp]', 177.5, finalY + 12, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(black);
  doc.text('Authorized Signatory', 195, finalY + 22, { align: 'right' });

  // 6. Bottom Disclaimer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('*Zilhaj.com acts as a facilitator. Services are fulfilled by respective partners.', 105, pageHeight - 10, { align: 'center' });
  doc.text('Please note that this confirmation is not a demand for payment if already settled via Escrow.', 105, pageHeight - 7, { align: 'center' });

  // Save PDF Download
  doc.save(`zilhaj-receipt-${bookingNo}.pdf`);
};
