import { ApiPromise, WsProvider } from '@polkadot/api';

async function main () {
    // initialise via static create
    const wsProvider = new WsProvider('wss://rpc.polkadot.io');
    const api = await ApiPromise.create({ provider: wsProvider });

    const selectedParaId = 2040;
    const genesisBlock = 9743944;
    const lastBlock = 10881400;
    const encodedStorageKey = '0x3d9cad2baf702e20b136f4c8900cd802b6f9671a19ef28ecb1e331fea30290980f474ee85a3cd622f8070000';

    let data = {
        'auction': 'Polkadex',
        'wallets': {},
        'total_transactions': 0,
        'total_contributed': 0
    };
    let currentBlock = genesisBlock;

    // while (currentBlock <= api.rpc.chain.getHeader((header) => header.number)) {
    while (currentBlock <= lastBlock) {
        const blockHash = await api.rpc.chain.getBlockHash(currentBlock);
        const signedBlock = await api.rpc.chain.getBlock(blockHash);
        const allRecords = await api.query.system.events.at(signedBlock.block.header.hash);

        allRecords
        .forEach(({ event }) => {
            if (event.section == 'crowdloan') {
                let [ sender, paraId, amount ] = event.data.toJSON();
                if (paraId === selectedParaId) {
                    amount = amount / 10 ** 10;
                    data['total_transactions'] += 1;
                    data['total_contributed'] += amount;

                    if (Object.keys(data.wallets).includes(sender)) {
                        data.wallets[sender]['amount'] += amount;
                        data.wallets[sender]['total_contributions'] += 1;
                        data.wallets[sender]['blocks'].push({
                            'block_hash': signedBlock.block.header.hash,
                            'block_number': currentBlock
                        })

                        console.log(`${data['total_transactions']}. Actualizando contribución de (${sender}) en el bloque #${currentBlock}:`);
                        console.log(`Sender Total Amount: ${data.wallets[sender]['amount']} DOTs`);
                        console.log(`Auction Total Amount: ${data['total_contributed']} DOTs`);
                    } else {
                        data.wallets[sender] = {
                            'para_id': paraId,
                            'amount': amount,
                            'total_contributions': 1,
                            'blocks': [
                                {
                                    'block_hash': signedBlock.block.header.hash,
                                    'block_number': currentBlock
                                }
                            ]
                        }
                        console.log(`${data['total_transactions']}. Nueva contribución en el bloque #${currentBlock}:`);
                        console.log(`Sender (${sender}) - Amount (${amount} DOTs)`);
                        console.log(`Auction Total Amount: ${data['total_contributed']} DOTs`);
                    }
                }
            }
        });

        currentBlock += 1;
    }
}

main()
