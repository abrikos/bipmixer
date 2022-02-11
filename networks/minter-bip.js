import minterCommon from './minter-common';

const network = {
    name: 'minter-main',
    label: 'Minter main network',
    nodeApi: 'https://api.minter.one/v2',
    explorerApi: 'https://explorer-api.minter.network/api/v2',
    coin: 'BIP',
    explorer: 'https://explorer.minter.network/',
    image: 'https://my.minter.network/api/v1/avatar/by/coin/',
    chainId: 1
}

export default  minterCommon(network);
