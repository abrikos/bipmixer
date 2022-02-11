import minterCommon from './minter-common';

const network = {
    name:'minter-test',
    label:'Minter testnet network',
    nodeApi: 'https://node-api.testnet.minter.network/v2',
    explorerApi: 'https://explorer-api.testnet.minter.network/api/v2',
    coin: 'MNT',
    explorer: 'https://explorer.testnet.minter.network/',
    image: 'https://my.beta.minter.network/api/v1/avatar/by/coin/',
    chainId: 2
}

export default minterCommon(network);
