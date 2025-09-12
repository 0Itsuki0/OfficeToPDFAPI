"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const fsAsync = __importStar(require("fs/promises"));
const fs = __importStar(require("fs"));
const path_1 = require("path");
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const LIBRE_OFFICE_BIN = "/usr/bin/libreoffice";
const TEMP_FOLDER_PAHT = "/tmp";
const MIME_PDF = "application/pdf";
const app = (0, express_1.default)();
app.use(express_1.default.raw({ type: '*/*' }));
const port = 3000;
// For Web adaptor Readiness Check: https://github.com/awslabs/aws-lambda-web-adapter?tab=readme-ov-file#readiness-check
// By default, Lambda Web Adapter will send HTTP GET requests to the web application at http://127.0.0.1:8080/.
// The port and path can be customized with two environment variables: AWS_LWA_READINESS_CHECK_PORT and AWS_LWA_READINESS_CHECK_PATH.
// Lambda Web Adapter will retry this request every 10 milliseconds until the web application returns an HTTP response (status code >= 100 and < 500) or the function times out.
// After passing readiness check, Lambda Web Adapter will start Lambda Runtime and forward the invokes to the web application.
app.get("/", async (req, res) => {
    res.sendStatus(200);
    return;
});
app.post('/', async (req, res) => {
    const bytes = req.body;
    if (bytes === undefined) {
        res.status(500).send({
            error: true,
            message: "Invalid request body."
        });
        return;
    }
    const header = req.headers['content-disposition'];
    if (header === undefined) {
        res.status(500).send({
            error: true,
            message: "`content-disposition` header required."
        });
        return;
    }
    const filename = extractFileName(header);
    if (filename === undefined) {
        res.status(500).send({
            error: true,
            message: "Invalid `content-disposition` header ."
        });
        return;
    }
    if (!checkFileFormat(filename)) {
        res.status(500).send({
            error: true,
            message: "Invalid file format."
        });
        return;
    }
    try {
        await writeFile(filename, bytes);
        console.log(`Data successfully written to ${filename}`);
    }
    catch (error) {
        res.status(500).send({
            error: true,
            message: `Error writing data to file: ${error}`
        });
        return;
    }
    try {
        const convertedPDFBuffer = await convertToPDF(filename);
        console.log(`convertedPDFBuffer ${convertedPDFBuffer.length}`);
        await cleanupFiles(filename);
        res.writeHead(200, {
            'Content-Type': MIME_PDF,
            'Content-disposition': `attachment;filename=${pdfFileName(filename)}`,
            'Content-Length': convertedPDFBuffer.length
        });
        res.end(convertedPDFBuffer);
        return;
    }
    catch (error) {
        await cleanupFiles(filename);
        res.status(500).send({
            error: true,
            message: `Error converting to PDF: ${error}`
        });
        return;
    }
});
function extractFileName(contentDepositionString) {
    const regex = /((.|\s\S|\r|\n)*)filename\*=(utf-8|UTF-8)''(?<name>((.|\s\S|\r|\n)*))/;
    const match = contentDepositionString.match(regex);
    if (match && match.groups) {
        const { name } = match.groups;
        return name;
    }
    else {
        return undefined;
    }
}
function checkFileFormat(filename) {
    const allowedExtensions = [".odt", ".ods", ".odp", ".odg", ".doc", ".docx", ".xls", ".xlsx", ".xlt", ".ppt", ".pptx", ".pps", ".pub", ".wps", ".rtf", ".sxw", ".sxc", ".sxi", ".sxp", ".wk1", ".wks", ".123"];
    return allowedExtensions.includes(fileExtension(filename));
}
function makeFilePath(filename) {
    const filePath = (0, path_1.join)(TEMP_FOLDER_PAHT, filename);
    return filePath;
}
function fileExtension(filename) {
    return (0, path_1.parse)(filename).ext;
}
function fileNameWithoutExtension(filename) {
    return (0, path_1.parse)(filename).name;
}
function pdfFileName(filename) {
    return `${fileNameWithoutExtension(filename)}.pdf`;
}
async function writeFile(filename, data) {
    const filePath = makeFilePath(filename);
    await fsAsync.mkdir(TEMP_FOLDER_PAHT, { recursive: true });
    await fsAsync.writeFile(filePath, data);
}
async function convertToPDF(filename) {
    const sourceFilePath = makeFilePath(filename);
    const destinationFilePath = makeFilePath(pdfFileName(filename));
    // Important point:
    // We need to sepcify output directory.
    // Otherwise, will be written to /app (or whatever specified by the Dockerfile).
    // ie: command finished:  convert /tmp/Print_180_45_4.xlsx as a Calc document -> /app/Print_180_45_4.pdf using filter: calc_pdf_Export
    //
    // Additional:
    // If we know the specific kind of document we want to convert, for example, excel, we can also specify the filter type along with some other configuration like following.
    // const command = `"${LIBRE_OFFICE_BIN}" --headless --convert-to 'pdf:calc_pdf_Export:{"SinglePageSheets":{"type":"boolean","value":"true"},"PaperSize":{"type":"string","value":"A4"}}' "${sourceFilePath}" --outdir "${TEMP_FOLDER_PAHT}"`
    // Full reference: https://help.libreoffice.org/latest/en-US/text/shared/guide/pdf_params.html
    //
    // Available filters:
    // - draw_pdf_import: for vector graphic files
    // - draw_pdf_addstream_import
    // - impress_pdf_import
    // - impress_pdf_addstream_import
    // - writer_pdf_import: for text-based such as docx
    // - writer_pdf_addstream_import:
    // - calc_pdf_add: for excel
    // - calc_pdf_addstream_import:
    // - math_pdf_Export
    const command = `"${LIBRE_OFFICE_BIN}" --headless --convert-to pdf "${sourceFilePath}" --outdir "${TEMP_FOLDER_PAHT}"`;
    console.log("Executing command to convert: ", command);
    const { stdout, stderr } = await execAsync(command);
    if (stderr) {
        throw new Error(`Error executing command: ${stderr}`);
    }
    console.log("command finished: ", stdout);
    if (!fs.existsSync(destinationFilePath)) {
        throw new Error("Error converting file to PDF.");
    }
    const fileBuffer = await fsAsync.readFile(destinationFilePath);
    return fileBuffer;
}
async function cleanupFiles(filename) {
    const sourceFilePath = makeFilePath(filename);
    const destinationFilePath = makeFilePath(pdfFileName(filename));
    try {
        await fsAsync.unlink(sourceFilePath);
        await fsAsync.unlink(destinationFilePath);
        console.log(`Remove files successfully`);
    }
    catch (error) {
        console.log(`Error removing files: ${error}`);
    }
}
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
