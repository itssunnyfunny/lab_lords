import {defineConfig} from "vitest/config";
import existing from "../owner-setup/vitest.config";
// Only pure guarded import and receipt-calendar checks; no database setup.
export default defineConfig({...existing,test:{...existing.test,fileParallelism:false,include:[...(existing.test?.include ?? []),"tests/unit/lib/feeReceiptDates.test.ts"]}});
