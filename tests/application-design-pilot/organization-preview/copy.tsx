import { Children, cloneElement, isValidElement, type ReactNode, type ReactElement } from "react";
import { useSearchParams } from "next/navigation";
import type { Locale } from "./model";
const copy: Record<string,[string,string]> = {
"Branch":["शाखा","Branch"],"Switch branch":["शाखा बदलें","Branch badlein"],"Choose a branch":["शाखा चुनें","Branch chunein"],"Back to organization":["संगठन पर वापस जाएँ","Organization par wapas"],
"This branch’s plan":["इस शाखा का प्लान","Is branch ka plan"],"Feature access":["सुविधाओं की पहुँच","Feature access"],"Manage plan":["प्लान प्रबंधित करें","Plan manage karein"],"Scheduled":["निर्धारित बदलाव","Scheduled change"],
"Read-only":["केवल देखने की अनुमति","Sirf dekh sakte hain"],"Temporary access":["अस्थायी पहुँच","Temporary access"],"Trial until":["ट्रायल की अंतिम तिथि","Trial ki last date"],"Temporary access until":["अस्थायी पहुँच की अंतिम तिथि","Temporary access ki last date"],
"Organization":["संगठन","Organization"],"Your branches":["आपकी शाखाएँ","Aapki branches"],"Open branch":["शाखा खोलें","Branch kholein"],"Account":["खाता","Account"],"Organization settings":["संगठन की सेटिंग","Organization settings"],
"Billing":["बिलिंग","Billing"],"Billing and plans":["बिलिंग और प्लान","Billing aur plans"],"Current billed plan":["अभी बिल होने वाला प्लान","Current billed plan"],"Selected future plan":["आगे के लिए चुना प्लान","Aage ke liye selected plan"],
"Active":["सक्रिय","Active"],"Trial":["ट्रायल","Trial"],"Access expired":["पहुँच समाप्त","Access khatam"],"Activation pending":["सक्रिय होने की प्रतीक्षा","Activation pending"],"Archived":["संग्रहीत","Archived"],
"Overview":["अवलोकन","Overview"],"Students":["विद्यार्थी","Students"],"Seats":["सीटें","Seats"],"Fees":["विद्यार्थियों की फीस","Student fees"],"Library setup":["लाइब्रेरी सेटअप","Library setup"],
"Your library overview":["आपकी लाइब्रेरी का अवलोकन","Aapki library ka overview"],"Active students":["सक्रिय विद्यार्थी","Active students"],"Available seats":["खाली सीटें","Available seats"],"Fees collected this month":["इस महीने मिली फीस","Is mahine mili fees"],
"Seat availability":["सीट की उपलब्धता","Seat availability"],"View all seats":["सभी सीटें देखें","Saari seats dekhein"],"Morning":["सुबह","Morning"],"Afternoon":["दोपहर","Afternoon"],"Evening":["शाम","Evening"],
"Occupied":["भरी हुई","Occupied"],"Available":["खाली","Available"],"Selected":["चुनी हुई","Selected"],"Choose a seat to see its details.":["जानकारी देखने के लिए सीट चुनें।","Details ke liye seat chunein."],
"Your students":["आपके विद्यार्थी","Aapke students"],"Add student":["विद्यार्थी जोड़ें","Student jodein"],"Add a student":["विद्यार्थी जोड़ें","Student jodein"],"Student name":["विद्यार्थी का नाम","Student ka naam"],
"Mobile number":["मोबाइल नंबर","Mobile number"],"Monthly fee":["मासिक फीस","Monthly fee"],"Save for later":["अभी सेव करें","Abhi save karein"],"Save & choose seat":["सेव करें और सीट चुनें","Save aur seat chunein"],
"A few details, then we’ll find them a seat.":["कुछ जानकारी भरें, फिर सीट चुनें।","Kuch details bharein, phir seat chunein."],"LET’S GET THEM SETTLED":["शुरुआत करें","Shuru karein"],"You can change this for each student.":["हर विद्यार्थी के लिए इसे बदल सकते हैं।","Har student ke liye badal sakte hain."],
"Student":["विद्यार्थी","Student"],"Seat & shift":["सीट और शिफ्ट","Seat aur shift"],"October fee":["अक्टूबर की फीस","October fee"],"Paid":["भुगतान हो गया","Paid"],"Choose a seat":["सीट चुनें","Seat chunein"],"Find a student by name or phone":["नाम या फोन से खोजें","Naam ya phone se dhoondhein"],
"A place to settle in":["पढ़ने की अपनी जगह","Padhne ki apni jagah"],"Pick a shift, choose a seat, and make it theirs.":["शिफ्ट और खाली सीट चुनकर आवंटित करें।","Shift aur khali seat chun kar assign karein."],
"Assign a seat":["सीट आवंटित करें","Seat assign karein"],"Assign seat":["सीट आवंटित करें","Seat assign karein"],"Choose a student":["विद्यार्थी चुनें","Student chunein"],"Pick a seat":["सीट चुनें","Seat chunein"],
"All settled in":["सीट मिल गई","Seat mil gayi"],"Student added":["विद्यार्थी जुड़ गया","Student jud gaya"],"Record a fee":["फीस दर्ज करें","Fee record karein"],"Record fee payment":["फीस का भुगतान दर्ज करें","Fee payment record karein"],
"Student fees":["विद्यार्थियों की फीस","Student fees"],"A clear view of what’s paid and what’s left.":["कितनी फीस मिली और कितनी बाकी है।","Kitni fee mili aur kitni baaki hai."],"Left to collect":["लेना बाकी है","Lena baaki hai"],"Received this month":["इस महीने मिला","Is mahine mila"],
"Needs payment":["भुगतान बाकी","Payment baaki"],"All students":["सभी विद्यार्थी","Saare students"],"Find a student":["विद्यार्थी खोजें","Student dhoondhein"],"Record payment":["भुगतान दर्ज करें","Payment record karein"],"Record a payment":["भुगतान दर्ज करें","Payment record karein"],
"Amount left to pay":["भुगतान बाकी","Payment baaki"],"Amount received":["मिली हुई राशि","Mili hui rakam"],"Received by":["भुगतान का माध्यम","Payment ka tareeka"],"Cash":["नकद","Cash"],"Bank transfer":["बैंक ट्रांसफर","Bank transfer"],
"A part payment is fine. We’ll keep track of the rest.":["आंशिक भुगतान भी दर्ज करें। बाकी राशि दिखती रहेगी।","Part payment bhi record karein. Baaki amount dikhega."],"Record money you have already received.":["पहले से मिली राशि ही दर्ज करें।","Pehle se mili rakam record karein."],
"Cancel":["रद्द करें","Cancel"],"Done":["हो गया","Done"],"Payment recorded":["भुगतान दर्ज हो गया","Payment record ho gaya"],"Fee receipt":["फीस की रसीद","Fee receipt"],"View receipt":["रसीद देखें","Receipt dekhein"],"View student":["विद्यार्थी देखें","Student dekhein"],
"For":["किसलिए","Kisliye"],"Paid by":["माध्यम","Tareeka"],"Date":["तारीख","Date"],"Receipt":["रसीद","Receipt"],"This month’s fee is paid":["इस महीने की फीस पूरी है","Is mahine ki fee poori hai"],
"Edit student":["विद्यार्थी की जानकारी बदलें","Student edit karein"],"Edit details":["जानकारी बदलें","Details badlein"],"Keep their details up to date.":["जानकारी सही रखें।","Details updated rakhein."],"Save changes":["बदलाव सेव करें","Changes save karein"],
"Change seat":["सीट बदलें","Seat badlein"],"Fee paid":["फीस मिल गई","Fee paid"],"Payments":["भुगतान","Payments"],"All paid for October":["अक्टूबर की फीस पूरी है","October ki fee poori hai"],
"Close dialog":["बंद करें","Band karein"],"No students found":["कोई विद्यार्थी नहीं मिला","Koi student nahi mila"],"Try another name or add a student.":["दूसरा नाम खोजें या विद्यार्थी जोड़ें।","Doosra naam dhoondhein ya student jodein."],
"Preview scenarios":["पूर्वावलोकन के नमूने","Preview scenarios"],"Reset sample data":["नमूना डेटा रीसेट करें","Sample data reset karein"],"Retry":["फिर कोशिश करें","Retry"],
"No branches yet":["अभी कोई शाखा नहीं","Abhi koi branch nahi"],"Add a sample branch":["नमूना शाखा जोड़ें","Sample branch jodein"],"Workspaces unavailable":["वर्कस्पेस उपलब्ध नहीं","Workspaces unavailable"],"Loading workspaces":["वर्कस्पेस खुल रहे हैं","Workspaces load ho rahe hain"],
"Branch unavailable":["शाखा उपलब्ध नहीं","Branch unavailable"],"Return to workspace":["वर्कस्पेस पर वापस जाएँ","Workspace par wapas"],"Confirm scheduled change":["निर्धारित बदलाव की पुष्टि करें","Scheduled change confirm karein"],
"Choose plan":["प्लान चुनें","Plan chunein"],"Confirm":["पुष्टि करें","Confirm"],"Cancel scheduled change":["निर्धारित बदलाव रद्द करें","Scheduled change cancel karein"],"Preview effective date":["प्रभावी तिथि का नमूना देखें","Effective date preview karein"],
"Personal account":["निजी खाता","Personal account"],"Profile and language preferences":["प्रोफाइल और भाषा","Profile aur language"],"This area is shared by your organization.":["यह संगठन का साझा क्षेत्र है।","Yeh organization ka shared area hai."],
};

