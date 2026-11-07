import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { testPrisma as db } from '../setup/db';
import { createOrg, createBranch, createSaasSubscription, createShift, createSeat } from '../factories';
const target = new URL(process.env.DATABASE_URL!);
if (target.hostname !== '127.0.0.1' || target.pathname !== '/lab_lords_account_20261106_browser_test' || existsSync('.clerk/account-fixture.json')) throw new Error('Only a new Account fixture is allowed');
const proof = await db.$queryRawUnsafe<{ name: string }[]>('SELECT current_database() AS name');
if (proof[0].name !== 'lab_lords_account_20261106_browser_test') throw new Error('Target mismatch');
const saved=JSON.parse(readFileSync('.clerk/dashboard-owner-auth.json','utf8'));
const subject=JSON.parse(Buffer.from(saved.cookies.find((item:{name:string})=>item.name==='__session').value.split('.')[1],'base64url').toString()).sub;
const candidates=await db.user.findMany({where:{clerkId:{not:null}},select:{id:true,email:true,clerkId:true}});
const synthetic=candidates.filter(item=>/\+clerk_test@|@(?:example\.(?:com|invalid)|clerk\.test)$/.test(item.email));
const owner=synthetic.find(item=>item.clerkId===subject)??(synthetic.length===1?synthetic[0]:undefined);
if (!owner) throw new Error('Existing development owner has not visited this preview');
const fixtures=[];
for (const plan of ['BASIC','STANDARD','PRO'] as const) {
 const org=await createOrg({id:'account_'+plan.toLowerCase(),ownerId:owner.id,name:plan[0]+plan.slice(1).toLowerCase()+' Learning Spaces',billingModelVersion:'WORKSPACE_V2'});
 const branch=await createBranch({id:'account_'+plan.toLowerCase()+'_branch',organizationId:org.id,name:'Central Reading Room'});
 const other=await createBranch({id:'account_'+plan.toLowerCase()+'_north',organizationId:org.id,name:'North Study Hall'});
 await createSaasSubscription({organizationId:org.id,plan});
 for(const b of [branch,other]) { await createShift({branchId:b.id,name:'Full day',startTime:'06:00',endTime:'22:00'});await createSeat({branchId:b.id,label:'A1'}); }
 fixtures.push({plan,orgId:org.id,branchId:branch.id,otherBranchId:other.id});
}
writeFileSync('.clerk/account-fixture.json',JSON.stringify({database:proof[0].name,fixtures}));
console.log('Created three synthetic organization plans with two branches each. No provider calls or source fixture changes.');
await db.$disconnect();
