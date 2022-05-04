import dotenv from 'dotenv';
import { writeFileSync } from 'fs';
import { scrapeCrowdloanData } from './src/core/crowdloan.mjs';
import { checkExistingFile, loadJSONFile } from './src/core/fs.mjs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';


async function main() {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const CROWDLOAN_DATA_PATH = `${__dirname}/export/crowdloan_data.json`;
    const HTML_DATA_PATH = `${__dirname}/export/crowdloan_top.html`;

    dotenv.config();

    await scrapeCrowdloanData(__dirname);

    if (checkExistingFile(CROWDLOAN_DATA_PATH)) {
        const data = loadJSONFile(CROWDLOAN_DATA_PATH);

        let contributions = Object.keys(data.wallets).map((key) => [key, data.wallets[key]['amount']]);
        contributions.sort((first, second) => second[1] - first[1]);

        let html = '<!DOCTYPE html><html><head></head><body><table><thead><tr><td>Contribution #</td><td>Address</td><td>Amount</td></tr></thead><tbody>';
        for (let i = 0; i < contributions.length; ++i) {
            html += `<tr><td>${i + 1}.</td><td>${contributions[i][0]}</td><td>${contributions[i][1]}</td><tr>`;
        }

        html += '</tbody></table></body></html>';
        writeFileSync(HTML_DATA_PATH, html);
    }
}

main();
