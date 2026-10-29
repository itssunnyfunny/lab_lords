import type {Reporter,TestCase,TestResult} from "@playwright/test/reporter";
import {readFileSync,writeFileSync,readdirSync,existsSync} from "node:fs";
import {join} from "node:path";
export function redact(value:string){return value.replace(/^.*(?:cookie:|authorization:|set-cookie:).*$/gmi,"[authentication header redacted]").replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,"[token redacted]");}
function clean(dir:string){if(!existsSync(dir))return;for(const e of readdirSync(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())clean(p);else if(/\.(md|json|txt|log)$/.test(e.name)){const s=readFileSync(p,"utf8");writeFileSync(p,redact(s));}}}
export default class RedactReporter implements Reporter{onTestEnd(_test:TestCase,result:TestResult){for(const error of result.errors){if(error.message)error.message=redact(error.message);if(error.stack)error.stack=redact(error.stack);}clean("test-results/basic-connected");}onEnd(){clean("test-results/basic-connected");}}
