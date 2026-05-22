import fs from "node:fs";
import { extractTextFromPdfBase64 } from "../src/report/pdfText.js";

const path = process.argv[2] ?? "TB2.pdf";
const b64 = fs.readFileSync(path).toString("base64");
const r = await extractTextFromPdfBase64(b64);
console.log("chars", r.text.length);
console.log(r.text.slice(0, 3000));
