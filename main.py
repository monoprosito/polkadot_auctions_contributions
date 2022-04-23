import json
import typing
from substrateinterface import SubstrateInterface

AUCTION_NAME = 'Polkadex'
MAX_BLOCKS_TO_QUERY = 5
AUCTION_GENESIS_BLOCK_ID = 9743944

POLKADEX_FOUND_ADDRESS = '13UVJyLnbVp77Z2t6qjFmcyzTXYQJjyb6Hww7ZHPumd81iht'
PARALLEL_ADDRESS = ''
BIFROST_ADDRESS = ''


def is_a_crowdloan_extrinsic(extrinsic: dict) -> bool:
    return extrinsic.value.get('call').get('call_module') == 'Crowdloan'

def get_crowdloan_extrinsic_v2(extrinsic: dict) -> typing.Optional[dict]:
    main_module = extrinsic.value.get('call')

    if main_module.get('call_module') == 'Utility':
        calls = main_module.get('call_args')[0].get('value')
        for call in calls:
            if call.get('call_module') == 'Proxy':
                proxy_calls = call.get('call_args')
                for proxy_call in proxy_calls:
                    if (proxy_call.get('type') == 'Call' and
                        proxy_call.get('value').get('call_module') == 'Crowdloan'
                        ):
                        return proxy_call.get('value')

    return None


def get_arg_from_extrinsic(extrinsic_args: list, arg_type: str) -> dict:
    if isinstance(extrinsic_args, list):
        for ext_arg in extrinsic_args:
            if ext_arg.get('type') == arg_type:
                return ext_arg


if __name__ == '__main__':
    substrate = SubstrateInterface(
        url="wss://rpc.polkadot.io"
    )

    block_id = AUCTION_GENESIS_BLOCK_ID

    # Retrieve genesis block
    block = substrate.get_block(block_number=AUCTION_GENESIS_BLOCK_ID)

    data = {
        'auction': AUCTION_NAME,
        'addresses': {}
    }

    # Explore block extrinsics
    processed_blocks_num = 0
    while block:
        for ext_idx in range(len(block['extrinsics'])):
            extrinsic = block['extrinsics'][ext_idx]
            crowdloan_extrinsic_identified = False

            if is_a_crowdloan_extrinsic(extrinsic):
                crowdloan_extrinsic_identified = True
                extrinsic_data = extrinsic.value
                extrinsic_args = extrinsic_data.get('call').get('call_args')

            if not crowdloan_extrinsic_identified:
                extrinsic_data = get_crowdloan_extrinsic_v2(extrinsic)
                if not isinstance(extrinsic_data, dict):
                    continue

                crowdloan_extrinsic_identified = True
                extrinsic_args = extrinsic_data.get('call_args')

            if not crowdloan_extrinsic_identified:
                block_id += 1
                block = substrate.get_block(block_number=block_id)
                continue

            extrinsic_account_sender_address = extrinsic.value.get('address')

            ext_paraid_arg = get_arg_from_extrinsic(
                extrinsic_args, 'ParaId')
            if (isinstance(ext_paraid_arg, dict) and
                ext_paraid_arg.get('value') == 2040):
                if substrate.retrieve_extrinsic_by_identifier(
                        f'{block_id}-{ext_idx}').is_success:
                    if extrinsic_account_sender_address not in data['addresses'].keys():
                        data['addresses'][extrinsic_account_sender_address] = {}

                    ext_balance_arg = get_arg_from_extrinsic(
                        extrinsic_args, 'BalanceOf')
                    extrinsic_balance = (
                        ext_balance_arg.get('value') / 10 **
                        substrate.token_decimals)

                    if 'total_dots' in data['addresses'][extrinsic_account_sender_address].keys():
                        data['addresses'][extrinsic_account_sender_address][f'total_{substrate.token_symbol.lower()}'] += extrinsic_balance
                    else:
                        data['addresses'][extrinsic_account_sender_address][f'total_{substrate.token_symbol.lower()}'] = extrinsic_balance

                    if 'total_contributions' in data['addresses'][extrinsic_account_sender_address].keys():
                        data['addresses'][extrinsic_account_sender_address]['total_contributions'] += 1
                    else:
                        data['addresses'][extrinsic_account_sender_address]['total_contributions'] = 1

                    if 'blocks' in data['addresses'][extrinsic_account_sender_address].keys():
                        data['addresses'][extrinsic_account_sender_address]['blocks'].append({
                            'block_hash': block.get('header').get('hash'),
                            'block_number': block.get('header').get('number'),
                            'extrinsics': [
                                extrinsic.value.get('extrinsic_hash')
                            ]
                        })
                    else:
                        data['addresses'][extrinsic_account_sender_address]['blocks'] = []
                        data['addresses'][extrinsic_account_sender_address]['blocks'].append({
                            'block_hash': block.get('header').get('hash'),
                            'block_number': block.get('header').get('number'),
                            'extrinsics': [
                                extrinsic.value.get('extrinsic_hash')
                            ]
                        })

                    processed_blocks_num += 1
                    print(f'{processed_blocks_num}. {AUCTION_NAME} block (#{block_id}) found.')
                    print(f'Account Sender Address: {extrinsic_account_sender_address}')
                    print(f'Balance: {round(extrinsic_balance, 3)} {substrate.token_symbol}', end='\n\n')

        if processed_blocks_num == MAX_BLOCKS_TO_QUERY:
            break

        block_id += 1
        block = substrate.get_block(block_number=block_id)

    with open(f'{AUCTION_NAME}_blocks.json', 'w+') as f:
        json.dump(data, f)
