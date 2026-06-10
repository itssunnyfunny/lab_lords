export const softwarePageSlugs = [
  "study-hall-management",
  "library-management",
  "seat-management",
  "student-fee-management",
  "fee-reminder",
  "coaching-management",
  "tuition-management",
] as const;

export type SoftwarePageSlug = (typeof softwarePageSlugs)[number];

type ContentItem = {
  title: string;
  description: string;
};

type FaqItem = {
  question: string;
  answer: string;
};

export type SoftwarePage = {
  slug: SoftwarePageSlug;
  shortName: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  eyebrow: string;
  h1: string;
  heroDescription: string;
  audience: string[];
  heroHighlights: ContentItem[];
  problemTitle: string;
  problemDescription: string;
  problems: ContentItem[];
  featureTitle: string;
  featureDescription: string;
  features: ContentItem[];
  useCaseTitle: string;
  useCaseDescription: string;
  useCases: ContentItem[];
  faqs: FaqItem[];
  relatedSlugs: SoftwarePageSlug[];
  ctaTitle: string;
  ctaDescription: string;
};

export const softwarePages: Record<SoftwarePageSlug, SoftwarePage> = {
  "study-hall-management": {
    slug: "study-hall-management",
    shortName: "Study hall management",
    metaTitle: "Study Hall Software for Seats, Shifts and Fees",
    metaDescription:
      "Manage study hall seats, shifts, students, fee dues and staff across one or more branches with Lab Lords.",
    keywords: ["study hall software", "study hall management software"],
    eyebrow: "Study hall software",
    h1: "Run every study hall seat, shift and fee from one system",
    heroDescription:
      "Lab Lords gives study hall owners a practical operating view of physical seats, time-based shifts, active students, payments, dues and staff access. It replaces the daily patchwork of registers, spreadsheets and chat messages without changing how your centre works.",
    audience: ["Study hall owners", "Reading room operators", "Multi-branch managers"],
    heroHighlights: [
      {
        title: "Map the real floor",
        description: "Create physical seats once and see how they are allocated in each shift.",
      },
      {
        title: "Keep shifts conflict-free",
        description: "Block overlapping allocations before they create confusion at the front desk.",
      },
      {
        title: "Connect fees to students",
        description: "See paid, due and waived records beside the student and their active allocation.",
      },
    ],
    problemTitle: "Study hall operations become difficult before the owner notices",
    problemDescription:
      "A busy study hall is a capacity business. Small errors in seat assignment, shift timing or fee follow-up quickly become lost revenue and an uneven student experience.",
    problems: [
      {
        title: "The same seat appears free in two places",
        description:
          "Paper charts and separate shift sheets make it easy to promise a seat that is already occupied during an overlapping time slot.",
      },
      {
        title: "Fee status lives outside the student record",
        description:
          "Staff search notebooks, payment screenshots and messages before they can answer a simple question about pending dues.",
      },
      {
        title: "Owners depend on end-of-day updates",
        description:
          "Branch health is hard to judge when occupancy, collections and staff actions are reported manually.",
      },
    ],
    featureTitle: "A study hall management system built around physical capacity",
    featureDescription:
      "The software follows the objects your team already understands: branches, seats, shifts, students, payments and staff roles.",
    features: [
      {
        title: "Seat maps by shift",
        description: "View available and occupied seats for morning, evening, full-day or custom shifts.",
      },
      {
        title: "Overlap-aware allocation",
        description: "Prevent a student or seat from being assigned to time slots that overlap.",
      },
      {
        title: "Student operating records",
        description: "Keep contact details, status, fee settings and active seat information together.",
      },
      {
        title: "Payment and due tracking",
        description: "Record collections and distinguish current dues, paid records and waived amounts.",
      },
      {
        title: "Branch and staff controls",
        description: "Give managers and staff only the operational permissions their role requires.",
      },
      {
        title: "Owner-ready analytics",
        description: "Review occupancy and payment trends without waiting for a manually prepared report.",
      },
    ],
    useCaseTitle: "Useful from the first branch to a growing study hall network",
    useCaseDescription:
      "Start with the operational bottleneck that matters most, then bring the rest of the branch into the same workflow.",
    useCases: [
      {
        title: "Opening a new shift",
        description:
          "Define the time window, price and available seats, then allocate students without colliding with existing shifts.",
      },
      {
        title: "Handling a seat change",
        description:
          "Release the old allocation, check availability and move the student while preserving a readable history.",
      },
      {
        title: "Reviewing month-end dues",
        description:
          "See pending payments, prepare follow-up drafts and let the owner decide what should be sent.",
      },
    ],
    faqs: [
      {
        question: "What is study hall management software?",
        answer:
          "Study hall management software keeps student records, physical seats, time-based shifts, payments, dues and staff work in one digital system. It is designed to reduce conflicts and give owners a clearer view of daily operations.",
      },
      {
        question: "Can Lab Lords manage the same seat across different shifts?",
        answer:
          "Yes. A physical seat can be used in compatible time slots, while overlap checks prevent the same seat or student from being assigned to conflicting shifts.",
      },
      {
        question: "Does it work for more than one study hall branch?",
        answer:
          "Yes. Lab Lords keeps students, seats, payments, staff and analytics scoped to the correct branch while giving owners a multi-branch operating view.",
      },
      {
        question: "Can staff use the system without seeing owner-only settings?",
        answer:
          "Yes. Role and permission controls let owners delegate daily work while protecting sensitive branch, finance and configuration actions.",
      },
    ],
    relatedSlugs: ["seat-management", "student-fee-management", "fee-reminder"],
    ctaTitle: "Bring your study hall floor into one readable system",
    ctaDescription:
      "Start with one branch and model the seats, shifts and students your team already manages today.",
  },
  "library-management": {
    slug: "library-management",
    shortName: "Library management",
    metaTitle: "Library Management Software for Reading Rooms",
    metaDescription:
      "Digitise reading-room and membership operations with seat, shift, student, fee, staff and branch management software.",
    keywords: [
      "library management software",
      "digital library management",
      "offline library management software",
    ],
    eyebrow: "Library management software",
    h1: "Digital operations for libraries and reading rooms with physical seats",
    heroDescription:
      "Lab Lords helps Indian reading-room libraries manage members, seats, time slots, recurring fees, staff and branches. It is built for the operational side of a physical study library, not book cataloguing or lending circulation.",
    audience: ["Reading-room libraries", "Membership libraries", "Study libraries"],
    heroHighlights: [
      {
        title: "Digitise memberships",
        description: "Keep each member’s contact, status, seat, shift and fee details in one record.",
      },
      {
        title: "Use capacity well",
        description: "Understand which seats and time slots are occupied before admitting more members.",
      },
      {
        title: "Separate every branch",
        description: "Keep staff actions and member records connected to the correct library location.",
      },
    ],
    problemTitle: "A reading-room library needs more than a member spreadsheet",
    problemDescription:
      "Once seats are sold by shift and fees recur every month, the library starts behaving like an operating business with capacity, collections and staff controls.",
    problems: [
      {
        title: "Membership lists do not show real availability",
        description:
          "A row in a spreadsheet cannot reliably explain whether a physical seat is free in a specific time window.",
      },
      {
        title: "Renewals and dues are checked manually",
        description:
          "Operators spend time reconciling receipts and messages before they know which members need follow-up.",
      },
      {
        title: "Branch data becomes mixed",
        description:
          "When multiple reading rooms share files, staff can edit the wrong record or report numbers from the wrong location.",
      },
    ],
    featureTitle: "Digital library management for the part that happens on the floor",
    featureDescription:
      "Lab Lords focuses on reading-room operations: members, seats, shifts, fees, staff permissions and branch analytics.",
    features: [
      {
        title: "Member records",
        description: "Store active and inactive member details with their current operational context.",
      },
      {
        title: "Digital seat map",
        description: "Represent the actual room and review seat availability by shift or combined schedule.",
      },
      {
        title: "Time-slot management",
        description: "Create morning, afternoon, evening, full-day or centre-specific shift combinations.",
      },
      {
        title: "Recurring fee records",
        description: "Track payments and dues against the member instead of maintaining a second ledger.",
      },
      {
        title: "Controlled staff access",
        description: "Let front-desk staff handle members without exposing every owner-level action.",
      },
      {
        title: "Library branch overview",
        description: "Compare occupancy and payment health across locations from structured records.",
      },
    ],
    useCaseTitle: "Designed for membership-based study libraries",
    useCaseDescription:
      "Use Lab Lords when the main service is a reliable seat, quiet environment and scheduled access rather than book circulation.",
    useCases: [
      {
        title: "Admitting a new member",
        description:
          "Create the member record, apply the correct fee and allocate an available seat in the requested shift.",
      },
      {
        title: "Renewing monthly access",
        description:
          "Review the member’s payment history and active allocation before recording the next collection.",
      },
      {
        title: "Opening another reading room",
        description:
          "Create a separate branch with its own seats, staff, members and analytics while retaining owner oversight.",
      },
    ],
    faqs: [
      {
        question: "Is Lab Lords a book cataloguing and circulation system?",
        answer:
          "No. Lab Lords is designed for reading rooms, study libraries and membership libraries that sell access to physical seats and shifts. It does not currently manage book catalogues, issue-return circulation or ebook collections.",
      },
      {
        question: "What does digital library management mean for a reading room?",
        answer:
          "For a reading-room business, it means digitising member records, seats, time slots, fees, staff access and branch reporting so daily operations do not depend on paper registers.",
      },
      {
        question: "Can one seat be used by different members during the day?",
        answer:
          "Yes. The seat can be allocated in non-overlapping shifts, helping the library use the same physical capacity across multiple time windows.",
      },
      {
        question: "Can I manage several library branches?",
        answer:
          "Yes. Each branch has its own members, seats, shifts, fees and staff context, while the owner can review the wider operation.",
      },
    ],
    relatedSlugs: ["study-hall-management", "seat-management", "student-fee-management"],
    ctaTitle: "Digitise your reading-room operations without changing the business model",
    ctaDescription:
      "Set up one library branch, map its physical seats and move active member records into a cleaner workflow.",
  },
  "seat-management": {
    slug: "seat-management",
    shortName: "Seat management",
    metaTitle: "Seat Management Software for Study Libraries",
    metaDescription:
      "Manage physical seats and time-based allocations for study halls, reading rooms and coaching centres without overlap conflicts.",
    keywords: ["seat management software", "seat booking software for library"],
    eyebrow: "Seat management software",
    h1: "Know exactly which student has which seat in every shift",
    heroDescription:
      "Lab Lords is seat management software for businesses that operate real rooms with limited capacity. Map seats, define shifts, allocate students and prevent time conflicts across study halls, libraries, coaching centres and tuition centres.",
    audience: ["Seat-based study centres", "Library front desks", "Branch operations teams"],
    heroHighlights: [
      {
        title: "Physical seat inventory",
        description: "Create a stable map of the desks or seats that actually exist in each branch.",
      },
      {
        title: "Shift-aware availability",
        description: "See capacity in the requested time slot rather than treating a seat as simply free or occupied.",
      },
      {
        title: "Allocation safeguards",
        description: "Stop double allocation and overlapping student schedules before saving the change.",
      },
    ],
    problemTitle: "Seat errors are expensive because they become visible in front of students",
    problemDescription:
      "A seat promise is a service commitment. When availability is tracked in separate sheets, staff discover conflicts only when two students arrive.",
    problems: [
      {
        title: "Static seat charts miss time",
        description:
          "A seat can be available in the morning and occupied in the evening, but a paper map cannot express that reliably.",
      },
      {
        title: "Staff book from different sources",
        description:
          "Phone notes, registers and spreadsheets drift apart, leaving no single answer to what is available.",
      },
      {
        title: "Capacity decisions become guesswork",
        description:
          "Owners cannot judge whether to add a shift, rearrange the floor or open a branch without structured utilization data.",
      },
    ],
    featureTitle: "Seat allocation that understands the room and the clock",
    featureDescription:
      "Lab Lords treats every allocation as a relationship between a branch, physical seat, student and one or more time slots.",
    features: [
      {
        title: "Branch-specific seat maps",
        description: "Use labels that match the room so staff can find and assign seats quickly.",
      },
      {
        title: "Custom shifts",
        description: "Model the time windows and prices your centre sells instead of adapting to fixed software slots.",
      },
      {
        title: "Conflict detection",
        description: "Reject seat or student allocations when the requested shift overlaps an active assignment.",
      },
      {
        title: "Multi-shift plans",
        description: "Combine compatible shifts for students who need longer access while preserving capacity checks.",
      },
      {
        title: "Release and reallocate",
        description: "End an active allocation and move a student without erasing the previous operating record.",
      },
      {
        title: "Utilization analytics",
        description: "Review used and available shift-slots to understand how effectively the floor is operating.",
      },
    ],
    useCaseTitle: "Practical seat workflows for the front desk",
    useCaseDescription:
      "The system supports staff decisions at admission, renewal and seat-change time without exposing private app links on public pages.",
    useCases: [
      {
        title: "Finding a seat for a new student",
        description:
          "Choose the requested shift, review actual availability and assign a seat with overlap checks.",
      },
      {
        title: "Moving a student mid-month",
        description:
          "Release the current seat, verify the target seat and preserve allocation history for later review.",
      },
      {
        title: "Planning more capacity",
        description:
          "Use shift-slot utilization to see whether demand requires more seats, another shift or a new location.",
      },
    ],
    faqs: [
      {
        question: "How is seat management software different from a seat spreadsheet?",
        answer:
          "Seat management software connects each physical seat to a student, branch and time slot. It can validate overlap and availability, while a spreadsheet usually depends on staff checking several rows or tabs manually.",
      },
      {
        question: "Is this public seat booking software for students?",
        answer:
          "Lab Lords currently supports staff-managed seat allocation. It is designed for the owner or front desk to approve assignments rather than offering an open public booking marketplace.",
      },
      {
        question: "Can a student take more than one shift?",
        answer:
          "Yes. Compatible shifts can be assigned separately or through a multi-shift plan, while overlapping combinations are blocked.",
      },
      {
        question: "Does the seat map work across branches?",
        answer:
          "Each branch has its own physical seat inventory and allocations, which keeps availability accurate for the location where the student will attend.",
      },
    ],
    relatedSlugs: ["study-hall-management", "library-management", "coaching-management"],
    ctaTitle: "Replace seat guesswork with a branch-ready allocation system",
    ctaDescription:
      "Map the room, define the shifts and let your team work from one source of seat availability.",
  },
  "student-fee-management": {
    slug: "student-fee-management",
    shortName: "Student fee management",
    metaTitle: "Student Fee Management and Payment Tracking",
    metaDescription:
      "Track student payments, monthly dues, waived fees and collection history across study halls, libraries and coaching branches.",
    keywords: ["student fee management", "student payment tracking"],
    eyebrow: "Student fee management",
    h1: "Keep student payments, dues and operating records together",
    heroDescription:
      "Lab Lords helps offline education owners track what each student owes, what has been collected and what needs review. Payment records stay connected to the student, branch and service context instead of being split across registers and chat screenshots.",
    audience: ["Education business owners", "Fee desk staff", "Branch managers"],
    heroHighlights: [
      {
        title: "One student ledger",
        description: "Review paid, due and waived records without searching a separate collection sheet.",
      },
      {
        title: "Branch-safe collections",
        description: "Keep every payment connected to the branch and authorized staff action.",
      },
      {
        title: "Clear due review",
        description: "Separate pending obligations from completed payment history before following up.",
      },
    ],
    problemTitle: "Fee tracking breaks when payment evidence is scattered",
    problemDescription:
      "Offline centres often accept cash, UPI and other payments at the front desk. Without a shared record, owners and staff can disagree about what was paid and what remains due.",
    problems: [
      {
        title: "Payment status is reconstructed from messages",
        description:
          "Staff search screenshots and personal chats because the operational system does not hold the complete student ledger.",
      },
      {
        title: "Monthly dues and old dues are mixed",
        description:
          "A single total does not explain whether the issue is a current fee, an overdue balance or a deliberately waived amount.",
      },
      {
        title: "Owners cannot audit changes quickly",
        description:
          "When several staff members collect fees, it is difficult to understand who recorded a payment and when.",
      },
    ],
    featureTitle: "Student payment tracking built for daily branch work",
    featureDescription:
      "The payment workflow is connected to students, permissions and branch analytics so collection records stay operationally useful.",
    features: [
      {
        title: "Paid, due and waived states",
        description: "Use explicit statuses instead of ambiguous colours or handwritten marks.",
      },
      {
        title: "Student-linked history",
        description: "Review payment records in the context of the student and their active branch service.",
      },
      {
        title: "Payment method details",
        description: "Record supported methods and references when the branch needs a clearer audit trail.",
      },
      {
        title: "Recurring payment generation",
        description: "Prepare monthly obligations for active students without creating duplicate records.",
      },
      {
        title: "Permission-aware actions",
        description: "Allow collection work while reserving sensitive actions such as waivers for authorized roles.",
      },
      {
        title: "Collection analytics",
        description: "Review revenue, collected amounts and active dues using the same underlying ledger.",
      },
    ],
    useCaseTitle: "Useful at admission, renewal and month-end",
    useCaseDescription:
      "The fee workflow follows the points where offline education teams already discuss money with students and parents.",
    useCases: [
      {
        title: "Collecting an admission fee",
        description:
          "Create the student and record the initial charge as part of the same admission workflow.",
      },
      {
        title: "Recording a monthly payment",
        description:
          "Find the student, confirm the due record and mark the collection with the appropriate payment details.",
      },
      {
        title: "Reviewing overdue balances",
        description:
          "Use one ledger to identify genuine overdue cases before staff begin reminder calls or messages.",
      },
    ],
    faqs: [
      {
        question: "What is student fee management software?",
        answer:
          "It is a system for recording student charges, collections, dues, waived amounts and payment history. It helps owners and staff work from the same ledger rather than separate notebooks and spreadsheets.",
      },
      {
        question: "Can Lab Lords track cash and UPI payments?",
        answer:
          "Lab Lords can record supported payment methods and an optional transaction reference, giving branches a clearer operational trail for collections.",
      },
      {
        question: "How are overdue fees different from current dues?",
        answer:
          "Current dues are unpaid obligations in the active period. Overdue fees are older unpaid records that have passed their expected period and may require follow-up.",
      },
      {
        question: "Can staff waive a student fee?",
        answer:
          "Waiver actions can be restricted by role. This allows staff to record routine collections while owners retain control over exceptions.",
      },
    ],
    relatedSlugs: ["fee-reminder", "coaching-management", "tuition-management"],
    ctaTitle: "Give every branch one dependable student fee ledger",
    ctaDescription:
      "Start with active students and current dues, then bring monthly collection work into the same system.",
  },
  "fee-reminder": {
    slug: "fee-reminder",
    shortName: "Fee reminder",
    metaTitle: "Fee Reminder Software for Education Centres",
    metaDescription:
      "Identify overdue student fees and prepare owner-reviewed reminder messages for study halls, libraries, coaching and tuition centres.",
    keywords: ["fee reminder software", "student fee reminder"],
    eyebrow: "Fee reminder software",
    h1: "Follow up on student fees without losing context or control",
    heroDescription:
      "Lab Lords turns verified due records into a clearer follow-up queue for offline education teams. Staff can identify overdue students and prepare message drafts, while the owner reviews what should actually be sent.",
    audience: ["Owners handling dues", "Fee collection teams", "Branch managers"],
    heroHighlights: [
      {
        title: "Start from the ledger",
        description: "Build reminders from actual unpaid records instead of an informal list.",
      },
      {
        title: "Keep a human review step",
        description: "Drafts wait for approval so exceptions and sensitive cases are handled carefully.",
      },
      {
        title: "Clear resolved follow-ups",
        description: "When a payment is recorded, related overdue work can leave the active queue.",
      },
    ],
    problemTitle: "Fee reminders fail when the list is wrong or the message is careless",
    problemDescription:
      "A reminder is part of the student relationship. Sending the wrong amount, contacting someone who already paid or using an aggressive message creates unnecessary friction.",
    problems: [
      {
        title: "Staff build reminder lists by hand",
        description:
          "Manual copying introduces missed students, duplicate contacts and cases that were already resolved.",
      },
      {
        title: "The payment context is missing",
        description:
          "A name and amount alone do not show whether there is a waiver, recent payment or exception the owner should consider.",
      },
      {
        title: "Automated messages can become impersonal",
        description:
          "Sending without review may save a click but can damage trust with students and parents.",
      },
    ],
    featureTitle: "A controlled fee reminder workflow, not an automatic spam tool",
    featureDescription:
      "Lab Lords keeps the due record, draft and approval decision connected so the branch can follow up professionally.",
    features: [
      {
        title: "Overdue student queue",
        description: "Identify unpaid records that genuinely require attention based on the payment ledger.",
      },
      {
        title: "Context-aware drafts",
        description: "Prepare reminder wording using the student and payment context available to the branch.",
      },
      {
        title: "Owner approval",
        description: "Review and edit drafts before any team member uses them for outreach.",
      },
      {
        title: "Resolved-case cleanup",
        description: "Remove stale follow-up work after the related payment is marked as paid.",
      },
      {
        title: "Branch-scoped access",
        description: "Keep reminder work visible only to staff who are authorized for the relevant branch.",
      },
      {
        title: "Payment-first reporting",
        description: "Use the same due and overdue definitions across reminders, analytics and owner reports.",
      },
    ],
    useCaseTitle: "Professional follow-up for common fee situations",
    useCaseDescription:
      "The workflow supports routine reminders while leaving room for the owner to handle exceptions personally.",
    useCases: [
      {
        title: "Monthly due review",
        description:
          "Confirm the overdue list against recorded collections before preparing the next round of reminders.",
      },
      {
        title: "Owner-reviewed message drafting",
        description:
          "Prepare a clear message, adjust the tone or details and approve it for the appropriate communication channel.",
      },
      {
        title: "Payment received after follow-up",
        description:
          "Record the collection so the due status and active reminder queue reflect the resolved case.",
      },
    ],
    faqs: [
      {
        question: "Does Lab Lords automatically send fee reminders?",
        answer:
          "Lab Lords focuses on identifying overdue records and preparing reviewable message drafts. The owner or authorized team member remains responsible for approving and sending communication.",
      },
      {
        question: "Why is owner approval useful for student fee reminders?",
        answer:
          "Owners often know about personal commitments, partial arrangements or recent offline payments. Review helps prevent an inaccurate or unnecessarily harsh reminder.",
      },
      {
        question: "Can a paid student remain in the reminder queue?",
        answer:
          "The workflow is designed to clear related overdue drafts when the payment is recorded, reducing stale follow-up work.",
      },
      {
        question: "Is fee reminder software useful for a small tuition centre?",
        answer:
          "Yes. Even a small centre benefits from a verified due list and consistent reminder process, especially when the owner is also teaching and managing collections.",
      },
    ],
    relatedSlugs: ["student-fee-management", "tuition-management", "coaching-management"],
    ctaTitle: "Build a fee follow-up process your team can trust",
    ctaDescription:
      "Organise the payment ledger first, then review overdue cases and message drafts from one branch workflow.",
  },
  "coaching-management": {
    slug: "coaching-management",
    shortName: "Coaching management",
    metaTitle: "Coaching Management Software for Branches",
    metaDescription:
      "Manage coaching centre students, seats, time slots, fees, staff permissions, branches and analytics in one operating system.",
    keywords: ["coaching management software"],
    eyebrow: "Coaching management software",
    h1: "Operate coaching centre branches with clearer student and fee control",
    heroDescription:
      "Lab Lords brings the daily operating records of a coaching centre into one branch-aware system: students, physical seats, class or study shifts, fees, dues, staff permissions and management analytics.",
    audience: ["Coaching centre owners", "Branch managers", "Operations staff"],
    heroHighlights: [
      {
        title: "One branch operating view",
        description: "Connect students, capacity, collections and staff actions instead of managing separate files.",
      },
      {
        title: "Delegate safely",
        description: "Give managers and staff the permissions needed for daily work without owner-level access.",
      },
      {
        title: "Review before expanding",
        description: "Use structured branch data to understand capacity and payment health.",
      },
    ],
    problemTitle: "Coaching centres outgrow informal operations branch by branch",
    problemDescription:
      "The first centre can run on the owner’s memory. Additional staff, time slots and locations make that approach fragile.",
    problems: [
      {
        title: "Student information is duplicated",
        description:
          "Admission details, fee sheets and seat lists each contain a different version of the same student.",
      },
      {
        title: "Managers lack clear permission boundaries",
        description:
          "Owners either keep every task for themselves or share more finance and configuration access than intended.",
      },
      {
        title: "Branch comparisons arrive late",
        description:
          "Occupancy and collection reports are assembled after the period instead of being available from operating records.",
      },
    ],
    featureTitle: "Coaching operations organised around branches and responsibility",
    featureDescription:
      "Lab Lords gives each branch a structured workspace while preserving owner oversight across the organisation.",
    features: [
      {
        title: "Student lifecycle records",
        description: "Create, update, deactivate and reactivate student records with operational history.",
      },
      {
        title: "Seats and time slots",
        description: "Manage physical capacity where students use assigned desks or scheduled study access.",
      },
      {
        title: "Fee and due tracking",
        description: "Keep admission charges, recurring obligations, collections and overdue records connected.",
      },
      {
        title: "Manager and staff roles",
        description: "Control who can manage the branch, collect payments, view analytics or change settings.",
      },
      {
        title: "Multi-branch structure",
        description: "Separate branch records while allowing the organisation owner to review the whole network.",
      },
      {
        title: "Operational analytics",
        description: "Use payment and capacity data to identify branches that require attention.",
      },
    ],
    useCaseTitle: "For coaching businesses moving from owner-led to system-led operations",
    useCaseDescription:
      "The software supports common growth moments without forcing the centre into a generic enterprise process.",
    useCases: [
      {
        title: "Delegating a branch",
        description:
          "Add a manager, define effective permissions and let them operate the location within clear boundaries.",
      },
      {
        title: "Admitting students into a time slot",
        description:
          "Create the record, apply fee settings and allocate capacity where the centre uses physical seats.",
      },
      {
        title: "Reviewing branch performance",
        description:
          "Compare collection and capacity signals before deciding where the owner should intervene.",
      },
    ],
    faqs: [
      {
        question: "What does coaching management software handle?",
        answer:
          "Lab Lords handles operational records for students, branches, seats, shifts, payments, dues, staff permissions and analytics. It is focused on running the centre rather than delivering online classes.",
      },
      {
        question: "Can different coaching branches have different staff?",
        answer:
          "Yes. Staff membership and permissions are branch-aware, helping each location operate without exposing unrelated branch records.",
      },
      {
        question: "Does Lab Lords manage online courses or video lessons?",
        answer:
          "No. Lab Lords is an operations system for offline education businesses. It does not currently provide a learning management system for hosting lessons or course content.",
      },
      {
        question: "Can owners review all branches?",
        answer:
          "Yes. Organisation owners can access branch-level operations and wider analytics while branch staff remain scoped to their authorized work.",
      },
    ],
    relatedSlugs: ["tuition-management", "student-fee-management", "seat-management"],
    ctaTitle: "Give your coaching branches a shared operating standard",
    ctaDescription:
      "Start with the branch that creates the most follow-up work and bring its students, fees and staff into one system.",
  },
  "tuition-management": {
    slug: "tuition-management",
    shortName: "Tuition management",
    metaTitle: "Tuition Management Software for Daily Operations",
    metaDescription:
      "Organise tuition centre students, fees, dues, time slots, staff and branch records without relying on scattered spreadsheets.",
    keywords: ["tuition management software"],
    eyebrow: "Tuition management software",
    h1: "A practical operating system for growing tuition centres",
    heroDescription:
      "Lab Lords helps tuition centre owners move student records, fees, dues, scheduled shifts, staff access and branch reporting out of disconnected notebooks and spreadsheets. Start small, keep the workflow readable and add structure as the centre grows.",
    audience: ["Independent tuition owners", "Small education teams", "Growing tuition branches"],
    heroHighlights: [
      {
        title: "Simple student records",
        description: "Keep contact, status, fees and active operating details together.",
      },
      {
        title: "Less month-end chasing",
        description: "Use a shared payment ledger and verified due list for follow-up.",
      },
      {
        title: "Structure that can grow",
        description: "Add staff roles and branches without rebuilding the operating process.",
      },
    ],
    problemTitle: "A tuition centre can be small and still operationally complex",
    problemDescription:
      "Owners often teach, handle admissions, collect fees and answer parent questions themselves. Scattered records turn that workload into repeated checking.",
    problems: [
      {
        title: "The owner becomes the only source of truth",
        description:
          "Staff must ask the owner about student status, fees and exceptions because the information is not organised elsewhere.",
      },
      {
        title: "Fee follow-up interrupts teaching work",
        description:
          "Without a reliable due list, the owner spends evenings checking receipts and preparing messages.",
      },
      {
        title: "Growth creates inconsistent branches",
        description:
          "A second location often starts with new spreadsheets and different rules instead of a shared operating standard.",
      },
    ],
    featureTitle: "Tuition management software that stays understandable",
    featureDescription:
      "Use the modules that match your current operation and add deeper controls when the centre needs them.",
    features: [
      {
        title: "Student profiles",
        description: "Maintain searchable contact, status and fee information for active and past students.",
      },
      {
        title: "Fee records",
        description: "Track admission charges, recurring fees, paid records, dues and approved waivers.",
      },
      {
        title: "Time-slot structure",
        description: "Model scheduled shifts when the centre allocates rooms, desks or study access by time.",
      },
      {
        title: "Staff permissions",
        description: "Delegate admissions or collections while keeping sensitive settings owner-controlled.",
      },
      {
        title: "Branch setup",
        description: "Give every location its own records and settings within the same organisation.",
      },
      {
        title: "Readable analytics",
        description: "Review payment and operating trends without preparing another reporting spreadsheet.",
      },
    ],
    useCaseTitle: "Built for the administrative work around teaching",
    useCaseDescription:
      "Lab Lords does not replace teaching. It reduces the record-checking and follow-up work that competes with it.",
    useCases: [
      {
        title: "New student admission",
        description:
          "Create the student, set fee details and place them into the appropriate branch workflow.",
      },
      {
        title: "Monthly fee collection",
        description:
          "Review the due record, record the payment and keep the student history current for the next conversation.",
      },
      {
        title: "Adding an administrator",
        description:
          "Grant the work they need to perform without handing over every owner-level action.",
      },
    ],
    faqs: [
      {
        question: "Is tuition management software useful for a single centre?",
        answer:
          "Yes. A single centre can use it to keep student and payment records consistent, reduce owner dependency and create a foundation for future staff or branch growth.",
      },
      {
        question: "Does Lab Lords include online teaching tools?",
        answer:
          "No. Lab Lords focuses on offline education operations such as students, fees, seats, shifts, staff and branches. It does not host video classes or learning content.",
      },
      {
        question: "Can I start with only student and fee management?",
        answer:
          "Yes. You can begin with the records that solve the current problem and introduce seat, shift, staff or analytics workflows as the centre needs them.",
      },
      {
        question: "Can tuition staff see all owner settings?",
        answer:
          "Not by default. Staff access can be limited through roles and permission overrides so operational work remains separated from owner decisions.",
      },
    ],
    relatedSlugs: ["coaching-management", "student-fee-management", "fee-reminder"],
    ctaTitle: "Spend less time reconstructing tuition centre records",
    ctaDescription:
      "Set up the students and fee workflow you need now, with room for staff and branches later.",
  },
};

export function getSoftwarePage(slug: string) {
  return softwarePages[slug as SoftwarePageSlug];
}

export function getSoftwarePagePath(slug: SoftwarePageSlug) {
  return `/software/${slug}`;
}
