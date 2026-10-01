export type SupportedLanguage = "en" | "hi" | "ta" | "te" | "mr";

export interface Translations {
  appName: string;
  tagline: string;
  heroHeadline: string;
  heroSubtitle: string;
  startGrievance: string;
  demoModeBadge: string;
  productionCopilot: string;
  tabChat: string;
  tabTimeline: string;
  tabTrace: string;
  tabOutbox: string;
  tabRules: string;
  tabSafety: string;
  consumerMode: string;
  b2bMode: string;
  inputPlaceholder: string;
  attachScreenshot: string;
  voiceListening: string;
  voiceStart: string;
  send: string;
  approvalRequired: string;
  humanAuthNotice: string;
  approveAndSend: string;
  reject: string;
  editDraft: string;
  saveChanges: string;
  cancel: string;
  nothingSentWarning: string;
  moneyClockTitle: string;
  amountDebited: string;
  tatDeadline: string;
  daysDelayed: string;
  ratePerDay: string;
  totalCompensation: string;
  totalClaimValue: string;
  disclaimerComp: string;
  disclaimerLegal: string;
  whatAgentIsDoing: string;
  agentPlanTitle: string;
  step1Title: string;
  step1Desc: string;
  step2Title: string;
  step2Desc: string;
  step3Title: string;
  step3Desc: string;
  demoScenariosTitle: string;
  demoUpiTitle: string;
  demoUpiDesc: string;
  demoFraudTitle: string;
  demoFraudDesc: string;
  demoMerchantTitle: string;
  demoMerchantDesc: string;
  impactSpeed: string;
  impactSpeedLabel: string;
  impactTools: string;
  impactToolsLabel: string;
  impactIdentified: string;
  impactIdentifiedLabel: string;
  impactLanguages: string;
  impactLanguagesLabel: string;
  chatPlaceholder?: string;
  awaitingApproval?: string;
  tatBreached?: string;
  withinTat?: string;
  compensationOwed?: string;
  caveat?: string;
  pendingApproval?: string;
}

