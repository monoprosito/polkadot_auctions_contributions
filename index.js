// import { ApiPromise, WsProvider } from '@polkadot/api';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';


const NETWORK_NAME = 'polkadot';
const SUBSCAN_API_ENDPOINT = `https://${NETWORK_NAME}.api.subscan.io`;
const SUBSCAN_API_KEY = '80cf9967908e942ff4f7acb43165595c';
const POLKADEX_FUND_ACCOUNT = '13UVJyLnbVp77Z2t6qjFmcyzTXYQJjyb6Hww7ZHPumd81iht';


function scrapeCrowdloanData () {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const CROWDLOAN_DATA_PATH = path.join(__dirname, 'crowdloan_data.json');
    const LAST_BLOCK_NUMBER_PATH = path.join(__dirname, 'last_block_number.json');
    const TRANSFERS_ENDPOINT = '/api/scan/transfers';
    // const API_ENDPOINT = `${SUBSCAN_API_ENDPOINT}${TRANSFERS_ENDPOINT}`;
    const POLKADEX_PARA_ID = 2040;
    const POLKADEX_GENESIS_BLOCK_NUMBER = 9743944;
    const POLKADEX_LAST_BLOCK_NUMBER = 10881400;
    // const rowsPerPage = 100;
    const rowsPerPage = 1;

    let data = {};
    let currentPage = 0;
    let totalPages = 0;
    let lastBlockNumber = POLKADEX_GENESIS_BLOCK_NUMBER;

    // Load JSON data if exists
    if (checkExistingJSON(CROWDLOAN_DATA_PATH)) {
        data = loadJSON(CROWDLOAN_DATA_PATH);
    } else {
        data = {
            'auction': 'Polkadex',
            'wallets': {},
            'total_transactions': 0,
            'total_contributed': 0
        };
    }

    const subscanApi = axios.create({
        baseURL: SUBSCAN_API_ENDPOINT,
        headers: {
            'X-API-Key': SUBSCAN_API_KEY,
            'Content-Type': 'application/json'
        }
    })

    if (checkExistingJSON(LAST_BLOCK_NUMBER_PATH)) {
        lastBlockNumber = loadJSON(LAST_BLOCK_NUMBER_PATH).lastBlockNumber;
        console.log(`Loaded: ${lastBlockNumber}`);
    }

    subscanApi.post(TRANSFERS_ENDPOINT, {
            address: POLKADEX_FUND_ACCOUNT,
            row: rowsPerPage,
            page: 0,
            from_block: lastBlockNumber,
            to_block: POLKADEX_LAST_BLOCK_NUMBER
        })
        .then((response) => {
            totalPages = response.data.data.count / rowsPerPage;
            const transfers = response.data.data.transfers;

            for (const transfer of transfers) {
                const sender = transfer.from;
                const amount = parseFloat(transfer.amount);

                data['total_transactions'] += 1;
                data['total_contributed'] += amount;

                if (Object.keys(data.wallets).includes(sender)) {
                    data.wallets[sender]['amount'] += amount;
                    data.wallets[sender]['total_contributions'] += 1;
                    data.wallets[sender]['blocks'].push({
                        'block_hash': transfer.hash,
                        'block_number': transfer.block_num
                    })

                    console.log(`${data['total_transactions']}. Actualizando contribución de (${sender}) en el bloque #${transfer.block_num}:`);
                    console.log(`Sender Total Amount: ${data.wallets[sender]['amount']} DOTs`);
                    console.log(`Auction Total Amount: ${data['total_contributed']} DOTs`);
                } else {
                    data.wallets[sender] = {
                        'para_id': POLKADEX_PARA_ID,
                        'amount': amount,
                        'total_contributions': 1,
                        'blocks': [{
                            'block_hash': transfer.hash,
                            'block_number': transfer.block_num
                        }]
                    }
                    console.log(`${data['total_transactions']}. Nueva contribución en el bloque #${transfer.block_num}:`);
                    console.log(`Sender (${sender}) - Amount (${amount} DOTs)`);
                    console.log(`Auction Total Amount: ${data['total_contributed']} DOTs`);
                }

                lastBlockNumber = transfer.block_num;
                writeJSON(CROWDLOAN_DATA_PATH, data);

                // verificar que el bloquie desde el cua lse empieza ya existe
                // para no almacenarlo
            }
        })
        .catch((err) => {
            console.log('Identified error');
            console.log(err);
            console.log(`Current page: ${currentPage}`);
        })
        .finally(() => {
            writeJSON(LAST_BLOCK_NUMBER_PATH, {
                lastBlockNumber: lastBlockNumber
            });
        });
}


function loadJSON(path) {
    const rawData = fs.readFileSync(path);
    const data = JSON.parse(rawData);
    return data;
}


function writeJSON(path, data) {
    const parsedData = JSON.stringify(data);
    fs.writeFileSync(path, parsedData);
}


function checkExistingJSON(path) {
    return fs.existsSync(path);
}

scrapeCrowdloanData();
