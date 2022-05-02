use futures::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json;
use std::collections::HashMap;
use std::fs::File;
use subxt::{
    sp_core::crypto::{Ss58AddressFormat, Ss58Codec},
    ClientBuilder, DefaultConfig, Phase, PolkadotExtrinsicParams,
};

#[subxt::subxt(
    runtime_metadata_path = "./metadata/polkadot_metadata.scale",
    derive_for_all_types = "Clone, PartialEq, Eq, Debug",
    derive_for_type(type = "frame_support::PalletId", derive = "Eq, Ord, PartialOrd"),
    derive_for_type(type = "sp_runtime::ModuleError", derive = "Eq, Hash"),
    derive_for_type(type = "sp_core", derive = "Eq, Hash, Clone, Debug")
)]
pub mod polkadot {}

#[derive(Serialize, Deserialize, Debug)]
struct WalletInfo {
    para_id: u32,
    extrinsic_id: Vec<String>,
    amount: u128,
    total_contributions: u32,
}

#[derive(Serialize, Deserialize, Debug)]

struct AuctionInfo {
    wallets: HashMap<String, WalletInfo>,
    total_transactions: u32,
    total_dots_contributed: u128,
}

impl AuctionInfo {
    fn default() -> Self {
        Self {
            wallets: HashMap::<String, WalletInfo>::new(),
            total_dots_contributed: 0,
            total_transactions: 0,
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    env_logger::init();

    let api = ClientBuilder::new()
        .set_url("wss://rpc.polkadot.io:443")
        .build()
        .await?
        .to_runtime_api::<polkadot::RuntimeApi<DefaultConfig, PolkadotExtrinsicParams<DefaultConfig>>>();

    let mut block_init: u32 = 9743944;
    let block_end = 10881400;

    let mut data = AuctionInfo::default();

    let mut con = 0;
    while block_init <= block_end {
        let block_hash = api.client.rpc().block_hash(Some(block_init.into())).await?;

        let event = api.events().at(block_hash.unwrap()).await?;

        for ev in event.iter_raw() {
            let event_data = ev.as_ref().unwrap().clone();
            if event_data.pallet == "Crowdloan" && event_data.variant == "Contributed" {
                let info = event_data
                    .as_event::<polkadot::crowdloan::events::Contributed>()
                    .unwrap()
                    .unwrap();
                let para_id = info.1;

                if para_id.0 == 2040 {
                    let address_format = Ss58AddressFormat::custom(0);
                    let sender = info.0.to_ss58check_with_version(address_format);
                    let amount = info.2 / (10_u128.pow(10_u32));

                    let extrinsic_index = &event_data.phase;
                    let ext_idx: Option<&u32> = if let Phase::ApplyExtrinsic(idx) = &extrinsic_index
                    {
                        Some(idx)
                    } else {
                        None
                    };
                    let extrinsic_id = format!("{}-{}", block_init, ext_idx.unwrap());

                    if !data.wallets.contains_key(&sender) {
                        data.wallets.insert(
                            sender.clone(),
                            WalletInfo {
                                para_id: para_id.0,
                                extrinsic_id: vec![extrinsic_id],
                                amount: amount,
                                total_contributions: 1,
                            },
                        );

                        print!(
                            "✅ #({}) New contribution in Block_number: #({}) INFO: ",
                            data.total_transactions, block_init
                        );
                        print!(
                            "extrinsicId: {:?} ",
                            data.wallets.get(&sender).unwrap().extrinsic_id
                        );
                        print!("sender: {} ", sender);
                        print!("para_id: {} ", para_id.0);
                        println!("Amount: {:?} DOTs", amount);
                    } else {
                        data.wallets.get_mut(&sender).map(|v| {
                            v.extrinsic_id.push(extrinsic_id);
                            v.amount += amount;
                            v.total_contributions += 1;
                        });
                        print!(
                            "🔄 #({}) Update contribution in Block_number: #({}) INFO: ",
                            data.total_transactions, block_init
                        );
                        print!(
                            "extrinsicId: {:?} ",
                            data.wallets.get(&sender).unwrap().extrinsic_id
                        );
                        print!("sender: {} ", sender);
                        print!("para_id: {} ", para_id.0);
                        println!("Amount: {:?} DOTs", amount);
                    }
                    data.total_transactions += 1;
                    data.total_dots_contributed += amount;

                    con += 1;
                }
            }
        }
        if con == 100 {
            serde_json::to_writer_pretty(&File::create("data.json")?, &data)?;
            break;
        }
        block_init += 1;
    }

    Ok(())
}
