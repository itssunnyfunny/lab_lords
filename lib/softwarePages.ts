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

// Keep old URLs reachable, while advertising only the current library focus.
export const legacySoftwarePageSlugs: readonly SoftwarePageSlug[] = ["coaching-management", "tuition-management"];
export const activeSoftwarePageSlugs = softwarePageSlugs.filter(slug => !legacySoftwarePageSlugs.includes(slug));

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
  example: string;
  featureHref: string;
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
    example: "A student wants to move from the morning shift to the afternoon. Check the afternoon availability and dates, then update the assignment using the library's actual schedule. The student's fee record remains available for the next collection review.",
    featureHref: "/features#seats-shifts",
    shortName: "Study hall management",
    metaTitle: "Study Hall Software for Seats, Shifts and Fees",
    metaDescription:
      "Manage study hall seats, shifts, students, fee dues and staff across one or more branches with Lab Lords.",
    keywords: ["study hall software", "study hall management software"],
    eyebrow: "Study hall software",
    h1: "Manage your study hall in one place",
    heroDescription:
      "Students, seats, shifts and fees — all in one place. Keep your study hall organised with an easy-to-use dashboard.",
    audience: ["Study hall owners", "Reading room operators", "Multi-branch managers"],
    heroHighlights: [
      {
        "title": "Seat availability",
        "description": "See which seats are free for each shift."
      },
      {
        "title": "Student records",
        "description": "Keep student details, seat assignments and fee records together."
      },
      {
        "title": "Pending fees",
        "description": "Check what is paid and what still needs a follow-up."
      }
    ],
    problemTitle: "Less paperwork. More clarity.",
    problemDescription:
      "Keep the daily details together, so you can find what you need without checking different notebooks.",
    problems: [
      {
        "title": "Seat availability",
        "description": "See which seats are free for each shift."
      },
      {
        "title": "Student records",
        "description": "Keep student details, seat assignments and fee records together."
      },
      {
        "title": "Pending fees",
        "description": "Check what is paid and what still needs a follow-up."
      }
    ],
    featureTitle: "Tools for everyday study hall work.",
    featureDescription:
      "Simple tools to organise your records, manage your seats and stay on top of fees.",
    features: [
      {
        "title": "Seats by shift",
        "description": "See available and occupied seats for your selected shift."
      },
      {
        "title": "Seat assignments",
        "description": "Assign a seat with checks for overlapping student and seat bookings."
      },
      {
        "title": "Student details",
        "description": "Find contact information, status and fee records in one place."
      },
      {
        "title": "Fees & dues",
        "description": "Record collections and check paid, pending and waived amounts."
      },
      {
        "title": "Staff access",
        "description": "Add your team and choose what each person can view or change. Staff access is included in Standard."
      },
      {
        "title": "Reports",
        "description": "Review seat usage and collection trends with Standard."
      }
    ],
    useCaseTitle: "From a new shift to monthly fees",
    useCaseDescription:
      "Use Lab Lords for the tasks your study hall handles each day.",
    useCases: [
      {
        "title": "Set up a shift",
        "description": "Choose its timing and fee, then check available seats before assigning students."
      },
      {
        "title": "Change a seat",
        "description": "Check availability, end the previous assignment and assign the new seat."
      },
      {
        "title": "Review pending fees",
        "description": "Open the dues list and check recorded payments before following up."
      }
    ],
    faqs: [
      {
        "question": "What is study hall management software?",
        "answer": "It keeps student details, seats, shifts and fee records together so your team can manage daily work."
      },
      {
        "question": "Can the same seat be used in different shifts?",
        "answer": "Yes. A seat can be assigned in compatible time slots, with checks for overlapping bookings."
      },
      {
        "question": "Can I manage more than one study hall?",
        "answer": "Yes. Both plans support multiple branches, with each billable branch charged separately."
      },
      {
        "question": "Can I give staff limited access?",
        "answer": "Yes. Standard lets you invite staff and choose the work they can view or change."
      }
    ],
    relatedSlugs: ["seat-management", "student-fee-management", "fee-reminder"],
    ctaTitle: "Give your study hall a simpler way to work.",
    ctaDescription:
      "Bring students, seats, shifts and fees together. Start with your first branch.",
  },
  "library-management": {
    slug: "library-management",
    example: "At the reading-room desk, a student asks about their seat and an unpaid fee. Find the student record, check the assigned shift and review the recorded fee details before making a change. This is study-space administration, not book circulation.",
    featureHref: "/features#students",
    shortName: "Library management",
    metaTitle: "Library Management Software for Reading Rooms",
    metaDescription:
      "Manage students, seats, shifts and fees for your study library or reading room. Keep records together across one or more branches.",
    keywords: [
      "library management software",
      "digital library management",
      "offline library management software",
    ],
    eyebrow: "Library management software",
    h1: "Manage your library's students, seats and fees",
    heroDescription:
      "Students, seats, shifts and fees — all in one place. Keep your library organised with an easy-to-use dashboard.",
    audience: ["Reading-room libraries", "Membership libraries", "Study libraries"],
    heroHighlights: [
      {
        "title": "Student details",
        "description": "Find a student and check their details, seat assignment and fee records."
      },
      {
        "title": "Seats & shifts",
        "description": "See available seats and assign them to students for the right shift."
      },
      {
        "title": "Fee records",
        "description": "Record payments and check how much each student has left to pay."
      }
    ],
    problemTitle: "Less paperwork. More clarity.",
    problemDescription:
      "You already have enough to manage. Lab Lords keeps the daily details together, so you can find what you need without checking different notebooks.",
    problems: [
      {
        "title": "Student details",
        "description": "Find a student and check their details, seat assignment and fee records."
      },
      {
        "title": "Seats & shifts",
        "description": "See available seats and assign them to students for the right shift."
      },
      {
        "title": "Fee records",
        "description": "Record payments and check how much each student has left to pay."
      }
    ],
    featureTitle: "Everything you need for everyday library work.",
    featureDescription:
      "Simple tools to organise your records, manage your seats and stay on top of fees.",
    features: [
      {
        "title": "Student management",
        "description": "Add contact information and keep active and inactive student history."
      },
      {
        "title": "Student imports",
        "description": "Bring in your existing student list and review the details before adding it."
      },
      {
        "title": "Seats & shifts",
        "description": "Set up physical seats, shift timings and fees."
      },
      {
        "title": "Seat availability",
        "description": "Check assignments for the selected shift before adding a booking."
      },
      {
        "title": "Fees & dues",
        "description": "Record received fees and review pending, paid or waived amounts."
      },
      {
        "title": "Multiple branches",
        "description": "Manage separate library locations from your account; each billable branch is charged separately."
      }
    ],
    useCaseTitle: "Useful throughout your library day",
    useCaseDescription:
      "Keep the information you need for admissions, seat changes and fee checks close at hand.",
    useCases: [
      {
        "title": "Add a student",
        "description": "Enter their contact information, set their fee and check a suitable seat."
      },
      {
        "title": "Check a seat",
        "description": "Choose the shift to see available and occupied seats."
      },
      {
        "title": "Check a payment",
        "description": "Open the student fee record and review recorded collections and dues."
      }
    ],
    faqs: [
      {
        "question": "What kind of library is Lab Lords for?",
        "answer": "Lab Lords supports study libraries and reading rooms that manage student memberships, seats, shifts and fees."
      },
      {
        "question": "Does it manage book lending?",
        "answer": "No. Lab Lords manages students, seats, shifts and fees for study libraries. It does not manage book catalogues or lending."
      },
      {
        "question": "Can I use my existing student list?",
        "answer": "Yes. You can enter students individually or use spreadsheet import. Review your information and resolve any flagged issues before confirming an import."
      },
      {
        "question": "Can I manage several library branches?",
        "answer": "Yes. Both plans support multiple branches, and each billable branch is charged separately."
      }
    ],
    relatedSlugs: ["study-hall-management", "seat-management", "student-fee-management"],
    ctaTitle: "Give your library a simpler way to work.",
    ctaDescription:
      "Bring students, seats, shifts and fees together. Start with your first branch and see how it feels.",
  },
  "seat-management": {
    slug: "seat-management",
    example: "Seat 12 is occupied in the morning. Before offering it in the evening, check the evening shift and intended dates. Availability belongs to a time slot and period; a single occupied label cannot describe every use of that seat.",
    featureHref: "/features#seats-shifts",
    shortName: "Seat management",
    metaTitle: "Seat Management Software for Study Libraries",
    metaDescription:
      "Manage physical seats and time-based allocations for study halls, reading rooms and study rooms without overlap conflicts.",
    keywords: ["seat management software", "seat booking software for library"],
    eyebrow: "Seat management software",
    h1: "Manage seats across your shifts",
    heroDescription:
      "Set up your library seats, choose your shift timings and check availability before assigning a student.",
    audience: ["Library owners", "Front desk staff", "Branch managers"],
    heroHighlights: [
      {
        "title": "Physical seats",
        "description": "Keep one record for each seat in your library."
      },
      {
        "title": "Shift availability",
        "description": "Check seats for the timing a student needs."
      },
      {
        "title": "Assignment checks",
        "description": "Catch overlapping bookings before they are saved."
      }
    ],
    problemTitle: "Check seats before you assign them.",
    problemDescription:
      "Choose a shift to see which seats are free and which are occupied.",
    problems: [
      {
        "title": "Physical seats",
        "description": "Keep one record for each seat in your library."
      },
      {
        "title": "Shift availability",
        "description": "Check seats for the timing a student needs."
      },
      {
        "title": "Assignment checks",
        "description": "Catch overlapping bookings before they are saved."
      }
    ],
    featureTitle: "Seats & shifts",
    featureDescription:
      "Use your own seat names, shift timings and fees.",
    features: [
      {
        "title": "Seat setup",
        "description": "Add the physical seats available in each branch."
      },
      {
        "title": "Custom shifts",
        "description": "Set the start time, end time and fee for each shift."
      },
      {
        "title": "Availability by shift",
        "description": "Review available and occupied seats for the selected timing."
      },
      {
        "title": "Overlap checks",
        "description": "Prevent conflicting seat and student assignments."
      },
      {
        "title": "Combined shifts",
        "description": "Use supported shift combinations and their configured fees."
      },
      {
        "title": "Assignment history",
        "description": "Review student seat assignments and ended bookings."
      }
    ],
    useCaseTitle: "Manage each seat assignment",
    useCaseDescription:
      "Check the timing and student record before assigning or changing a seat.",
    useCases: [
      {
        "title": "Choose a shift",
        "description": "Select the hours the student needs and check seat availability."
      },
      {
        "title": "Assign a seat",
        "description": "Select the student and seat, then save the assignment after the overlap checks."
      },
      {
        "title": "Change an assignment",
        "description": "End the previous assignment and choose a compatible seat and shift."
      }
    ],
    faqs: [
      {
        "question": "Can one seat be used by different students?",
        "answer": "Yes, in compatible shifts. Overlap checks prevent conflicting bookings for the same seat."
      },
      {
        "question": "Can I set my own shift timings?",
        "answer": "Yes. Configure timings and fees to match your library, including supported combined shifts."
      },
      {
        "question": "Can students book seats themselves?",
        "answer": "Lab Lords provides seat assignment tools for the owner and authorized staff. It does not offer public student self-booking."
      },
      {
        "question": "Is seat management available in Basic?",
        "answer": "Yes. Seats, shifts and allocations are included in both Basic and Standard."
      }
    ],
    relatedSlugs: ["study-hall-management", "library-management", "student-fee-management"],
    ctaTitle: "Set up your library seats",
    ctaDescription:
      "Add your seats and shift timings, then check availability before assigning students.",
  },
  "student-fee-management": {
    slug: "student-fee-management",
    example: "A student asks what they still owe. Review the relevant fee period and payment history, verify money received through your library's usual payment method, and record it against the correct student. This does not process an online charge.",
    featureHref: "/features#fees",
    shortName: "Student fee management",
    metaTitle: "Student Fee Management and Payment Tracking",
    metaDescription:
      "Track student payments, monthly dues, waived fees and collection history across study halls, libraries and reading rooms.",
    keywords: ["student fee management", "student payment tracking"],
    eyebrow: "Student fee management",
    h1: "Track student fees and payments",
    heroDescription:
      "Record payments and check how much each student has left to pay. Keep fee details and payment history together.",
    audience: ["Education business owners", "Fee desk staff", "Branch managers"],
    heroHighlights: [
      {
        "title": "Student fees",
        "description": "Set the recurring amount or use a linked shift fee."
      },
      {
        "title": "Recorded collections",
        "description": "Enter received payments against the correct student."
      },
      {
        "title": "Pending amounts",
        "description": "See dues that still need payment or follow-up."
      }
    ],
    problemTitle: "A clear fee record.",
    problemDescription:
      "Keep student details, payment records and fee history together.",
    problems: [
      {
        "title": "Student fees",
        "description": "Set the recurring amount or use a linked shift fee."
      },
      {
        "title": "Recorded collections",
        "description": "Enter received payments against the correct student."
      },
      {
        "title": "Pending amounts",
        "description": "See dues that still need payment or follow-up."
      }
    ],
    featureTitle: "Fees & dues",
    featureDescription:
      "Check what each student owes, what they have paid and any changes to their fee record.",
    features: [
      {
        "title": "Recurring fees",
        "description": "Set a manual fee or use the price of a linked shift or combined shift."
      },
      {
        "title": "Admission fees",
        "description": "Record an admission charge when adding a student."
      },
      {
        "title": "Payment records",
        "description": "Record full or partial payments and their payment details."
      },
      {
        "title": "Pending fees",
        "description": "Review unpaid amounts in the branch dues list."
      },
      {
        "title": "Payment history",
        "description": "Check prior records and changes when reviewing a collection. Find its receipt again to download or print."
      },
      {
        "title": "Approved waivers",
        "description": "Waive a fee when your branch permissions allow it."
      }
    ],
    useCaseTitle: "From admission to monthly collection",
    useCaseDescription:
      "Set student fees, record payments and check pending amounts for each branch.",
    useCases: [
      {
        "title": "Set the student fee",
        "description": "Choose the recurring fee or linked shift when setting up the student."
      },
      {
        "title": "Record a collection",
        "description": "Open the due record, enter the amount received and check the resulting status."
      },
      {
        "title": "Review the history",
        "description": "Check past payment records before discussing a pending amount."
      }
    ],
    faqs: [
      {
        "question": "Does Lab Lords automatically charge students?",
        "answer": "No. These tools record and track student fees and received payments. Your Lab Lords subscription is billed separately."
      },
      {
        "question": "Can I use different fees for different students?",
        "answer": "Yes. Set a manual recurring fee or use a linked shift or combined-shift price."
      },
      {
        "question": "Can I review unpaid and waived fees?",
        "answer": "Yes. Payment records distinguish pending, paid and waived amounts."
      },
      {
        "question": "Is fee management available in Basic?",
        "answer": "Yes. Payments, dues and audit history are included in Basic and Standard."
      }
    ],
    relatedSlugs: ["fee-reminder", "library-management", "study-hall-management"],
    ctaTitle: "Keep your student fees easy to check",
    ctaDescription:
      "Start a trial and explore student fee records and payment history.",
  },
  "fee-reminder": {
    slug: "fee-reminder",
    example: "Before contacting a student about dues, check whether a recent payment has already been recorded. If you use Standard to prepare an AI draft, verify the amount and wording before using it. A draft does not confirm delivery or payment.",
    featureHref: "/features#ai-assistance",
    shortName: "Fee reminder",
    metaTitle: "Fee Reminder Software for Study Libraries",
    metaDescription:
      "Identify overdue student fees and prepare owner-reviewed reminder messages for study halls, libraries, reading rooms and study rooms.",
    keywords: ["fee reminder software", "student fee reminder"],
    eyebrow: "Fee reminder software",
    h1: "Keep track of fee follow-ups",
    heroDescription:
      "See pending student fees, check payment history and prepare a clearer conversation about what is due.",
    audience: ["Owners handling dues", "Fee collection teams", "Branch managers"],
    heroHighlights: [
      {
        "title": "Pending fees",
        "description": "Find the students whose records show an unpaid amount."
      },
      {
        "title": "Check before contacting",
        "description": "Review the current fee status before asking about an outstanding amount."
      },
      {
        "title": "Payment history",
        "description": "Check recorded collections before contacting a student."
      }
    ],
    problemTitle: "Keep your fee follow-ups together.",
    problemDescription:
      "Check pending fees and payment history before contacting a student.",
    problems: [
      {
        "title": "Pending fees",
        "description": "Find the students whose records show an unpaid amount."
      },
      {
        "title": "Check before contacting",
        "description": "Review the current fee status before asking about an outstanding amount."
      },
      {
        "title": "Payment history",
        "description": "Check recorded collections before contacting a student."
      }
    ],
    featureTitle: "Organise your fee follow-ups",
    featureDescription:
      "Start with the pending-fee list and use the recorded history to check the amount before you follow up. Save a note, contact outcome and the next date to follow up.",
    features: [
      {
        "title": "Pending-fee list",
        "description": "Review unpaid fees for the selected branch. Check upcoming fee dates separately from recorded dues."
      },
      {
        "title": "Student details",
        "description": "Find the student and check their details and pending fees."
      },
      {
        "title": "Recorded fee status",
        "description": "Check which fees are recorded as paid and which remain due."
      },
      {
        "title": "Branch context",
        "description": "Open the correct branch before reviewing a student fee."
      },
      {
        "title": "Payment history",
        "description": "Review previous collections and changes before a conversation."
      },
      {
        "title": "Message drafting",
        "description": "Standard includes AI assistance for drafts you review before deciding what to send."
      }
    ],
    useCaseTitle: "A clear follow-up routine",
    useCaseDescription:
      "Check the fee record, prepare your conversation and update the record when money is received.",
    useCases: [
      {
        "title": "Review dues",
        "description": "Open the pending-fee list and check the latest payment information."
      },
      {
        "title": "Prepare the conversation",
        "description": "Confirm the fee period and amount before contacting the student."
      },
      {
        "title": "Update a received payment",
        "description": "Record the collection so the next review uses the current fee status."
      }
    ],
    faqs: [
      {
        "question": "What does fee reminder software help with?",
        "answer": "It helps you find pending fees and check student payment history before preparing a reminder."
      },
      {
        "question": "Does an AI draft send a message automatically?",
        "answer": "No. AI assistance prepares message drafts for you to review. Creating a draft does not send it."
      },
      {
        "question": "Does a reminder mean the student has paid?",
        "answer": "No. Check money actually received and the payment record. Preparing or using a reminder does not confirm collection."
      },
      {
        "question": "Which plan includes AI assistance?",
        "answer": "Standard includes AI reports and message drafting. Both plans include payments, dues and audit history."
      }
    ],
    relatedSlugs: ["student-fee-management", "library-management", "study-hall-management"],
    ctaTitle: "Make fee follow-ups easier to track",
    ctaDescription:
      "Start a trial and review your pending fees and payment history in one place.",
  },
  "coaching-management": {
    slug: "coaching-management",
    example: "Two coaching locations share an owner but keep their student and fee records separately. Open the right branch before reviewing dues. With Standard, invite staff for the work they handle and compare the recorded branch figures.",
    featureHref: "/features#branches",
    shortName: "Coaching management",
    metaTitle: "Coaching Management Software for Branches",
    metaDescription:
      "Manage coaching centre students, seats, shifts and fees. Keep branch records together, with staff access and reports on Standard.",
    keywords: ["coaching management software"],
    eyebrow: "Coaching management software",
    h1: "Student and fee records for your coaching centre",
    heroDescription:
      "Keep student details, fees and branch records together. Add staff access with Standard when your team needs to share the daily work.",
    audience: ["Coaching centre owners", "Branch managers", "Centre staff"],
    heroHighlights: [
      {
        "title": "Student records",
        "description": "Find contact information, status and fee details."
      },
      {
        "title": "Fee tracking",
        "description": "Record received fees and check pending amounts."
      },
      {
        "title": "Branch records",
        "description": "Manage your branches from one account, with separate records for each."
      }
    ],
    problemTitle: "Your records, in one place.",
    problemDescription:
      "Find student details and fee records without checking different notebooks.",
    problems: [
      {
        "title": "Student records",
        "description": "Find contact information, status and fee details."
      },
      {
        "title": "Fee tracking",
        "description": "Record received fees and check pending amounts."
      },
      {
        "title": "Branch records",
        "description": "Manage your branches from one account, with separate records for each."
      }
    ],
    featureTitle: "Tools for everyday coaching centre work.",
    featureDescription:
      "Keep student details, fee records and branch information together.",
    features: [
      {
        "title": "Student management",
        "description": "Add and find student details, status and fee information."
      },
      {
        "title": "Student imports",
        "description": "Bring in your existing student list and review the details before adding it."
      },
      {
        "title": "Fee records",
        "description": "Track admission fees, recurring dues and recorded payments."
      },
      {
        "title": "Seats & shifts",
        "description": "Manage physical study seats and timings when your centre uses them."
      },
      {
        "title": "Staff access",
        "description": "Add your team and choose what each person can view or change. Staff access is included in Standard."
      },
      {
        "title": "Branch reports",
        "description": "Review branch and cross-branch figures with Standard."
      }
    ],
    useCaseTitle: "Keep daily administration together",
    useCaseDescription:
      "Use the same student and fee records for admissions, collections and branch reviews.",
    useCases: [
      {
        "title": "Add an admission",
        "description": "Create the student record and set the relevant fees."
      },
      {
        "title": "Check a collection",
        "description": "Review the due record and enter the received payment."
      },
      {
        "title": "Work across branches",
        "description": "Open the location you need and check its own students and fee records."
      }
    ],
    faqs: [
      {
        "question": "What does Lab Lords manage for coaching centres?",
        "answer": "It manages student details, fees, seats, shifts, staff access and branch records."
      },
      {
        "question": "Does it include exams or course delivery?",
        "answer": "No. Lab Lords manages student records, fees, seats and shifts. It does not provide exams, courses or online teaching."
      },
      {
        "question": "Can my staff record fees?",
        "answer": "Authorized staff can record fees according to their branch permissions. Staff access is included in Standard."
      },
      {
        "question": "Can I use it for one coaching centre?",
        "answer": "Yes. Start with one branch and add more when needed. Each billable branch is charged separately."
      }
    ],
    relatedSlugs: ["tuition-management", "student-fee-management", "seat-management"],
    ctaTitle: "Bring your coaching centre records together.",
    ctaDescription:
      "Start with your first branch and add the students and fees you manage today.",
  },
  "tuition-management": {
    slug: "tuition-management",
    example: "At the end of a fee period, open the tuition branch's student records and check outstanding amounts before contacting families. Record received fees against the right student. The workspace helps with administration; it does not deliver lessons or manage exams.",
    featureHref: "/features#fees",
    shortName: "Tuition management",
    metaTitle: "Tuition Management Software for Daily Operations",
    metaDescription:
      "Organise tuition centre students, fees, dues, time slots, staff and branch records without relying on scattered spreadsheets.",
    keywords: ["tuition management software"],
    eyebrow: "Tuition management software",
    h1: "Manage your tuition centre's student records and fees",
    heroDescription:
      "Keep student details and fee records in one place. Find a student, record a collection and see pending fees for your tuition centre.",
    audience: ["Independent tuition owners", "Small education teams", "Growing tuition branches"],
    heroHighlights: [
      {
        "title": "Student information",
        "description": "Keep contacts, status and fee details together."
      },
      {
        "title": "Fee records",
        "description": "Check paid and pending amounts for each student."
      },
      {
        "title": "Staff access",
        "description": "Let your team help with daily records on Standard."
      }
    ],
    problemTitle: "Less paperwork for your tuition centre.",
    problemDescription:
      "Keep student details and fee records together, so you can find what you need.",
    problems: [
      {
        "title": "Student information",
        "description": "Keep contacts, status and fee details together."
      },
      {
        "title": "Fee records",
        "description": "Check paid and pending amounts for each student."
      },
      {
        "title": "Staff access",
        "description": "Let your team help with daily records on Standard."
      }
    ],
    featureTitle: "Tools for everyday tuition centre work.",
    featureDescription:
      "Add your student records, record payments and check pending fees.",
    features: [
      {
        "title": "Student details",
        "description": "Add contacts and find active or inactive student records."
      },
      {
        "title": "Recurring fees",
        "description": "Set a student fee and review the monthly due records."
      },
      {
        "title": "Payment history",
        "description": "Check collections, dues and approved waivers."
      },
      {
        "title": "Student imports",
        "description": "Bring in your existing student list and review the details before adding it."
      },
      {
        "title": "Multiple branches",
        "description": "Keep each location separate; each billable branch is charged separately."
      },
      {
        "title": "Staff access",
        "description": "Add your team and choose what each person can view or change. Staff access is included in Standard."
      }
    ],
    useCaseTitle: "Keep up with everyday tuition records",
    useCaseDescription:
      "Find the information you need when a student joins or a fee is received.",
    useCases: [
      {
        "title": "Add a student",
        "description": "Create the student record, add contact details and set the fee."
      },
      {
        "title": "Record a payment",
        "description": "Open the student fee record and enter the amount received."
      },
      {
        "title": "Review pending fees",
        "description": "Check unpaid amounts before following up with students."
      }
    ],
    faqs: [
      {
        "question": "Is Lab Lords useful for a single tuition centre?",
        "answer": "Yes. You can use one branch to manage student details, fee records and pending payments."
      },
      {
        "question": "Does it provide online teaching tools?",
        "answer": "No. Lab Lords manages student records, fees and related daily administration. It does not host video classes or learning content."
      },
      {
        "question": "Can I begin with students and fees?",
        "answer": "Yes. Start with those records and use seat or shift tools if your centre needs them."
      },
      {
        "question": "Can tuition staff access owner settings?",
        "answer": "Staff access is controlled by branch roles and permissions. Owner-only settings remain with the owner. Staff access is included in Standard."
      }
    ],
    relatedSlugs: ["coaching-management", "student-fee-management", "fee-reminder"],
    ctaTitle: "Start with your tuition centre records",
    ctaDescription:
      "Start with your first branch and add your students and fee records.",
  },
};

export function getSoftwarePage(slug: string) {
  return softwarePages[slug as SoftwarePageSlug];
}

export function getSoftwarePagePath(slug: SoftwarePageSlug) {
  return `/software/${slug}`;
}
