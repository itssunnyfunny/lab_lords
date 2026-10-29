import { approvedBasicClerkEnvironment } from "./basic-clerk.mjs";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { Client } from "pg";
const mode=process.argv[2]??"test", path=".clerk/basic-integrated-runtime.json";
if(!["prepare","seed","start","test","build","auth"].includes(mode))throw new Error("Unsupported local Basic command");
const source=JSON.parse(readFileSync(".clerk/dashboard-local-runtime.json","utf8"));
const container=JSON.parse(execFileSync("docker",["inspect",source.containerId,"--format", '{"id":{{json .Id}},"image":{{json .Config.Image}},"running":{{json .State.Running}},"ports":{{json .HostConfig.PortBindings}}}'],{encoding:"utf8",windowsHide:true}));
const binding=container.ports?.["5432/tcp"];
if(container.id!==source.containerId||container.image!=="postgres:16-alpine"||!container.running||binding?.length!==1||binding[0].HostIp!=="127.0.0.1"||binding[0].HostPort!==String(source.port))throw new Error("Disposable local container proof failed");
const database="lab_lords_dashboard_basic_integrated_browser_test";
if(mode==="prepare" && existsSync(path))throw new Error("Basic fixture already prepared; no automatic reset");
const connectionString="postgresql://postgres@127.0.0.1:"+source.port+"/"+database;
if(mode==="prepare"){
    if(!/^lab_lords_dashboard_[a-z_]*browser_test$/.test(source.database))throw new Error("Unrecognized schema source");
    const db=new Client({host:"127.0.0.1",port:source.port,user:"postgres",database:source.database});
    await db.connect();
    try{const proof=await db.query("SELECT current_database() AS name");if(proof.rows[0]?.name!==source.database)throw new Error("Schema source mismatch");await db.query('CREATE DATABASE "'+database+'" TEMPLATE template0');}finally{await db.end();}
    const schema=execFileSync("docker",["exec",source.containerId,"pg_dump","--schema-only","--no-owner","--no-privileges","-U","postgres","-d",source.database],{windowsHide:true,maxBuffer:16*1024*1024});
    execFileSync("docker",["exec","-i",source.containerId,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d",database],{input:schema,windowsHide:true,stdio:["pipe","pipe","pipe"],maxBuffer:16*1024*1024});
    const migrated=new Client({connectionString});await migrated.connect();try{const identity=await migrated.query('SELECT current_database() AS name,(SELECT count(*)::int FROM "OrganizationSubscription") AS subscriptions');if(identity.rows[0]?.name!==database||identity.rows[0].subscriptions!==0)throw new Error("Empty local migration target could not be proved");await migrated.query(readFileSync("prisma/migrations/20261023090000_three_plan_catalogue/migration.sql","utf8"));}finally{await migrated.end();}
    writeFileSync(path,JSON.stringify({database,containerId:source.containerId,port:source.port}));
}
const config=JSON.parse(readFileSync(path,"utf8"));
if(config.database!==database||config.containerId!==source.containerId||config.port!==source.port)throw new Error("Basic runtime identity changed");
const db=new Client({connectionString});await db.connect();
try{const proof=await db.query('SELECT current_database() AS name,(SELECT count(*)::int FROM "User") AS users');if(proof.rows[0]?.name!==database||(["prepare","seed"].includes(mode)&&proof.rows[0].users!==0))throw new Error("Basic target proof failed");}finally{await db.end();}
mkdirSync("test-results/basic-integration",{recursive:true});
if(mode==="prepare")writeFileSync("test-results/basic-integration/database-proof.json",JSON.stringify({database,containerId:source.containerId,loopbackOnly:true,freshSchemaOnly:true},null,2));
const clerk=["start","build","auth"].includes(mode)?await approvedBasicClerkEnvironment():{};
const env={...process.env,...clerk,NODE_ENV:"test",DATABASE_URL:connectionString,TEST_DATABASE_URL:connectionString,TEST_DATABASE_RESET_CONFIRM:database,DIRECT_URL:connectionString,ACCELERATE_URL:"",
 RAZORPAY_MODE:"TEST",RAZORPAY_KEY_ID:"rzp_test_local_read_only",RAZORPAY_KEY_SECRET:"",RAZORPAY_BILLING_WRITES_ENABLED:"false",DASHBOARD_CONNECTED_PORT:"3117",PLAYWRIGHT_EXISTING_AUTH_STATE:".clerk/dashboard-owner-auth.json"};
const args=["prepare","seed"].includes(mode)?["node_modules/tsx/dist/cli.mjs","tests/dashboard-connected/basic-seed.ts"]:
 mode==="start"?["tests/dashboard-connected/server.mjs"]:
 mode==="auth"?["tests/dashboard-connected/refresh-auth.mjs"]:
 mode==="build"?["tests/dashboard-connected/build.mjs"]:
 ["node_modules/@playwright/test/cli.js","test","--config","tests/dashboard-connected/basic-workspace.playwright.config.ts",...process.argv.slice(3)];
console.log("Verified isolated Basic browser database; real development auth; provider writes disabled.");
const child=spawn(process.execPath,args,{env,stdio:"inherit",windowsHide:true});
for(const signal of ["SIGINT","SIGTERM"])process.on(signal,()=>child.kill(signal));
child.on("exit",code=>{process.exitCode=code??1;});
