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
    h1: "Manage your study hall in one place",
    heroDescription:
      "Keep students, seats, shifts and fees together. Check available seats, add students and see pending fees across your study hall.",
    audience: ["Study hall owners", "Reading room operators", "Multi-branch managers"],
    heroHighlights: [
      {
        "title": "Seat availability",
        "description": "See which seats are free for each shift."
      },
      {
        "title": "Student records",
        "description": "Keep contact details, seats and fee information together."
      },
      {
        "title": "Pending fees",
        "description": "Check what is paid and what still needs a follow-up."
      }
    ],
    problemTitle: "Keep daily records together",
    problemDescription:
      "Check the details you need for students, seats and fees.",
    problems: [
      {
        "title": "Seat availability",
        "description": "See which seats are free for each shift."
      },
      {
        "title": "Student records",
        "description": "Keep contact details, seats and fee information together."
      },
      {
        "title": "Pending fees",
        "description": "Check what is paid and what still needs a follow-up."
      }
    ],
    featureTitle: "Tools for your study hall",
    featureDescription:
      "Set up your seats and timings, then use the same records for admissions and fee collection.",
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
        "title": "Fees and payments",
        "description": "Record collections and check paid, pending and waived amounts."
      },
      {
        "title": "Staff access",
        "description": "Choose what your branch staff can view or change with Standard."
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
        "description": "Open the dues list and record notes from your follow-ups."
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
    ctaTitle: "Get your study hall started",
    ctaDescription:
      "Start a trial and add the seats, shifts and students you manage today.",
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
    h1: "Manage your library's students, seats and fees",
    heroDescription:
      "Manage your study library or reading room with student records, seat assignments, shift timings and fee tracking in one place.",
    audience: ["Reading-room libraries", "Membership libraries", "Study libraries"],
    heroHighlights: [
      {
        "title": "Student details",
        "description": "Find a student and check their current records."
      },
      {
        "title": "Seats and shifts",
        "description": "See availability for the timings your library uses."
      },
      {
        "title": "Fee records",
        "description": "Check collections and pending fees without changing screens."
      }
    ],
    problemTitle: "Keep daily records together",
    problemDescription:
      "Check the details you need for students, seats and fees.",
    problems: [
      {
        "title": "Student details",
        "description": "Find a student and check their current records."
      },
      {
        "title": "Seats and shifts",
        "description": "See availability for the timings your library uses."
      },
      {
        "title": "Fee records",
        "description": "Check collections and pending fees without changing screens."
      }
    ],
    featureTitle: "Daily tools for study libraries",
    featureDescription:
      "Keep student and fee information alongside the seats and shifts your library offers.",
    features: [
      {
        "title": "Student management",
        "description": "Add contact information and keep active and inactive student history."
      },
      {
        "title": "Student imports",
        "description": "Bring in a supported file and review the rows before confirming."
      },
      {
        "title": "Seats and shifts",
        "description": "Set up physical seats, shift timings and fees."
      },
      {
        "title": "Seat availability",
        "description": "Check assignments for the selected shift before adding a booking."
      },
      {
        "title": "Fees and payment history",
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
        "answer": "No. The current product focuses on study-library students, seats, shifts and fees, rather than book catalogues or lending."
      },
      {
        "question": "Can I use my existing student list?",
        "answer": "Yes. Upload a supported student file, review the mapped fields and rows, then confirm the import."
      },
      {
        "question": "Can I manage several library branches?",
        "answer": "Yes. Both plans support multiple branches, and each billable branch is charged separately."
      }
    ],
    relatedSlugs: ["study-hall-management", "seat-management", "student-fee-management"],
    ctaTitle: "Start using Lab Lords in your library",
    ctaDescription:
      "Try the tools with your own student, seat and fee records.",
  },
  "seat-management": {
    slug: "seat-management",
    shortName: "Seat management",
    metaTitle: "Seat Management Software for Study Libraries",
    metaDescription:
      "Manage physical seats and time-based allocations for study halls, reading rooms and coaching centres without overlap conflicts.",
    keywords: ["seat management software", "seat booking software for library"],
    eyebrow: "Seat management software",
    h1: "Manage seats across your shifts",
    heroDescription:
      "Set up your library seats, choose your shift timings and check availability before assigning a student.",
    audience: ["Seat-based study centres", "Library front desks", "Branch operations teams"],
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
    problemTitle: "Keep daily records together",
    problemDescription:
      "Check the details you need for students, seats and fees.",
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
    featureTitle: "Seat and shift management",
    featureDescription:
      "Use the seat layout and timings that fit your study library or study hall.",
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
    relatedSlugs: ["study-hall-management", "library-management", "coaching-management"],
    ctaTitle: "Set up your library seats",
    ctaDescription:
      "Start a trial and explore seat assignments with your own shifts.",
  },
  "student-fee-management": {
    slug: "student-fee-management",
    shortName: "Student fee management",
    metaTitle: "Student Fee Management and Payment Tracking",
    metaDescription:
      "Track student payments, monthly dues, waived fees and collection history across study halls, libraries and coaching branches.",
    keywords: ["student fee management", "student payment tracking"],
    eyebrow: "Student fee management",
    h1: "Track student fees and payments",
    heroDescription:
      "Keep recurring fees, recorded collections and pending amounts with each student. Review the payment history when you need to check a fee.",
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
    problemTitle: "Keep daily records together",
    problemDescription:
      "Check the details you need for students, seats and fees.",
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
    featureTitle: "Student fee records in one place",
    featureDescription:
      "Keep a clear record of what is due, what was collected and what changed.",
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
        "description": "Record received payments and their payment details."
      },
      {
        "title": "Pending fees",
        "description": "Review unpaid amounts in the branch dues list."
      },
      {
        "title": "Payment history",
        "description": "Check prior records and changes when reviewing a collection."
      },
      {
        "title": "Approved waivers",
        "description": "Record a waiver through the authorized payment workflow."
      }
    ],
    useCaseTitle: "From admission to monthly collection",
    useCaseDescription:
      "Keep each fee action connected to the student and branch it belongs to.",
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
        "description": "Check past payments and notes before discussing a pending amount."
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
    relatedSlugs: ["fee-reminder", "coaching-management", "tuition-management"],
    ctaTitle: "Keep your student fees easy to check",
    ctaDescription:
      "Start a trial and explore student fee records and payment history.",
  },
  "fee-reminder": {
    slug: "fee-reminder",
    shortName: "Fee reminder",
    metaTitle: "Fee Reminder Software for Education Centres",
    metaDescription:
      "Identify overdue student fees and prepare owner-reviewed reminder messages for study halls, libraries, coaching and tuition centres.",
    keywords: ["fee reminder software", "student fee reminder"],
    eyebrow: "Fee reminder software",
    h1: "Keep track of fee follow-ups",
    heroDescription:
      "See pending student fees, review collection notes and record what was discussed before the next follow-up.",
    audience: ["Owners handling dues", "Fee collection teams", "Branch managers"],
    heroHighlights: [
      {
        "title": "Pending fees",
        "description": "Find the students whose records show an unpaid amount."
      },
      {
        "title": "Follow-up notes",
        "description": "Keep a note of the conversation and next follow-up."
      },
      {
        "title": "Payment history",
        "description": "Check recorded collections before contacting a student."
      }
    ],
    problemTitle: "Keep daily records together",
    problemDescription:
      "Check the details you need for students, seats and fees.",
    problems: [
      {
        "title": "Pending fees",
        "description": "Find the students whose records show an unpaid amount."
      },
      {
        "title": "Follow-up notes",
        "description": "Keep a note of the conversation and next follow-up."
      },
      {
        "title": "Payment history",
        "description": "Check recorded collections before contacting a student."
      }
    ],
    featureTitle: "Organize your fee follow-ups",
    featureDescription:
      "Start with the current dues list and keep your notes beside the payment record.",
    features: [
      {
        "title": "Pending-fee list",
        "description": "Review unpaid fees for the selected branch."
      },
      {
        "title": "Student context",
        "description": "Check the student details associated with a pending fee."
      },
      {
        "title": "Collection notes",
        "description": "Save what was discussed during a fee follow-up."
      },
      {
        "title": "Next follow-up",
        "description": "Record when the payment should be checked again."
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
      "Check the record, have the conversation and keep the next step visible.",
    useCases: [
      {
        "title": "Review dues",
        "description": "Open the pending-fee list and check the latest payment information."
      },
      {
        "title": "Add a note",
        "description": "Record what was discussed and when to follow up again."
      },
      {
        "title": "Update a received payment",
        "description": "Record the collection so the next review uses the current fee status."
      }
    ],
    faqs: [
      {
        "question": "What does fee reminder software help with?",
        "answer": "It helps you find pending fees, check student payment history and keep track of follow-up notes."
      },
      {
        "question": "Does an AI draft send a message automatically?",
        "answer": "No. AI assistance prepares advisory drafts for review. Creating a draft does not send it."
      },
      {
        "question": "Can I record a promised payment date?",
        "answer": "You can record follow-up notes and the next follow-up date alongside the payment record."
      },
      {
        "question": "Which plan includes AI assistance?",
        "answer": "Standard includes AI reports and message drafting. Both plans include payments, dues and audit history."
      }
    ],
    relatedSlugs: ["student-fee-management", "tuition-management", "coaching-management"],
    ctaTitle: "Make fee follow-ups easier to track",
    ctaDescription:
      "Start a trial and review your pending fees and collection notes in one place.",
  },
  "coaching-management": {
    slug: "coaching-management",
    shortName: "Coaching management",
    metaTitle: "Coaching Management Software for Branches",
    metaDescription:
      "Manage coaching centre students, seats, time slots, fees, staff permissions, branches and analytics in one operating system.",
    keywords: ["coaching management software"],
    eyebrow: "Coaching management software",
    h1: "Student and fee records for your coaching centre",
    heroDescription:
      "Keep student details, fees and branch records together. Add staff access with Standard when your team needs to share the daily work.",
    audience: ["Coaching centre owners", "Branch managers", "Operations staff"],
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
        "description": "Keep each location organized in your account."
      }
    ],
    problemTitle: "Keep daily records together",
    problemDescription:
      "Check the details you need for students, seats and fees.",
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
        "description": "Keep each location organized in your account."
      }
    ],
    featureTitle: "Tools for coaching centre administration",
    featureDescription:
      "Manage the student records, fees and physical study spaces around your teaching.",
    features: [
      {
        "title": "Student management",
        "description": "Add and find student details, status and fee information."
      },
      {
        "title": "Spreadsheet import",
        "description": "Review and import a supported student list."
      },
      {
        "title": "Fee records",
        "description": "Track admission fees, recurring dues and recorded payments."
      },
      {
        "title": "Seats and shifts",
        "description": "Manage physical study seats and timings when your centre uses them."
      },
      {
        "title": "Staff access",
        "description": "Choose branch permissions for your team with Standard."
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
        "answer": "No. Lab Lords focuses on administration and physical study-space operations, rather than exams, courses or online teaching."
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
    ctaTitle: "Get your coaching centre records together",
    ctaDescription:
      "Start a trial and explore student and fee management for your centre.",
  },
  "tuition-management": {
    slug: "tuition-management",
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
    problemTitle: "Keep daily records together",
    problemDescription:
      "Check the details you need for students, seats and fees.",
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
    featureTitle: "Daily tools for your tuition centre",
    featureDescription:
      "Manage student information, collections and branch records as your centre needs them.",
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
        "title": "Student import",
        "description": "Review a supported spreadsheet before adding the student records."
      },
      {
        "title": "Multiple branches",
        "description": "Keep each location separate; each billable branch is charged separately."
      },
      {
        "title": "Staff permissions",
        "description": "Give staff access to the work they need with Standard."
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
        "description": "Check unpaid amounts and keep notes from your follow-ups."
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
      "Try Lab Lords with your students, recurring fees and payment history.",
  },
};

export function getSoftwarePage(slug: string) {
  return softwarePages[slug as SoftwarePageSlug];
}

export function getSoftwarePagePath(slug: SoftwarePageSlug) {
  return `/software/${slug}`;
}
