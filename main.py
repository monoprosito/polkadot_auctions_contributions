#!venv/bin/python3
from substrateinterface import SubstrateInterface
import json

PDEX_FOUND_ADDRESS = "13UVJyLnbVp77Z2t6qjFmcyzTXYQJjyb6Hww7ZHPumd81iht"
AUCTION_NAME = 'Polkadex'
PARA_ID = 2040

if __name__ == "__main__":
    substrate = SubstrateInterface(
        url="wss://rpc.polkadot.io",
        ss58_format=0,
        type_registry_preset='polkadot'
    )

    block_init = 9743944
    block_end = 10881400

    data = {
        'wallets': {},
        'total_transactions': 0,
        'total_contributed': 0
    }

    symbol = substrate.token_symbol

    while block_init <= substrate.get_block_header()['header'].get('number'):

        block_hash = substrate.get_block_hash(block_id=block_init)
        data_events = substrate.get_events(block_hash)

        for event in data_events:
            if event.value.get('module_id') == 'Crowdloan':
                if event.value.get('event').get('attributes')[1] == PARA_ID:
                    sender = event.value.get('event').get('attributes')[0]
                    para_id = event.value.get('event').get('attributes')[1]
                    amount = event.value.get('event').get('attributes')[2] / 10 ** substrate.token_decimals
                    extrinsic_id = '{}-{}'.format(str(block_init), event.value.get('extrinsic_idx'))

                    if sender not in data['wallets'].keys():
                        data['wallets'][sender] = {
                            'para_id': para_id,
                            'amount': amount,
                            'extrinsic_id': [extrinsic_id],
                            'total_contributions': 1,
                            'block_hash': [block_hash]
                        }
                        data['total_transactions'] += 1
                        data['total_contributed'] += amount

                        print(f"{data['total_transactions']}- New contribution found at block: ", end='')
                        print(f"(#{block_init}) data: ({sender}, {amount} {symbol},", end='')
                        print(f"extrinsicID: {extrinsic_id}) DOTs raised: {data['total_contributed']}")
                    else:
                        data['wallets'][sender]['amount'] += amount
                        data['wallets'][sender]['extrinsic_id'].append(extrinsic_id)
                        data['wallets'][sender]['total_contributions'] += 1
                        data['total_transactions'] += 1
                        data['wallets'][sender]['block_hash'].append(block_hash)
                        data['total_contributed'] += amount

                        print(f"{data['total_transactions']}- Updating contribution data at:  ", end='')
                        print(f"(#{block_init}) wallet: {sender} with new amount: {amount} {symbol},", end='')
                        print(f"extrinsicID: {extrinsic_id}) DOTs raised: {data['total_contributed']}")

        if block_init == block_end:
            break
        block_init += 1

    with open(f'{AUCTION_NAME}_crowdloan.json', 'w+') as f:
        json.dump(data, f)
