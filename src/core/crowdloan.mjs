import axios from 'axios';
import { checkExistingFile, loadJSONFile, writeJSONFile } from './fs.mjs';
import { delay } from '../utils/utils.mjs';
import { env, exit } from 'process';

const NETWORK_NAME = 'polkadot';
const SUBSCAN_API_ENDPOINT = `https://${NETWORK_NAME}.api.subscan.io`;
const POLKADEX_FUND_ACCOUNT = '13UVJyLnbVp77Z2t6qjFmcyzTXYQJjyb6Hww7ZHPumd81iht';

export async function scrapeCrowdloanData (base_dir) {
    const SUBSCAN_API_KEY = env.SUBSCAN_API_KEY;
    const CROWDLOAN_DATA_PATH = `${base_dir}/export/crowdloan_data.json`;
    const LAST_BLOCK_NUMBER_PATH = `${base_dir}/export/last_block_number.json`;
    const TRANSFERS_ENDPOINT = '/api/scan/transfers';
    const POLKADEX_PARA_ID = 2040;
    const POLKADEX_GENESIS_BLOCK_NUMBER = 9743944;
    const rowsPerPage = 25;

    let data = {};
    let lastCrowdloanBlockNumber = 0;
    let lastBlockNumber = POLKADEX_GENESIS_BLOCK_NUMBER;

    if (checkExistingFile(CROWDLOAN_DATA_PATH)) {
        data = loadJSONFile(CROWDLOAN_DATA_PATH);
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

    if (checkExistingFile(LAST_BLOCK_NUMBER_PATH)) {
        lastBlockNumber = loadJSONFile(LAST_BLOCK_NUMBER_PATH).lastBlockNumber;
        console.log(`Last Block Number loaded. Starting from block #${lastBlockNumber}`);
        lastBlockNumber += 1;
    }

    try {
        const lastCrowdloanResponse = await subscanApi.post(TRANSFERS_ENDPOINT, {
            address: POLKADEX_FUND_ACCOUNT,
            row: 1,
            page: 0
        });

        lastCrowdloanBlockNumber = lastCrowdloanResponse.data.data.transfers[0].block_num;
        console.log(`Getting info until Crowdloan Block #${lastCrowdloanBlockNumber}`);
    } catch (error) {
        console.log('ERROR: Last Crowdloan Block Number not fetched.')
        process.exit(1);
    }

    while (lastBlockNumber <= lastCrowdloanBlockNumber) {
        try {
            const transfersResponse = await subscanApi.post(TRANSFERS_ENDPOINT, {
                address: POLKADEX_FUND_ACCOUNT,
                row: rowsPerPage,
                page: 0,
                from_block: lastBlockNumber,
                to_block: lastBlockNumber + 10
            });
            const transfers = transfersResponse.data.data.transfers;

            if (!(transfers instanceof Array)) {
                await delay(1000);
                lastBlockNumber += 11;
                continue
            }

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

                    console.log(`${data['total_transactions']}. Updating contribution of (${sender}) in the block #${transfer.block_num}:`);
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
                    console.log(`${data['total_transactions']}. New contribution in the block #${transfer.block_num}:`);
                    console.log(`Sender (${sender}) - Amount (${amount} DOTs)`);
                    console.log(`Auction Total Amount: ${data['total_contributed']} DOTs`);
                }

                writeJSONFile(CROWDLOAN_DATA_PATH, data);
            }
        } catch (error) {
            console.log('Identified error');
            console.log(error);
            console.log(`Last Block Number: ${lastBlockNumber}`);
            exit(1);
        }

        writeJSONFile(LAST_BLOCK_NUMBER_PATH, {
            lastBlockNumber: lastBlockNumber
        });

        await delay(1000);
        lastBlockNumber += 11;
    }
}