Object.assign(copy, {
  "Choose a branch. Its workspace and access travel with it.": [
    "शाखा चुनें। उसका वर्कस्पेस और सुविधाएँ साथ खुलेंगी।",
    "Branch chunein. Uska workspace aur access saath khulega."
  ],
  "Create a sample Basic branch to explore the journey.": [
    "देखने के लिए एक नमूना Basic शाखा बनाएँ।",
    "Dekhne ke liye ek sample Basic branch banayein."
  ],
  "Lab Lords subscriptions. Student fees stay inside each branch.": [
    "Lab Lords का सब्सक्रिप्शन। विद्यार्थियों की फीस शाखा में देखें।",
    "Lab Lords subscriptions. Students ki fees branch mein dekhein."
  ],
  "Mixed branch plans are a design simulation. The real billing model is still organization-wide.": [
    "अलग शाखाओं के प्लान यहाँ केवल नमूना हैं। असली बिलिंग अभी पूरे संगठन के लिए एक है।",
    "Alag branch plans yahan sirf sample hain. Asli billing abhi poore organization ki ek hai."
  ],
  "Synthetic preview · no real sign-in, database or payments": [
    "नमूना पूर्वावलोकन · असली साइन-इन, डेटाबेस या भुगतान नहीं",
    "Sample preview · asli sign-in, database ya payment nahi"
  ],
  "Manage plan for": [
    "इस शाखा का प्लान प्रबंधित करें",
    "Is branch ka plan manage karein"
  ],
  "Not active yet": [
    "अभी सक्रिय नहीं",
    "Abhi active nahi"
  ],
  "month": [
    "माह",
    "mahina"
  ],
  "from": [
    "से",
    "se"
  ],
  "Choose a branch to see its subscription.": [
    "सब्सक्रिप्शन देखने के लिए शाखा चुनें।",
    "Subscription dekhne ke liye branch chunein."
  ],
  "Current access stays in place until the effective date.": [
    "प्रभावी तिथि तक मौजूदा सुविधाएँ बनी रहेंगी।",
    "Effective date tak current access rahega."
  ],
  "Students, seats and student fees": [
    "विद्यार्थी, सीटें और विद्यार्थियों की फीस",
    "Students, seats aur students ki fees"
  ],
  "Full workspace, staff, analytics and AI": [
    "पूरा वर्कस्पेस, कर्मचारी, विश्लेषण और AI",
    "Poora workspace, staff, analytics aur AI"
  ],
  "Standard features and WhatsApp": [
    "Standard की सुविधाएँ और WhatsApp",
    "Standard features aur WhatsApp"
  ],
  "Effective date": [
    "प्रभावी तिथि",
    "Effective date"
  ],
  "Only this branch changes. Other branches keep their plans.": [
    "केवल इस शाखा का प्लान बदलेगा। बाकी शाखाओं के प्लान वही रहेंगे।",
    "Sirf is branch ka plan badlega. Baaki branches ke plans wahi rahenge."
  ],
  "Preview only. No authorization or charge will occur.": [
    "केवल पूर्वावलोकन। कोई भुगतान या अनुमति प्रक्रिया नहीं होगी।",
    "Sirf preview. Koi authorization ya charge nahi hoga."
  ],
  "This destination is not available to this preview account.": [
    "यह जगह इस नमूना खाते के लिए उपलब्ध नहीं है।",
    "Yeh jagah is sample account ke liye available nahi hai."
  ],
  "Manage branches and subscriptions from the organization. Seats, shifts and student fees belong in each branch’s Library setup.": [
    "संगठन से शाखाएँ और सब्सक्रिप्शन प्रबंधित करें। सीटें, शिफ्ट और फीस हर शाखा के लाइब्रेरी सेटअप में हैं।",
    "Organization se branches aur subscriptions manage karein. Seats, shifts aur fee setup har branch mein hai."
  ],
  "Role": [
    "भूमिका",
    "Role"
  ],
  "Scenario": [
    "स्थिति",
    "Scenario"
  ],
  "Library owner": [
    "लाइब्रेरी मालिक",
    "Library owner"
  ],
  "Staff": [
    "कर्मचारी",
    "Staff"
  ],
  "Skip to content": [
    "मुख्य सामग्री पर जाएँ",
    "Content par jayein"
  ],
  "Main navigation": [
    "मुख्य नेविगेशन",
    "Main navigation"
  ],
  "A LITTLE MORE ORGANISED, EVERY DAY": [
    "हर दिन, थोड़ा और व्यवस्थित",
    "Har din, thoda aur organised"
  ],
  "October 2026": [
    "अक्टूबर 2026",
    "October 2026"
  ],
  "October 2026 · student fee": [
    "अक्टूबर 2026 · विद्यार्थी की फीस",
    "October 2026 · student fee"
  ],
  "October 2026 fee": [
    "अक्टूबर 2026 की फीस",
    "October 2026 fee"
  ],
  "Search students": [
    "विद्यार्थी खोजें",
    "Students dhoondhein"
  ],
  "Search fees": [
    "फीस खोजें",
    "Fees dhoondhein"
  ],
  "Show fees": [
    "फीस देखें",
    "Fees dekhein"
  ],
  "students, a place for each of them.": [
    " विद्यार्थी, सबके लिए जगह।",
    " students, sabke liye jagah."
  ],
  "Let’s find a seat": [
    "सीट चुनें",
    "Seat dhoondhein"
  ],
  "Choose a shift and an available seat.": [
    "शिफ्ट और खाली सीट चुनें।",
    "Shift aur khali seat chunein."
  ],
  "No payments recorded yet.": [
    "अभी कोई भुगतान दर्ज नहीं है।",
    "Abhi koi payment record nahi hai."
  ],
  "Student not found in this preview": [
    "यह विद्यार्थी नमूने में नहीं मिला",
    "Yeh student sample mein nahi mila"
  ],
  "Back to students": [
    "विद्यार्थियों पर वापस जाएँ",
    "Students par wapas"
  ],
  "Student setup progress": [
    "विद्यार्थी सेटअप की प्रगति",
    "Student setup progress"
  ],
  "Seat assignment": [
    "सीट आवंटन",
    "Seat assignment"
  ],
  "Add a new student": [
    "नया विद्यार्थी जोड़ें",
    "Naya student jodein"
  ],
  "Select a free seat from the map.": [
    "नक्शे से खाली सीट चुनें।",
    "Map se khali seat chunein."
  ],
  "Choose a student and a free seat to get started.": [
    "शुरू करने के लिए विद्यार्थी और खाली सीट चुनें।",
    "Shuru karne ke liye student aur khali seat chunein."
  ],
  "Assigned to": [
    "आवंटित विद्यार्थी:",
    "Assigned to"
  ],
  "This month is paid": [
    "इस महीने की फीस पूरी है",
    "Is mahine ki fee poori hai"
  ],
  "Seat not assigned": [
    "सीट नहीं मिली",
    "Seat assign nahi hui"
  ],
  "No matching students": [
    "कोई विद्यार्थी नहीं मिला",
    "Koi student nahi mila"
  ],
  "All caught up": [
    "सारी फीस मिल गई",
    "Saari fees mil gayi"
  ],
  "Try another name.": [
    "दूसरा नाम खोजें।",
    "Doosra naam dhoondhein."
  ],
  "No student fees are waiting for payment.": [
    "किसी विद्यार्थी की फीस बाकी नहीं है।",
    "Kisi student ki fees baaki nahi hai."
  ],
  "This branch is read-only. Existing records are preserved.": [
    "इस शाखा में केवल देख सकते हैं। पुराने रिकॉर्ड सुरक्षित हैं।",
    "Is branch mein sirf dekh sakte hain. Purane records safe hain."
  ],
  "Access has ended or is awaiting activation. Records are read-only; manage this branch’s plan to recover access.": [
    "पहुँच समाप्त है या सक्रिय होने की प्रतीक्षा है। रिकॉर्ड केवल देख सकते हैं; पहुँच वापस पाने के लिए शाखा का प्लान प्रबंधित करें।",
    "Access khatam hai ya activation pending hai. Records sirf dekh sakte hain; access ke liye branch ka plan manage karein."
  ],
  "Keep it simple": [
    "सरल रखें",
    "Simple rakhein"
  ],
  "This Basic preview focuses on students, seats and fees.": [
    "इस Basic नमूने में विद्यार्थी, सीटें और फीस हैं।",
    "Is Basic sample mein students, seats aur fees hain."
  ],
  "Back to overview": [
    "अवलोकन पर वापस जाएँ",
    "Overview par wapas"
  ],
  "A few essentials. You’re ready to go.": [
    "कुछ ज़रूरी जानकारी। फिर शुरुआत करें।",
    "Kuch zaroori details. Phir shuru karein."
  ],
  "Library name": [
    "लाइब्रेरी का नाम",
    "Library ka naam"
  ],
  "Number of seats": [
    "सीटों की संख्या",
    "Seats ki ginti"
  ],
  "Keep all currently assigned seats.": [
    "पहले से आवंटित सीटें बनाए रखें।",
    "Pehle se assigned seats rakhein."
  ],
  "Default monthly fee": [
    "सामान्य मासिक फीस",
    "Default monthly fee"
  ],
  "Used for new students.": [
    "नए विद्यार्थियों के लिए।",
    "Naye students ke liye."
  ],
  "Your shifts": [
    "आपकी शिफ्ट",
    "Aapki shifts"
  ],
  "From": [
    "शुरू",
    "Shuru"
  ],
  "To": [
    "समाप्त",
    "Khatam"
  ],
  "Save setup": [
    "सेटअप सेव करें",
    "Setup save karein"
  ],
  "Library setup saved.": [
    "लाइब्रेरी सेटअप सेव हुआ।",
    "Library setup save hua."
  ],
  "Each shift needs an end time after its start time.": [
    "समाप्ति समय शुरू होने के बाद होना चाहिए।",
    "End time start ke baad hona chahiye."
  ],
  "Keep these sample shift times separate.": [
    "नमूने की शिफ्ट के समय अलग रखें।",
    "Sample shift times alag rakhein."
  ],
  "Enter an amount up to the remaining fee.": [
    "बाकी फीस तक की राशि भरें।",
    "Baaki fee tak ki rakam bharein."
  ],
  "Recording…": [
    "दर्ज हो रहा है…",
    "Record ho raha hai…"
  ],
  "Received from": [
    "इनसे प्राप्त:",
    "Inse mila:"
  ],
  "left to pay this month": [
    "इस महीने बाकी है",
    "is mahine baaki hai"
  ],
  "Choose a shift": [
    "शिफ्ट चुनें",
    "Shift chunein"
  ],
  "seats available in": [
    "सीटें खाली हैं —",
    "seats khali hain —"
  ],
  "10-digit number": [
    "10 अंकों का नंबर",
    "10 digit number"
  ],
  "Enter a 10-digit mobile number": [
    "10 अंकों का मोबाइल नंबर भरें",
    "10 digit mobile number bharein"
  ],
  "e.g. Ananya Sharma": [
    "जैसे अनन्या शर्मा",
    "Jaise Ananya Sharma"
  ]
});
export function translateText(text:string,locale:Locale):string {
  if(locale==="en")return text;
  const match=copy[text.trim()]; if(match)return text.replace(text.trim(),match[locale==="hi"?0:1]);
  if(/^\d+ students, a place for each of them\.$/.test(text))return locale==="hi"?text.split(" ")[0]+" विद्यार्थी, सभी के लिए जगह।":text.split(" ")[0]+" students, sabke liye jagah.";
  const replacements: [RegExp,string,string][] = [
    [/^Seat (\d+)/, "सीट $1", "Seat $1"], [/^₹([\d,]+) due$/, "₹$1 बाकी", "₹$1 baaki"],
    [/^₹([\d,]+) left to pay$/, "₹$1 बाकी", "₹$1 baaki"], [/ seats$/, " सीटें", " seats"],
    [/ received$/, " प्राप्त", " mila"], [/ paid · /, " भुगतान · ", " paid · "], [/ fee$/, " फीस", " fee"],
    [/^Monthly fee /, "मासिक फीस ", "Monthly fee "], [/ · Received /, " · प्राप्त ", " · Mila "],
    [/available$/, "खाली", "khali"], [/occupied by /, "आवंटित: ", "assigned: "],
    [/ seats available in /, " सीटें खाली हैं — ", " seats khali hain — "],
    [/ starts$/, " शुरू", " shuru"], [/ ends$/, " समाप्त", " khatam"]
  ];
  let translated=text;
  for (const [pattern,hi,hinglish] of replacements) translated=translated.replace(pattern,locale==="hi"?hi:hinglish);
  return translated;
}
export function useCopy(){const params=useSearchParams();const locale=(params.get("lang")||"en") as Locale;return (text:string)=>translateText(text,locale);}
export function localizeTree(node:ReactNode,locale:Locale):ReactNode {
  if(typeof node==="string")return translateText(node,locale);
  if(Array.isArray(node))return Children.map(node, child=>localizeTree(child,locale));
  if(!isValidElement(node))return node;
  const element=node as ReactElement<Record<string,unknown>>;
  const props:Record<string,unknown>={};
  for(const key of ["title","eyebrow","placeholder","aria-label"])if(typeof element.props[key]==="string")props[key]=translateText(element.props[key] as string,locale);
  if(element.props.children!==undefined)props.children=localizeTree(element.props.children as ReactNode,locale);
  return cloneElement(element,props);
}
export function LocalizedPrototype({children}:{children:ReactNode}){const params=useSearchParams();return localizeTree(children,(params.get("lang")||"en") as Locale);}