export const translations: Record<SupportedLanguage, Translations> = {
  en: {
    appName: "RefundRakshak",
    tagline: "Autonomous Indian Payment Grievance Copilot",
    heroHeadline: "Money debited but payment failed? Get it back.",
    heroSubtitle: "Autonomous AI agent that applies verified Reserve Bank of India circulars, calculates statutory compensation, and pursues your bank until refunded.",
    startGrievance: "File New Grievance",
    demoModeBadge: "Demo Mode Active",
    productionCopilot: "Production Copilot",
    tabChat: "Agent Dialogue",
    tabTimeline: "Escalation Timeline",
    tabTrace: "Agent Reasoning",
    tabOutbox: "Outbox & Dispatches",
    tabRules: "Verified RBI Rules",
    tabSafety: "About & Safety",
    consumerMode: "Consumer Redressal",
    b2bMode: "For Regulated Entities",
    inputPlaceholder: "Describe your failed payment or paste transaction details...",
    attachScreenshot: "Attach Receipt Screenshot",
    voiceListening: "Listening... speak now",
    voiceStart: "Speak in Indian English",
    send: "Send",
    approvalRequired: "Action Requires Approval",
    humanAuthNotice: "Human Authorization Required",
    approveAndSend: "Approve & Send",
    reject: "Reject",
    editDraft: "Edit Draft",
    saveChanges: "Save Changes",
    cancel: "Cancel",
    nothingSentWarning: "Nothing is sent without your explicit approval. You have full control over all outbound communication.",
    moneyClockTitle: "Live Statutory Money Clock",
    amountDebited: "Amount Debited",
    tatDeadline: "RBI Reversal TAT",
    daysDelayed: "Days Delayed Beyond TAT",
    ratePerDay: "Statutory Compensation Rate",
    totalCompensation: "Estimated Compensation",
    totalClaimValue: "Total Claim Value",
    disclaimerComp: "Potential compensation estimate, subject to verification.",
    disclaimerLegal: "Not legal advice. Generates official dispute packages for regulatory submission.",
    whatAgentIsDoing: "What the Agent is Doing",
    agentPlanTitle: "Agent Execution Plan",
    step1Title: "1. Upload & Evidence Extraction",
    step1Desc: "Upload transaction screenshot or describe the failure. Gemini extracts amount, date, UTR, and bank.",
    step2Title: "2. Statutory RBI Rules Check",
    step2Desc: "Matches Circular RBI/2019-20/67 to verify T+1 turnaround time and calculates ₹100/day compensation.",
    step3Title: "3. Autonomous Dispute Redressal",
    step3Desc: "Drafts complaints, tracks the 7-day bank deadline, and escalates to Nodal Officer and RBI Ombudsman.",
    demoScenariosTitle: "One-Click Demo Scenarios (60-Second Evaluation)",
    demoUpiTitle: "Failed UPI Payment (T+1 TAT)",
    demoUpiDesc: "₹2,400 debited, 9 days delayed -> ₹800 compensation calculated under RBI/2019-20/67.",
    demoFraudTitle: "Unauthorized Fraud Attempt",
    demoFraudDesc: "Account compromise claim -> immediately routes to 1930 / cybercrime.gov.in safety stop.",
    demoMerchantTitle: "Cancelled Merchant Order",
    demoMerchantDesc: "Cancelled food/e-commerce order -> routes to merchant gateway settlement reconciliation.",
    impactSpeed: "< 45 sec",
    impactSpeedLabel: "Avg Time to First Complaint",
    impactTools: "5.2 tools",
    impactToolsLabel: "Autonomous Calls per Case",
    impactIdentified: "₹1,42,800+",
    impactIdentifiedLabel: "Delay Compensation Identified",
    impactLanguages: "5 Bharat Languages",
    impactLanguagesLabel: "Multilingual Voice & Text",
    chatPlaceholder: "Describe your failed payment or paste transaction details...",
    awaitingApproval: "Awaiting Approval",
    tatBreached: "TAT Breached",
    withinTat: "Within TAT",
    compensationOwed: "Statutory Compensation",
    caveat: "Potential compensation estimate, subject to verification.",
    pendingApproval: "Mandatory Human Approval Queue"
  },
  hi: {
    appName: "रिफंड रक्षक (RefundRakshak)",
    tagline: "भारतीय भुगतान शिकायत निवारण एआई एजेंट",
    heroHeadline: "पैसे कट गए पर पेमेंट फेल हो गया? अपना पैसा वापस पाएं।",
    heroSubtitle: "स्वायत्त एआई एजेंट जो आरबीआई के नियमों को लागू करता है, वैधानिक मुआवजे की गणना करता है और आपके बैंक से रिफंड सुनिश्चित करता है।",
    startGrievance: "नई शिकायत दर्ज करें",
    demoModeBadge: "डेमो मोड सक्रिय",
    productionCopilot: "उत्पादन कोपायलट",
    tabChat: "एजेंट संवाद",
    tabTimeline: "शिकायत समयरेखा",
    tabTrace: "एजेंट की सोच व टूल्स",
    tabOutbox: "भेजे गए ईमेल",
    tabRules: "सत्यापित आरबीआई नियम",
    tabSafety: "सुरक्षा व मूल्यांकन",
    consumerMode: "उपभोक्ता निवारण",
    b2bMode: "बैंक व संस्थाओं हेतु",
    inputPlaceholder: "अपने फेल हुए पेमेंट के बारे में बताएं या जानकारी दर्ज करें...",
    attachScreenshot: "पेमेंट रसीद का स्क्रीनशॉट जोड़ें",
    voiceListening: "सुन रहे हैं... कृपया बोलें",
    voiceStart: "हिंदी में बोलें",
    send: "भेजें",
    approvalRequired: "मानव स्वीकृति आवश्यक",
    humanAuthNotice: "आपकी स्पष्ट सहमति आवश्यक",
    approveAndSend: "स्वीकृत करें और भेजें",
    reject: "अस्वीकार करें",
    editDraft: "ड्राफ्ट में बदलाव करें",
    saveChanges: "सुरक्षित करें",
    cancel: "रद्द करें",
    nothingSentWarning: "आपकी स्पष्ट मंजूरी के बिना कोई भी संदेश नहीं भेजा जाता है। आप पूर्ण नियंत्रण में हैं।",
    moneyClockTitle: "लाइव वैधानिक मनी क्लॉक",
    amountDebited: "कटी हुई राशि",
    tatDeadline: "आरबीआई रिफंड समयसीमा (TAT)",
    daysDelayed: "समयसीमा से अधिक विलंब (दिन)",
    ratePerDay: "वैधानिक मुआवजा दर",
    totalCompensation: "अनुमानित वैधानिक मुआवजा",
    totalClaimValue: "कुल दावा राशि",
    disclaimerComp: "संभावित मुआवजा अनुमान, सत्यापन के अधीन।",
    disclaimerLegal: "यह कानूनी सलाह नहीं है। केवल नियामक अनुपालन हेतु प्रारूप तैयार करता है।",
    whatAgentIsDoing: "एजेंट क्या कर रहा है (लाइव)",
    agentPlanTitle: "एजेंट कार्य योजना",
    step1Title: "1. साक्ष्य और विवरण निष्कर्षण",
    step1Desc: "स्क्रीनशॉट या विवरण अपलोड करें। जेमिनी एआई राशि, तारीख और यूटीआर निकालता है।",
    step2Title: "2. आरबीआई परिपत्र जांच",
    step2Desc: "आरबीआई परिपत्र RBI/2019-20/67 के तहत T+1 समयसीमा और ₹100/दिन मुआवजे की गणना।",
    step3Title: "3. स्वायत्त शिकायत निवारण",
    step3Desc: "बैंक शिकायत तैयार करता है, 7 दिन की ट्रैकिंग करता है और नोडल अधिकारी को भेजता है।",
    demoScenariosTitle: "एक-क्लिक डेमो परिदृश्य (जजों के परीक्षण हेतु)",
    demoUpiTitle: "असफल यूपीआई डेबिट (T+1 TAT)",
    demoUpiDesc: "₹2,400 कटे, 9 दिन का विलंब -> ₹800 मुआवजे का अनुमान।",
    demoFraudTitle: "अनधिकृत खाता हेराफेरी",
    demoFraudDesc: "अकाउंट हैक का दावा -> 1930 / cybercrime.gov.in सुरक्षा शाखा।",
    demoMerchantTitle: "रद्द मर्चेंट ऑर्डर",
    demoMerchantDesc: "रद्द ऑर्डर रिफंड -> मर्चेंट गेटवे सेटलमेंट जांच।",
    impactSpeed: "< 45 सेकंड",
    impactSpeedLabel: "प्रथम शिकायत ड्राफ्ट समय",
    impactTools: "5.2 टूल्स",
    impactToolsLabel: "प्रति केस स्वायत्त टूल उपयोग",
    impactIdentified: "₹1,42,800+",
    impactIdentifiedLabel: "पहचाना गया वैधानिक मुआवजा",
    impactLanguages: "5 भारतीय भाषाएं",
    impactLanguagesLabel: "बहुभाषी वॉयस एवं टेक्स्ट"
  },
  ta: {
    appName: "ரீஃபண்ட் ரக்ஷக் (RefundRakshak)",
    tagline: "இந்திய கட்டண தகராறு தீர்வு ஏஐ முகவர்",
    heroHeadline: "பணம் எடுக்கப்பட்டு பரிவர்த்தனை தோல்வியடைந்ததா? பணத்தை திரும்பப் பெறுங்கள்.",
    heroSubtitle: "ஆர்பிஐ விதிகளின்படி நியாயமான இழப்பீட்டைக் கணக்கிட்டு வங்கியுடன் தொடர்புகொண்டு பணத்தை மீட்கும் தன்னாட்சி ஏஐ.",
    startGrievance: "புதிய புகார் பதிவு செய்",
    demoModeBadge: "டெமோ பயன்முறை",
    productionCopilot: "உற்பத்தி கோபைலட்",
    tabChat: "ஏஜென்ட் உரையாடல்",
    tabTimeline: "புகார் காலவரிசை",
    tabTrace: "ஏஜென்ட் சிந்தனை & டூல்ஸ்",
    tabOutbox: "அனுப்பப்பட்டவை",
    tabRules: "ஆர்பிஐ விதிகள்",
    tabSafety: "பாதுகாப்பு & மதிப்பீடு",
    consumerMode: "வாடிக்கையாளர் குறைதீர்ப்பு",
    b2bMode: "வங்கிகள் & நிறுவனங்கள்",
    inputPlaceholder: "தோல்வியடைந்த கட்டணம் குறித்து விவரிக்கவும்...",
    attachScreenshot: "ஸ்கிரீன்ஷாட் இணைக்கவும்",
    voiceListening: "கேட்கிறது... பேசவும்",
    voiceStart: "தமிழில் பேசவும்",
    send: "அனுப்பு",
    approvalRequired: "மனித ஒப்புதல் தேவை",
    humanAuthNotice: "உங்கள் வெளிப்படையான ஒப்புதல் தேவை",
    approveAndSend: "ஒப்புதல் அளித்து அனுப்பு",
    reject: "நிராகரி",
    editDraft: "வரைவை திருத்து",
    saveChanges: "சேமி",
    cancel: "ரத்து செய்",
    nothingSentWarning: "உங்கள் ஒப்புதல் இல்லாமல் எந்த மின்னஞ்சலும் அனுப்பப்படாது.",
    moneyClockTitle: "நேரடி இழப்பீட்டு மணி கடிகாரம்",
    amountDebited: "பிடிக்கப்பட்ட தொகை",
    tatDeadline: "ஆர்பிஐ காலக்கெடு (TAT)",
    daysDelayed: "தாமதமான நாட்கள்",
    ratePerDay: "தினசரி இழப்பீட்டு விகிதம்",
    totalCompensation: "மதிப்பிடப்பட்ட இழப்பீடு",
    totalClaimValue: "மொத்த கோரல் மதிப்பு",
    disclaimerComp: "சாத்தியமான இழப்பீட்டு மதிப்பீடு, சரிபார்ப்புக்கு உட்பட்டது.",
    disclaimerLegal: "சட்ட ஆலோசனை அல்ல. அதிகாரப்பூர்வ குறைதீர்ப்பு வரைவுகளை மட்டுமே தயாரிக்கும்.",
    whatAgentIsDoing: "ஏஜென்ட் என்ன செய்கிறது (நேரலை)",
    agentPlanTitle: "ஏஜென்ட் செயல் திட்டம்",
    step1Title: "1. சான்று & விவரங்கள் எடுத்தல்",
    step1Desc: "ஸ்கிரீன்ஷாட்டை பதிவேற்றவும். தொகை, தேதி மற்றும் UTR எண் பிரித்தெடுக்கப்படும்.",
    step2Title: "2. ஆர்பிஐ விதிகள் ஒப்பீடு",
    step2Desc: "T+1 காலக்கெடு மற்றும் நாள் ஒன்றுக்கு ₹100 இழப்பீடு கணக்கீடு.",
    step3Title: "3. வங்கி மற்றும் நோடல் அதிகாரி புகார்",
    step3Desc: "தானியங்கி முறையில் புகாரைத் தயாரித்து காலக்கெடுவை கண்காணிக்கிறது.",
    demoScenariosTitle: "ஒரு-கிளிக் டெமோ சூழல்கள்",
    demoUpiTitle: "தோல்வியடைந்த UPI பரிவர்த்தனை",
    demoUpiDesc: "₹2,400 எடுக்கப்பட்டது, 9 நாட்கள் தாமதம் -> ₹800 இழப்பீடு.",
    demoFraudTitle: "அங்கீகரிக்கப்படாத பணப்பரிமாற்றம்",
    demoFraudDesc: "ஹேக்கிங் புகார் -> 1930 / cybercrime.gov.in பாதுகாப்பு வழி.",
    demoMerchantTitle: "ரத்துசெய்யப்பட்ட வணிக ஆர்டர்",
    demoMerchantDesc: "வணிகர் கேட்வே சரிபார்ப்பு வழி.",
    impactSpeed: "< 45 விநாடி",
    impactSpeedLabel: "முதல் வரைவு நேரம்",
    impactTools: "5.2 கருவிகள்",
    impactToolsLabel: "வழக்குக்கு சராசரி டூல்ஸ்",
    impactIdentified: "₹1,42,800+",
    impactIdentifiedLabel: "கண்டறியப்பட்ட இழப்பீடு",
    impactLanguages: "5 இந்திய மொழிகள்",
    impactLanguagesLabel: "குரல் & உரை ஆதரவு"
  },
  te: {
    appName: "రిఫండ్ రక్షక్ (RefundRakshak)",
    tagline: "భారతీయ చెల్లింపుల వివాద పరిష్కార ఏఐ ఏజెంట్",
    heroHeadline: "డబ్బులు కట్ అయ్యాయి కానీ పేమెంట్ ఫెయిల్ అయిందా? మీ డబ్బు తిరిగి పొందండి.",
    heroSubtitle: "ఆర్బీఐ సర్క్యులర్ల ప్రకారం చట్టబద్ధమైన నష్టపరిహారాన్ని లెక్కించి, బ్యాంక్ నుండి డబ్బులు రీఫండ్ అయ్యేలా చేసే అటానమస్ ఏఐ.",
    startGrievance: "కొత్త ఫిర్యాదు నమోదు చేయండి",
    demoModeBadge: "డెమో మోడ్ యాక్టివ్",
    productionCopilot: "ప్రొడక్షన్ కోపైలట్",
    tabChat: "ఏజెంట్ సంభాషణ",
    tabTimeline: "ఫిర్యాదు టైమ్‌లైన్",
    tabTrace: "ఏజెంట్ ఆలోచన & టూల్స్",
    tabOutbox: "పంపిన వివరాలు",
    tabRules: "ధృవీకరించబడిన ఆర్బీఐ నియమాలు",
    tabSafety: "భద్రత & మూల్యాంకనం",
    consumerMode: "వినియోగదారుల పరిష్కారం",
    b2bMode: "బ్యాంకులు & సంస్థల కోసం",
    inputPlaceholder: "మీ విఫలమైన లావాదేవీ వివరాలను ఇక్కడ తెలపండి...",
    attachScreenshot: "రశీదు స్క్రీన్‌షాట్ జోడించండి",
    voiceListening: "వింటున్నాము... మాట్లాడండి",
    voiceStart: "తెలుగులో మాట్లాడండి",
    send: "పంపండి",
    approvalRequired: "మానవ అనుమతి అవసరం",
    humanAuthNotice: "మీ స్పష్టమైన అనుమతి అవసరం",
    approveAndSend: "ఆమోదించి పంపండి",
    reject: "తిరస్కరించండి",
    editDraft: "డ్రాఫ్ట్ సవరించండి",
    saveChanges: "భద్రపరచండి",
    cancel: "రద్దు చేయండి",
    nothingSentWarning: "మీ అనుమతి లేకుండా ఎటువంటి ఈమెయిల్ లేదా సమాచారం పంపబడదు.",
    moneyClockTitle: "లైవ్ చట్టబద్ధమైన మనీ క్లాక్",
    amountDebited: "కట్ అయిన మొత్తం",
    tatDeadline: "ఆర్బీఐ రీఫండ్ గడువు (TAT)",
    daysDelayed: "గడువు మించిన ఆలస్య రోజులు",
    ratePerDay: "చట్టబద్ధ పరిహార రేటు",
    totalCompensation: "అంచనా వేసిన పరిహారం",
    totalClaimValue: "మొత్తం క్లెయిమ్ విలువ",
    disclaimerComp: "సంభావ్య పరిహార అంచనా, ధృవీకరణకు లోబడి ఉంటుంది.",
    disclaimerLegal: "ఇది న్యాయ సలహా కాదు. కేవలం అధికారిక నివేదికలను రూపొందిస్తుంది.",
    whatAgentIsDoing: "ఏజెంట్ ఏమి చేస్తోంది (లైవ్)",
    agentPlanTitle: "ఏజెంట్ కార్యాచరణ ప్రణాళిక",
    step1Title: "1. ఆధారాల సేకరణ",
    step1Desc: "స్క్రీన్‌షాట్ ద్వారా లావాదేవీ మొత్తం, తేదీ మరియు యూటీఆర్ వివరాల వెలికితీత.",
    step2Title: "2. ఆర్బీఐ నిబంధనల పరిశీలన",
    step2Desc: "సర్క్యులర్ RBI/2019-20/67 ప్రకారం T+1 గడువు మరియు ₹100/రోజు పరిహారం లెక్కింపు.",
    step3Title: "3. బ్యాంక్ మరియు నోడల్ అధికారికి ఫిర్యాదు",
    step3Desc: "ఫిర్యాదు ముసాయిదా తయారీ మరియు 7 రోజుల బ్యాంక్ గడువు పర్యవేక్షణ.",
    demoScenariosTitle: "ఒక్క-క్లిక్ డెమో దృశ్యాలు",
    demoUpiTitle: "విఫలమైన UPI లావాదేవీ",
    demoUpiDesc: "₹2,400 కట్ అయ్యాయి, 9 రోజుల ఆలస్యం -> ₹800 పరిహారం.",
    demoFraudTitle: "అనధికారిక మోసం దావా",
    demoFraudDesc: "అకౌంట్ హ్యాకింగ్ -> 1930 / cybercrime.gov.in భద్రతా మార్గం.",
    demoMerchantTitle: "రద్దయిన మర్చంట్ ఆర్డర్",
    demoMerchantDesc: "మర్చంట్ గేట్‌వే రీకన్సిలియేషన్ మార్గం.",
    impactSpeed: "< 45 సెకన్లు",
    impactSpeedLabel: "మొదటి ఫిర్యాదు డ్రాఫ్ట్ సమయం",
    impactTools: "5.2 టూల్స్",
    impactToolsLabel: "కేసు సగటు టూల్ కాల్స్",
    impactIdentified: "₹1,42,800+",
    impactIdentifiedLabel: "గుర్తించిన పరిహారం",
    impactLanguages: "5 భారతీయ భాషలు",
    impactLanguagesLabel: "వాయిస్ & టెక్స్ట్ సపోర్ట్"
  },
  mr: {
    appName: "रिफंड रक्षक (RefundRakshak)",
    tagline: "भारतीय पेमेंट तक्रार निवारण एआय सहाय्यक",
    heroHeadline: "पैसे कापले गेले पण पेमेंट अयशस्वी झाले? तुमचे पैसे परत मिळवा.",
    heroSubtitle: "आरबीआयच्या नियमांचा वापर करून वैधानिक नुकसानभरपाई मोजणारा आणि बँकेकडून परतावा मिळवून देणारा स्वायत्त एआय.",
    startGrievance: "नवीन तक्रार दाखल करा",
    demoModeBadge: "डेमो मोड सक्रिय",
    productionCopilot: "प्रॉडक्शन कोपायलट",
    tabChat: "एजंट संवाद",
    tabTimeline: "तक्रार टाइमलाइन",
    tabTrace: "एजंटचे विचार व साधने",
    tabOutbox: "पाठवलेले ईमेल्स",
    tabRules: "तपासलेले आरबीआय नियम",
    tabSafety: "सुरक्षा व मूल्यमापन",
    consumerMode: "ग्राहक तक्रार निवारण",
    b2bMode: "बँक व वित्त संस्थांसाठी",
    inputPlaceholder: "आपल्या अयशस्वी पेमेंटबद्दल सांगा...",
    attachScreenshot: "पावती स्क्रीनशॉट जोडा",
    voiceListening: "ऐकत आहोत... कृपया बोला",
    voiceStart: "मराठीत बोला",
    send: "पाठवा",
    approvalRequired: "मानवी मंजुरी आवश्यक",
    humanAuthNotice: "आपली स्पष्ट संमती आवश्यक आहे",
    approveAndSend: "मंजूर करा आणि पाठवा",
    reject: "नाकारा",
    editDraft: "मसुदा संपादित करा",
    saveChanges: "जतन करा",
    cancel: "रद्द करा",
    nothingSentWarning: "आपल्या स्पष्ट मंजुरीशिवाय कोणताही ईमेल पाठवला जात नाही. आपले पूर्ण नियंत्रण आहे.",
    moneyClockTitle: "थेट वैधानिक मनी क्लॉक",
    amountDebited: "कापलेली रक्कम",
    tatDeadline: "आरबीआय परतावा मुदत (TAT)",
    daysDelayed: "मुदतीनंतरचा विलंब (दिवस)",
    ratePerDay: "वैधानिक नुकसानभरपाई दर",
    totalCompensation: "अंदाजे नुकसानभरपाई",
    totalClaimValue: "एकूण दावा रक्कम",
    disclaimerComp: "संभाव्य नुकसानभरपाई अंदाज, पडताळणीच्या अधीन.",
    disclaimerLegal: "हा कायदेशीर सल्ला नाही. केवळ अधिकृत तक्रार मसुदा तयार करतो.",
    whatAgentIsDoing: "एजंट काय करत आहे (थेट)",
    agentPlanTitle: "एजंट कृती योजना",
    step1Title: "1. पुरावा व माहिती संकलन",
    step1Desc: "स्क्रीनशॉट अपलोड करा. जेमिनी एआय रक्कम, दिनांक आणि यूटीआर काढते.",
    step2Title: "2. आरबीआय नियम पडताळणी",
    step2Desc: "आरबीआय परिपत्रक RBI/2019-20/67 अंतर्गत T+1 मुदत आणि ₹100/दिवस भरपाई.",
    step3Title: "3. स्वायत्त तक्रार पाठपुरावा",
    step3Desc: "बँकेची तक्रार तयार करते आणि 7 दिवसांनंतर नोडल अधिकाऱ्याकडे पाठपुरावा करते.",
    demoScenariosTitle: "एक-क्लिक डेमो परिस्थिती",
    demoUpiTitle: "अयशस्वी यूपीआई व्यवहार (T+1 TAT)",
    demoUpiDesc: "₹2,400 कापले, 9 दिवस विलंब -> ₹800 भरपाई अंदाज.",
    demoFraudTitle: "अनधिकृत खाते फसवणूक",
    demoFraudDesc: "अकाउंट हॅकचा दावा -> 1930 / cybercrime.gov.in सुरक्षा मार्ग.",
    demoMerchantTitle: "रद्द व्यापारी ऑर्डर",
    demoMerchantDesc: "व्यापारी गेटवे सेटलमेंट तपासणी मार्ग.",
    impactSpeed: "< 45 सेकंद",
    impactSpeedLabel: "पहिली तक्रार तयार करण्याचा वेळ",
    impactTools: "5.2 साधने",
    impactToolsLabel: "प्रति केस स्वायत्त टूल्स",
    impactIdentified: "₹1,42,800+",
    impactIdentifiedLabel: "ओळखलेली नुकसानभरपाई",
    impactLanguages: "5 भारतीय भाषा",
    impactLanguagesLabel: "आवाज आणि मजकूर समर्थन"
  }
};
