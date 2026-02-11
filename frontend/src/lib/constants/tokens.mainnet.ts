import { TokenData } from './tokens';

/**
 * Ethereum Mainnet Token Addresses
 * Restored from pre-Base migration (Chain ID: 1)
 */
export const MAINNET_TOKENS: Record<string, TokenData> = {
  '0xdac17f958d2ee523a2206206994597c13d831ec7': { 
    symbol: 'USDT', 
    name: 'Tether USD',
    decimals: 6,
    categories: ['stablecoins'],
    description: 'Leading USD-pegged stablecoin for trading and DeFi applications'
  },
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { 
    symbol: 'USDC', 
    name: 'USD Coin',
    decimals: 6,
    categories: ['stablecoins'],
    description: 'Fully reserved dollar digital currency regulated by US financial institutions'
  },
  '0x0000000000085d4780b73119b644ae5ecd22b376': { 
    symbol: 'TUSD', 
    name: 'TrueUSD',
    decimals: 18,
    categories: ['stablecoins'],
    description: 'USD-pegged stablecoin backed by real-world assets'
  },
  '0x0001a500a6b18995b03f44bb040a5ffc28e45cb0': { 
    symbol: 'OLAS', 
    name: 'Autonolas',
    decimals: 18,
    categories: ['ai-data', 'infrastructure'],
    description: 'Token for autonomous AI agent services and decentralized coordination'
  },
  '0x04fa0d235c4abf4bcf4787af4cf447de572ef828': { 
    symbol: 'UMA', 
    name: 'UMA Voting Token v1',
    decimals: 18,
    categories: ['defi-protocols', 'derivatives'],
    description: 'Governance token for UMA protocol enabling synthetic asset creation'
  },
  '0x06450dee7fd2fb8e39061434babcfc05599a6fb8': { 
    symbol: 'XEN', 
    name: 'XEN Crypto',
    decimals: 18,
    categories: ['memecoins'],
    description: 'Community-driven cryptocurrency with controversial tokenomics and minting mechanism'
  },
  '0x090185f2135308bad17527004364ebcc2d37e5f6': { 
    symbol: 'SPELL', 
    name: 'Spell Token',
    decimals: 18,
    categories: ['defi-protocols'],
    description: 'Governance token for Abracadabra Money lending protocol with magic internet money'
  },
  '0x0b38210ea11411557c13457d4da7dc6ea731b88a': { 
    symbol: 'API3', 
    name: 'API3',
    decimals: 18,
    categories: ['infrastructure', 'ai-data'],
    description: 'Decentralized API services connecting real-world data to blockchain applications'
  },
  '0x0bb217e40f8a5cb79adf04e1aab60e5abd0dfc1e': { 
    symbol: 'SWFTC', 
    name: 'SwftCoin',
    decimals: 8,
    categories: ['payments'],
    description: 'Token for SWFT Blockchain cross-chain exchange and payment services'
  },
  '0xbe9895146f7af43049ca1c1ae358b0541ea49704': { 
    symbol: 'cbETH', 
    name: 'Coinbase Wrapped Staked ETH 2.97% APY',
    decimals: 18,
    categories: ['liquid-staking'],
    description: 'Liquid staking token representing ETH staked through Coinbase'
  },
  '0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e': { 
    symbol: 'YFI', 
    name: 'yearn.finance',
    decimals: 18,
    categories: ['defi-protocols', 'dao-governance'],
    description: 'Governance token for Yearn Finance, automated yield farming protocol'
  },
  '0x0c7d5ae016f806603cb1782bea29ac69471cab9c': { 
    symbol: 'BFC', 
    name: 'Bifrost',
    decimals: 18,
    categories: ['layer2-scaling'],
    description: 'Token for Bifrost cross-chain bridge and parachain infrastructure'
  },
  '0x0d438f3b5175bebc262bf23753c1e53d03432bde': { 
    symbol: 'wNXM', 
    name: 'Wrapped NXM',
    decimals: 18,
    categories: ['defi-protocols'],
    description: 'Wrapped version of Nexus Mutual insurance protocol token for DeFi coverage'
  },
  '0x0d8775f648430679a709e98d2b0cb6250d2887ef': { 
    symbol: 'FIL', 
    name: 'Filecoin',
    decimals: 18,
    categories: ['layer1-blockchains', 'infrastructure'],
    description: 'Native token of Filecoin decentralized storage network'
  },
  '0x0f2d719407fdbeff09d87557abb7232601fd9f29': { 
    symbol: 'SYN', 
    name: 'Synapse',
    decimals: 18,
    categories: ['layer2-scaling', 'infrastructure'],
    description: 'Cross-chain bridge protocol connecting various blockchain networks'
  },
  '0x0f51bb10119727a7e5ea3538074fb341f56b09ad': { 
    symbol: 'DAO', 
    name: 'DAO Maker',
    decimals: 18,
    categories: ['dao-governance'],
    description: 'Token for DAO Maker launchpad and venture capital ecosystem'
  },
  '0x0f5d2fb29fb7d3cfee444a200298f468908cc942': { 
    symbol: 'MANA', 
    name: 'Decentraland MANA',
    decimals: 18,
    categories: ['gaming-metaverse', 'nft-ecosystem'],
    description: 'Native currency of Decentraland virtual world for land and asset trading'
  },
  '0x0fd10b9899882a6f2fcb5c371e17e70fdee00c38': { 
    symbol: 'PUNDIX', 
    name: 'Pundi X Token',
    decimals: 18,
    categories: ['payments'],
    description: 'Token for Pundi X blockchain-based point-of-sale payment ecosystem'
  },
  '0x10dea67478c5f8c5e2d90e5e9b26dbe60c54d800': { 
    symbol: 'TAIKO', 
    name: 'Taiko Token',
    decimals: 18,
    categories: ['layer2-scaling'],
    description: 'Token for Taiko Ethereum-equivalent ZK-rollup scaling solution'
  },
  '0x111111111117dc0aa78b770fa6a738034120c302': { 
    symbol: '1INCH', 
    name: '1INCH Token',
    decimals: 18,
    categories: ['defi-protocols', 'dao-governance'],
    description: 'Governance token for 1inch Network, a DEX aggregator protocol'
  },
  '0x1151cb3d861920e07a38e03eead12c32178567f6': { 
    symbol: 'Bonk', 
    name: 'Bonk',
    decimals: 5,
    categories: ['memecoins'],
    description: 'Community-driven memecoin originally from Solana, bridged to Ethereum'
  },
  '0x11eef04c884e24d9b7b4760e7476d06ddf797f36': { 
    symbol: 'MX', 
    name: 'MX Token',
    decimals: 18,
    categories: ['exchange-tokens'],
    description: 'Utility token for MEXC exchange providing trading benefits and governance'
  },
  '0x1258d60b224c0c5cd888d37bbf31aa5fcfb7e870': { 
    symbol: 'GPU', 
    name: 'NodeAI',
    decimals: 18,
    categories: ['ai-data', 'infrastructure'],
    description: 'Token for NodeAI network providing decentralized GPU computing for AI workloads'
  },
  '0x12970e6868f88f6557b76120662c1b3e50a646bf': { 
    symbol: 'LADYS', 
    name: 'Milady',
    decimals: 18,
    categories: ['memecoins'],
    description: 'Meme token inspired by the Milady NFT collection and internet culture'
  },
  '0x12bb890508c125661e03b09ec06e404bc9289040': { 
    symbol: 'RACA', 
    name: 'Radio Caca V2',
    decimals: 18,
    categories: ['gaming-metaverse'],
    description: 'Token for Radio Caca metaverse gaming ecosystem and NFT marketplace'
  },
  '0x137ddb47ee24eaa998a535ab00378d6bfa84f893': { 
    symbol: 'RDNT', 
    name: 'Radiant',
    decimals: 18,
    categories: ['defi-protocols'],
    description: 'Governance token for Radiant Capital cross-chain lending protocol'
  },
  '0x163f8c2467924be0ae7b5347228cabf260318753': { 
    symbol: 'WLD', 
    name: 'Worldcoin',
    decimals: 18,
    categories: ['ai-data', 'social-content'],
    description: 'Token for Worldcoin\'s human identity verification using AI and biometrics'
  },
  '0x1776e1f26f98b1a5df9cd347953a26dd3cb46671': { 
    symbol: 'NMR', 
    name: 'Numeraire',
    decimals: 18,
    categories: ['ai-data', 'prediction-markets'],
    description: 'Token for Numerai hedge fund using machine learning for stock market predictions'
  },
  '0x18084fba666a33d37592fa2633fd49a74dd93a88': { 
    symbol: 'tBTC', 
    name: 'tBTC v2',
    decimals: 18,
    categories: ['infrastructure'],
    description: 'Decentralized Bitcoin bridge token backed by real Bitcoin reserves'
  },
  '0x18aaa7115705e8be94bffebde57af9bfc265b998': { 
    symbol: 'AUDIO', 
    name: 'Audius',
    decimals: 18,
    categories: ['social-content'],
    description: 'Token for Audius decentralized music streaming and artist platform'
  },
  '0x193f4a4a6ea24102f49b931deeeb931f6e32405d': { 
    symbol: 'TLOS', 
    name: 'TLOS',
    decimals: 18,
    categories: ['layer1-blockchains'],
    description: 'Native token of Telos high-performance blockchain network'
  },
  '0x1a3496c18d558bd9c6c8f609e1b129f67ab08163': { 
    symbol: 'DEP', 
    name: 'DEAPCOIN',
    decimals: 18,
    categories: ['gaming-metaverse'],
    description: 'Token for DEA gaming platform and NFT marketplace ecosystem'
  },
  '0x1abaea1f7c830bd89acc67ec4af516284b1bc33c': { 
    symbol: 'EURC', 
    name: 'Euro Coin',
    decimals: 6,
    categories: ['stablecoins'],
    description: 'Euro-pegged stablecoin issued by Circle for European digital payments'
  },
  '0x1bbe973bef3a977fc51cbed703e8ffdefe001fed': { 
    symbol: 'PORTAL', 
    name: 'PORTAL',
    decimals: 18,
    categories: ['gaming-metaverse'],
    description: 'Token for Portal gaming platform connecting Web3 games'
  },

  '0x1f573d6fb3f13d689ff844b4ce37794d79a7ff1c': { 
    symbol: 'BNT', 
    name: 'Bancor Network Token',
    decimals: 18,
    categories: ['defi-protocols'],
    description: 'Token for Bancor automated market maker and liquidity protocol'
  },
  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': { 
    symbol: 'UNI', 
    name: 'Uniswap',
    decimals: 18,
    categories: ['defi-protocols', 'dao-governance'],
    description: 'Governance token for the Uniswap decentralized exchange protocol'
  },
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': { 
    symbol: 'WBTC', 
    name: 'Wrapped Bitcoin',
    decimals: 8,
    categories: ['infrastructure'],
    description: 'Tokenized Bitcoin on Ethereum, fully backed by Bitcoin reserves'
  },
  '0x24fcfc492c1393274b6bcd568ac9e225bec93584': { 
    symbol: 'MAVIA', 
    name: 'Heroes of Mavia',
    decimals: 18,
    categories: ['gaming-metaverse'],
    description: 'Token for Heroes of Mavia strategy MMO game with NFT land ownership'
  },
  '0x2565ae0385659badcada1031db704442e1b69982': { 
    symbol: 'ASM', 
    name: 'ASSEMBLE',
    decimals: 18,
    categories: ['gaming-metaverse'],
    description: 'Token for ASSEMBLE Protocol metaverse and NFT ecosystem'
  },
  '0x25f8087ead173b73d6e8b84329989a8eea16cf73': { 
    symbol: 'YGG', 
    name: 'Yield Guild Games Token',
    decimals: 18,
    categories: ['gaming-metaverse', 'dao-governance'],
    description: 'Governance token for Yield Guild Games, a play-to-earn gaming guild'
  },
  '0x26e550ac11b26f78a04489d5f20f24e3559f7dd9': { 
    symbol: 'KEKIUS', 
    name: 'Kekius Maximus',
    decimals: 9,
    categories: ['memecoins'],
    description: 'Meme token inspired by internet culture and Elon Musk references'
  },
  '0x26fb86579e371c7aedc461b2ddef0a8628c93d3b': { 
    symbol: 'BORA', 
    name: 'BORA',
    decimals: 18,
    categories: ['gaming-metaverse'],
    description: 'Token for BORA blockchain gaming and entertainment ecosystem'
  },
  '0x27c70cd1946795b66be9d954418546998b546634': { 
    symbol: 'LEASH', 
    name: 'DOGE KILLER',
    decimals: 18,
    categories: ['memecoins'],
    description: 'Part of Shiba Inu ecosystem, designed as anti-Dogecoin meme token'
  },
  '0x2a3bff78b79a009976eea096a51a948a3dc00e34': { 
    symbol: 'WILD', 
    name: 'Wilder',
    decimals: 18,
    categories: ['gaming-metaverse'],
    description: 'Token for Wilder World metaverse and immersive virtual experiences'
  },
  '0x2a9bdcff37ab68b95a53435adfd8892e86084f93': { 
    symbol: 'AQT', 
    name: 'Alpha Quark Token',
    decimals: 18,
    categories: ['defi-protocols'],
    description: 'Token for Alpha Quark DeFi protocol and yield farming platform'
  },
  '0x2af5d2ad76741191d15dfe7bf6ac92d4bd912ca3': { 
    symbol: 'LEO', 
    name: 'Bitfinex LEO Token',
    decimals: 18,
    categories: ['exchange-tokens'],
    description: 'Utility token for Bitfinex exchange with fee discounts and platform benefits'
  },
  '0x2ba592f78db6436527729929aaf6c908497cb200': { 
    symbol: 'CREAM', 
    name: 'Cream',
    decimals: 18,
    categories: ['defi-protocols'],
    description: 'Token for Cream Finance lending and borrowing protocol (had security issues)'
  },
  '0x3073f7aaa4db83f95e9fff17424f71d4751a3073': { 
    symbol: 'MOVE', 
    name: 'Movement',
    decimals: 8,
    categories: ['layer1-blockchains'],
    description: 'Token for Movement Labs blockchain focused on Move programming language'
  },
  '0x31c8eacbffdd875c74b94b077895bd78cf1e64a3': { 
    symbol: 'RAD', 
    name: 'Radicle',
    decimals: 18,
    categories: ['infrastructure'],
    description: 'Token for Radicle decentralized code collaboration and development platform'
  },
  '0x320623b8e4ff03373931769a31fc52a4e78b5d70': { 
    symbol: 'RSR', 
    name: 'Reserve Rights',
    decimals: 18,
    categories: ['stablecoins', 'dao-governance'],
    description: 'Governance token for Reserve Protocol creating stable currencies for global adoption'
  },
  '0x3230248d5a19a5d89f70773eed055c0d43e90bad': { 
    symbol: 'SOLAR', 
    name: 'Solar',
    decimals: 18,
    categories: ['renewable-energy'],
    description: 'Renewable energy token focused on solar power and sustainable energy solutions'
  },
  '0x32353a6c91143bfd6c7d363b546e62a9a2489a20': { 
    symbol: 'AGLD', 
    name: 'Adventure Gold',
    decimals: 18,
    categories: ['gaming-metaverse'],
    description: 'Token for Loot Project gaming ecosystem and NFT-based adventures'
  },
  '0x32462ba310e447ef34ff0d15bce8613aa8c4a244': { 
    symbol: 'DHN', 
    name: 'Dohrnii',
    decimals: 18,
    categories: ['web3', 'utility'],
    description: 'Web3 utility token for the Dohrnii platform and ecosystem'
  },

  '0x3429d03c6f7521aec737a0bbf2e5ddcef2c3ae31': { 
    symbol: 'PIXEL', 
    name: 'PIXEL',
    decimals: 18,
    categories: ['gaming', 'web3'],
    description: 'Gaming token for Pixels, a blockchain-based farming and world-building game'
  },
  '0x3432b6a60d23ca0dfca7761b7ab56459d9c964d0': { 
    symbol: 'FRAX', 
    name: 'Frax Share',
    decimals: 18,
    categories: ['defi', 'governance'],
    description: 'Governance token for the Frax Protocol, a fractional-algorithmic stablecoin system'
  },
  '0x3472a5a71965499acd81997a54bba8d852c6e53d': { 
    symbol: 'BADGER', 
    name: 'Badger',
    decimals: 18,
    categories: ['defi', 'bitcoin'],
    description: 'Native token of Badger DAO, focused on bringing Bitcoin to DeFi through yield farming and governance'
  },
  '0x3506424f91fd33084466f402d5d97f05f8e3b4af': { 
    symbol: 'CHZ', 
    name: 'chiliZ',
    decimals: 18,
    categories: ['sports', 'fan-tokens'],
    description: 'Token powering Socios.com, enabling fans to buy, trade, and vote with fan tokens for sports teams'
  },
  '0x350d3f0f41b5b21f0e252fe2ac3bda3a1feeea63': { 
    symbol: 'NAKA', 
    name: 'Nakamoto Games',
    decimals: 18,
    categories: ['gaming', 'play-to-earn'],
    description: 'Token for Nakamoto Games, a play-to-earn gaming ecosystem with multiple blockchain games'
  },
  '0x3593d125a4f7849a1b059e64f4517a86dd60c95d': { 
    symbol: 'OM', 
    name: 'MANTRA DAO',
    decimals: 18,
    categories: ['defi', 'governance'],
    description: 'Governance token for MANTRA DAO, a community-governed DeFi platform focused on staking and lending'
  },
  '0x3597bfd533a99c9aa083587b074434e61eb0a258': { 
    symbol: 'DENT', 
    name: 'DENT',
    decimals: 8,
    categories: ['telecommunications', 'mobile'],
    description: 'Token for DENT Wireless, a mobile data marketplace enabling users to buy, sell and donate mobile data'
  },
  '0x3845badade8e6dff049820680d1f14bd3903a5d0': { 
    symbol: 'SAND', 
    name: 'SAND',
    decimals: 18,
    categories: ['gaming-metaverse', 'nft-ecosystem'],
    description: 'Utility token for The Sandbox metaverse gaming platform'
  },
  '0x3883f5e181fccaf8410fa61e12b59bad963fb645': { 
    symbol: 'THETA', 
    name: 'Theta Token',
    decimals: 18,
    categories: ['media', 'streaming'],
    description: 'Native token of Theta Network, a decentralized video streaming and delivery network'
  },
  '0x38e68a37e401f7271568cecaac63c6b1e19130b4': { 
    symbol: 'BANANA', 
    name: 'Banana',
    decimals: 18,
    categories: ['defi', 'yield-farming'],
    description: 'Reward token for ApeSwap, a decentralized exchange and yield farming platform'
  },
  '0x3b50805453023a91a8bf641e279401a0b23fa6f9': { 
    symbol: 'REZ', 
    name: 'Renzo',
    decimals: 18,
    categories: ['defi'],
    description: 'Token for Renzo Protocol, a liquid restaking protocol for Ethereum validators'
  },
  '0x3c3a81e81dc49a522a592e7622a7e711c06bf354': { 
    symbol: 'MNT', 
    name: 'Mantle',
    decimals: 18,
    categories: ['layer2-scaling'],
    description: 'Native token of Mantle Network, an Ethereum Layer 2 scaling solution'
  },
  '0x3d7975eccfc61a2102b08925cbba0a4d4dbb6555': { 
    symbol: 'USDD', 
    name: 'Decentralized USD',
    decimals: 18,
    categories: ['stablecoins'],
    description: 'Algorithmic stablecoin launched by TRON DAO Reserve with multi-collateral backing'
  },

  '0x3e5a19c91266ad8ce2477b91585d1856b84062df': { 
    symbol: 'A8', 
    name: 'Ancient8',
    decimals: 18,
    categories: ['gaming', 'web3'],
    description: 'Token for Ancient8, a Web3 gaming guild and platform in Vietnam and Southeast Asia'
  },
  '0x3f382dbd960e3a9bbceae22651e88158d2791550': { 
    symbol: 'GHST', 
    name: 'Aavegotchi GHST Token',
    decimals: 18,
    categories: ['gaming-metaverse', 'nft-ecosystem', 'defi-protocols'],
    description: 'Utility token for Aavegotchi, combining DeFi staking with NFT gaming'
  },
  '0x3ffeea07a27fab7ad1df5297fa75e77a43cb5790': { 
    symbol: 'PEIPEI', 
    name: 'PeiPei',
    decimals: 18,
    categories: ['meme', 'community'],
    description: 'Meme token inspired by Pepe the Frog, with a community-driven ecosystem'
  },
  '0x419d0d8bdd9af5e606ae2232ed285aff190e711b': { 
    symbol: 'FUN', 
    name: 'FunFair',
    decimals: 8,
    categories: ['gaming', 'gambling'],
    description: 'Token for FunFair, a blockchain-based platform for online casino and gambling games'
  },
  '0x41e5560054824ea6b0732e656e3ad64e20e94e45': { 
    symbol: 'CVC', 
    name: 'Civic',
    decimals: 8,
    categories: ['identity', 'privacy'],
    description: 'Token for Civic, a decentralized identity verification platform providing secure identity solutions'
  },
  '0x42476f744292107e34519f9c357927074ea3f75d': { 
    symbol: 'LOOM', 
    name: 'Loom Token',
    decimals: 18,
    categories: ['layer-2', 'scaling'],
    description: 'Token for Loom Network, a platform for building scalable DApps with Layer 2 solutions'
  },
  '0x42bbfa2e77757c645eeaad1655e0911a7553efbc': { 
    symbol: 'BOBA', 
    name: 'Boba Token',
    decimals: 18,
    categories: ['layer-2', 'scaling'],
    description: 'Governance token for Boba Network, an Ethereum Layer 2 optimistic rollup solution'
  },
  '0x430ef9263e76dae63c84292c3409d61c598e9682': { 
    symbol: 'PYR', 
    name: 'PYR Token',
    decimals: 18,
    categories: ['gaming', 'nft'],
    description: 'Token for Vulcan Forged, a blockchain gaming platform with NFT marketplace and play-to-earn games'
  },
  '0x431ad2ff6a9c365805ebad47ee021148d6f7dbe0': { 
    symbol: 'DF', 
    name: 'dForce',
    decimals: 18,
    categories: ['defi', 'lending'],
    description: 'Governance token for dForce, a DeFi platform offering lending, borrowing, and yield farming services'
  },

  '0x44108f0223a3c3028f5fe7aec7f9bb2e66bef82f': { 
    symbol: 'ACX', 
    name: 'Across Protocol Token',
    decimals: 18,
    categories: ['bridge', 'infrastructure'],
    description: 'Governance token for Across Protocol, a cross-chain bridge for fast and secure asset transfers'
  },
  '0x44ff8620b8ca30902395a7bd3f2407e1a091bf73': { 
    symbol: 'VIRTUAL', 
    name: 'Virtual Protocol',
    decimals: 18,
    categories: ['ai-data', 'gaming-metaverse'],
    description: 'Protocol for creating and monetizing AI agents in virtual environments'
  },
  '0x455e53cbb86018ac2b8092fdcd39d8444affc3f6': { 
    symbol: 'POL', 
    name: 'Polygon',
    decimals: 18,
    categories: ['layer2-scaling'],
    description: 'Native token of Polygon, a leading Ethereum scaling solution'
  },
  '0x4575f41308ec1483f3d399aa9a2826d74da13deb': { 
    symbol: 'OXT', 
    name: 'Orchid',
    decimals: 18,
    categories: ['privacy', 'vpn'],
    description: 'Token for Orchid Network, a decentralized VPN service providing privacy and internet freedom'
  },
  '0x45804880de22913dafe09f4980848ece6ecbaf78': { 
    symbol: 'PAXG', 
    name: 'Paxos Gold',
    decimals: 18,
    categories: ['real-world-assets'],
    description: 'Digital token backed by physical gold reserves'
  },
  '0x467bccd9d29f223bce8043b84e8c8b282827790f': { 
    symbol: 'TEL', 
    name: 'Telcoin',
    decimals: 2,
    categories: ['fintech', 'mobile'],
    description: 'Token for Telcoin, a mobile-first financial platform connecting cryptocurrency with mobile networks'
  },
  '0x4691937a7508860f876c9c0a2a617e7d9e945d4b': { 
    symbol: 'WOO', 
    name: 'Wootrade Network',
    decimals: 18,
    categories: ['exchange', 'defi'],
    description: 'Token for WOO Network, providing deep liquidity and zero-fee trading across multiple platforms'
  },
  '0x469eda64aed3a3ad6f868c44564291aa415cb1d9': { 
    symbol: 'FLUX', 
    name: 'FLUX',
    decimals: 18,
    categories: ['infrastructure', 'cloud-computing'],
    description: 'Token for Flux, a decentralized cloud infrastructure platform for Web3 applications'
  },
  '0x491604c0fdf08347dd1fa4ee062a822a5dd06b5d': { 
    symbol: 'CTSI', 
    name: 'Cartesi Token',
    decimals: 18,
    categories: ['layer-2', 'infrastructure'],
    description: 'Token for Cartesi, a Layer 2 solution enabling complex computations on blockchain using Linux'
  },
  '0x4a220e6096b25eadb88358cb44068a3248254675': { 
    symbol: 'QNT', 
    name: 'Quant',
    decimals: 18,
    categories: ['interoperability', 'enterprise'],
    description: 'Token for Quant Network, providing blockchain interoperability solutions for enterprises and institutions'
  },
  '0x4b5f49487ea7b3609b1ad05459be420548789f1f': { 
    symbol: 'LEVER', 
    name: 'Lever',
    decimals: 18,
    categories: ['defi', 'leverage'],
    description: 'Token for LeverFi, a decentralized leverage trading platform with lending and borrowing features'
  },
  '0x4b9278b94a1112cad404048903b8d343a810b07e': { 
    symbol: 'HIFI', 
    name: 'Hifi Finance',
    decimals: 18,
    categories: ['defi', 'lending'],
    description: 'Governance token for Hifi Finance, a DeFi lending protocol for fixed-rate borrowing and lending'
  },
  '0x4c11249814f11b9346808179cf06e71ac328c1b5': { 
    symbol: 'ORAI', 
    name: 'Oraichain Token',
    decimals: 18,
    categories: ['ai', 'oracle'],
    description: 'Token for Oraichain, the first AI-powered oracle and ecosystem for blockchains'
  },
  '0x4c1746a800d224393fe2470c70a35717ed4ea5f1': { 
    symbol: 'PLUME', 
    name: 'Plume',
    decimals: 18,
    categories: ['rwa', 'defi'],
    description: 'Token for Plume Network, a modular L2 blockchain focused on real-world assets (RWA)'
  },
  '0x4c19596f5aaff459fa38b0f7ed92f11ae6543784': { 
    symbol: 'TRU', 
    name: 'TrueFi',
    decimals: 8,
    categories: ['defi', 'lending'],
    description: 'Token for TrueFi, a DeFi protocol for uncollateralized lending to institutions and market makers'
  },
  '0x4c9edd5852cd905f086c759e8383e09bff1e68b3': { 
    symbol: 'USDe', 
    name: 'USDe',
    decimals: 18,
    categories: ['stablecoins'],
    description: 'Synthetic dollar by Ethena Protocol backed by derivatives positions'
  },
  '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0': { 
    symbol: 'wstETH', 
    name: 'Wrapped liquid staked Ether 2.0 3.21% APR',
    decimals: 18,
    categories: ['liquid-staking'],
    description: 'Wrapped version of stETH with rebasing rewards wrapped into token value'
  },
  '0xae78736cd615f374d3085123a210448e74fc6393': { 
    symbol: 'rETH', 
    name: 'Rocket Pool ETH 2.40% APR',
    decimals: 18,
    categories: ['liquid-staking'],
    description: 'Liquid staking token from Rocket Pool, a decentralized Ethereum staking protocol'
  },
  '0xcd5fe23c85820f7b72d0926fc9b05b43e359b7ee': { 
    symbol: 'weETH', 
    name: 'Wrapped eETH 2.97% APR',
    decimals: 18,
    categories: ['liquid-staking'],
    description: 'Non-rebasing wrapped version of eETH with enhanced yield from restaking'
  },
  '0xf951e335afb289353dc249e82926178eac7ded78': { 
    symbol: 'swETH', 
    name: 'Swell Ethereum 3.00% APR',
    decimals: 18,
    categories: ['liquid-staking'],
    description: 'Liquid staking token from Swell protocol with restaking capabilities'
  },
  '0xe95a203b1a91a908f9b9ce46459d101078c2c3cb': { 
    symbol: 'ankrETH', 
    name: 'Ankr Staked ETH 4.25% APR',
    decimals: 18,
    categories: ['liquid-staking'],
    description: 'Liquid staking token representing ETH staked through Ankr protocol'
  },
  '0x4d224452801aced8b2f0aebe155379bb5d594381': { 
    symbol: 'APE', 
    name: 'ApeCoin',
    decimals: 18,
    categories: ['gaming-metaverse', 'nft-ecosystem', 'dao-governance'],
    description: 'Utility token for the ApeCoin ecosystem and Otherdeeds metaverse'
  },
  '0x4dc26fc5854e7648a064a4abd590bbe71724c277': { 
    symbol: 'ANIME', 
    name: 'Animecoin',
    decimals: 18,
    categories: ['entertainment', 'nft'],
    description: 'Token for anime and manga content creation, NFT marketplace, and community rewards'
  },
  '0x4e3fbd56cd56c3e72c1403e103b45db9da5b9d2b': { 
    symbol: 'CVX', 
    name: 'Convex Token',
    decimals: 18,
    categories: ['defi-protocols', 'dao-governance'],
    description: 'Token for Convex Finance, boosting rewards for Curve Finance liquidity providers'
  },
  '0x5026f006b85729a8b14553fae6af249ad16c9aab': { 
    symbol: 'WOJAK', 
    name: 'Wojak Coin',
    decimals: 18,
    categories: ['memecoins'],
    description: 'Memecoin based on the popular Wojak internet meme character'
  },
  '0x50d1c9771902476076ecfc8b2a83ad6b9355a4c9': { 
    symbol: 'FTT', 
    name: 'FTX Token',
    decimals: 18,
    categories: ['exchange', 'utility'],
    description: 'Former utility token of FTX exchange, now largely defunct following exchange collapse'
  },
  '0x514910771af9ca656af840dff83e8264ecf986ca': { 
    symbol: 'LINK', 
    name: 'ChainLink',
    decimals: 18,
    categories: ['infrastructure'],
    description: 'Decentralized oracle network providing real-world data to smart contracts'
  },
  '0x5283d291dbcf85356a21ba090e6db59121208b44': { 
    symbol: 'BLUR', 
    name: 'Blur',
    decimals: 18,
    categories: ['nft-ecosystem', 'dao-governance'],
    description: 'Governance token for Blur, a leading NFT marketplace and aggregator'
  },
  '0x54d2252757e1672eead234d27b1270728ff90581': { 
    symbol: 'BGB', 
    name: 'BitgetToken',
    decimals: 18,
    categories: ['exchange-tokens'],
    description: 'Utility token for Bitget exchange providing trading benefits and governance'
  },
  '0x55296f69f40ea6d20e478533c15a6b08b654e758': { 
    symbol: 'XYO', 
    name: 'XY Oracle',
    decimals: 18,
    categories: ['oracle', 'location'],
    description: 'Token for XYO Network, a decentralized location oracle network for real-world data verification'
  },
  '0x560363bda52bc6a44ca6c8c9b4a5fadbda32fa60': { 
    symbol: 'SFUND', 
    name: 'SeedifyFund',
    decimals: 18,
    categories: ['launchpad', 'gaming'],
    description: 'Token for Seedify, a blockchain gaming launchpad and incubator for game projects'
  },
  '0x579cea1889991f68acc35ff5c3dd0621ff29b0c9': { 
    symbol: 'IQ', 
    name: 'Everipedia IQ',
    decimals: 18,
    categories: ['knowledge', 'web3'],
    description: 'Token for Everipedia and IQ Protocol, decentralized knowledge networks and encyclopedia platforms'
  },
  '0x57b946008913b82e4df85f501cbaed910e58d26c': { 
    symbol: 'POND', 
    name: 'Marlin POND',
    decimals: 18,
    categories: ['infrastructure', 'scaling'],
    description: 'Token for Marlin Protocol, providing high-performance network infrastructure for blockchain applications'
  },
  '0x57e114b691db790c35207b2e685d4a43181e6061': { 
    symbol: 'ENA', 
    name: 'ENA',
    decimals: 18,
    categories: ['defi', 'stablecoin'],
    description: 'Governance token for Ethena Protocol, a synthetic dollar protocol built on Ethereum'
  },
  '0x58d97b57bb95320f9a05dc918aef65434969c2b2': { 
    symbol: 'MORPHO', 
    name: 'Morpho Token',
    decimals: 18,
    categories: ['defi', 'lending'],
    description: 'Governance token for Morpho, a peer-to-peer lending protocol optimizing rates on Aave and Compound'
  },
  '0x594daad7d77592a2b97b725a7ad59d7e188b5bfa': { 
    symbol: 'APU', 
    name: 'Apu Apustaja',
    decimals: 18,
    categories: ['memecoins'],
    description: 'Memecoin based on the Apu Apustaja character, a variant of Pepe'
  },
  '0x595832f8fc6bf59c85c527fec3740a1b7a361269': { 
    symbol: 'POWR', 
    name: 'PowerLedger',
    decimals: 6,
    categories: ['renewable-energy', 'utility'],
    description: 'Token for Power Ledger, a blockchain-based peer-to-peer energy trading platform'
  },
  '0x5a98fcbea516cf06857215779fd812ca3bef1b32': { 
    symbol: 'LDO', 
    name: 'Lido DAO Token',
    decimals: 18,
    categories: ['dao-governance'],
    description: 'Governance token for Lido, the largest liquid staking protocol for Ethereum'
  },
  '0x5afe3855358e112b5647b952709e6165e1c1eeee': { 
    symbol: 'SAFE', 
    name: 'Safe Token',
    decimals: 18,
    categories: ['security', 'wallet'],
    description: 'Governance token for Safe (formerly Gnosis Safe), a multi-signature wallet and smart contract platform'
  },
  '0x5dc60c4d5e75d22588fa17ffeb90a63e535efce0': { 
    symbol: 'DKA', 
    name: 'dKargo',
    decimals: 18,
    categories: ['logistics', 'supply-chain'],
    description: 'Token for dKargo, a blockchain-based logistics and supply chain management platform'
  },
  '0x5dc60c4d5e75d22588fa17ffeb90a63e535efce9': { 
    symbol: 'OMNI', 
    name: 'Omni Network',
    decimals: 18,
    categories: ['interoperability', 'layer-1'],
    description: 'Token for Omni Network, a platform enabling secure cross-rollup communication for Ethereum'
  },
  '0x607f4c5bb672230e8672085532f7e901544a7375': { 
    symbol: 'RLC', 
    name: 'iEx.ec Network Token',
    decimals: 9,
    categories: ['cloud-computing', 'infrastructure'],
    description: 'Token for iExec, a decentralized cloud computing platform for blockchain applications'
  },
  '0x61e90a50137e1f645c9ef4a0d3a4f01477738406': { 
    symbol: 'LOKA', 
    name: 'League of Kingdoms Arena',
    decimals: 18,
    categories: ['gaming', 'strategy'],
    description: 'Token for League of Kingdoms, a blockchain-based MMO strategy game with NFT land ownership'
  },
  '0x626e8036deb333b408be468f951bdb42433cbf18': { 
    symbol: 'AIOZ', 
    name: 'AIOZ Network',
    decimals: 18,
    categories: ['media', 'cdn'],
    description: 'Token for AIOZ Network, a decentralized content delivery network for streaming and media distribution'
  },
  '0x628a3b2e302c7e896acc432d2d0dd22b6cb9bc88': { 
    symbol: 'LMWR', 
    name: 'LimeWire Token',
    decimals: 18,
    categories: ['media', 'nft'],
    description: 'Token for LimeWire, a reimagined platform for content creators to mint, trade, and monetize NFTs'
  },
  '0x62d0a8458ed7719fdaf978fe5929c6d342b0bfce': { 
    symbol: 'BEAM', 
    name: 'Beam',
    decimals: 18,
    categories: ['gaming', 'web3'],
    description: 'Token for Beam, a gaming-focused blockchain ecosystem and subnet on Avalanche'
  },
  '0x643c4e15d7d62ad0abec4a9bd4b001aa3ef52d66': { 
    symbol: 'SYRUP', 
    name: 'Syrup Token',
    decimals: 18,
    categories: ['defi', 'yield-farming'],
    description: 'Reward token for PancakeSwap syrup pools, used for staking and earning additional rewards'
  },
  '0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5': { 
    symbol: 'OHM', 
    name: 'Olympus',
    decimals: 9,
    categories: ['defi', 'reserve-currency'],
    description: 'Native token of OlympusDAO, an algorithmic reserve currency protocol backed by treasury assets'
  },
  '0x66761fa41377003622aee3c7675fc7b5c1c2fac5': { 
    symbol: 'CPOOL', 
    name: 'Clearpool',
    decimals: 18,
    categories: ['defi', 'lending'],
    description: 'Governance token for Clearpool, a decentralized capital markets protocol for institutional borrowers'
  },
  '0x66d79b8f60ec93bfce0b56f5ac14a2714e509a99': { 
    symbol: 'MAPO', 
    name: 'MAP Protocol',
    decimals: 18,
    categories: ['interoperability', 'bridge'],
    description: 'Token for MAP Protocol, a Bitcoin layer-2 and cross-chain interoperability protocol'
  },
  '0x67466be17df832165f8c80a5a120ccc652bd7e69': { 
    symbol: 'WOLF', 
    name: 'Landwolf',
    decimals: 18,
    categories: ['meme', 'community'],
    description: 'Meme token inspired by the Landwolf character, building a community-driven ecosystem'
  },
  '0x675b68aa4d9c2d3bb3f0397048e62e6b7192079c': { 
    symbol: 'FUEL', 
    name: 'FUEL',
    decimals: 9,
    categories: ['layer-1', 'modular'],
    description: 'Token for Fuel Network, a high-performance modular execution layer for Ethereum'
  },
  '0x678e840c640f619e17848045d23072844224dd37': { 
    symbol: 'CRTS', 
    name: 'Cratos',
    decimals: 18,
    categories: ['defi', 'governance'],
    description: 'Governance token for Cratos, a decentralized platform for community-driven financial services'
  },
  '0x6810e776880c02933d47db1b9fc05908e5386b96': { 
    symbol: 'GNO', 
    name: 'Gnosis Token',
    decimals: 18,
    categories: ['prediction-markets', 'dao-governance', 'layer1-blockchains'],
    description: 'Token for Gnosis ecosystem, including prediction markets and Gnosis Chain'
  },
  '0x68749665ff8d2d112fa859aa293f07a622782f38': { 
    symbol: 'XAUt', 
    name: 'Tether Gold',
    decimals: 6,
    categories: ['real-world-assets'],
    description: 'Gold-backed cryptocurrency representing ownership of physical gold'
  },
  '0x6982508145454ce325ddbe47a25d4ec3d2311933': { 
    symbol: 'PEPE', 
    name: 'Pepe',
    decimals: 18,
    categories: ['memecoins'],
    description: 'Meme cryptocurrency inspired by the Pepe the Frog internet meme'
  },
  '0x69af81e73a73b40adf4f3d4223cd9b1ece623074': { 
    symbol: 'MASK', 
    name: 'Mask Network',
    decimals: 18,
    categories: ['privacy', 'social'],
    description: 'Token for Mask Network, enabling users to seamlessly send crypto and interact with DApps on social platforms'
  },
  '0x6b0b3a982b4634ac68dd83a4dbf02311ce324181': { 
    symbol: 'ALI', 
    name: 'Artificial Liquid Intelligence Token',
    decimals: 18,
    categories: ['ai', 'nft'],
    description: 'Token for Alethea AI, creating intelligent NFTs and AI agents through synthetic media and blockchain technology'
  },
  '0x6b175474e89094c44da98b954eedeac495271d0f': { 
    symbol: 'DAI', 
    name: 'Dai Stablecoin',
    decimals: 18,
    categories: ['stablecoins'],
    description: 'Decentralized stablecoin backed by crypto collateral, governed by MakerDAO'
  },
  '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2': { 
    symbol: 'SUSHI', 
    name: 'SushiToken',
    decimals: 18,
    categories: ['defi-protocols', 'dao-governance'],
    description: 'Governance token for SushiSwap, a community-driven DEX and DeFi platform'
  },
  '0x6c28aef8977c9b773996d0e8376d2ee379446f2f': { 
    symbol: 'QUICK', 
    name: 'Quickswap',
    decimals: 18,
    categories: ['dex', 'defi'],
    description: 'Governance token for QuickSwap, a decentralized exchange on Polygon with yield farming capabilities'
  },
  '0x6c3ea9036406852006290770bedfcaba0e23a0e8': { 
    symbol: 'PYUSD', 
    name: 'PayPal USD',
    decimals: 6,
    categories: ['stablecoins'],
    description: 'USD-backed stablecoin issued by PayPal for digital payments and transfers'
  },
  '0x6c5ba91642f10282b576d91922ae6448c9d52f4e': { 
    symbol: 'PHA', 
    name: 'Phala',
    decimals: 18,
    categories: ['privacy', 'cloud-computing'],
    description: 'Token for Phala Network, a privacy-preserving cloud computing service using secure hardware'
  },
  '0x6c6ee5e31d828de241282b9606c8e98ea48526e2': { 
    symbol: 'HOT', 
    name: 'HoloToken',
    decimals: 18,
    categories: ['infrastructure', 'p2p'],
    description: 'Token for Holochain, a framework for building distributed peer-to-peer applications'
  },
  '0x6de037ef9ad2725eb40118bb1702ebb27e4aeb24': { 
    symbol: 'RENDER', 
    name: 'Render Token',
    decimals: 18,
    categories: ['ai-data', 'infrastructure'],
    description: 'Distributed GPU rendering network for 3D graphics and AI computation'
  },
  '0x6dea81c8171d0ba574754ef6f8b412f2ed88c54d': { 
    symbol: 'LQTY', 
    name: 'LQTY',
    decimals: 18,
    categories: ['defi', 'stablecoin'],
    description: 'Governance token for Liquity Protocol, a decentralized borrowing protocol issuing LUSD stablecoin'
  },
  '0x6e2a43be0b1d33b726f0ca3b8de60b3482b8b050': { 
    symbol: 'ARKM', 
    name: 'Arkham',
    decimals: 18,
    categories: ['ai-data', 'infrastructure'],
    description: 'Utility token for Arkham Intelligence, providing blockchain analytics and data'
  },
  '0x6f40d4a6237c257fff2db00fa0510deeecd303eb': { 
    symbol: 'FLUID', 
    name: 'Fluid',
    decimals: 18,
    categories: ['defi', 'lending'],
    description: 'Token for Fluid Protocol, a lending and borrowing platform with advanced yield strategies'
  },
  '0x71ab77b7dbb4fa7e017bc15090b2163221420282': { 
    symbol: 'HIGH', 
    name: 'Highstreet token',
    decimals: 18,
    categories: ['gaming', 'metaverse'],
    description: 'Token for Highstreet, a commerce-focused metaverse where users can play, earn, and shop'
  },
  '0x7420b4b9a0110cdc71fb720908340c03f9bc03ec': { 
    symbol: 'JASMY', 
    name: 'JasmyCoin',
    decimals: 18,
    categories: ['iot', 'data'],
    description: 'Token for JasmyCoin, an IoT platform focused on data democratization and secure data exchange'
  },
  '0x7448c7456a97769f6cd04f1e83a4a23ccdc46abd': { 
    symbol: 'MAV', 
    name: 'Maverick Token',
    decimals: 18,
    categories: ['dex', 'defi'],
    description: 'Governance token for Maverick Protocol, an innovative AMM with dynamic liquidity distribution'
  },
  '0x744d70fdbe2ba4cf95131626614a1763df805b9e': { 
    symbol: 'SNT', 
    name: 'Status Network Token',
    decimals: 18,
    categories: ['social', 'messaging'],
    description: 'Token for Status, a decentralized messaging platform and mobile Ethereum client'
  },
  '0x75231f58b43240c9718dd58b4967c5114342a86c': { 
    symbol: 'OKB', 
    name: 'OKB',
    decimals: 18,
    categories: ['exchange-tokens'],
    description: 'Utility token for OKX exchange ecosystem and trading benefits'
  },
  '0x761d38e5ddf6ccf6cf7c55759d5210750b5d60f3': { 
    symbol: 'ELON', 
    name: 'Dogelon',
    decimals: 18,
    categories: ['memecoins'],
    description: 'Memecoin combining Dogecoin and Elon Musk themes with Mars exploration narrative'
  },
  '0x767fe9edc9e0df98e07454847909b5e959d7ca0e': { 
    symbol: 'ILV', 
    name: 'Illuvium',
    decimals: 18,
    categories: ['gaming-metaverse', 'dao-governance'],
    description: 'Governance token for Illuvium, an open-world RPG and auto-battler game'
  },
  '0x76a0e27618462bdac7a29104bdcfff4e6bfcea2d': { 
    symbol: 'SOSO', 
    name: 'SoSoValue',
    decimals: 18,
    categories: ['data', 'analytics'],
    description: 'Token for SoSoValue, a crypto data and analytics platform providing market insights and research'
  },
  '0x77777feddddffc19ff86db637967013e6c6a116c': { 
    symbol: 'TORN', 
    name: 'Tornado Cash',
    decimals: 18,
    categories: ['privacy', 'mixing'],
    description: 'Governance token for Tornado Cash, a decentralized protocol for private transactions on Ethereum'
  },
  '0x77fba179c79de5b7653f68b5039af940ada60ce0': { 
    symbol: 'FORTH', 
    name: 'Ampleforth Governance',
    decimals: 18,
    categories: ['defi', 'governance'],
    description: 'Governance token for Ampleforth, an algorithmic reserve currency protocol with elastic supply'
  },

  '0x79f05c263055ba20ee0e814acd117c20caa10e0c': { 
    symbol: 'ICE', 
    name: 'Ice',
    decimals: 18,
    categories: ['defi', 'cross-chain'],
    description: 'Token for Ice Protocol, a multi-chain DeFi platform with yield farming and cross-chain capabilities'
  },
  '0x7a58c0be72be218b41c608b7fe7c5bb630736c71': { 
    symbol: 'PEOPLE', 
    name: 'ConstitutionDAO',
    decimals: 18,
    categories: ['dao-governance'],
    description: 'Token from ConstitutionDAO attempt to purchase original US Constitution'
  },
  '0x7abc8a5768e6be61a6c693a6e4eacb5b60602c4d': { 
    symbol: 'CXT', 
    name: 'Covalent X Token',
    decimals: 18,
    categories: ['ai-data', 'infrastructure'],
    description: 'Token for Covalent blockchain data indexing and API services'
  },
  '0x7cd017ca5ddb86861fa983a34b5f495c6f898c41': { 
    symbol: 'WUSD', 
    name: 'Worldwide USD',
    decimals: 18,
    categories: ['stablecoins'],
    description: 'Worldwide USD stablecoin for global payments and DeFi applications'
  },
  '0x7d5121505149065b562c789a0145ed750e6e8cdd': { 
    symbol: 'VR', 
    name: 'Victoria VR',
    decimals: 18,
    categories: ['gaming-metaverse'],
    description: 'Token for Victoria VR metaverse platform with virtual reality integration'
  },

  '0x7dd9c5cba05e151c895fde1cf355c9a1d5da6429': { 
    symbol: 'GLM', 
    name: 'Golem Network Token',
    decimals: 18,
    categories: ['infrastructure', 'ai-data'],
    description: 'Token for Golem decentralized computing power marketplace'
  },
  
  '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': { 
    symbol: 'AAVE', 
    name: 'Aave',
    decimals: 18,
    categories: ['defi-protocols', 'dao-governance'],
    description: 'Governance token for the Aave lending and borrowing protocol'
  },
  '0x80122c6a83c8202ea365233363d3f4837d13e888': { 
    symbol: 'M87', 
    name: 'Messier',
    decimals: 18,
    categories: ['infrastructure'],
    description: 'Token for Messier blockchain infrastructure and development tools'
  },
  '0x808507121b80c02388fad14726482e061b8da827': { 
    symbol: 'PENDLE', 
    name: 'Pendle',
    decimals: 18,
    categories: ['defi-protocols', 'derivatives'],
    description: 'Protocol for trading yield and future yield through yield tokenization'
  },
  '0xFe0c30065B384F05761f15d0CC899D4F9F9Cc0eB': {
    symbol: 'ETHFI',
    name: 'ether.fi governance token',
    decimals: 18,
    categories: ['defi-protocols', 'liquid-staking',
  'dao-governance'],
    description: 'Governance token for ether.fi liquid staking protocol'
  },

  '0x56072C95FAA701256059aa122697B133aDEd9279': {
    symbol: 'SKY',
    name: 'SKY Governance Token',
    decimals: 18,
    categories: ['dao-governance', 'defi-protocols'],
    description: 'MakerDAO governance token enabling non-custodial saving rewards'
  },

  '0xB0fFa8000886e57F86dd5264b9582b2Ad87b2b91': {
    symbol: 'W',
    name: 'Wormhole Token',
    decimals: 6,
    categories: ['cross-chain', 'infrastructure',
  'interoperability'],
    description: 'Cross-chain bridge connecting decentralized web platforms'
  },

  '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6': {
    symbol: 'WLFI',
    name: 'World Liberty Financial',
    decimals: 18,
    categories: ['defi-protocols', 'dao-governance'],
    description: 'DeFi protocol aiming to be a one-stop-shop for global DeFi services'
  },

  '0x6985884C4392D348587B19cb9eAAf157F13271cd': {
    symbol: 'ZRO',
    name: 'LayerZero',
    decimals: 18,
    categories: ['cross-chain', 'infrastructure', 'interoperability'],
    description: 'Omnichain interoperability protocol enabling cross-chain applications'
  },
  '0x812ba41e071c7b7fa4ebcfb62df5f45f6fa853ee': { 
    symbol: 'Neiro', 
    name: 'Neiro',
    decimals: 9,
    categories: ['memecoins'],
    description: 'Meme token inspired by internet culture and community-driven trading'
  },
  '0x814e0908b12a99fecf5bc101bb5d0b8b5cdf7d26': { 
    symbol: 'MDT', 
    name: 'Measurable Data Token',
    decimals: 18,
    categories: ['ai-data'],
    description: 'Token for Measurable Data Token blockchain data analytics platform'
  },
  '0x8207c1ffc5b6804f6024322ccf34f29c3541ae26': { 
    symbol: 'OGN', 
    name: 'OriginToken',
    decimals: 18,
    categories: ['defi-protocols', 'nft-ecosystem'],
    description: 'Token for Origin Protocol marketplace and NFT platform'
  },
  '0x8248270620aa532e4d64316017be5e873e37cc09': { 
    symbol: 'DEVVE', 
    name: 'DevvE',
    decimals: 18,
    categories: ['infrastructure'],
    description: 'Token for DevvE blockchain development and enterprise solutions'
  },

  '0x826180541412d574cf1336d22c0c0a287822678a': { 
    symbol: 'FLIP', 
    name: 'Chainflip',
    decimals: 18,
    categories: ['defi-protocols', 'layer2-scaling'],
    description: 'Token for Chainflip cross-chain automated market maker protocol'
  },
  '0x8290333cef9e6d528dd5618fb97a76f268f3edd4': { 
    symbol: 'ANKR', 
    name: 'Ankr Network',
    decimals: 18,
    categories: ['infrastructure'],
    description: 'Token for Ankr blockchain infrastructure and liquid staking services'
  },
  '0x83e6f1e41cdd28eaceb20cb649155049fac3d5aa': { 
    symbol: 'POLS', 
    name: 'PolkastarterToken',
    decimals: 18,
    categories: ['dao-governance'],
    description: 'Token for Polkastarter multi-chain fundraising launchpad platform'
  },
  '0x8457ca5040ad67fdebbcc8edce889a335bc0fbfb': { 
    symbol: 'ALT', 
    name: 'AltLayer Token',
    decimals: 18,
    categories: ['layer2-scaling', 'infrastructure'],
    description: 'Token for AltLayer rollup infrastructure and blockchain scaling solutions'
  },
  '0x84ca8bc7997272c7cfb4d0cd3d55cd942b3c9419': { 
    symbol: 'DIA', 
    name: 'DIAToken',
    decimals: 18,
    categories: ['infrastructure', 'ai-data'],
    description: 'Token for DIA decentralized oracle platform providing market data'
  },
  '0x85f17cf997934a597031b2e18a9ab6ebd4b9f6a4': { 
    symbol: 'NEAR', 
    name: 'NEAR',
    decimals: 24,
    categories: ['layer1-blockchains'],
    description: 'Native token of NEAR Protocol, a developer-friendly blockchain platform'
  },
  '0x888888848b652b3e3a0f34c96e00eec0f3a23f72': { 
    symbol: 'TLM', 
    name: 'Alien Worlds Trilium',
    decimals: 4,
    categories: ['gaming-metaverse'],
    description: 'Token for Alien Worlds NFT-based metaverse mining game'
  },
  '0x88909d489678dd17aa6d9609f89b0419bf78fd9a': { 
    symbol: 'L3', 
    name: 'Layer3',
    decimals: 18,
    categories: ['infrastructure', 'dao-governance'],
    description: 'Token for Layer3 Web3 identity and contributor reputation platform'
  },
  '0x88df592f8eb5d7bd38bfef7deb0fbc02cf3778a0': { 
    symbol: 'TRB', 
    name: 'Tellor Tributes',
    decimals: 18,
    categories: ['infrastructure', 'ai-data'],
    description: 'Token for Tellor decentralized oracle network and data reporting'
  },
  '0x89a8c847f41c0dfa6c8b88638bacca8a0b777da7': { 
    symbol: 'ELX', 
    name: 'Elixir',
    decimals: 18,
    categories: ['defi-protocols'],
    description: 'Token for Elixir protocol providing DeFi order book infrastructure'
  },
  '0x8a2279d4a90b6fe1c4b30fa660cc9f926797baa2': { 
    symbol: 'CHR', 
    name: 'Chroma',
    decimals: 6,
    categories: ['gaming-metaverse'],
    description: 'Gaming token powering blockchain gaming infrastructure and metaverse applications'
  },
  '0x8c384362c2b6883c711cd63fa2cd7438ea23e275': { 
    symbol: 'WEMIX', 
    name: 'WEMIX Token',
    decimals: 18,
    categories: ['gaming-metaverse', 'layer1-blockchains'],
    description: 'Native token of WEMIX blockchain platform for gaming and entertainment'
  },
  '0x8ce9137d39326ad0cd6491fb5cc0cba0e089b6a9': { 
    symbol: 'SXP', 
    name: 'Swipe',
    decimals: 18,
    categories: ['payments', 'defi-protocols'],
    description: 'Token for Swipe digital wallet and cryptocurrency payment platform'
  },
  '0x8d983cb9388eac77af0474fa441c722e3a38cfdc': { 
    symbol: 'ATOM', 
    name: 'Cosmos Hub',
    decimals: 6,
    categories: ['layer1-blockchains'],
    description: 'Native token of Cosmos Hub, enabling interoperability between blockchains'
  },
  '0x8de5b80a0c1b02fe4976851d030b36122dbb8624': { 
    symbol: 'VANRY', 
    name: 'VANRY',
    decimals: 18,
    categories: ['ai-data', 'infrastructure'],
    description: 'AI-focused blockchain network enabling decentralized AI applications'
  },
  '0x8e870d67f660d95d5be530380d0ec0bd388289e1': { 
    symbol: 'USDP', 
    name: 'Pax Dollar',
    decimals: 18,
    categories: ['stablecoins'],
    description: 'USD-pegged stablecoin issued by Paxos with regulatory compliance'
  },
  '0x8e964e35a76103af4c7d7318e1b1a82c682ae296': { 
    symbol: 'FLZ', 
    name: 'Fellaz Token',
    decimals: 18,
    categories: ['social-content', 'nft-ecosystem'],
    description: 'Social platform token for creator economy and NFT community engagement'
  },
  '0x8ed97a637a790be1feff5e888d43629dc05408f6': { 
    symbol: 'NPC', 
    name: 'Non-Playable Coin',
    decimals: 18,
    categories: ['memecoins'],
    description: 'Meme cryptocurrency inspired by video game non-playable characters'
  },
  '0x8f8221afbb33998d8584a2b05749ba73c37a938a': { 
    symbol: 'REQ', 
    name: 'Request Token',
    decimals: 18,
    categories: ['payments', 'defi-protocols'],
    description: 'Decentralized payment request network enabling crypto invoicing and payroll'
  },
  '0x8ff795a6f4d97e7887c79bea79aba5cc76444adf': { 
    symbol: 'BCH', 
    name: 'Bitcoin Cash',
    decimals: 18,
    categories: ['layer1-blockchains', 'payments'],
    description: 'Bitcoin fork designed for fast, low-cost peer-to-peer transactions'
  },
  '0x91af0fbb28aba7e31403cb457106ce79397fd4e6': { 
    symbol: 'AERGO', 
    name: 'Aergo',
    decimals: 18,
    categories: ['layer1-blockchains', 'infrastructure'],
    description: 'Enterprise-focused blockchain platform for hybrid and private deployments'
  },
  '0x925206b8a707096ed26ae47c84747fe0bb734f59': { 
    symbol: 'WBT', 
    name: 'WBT',
    decimals: 8,
    categories: ['infrastructure'],
    description: 'Wrapped Bitcoin token enabling Bitcoin functionality on Ethereum network'
  },
  '0x92d6c1e31e14520e676a687f0a93788b716beff5': { 
    symbol: 'DYDX', 
    name: 'dYdX',
    decimals: 18,
    categories: ['defi-protocols', 'derivatives', 'dao-governance'],
    description: 'Governance token for dYdX, a leading decentralized perpetuals exchange'
  },
  '0x940a2db1b7008b6c776d4faaca729d6d4a4aa551': { 
    symbol: 'DUSK', 
    name: 'Dusk Network',
    decimals: 18,
    categories: ['privacy', 'layer1-blockchains'],
    description: 'Privacy-focused blockchain for confidential smart contracts and financial applications'
  },
  '0x94314a14df63779c99c0764a30e0cd22fa78fc0e': { 
    symbol: 'EPIC', 
    name: 'Epic Chain',
    decimals: 18,
    categories: ['layer1-blockchains'],
    description: 'High-performance blockchain platform for decentralized applications'
  },
  '0x9578689b25f8894f27c5be54b2666eb1636a0cba': { 
    symbol: 'RAY', 
    name: 'Raydium',
    decimals: 6,
    categories: ['defi-protocols'],
    description: 'Automated market maker and liquidity provider on Solana blockchain'
  },
  '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce': { 
    symbol: 'SHIB', 
    name: 'Shiba Inu',
    decimals: 18,
    categories: ['memecoins'],
    description: 'Dogecoin-inspired meme cryptocurrency with community-driven ecosystem'
  },
  '0x9aab071b4129b083b01cb5a0cb513ce7eca26fa5': { 
    symbol: 'HUNT', 
    name: 'HuntToken',
    decimals: 18,
    categories: ['social-content', 'gaming-metaverse'],
    description: 'Platform token for Steemhunt product discovery and community engagement'
  },
  '0x9d1a7a3191102e9f900faa10540837ba84dcbae7': { 
    symbol: 'EURI', 
    name: 'EURITE',
    decimals: 18,
    categories: ['stablecoins'],
    description: 'Euro-pegged stablecoin for European digital currency transactions'
  },
  '0x9d65ff81a3c488d585bbfb0bfe3c7707c7917f54': { 
    symbol: 'SSV', 
    name: 'SSV Token',
    decimals: 18,
    categories: ['infrastructure'],
    description: 'Secret Shared Validator network for distributed Ethereum validator operations'
  },
  '0x9e32b13ce7f2e80a01932b42553652e053d6ed8e': { 
    symbol: 'Metis', 
    name: 'Metis Token',
    decimals: 18,
    categories: ['layer2-scaling'],
    description: 'Native token of Metis, an Ethereum Layer 2 optimistic rollup platform'
  },
  '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2': { 
    symbol: 'MKR', 
    name: 'Maker',
    decimals: 18,
    categories: ['defi-protocols', 'dao-governance'],
    description: 'Governance token for MakerDAO, the protocol behind DAI stablecoin'
  },
  '0x9ff58067bd8d239000010c154c6983a325df138e': { 
    symbol: 'PROPC', 
    name: 'Propchain Token',
    decimals: 18,
    categories: ['real-world-assets'],
    description: 'Real estate tokenization platform enabling property investment on blockchain'
  },
  '0xa0246c9032bc3a600820415ae600c6388619a14d': { 
    symbol: 'FARM', 
    name: 'FARM Reward Token',
    decimals: 18,
    categories: ['defi-protocols'],
    description: 'Yield farming aggregator protocol maximizing returns across DeFi platforms'
  },
  '0xa0b73e1ff0b80914ab6fe0444e65848c4c34450b': { 
    symbol: 'CRO', 
    name: 'Cronos',
    decimals: 8,
    categories: ['exchange-tokens', 'layer1-blockchains'],
    description: 'Native token of Crypto.com exchange and Cronos blockchain'
  },
  '0xa1faa113cbe53436df28ff0aee54275c13b40975': { 
    symbol: 'ALPHA', 
    name: 'AlphaToken',
    decimals: 18,
    categories: ['defi-protocols'],
    description: 'Alpha Homora leveraged yield farming and liquidity provision protocol'
  },
  '0xa2120b9e674d3fc3875f415a7df52e382f141225': { 
    symbol: 'ATA', 
    name: 'Automata',
    decimals: 18,
    categories: ['privacy', 'infrastructure'],
    description: 'Privacy middleware protocol for decentralized services and applications'
  },
  '0xa2b4c0af19cc16a6cfacce81f192b024d625817d': { 
    symbol: 'KISHU', 
    name: 'Kishu Inu',
    decimals: 9,
    categories: ['memecoins'],
    description: 'Community-driven meme token inspired by the Shiba Inu dog breed'
  },
  '0xa2cd3d43c775978a96bdbf12d733d5a1ed94fb18': { 
    symbol: 'XCN', 
    name: 'Chain',
    decimals: 18,
    categories: ['infrastructure', 'payments'],
    description: 'Blockchain infrastructure for building scalable financial applications'
  },

  '0xa62cc35625b0c8dc1faea39d33625bb4c15bd71c': { 
    symbol: 'STMX', 
    name: 'StormX',
    decimals: 18,
    categories: ['payments', 'social-content'],
    description: 'Gamified micro-task platform enabling cryptocurrency earnings'
  },
  '0xa8258abc8f2811dd48eccd209db68f25e3e34667': { 
    symbol: 'DAG', 
    name: 'Constellation',
    decimals: 8,
    categories: ['layer1-blockchains', 'infrastructure'],
    description: 'Distributed ledger technology using directed acyclic graph structure'
  },
  '0xa91ac63d040deb1b7a5e4d4134ad23eb0ba07e14': { 
    symbol: 'BEL', 
    name: 'Bella',
    decimals: 18,
    categories: ['defi-protocols'],
    description: 'One-stop DeFi suite offering yield farming and lending services'
  },
  '0xa9b1eb5908cfc3cdf91f9b8b3a74108598009096': { 
    symbol: 'Auction', 
    name: 'Bounce Token',
    decimals: 18,
    categories: ['defi-protocols', 'nft-ecosystem'],
    description: 'Decentralized auction protocol for token and NFT sales'
  },
  '0xa9e8acf069c58aec8825542845fd754e41a9489a': { 
    symbol: 'pepecoin', 
    name: 'pepeCoin',
    decimals: 18,
    categories: ['memecoins'],
    description: 'Meme cryptocurrency inspired by the popular Pepe internet meme'
  },
  '0xaa7a9ca87d3694b5755f213b5d04094b8d0f0a6f': { 
    symbol: 'TRAC', 
    name: 'Trace Token',
    decimals: 18,
    categories: ['real-world-assets', 'infrastructure'],
    description: 'Decentralized knowledge graph protocol for supply chain and data integrity'
  },
  '0xaaaaaa20d9e0e2461697782ef11675f668207961': { 
    symbol: 'AURORA', 
    name: 'Aurora',
    decimals: 18,
    categories: ['layer2-scaling', 'infrastructure'],
    description: 'Ethereum Virtual Machine on NEAR Protocol for cross-chain development'
  },
  '0xaaaebe6fe48e54f431b0c390cfaf0b017d09d42d': { 
    symbol: 'CEL', 
    name: 'Celsius',
    decimals: 4,
    categories: ['defi-protocols'],
    description: 'Utility token for Celsius Network cryptocurrency lending platform'
  },
  '0xaaee1a9723aadb7afa2810263653a34ba2c21c7a': { 
    symbol: 'Mog', 
    name: 'Mog Coin',
    decimals: 18,
    categories: ['memecoins'],
    description: 'Community-driven meme token with internet culture branding'
  },

  '0xade00c28244d5ce17d72e40330b1c318cd12b7c3': { 
    symbol: 'ADX', 
    name: 'AdEx Network',
    decimals: 18,
    categories: ['social-content'],
    description: 'Decentralized advertising exchange protocol for transparent digital advertising'
  },
  '0xadf7c35560035944e805d98ff17d58cde2449389': { 
    symbol: 'SPEC', 
    name: 'Spectral Token',
    decimals: 18,
    categories: ['ai-data', 'infrastructure'],
    description: 'AI-powered on-chain credit scoring and risk assessment protocol'
  },
  '0xae12c5930881c53715b369cec7606b70d8eb229f': { 
    symbol: 'C98', 
    name: 'Coin98',
    decimals: 18,
    categories: ['defi-protocols', 'infrastructure'],
    description: 'Cross-chain DeFi platform and multi-blockchain wallet ecosystem'
  },
  '0xae7ab96520de3a18e5e111b5eaab095312d7fe84': {
    symbol: 'stETH',
    name: 'Liquid staked Ether 2.0',
    decimals: 18,
    categories: ['liquid-staking'],
    description: 'Liquid staking token representing staked ETH in the Lido protocol'
  },
  '0xaea46a60368a7bd060eec7df8cba43b7ef41ad85': { 
    symbol: 'FET', 
    name: 'Fetch',
    decimals: 18,
    categories: ['ai-data', 'infrastructure'],
    description: 'Native token of Fetch.ai, enabling autonomous AI agents and machine learning'
  },
  '0xaf5191b0de278c7286d6c7cc6ab6bb8a73ba2cd6': { 
    symbol: 'STG', 
    name: 'StargateToken',
    decimals: 18,
    categories: ['infrastructure', 'defi-protocols'],
    description: 'Token for Stargate Finance, enabling seamless cross-chain liquidity transfer'
  },
  '0xb0ac2b5a73da0e67a8e5489ba922b3f8d582e058': { 
    symbol: 'SHIRO', 
    name: 'Shiro Neko',
    decimals: 18,
    categories: ['memecoins'],
    description: 'Anime-inspired meme token featuring Japanese cat character branding'
  },
  '0xb131f4a55907b10d1f0a50d8ab8fa09ec342cd74': { 
    symbol: 'MEME', 
    name: 'Memecoin',
    decimals: 18,
    categories: ['memecoins', 'nft-ecosystem'],
    description: 'NFT platform and marketplace focused on meme culture and digital collectibles'
  },
  '0xb2617246d0c6c0087f18703d576831899ca94f01': { 
    symbol: 'ZIG', 
    name: 'ZigCoin',
    decimals: 18,
    categories: ['defi-protocols'],
    description: 'Copy trading platform token enabling social trading and investment strategies'
  },
  '0xb4357054c3da8d46ed642383f03139ac7f090343': { 
    symbol: 'PORT3', 
    name: 'Port3 Network',
    decimals: 18,
    categories: ['social-content', 'ai-data'],
    description: 'AI-powered social data aggregation and analytics platform'
  },
  '0xb4a3b0faf0ab53df58001804dda5bfc6a3d59008': { 
    symbol: 'SPA', 
    name: 'Sperax',
    decimals: 18,
    categories: ['stablecoins', 'defi-protocols'],
    description: 'Algorithmic stablecoin protocol with auto-yield and DeFi integration'
  },
  '0xb50721bcf8d664c30412cfbc6cf7a15145234ad1': { 
    symbol: 'ARB', 
    name: 'Arbitrum',
    decimals: 18,
    categories: ['layer2-scaling', 'dao-governance'],
    description: 'Governance token for Arbitrum, a popular Ethereum Layer 2 solution'
  },
  '0xb62132e35a6c13ee1ee0f84dc5d40bad8d815206': { 
    symbol: 'NEXO', 
    name: 'Nexo',
    decimals: 18,
    categories: ['defi-protocols', 'payments'],
    description: 'Instant crypto credit line platform with interest-earning accounts'
  },
  '0xb64ef51c888972c908cfacf59b47c1afbc0ab8ac': { 
    symbol: 'STORJ', 
    name: 'StorjToken',
    decimals: 8,
    categories: ['infrastructure'],
    description: 'Decentralized cloud storage network enabling secure file storage'
  },
  '0xb879da8b24c9b8685de90aabf07584afa7b59d60': { 
    symbol: 'MBL', 
    name: 'MovieBloc',
    decimals: 18,
    categories: ['social-content'],
    description: 'Decentralized movie and content distribution platform'
  },
  '0xb8c77482e45f1f44de1745f52c74426c631bdd52': { 
    symbol: 'BNB', 
    name: 'Binance Coin',
    decimals: 18,
    categories: ['exchange-tokens', 'layer1-blockchains'],
    description: 'Native token of Binance exchange and BNB Chain ecosystem'
  },
  '0xb90b2a35c65dbc466b04240097ca756ad2005295': { 
    symbol: 'BOBO', 
    name: 'BOBO',
    decimals: 18,
    categories: ['memecoins'],
    description: 'Meme cryptocurrency with community-driven development and features'
  },

  '0xba100000625a3754423978a60c9317c58a424e3d': { 
    symbol: 'BAL', 
    name: 'Balancer',
    decimals: 18,
    categories: ['defi-protocols', 'dao-governance'],
    description: 'Governance token for Balancer, an automated portfolio manager and DEX'
  },
  '0xba41ddf06b7ffd89d1267b5a93bfef2424eb2003': { 
    symbol: 'MYTH', 
    name: 'Mythos',
    decimals: 18,
    categories: ['gaming-metaverse'],
    description: 'Gaming-focused blockchain ecosystem for game developers and players'
  },
  '0xba5bde662c17e2adff1075610382b9b691296350': { 
    symbol: 'RARE', 
    name: 'SuperRare',
    decimals: 18,
    categories: ['nft-ecosystem'],
    description: 'Digital art marketplace and community platform for NFT creators'
  },

  '0xbb0e17ef65f82ab018d8edd776e8dd940327b28b': { 
    symbol: 'AXS', 
    name: 'Axie Infinity Shard',
    decimals: 18,
    categories: ['gaming-metaverse', 'dao-governance'],
    description: 'Governance token for Axie Infinity, a leading play-to-earn blockchain game'
  },
  '0xbbbbca6a901c926f240b89eacb641d8aec7aeafd': { 
    symbol: 'LRC', 
    name: 'LoopringCoin V2',
    decimals: 18,
    categories: ['layer2-scaling', 'defi-protocols'],
    description: 'Token for Loopring, a zkRollup Layer 2 solution for Ethereum DEX'
  },
  '0xbc396689893d065f41bc2c6ecbee5e0085233447': { 
    symbol: 'PERP', 
    name: 'Perpetual',
    decimals: 18,
    categories: ['derivatives', 'defi-protocols'],
    description: 'Decentralized perpetual futures trading protocol with virtual AMM'
  },
  '0xbe0ed4138121ecfc5c0e56b40517da27e6c5226b': { 
    symbol: 'ATH', 
    name: 'Aethir Token',
    decimals: 18,
    categories: ['infrastructure', 'ai-data'],
    description: 'Decentralized cloud computing network for AI and gaming applications'
  },
  '0xbe1a001fe942f96eea22ba08783140b9dcc09d28': { 
    symbol: 'BETA', 
    name: 'Beta Token',
    decimals: 18,
    categories: ['defi-protocols'],
    description: 'Leveraged yield farming and automated portfolio management protocol'
  },
  
  '0xbf2179859fc6d5bee9bf9158632dc51678a4100e': { 
    symbol: 'ELF', 
    name: 'ELF Token',
    decimals: 18,
    categories: ['layer1-blockchains'],
    description: 'Native token of aelf blockchain platform for commercial business applications'
  },
  '0xc00e94cb662c3520282e6f5717214004a7f26888': { 
    symbol: 'COMP', 
    name: 'Compound',
    decimals: 18,
    categories: ['defi-protocols', 'dao-governance'],
    description: 'Governance token for Compound Protocol, a leading DeFi lending platform'
  },
  '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f': { 
    symbol: 'SNX', 
    name: 'Synthetix Network Token',
    decimals: 18,
    categories: ['defi-protocols', 'derivatives'],
    description: 'Token for Synthetix, enabling trading of synthetic assets and derivatives'
  },
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': { 
    symbol: 'WETH', 
    name: 'Wrapped Ether',
    decimals: 18,
    categories: ['infrastructure'],
    description: 'ERC-20 compatible version of Ethereum for DeFi protocols'
  },
  '0xc18360217d8f7ab5e7c516566761ea12ce7f9d72': { 
    symbol: 'ENS', 
    name: 'Ethereum Name Service',
    decimals: 18,
    categories: ['infrastructure', 'dao-governance'],
    description: 'Decentralized naming service for human-readable blockchain addresses'
  },

  '0xc4441c2be5d8fa8126822b9929ca0b81ea0de38e': { 
    symbol: 'USUAL', 
    name: 'USUAL',
    decimals: 18,
    categories: ['defi-protocols', 'stablecoins'],
    description: 'Decentralized fiat stablecoin protocol with institutional backing'
  },
  '0xc477d038d5420c6a9e0b031712f61c5120090de9': { 
    symbol: 'BOSON', 
    name: 'Boson Token',
    decimals: 18,
    categories: ['real-world-assets', 'defi-protocols'],
    description: 'Commerce protocol enabling tokenization of real-world assets and products'
  },
  '0xc52c326331e9ce41f04484d3b5e5648158028804': { 
    symbol: 'ZCX', 
    name: 'ZEN Exchange Token',
    decimals: 18,
    categories: ['exchange-tokens'],
    description: 'Utility token for ZEN cryptocurrency exchange and trading platform'
  },
  '0xc555d625828c4527d477e595ff1dd5801b4a600e': { 
    symbol: 'MON', 
    name: 'MON',
    decimals: 18,
    categories: ['gaming-metaverse'],
    description: 'Gaming utility token powering monster collection and battle games'
  },
  '0xc5f0f7b66764f6ec8c8dff7ba683102295e16409': { 
    symbol: 'FDUSD', 
    name: 'First Digital USD',
    decimals: 18,
    categories: ['stablecoins'],
    description: 'USD-pegged stablecoin issued by First Digital Trust for institutional use'
  },
  '0xc669928185dbce49d2230cc9b0979be6dc797957': { 
    symbol: 'BTT', 
    name: 'BitTorrent',
    decimals: 18,
    categories: ['infrastructure', 'social-content'],
    description: 'Token for BitTorrent protocol enabling decentralized file sharing'
  },
  '0xc944e90c64b2c07662a292be6244bdf05cda44a7': { 
    symbol: 'GRT', 
    name: 'Graph Token',
    decimals: 18,
    categories: ['infrastructure'],
    description: 'Indexing protocol for querying networks like Ethereum and IPFS'
  },
  '0xc98d64da73a6616c42117b582e832812e7b8d57f': { 
    symbol: 'RSS3', 
    name: 'RSS3',
    decimals: 18,
    categories: ['social-content', 'infrastructure'],
    description: 'Decentralized social media and content distribution protocol'
  },
  '0xca14007eff0db1f8135f4c25b34de49ab0d42766': { 
    symbol: 'STRK', 
    name: 'StarkNet Token',
    decimals: 18,
    categories: ['layer2-scaling'],
    description: 'Native token of StarkNet, a validity rollup Layer 2 for Ethereum'
  },
  '0xcb1592591996765ec0efc1f92599a19767ee5ffa': { 
    symbol: 'BIO', 
    name: 'BIO',
    decimals: 18,
    categories: ['real-world-assets', 'dao-governance'],
    description: 'Decentralized biotech funding and research coordination protocol'
  },
  '0xcc8fa225d80b9c7d42f96e9570156c65d6caaa25': { 
    symbol: 'SLP', 
    name: 'Smooth Love Potion',
    decimals: 0,
    categories: ['gaming-metaverse'],
    description: 'In-game utility token for Axie Infinity breeding and gameplay mechanics'
  },
  '0xccc8cb5229b0ac8069c51fd58367fd1e622afd97': { 
    symbol: 'GODS', 
    name: 'Gods Unchained',
    decimals: 18,
    categories: ['gaming-metaverse', 'nft-ecosystem'],
    description: 'Play-to-earn trading card game with NFT cards and competitive tournaments'
  },
  '0xcf0c122c6b73ff809c693db761e7baebe62b6a2e': { 
    symbol: 'FLOKI', 
    name: 'FLOKI',
    decimals: 9,
    categories: ['memecoins'],
    description: 'Community-driven memecoin inspired by Elon Musk\'s dog with utility features'
  },
  '0xd101dcc414f310268c37eeb4cd376ccfa507f571': { 
    symbol: 'RSC', 
    name: 'ResearchCoin',
    decimals: 18,
    categories: ['ai-data', 'dao-governance'],
    description: 'Decentralized research funding and collaboration platform for scientific innovation'
  },
  '0xd13c7342e1ef687c5ad21b27c2b65d772cab5c8c': { 
    symbol: 'UOS', 
    name: 'Ultra Token',
    decimals: 4,
    categories: ['gaming-metaverse'],
    description: 'Gaming blockchain platform for digital game distribution and NFTs'
  },
  '0xd1d2eb1b1e90b638588728b4130137d262c87cae': { 
    symbol: 'GALA', 
    name: 'Gala',
    decimals: 8,
    categories: ['gaming-metaverse'],
    description: 'Utility token for Gala Games ecosystem, powering blockchain gaming'
  },
  '0xd26114cd6ee289accf82350c8d8487fedb8a0c07': { 
    symbol: 'OMG', 
    name: 'OMGToken',
    decimals: 18,
    categories: ['layer2-scaling', 'payments'],
    description: 'OMG Network enabling scalable Ethereum payments and transfers'
  },
  '0xd33526068d116ce69f19a9ee46f0bd304f21a51f': { 
    symbol: 'RPL', 
    name: 'Rocket Pool Protocol',
    decimals: 18,
    categories: ['dao-governance'],
    description: 'Governance and utility token for Rocket Pool decentralized staking network'
  },

  '0xd7efb00d12c2c13131fd319336fdf952525da2af': { 
    symbol: 'XPR', 
    name: 'Proton',
    decimals: 4,
    categories: ['payments', 'layer1-blockchains'],
    description: 'Fast payment blockchain with human-readable account names and identity'
  },
  '0xd85a6ae55a7f33b0ee113c234d2ee308edeaf7fd': { 
    symbol: 'CBK', 
    name: 'Cobak Token',
    decimals: 18,
    categories: ['social-content'],
    description: 'Cryptocurrency community platform and social trading network'
  },

  '0xd9fcd98c322942075a5c3860693e9f4f03aae07b': { 
    symbol: 'EUL', 
    name: 'Euler',
    decimals: 18,
    categories: ['defi-protocols', 'dao-governance'],
    description: 'Permissionless lending protocol with reactive interest rates and risk management'
  },
  '0xdab396ccf3d84cf2d07c4454e10c8a6f5b008d2b': { 
    symbol: 'GFI', 
    name: 'Goldfinch',
    decimals: 18,
    categories: ['real-world-assets', 'defi-protocols'],
    description: 'Decentralized credit protocol bringing real-world lending to DeFi'
  },
  '0xdbb5cf12408a3ac17d668037ce289f9ea75439d7': { 
    symbol: 'WMTX', 
    name: 'WorldMobileToken',
    decimals: 6,
    categories: ['infrastructure'],
    description: 'Decentralized mobile network enabling global connectivity infrastructure'
  },
  '0xdbb7a34bf10169d6d2d0d02a6cbb436cf4381bfa': { 
    symbol: 'ZENT', 
    name: 'Zentry',
    decimals: 18,
    categories: ['gaming-metaverse'],
    description: 'Gaming ecosystem unifying web2 and web3 experiences across platforms'
  },
  '0xdbdb4d16eda451d0503b854cf79d55697f90c8df': { 
    symbol: 'ALCX', 
    name: 'Alchemix',
    decimals: 18,
    categories: ['defi-protocols', 'dao-governance'],
    description: 'Self-repaying loans protocol using future yield as collateral'
  },
  '0xdc9ac3c20d1ed0b540df9b1fedc10039df13f99c': { 
    symbol: 'UTK', 
    name: 'Utrust Token',
    decimals: 18,
    categories: ['payments'],
    description: 'Cryptocurrency payment platform with buyer protection and merchant tools'
  },
  '0xddb3422497e61e13543bea06989c0789117555c5': { 
    symbol: 'COTI', 
    name: 'COTI Token',
    decimals: 18,
    categories: ['payments', 'layer1-blockchains'],
    description: 'Digital currency and payment processing platform for merchants'
  },
  '0xde30da39c46104798bb5aa3fe8b9e0e1f348163f': { 
    symbol: 'GTC', 
    name: 'Gitcoin',
    decimals: 18,
    categories: ['dao-governance', 'social-content'],
    description: 'Quadratic funding platform for open source software development'
  },
  '0xde4ee8057785a7e8e800db58f9784845a5c2cbd6': { 
    symbol: 'DEXE', 
    name: 'Dexe',
    decimals: 18,
    categories: ['defi-protocols', 'dao-governance'],
    description: 'Decentralized social trading platform with portfolio management tools'
  },
  '0xde7d85157d9714eadf595045cc12ca4a5f3e2adb': { 
    symbol: 'STPT', 
    name: 'STPT',
    decimals: 18,
    categories: ['infrastructure'],
    description: 'Standard Tokenization Protocol for asset tokenization and compliance'
  },
  '0xdef1ca1fb7fbcdc777520aa7f396b4e015f497ab': { 
    symbol: 'COW', 
    name: 'CoW Protocol Token',
    decimals: 18,
    categories: ['defi-protocols', 'dao-governance'],
    description: 'Governance token for CoW Protocol, enabling MEV-protected trading'
  },
  '0xe0f63a424a4439cbe457d80e4f4b51ad25b2c56c': { 
    symbol: 'SPX', 
    name: 'SPX6900',
    decimals: 8,
    categories: ['memecoins'],
    description: 'Meme token inspired by S&P 500 index with financial market references'
  },
  '0xe1bad922f84b198a08292fb600319300ae32471b': { 
    symbol: 'FCT', 
    name: '[FCT] FirmaChain Token',
    decimals: 18,
    categories: ['real-world-assets', 'infrastructure'],
    description: 'Blockchain platform for unforgeable digital contracts and document verification'
  },

  '0xe28b3b32b6c345a34ff64674606124dd5aceca30': { 
    symbol: 'INJ', 
    name: 'Injective Token',
    decimals: 18,
    categories: ['layer1-blockchains', 'defi-protocols', 'derivatives'],
    description: 'Native token of Injective Protocol, a decentralized derivatives exchange'
  },
  '0xe3c408bd53c31c085a1746af401a4042954ff740': { 
    symbol: 'GMT', 
    name: 'GreenMetaverseToken',
    decimals: 8,
    categories: ['gaming-metaverse'],
    description: 'Move-to-earn fitness app token incentivizing physical activity and wellness'
  },
  '0xe41d2489571d322189246dafa5ebde1f4699f498': { 
    symbol: 'ZRX', 
    name: '0x Protocol Token',
    decimals: 18,
    categories: ['defi-protocols', 'infrastructure'],
    description: 'Protocol for decentralized exchange infrastructure and liquidity aggregation'
  },

  '0xe53ec727dbdeb9e2d5456c3be40cff031ab40a55': { 
    symbol: 'SUPER', 
    name: 'SuperFarm',
    decimals: 18,
    categories: ['nft-ecosystem', 'defi-protocols'],
    description: 'Cross-chain DeFi protocol enabling NFT farming and yield generation'
  },
  '0xe66747a101bff2dba3697199dcce5b743b454759': { 
    symbol: 'GT', 
    name: 'GateChainToken',
    decimals: 18,
    categories: ['exchange-tokens'],
    description: 'Utility token for Gate.io exchange with trading fee discounts'
  },
  '0xe77f6acd24185e149e329c1c0f479201b9ec2f4b': { 
    symbol: 'ZBU', 
    name: 'ZEEBU',
    decimals: 18,
    categories: ['payments', 'infrastructure'],
    description: 'Utility token for telecom carrier settlements and blockchain infrastructure'
  },

  '0xea26c4ac16d4a5a106820bc8aee85fd0b7b2b664': { 
    symbol: 'QKC', 
    name: 'QuarkChain Token',
    decimals: 18,
    categories: ['layer1-blockchains', 'infrastructure'],
    description: 'Sharded blockchain network enabling high-throughput decentralized applications'
  },
  '0xec53bf9167f50cdeb3ae105f56099aaab9061f83': { 
    symbol: 'EIGEN', 
    name: 'Eigen',
    decimals: 18,
    categories: ['infrastructure'],
    description: 'Governance token for EigenLayer, enabling Ethereum restaking infrastructure'
  },
  '0xec67005c4e498ec7f55e092bd1d35cbc47c91892': { 
    symbol: 'MLN', 
    name: 'Melon Token',
    decimals: 18,
    categories: ['defi-protocols'],
    description: 'Asset management protocol for creating and managing investment strategies'
  },
  '0xed04915c23f00a313a544955524eb7dbd823143d': { 
    symbol: 'ACH', 
    name: 'Alchemy',
    decimals: 8,
    categories: ['payments'],
    description: 'Hybrid cryptocurrency payment network bridging fiat and digital currencies'
  },
  '0xed35af169af46a02ee13b9d79eb57d6d68c1749e': { 
    symbol: 'OMI', 
    name: 'OMI Token',
    decimals: 18,
    categories: ['nft-ecosystem', 'gaming-metaverse'],
    description: 'Utility token for ECOMI ecosystem and VeVe NFT marketplace'
  },
  '0xf091867ec603a6628ed83d274e835539d82e9cc8': { 
    symbol: 'ZETA', 
    name: 'Zeta',
    decimals: 18,
    categories: ['layer1-blockchains', 'infrastructure'],
    description: 'Omnichain blockchain connecting all chains and enabling universal applications'
  },
  '0xf17e65822b568b3903685a7c9f496cf7656cc6c2': { 
    symbol: 'BICO', 
    name: 'Biconomy Token',
    decimals: 18,
    categories: ['infrastructure'],
    description: 'Multi-chain relayer infrastructure simplifying blockchain user experience'
  },

  '0xf34960d9d60be18cc1d5afc1a6f012a723a28811': { 
    symbol: 'KCS', 
    name: 'KuCoin Token',
    decimals: 6,
    categories: ['exchange-tokens'],
    description: 'Utility token for KuCoin exchange with trading benefits and profit sharing'
  },
  '0xf3b9569f82b18aef890de263b84189bd33ebe452': { 
    symbol: 'CAW', 
    name: 'A Hunters Dream',
    decimals: 18,
    categories: ['memecoins'],
    description: 'Community-driven meme token with twitter-inspired branding and culture'
  },
  '0xf411903cbc70a74d22900a5de66a2dda66507255': { 
    symbol: 'VRA', 
    name: 'VERA',
    decimals: 18,
    categories: ['social-content', 'infrastructure'],
    description: 'Video reward platform enabling ad-fraud prevention and content monetization'
  },
  '0xf57e7e7c23978c3caec3c3548e3d615c346e79ff': { 
    symbol: 'IMX', 
    name: 'Immutable X',
    decimals: 18,
    categories: ['gaming-metaverse', 'nft-ecosystem', 'layer2-scaling'],
    description: 'Native token of Immutable X, a Layer 2 solution for NFTs and gaming'
  },
  '0xf629cbd94d3791c9250152bd8dfbdf380e2a3b9c': { 
    symbol: 'ENJ', 
    name: 'Enjin Coin',
    decimals: 18,
    categories: ['gaming-metaverse', 'nft-ecosystem'],
    description: 'Utility token for Enjin ecosystem, backing NFTs and powering blockchain games'
  },
  '0xf8f173e20e15f3b6cb686fb64724d370689de083': { 
    symbol: 'HEI', 
    name: 'Heima',
    decimals: 18,
    categories: ['gaming-metaverse'],
    description: 'Gaming ecosystem token for blockchain-based gaming experiences'
  },
  '0xf944e35f95e819e752f3ccb5faf40957d311e8c5': { 
    symbol: 'MOCA', 
    name: 'Moca',
    decimals: 18,
    categories: ['gaming-metaverse', 'nft-ecosystem'],
    description: 'Gaming and entertainment ecosystem focusing on NFTs and digital experiences'
  },
  '0xf94e7d0710709388bce3161c32b4eea56d3f91cc': { 
    symbol: 'DSync', 
    name: 'Destra Network',
    decimals: 18,
    categories: ['infrastructure', 'defi-protocols'],
    description: 'Cross-chain infrastructure enabling seamless blockchain interoperability'
  },
  '0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3': { 
    symbol: 'ONDO', 
    name: 'Ondo',
    decimals: 18,
    categories: ['real-world-assets', 'defi-protocols'],
    description: 'Institutional-grade tokenized securities and structured products platform'
  },
  '0xfc82bb4ba86045af6f327323a46e80412b91b27d': { 
    symbol: 'PROM', 
    name: 'Token Prometeus Network',
    decimals: 18,
    categories: ['ai-data', 'infrastructure'],
    description: 'Secure data marketplace enabling monetization of personal and corporate data'
  },
  '0xfca59cd816ab1ead66534d82bc21e7515ce441cf': { 
    symbol: 'RARI', 
    name: 'Rarible',
    decimals: 18,
    categories: ['nft-ecosystem', 'dao-governance'],
    description: 'Community-owned NFT marketplace with creator tools and governance features'
  },

  '0xff56cc6b1e6ded347aa0b7676c85ab0b3d08b0fa': { 
    symbol: 'ORBS', 
    name: 'Orbs',
    decimals: 18,
    categories: ['infrastructure'],
    description: 'Hybrid blockchain infrastructure for enterprise and consumer applications'
  },
  '0xa35b1b31ce002fbf2058d22f30f95d405200a15b': {
    symbol: 'ETHX',
    name: 'Stader ETHx 2.69% APR',
    decimals: 18,
    categories: ['liquid-staking', 'defi-protocols'],
    description: 'Liquid staking token representing staked ETH on Stader protocol with non-rebasing appreciation model'
  },

};
