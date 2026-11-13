// Synthetic presentation fixture only. No database, authentication or provider calls.
const stamp = '2026-09-28T06:00:00.000Z';
const businessDate = '2026-09-28';
const shifts = [
  {id:'morning',name:'Morning',startTime:'06:00',endTime:'12:00',price:1400},
  {id:'evening',name:'Evening',startTime:'12:00',endTime:'18:00',price:1200},
];
const branchContext = {defaultFee:1400,defaultAdmissionFee:0,seats:Array.from({length:8},(_,i)=>({id:'seat-'+(i+1),label:'A'+(i+1)})),shifts,multiShifts:[{id:'full-day',name:'Morning + Evening',componentShiftNames:['Morning','Evening'],price:2400}]};
const issue = (code,field,message)=>({code,field,message,severity:'error'});
function row(id,name,problems=[],options={}) {
  const normalizedData={student:{name,phone:'9876543210',joinedAt:'2026-08-12',monthlyFee:1400,feeSource:'MANUAL'},allocation:{seatLabel:'A2',shiftName:'Morning'},...options};
  return {id,rowNumber:Number(id.slice(-1)),rawData:{Name:name,Phone:'9876543210',Joined:'12/08/2026',Timing:'Morning',Seat:'A2',Fee:'1400'},mappedData:null,normalizedData,status:problems.length?'BLOCKED':'READY',issues:problems,warnings:[],confidence:98,skipped:false,createdEntityIds:null,paymentOutcome:{state:problems.some(p=>p.field==='student.joinedAt')?'NEEDS_REVIEW':'CREATE_NOW',businessDate,dueDate:'2026-09-12',billingStartAt:'2026-08-12',amount:1400,status:'DUE',issues:[]}};
}
export async function installCompletionImport(page,kind='guided') {
  const rows=[row('row-1','Mira Sharma'),row('row-2','Anaya Rao',[issue('CONFIRM_JOINING_DATE','student.joinedAt','Confirm the original joining date. It will not be guessed.')]),row('row-3','Kabir Verma',[issue('UNKNOWN_SHIFT','allocation.shiftName','Choose the uploaded timings.'),issue('UNKNOWN_SEAT','allocation.seatLabel','Choose an available seat.')],{allocation:{seatLabel:'Unknown',shiftName:'FD'}}),{...row('row-4','Source heading'),skipped:true,status:'SKIPPED'}];
  rows[1].normalizedData.student.joinedAt='';
  rows[2].rawData.Timing='FD';
  const state={revision:1,rows,requests:[],experience:'GUIDED_SETUP_V2',failRead:false,failSave:false,failPlan:false,failCommit:false,loseCommitResponse:false,run:null};
  const sessionId='session-'+kind;
  const ready=()=>rows.filter(r=>!r.skipped&&r.status==='READY');
  function detail(url) {
    const filter=url.searchParams.get('rowFilter')||'all';
    const selected=rows.filter(r=>filter==='ready'?r.status==='READY':filter==='attention'?r.issues.length&&!r.skipped:filter==='skipped'?r.skipped:true).filter(r=>!url.searchParams.get('cursor')||r.rowNumber>Number(url.searchParams.get('cursor')));
    const needs=rows.filter(r=>!r.skipped&&r.issues.length).length;
    return {id:sessionId,status:state.run?'PARTIAL':'ANALYZED',engineVersion:2,goal:'FULL',sourceType:'PASTED_TABLE',sourceConfiguration:kind==='legacy'?{}:{experience:state.experience},draftRevision:state.revision,activeEvaluationRevision:state.revision,fileName:'September student register',updatedAt:stamp,
      mapping:{entityTypesDetected:['STUDENT'],columnMappings:[['Name','student.name'],['Phone','student.phone'],['Joined','student.joinedAt'],['Timing','allocation.shiftName'],['Seat','allocation.seatLabel'],['Fee','student.monthlyFee']].map(([sourceColumn,targetField])=>({sourceColumn,targetField,confidence:100,source:'MANUAL',autoApplied:true,needsReview:false})),importOptions:{paymentPolicy:'CURRENT_CALENDAR_MONTH',paymentCycle:'USE_JOINED_AT_ANNIVERSARY'},guidance:{passes:1},analysis:{attention:[],sourceProfile:{rowCount:4,columnCount:6,emptyCellRate:0,columns:[],highSignalColumns:[],lowSignalColumns:[]}}},
      summary:{totalRows:rows.length,readyRows:ready().length,needsReviewRows:needs,blockedRows:needs,warningRows:0,duplicateRows:0,conflictRows:0,skippedRows:rows.filter(r=>r.skipped).length,readinessScore:50,detectedEntityCounts:{STUDENT:4},attention:[]},
      guidance:{businessDate,ready:ready().length,needsHelp:needs,partialStudents:0,createdStudents:state.run?1:0,createdAllocations:state.run?1:0,createdPayments:state.run?1:0,imported:state.run?1:0,groups:[],preparation:{canImprove:false,reusableRows:0,columnsToReview:0},setup:{counts:{matched:2,decision:1,conflict:0,deferred:0},timings:[{value:'Morning',count:2},{value:'FD',count:1}],seats:[{value:'A2',count:2},{value:'Unknown',count:1}]}},
      rows:selected,rowPage:{filter,issueCode:null,limit:25,cursor:null,nextCursor:null,hasMore:false,totalRows:rows.length,filteredRows:selected.length,returnedRows:selected.length},branchContext,existingBranchContext:branchContext,questions:[],commits:[],latestRun:state.run};
  }
  function plan(input) {
    const included=ready();
    const mutations={students:included.length,seats:0,shifts:0,multiShifts:0,allocations:included.length,payments:included.length,total:included.length*3,affectedRows:{students:included.length,allocations:included.length,payments:included.length}};
    return {id:'plan-completion-'+state.revision,revision:state.revision,readinessPolicy:input.readinessPolicy||'READY_ROWS_ONLY',planVersion:'completion-fixture',canRun:true,totalRows:rows.length,readyRows:included.length,blockedRows:rows.filter(r=>r.issues.length&&!r.skipped).length,warningRows:0,skippedRows:1,alreadyImportedRows:0,checks:[],summary:{totalRows:rows.length,readyRows:included.length,blockedRows:2,warningRows:0,skippedRows:1,mutations,requiredPermissions:['students','seat_allocation','mark_paid']},mutationSummary:mutations,
      currentMonthReview:{businessDate,heldFinancialRows:1,seatingDeferredRows:0,setup:{seats:[],shifts:[],multiShifts:[]},rows:included.map(r=>({rowId:r.id,rowNumber:r.rowNumber,studentName:r.normalizedData.student.name,...r.paymentOutcome,allocation:r.normalizedData.allocation,monthlyFee:r.normalizedData.student.monthlyFee,componentShiftNames:[]}))}};
  }
  await page.route(new RegExp('/api/branches/pilot/import-sessions/'+sessionId+'(?:[/?].*)?$'),async route=>{
    const request=route.request(),url=new URL(request.url()),suffix=url.pathname.split(sessionId)[1];
    const input=request.method()==='GET'?{}:request.postDataJSON()||{};
    if(request.method()!=='GET')state.requests.push({path:suffix,method:request.method(),body:input,key:request.headers()['idempotency-key']});
    if(!suffix) return route.fulfill(state.failRead?{status:503,json:{error:'Synthetic import read failure'}}:{json:detail(url)});
    if(suffix==='/payments') return route.fulfill({json:{draftRevision:state.revision,businessDate,rows:[]}});
    if(suffix==='/availability') {
      const shift=shifts.find(s=>s.id===input.shiftIds?.[0])||shifts[0];
      return route.fulfill({json:{shifts:shifts.map(s=>({...s,shiftId:s.id,type:'PRIMARY',isReserved:false,totalSeats:8,used:1,available:7,stagedUsed:0,stagedAvailable:7,occupancyPercent:13,isFull:false,studentAlreadyAllocated:false})),seatMap:{shiftId:shift.id,shiftName:shift.name,isReserved:false,totalSeats:8,occupiedCount:1,availableCount:7,seats:branchContext.seats.map((s,i)=>({seatId:s.id,label:s.label,occupied:i===0,occupiedBy:i===0?'Existing student':null,source:i===0?'existing':'available'}))},conflicts:[]}});
    }
    if(suffix==='/rows/preview') return route.fulfill({json:{rowId:input.rowId,rowNumber:rows.find(r=>r.id===input.rowId)?.rowNumber||1,status:'READY',normalizedData:input.normalizedData,issues:[],warnings:[],paymentPreview:{enabled:true,amount:1400,amountSource:'UPLOADED',status:'DUE',message:'Existing recorded facts',blockers:[]},suggestedFixes:[]}});
    if(suffix==='/rows') {
      if(state.failSave)return route.fulfill({status:503,json:{error:'Synthetic draft save failure'}});
      if(input.expectedRevision!==state.revision)return route.fulfill({status:409,json:{error:'Revision changed'}});
      for(const edit of input.edits||[]) {const target=rows.find(r=>r.id===edit.rowId);if(target){target.normalizedData=edit.normalizedData;target.issues=[];target.status='READY';target.paymentOutcome={...target.paymentOutcome,state:'CREATE_NOW'};}}
      for(const target of rows){if(input.skipRowIds?.includes(target.id)){target.skipped=true;target.status='SKIPPED';}if(input.unskipRowIds?.includes(target.id)){target.skipped=false;target.status=target.issues.length?'BLOCKED':'READY';}}
      state.revision++;return route.fulfill({json:detail(url)});
    }
    if(suffix==='/setup') {
      if(state.failSave)return route.fulfill({status:503,json:{error:'Synthetic draft save failure'}});
      if(input.expectedRevision!==state.revision)return route.fulfill({status:409,json:{error:'Revision changed'}});
      const target=rows.find(r=>r.id===input.rowId);
      if(target){const shift=shifts.find(s=>s.id===input.targetId),seat=branchContext.seats.find(s=>s.id===input.seatId);
        target.normalizedData.allocation=input.action==='DEFER_ROW'?{deferred:true}:{shiftName:shift?.name,seatLabel:seat?.label};
        target.issues=target.issues.filter(p=>!p.field.startsWith('allocation.'));target.status=target.issues.length?'BLOCKED':'READY';
      }
      state.revision++;return route.fulfill({json:detail(url)});
    }
    if(suffix==='/mapping') {state.revision++;return route.fulfill({json:{draftRevision:state.revision}});}
    if(suffix==='/plans') {
      if(state.failPlan)return route.fulfill({status:503,json:{error:'Synthetic review request failed'}});
      if(input.targetRevision!==state.revision)return route.fulfill({status:409,json:{error:'Synthetic draft revision changed'}});
      return route.fulfill({json:plan(input)});
    }
    if(suffix==='/commit') {
      if(state.failCommit)return route.fulfill({status:503,json:{error:'Synthetic import start failure'}});
      state.run={id:'run-completion',importSessionId:sessionId,importPlanId:input.planId,kind:'COMMIT',status:'COMPLETED_WITH_ISSUES',totalItems:3,completedItems:3,succeededItems:3,failedItems:0,skippedItems:0,cancelledItems:0,startedAt:stamp,finishedAt:stamp,createdAt:stamp,items:[]};
      rows[0].status='IMPORTED';rows[0].createdEntityIds={studentId:'saved-mira',allocationIds:['saved-allocation'],paymentIds:['saved-fee']};
      return route.fulfill(state.loseCommitResponse?{status:503,json:{error:'Synthetic lost response'}}:{json:{runId:state.run.id,status:state.run.status}});
    }
    return route.fulfill({status:405,json:{error:'Fixture operation not configured: '+suffix}});
  });
  await page.route('**/api/branches/pilot/import-runs/run-completion',route=>route.fulfill({json:state.run}));
  return state;
}
