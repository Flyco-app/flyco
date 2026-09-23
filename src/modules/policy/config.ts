import type { Locale } from '@/lib/auth/validation';

export const policyVersions = {
  senderDeclaration: 'sender-safety-2026-09-v1',
  travelerSafety: 'traveler-safety-2026-09-v1',
  marketplaceTerms: 'prelaunch-2026-09-draft',
  privacyNotice: 'prelaunch-2026-09-draft',
} as const;

export type PolicyClassification =
  | 'technical-platform-rule'
  | 'provisional-business-policy'
  | 'requires-legal-review';

export const prohibitedItemConcepts = [
  { code: 'weapons', classification: 'provisional-business-policy' },
  { code: 'explosives', classification: 'technical-platform-rule' },
  { code: 'illegal_drugs', classification: 'technical-platform-rule' },
  { code: 'hazardous_substances', classification: 'technical-platform-rule' },
  {
    code: 'stolen_or_illegal_goods',
    classification: 'technical-platform-rule',
  },
  { code: 'live_animals', classification: 'provisional-business-policy' },
  { code: 'dangerous_materials', classification: 'technical-platform-rule' },
] as const satisfies readonly {
  code: string;
  classification: PolicyClassification;
}[];

const en = {
  help: 'Help & safety',
  safety: 'Safety',
  terms: 'Terms',
  privacy: 'Privacy',
  draft:
    'Pre-launch draft — professional legal review is required before launch.',
  safetyTitle: 'Items we do not allow',
  safetyIntro:
    'Flyco does not facilitate the items below. This safety list is not an exhaustive statement of customs or local law.',
  weapons: 'Weapons',
  explosives: 'Explosives',
  illegal_drugs: 'Illegal drugs',
  hazardous_substances: 'Hazardous substances',
  stolen_or_illegal_goods: 'Stolen or illegal goods',
  live_animals: 'Live animals',
  dangerous_materials: 'Highly dangerous materials',
  customsTitle: 'Cross-border journeys',
  customs:
    'Customs, import and export rules may apply. Sender and traveler should verify the rules that apply to their route and item.',
  senderAccurate: 'I confirm that the declared contents are accurate.',
  senderAllowed:
    'I confirm that the item is not prohibited by Flyco’s safety policy.',
  senderPacked: 'I confirm that the item is appropriately packaged.',
  senderCustoms:
    'I understand that customs, import or export requirements may apply.',
  publicationRequired: 'Complete every safety confirmation before publishing.',
  travelerConfirm:
    'I reviewed the available item details and accept the current safety guidance.',
  travelerContext:
    'Carry only items you are comfortable with. Prohibited items are not allowed, and cross-border obligations may apply.',
  participantInfo:
    'Visible only to the sender and traveler for this booking proposal.',
  declaredContents: 'Declared contents',
  description: 'Full description',
  handling: 'Handling notes',
  photos: 'Private item photos',
  cancellation:
    'Before payments are introduced, either participant may cancel a proposed or accepted booking. Cancelling an accepted booking releases the reserved capacity immediately. No fee or refund applies in this phase.',
  helpTitle: 'How can we help?',
  helpIntro:
    'Find guidance for account access, listings, bookings and marketplace safety.',
  accountHelp: 'Account and sign-in help',
  bookingHelp: 'Booking help',
  contact: 'Contact support',
  contactPending:
    'A customer support contact channel will be published before launch. No support request is sent from this preview.',
  termsTitle: 'Terms — pre-launch structure',
  privacyTitle: 'Privacy — pre-launch structure',
  termsBody:
    'The final marketplace terms have not been supplied or legally approved. Before launch they must address platform role, user responsibilities, cancellations, payments, liability, governing law and enforcement.',
  privacyBody:
    'The final privacy notice has not been supplied or legally approved. Before launch it must describe data controllers, purposes, legal bases, retention, rights, processors and international transfers.',
  profilePrivacy:
    'Profile information supports trust and account operation. Public fields are clearly separated from private account details.',
  itemPrivacy:
    'Declared contents and private photos are hidden from public listings. They become available only to participants in a booking proposal.',
  identityPrivacy:
    'Identity verification is not active. Flyco does not collect identity documents in this preview.',
};

export type PolicyCopy = typeof en;

