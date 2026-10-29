import {readFileSync,existsSync} from "node:fs";
import {resolve} from "node:path";
/** Explicitly authorized development keys only; no environment file is copied. */
export async function approvedBasicClerkEnvironment() {
    const root=resolve("C:/Users/shani yadav/Desktop/lab_lords");
    const allowed=new Set(["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY","CLERK_SECRET_KEY"]), keys={};
    for(const filename of [".env",".env.local"]){
        const path=resolve(root,filename);if(!existsSync(path))continue;
        for(const line of readFileSync(path,"utf8").split(/\r?\n/)){
            const match=line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=\s*(.*?)\s*$/);
            if(!match||!allowed.has(match[1]))continue;
            let value=match[2];
            if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
            else value=value.replace(/\s+#.*$/,"").trim();
            keys[match[1]]=value;
        }
    }
    if(!keys.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")||!keys.CLERK_SECRET_KEY?.startsWith("sk_test_"))throw new Error("Only existing Clerk Test keys are authorized");
    const localState=JSON.parse(readFileSync(".clerk/dashboard-owner-auth.json","utf8"));
    const token=localState.cookies.find(cookie=>cookie.name==="__session")?.value;
    if(!token)throw new Error("This task's existing owner identity is unavailable");
    const claims=JSON.parse(Buffer.from(token.split(".")[1],"base64url").toString());
    const frontend=Buffer.from(keys.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.slice(8),"base64").toString().replace(/\$$/,"");
    if(new URL(claims.iss).hostname!==frontend||typeof claims.sub!=="string"||!claims.sub.startsWith("user_"))throw new Error("Clerk development instance could not be matched; stopping");
    const response=await fetch("https://api.clerk.com/v1/users/"+encodeURIComponent(claims.sub),{headers:{Authorization:"Bearer "+keys.CLERK_SECRET_KEY}});
    if(!response.ok)throw new Error("Clerk Test secret could not verify the intended existing synthetic owner");
    const user=await response.json(), emails=user.email_addresses?.map(item=>item.email_address)??[];
    if(user.id!==claims.sub||!emails.length||!emails.every(email=>/\+clerk_test@|@(?:example\.(?:com|invalid)|clerk\.test)$/.test(email)))throw new Error("The intended development test-account identity is uncertain; stopping");
    console.log("Clerk Test prefixes, development instance and existing synthetic owner identity verified; key values withheld.");
    return keys;
}
