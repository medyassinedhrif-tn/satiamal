"use client";

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";

export type Language = "ar" | "fr";

const dictionaries = {
  ar: {
    login: "تسجيل الدخول", register: "إنشاء حساب", teacherLogin: "دخول المعلمين",
    openStore: "افتح متجرك", search: "بحث", allLevels: "كل المراحل",
    primaire: "الابتدائية", college: "الإعدادية", lycee: "الثانوية",
    allMaterials: "كل المواد", joudhadha: "جذاذة", devoir: "واجب", serie: "سلسلة", cours: "درس",
    heroEyebrow: "من إعداد أساتذة تونسيين", heroTitle: "موارد تجعل كل درس أقوى.",
    heroText: "تصفح الجذاذات والواجبات والسلاسل والدروس المشتركة من أساتذة عبر تونس.",
    searchPlaceholder: "ابحث عن المادة أو المستوى أو كلمة مفتاحية",
    collection: "المجموعة", resources: "موارد", community: "موارد من مجتمع الأساتذة",
    noResults: "لا توجد موارد مطابقة. جرّب فلترًا آخر.", noResourceImage: "صورة المورد",
    verified: "مؤكد", tnd: "د", featured: "مميز",
    footer: "3alamni.tn · سوق لمجتمع الأساتذة التونسيين",
    welcomeBack: "مرحبًا بعودتك", signInPrompt: "سجّل الدخول لإدارة متجر الأستاذ.",
    email: "البريد الإلكتروني", password: "كلمة المرور", signingIn: "جاري تسجيل الدخول...",
    signIn: "تسجيل الدخول", newHere: "جديد في 3alamni؟", createSeller: "إنشاء حساب بائع",
    loginFailed: "فشل تسجيل الدخول.", createStore: "افتح متجرك كأستاذ",
    storeSetup: "أنشئ حسابك وستحصل على خمس رموز تحميل مجانية.",
    displayName: "الاسم الظاهر", storeSlug: "رابط المتجر", whatsapp: "رقم واتساب",
    passwordHint: "كلمة المرور (10 أحرف أو أكثر)", creatingStore: "جاري إنشاء المتجر...",
    createAccount: "إنشاء حساب الأستاذ", alreadyAccount: "عندك حساب؟",
    backToCatalog: "← 3alamni.tn", loading: "جاري التحميل...",
    sharedBy: "مشاركة من", contactWhatsApp: "تواصل عبر واتساب",
    directPayment: "تنسيق الدفع مباشرة مع الأستاذ.", haveCode: "هل لديك رمز تحميل؟",
    codePrompt: "أدخل الرمز ورقم الهاتف المخصّص له.", phoneNumber: "رقم الهاتف",
    preparingDownload: "جاري تجهيز التحميل...", downloadPdf: "تحميل ملف PDF",
    report: "الإبلاغ عن المورد", piracy: "انتهاك حقوق أو سرقة",
    scam: "احتيال", wrongInfo: "معلومات خاطئة", details: "تفاصيل إضافية (اختياري)",
    sendReport: "إرسال البلاغ", reportThanks: "شكرًا لك. تم إرسال البلاغ للمراجعة.",
    unavailable: "هذا المورد غير متاح.", catalogError: "تعذر تحميل الموارد.",
    sellerPortal: "بوابة البائع", yourStore: "متجر الدروس الخاص بك", signOut: "تسجيل الخروج",
    dashboardOverview: "نظرة عامة", analytics: "الإحصائيات", resourcesPage: "مواردي", codesPage: "رموز التحميل",
    profileSettings: "إعدادات المتجر", weeklyDownloads: "التحميلات خلال 7 أيام",
    downloadsThisMonth: "تحميلات هذا الشهر", downloadsAllTime: "كل التحميلات",
    codesThisMonth: "رموز هذا الشهر", estimatedGross: "قيمة تقديرية",
    estimateDisclaimer: "تقدير توضيحي حسب سعر المورد وعمليات التحميل، وليس سجلًّا للمدفوعات.",
    topResources: "الموارد الأكثر تحميلًا", noAnalytics: "ستظهر الإحصائيات بعد أول عملية تحميل.",
    resourceDownloads: "تحميلات", resourceViews: "نقرات التواصل", resourceRevenue: "قيمة تقديرية",
    editStoreProfile: "تعديل ملف المتجر", whatsappGreeting: "رسالة واتساب الافتراضية",
    greetingHint: "استخدم {title} لإدراج اسم المورد تلقائيًا.", saveSettings: "حفظ الإعدادات",
    settingsSaved: "تم حفظ إعدادات المتجر.", profileLoadError: "تعذر تحميل إعدادات المتجر.",
    messagePreview: "معاينة الرسالة", openStorefront: "عرض واجهة المتجر",
    copyCode: "نسخ الرمز", shareWhatsApp: "إرسال عبر واتساب", unusedStatus: "غير مستخدم",
    downloadedStatus: "تم التحميل", expiredStatus: "منتهي", revokedStatus: "ملغى",
    expiresAt: "ينتهي في", codeHistory: "سجل الرموز", filterCodes: "تصفية برقم هاتف المشتري",
    allStatuses: "كل الحالات",
    admin: "الإدارة", dashboardError: "تعذر تحميل لوحة البائع.",
    codesAvailable: "الأكواد المتاحة", contactClicks: "نقرات التواصل",
    activeListings: "العروض النشطة", codesGenerated: "الأكواد المنشأة",
    publishResource: "نشر مورد", title: "العنوان", description: "الوصف", level: "المستوى",
    grade: "المستوى الدراسي", subject: "المادة", trimester: "الثلاثي",
    noTrimester: "بدون ثلاثي", price: "السعر بالدينار", previewImages: "صور المعاينة",
    fullDocument: "الملف الأصلي (PDF)", publish: "نشر المورد",
    createCode: "إنشاء رمز تحميل", chooseListing: "اختر موردًا",
    buyerPhone: "رقم هاتف المشتري", buyerNote: "ملاحظة للمشتري (اختياري)",
    generateCode: "إنشاء رمز", searchPhone: "البحث برقم الهاتف",
    revoke: "إلغاء", yourListings: "مواردك", edit: "تعديل", delete: "حذف",
    facebookPack: "حزمة الفيسبوك", leakLookup: "فحص التسريب",
    inspectFile: "فحص ملف PDF أو صورة", codePacks: "حزم الأكواد وتعزيز العروض",
    codePack: "حزمة أكواد", listingBoost: "تعزيز العرض", amount: "المبلغ بالدينار",
    transferRef: "مرجع التحويل", submitReview: "إرسال للمراجعة",
    paymentRequests: "طلبات الدفع", listingReports: "بلاغات الموارد",
    teacherVerification: "توثيق الأساتذة", listingModeration: "إشراف الموارد",
    conciergeSetup: "إعداد متجر بالوكالة", reviewQueue: "قائمة المراجعة",
    adminLoadError: "تعذر تحميل قائمة الإدارة.", approve: "قبول", reject: "رفض",
    resolve: "حلّ البلاغ", dismiss: "تجاهل", hide: "إخفاء العرض",
    restore: "استعادة العرض", removeVerification: "إزالة التوثيق",
    verifyTeacher: "توثيق الأستاذ", temporaryPassword: "كلمة مرور مؤقتة",
    optionalListing: "مورد أولي اختياري", createConcierge: "إنشاء متجر بالوكالة",
    teacherStorefront: "واجهة متجر أستاذ", filterGrade: "فلترة بالمستوى",
    allTrimesters: "كل الثلاثيات", noFilteredResults: "لا توجد موارد بهذه الفلاتر.",
    gradeExample: "المستوى الدراسي (مثل: البكالوريا رياضيات)",
    subjectPlaceholder: "المادة", previewHint: "صور المعاينة (من 1 إلى 4، JPEG/PNG/WebP)",
    publishListing: "نشر العرض", createDownloadCode: "إنشاء رمز تحميل",
    buyerPhonePlaceholder: "رقم هاتف المشتري",
    buyerNotePlaceholder: "ملاحظة للمشتري (اختياري)", searchBuyerPhone: "البحث برقم هاتف المشتري",
    downloadPreview: "تحميل معاينة مائية", listingOptional: "العرض المراد تعزيزه (اختياري)",
    days: "يومًا", inspectLeak: "فحص PDF أو لقطة شاشة",
    paymentRequestsCount: "طلبات الدفع", listingReportsCount: "بلاغات الموارد",
    noPaymentRequests: "لا توجد طلبات دفع معلّقة.", noListingReports: "لا توجد بلاغات مفتوحة.",
    noDetails: "لا توجد تفاصيل.", viewListing: "عرض المورد", teacherName: "اسم الأستاذ الظاهر",
    loginEmail: "البريد الإلكتروني للدخول", shortBio: "نبذة قصيرة للمتجر (اختياري)",
    listingTitle: "عنوان المورد", noTrimesters: "بدون ثلاثي", previewSource: "صور المعاينة المائية",
    originalPdf: "ملف PDF الأصلي", createConciergeAction: "إنشاء متجر بالوكالة",
    activeStatus: "نشط", hiddenStatus: "مخفي",
    paymentVia: "عبر", codes: "أكواد", boost: "تعزيز",
    editAction: "تعديل", deleteAction: "حذف", revokeAction: "إلغاء",
    searchAction: "بحث", listingToBoost: "العرض المراد تعزيزه",
    transferReference: "مرجع التحويل", submitForReview: "إرسال للمراجعة",
    approveAction: "قبول", rejectAction: "رفض", resolveAction: "حلّ البلاغ",
    dismissAction: "تجاهل", hideAction: "إخفاء العرض", restoreAction: "استعادة العرض",
    noPendingReports: "لا توجد بلاغات مفتوحة.", noPendingTopups: "لا توجد طلبات دفع معلّقة.",
    listingModerationTitle: "إشراف الموارد", conciergeTitle: "إعداد متجر بالوكالة",
    conciergeIntro: "أنشئ حساب بائع مع مورد أولي اختياري. سلّم كلمة المرور المؤقتة للأستاذ مباشرة وبأمان.",
    teacherVerificationTitle: "توثيق الأساتذة", removeVerificationAction: "إزالة التوثيق",
    verifyTeacherAction: "توثيق الأستاذ", accountCreated: "تم إنشاء الحساب",
    storeCreated: "تم إنشاء المتجر",
    topupSubmitted: "تم إرسال طلب الشحن للمراجعة.", reportSubmitted: "تم إرسال البلاغ للمراجعة.",
    noDetailsText: "لا توجد تفاصيل.", viewListingAction: "عرض المورد",
  },
  fr: {
    login: "Connexion", register: "Créer un compte", teacherLogin: "Connexion enseignant",
    openStore: "Ouvrir votre boutique", search: "Rechercher", allLevels: "Tous les niveaux",
    primaire: "Primaire", college: "Collège", lycee: "Lycée",
    allMaterials: "Tous les supports", joudhadha: "Joudhadha", devoir: "Devoir", serie: "Série", cours: "Cours",
    heroEyebrow: "Créé par des enseignants tunisiens", heroTitle: "Des ressources pour faire chaque cours compter.",
    heroText: "Parcourez les joudhadhas, devoirs, séries et cours partagés par des enseignants en Tunisie.",
    searchPlaceholder: "Rechercher une matière, un niveau ou un mot-clé",
    collection: "Collection", resources: "ressources", community: "Ressources de la communauté",
    noResults: "Aucune ressource ne correspond. Essayez un autre filtre.", noResourceImage: "Aperçu de la ressource",
    verified: "Vérifié", tnd: "TND", featured: "À la une",
    footer: "3alamni.tn · Une marketplace pour la communauté enseignante tunisienne",
    welcomeBack: "Bon retour", signInPrompt: "Connectez-vous pour gérer votre boutique.",
    email: "Adresse e-mail", password: "Mot de passe", signingIn: "Connexion...",
    signIn: "Se connecter", newHere: "Nouveau sur 3alamni ?", createSeller: "Créer un compte vendeur",
    loginFailed: "Échec de la connexion.", createStore: "Ouvrez votre boutique",
    storeSetup: "Créez votre compte vendeur et recevez cinq codes gratuits.",
    displayName: "Nom affiché", storeSlug: "Adresse de la boutique", whatsapp: "Numéro WhatsApp",
    passwordHint: "Mot de passe (10 caractères minimum)", creatingStore: "Création du magasin...",
    createAccount: "Créer le compte enseignant", alreadyAccount: "Vous avez déjà un compte ?",
    backToCatalog: "← 3alamni.tn", loading: "Chargement...",
    sharedBy: "Partagé par", contactWhatsApp: "Contacter sur WhatsApp",
    directPayment: "Organisez le paiement directement avec l’enseignant.", haveCode: "Vous avez un code de téléchargement ?",
    codePrompt: "Saisissez le code et le numéro pour lequel il a été créé.", phoneNumber: "Numéro de téléphone",
    preparingDownload: "Préparation du téléchargement...", downloadPdf: "Télécharger le PDF",
    report: "Signaler la ressource", piracy: "Piratage ou atteinte aux droits",
    scam: "Escroquerie", wrongInfo: "Information incorrecte", details: "Détails (facultatif)",
    sendReport: "Envoyer le signalement", reportThanks: "Merci. Le signalement a été envoyé pour examen.",
    unavailable: "Cette ressource est indisponible.", catalogError: "Impossible de charger les ressources.",
    sellerPortal: "Portail vendeur", yourStore: "Votre boutique de cours", signOut: "Se déconnecter",
    dashboardOverview: "Vue d’ensemble", analytics: "Statistiques", resourcesPage: "Mes ressources", codesPage: "Codes de téléchargement",
    profileSettings: "Paramètres de la boutique", weeklyDownloads: "Téléchargements sur 7 jours",
    downloadsThisMonth: "Téléchargements ce mois-ci", downloadsAllTime: "Total des téléchargements",
    codesThisMonth: "Codes ce mois-ci", estimatedGross: "Valeur estimée",
    estimateDisclaimer: "Estimation indicative basée sur le prix et les téléchargements, pas un relevé de paiements.",
    topResources: "Ressources les plus téléchargées", noAnalytics: "Les statistiques apparaîtront après le premier téléchargement.",
    resourceDownloads: "Téléchargements", resourceViews: "Clics de contact", resourceRevenue: "Valeur estimée",
    editStoreProfile: "Modifier le profil de la boutique", whatsappGreeting: "Message WhatsApp par défaut",
    greetingHint: "Utilisez {title} pour insérer automatiquement le titre de la ressource.", saveSettings: "Enregistrer",
    settingsSaved: "Paramètres de la boutique enregistrés.", profileLoadError: "Impossible de charger le profil de la boutique.",
    messagePreview: "Aperçu du message", openStorefront: "Voir la boutique",
    copyCode: "Copier le code", shareWhatsApp: "Envoyer sur WhatsApp", unusedStatus: "Non utilisé",
    downloadedStatus: "Téléchargé", expiredStatus: "Expiré", revokedStatus: "Révoqué",
    expiresAt: "Expire le", codeHistory: "Historique des codes", filterCodes: "Filtrer par téléphone acheteur",
    allStatuses: "Tous les statuts",
    admin: "Administration", dashboardError: "Impossible de charger votre tableau de bord.",
    codesAvailable: "Codes disponibles", contactClicks: "Clics de contact",
    activeListings: "Annonces actives", codesGenerated: "Codes générés",
    publishResource: "Publier une ressource", title: "Titre", description: "Description", level: "Niveau",
    grade: "Classe", subject: "Matière", trimester: "Trimestre",
    noTrimester: "Sans trimestre", price: "Prix en TND", previewImages: "Images d’aperçu",
    fullDocument: "Document original (PDF)", publish: "Publier l’annonce",
    createCode: "Créer un code de téléchargement", chooseListing: "Choisir une ressource",
    buyerPhone: "Téléphone de l’acheteur", buyerNote: "Note acheteur (facultatif)",
    generateCode: "Générer le code", searchPhone: "Rechercher par téléphone",
    revoke: "Révoquer", yourListings: "Vos annonces", edit: "Modifier", delete: "Supprimer",
    facebookPack: "Pack Facebook", leakLookup: "Détecteur de fuite",
    inspectFile: "Inspecter un PDF ou une capture", codePacks: "Packs de codes et boosts",
    codePack: "Pack de codes", listingBoost: "Boost d’annonce", amount: "Montant en TND",
    transferRef: "Référence du transfert", submitReview: "Envoyer pour validation",
    paymentRequests: "Demandes de paiement", listingReports: "Signalements",
    teacherVerification: "Vérification des enseignants", listingModeration: "Modération des annonces",
    conciergeSetup: "Configuration concierge", reviewQueue: "File de révision",
    adminLoadError: "Impossible de charger la file d’administration.", approve: "Approuver", reject: "Refuser",
    resolve: "Résoudre", dismiss: "Rejeter", hide: "Masquer l’annonce",
    restore: "Restaurer l’annonce", removeVerification: "Retirer la vérification",
    verifyTeacher: "Vérifier l’enseignant", temporaryPassword: "Mot de passe temporaire",
    optionalListing: "Annonce initiale facultative", createConcierge: "Créer la boutique concierge",
    teacherStorefront: "Boutique enseignant", filterGrade: "Filtrer par classe",
    allTrimesters: "Tous les trimestres", noFilteredResults: "Aucune ressource ne correspond à ces filtres.",
    gradeExample: "Classe (ex. bac-math)",
    subjectPlaceholder: "Matière", previewHint: "Images d’aperçu (1 à 4, JPEG/PNG/WebP)",
    publishListing: "Publier l’annonce", createDownloadCode: "Créer un code de téléchargement",
    buyerPhonePlaceholder: "Téléphone de l’acheteur",
    buyerNotePlaceholder: "Note acheteur (facultatif)", searchBuyerPhone: "Rechercher par téléphone",
    downloadPreview: "Télécharger l’aperçu filigrané", listingOptional: "Annonce à booster (facultatif)",
    days: "jours", inspectLeak: "Inspecter un PDF ou une capture",
    paymentRequestsCount: "Demandes de paiement", listingReportsCount: "Signalements",
    noPaymentRequests: "Aucune demande de paiement en attente.", noListingReports: "Aucun signalement ouvert.",
    noDetails: "Aucun détail fourni.", viewListing: "Voir la ressource", teacherName: "Nom affiché de l’enseignant",
    loginEmail: "Adresse e-mail de connexion", shortBio: "Brève bio de la boutique (facultatif)",
    listingTitle: "Titre de l’annonce", noTrimesters: "Sans trimestre", previewSource: "Images sources filigranées",
    originalPdf: "PDF original", createConciergeAction: "Créer la boutique concierge",
    activeStatus: "ACTIF", hiddenStatus: "MASQUÉ",
    paymentVia: "via", codes: "codes", boost: "boost",
    editAction: "Modifier", deleteAction: "Supprimer", revokeAction: "Révoquer",
    searchAction: "Rechercher", listingToBoost: "Annonce à booster",
    transferReference: "Référence du transfert", submitForReview: "Envoyer pour validation",
    approveAction: "Approuver", rejectAction: "Refuser", resolveAction: "Résoudre",
    dismissAction: "Rejeter", hideAction: "Masquer l’annonce", restoreAction: "Restaurer l’annonce",
    noPendingReports: "Aucun signalement ouvert.", noPendingTopups: "Aucune demande de paiement en attente.",
    listingModerationTitle: "Modération des annonces", conciergeTitle: "Configuration concierge",
    conciergeIntro: "Créez un compte vendeur avec une annonce initiale facultative. Remettez le mot de passe temporaire directement à l’enseignant.",
    teacherVerificationTitle: "Vérification des enseignants", removeVerificationAction: "Retirer la vérification",
    verifyTeacherAction: "Vérifier l’enseignant", accountCreated: "Compte créé",
    storeCreated: "Boutique créée",
    topupSubmitted: "Demande de recharge envoyée pour validation.", reportSubmitted: "Signalement envoyé pour examen.",
    noDetailsText: "Aucun détail fourni.", viewListingAction: "Voir la ressource",
  },
} as const;

const languageChangeEvent = "3alamni-language-change";

function subscribeToLanguage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(languageChangeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(languageChangeEvent, onChange);
  };
}

function getStoredLanguage(): Language {
  return window.localStorage.getItem("3alamni-language") === "fr" ? "fr" : "ar";
}

type I18nContextValue = { language: Language; setLanguage: (language: Language) => void; t: (typeof dictionaries)[Language] };
const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore(subscribeToLanguage, getStoredLanguage, (): Language => "ar");
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    localStorage.setItem("3alamni-language", language);
  }, [language]);
  const setLanguage = (value: Language) => {
    localStorage.setItem("3alamni-language", value);
    window.dispatchEvent(new Event(languageChangeEvent));
  };
  return <I18nContext.Provider value={{ language, setLanguage, t: dictionaries[language] }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}