export const policyCopy: Record<Locale, PolicyCopy> = {
  en,
  fr: {
    help: 'Aide et sécurité',
    safety: 'Sécurité',
    terms: 'Conditions',
    privacy: 'Confidentialité',
    draft:
      'Projet avant lancement — une validation juridique professionnelle est requise avant le lancement.',
    safetyTitle: 'Objets interdits',
    safetyIntro:
      'Flyco ne facilite pas le transport des objets ci-dessous. Cette liste de sécurité ne constitue pas une liste exhaustive des règles douanières ou locales.',
    weapons: 'Armes',
    explosives: 'Explosifs',
    illegal_drugs: 'Drogues illégales',
    hazardous_substances: 'Substances dangereuses',
    stolen_or_illegal_goods: 'Biens volés ou illégaux',
    live_animals: 'Animaux vivants',
    dangerous_materials: 'Matières hautement dangereuses',
    customsTitle: 'Trajets transfrontaliers',
    customs:
      'Des règles douanières, d’importation ou d’exportation peuvent s’appliquer. L’expéditeur et le voyageur doivent vérifier les règles applicables à leur trajet et à l’objet.',
    senderAccurate: 'Je confirme que le contenu déclaré est exact.',
    senderAllowed:
      'Je confirme que l’objet n’est pas interdit par la politique de sécurité Flyco.',
    senderPacked: 'Je confirme que l’objet est correctement emballé.',
    senderCustoms:
      'Je comprends que des obligations douanières, d’importation ou d’exportation peuvent s’appliquer.',
    publicationRequired: 'Confirmez chaque règle de sécurité avant de publier.',
    travelerConfirm:
      'J’ai examiné les informations disponibles sur l’objet et j’accepte les consignes de sécurité actuelles.',
    travelerContext:
      'Transportez uniquement les objets avec lesquels vous êtes à l’aise. Les objets interdits ne sont pas autorisés et des obligations transfrontalières peuvent s’appliquer.',
    participantInfo:
      'Visible uniquement par l’expéditeur et le voyageur de cette proposition.',
    declaredContents: 'Contenu déclaré',
    description: 'Description complète',
    handling: 'Consignes de manutention',
    photos: 'Photos privées de l’objet',
    cancellation:
      'Avant l’ajout des paiements, chaque participant peut annuler une réservation proposée ou acceptée. L’annulation d’une réservation acceptée libère immédiatement la capacité. Aucun frais ni remboursement ne s’applique à cette phase.',
    helpTitle: 'Comment pouvons-nous vous aider ?',
    helpIntro:
      'Consultez l’aide sur le compte, les annonces, les réservations et la sécurité.',
    accountHelp: 'Aide au compte et à la connexion',
    bookingHelp: 'Aide aux réservations',
    contact: 'Contacter l’assistance',
    contactPending:
      'Un canal d’assistance client sera publié avant le lancement. Aucun message n’est envoyé depuis cette version de prévisualisation.',
    termsTitle: 'Conditions — structure avant lancement',
    privacyTitle: 'Confidentialité — structure avant lancement',
    termsBody:
      'Les conditions définitives de la place de marché n’ont pas été fournies ni validées juridiquement. Avant le lancement, elles devront traiter du rôle de la plateforme, des responsabilités, des annulations, des paiements, de la responsabilité, du droit applicable et de l’application des règles.',
    privacyBody:
      'La notice de confidentialité définitive n’a pas été fournie ni validée juridiquement. Avant le lancement, elle devra préciser les responsables, finalités, bases légales, durées de conservation, droits, sous-traitants et transferts internationaux.',
    profilePrivacy:
      'Les données du profil servent à la confiance et au fonctionnement du compte. Les champs publics sont clairement séparés des informations privées.',
    itemPrivacy:
      'Le contenu déclaré et les photos privées sont masqués dans les annonces publiques. Ils ne deviennent visibles qu’aux participants d’une proposition.',
    identityPrivacy:
      'La vérification d’identité n’est pas active. Flyco ne collecte aucun document d’identité dans cette prévisualisation.',
  },
  ar: {
    help: 'المساعدة والسلامة',
    safety: 'السلامة',
    terms: 'الشروط',
    privacy: 'الخصوصية',
    draft: 'مسودة قبل الإطلاق — يلزم إجراء مراجعة قانونية متخصصة قبل الإطلاق.',
    safetyTitle: 'أغراض غير مسموح بها',
    safetyIntro:
      'لا تسهّل Flyco نقل الأغراض التالية. قائمة السلامة هذه ليست بياناً شاملاً لقواعد الجمارك أو القوانين المحلية.',
    weapons: 'الأسلحة',
    explosives: 'المتفجرات',
    illegal_drugs: 'المخدرات غير القانونية',
    hazardous_substances: 'المواد الخطرة',
    stolen_or_illegal_goods: 'البضائع المسروقة أو غير القانونية',
    live_animals: 'الحيوانات الحية',
    dangerous_materials: 'المواد شديدة الخطورة',
    customsTitle: 'الرحلات عبر الحدود',
    customs:
      'قد تنطبق قواعد الجمارك والاستيراد والتصدير. على المرسل والمسافر التحقق من القواعد التي تنطبق على المسار والغرض.',
    senderAccurate: 'أؤكد أن المحتويات المصرح بها دقيقة.',
    senderAllowed: 'أؤكد أن الغرض غير محظور وفق سياسة سلامة Flyco.',
    senderPacked: 'أؤكد أن الغرض مغلف بشكل مناسب.',
    senderCustoms: 'أفهم أن متطلبات الجمارك أو الاستيراد أو التصدير قد تنطبق.',
    publicationRequired: 'أكمل جميع تأكيدات السلامة قبل النشر.',
    travelerConfirm:
      'راجعت معلومات الغرض المتاحة وأوافق على إرشادات السلامة الحالية.',
    travelerContext:
      'احمل فقط الأغراض التي ترتاح لنقلها. الأغراض المحظورة غير مسموح بها، وقد تنطبق التزامات عبر الحدود.',
    participantInfo: 'مرئي فقط للمرسل والمسافر في اقتراح الحجز هذا.',
    declaredContents: 'المحتويات المصرح بها',
    description: 'الوصف الكامل',
    handling: 'تعليمات المناولة',
    photos: 'صور الغرض الخاصة',
    cancellation:
      'قبل إضافة المدفوعات، يمكن لأي مشارك إلغاء الحجز المقترح أو المقبول. يؤدي إلغاء الحجز المقبول إلى تحرير السعة المحجوزة فوراً. لا توجد رسوم أو مبالغ مستردة في هذه المرحلة.',
    helpTitle: 'كيف يمكننا مساعدتك؟',
    helpIntro:
      'اعثر على إرشادات حول الحساب وتسجيل الدخول والإعلانات والحجوزات وسلامة السوق.',
    accountHelp: 'مساعدة الحساب وتسجيل الدخول',
    bookingHelp: 'مساعدة الحجز',
    contact: 'الاتصال بالدعم',
    contactPending:
      'سيتم نشر قناة دعم العملاء قبل الإطلاق. لا يتم إرسال أي طلب دعم من هذه النسخة التجريبية.',
    termsTitle: 'الشروط — هيكل قبل الإطلاق',
    privacyTitle: 'الخصوصية — هيكل قبل الإطلاق',
    termsBody:
      'لم يتم توفير شروط السوق النهائية أو اعتمادها قانونياً. قبل الإطلاق يجب أن تتناول دور المنصة ومسؤوليات المستخدم والإلغاء والمدفوعات والمسؤولية والقانون المعمول به وتنفيذ السياسات.',
    privacyBody:
      'لم يتم توفير إشعار الخصوصية النهائي أو اعتماده قانونياً. قبل الإطلاق يجب أن يوضح مسؤولي البيانات والأغراض والأسس القانونية والاحتفاظ والحقوق والمعالجين والتحويلات الدولية.',
    profilePrivacy:
      'تدعم معلومات الملف الشخصي الثقة وتشغيل الحساب. الحقول العامة منفصلة بوضوح عن تفاصيل الحساب الخاصة.',
    itemPrivacy:
      'تظل المحتويات المصرح بها والصور الخاصة مخفية عن الإعلانات العامة، وتتاح فقط للمشاركين في اقتراح الحجز.',
    identityPrivacy:
      'التحقق من الهوية غير مفعل. لا تجمع Flyco وثائق الهوية في هذه النسخة التجريبية.',
  },
};
