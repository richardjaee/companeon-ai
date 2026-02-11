import { TokenData } from './tokens';

/**
 * Base Network Token Addresses
 * Current production token list for Base (Chain ID: 8453)
 */
export const BASE_TOKENS: Record<string, TokenData> = {
  "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2": {
    "symbol": "USDT",
    "name": "Tether USDt",
    "decimals": 6,
    "categories": ["stablecoins"],
    "description": "USD-pegged stablecoin widely used for trading and settlement."
  },
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": {
    "symbol": "USDC",
    "name": "USDC",
    "decimals": 6,
    "categories": ["stablecoins"],
    "description": "Fully reserved dollar stablecoin issued by Circle."
  },
  "0x50c5725949a6f0c72e6c4a641f24049a917db0cb": {
    "symbol": "DAI",
    "name": "Dai",
    "decimals": 18,
    "categories": ["stablecoins","defi-protocols"],
    "description": "Decentralized, overcollateralized USD stablecoin governed by MakerDAO."
  },
  // WETH (Base canonical WETH)
  "0x4200000000000000000000000000000000000006": {
    "symbol": "WETH",
    "name": "Wrapped Ether",
    "decimals": 18,
    "categories": ["layer1-blockchains"],
    "description": "Wrapped Ether on Base used for routing and liquidity."
  },
  // UNI (Base deployment)
  "0xc3de830ea07524a0761646a6a4e4be0e114a3c83": {
    "symbol": "UNI",
    "name": "Uniswap",
    "decimals": 18,
    "categories": ["defi-protocols","dao-governance"],
    "description": "Uniswap governance token on Base."
  },
  // AAVE (Base deployment)
  "0x63706e401c06ac8513145b7687a14804d17f814b": {
    "symbol": "AAVE",
    "name": "Aave",
    "decimals": 18,
    "categories": ["defi-protocols","dao-governance"],
    "description": "Aave governance token on Base."
  },
  "0xbaa5cc21fd487b8fcc2f632f3f4e8d37262a0842": {
    "symbol": "MORPHO",
    "name": "Morpho",
    "decimals": 18,
    "categories": ["defi-protocols"],
    "description": "Governance token for Morpho lending optimization protocol."
  },
  "0x8ee73c484a26e0a5df2ee2a4960b789967dd0415": {
    "symbol": "CRV",
    "name": "Curve DAO Token",
    "decimals": 18,
    "categories": ["defi-protocols","dao-governance"],
    "description": "Governance token for Curve Finance stablecoin AMM."
  },
  "0x2da56acb9ea78330f947bd57c54119debda7af71": {
    "symbol": "MOG",
    "name": "Mog Coin",
    "decimals": 18,
    "categories": ["memecoins"],
    "description": "Community-driven memecoin."
  },
  "0x3992b27da26848c2b19cea6fd25ad5568b68ab98": {
    "symbol": "OM",
    "name": "MANTRA",
    "decimals": 18,
    "categories": ["defi-protocols"],
    "description": "Token for MANTRA ecosystem focused on staking and DeFi."
  },
  "0xbcbaf311cec8a4eac0430193a528d9ff27ae38c1": {
    "symbol": "IOTX",
    "name": "IoTeX",
    "decimals": 18,
    "categories": ["layer1-blockchains"],
    "description": "Token of the IoTeX network focused on IoT and machine economy."
  },
  "0xb008bdcf9cdff9da684a190941dc3dca8c2cdd44": {
    "symbol": "FLUX",
    "name": "Flux",
    "decimals": 8,
    "categories": ["defi-protocols"],
    "description": "Token associated with decentralized compute and infrastructure services."
  },
  "0xf5dbaa3dfc5e81405c7306039fb037a3dcd57ce2": {
    "symbol": "BICO",
    "name": "Biconomy",
    "decimals": 18,
    "categories": ["defi-protocols"],
    "description": "Token for Biconomy multi-chain relayer and account abstraction infrastructure."
  },
  "0x2a06a17cbc6d0032cac2c6696da90f29d39a1a29": {
    "symbol": "BITCOIN",
    "name": "HarryPotterObamaSonic10Inu (ERC-20)",
    "decimals": 8,
    "categories": ["memecoins"],
    "description": "Parody memecoin inspired by internet culture."
  },
  "0xe0cd4cacddcbf4f36e845407ce53e87717b6601d": {
    "symbol": "ICNT",
    "name": "Impossible Cloud Network",
    "decimals": 18,
    "categories": ["defi-protocols"],
    "description": "Token linked to decentralized cloud and storage services."
  },
  "0x259fac10c5cbfefe3e710e1d9467f70a76138d45": {
    "symbol": "CTSI",
    "name": "Cartesi",
    "decimals": 18,
    "categories": ["defi-protocols"],
    "description": "Token for Cartesi's verifiable compute and rollup ecosystem."
  },
  "0x3792dbdd07e87413247df995e692806aa13d3299": {
    "symbol": "OMI",
    "name": "ECOMI",
    "decimals": 18,
    "categories": ["nft","gaming"],
    "description": "Utility token for ECOMI and VeVe NFT ecosystem."
  },
  "0x2c24497d4086490e7ead87cc12597fb50c2e6ed6": {
    "symbol": "F",
    "name": "SynFutures",
    "decimals": 18,
    "categories": ["defi-protocols"],
    "description": "Token for SynFutures decentralized derivatives protocol."
  },
  "0x54330d28ca3357f294334bdc454a032e7f353416": {
    "symbol": "OLAS",
    "name": "Autonolas",
    "decimals": 18,
    "categories": ["infrastructure"],
    "description": "Token for Autonolas network of autonomous agents and services."
  },
  "0xb20a4bd059f5914a2f8b9c18881c637f79efb7df": {
    "symbol": "ADS",
    "name": "Alkimi",
    "decimals": 11,
    "categories": ["defi-protocols"]
  },
  "0x97c806e7665d3afd84a8fe1837921403d59f3dcc": {
    "symbol": "ALI",
    "name": "Artificial Liquid Intelligence",
    "decimals": 18,
    "categories": ["ai-data"],
    "description": "Token for Alethea AI's AI agent and synthetic media ecosystem."
  },
  "0xa7d68d155d17cb30e311367c2ef1e82ab6022b67": {
    "symbol": "BTRST",
    "name": "Braintrust",
    "decimals": 18,
    "categories": ["dao-governance"],
    "description": "Governance token for Braintrust decentralized talent network."
  },
  "0x7002458b1df59eccb57387bc79ffc7c29e22e6f7": {
    "symbol": "OGN",
    "name": "Origin Protocol",
    "decimals": 18,
    "categories": ["defi-protocols"],
    "description": "Token for Origin Protocol's commerce and DeFi products."
  },
  "0x37f0c2915cecc7e977183b8543fc0864d03e064c": {
    "symbol": "HUNT",
    "name": "Hunt Town",
    "decimals": 18,
    "categories": ["gaming"]
  },
  "0x7588310a7abf34dc608ac98a1c4432f85e194df5": {
    "symbol": "FORT",
    "name": "Forta",
    "decimals": 18,
    "categories": ["defi-protocols"],
    "description": "Token for Forta network security and real-time threat monitoring."
  },
  "0x24fcfc492c1393274b6bcd568ac9e225bec93584": {
    "symbol": "MAVIA",
    "name": "Heroes of Mavia",
    "decimals": 18,
    "categories": ["gaming"],
    "description": "Gaming token for Heroes of Mavia strategy game."
  },
  "0xf732a566121fa6362e9e0fbdd6d66e5c8c925e49": {
    "symbol": "LITKEY",
    "name": "Lit Protocol",
    "decimals": 18,
    "categories": ["gaming"],
    "description": "Token associated with Lit Protocol's decentralized key and access control."
  },
  "0xcd2f22236dd9dfe2356d7c543161d4d260fd9bcb": {
    "symbol": "GHST",
    "name": "Aavegotchi",
    "decimals": 18,
    "categories": ["gaming","nft"],
    "description": "Utility/governance token for Aavegotchi NFT gaming ecosystem."
  },
  "0x6fbf03efa4363ca0afe0c9c3906f7d610890b683": {
    "symbol": "GAIA",
    "name": "GAIA",
    "decimals": 18,
    "categories": ["gaming"]
  },
  "0xc48823ec67720a04a9dfd8c7d109b2c3d6622094": {
    "symbol": "MCADE",
    "name": "Metacade",
    "decimals": 18,
    "categories": ["gaming"],
    "description": "Community gaming and metaverse hub token."
  },
  "0x570b1533f6daa82814b25b62b5c7c4c55eb83947": {
    "symbol": "BOBO",
    "name": "BOBO",
    "decimals": 18,
    "categories": ["memecoins"],
    "description": "Community-driven memecoin."
  },
  "0xb1e1f3cc2b6fe4420c1ac82022b457018eb628ff": {
    "symbol": "CXT",
    "name": "Covalent X Token",
    "decimals": 18,
    "categories": ["defi-protocols"],
    "description": "Token linked to Covalent data and indexing ecosystem."
  },
  "0xddb293bb5c5258f7484a94a0fbd5c8b2f6e4e376": {
    "symbol": "BKN",
    "name": "Brickken",
    "decimals": 18,
    "categories": ["defi-protocols"],
    "description": "Tokenization platform for businesses and real-world assets."
  },
  "0x5eaa326fb2fc97facce6a79a304876dad0f2e96c": {
    "symbol": "DIMO",
    "name": "DIMO",
    "decimals": 18,
    "categories": ["analytics"],
    "description": "Mobility data protocol enabling vehicle data ownership and monetization."
  },
  "0xdae49c25fad3a62a8e8bfb6da12c46be611f9f7a": {
    "symbol": "KRL",
    "name": "Kryll",
    "decimals": 18,
    "categories": ["defi-protocols"],
    "description": "Token for Kryll automated trading strategies platform."
  },
  "0xbb22ff867f8ca3d5f2251b4084f6ec86d4666e14": {
    "symbol": "CTX",
    "name": "Cryptex Finance",
    "decimals": 18,
    "categories": ["defi-protocols"],
    "description": "Token for Cryptex Finance synthetic crypto index products."
  },
  "0x2192607c3cba9ec3d490206d10d831e68e5f3c97": {
    "symbol": "BOSON",
    "name": "Boson Protocol",
    "decimals": 18,
    "categories": ["metaverse"],
    "description": "Commerce protocol connecting physical products to on-chain commerce."
  },
  "0xc7dcca0a3e69bd762c8db257f868f76be36c8514": {
    "symbol": "KIBSHI",
    "name": "KiboShib",
    "decimals": 18,
    "categories": ["memecoins"],
    "description": "Community memecoin."
  },
  "0x681a09a902d9c7445b3b1ab282c38d60c72f1f09": {
    "symbol": "AIKEK",
    "name": "Alphakek AI",
    "decimals": 18,
    "categories": ["memecoins"],
    "description": "Memecoin with AI-themed branding."
  },
  "0x27e3bc3a66e24cad043ac3d93a12a8070e3897ba": {
    "symbol": "OVR",
    "name": "OVR",
    "decimals": 18,
    "categories": ["metaverse"],
    "description": "Token for Over the Reality AR/metaverse platform."
  },
  "0x321725ee44cb4bfa544cf45a5a585b925d30a58c": {
    "symbol": "GROW",
    "name": "ValleyDAO",
    "decimals": 18,
    "categories": ["dao-governance"],
    "description": "ValleyDAO token for decentralized biotech and climate research funding."
  },
  "0xb676f87a6e701f0de8de5ab91b56b66109766db1": {
    "symbol": "LRDS",
    "name": "BLOCKLORDS",
    "decimals": 18,
    "categories": ["gaming"],
    "description": "Gaming token for BLOCKLORDS strategy game ecosystem."
  },
  "0xd85eff20288ca72ea9eecffb428f89ee5066ca5c": {
    "symbol": "ISK",
    "name": "ISKRA Token",
    "decimals": 18,
    "categories": ["gaming"],
    "description": "Token for ISKRA Web3 gaming platform."
  },
  "0x18bc5bcc660cf2b9ce3cd51a404afe1a0cbd3c22": {
    "symbol": "IDRX",
    "name": "IDRX",
    "decimals": 2,
    "categories": ["stablecoins"],
    "description": "Fiat-pegged stablecoin."
  }
};
